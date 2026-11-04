import nodemailer from 'nodemailer';
import db from '../prisma';
import { apenasDigitos } from './dps';
import {
   AMBIENTE_PRODUCAO, formatarCnpj, lerNotaAdn, numeroDaNota, serieDaNota,
} from './emissor';
import { gerarDanfsePdf } from './danfse';
import { criarZipBuffer, type ArquivoZip } from './zip';
import { abrirCredencialEscritorio } from './servidor';
import { consultarLoteDfe, descompactarXmlGzip } from './sefin';

export const EMAIL_SETOR_FISCAL_PADRAO = 'fiscal@privilegecontabilidade.com.br';

const LIMITE_BYTES_ANEXO_EMAIL = 14 * 1024 * 1024; // ~14 MB para envio seguro via SMTP
const TEMPO_MAX_SYNC_ADN_MS = 18_000;

export interface OpcoesRelatorioFiscal {
  dataInicio?: string;       // YYYY-MM-DD
  dataFim?: string;          // YYYY-MM-DD
  empresaId?: string;        // Se informado, filtra apenas esta empresa
  destinatarios?: string[];  // Se vazio, envia para fiscal@privilegecontabilidade.com.br
  sincronizarAdn?: boolean;  // Se true, consulta novos documentos no ADN antes de gerar
  anexarZip?: boolean;       // Se true (padrão), anexa ZIP com XMLs e DANFSe em PDF
  incluirSemMovimento?: boolean;
}

export interface ResultadoRelatorioFiscal {
  sucesso: boolean;
  periodo: { dataInicio: string; dataFim: string; competencia: string };
  destinatarios: string[];
  sincronizadasAdn: number;
  resumoPeriodo: {
    qtdEmitidas: number;
    valorEmitidasBruto: number;
    valorEmitidasLiquido: number;
    issEmitidas: number;
    retencoesEmitidas: number;
    qtdTomadas: number;
    valorTomadasBruto: number;
    valorTomadasLiquido: number;
    issTomadas: number;
    retencoesTomadas: number;
    empresasComMovimento: number;
  };
  resumoMes: {
    qtdEmitidas: number;
    valorEmitidasBruto: number;
    qtdTomadas: number;
    valorTomadasBruto: number;
  };
  anexoGerado: boolean;
  arquivosNoZip: number;
  mensagem: string;
}

function dataBrasiliaOffset(diasOffset = 0): string {
  const agora = new Date(Date.now() - 3 * 3600 * 1000 + diasOffset * 86400 * 1000);
  return agora.toISOString().slice(0, 10);
}

