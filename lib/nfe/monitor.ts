// ============================================================
// NF-e DESTINADAS — monitor por CNPJ (consulta, persistência e regras da SEFAZ)
// ============================================================
// Regras da NT 2014.002 que este módulo respeita:
//  - cStat 137 (nenhum documento novo): só consultar de novo depois de 1 hora;
//  - cStat 656 (consumo indevido): bloqueio de 1 hora, insistir só prolonga;
//  - o último NSU é gravado a cada página: uma queda no meio retoma dali.
// A espera nunca é ignorada, nem pelo botão "Consultar agora".

import db from '../prisma';
import { apenasDigitos } from '../nfse/dps';
import { CertificadoInvalidoError, certificadoPertenceAoCnpj } from '../nfse/assinatura';
import { CofreNaoConfiguradoError } from '../nfse/cofre';
import { abrirCredencial } from '../nfse/servidor';
import {
  EVENTO_CANCELAMENTO, MANIFESTACAO_POR_EVENTO, SefazIndisponivelError, enviarDistribuicao, interpretarDocumento,
  lerRespostaDistribuicao, montarEnvelopeDistribuicao, type AmbienteNfe, type DadosNota,
} from './distribuicao';
import { consultarCteEmpresa } from '../cte/monitor';
import { registrarLogFiscal } from './logger';

const MINUTO = 60_000;
const ESPERA_APOS_137_MS = 65 * MINUTO;
const ESPERA_APOS_656_MS = 65 * MINUTO;
const ESPERA_APOS_REJEICAO_MS = 6 * 60 * MINUTO;
const ESPERA_APOS_FALHA_MS = 30 * MINUTO;
const MAX_PAGINAS_POR_CONSULTA = 12;
// Na janela noturna a SEFAZ tolera lotes grandes: o teto sobe para buscar toda a carteira de notas
// de uma vez. O tempo da rodada (limite) continua sendo o limitador real, então não há risco de 656.
const MAX_PAGINAS_NOTURNO = 240;
const RESERVA_CONSULTA_MS = 10 * MINUTO;
const TIMEOUT_SEFAZ_MS = 40_000;
// Quanto uma chamada já iniciada ainda pode durar depois do limite da rodada.
const FOLGA_APOS_LIMITE_MS = 12_000;

const AMBIENTE: AmbienteNfe = 'producao';

/**
 * Retorna se o momento atual está dentro da janela noturna (21h às 07h de Brasília / UTC-3).
 * A SEFAZ possui tráfego consideravelmente menor nessa faixa, ideal para lotes volumosos.
 */
export function ehHorarioNoturnoBrasilia(): boolean {
  const agoraBrasilia = new Date(Date.now() - 3 * 3600 * 1000);
  const hora = agoraBrasilia.getUTCHours();
  return hora >= 21 || hora < 7;
}

export interface ResultadoConsultaNfe {
  empresaId: string;
  executada: boolean;
  cStat: string | null;
  mensagem: string;
  paginas: number;
  novas: number;
  atualizadas: number;
  ultNsu: string;
  maxNsu: string;
  temMais: boolean;
  proximaConsultaEm: Date | null;
}

const depois = (ms: number) => new Date(Date.now() + ms);

function textoEspera(ate: Date): string {
  const minutos = Math.max(1, Math.ceil((ate.getTime() - Date.now()) / MINUTO));
  return minutos >= 60 ? `${Math.floor(minutos / 60)}h${String(minutos % 60).padStart(2, '0')}` : `${minutos} min`;
}

/** UF do autor, a partir do código IBGE do município (os dois primeiros dígitos). */
const ufDoMunicipio = (codigoMunicipio: string | null | undefined) => (/^\d{7}$/.test(codigoMunicipio || '') ? String(codigoMunicipio).slice(0, 2) : undefined);

