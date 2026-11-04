// ============================================================
// NFS-e NACIONAL — relatório diário para o setor fiscal
// ============================================================
// Uma vez por dia: lê no ADN as notas novas de todas as empresas com
// procuração ativa e envia ao setor fiscal um e-mail com as notas emitidas
// pelos clientes e os serviços tomados por eles no período, com um ZIP
// (XML + DANFSe em PDF) separado por empresa.

import nodemailer from 'nodemailer';
import QRCode from 'qrcode';
import logoNfse from './dados/logo-nfse.json';
import db from '../prisma';
import { captureError } from '../sentry-helper';
import { apenasDigitos, hojeBrasilia } from './dps';
import { formatarCnpj } from './emissor';
import { gerarDanfsePdf, lerDadosDanfse, marcaDaguaDaNota, urlConsultaPublica } from './danfse';
import { criarZipBuffer, type ArquivoZip } from './zip';
import { sincronizarNotasAdn } from './sincronizar-adn';

export const EMAIL_SETOR_FISCAL_PADRAO = 'fiscal@privilegecontabilidade.com.br';

// Anexo grande demais é recusado pela maioria dos servidores de e-mail.
const LIMITE_BYTES_ANEXO = 15 * 1024 * 1024;
const PAUSA_ENTRE_EMPRESAS_MS = 1500;
const MAX_LEITURAS_POR_EMPRESA = 5;

export interface OpcoesRelatorioFiscal {
  dataInicio?: string;       // YYYY-MM-DD (padrão: ontem)
  dataFim?: string;          // YYYY-MM-DD (padrão: igual a dataInicio)
  empresaId?: string;        // Só esta empresa
  destinatarios?: string[];  // Padrão: NFSE_RELATORIO_FISCAL_EMAILS ou fiscal@
  sincronizarAdn?: boolean;  // Lê notas novas no ADN antes de montar o relatório
  anexarZip?: boolean;       // Padrão: true
}

export interface ResultadoRelatorioFiscal {
  sucesso: boolean;
  mensagem: string;
  periodo: { dataInicio: string; dataFim: string };
  destinatarios: string[];
  sincronizacao: { empresas: number; novas: number; falhas: number };
  qtdEmitidas: number;
  qtdTomadas: number;
  empresasComMovimento: number;
  arquivosNoZip: number;
  pdfsOmitidos: number;
}

// Evita duas execuções simultâneas (ex.: agendador + disparo manual).
let execucaoEmAndamento: Promise<ResultadoRelatorioFiscal> | null = null;

export function relatorioEmAndamento(): boolean {
  return execucaoEmAndamento !== null;
}