function formatarMoeda(valor: number): string {
  return (Number(valor) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatarDataBr(iso: string): string {
  if (!iso) return '—';
  const [a, m, d] = iso.slice(0, 10).split('-');
  return d && m && a ? `${d}/${m}/${a}` : iso;
}

function sanitizarPasta(texto: string): string {
  return (texto || 'Empresa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]+/g, '')
    .trim()
    .slice(0, 42) || 'Empresa';
}

function ehNotaTomadaPorCnpj(prestadorCnpj: string | null | undefined, empresaCnpj: string): boolean {
  const cEmp = apenasDigitos(empresaCnpj || '');
  const cPrest = apenasDigitos(prestadorCnpj || '');
  if (!cEmp || !cPrest) return false;
  return cPrest !== cEmp;
}

/**
 * Sincroniza rapidamente novos documentos do ADN para a empresa selecionada
 * ou para um lote de empresas com procuração ativa, respeitando o limite de tempo.
 */
async function sincronizarNovasNotasAdn(empresaIdFiltro?: string): Promise<number> {
  const abertura = await abrirCredencialEscritorio();
  if ('erro' in abertura) return 0;

  const inicio = Date.now();
  let novasGravadas = 0;

  const configs = await db.nfseConfig.findMany({
    where: {
      usarProcuracao: true,
      procuracaoStatus: 'ativa',
      ...(empresaIdFiltro ? { empresaId: empresaIdFiltro } : {}),
    },
    include: {
      empresa: { select: { id: true, cnpj: true, razaoSocial: true } },
    },
    orderBy: { updatedAt: 'asc' },
    take: empresaIdFiltro ? 1 : 25,
  });

  for (const cfg of configs) {
    if (Date.now() - inicio > TEMPO_MAX_SYNC_ADN_MS) break;
    const cnpj = apenasDigitos(cfg.empresa?.cnpj || '');
    if (cnpj.length !== 14) continue;

    try {
      const lote = await consultarLoteDfe(cfg.ultimoNsu || 0, cnpj, AMBIENTE_PRODUCAO, abertura.credencial);
      if (!lote.ok) continue;

      let maiorNsu = cfg.ultimoNsu || 0;
      for (const doc of lote.documentos) {
        if (doc.nsu > maiorNsu) maiorNsu = doc.nsu;
        if (doc.tipoDocumento && doc.tipoDocumento !== 'NFSE') continue;
        if (!doc.xmlGzipBase64) continue;

        let xml: string;
        try { xml = descompactarXmlGzip(doc.xmlGzipBase64); } catch { continue; }
        const lida = lerNotaAdn(xml, cnpj);
        if (!lida) continue;

        const chaveAcesso = doc.chaveAcesso || lida.chaveAcesso;
        if (!chaveAcesso) continue;

        const existente = await db.nfsE.findUnique({ where: { chaveAcesso }, select: { id: true } });
        if (existente) continue;

        const ehTomada = lida.papel === 'tomado';
        const retFed = lida.valores;
        const totalFed = (retFed.valorPis || 0) + (retFed.valorCofins || 0) + (retFed.valorInss || 0)
          + (retFed.valorIr || 0) + (retFed.valorCsll || 0);
        const valorIss = retFed.valorIss || 0;
        const base = lida.servico.valorServicos;
        const liquido = retFed.valorLiquido
          || Math.max(0, Math.round((base - (lida.servico.issRetido ? valorIss : 0) - totalFed) * 100) / 100);
        const numero = lida.numeroNfse || numeroDaNota(chaveAcesso) || String(doc.nsu);
        const serie = serieDaNota(chaveAcesso) || lida.serieDps || '1';

        const criada = await db.nfsE.create({
          data: {
            empresaId: cfg.empresa.id,
            numero,
            serie,
            codigoVerificacao: chaveAcesso.slice(-9),
            status: 'emitida',
            prestadorCnpj: formatarCnpj(lida.prestador.cnpj || (ehTomada ? '' : cnpj)),
            prestadorRazaoSocial: lida.prestador.razaoSocial || (ehTomada ? 'Prestador' : cfg.empresa.razaoSocial),
            prestadorInscricaoMunicipal: lida.prestador.inscricaoMunicipal,
            tomadorCnpjCpf: lida.tomador.documento || (ehTomada ? cnpj : ''),
            tomadorRazaoSocial: lida.tomador.razaoSocial || (ehTomada ? cfg.empresa.razaoSocial : 'Não informado'),
            tomadorEmail: lida.tomador.email,
            tomadorInscricaoMunicipal: lida.tomador.inscricaoMunicipal,
            tomadorCep: lida.tomador.cep,
            tomadorEndereco: lida.tomador.logradouro,
            tomadorNumero: lida.tomador.numero,
            tomadorComplemento: lida.tomador.complemento,
            tomadorBairro: lida.tomador.bairro,
            tomadorCodigoMunicipio: lida.tomador.codigoMunicipio,
            tomadorUf: lida.tomador.uf,
            dataEmissao: lida.dataEmissao,
            dataCompetencia: lida.dataCompetencia,
            codigoServico: lida.servico.cTribNac,
            cTribMun: lida.servico.cTribMun,
            cNbs: lida.servico.cNbs,
            discriminacao: lida.servico.descricao,
            municipioPrestacao: lida.servico.municipioPrestacao,
            valorServicos: base,
            valorDeducoes: 0,
            valorPis: retFed.valorPis || 0,
            valorCofins: retFed.valorCofins || 0,
            valorInss: retFed.valorInss || 0,
            valorIr: retFed.valorIr || 0,
            valorCsll: retFed.valorCsll || 0,
            issRetido: lida.servico.issRetido,
            valorIss,
            aliquotaIss: lida.servico.aliquota,
            valorBaseCalculo: base,
            valorLiquido: liquido,
            ambiente: 'producao',
            chaveAcesso,
            numeroDps: lida.numeroDps,
            serieDps: lida.serieDps,
            autorizadaEm: lida.autorizadaEm ? new Date(lida.autorizadaEm) : null,
          },
        });
        await db.nfseDocumento.create({ data: { nfseId: criada.id, xml } });
        novasGravadas++;
      }

      if (maiorNsu > (cfg.ultimoNsu || 0)) {
        await db.nfseConfig.update({
          where: { empresaId: cfg.empresa.id },
          data: { ultimoNsu: maiorNsu },
        });
      }
    } catch {
      // Continua nas demais empresas caso uma falhe
    }
  }

  return novasGravadas;
}

export async function enviarRelatorioFiscalDiario(
  opcoes: OpcoesRelatorioFiscal = {},
): Promise<ResultadoRelatorioFiscal> {
  const hoje = dataBrasiliaOffset(0);
  const ontem = dataBrasiliaOffset(-1);

  const dataFim = (opcoes.dataFim || hoje).slice(0, 10);
  const dataInicio = (opcoes.dataInicio || ontem).slice(0, 10);
  const competencia = dataFim.slice(0, 7);

  let sincronizadasAdn = 0;
  if (opcoes.sincronizarAdn) {
    sincronizadasAdn = await sincronizarNovasNotasAdn(opcoes.empresaId);
  }

  // Busca empresas (todas ou filtrada)
  const empresas = await db.empresa.findMany({
    where: opcoes.empresaId ? { id: opcoes.empresaId } : {},
    select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, tipo: true },
    orderBy: { razaoSocial: 'asc' },
  });
  const mapaEmpresas = new Map(empresas.map(e => [e.id, e]));

  // Busca todas as notas do mês da competência (para ter tanto o recorte do período quanto o acumulado do mês)
  const inicioMes = `${competencia}-01`;
  const fimMes = `${competencia}-31`;
  const dataMinBusca = dataInicio < inicioMes ? dataInicio : inicioMes;
  const dataMaxBusca = dataFim > fimMes ? dataFim : fimMes;

  const notasBanco = await db.nfsE.findMany({
    where: {
      ...(opcoes.empresaId ? { empresaId: opcoes.empresaId } : {}),
      chaveAcesso: { not: null },
      ambiente: 'producao',
      status: 'emitida',
      dataEmissao: { gte: dataMinBusca, lte: dataMaxBusca },
    },
    include: {
      documento: { select: { xml: true } },
    },
    orderBy: [{ dataEmissao: 'asc' }, { numero: 'asc' }],
  });

  type NotaComPapel = (typeof notasBanco)[number] & {
    papel: 'prestado' | 'tomado';
    empresaNome: string;
    empresaCnpj: string;
  };

  const todasNotas: NotaComPapel[] = [];
  for (const n of notasBanco) {
    const emp = mapaEmpresas.get(n.empresaId);
    if (!emp) continue;
    const tomada = ehNotaTomadaPorCnpj(n.prestadorCnpj, emp.cnpj);
    todasNotas.push({
      ...n,
      papel: tomada ? 'tomado' : 'prestado',
      empresaNome: emp.razaoSocial || emp.nomeFantasia,
      empresaCnpj: emp.cnpj,
    });
  }

  const notasNoPeriodo = todasNotas.filter(n => n.dataEmissao >= dataInicio && n.dataEmissao <= dataFim);
  const notasNoMes = todasNotas.filter(n => n.dataEmissao.startsWith(competencia) || n.dataCompetencia === competencia);

  const emitidasPeriodo = notasNoPeriodo.filter(n => n.papel === 'prestado');
  const tomadasPeriodo = notasNoPeriodo.filter(n => n.papel === 'tomado');

  const emitidasMes = notasNoMes.filter(n => n.papel === 'prestado');
  const tomadasMes = notasNoMes.filter(n => n.papel === 'tomado');

  const somarRetFed = (lista: NotaComPapel[]) =>
    lista.reduce((s, n) => s + (n.valorPis || 0) + (n.valorCofins || 0) + (n.valorInss || 0) + (n.valorIr || 0) + (n.valorCsll || 0), 0);

  // Agrupamento por empresa no período
  const porEmpresa = new Map<string, {
    empresaId: string;
    razaoSocial: string;
    cnpj: string;
    emitidas: NotaComPapel[];
    tomadas: NotaComPapel[];
  }>();

  for (const n of notasNoPeriodo) {
    const grupo = porEmpresa.get(n.empresaId) || {
      empresaId: n.empresaId,
      razaoSocial: n.empresaNome,
      cnpj: n.empresaCnpj,
      emitidas: [],
      tomadas: [],
    };
    if (n.papel === 'tomado') grupo.tomadas.push(n);
    else grupo.emitidas.push(n);
    porEmpresa.set(n.empresaId, grupo);
  }

  const resumoPeriodo = {
    qtdEmitidas: emitidasPeriodo.length,
    valorEmitidasBruto: emitidasPeriodo.reduce((s, n) => s + (n.valorServicos || 0), 0),
    valorEmitidasLiquido: emitidasPeriodo.reduce((s, n) => s + (n.valorLiquido || 0), 0),
    issEmitidas: emitidasPeriodo.reduce((s, n) => s + (n.valorIss || 0), 0),
    retencoesEmitidas: somarRetFed(emitidasPeriodo),
    qtdTomadas: tomadasPeriodo.length,
    valorTomadasBruto: tomadasPeriodo.reduce((s, n) => s + (n.valorServicos || 0), 0),
    valorTomadasLiquido: tomadasPeriodo.reduce((s, n) => s + (n.valorLiquido || 0), 0),
    issTomadas: tomadasPeriodo.reduce((s, n) => s + (n.valorIss || 0), 0),
    retencoesTomadas: somarRetFed(tomadasPeriodo),
    empresasComMovimento: porEmpresa.size,
  };

  const resumoMes = {
    qtdEmitidas: emitidasMes.length,
    valorEmitidasBruto: emitidasMes.reduce((s, n) => s + (n.valorServicos || 0), 0),
    qtdTomadas: tomadasMes.length,
    valorTomadasBruto: tomadasMes.reduce((s, n) => s + (n.valorServicos || 0), 0),
  };

  // Monta destinatários
  const listaDestinatarios = new Set<string>();
  if (opcoes.destinatarios && opcoes.destinatarios.length > 0) {
    opcoes.destinatarios.forEach(e => {
      if (e && e.includes('@')) listaDestinatarios.add(e.trim().toLowerCase());
    });
  } else {
    listaDestinatarios.add(EMAIL_SETOR_FISCAL_PADRAO);
    const usuariosFiscais = await db.user.findMany({
      where: {
        receberEmailDiario: true,
        email: { contains: 'fiscal', mode: 'insensitive' },
      },
      select: { email: true },
    });
    usuariosFiscais.forEach(u => {
      if (u.email?.includes('@')) listaDestinatarios.add(u.email.trim().toLowerCase());
    });
  }

  const destinatarios = Array.from(listaDestinatarios);

  // Monta ZIP com XMLs e DANFSe PDFs se houver notas no período
  let zipBuffer: Buffer | null = null;
  let arquivosNoZip = 0;

  if (opcoes.anexarZip !== false && notasNoPeriodo.length > 0) {
    const arquivosZip: ArquivoZip[] = [];
    let bytesAcumulados = 0;

    for (const grupo of porEmpresa.values()) {
      const pastaEmpresa = `${apenasDigitos(grupo.cnpj)}_${sanitizarPasta(grupo.razaoSocial)}`;
      const todasGrupo = [...grupo.emitidas, ...grupo.tomadas];

      for (const n of todasGrupo) {
        if (!n.documento?.xml) continue;
        const subpasta = n.papel === 'tomado' ? 'servicos_tomados' : 'notas_emitidas';
        const num = String(n.numero || '0').padStart(6, '0');
        const baseNome = `NFSe-${num}-${n.dataEmissao}-${n.chaveAcesso || n.id}`;

        const xmlBytes = Buffer.from(n.documento.xml, 'utf8');
        if (bytesAcumulados + xmlBytes.length < LIMITE_BYTES_ANEXO_EMAIL) {
          arquivosZip.push({
            nome: `${pastaEmpresa}/${subpasta}/xml/${baseNome}.xml`,
            conteudo: xmlBytes,
            data: new Date(`${n.dataEmissao}T12:00:00Z`),
          });
          bytesAcumulados += xmlBytes.length;
        }

        try {
          const pdfBytes = await gerarDanfsePdf({
            xml: n.documento.xml,
            cancelada: n.status === 'cancelada',
            homologacao: false,
          });
          if (bytesAcumulados + pdfBytes.length < LIMITE_BYTES_ANEXO_EMAIL) {
            arquivosZip.push({
              nome: `${pastaEmpresa}/${subpasta}/pdf/${baseNome}.pdf`,
              conteudo: pdfBytes,
              data: new Date(`${n.dataEmissao}T12:00:00Z`),
            });
            bytesAcumulados += pdfBytes.length;
          }
        } catch {
          // Segue com o XML caso alguma nota não gere PDF
        }
      }
    }

    if (arquivosZip.length > 0) {
      zipBuffer = criarZipBuffer(arquivosZip);
      arquivosNoZip = arquivosZip.length;
    }
  }

  // Monta HTML do e-mail
  const labelPeriodo = dataInicio === dataFim
    ? formatarDataBr(dataInicio)
    : `${formatarDataBr(dataInicio)} a ${formatarDataBr(dataFim)}`;

  let blocosEmpresasHtml = '';
  if (porEmpresa.size === 0) {
    blocosEmpresasHtml = `
      <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 24px; text-align: center; color: #6b7280; font-size: 13.5px;">
        Nenhuma nota emitida ou serviço tomado registrado no período de <strong>${labelPeriodo}</strong>.
        <div style="margin-top: 6px; font-size: 12px;">No acumulado da competência <strong>${competencia}</strong>, constam <strong>${resumoMes.qtdEmitidas}</strong> nota(s) emitida(s) (${formatarMoeda(resumoMes.valorEmitidasBruto)}) e <strong>${resumoMes.qtdTomadas}</strong> serviço(s) tomado(s) (${formatarMoeda(resumoMes.valorTomadasBruto)}).</div>
      </div>
    `;
  } else {
    for (const grupo of porEmpresa.values()) {
      const subtotalEmitidas = grupo.emitidas.reduce((s, n) => s + (n.valorServicos || 0), 0);
      const subtotalTomadas = grupo.tomadas.reduce((s, n) => s + (n.valorServicos || 0), 0);

      let tabelaEmitidas = '';
      if (grupo.emitidas.length > 0) {
        tabelaEmitidas = `
          <div style="margin-top: 10px;">
            <div style="font-size: 12px; font-weight: 700; color: #600000; text-transform: uppercase; margin-bottom: 6px;">
              📤 Notas Emitidas pelo Cliente (${grupo.emitidas.length}) — Total: ${formatarMoeda(subtotalEmitidas)}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; border: 1px solid #e5e7eb;">
              <thead>
                <tr style="background: #f3f4f6; text-align: left; color: #374151;">
                  <th style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Nº</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Data</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb;">Tomador (Cliente)</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">Bruto</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">ISS</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">Líquido</th>
                </tr>
              </thead>
              <tbody>
                ${grupo.emitidas.map(n => `
                  <tr>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; font-family: monospace; font-weight: 700;">${n.numero}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6;">${formatarDataBr(n.dataEmissao)}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6;">
                      <strong>${n.tomadorRazaoSocial}</strong>
                      ${n.tomadorCnpjCpf ? `<div style="font-size: 11px; color: #6b7280;">${formatarCnpj(n.tomadorCnpjCpf)}</div>` : ''}
                    </td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatarMoeda(n.valorServicos)}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatarMoeda(n.valorIss)}${n.issRetido ? ' (Ret.)' : ''}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 700; color: #16a34a;">${formatarMoeda(n.valorLiquido)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      let tabelaTomadas = '';
      if (grupo.tomadas.length > 0) {
        tabelaTomadas = `
          <div style="margin-top: 12px;">
            <div style="font-size: 12px; font-weight: 700; color: #1e3a8a; text-transform: uppercase; margin-bottom: 6px;">
              📥 Serviços Tomados pelo Cliente (${grupo.tomadas.length}) — Total: ${formatarMoeda(subtotalTomadas)}
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px; background: #fff; border: 1px solid #e5e7eb;">
              <thead>
                <tr style="background: #eff6ff; text-align: left; color: #1e3a8a;">
                  <th style="padding: 6px 8px; border-bottom: 1px solid #dbeafe;">Nº</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #dbeafe;">Data</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #dbeafe;">Prestador (Fornecedor)</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #dbeafe; text-align: right;">Bruto</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #dbeafe; text-align: right;">ISS</th>
                  <th style="padding: 6px 8px; border-bottom: 1px solid #dbeafe; text-align: right;">Líquido</th>
                </tr>
              </thead>
              <tbody>
                ${grupo.tomadas.map(n => `
                  <tr>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; font-family: monospace; font-weight: 700;">${n.numero}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6;">${formatarDataBr(n.dataEmissao)}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6;">
                      <strong>${n.prestadorRazaoSocial}</strong>
                      ${n.prestadorCnpj ? `<div style="font-size: 11px; color: #6b7280;">${formatarCnpj(n.prestadorCnpj)}</div>` : ''}
                    </td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatarMoeda(n.valorServicos)}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; text-align: right;">${formatarMoeda(n.valorIss)}${n.issRetido ? ' (Ret.)' : ''}</td>
                    <td style="padding: 6px 8px; border-bottom: 1px solid #f3f4f6; text-align: right; font-weight: 700; color: #1e3a8a;">${formatarMoeda(n.valorLiquido)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      blocosEmpresasHtml += `
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; border-bottom: 2px solid #e5e7eb; padding-bottom: 8px;">
            <div style="font-size: 14px; font-weight: 800; color: #111827;">${grupo.razaoSocial}</div>
            <div style="font-size: 12px; color: #6b7280; font-family: monospace;">CNPJ ${formatarCnpj(grupo.cnpj)}</div>
          </div>
          ${tabelaEmitidas}
          ${tabelaTomadas}
        </div>
      `;
    }
  }

  const htmlEmail = `
    <div style="font-family: Arial, sans-serif; max-width: 780px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px; background: #ffffff;">
      <div style="border-bottom: 2px solid #600000; padding-bottom: 14px; margin-bottom: 20px;">
        <div style="font-size: 11px; font-weight: 700; color: #600000; text-transform: uppercase; letter-spacing: 0.08em;">
          Privilege Contabilidade • Setor Fiscal
        </div>
        <h2 style="margin: 4px 0 0; font-size: 22px; color: #111827;">
          Relatório Diário de NFS-e — Emitidas e Serviços Tomados
        </h2>
        <div style="font-size: 13px; color: #6b7280; margin-top: 4px;">
          Período apurado: <strong>${labelPeriodo}</strong> · Competência: <strong>${competencia}</strong>
          ${sincronizadasAdn > 0 ? ` · <strong>+${sincronizadasAdn} nova(s) sincronizada(s) do ADN</strong>` : ''}
        </div>
      </div>

      <table style="width: 100%; border-collapse: separate; border-spacing: 8px; margin-bottom: 18px;">
        <tr>
          <td style="width: 50%; background: #fdf2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 14px; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 700; color: #600000; text-transform: uppercase;">📤 Notas Emitidas no Período</div>
            <div style="font-size: 22px; font-weight: 800; color: #111827; margin-top: 4px;">${formatarMoeda(resumoPeriodo.valorEmitidasBruto)}</div>
            <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">
              <strong>${resumoPeriodo.qtdEmitidas}</strong> nota(s) · Líquido: <strong>${formatarMoeda(resumoPeriodo.valorEmitidasLiquido)}</strong><br/>
              ISS: ${formatarMoeda(resumoPeriodo.issEmitidas)} · Ret. Federais: ${formatarMoeda(resumoPeriodo.retencoesEmitidas)}
            </div>
          </td>
          <td style="width: 50%; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; vertical-align: top;">
            <div style="font-size: 11px; font-weight: 700; color: #1e3a8a; text-transform: uppercase;">📥 Serviços Tomados no Período</div>
            <div style="font-size: 22px; font-weight: 800; color: #1e3a8a; margin-top: 4px;">${formatarMoeda(resumoPeriodo.valorTomadasBruto)}</div>
            <div style="font-size: 12px; color: #4b5563; margin-top: 4px;">
              <strong>${resumoPeriodo.qtdTomadas}</strong> nota(s) · Líquido: <strong>${formatarMoeda(resumoPeriodo.valorTomadasLiquido)}</strong><br/>
              ISS: ${formatarMoeda(resumoPeriodo.issTomadas)} · Ret. Federais: ${formatarMoeda(resumoPeriodo.retencoesTomadas)}
            </div>
          </td>
        </tr>
        <tr>
          <td style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase;">Acumulado no Mês (${competencia}) — Emitidas</div>
            <div style="font-size: 16px; font-weight: 800; color: #111827; margin-top: 2px;">
              ${resumoMes.qtdEmitidas} nota(s) · ${formatarMoeda(resumoMes.valorEmitidasBruto)}
            </div>
          </td>
          <td style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase;">Acumulado no Mês (${competencia}) — Tomadas</div>
            <div style="font-size: 16px; font-weight: 800; color: #1e3a8a; margin-top: 2px;">
              ${resumoMes.qtdTomadas} nota(s) · ${formatarMoeda(resumoMes.valorTomadasBruto)}
            </div>
          </td>
        </tr>
      </table>

      ${zipBuffer ? `
        <div style="background: #f0fdf4; border: 1px solid #86efac; border-radius: 8px; padding: 10px 14px; margin-bottom: 18px; font-size: 12.5px; color: #166534;">
          📎 <strong>Pacote ZIP anexado a este e-mail:</strong> contém <strong>${arquivosNoZip}</strong> arquivo(s) (XMLs e DANFSe em PDF) separados por empresa em <code>notas_emitidas</code> e <code>servicos_tomados</code>.
        </div>
      ` : ''}

      ${blocosEmpresasHtml}

      <hr style="border: 0; border-top: 1px solid #e5e7eb; margin: 22px 0 12px;" />
      <p style="font-size: 11px; color: #9ca3af; text-align: center; margin: 0;">
        Envio automático do módulo fiscal NFS-e Nacional — Portal Privilege Contabilidade.
      </p>
    </div>
  `;

  // Envio SMTP
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const smtpFrom = process.env.SMTP_FROM || 'no-reply@privilegecontabilidade.com.br';

  if (!smtpHost || !smtpUser || !smtpPass) {
    return {
      sucesso: false,
      periodo: { dataInicio, dataFim, competencia },
      destinatarios,
      sincronizadasAdn,
      resumoPeriodo,
      resumoMes,
      anexoGerado: !!zipBuffer,
      arquivosNoZip,
      mensagem: 'Variáveis SMTP (SMTP_HOST, SMTP_USER, SMTP_PASS) não configuradas no servidor.',
    };
  }

  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });

  const nomeZip = `NFSe-Fiscal-${dataInicio}${dataFim !== dataInicio ? `-a-${dataFim}` : ''}.zip`;

  await transporter.sendMail({
    from: `"Privilege Setor Fiscal" <${smtpFrom}>`,
    to: destinatarios.join(', '),
    subject: `[Fiscal NFS-e] ${resumoPeriodo.qtdEmitidas} Emitida(s) e ${resumoPeriodo.qtdTomadas} Tomada(s) — ${labelPeriodo}`,
    html: htmlEmail,
    attachments: zipBuffer
      ? [{ filename: nomeZip, content: zipBuffer, contentType: 'application/zip' }]
      : [],
  });

  return {
    sucesso: true,
    periodo: { dataInicio, dataFim, competencia },
    destinatarios,
    sincronizadasAdn,
    resumoPeriodo,
    resumoMes,
    anexoGerado: !!zipBuffer,
    arquivosNoZip,
    mensagem: `Relatório fiscal enviado para ${destinatarios.join(', ')} (${resumoPeriodo.qtdEmitidas} emitida(s) e ${resumoPeriodo.qtdTomadas} tomada(s)).`,
  };
}