async function gravarNota(empresaId: string, nsu: string, nota: DadosNota, xml: string | null): Promise<'nova' | 'atualizada'> {
  const chave = { empresaId_chaveAcesso: { empresaId, chaveAcesso: nota.chave } };
  const existente = await db.nfeDestinada.findUnique({ where: chave, select: { id: true, possuiXml: true, situacao: true } });

  const dados = {
    numero: nota.numero,
    serie: nota.serie,
    emitenteCnpj: apenasDigitos(nota.emitenteCnpj),
    emitenteNome: nota.emitenteNome,
    emitenteIe: nota.emitenteIe,
    dataEmissao: nota.dataEmissao,
    tipoOperacao: nota.tipoOperacao,
    valorNf: nota.valorNf,
    protocolo: nota.protocolo,
  };

  if (!existente) {
    await db.nfeDestinada.create({
      data: { empresaId, chaveAcesso: nota.chave, nsu, situacao: nota.situacao, ...dados, ...(xml ? { possuiXml: true, xml } : {}) },
    });
    return 'nova';
  }

  // O resumo nunca rebaixa uma nota que já tem o XML completo; uma nota cancelada continua cancelada.
  await db.nfeDestinada.update({
    where: chave,
    data: {
      ...(xml || !existente.possuiXml ? dados : {}),
      ...(existente.situacao === 'cancelada' ? {} : { situacao: nota.situacao }),
      ...(xml ? { possuiXml: true, xml } : {}),
    },
  });
  return 'atualizada';
}

async function gravarEvento(empresaId: string, chave: string, tpEvento: string) {
  if (tpEvento === EVENTO_CANCELAMENTO) {
    await db.nfeDestinada.updateMany({ where: { empresaId, chaveAcesso: chave }, data: { situacao: 'cancelada' } });
    return;
  }
  const manifestacao = MANIFESTACAO_POR_EVENTO[tpEvento];
  if (manifestacao) await db.nfeDestinada.updateMany({ where: { empresaId, chaveAcesso: chave }, data: { manifestacao } });
}

async function registrar(empresaId: string, dados: { cStat?: string | null; mensagem: string; proxima: Date | null; certOrigem?: string; ultNsu?: string; maxNsu?: string; adicionados?: number }) {
  // updateMany (não update) para não desserializar a linha e não quebrar em colunas de CT-e nulas.
  await db.nfeDistribuicao.updateMany({
    where: { empresaId },
    data: {
      ultimaConsultaEm: new Date(),
      proximaConsultaEm: dados.proxima,
      ultimoStatus: dados.cStat ?? null,
      ultimaMensagem: dados.mensagem.slice(0, 500),
      ...(dados.certOrigem ? { certOrigem: dados.certOrigem } : {}),
      ...(dados.ultNsu ? { ultNsu: dados.ultNsu } : {}),
      ...(dados.maxNsu ? { maxNsu: dados.maxNsu } : {}),
      ...(dados.adicionados ? { totalDocumentos: { increment: dados.adicionados } } : {}),
    },
  });
}

/**
 * Consulta a SEFAZ para um CNPJ e grava o que chegou. Não lança por problema de uma empresa: devolve o motivo.
 * `limite` (hora, em ms): a partir dela não pede novas páginas, para terminar dentro do tempo da função.
 */