function diaAnterior(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

const moeda = (v: number) => (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const dataBr = (iso: string) => (iso ? iso.slice(0, 10).split('-').reverse().join('/') : '—');
const escapar = (t: string | null | undefined) =>
  String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function nomeArquivo(texto: string): string {
  return (texto || 'Empresa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40) || 'Empresa';
}

function destinatariosPadrao(): string[] {
  const env = (process.env.NFSE_RELATORIO_FISCAL_EMAILS || '').split(/[;,]+/).map(s => s.trim().toLowerCase()).filter(s => s.includes('@'));
  return env.length > 0 ? env : [EMAIL_SETOR_FISCAL_PADRAO];
}

/** Lê as notas novas no ADN de cada empresa com procuração ativa, continuando do último NSU. */
async function sincronizarTodas(empresaId?: string): Promise<{ empresas: number; novas: number; falhas: number }> {
  const configs = await db.nfseConfig.findMany({
    where: { usarProcuracao: true, procuracaoStatus: 'ativa', ...(empresaId ? { empresaId } : {}) },
    select: { empresaId: true },
  });

  let novas = 0;
  let falhas = 0;
  for (let i = 0; i < configs.length; i++) {
    try {
      for (let leitura = 0; leitura < MAX_LEITURAS_POR_EMPRESA; leitura++) {
        const r = await sincronizarNotasAdn(configs[i].empresaId, { meses: 1 });
        if (!r.ok) { falhas++; break; }
        novas += r.criadas;
        if (!r.temMais) break;
      }
    } catch (err) {
      falhas++;
      // Certificado do escritório inválido/vencido: todas as outras falhariam igual.
      const nome = err instanceof Error ? err.constructor.name : '';
      if (nome === 'CertificadoInvalidoError' || nome === 'CofreNaoConfiguradoError') break;
    }
    if (i < configs.length - 1) await new Promise(r => setTimeout(r, PAUSA_ENTRE_EMPRESAS_MS));
  }
  return { empresas: configs.length, novas, falhas };
}

async function executar(opcoes: OpcoesRelatorioFiscal): Promise<ResultadoRelatorioFiscal> {
  const dataInicio = (opcoes.dataInicio || diaAnterior(hojeBrasilia())).slice(0, 10);
  const dataFim = (opcoes.dataFim || dataInicio).slice(0, 10);
  const destinatarios = opcoes.destinatarios?.length ? opcoes.destinatarios : destinatariosPadrao();

  const sincronizacao = opcoes.sincronizarAdn
    ? await sincronizarTodas(opcoes.empresaId)
    : { empresas: 0, novas: 0, falhas: 0 };

  const notas = await db.nfsE.findMany({
    where: {
      ...(opcoes.empresaId ? { empresaId: opcoes.empresaId } : {}),
      chaveAcesso: { not: null },
      ambiente: 'producao',
      status: 'emitida',
      dataEmissao: { gte: dataInicio, lte: dataFim },
    },
    include: {
      empresa: { select: { razaoSocial: true, nomeFantasia: true, cnpj: true } },
      documento: { select: { nfseXml: true, eventoXml: true } },
    },
    orderBy: [{ dataEmissao: 'asc' }, { numero: 'asc' }],
  });

  type Grupo = { razaoSocial: string; cnpj: string; emitidas: typeof notas; tomadas: typeof notas };
  const grupos = new Map<string, Grupo>();
  for (const n of notas) {
    const cnpjEmp = apenasDigitos(n.empresa.cnpj);
    const prest = apenasDigitos(n.prestadorCnpj || '');
    const tomada = prest !== '' && prest !== cnpjEmp;
    const g = grupos.get(n.empresaId) || { razaoSocial: n.empresa.razaoSocial || n.empresa.nomeFantasia, cnpj: n.empresa.cnpj, emitidas: [], tomadas: [] };
    (tomada ? g.tomadas : g.emitidas).push(n);
    grupos.set(n.empresaId, g);
  }
  const ordenados = [...grupos.values()].sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));

  const emitidas = ordenados.flatMap(g => g.emitidas);
  const tomadas = ordenados.flatMap(g => g.tomadas);
  const soma = (l: typeof notas, campo: 'valorServicos' | 'valorIss' | 'valorLiquido') => l.reduce((s, n) => s + (n[campo] || 0), 0);

  // ZIP: XMLs primeiro (pequenos e essenciais); PDFs entram enquanto couber no limite.
  let zip: Buffer | null = null;
  let arquivosNoZip = 0;
  let pdfsOmitidos = 0;
  if (opcoes.anexarZip !== false && notas.length > 0) {
    const arquivos: ArquivoZip[] = [];
    let bytes = 0;
    const pendentesPdf: Array<{ nome: string; nota: (typeof notas)[number] }> = [];
    for (const g of ordenados) {
      const pasta = `${apenasDigitos(g.cnpj)}_${nomeArquivo(g.razaoSocial)}`;
      for (const [sub, lista] of [['notas_emitidas', g.emitidas], ['servicos_tomados', g.tomadas]] as const) {
        for (const n of lista) {
          if (!n.documento?.nfseXml) continue;
          const contraparte = nomeArquivo(sub === 'servicos_tomados' ? n.prestadorRazaoSocial : n.tomadorRazaoSocial);
          const base = `${pasta}/${sub}/NFSe_${(n.numero || 'SN').replace(/\D/g, '') || 'SN'}_${n.dataEmissao}_${contraparte}_${(n.chaveAcesso || n.id).slice(-8)}`;
          const xml = Buffer.from(n.documento.nfseXml, 'utf8');
          arquivos.push({ nome: `${base}.xml`, conteudo: xml });
          bytes += xml.length;
          pendentesPdf.push({ nome: `${base}.pdf`, nota: n });
        }
      }
    }
    const logoPng = Buffer.from(logoNfse.png, 'base64');
    for (const p of pendentesPdf) {
      if (bytes >= LIMITE_BYTES_ANEXO) { pdfsOmitidos++; continue; }
      try {
        const dados = lerDadosDanfse(p.nota.documento!.nfseXml);
        const qrPng = await QRCode.toBuffer(urlConsultaPublica(dados.chave), { errorCorrectionLevel: 'M', margin: 0, width: 300 });
        const pdf = gerarDanfsePdf(dados, { logoPng, qrPng, marcaDagua: marcaDaguaDaNota(p.nota.status, p.nota.documento!.eventoXml) });
        if (bytes + pdf.length > LIMITE_BYTES_ANEXO) { pdfsOmitidos++; continue; }
        arquivos.push({ nome: p.nome, conteudo: pdf });
        bytes += pdf.length;
      } catch {
        pdfsOmitidos++;
      }
    }
    if (arquivos.length > 0) {
      zip = criarZipBuffer(arquivos);
      arquivosNoZip = arquivos.length;
    }
  }

  const periodoLabel = dataInicio === dataFim ? dataBr(dataInicio) : `${dataBr(dataInicio)} a ${dataBr(dataFim)}`;

  const tabela = (lista: typeof notas, tipo: 'emitidas' | 'tomadas') => {
    const cor = tipo === 'emitidas' ? '#600000' : '#1e3a8a';
    const titulo = tipo === 'emitidas' ? 'Notas emitidas pelo cliente' : 'Serviços tomados pelo cliente';
    const colContraparte = tipo === 'emitidas' ? 'Tomador' : 'Prestador';
    return `
      <div style="margin-top:10px;">
        <div style="font-size:12px;font-weight:700;color:${cor};text-transform:uppercase;margin-bottom:6px;">
          ${titulo} (${lista.length}) — ${moeda(soma(lista, 'valorServicos'))}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;background:#fff;border:1px solid #e5e7eb;">
          <tr style="background:#f3f4f6;text-align:left;">
            <th style="padding:6px 8px;">Nº</th><th style="padding:6px 8px;">Data</th><th style="padding:6px 8px;">${colContraparte}</th>
            <th style="padding:6px 8px;text-align:right;">Bruto</th><th style="padding:6px 8px;text-align:right;">ISS</th><th style="padding:6px 8px;text-align:right;">Líquido</th>
          </tr>
          ${lista.map(n => {
            const nome = tipo === 'emitidas' ? n.tomadorRazaoSocial : n.prestadorRazaoSocial;
            const doc = tipo === 'emitidas' ? n.tomadorCnpjCpf : n.prestadorCnpj;
            return `<tr>
              <td style="padding:6px 8px;border-top:1px solid #f3f4f6;font-family:monospace;">${escapar(n.numero)}</td>
              <td style="padding:6px 8px;border-top:1px solid #f3f4f6;">${dataBr(n.dataEmissao)}</td>
              <td style="padding:6px 8px;border-top:1px solid #f3f4f6;">${escapar(nome)}${doc ? `<div style="font-size:11px;color:#6b7280;">${escapar(apenasDigitos(doc).length === 14 ? formatarCnpj(doc) : doc)}</div>` : ''}</td>
              <td style="padding:6px 8px;border-top:1px solid #f3f4f6;text-align:right;">${moeda(n.valorServicos)}</td>
              <td style="padding:6px 8px;border-top:1px solid #f3f4f6;text-align:right;">${moeda(n.valorIss)}${n.issRetido ? ' (ret.)' : ''}</td>
              <td style="padding:6px 8px;border-top:1px solid #f3f4f6;text-align:right;font-weight:700;">${moeda(n.valorLiquido)}</td>
            </tr>`;
          }).join('')}
        </table>
      </div>`;
  };

  const blocos = ordenados.length === 0
    ? `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:24px;text-align:center;color:#6b7280;font-size:13.5px;">
         Nenhuma nota emitida ou serviço tomado em <strong>${periodoLabel}</strong>.
       </div>`
    : ordenados.map(g => `
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:16px;margin-bottom:14px;">
          <div style="border-bottom:2px solid #e5e7eb;padding-bottom:6px;">
            <strong style="font-size:14px;">${escapar(g.razaoSocial)}</strong>
            <span style="font-size:12px;color:#6b7280;font-family:monospace;"> · CNPJ ${formatarCnpj(g.cnpj)}</span>
          </div>
          ${g.emitidas.length ? tabela(g.emitidas, 'emitidas') : ''}
          ${g.tomadas.length ? tabela(g.tomadas, 'tomadas') : ''}
        </div>`).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:780px;margin:0 auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;">
      <div style="border-bottom:2px solid #600000;padding-bottom:12px;margin-bottom:18px;">
        <div style="font-size:11px;font-weight:700;color:#600000;text-transform:uppercase;letter-spacing:.08em;">Privilege Contabilidade • Setor Fiscal</div>
        <h2 style="margin:4px 0 0;font-size:21px;color:#111827;">NFS-e emitidas e serviços tomados — ${periodoLabel}</h2>
        ${opcoes.sincronizarAdn ? `<div style="font-size:12px;color:#6b7280;margin-top:4px;">Leitura no ADN: ${sincronizacao.empresas} empresa(s), ${sincronizacao.novas} documento(s) novo(s)${sincronizacao.falhas ? `, <span style="color:#b91c1c;">${sincronizacao.falhas} falha(s) de leitura</span>` : ''}.</div>` : ''}
      </div>
      <table style="width:100%;border-collapse:separate;border-spacing:8px;margin-bottom:14px;">
        <tr>
          <td style="width:50%;background:#fdf2f2;border:1px solid #fecaca;border-radius:10px;padding:14px;">
            <div style="font-size:11px;font-weight:700;color:#600000;text-transform:uppercase;">Emitidas pelos clientes</div>
            <div style="font-size:22px;font-weight:800;margin-top:4px;">${moeda(soma(emitidas, 'valorServicos'))}</div>
            <div style="font-size:12px;color:#4b5563;">${emitidas.length} nota(s) · ISS ${moeda(soma(emitidas, 'valorIss'))}</div>
          </td>
          <td style="width:50%;background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;">
            <div style="font-size:11px;font-weight:700;color:#1e3a8a;text-transform:uppercase;">Tomadas pelos clientes</div>
            <div style="font-size:22px;font-weight:800;color:#1e3a8a;margin-top:4px;">${moeda(soma(tomadas, 'valorServicos'))}</div>
            <div style="font-size:12px;color:#4b5563;">${tomadas.length} nota(s) · ISS ${moeda(soma(tomadas, 'valorIss'))}</div>
          </td>
        </tr>
      </table>
      ${zip ? `<div style="background:#f0fdf4;border:1px solid #86efac;border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12.5px;color:#166534;">
        Anexo ZIP com ${arquivosNoZip} arquivo(s), separados por empresa em <code>notas_emitidas</code> e <code>servicos_tomados</code>.
        ${pdfsOmitidos ? `<br/><strong>${pdfsOmitidos} PDF(s) ficaram de fora pelo limite de tamanho do e-mail</strong> — todos os XMLs estão no anexo e os PDFs podem ser baixados na tela de NFS-e (Exportar Mês).` : ''}
      </div>` : ''}
      ${blocos}
      <p style="font-size:11px;color:#9ca3af;text-align:center;margin-top:20px;">Envio automático do módulo NFS-e Nacional — Portal Privilege.</p>
    </div>`;

  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  const base = {
    periodo: { dataInicio, dataFim },
    destinatarios,
    sincronizacao,
    qtdEmitidas: emitidas.length,
    qtdTomadas: tomadas.length,
    empresasComMovimento: ordenados.length,
    arquivosNoZip,
    pdfsOmitidos,
  };
  if (!smtpHost || !smtpUser || !smtpPass) {
    return { ...base, sucesso: false, mensagem: 'SMTP não configurado no servidor (SMTP_HOST, SMTP_USER, SMTP_PASS).' };
  }

  const smtpPort = Number(process.env.SMTP_PORT) || 587;
  const transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpPort === 465,
    auth: { user: smtpUser, pass: smtpPass },
    tls: { rejectUnauthorized: false },
  });
  const sufixo = dataInicio === dataFim ? dataInicio : `${dataInicio}_a_${dataFim}`;
  await transporter.sendMail({
    from: `"Privilege Setor Fiscal" <${process.env.SMTP_FROM || 'no-reply@privilegecontabilidade.com.br'}>`,
    to: destinatarios.join(', '),
    subject: `[NFS-e] ${emitidas.length} emitida(s) e ${tomadas.length} tomada(s) — ${periodoLabel}`,
    html,
    attachments: zip ? [{ filename: `NFSe_${sufixo}.zip`, content: zip, contentType: 'application/zip' }] : [],
  });

  return { ...base, sucesso: true, mensagem: `Relatório enviado para ${destinatarios.join(', ')}.` };
}

/** Executa o relatório; se já houver um em andamento, devolve o mesmo resultado. */
export function enviarRelatorioFiscalDiario(opcoes: OpcoesRelatorioFiscal = {}): Promise<ResultadoRelatorioFiscal> {
  if (execucaoEmAndamento) return execucaoEmAndamento;
  execucaoEmAndamento = executar(opcoes)
    .catch(err => {
      captureError(err);
      throw err;
    })
    .finally(() => { execucaoEmAndamento = null; });
  return execucaoEmAndamento;
}