export async function consultarNfeDestinadas(empresaId: string, limite?: number): Promise<ResultadoConsultaNfe> {
  const base: ResultadoConsultaNfe = {
    empresaId, executada: false, cStat: null, mensagem: '', paginas: 0, novas: 0, atualizadas: 0, ultNsu: '0', maxNsu: '0', temMais: false, proximaConsultaEm: null,
  };

  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { cnpj: true, nfseConfig: true } });
  if (!empresa) return { ...base, mensagem: 'Empresa não encontrada.' };
  const cnpj = apenasDigitos(empresa.cnpj);
  if (cnpj.length !== 14) return { ...base, mensagem: 'A empresa não tem CNPJ válido.' };
  if (!empresa.nfseConfig) return { ...base, mensagem: 'A empresa ainda não tem certificado configurado (abra a configuração do Emissor Nacional).' };

  // Lê só os campos da NF-e: evita desserializar as colunas de CT-e (ultNsuCte/maxNsuCte),
  // que em bancos ainda não sincronizados podem estar nulas e derrubariam toda a consulta de NF-e.
  const estado = await db.nfeDistribuicao.upsert({
    where: { empresaId },
    update: {},
    create: { empresaId },
    select: { ultNsu: true, maxNsu: true, proximaConsultaEm: true, ativo: true },
  });
  base.ultNsu = estado.ultNsu;
  base.maxNsu = estado.maxNsu;
  base.proximaConsultaEm = estado.proximaConsultaEm;
  if (!estado.ativo) return { ...base, mensagem: 'Monitoramento desativado para esta empresa.' };

  if (estado.proximaConsultaEm && estado.proximaConsultaEm.getTime() > Date.now()) {
    return { ...base, mensagem: `A SEFAZ só permite nova consulta deste CNPJ daqui a ${textoEspera(estado.proximaConsultaEm)}.` };
  }

  // Reserva no banco: em ambiente serverless cada chamada pode estar em uma instância, e duas
  // consultas simultâneas do mesmo CNPJ quebram a sequência de NSU (656). Se a função morrer, libera sozinha.
  const reserva = await db.nfeDistribuicao.updateMany({
    where: { empresaId, OR: [{ proximaConsultaEm: null }, { proximaConsultaEm: { lte: new Date() } }] },
    data: { proximaConsultaEm: depois(RESERVA_CONSULTA_MS) },
  });
  if (reserva.count === 0) return { ...base, mensagem: 'Já há uma consulta deste CNPJ em andamento.' };

  const certOrigem = empresa.nfseConfig.usarProcuracao ? 'escritorio' : 'propria';
  let aberta;
  try {
    aberta = await abrirCredencial(empresa.nfseConfig);
  } catch (erro: any) {
    if (erro instanceof CertificadoInvalidoError || erro instanceof CofreNaoConfiguradoError) {
      const proxima = depois(ESPERA_APOS_REJEICAO_MS);
      await registrar(empresaId, { mensagem: erro.message, proxima, certOrigem });
      await registrarLogFiscal({ empresaId, tipo: 'nfe', status: 'erro', mensagem: erro.message });
      return { ...base, mensagem: erro.message, proximaConsultaEm: proxima };
    }
    throw erro;
  }
  if ('erro' in aberta) {
    const proxima = depois(ESPERA_APOS_REJEICAO_MS);
    await registrar(empresaId, { mensagem: aberta.erro, proxima, certOrigem });
    await registrarLogFiscal({ empresaId, tipo: 'nfe', status: 'erro', mensagem: aberta.erro });
    return { ...base, mensagem: aberta.erro, proximaConsultaEm: proxima };
  }
  if (certOrigem === 'propria' && !certificadoPertenceAoCnpj(aberta.credencial, cnpj)) {
    const mensagem = 'O certificado A1 da empresa é de outro CNPJ: a SEFAZ só entrega as notas ao CNPJ do certificado.';
    const proxima = depois(ESPERA_APOS_REJEICAO_MS);
    await registrar(empresaId, { mensagem, proxima, certOrigem });
    await registrarLogFiscal({ empresaId, tipo: 'nfe', status: 'erro', mensagem });
    return { ...base, mensagem, proximaConsultaEm: proxima };
  }

  let ultNsu = estado.ultNsu;
  let maxNsu = estado.maxNsu;
  let adicionados = 0;
  const resultado: ResultadoConsultaNfe = { ...base, executada: true };

  // No modo noturno busca TODAS as notas (sem o teto de 12 páginas do dia); o tempo da rodada ainda limita.
  const maxPaginas = ehHorarioNoturnoBrasilia() ? MAX_PAGINAS_NOTURNO : MAX_PAGINAS_POR_CONSULTA;

  for (let pagina = 0; pagina < maxPaginas; pagina++) {
    // Sem tempo para outra página: sai pelo caminho de leitura parcial, que retoma do NSU gravado.
    if (limite && pagina > 0 && Date.now() >= limite) break;
    let resposta;
    try {
      const envelope = montarEnvelopeDistribuicao({ ambiente: AMBIENTE, cnpj, ultNsu, cUfAutor: ufDoMunicipio(empresa.nfseConfig.codigoMunicipio) });
      const timeout = limite ? Math.max(1000, Math.min(TIMEOUT_SEFAZ_MS, limite + FOLGA_APOS_LIMITE_MS - Date.now())) : TIMEOUT_SEFAZ_MS;
      const http = await enviarDistribuicao(aberta.credencial, AMBIENTE, envelope, timeout);
      resposta = lerRespostaDistribuicao(http.corpo);
    } catch (erro: any) {
      if (!(erro instanceof SefazIndisponivelError)) throw erro;
      const proxima = depois(ESPERA_APOS_FALHA_MS);
      await registrar(empresaId, { mensagem: erro.message, proxima, certOrigem, ultNsu, maxNsu, adicionados });
      await registrarLogFiscal({ empresaId, tipo: 'nfe', status: 'erro', mensagem: erro.message });
      return { ...resultado, mensagem: erro.message, ultNsu, maxNsu, proximaConsultaEm: proxima };
    }
    resultado.paginas++;
    resultado.cStat = resposta.cStat;

    if (resposta.cStat === '138') {
      for (const doc of resposta.documentos) {
        const lido = interpretarDocumento(doc.schema, doc.xml);
        if (!lido) continue;
        if (lido.tipo === 'evento') {
          await gravarEvento(empresaId, lido.chave, lido.tpEvento);
        } else {
          const r = await gravarNota(empresaId, doc.nsu, lido.nota, lido.tipo === 'completa' ? lido.xml : null);
          if (r === 'nova') { resultado.novas++; adicionados++; } else resultado.atualizadas++;
        }
      }
      const avancou = BigInt(resposta.ultNsu) > BigInt(ultNsu);
      ultNsu = resposta.ultNsu;
      maxNsu = resposta.maxNsu;
      // Grava a cada página: se cair no meio, a próxima consulta continua daqui.
      // updateMany (não update) para não desserializar a linha e evitar quebra em colunas de CT-e nulas.
      await db.nfeDistribuicao.updateMany({ where: { empresaId }, data: { ultNsu, maxNsu } });

      if (!avancou || BigInt(ultNsu) >= BigInt(maxNsu)) {
        const proxima = depois(ESPERA_APOS_137_MS);
        const mensagem = `Em dia: ${resultado.novas} nota(s) nova(s) nesta consulta.`;
        await registrar(empresaId, { cStat: '138', mensagem, proxima, certOrigem, ultNsu, maxNsu, adicionados });
        if (resultado.novas > 0) {
          await registrarLogFiscal({
            empresaId,
            tipo: 'nfe',
            status: 'sucesso',
            cStat: '138',
            mensagem: `SEFAZ NF-e: ${resultado.novas} nova(s) mercadoria(s) sincronizada(s).`,
            novas: resultado.novas,
            atualizadas: resultado.atualizadas,
          });
        }
        return { ...resultado, mensagem, ultNsu, maxNsu, proximaConsultaEm: proxima };
      }
      continue;
    }

    if (resposta.cStat === '137') {
      const proxima = depois(ESPERA_APOS_137_MS);
      const mensagem = resultado.novas > 0 ? `Em dia: ${resultado.novas} nota(s) nova(s) nesta consulta.` : 'Nenhuma nota nova destinada a este CNPJ.';
      await registrar(empresaId, { cStat: '137', mensagem, proxima, certOrigem, ultNsu: resposta.ultNsu, maxNsu: resposta.maxNsu, adicionados });
      if (resultado.novas > 0) {
        await registrarLogFiscal({
          empresaId,
          tipo: 'nfe',
          status: 'sucesso',
          cStat: '137',
          mensagem: `SEFAZ NF-e: ${resultado.novas} nova(s) mercadoria(s) sincronizada(s).`,
          novas: resultado.novas,
          atualizadas: resultado.atualizadas,
        });
      }
      return { ...resultado, mensagem, ultNsu: resposta.ultNsu, maxNsu: resposta.maxNsu, proximaConsultaEm: proxima };
    }

    // 656 (consumo indevido) e qualquer rejeição (ex.: certificado sem poderes sobre o CNPJ).
    const bloqueio = resposta.cStat === '656';
    const proxima = depois(bloqueio ? ESPERA_APOS_656_MS : ESPERA_APOS_REJEICAO_MS);
    const mensagem = `SEFAZ [${resposta.cStat}] ${resposta.xMotivo}`.trim();
    await registrar(empresaId, { cStat: resposta.cStat, mensagem, proxima, certOrigem, ultNsu, maxNsu, adicionados });
    await registrarLogFiscal({
      empresaId,
      tipo: 'nfe',
      status: 'alerta',
      cStat: resposta.cStat,
      mensagem,
    });
    return { ...resultado, mensagem, ultNsu, maxNsu, proximaConsultaEm: proxima };
  }

  // Limite de páginas desta chamada: sem espera, a próxima consulta continua do NSU gravado.
  const mensagem = `Leitura parcial: ${resultado.novas} nota(s) nova(s) até agora. Consulte de novo para continuar.`;
  await registrar(empresaId, { cStat: '138', mensagem, proxima: null, certOrigem, ultNsu, maxNsu, adicionados });
  return { ...resultado, mensagem, ultNsu, maxNsu, temMais: true, proximaConsultaEm: null };
}

// ---------- Execução em lote (agendador) ----------

let execucaoEmLote: Promise<ResumoLote> | null = null;

export interface ResumoLote {
  empresas: number;
  consultadas: number;
  puladas: number;
  novas: number;
  falhas: number;
  /** Empresas da fila que ficaram para a próxima rodada por falta de tempo. */
  restantes: number;
}

export const loteNfeEmAndamento = () => execucaoEmLote !== null;

const PAUSA_ENTRE_EMPRESAS_MS = 500;

async function executarLote(maxEmpresas: number, tempoMs?: number): Promise<ResumoLote> {
  const agora = new Date();
  const limite = tempoMs ? agora.getTime() + tempoMs : undefined;
  const noturno = ehHorarioNoturnoBrasilia();
  // Só empresas com o monitoramento ligado (linha em NfeDistribuicao criada por quem ativou)
  // e fora do período de espera da SEFAZ. Empresas marcadas como 'apenasNoturno' só rodam entre 22h e 05h.
  const pendentes = await db.nfeDistribuicao.findMany({
    where: {
      ativo: true,
      ...(noturno ? {} : { apenasNoturno: false }),
      OR: [{ proximaConsultaEm: null }, { proximaConsultaEm: { lte: agora } }],
    },
    orderBy: { ultimaConsultaEm: { sort: 'asc', nulls: 'first' } },
    select: { empresaId: true },
    take: maxEmpresas,
  });
  const fila = pendentes.map(p => p.empresaId);

  const resumo: ResumoLote = { empresas: fila.length, consultadas: 0, puladas: 0, novas: 0, falhas: 0, restantes: 0 };
  for (let i = 0; i < fila.length; i++) {
    if (limite && Date.now() >= limite) {
      resumo.restantes = fila.length - i;
      break;
    }
    try {
      const [rNfe, rCte] = await Promise.allSettled([
        consultarNfeDestinadas(fila[i], limite),
        consultarCteEmpresa(fila[i], limite),
      ]);

      if (rNfe.status === 'fulfilled') {
        const r = rNfe.value;
        if (r.executada) { resumo.consultadas++; resumo.novas += r.novas; } else resumo.puladas++;
        if (r.executada && r.cStat && !['137', '138'].includes(r.cStat)) resumo.falhas++;
      } else {
        resumo.falhas++;
      }

      if (rCte.status === 'fulfilled' && rCte.value.executada) {
        resumo.novas += rCte.value.novas;
      }
    } catch {
      resumo.falhas++;
    }
    if (i < fila.length - 1) await new Promise(r => setTimeout(r, PAUSA_ENTRE_EMPRESAS_MS));
  }

  if (resumo.consultadas > 0 || resumo.falhas > 0) {
    await registrarLogFiscal({
      tipo: 'lote',
      status: resumo.falhas > 0 && resumo.consultadas === 0 ? 'erro' : (resumo.falhas > 0 ? 'alerta' : 'sucesso'),
      mensagem: `Monitor DF-e: ${resumo.consultadas} empresa(s) consultadas (${resumo.novas} novos documentos localizados, ${resumo.falhas} falha(s)).`,
      novas: resumo.novas,
    });
  }

  return resumo;
}

/**
 * Uma execução por instância; chamadas durante uma execução recebem a mesma.
 * Com `tempoMs`, para de começar novas empresas ao fim desse tempo e a fila continua na próxima rodada.
 */
export function consultarLoteNfeDestinadas(maxEmpresas = 150, tempoMs?: number): Promise<ResumoLote> {
  if (execucaoEmLote) return execucaoEmLote;
  execucaoEmLote = executarLote(maxEmpresas, tempoMs).finally(() => { execucaoEmLote = null; });
  return execucaoEmLote;
}
