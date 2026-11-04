// ============================================================
// NF-e DESTINADAS — Manifestação do Destinatário (Ciência da Operação)
// ============================================================
// Registra o evento 210210 no Ambiente Nacional, em nome da empresa. Só parte de
// uma ação de um usuário: nunca é enviado pelo monitor automático.
// A Ciência não confirma nem recusa a operação. Depois dela, a SEFAZ passa a
// entregar o XML completo nas consultas seguintes por NSU.

import db from '../prisma';
import { apenasDigitos } from '../nfse/dps';
import { CertificadoInvalidoError, certificadoPertenceAoCnpj, gerarAssinatura, type CredencialA1 } from '../nfse/assinatura';
import { CofreNaoConfiguradoError } from '../nfse/cofre';
import { abrirCredencial } from '../nfse/servidor';
import { SefazIndisponivelError, enviarSoap, type AmbienteNfe } from './distribuicao';

const ENDPOINTS: Record<AmbienteNfe, string> = {
  producao: 'https://www.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
  homologacao: 'https://hom1.nfe.fazenda.gov.br/NFeRecepcaoEvento4/NFeRecepcaoEvento4.asmx',
};

const NS_NFE = 'http://www.portalfiscal.inf.br/nfe';
const NS_WSDL = 'http://www.portalfiscal.inf.br/nfe/wsdl/NFeRecepcaoEvento4';
const AMBIENTE: AmbienteNfe = 'producao';

export const EVENTO_CIENCIA = '210210';
const COD_ORGAO_AMBIENTE_NACIONAL = '91';

/** A SEFAZ aceita no máximo 20 eventos por lote. */
export const EVENTOS_POR_LOTE = 20;
/** Teto de uma ação do usuário, para caber no tempo de uma requisição. */
export const MAX_NOTAS_POR_ENVIO = 100;
const TEMPO_MAXIMO_MS = 40_000;

// 135: registrado e vinculado à NF-e. 136: registrado sem vínculo. 573: já estava registrado.
const STATUS_REGISTRADO = ['135', '136', '573'];

/** Data do evento em horário de Brasília. Fica um minuto atrás: a SEFAZ rejeita data à frente do relógio dela. */
export function dataEvento(agora = new Date()): string {
  const brasilia = new Date(agora.getTime() - 60_000 - 3 * 3600 * 1000);
  return `${brasilia.toISOString().slice(0, 19)}-03:00`;
}

export function idEventoCiencia(chave: string): string {
  return `ID${EVENTO_CIENCIA}${chave}01`;
}

/** Evento assinado. Sem espaços nem elementos vazios: o texto já está em forma canônica. */
export function montarEventoCiencia(p: { chave: string; cnpj: string; ambiente: AmbienteNfe; dhEvento: string; credencial: CredencialA1 }): string {
  const id = idEventoCiencia(p.chave);
  const corpo =
    `<cOrgao>${COD_ORGAO_AMBIENTE_NACIONAL}</cOrgao>` +
    `<tpAmb>${p.ambiente === 'producao' ? 1 : 2}</tpAmb>` +
    `<CNPJ>${apenasDigitos(p.cnpj)}</CNPJ>` +
    `<chNFe>${p.chave}</chNFe>` +
    `<dhEvento>${p.dhEvento}</dhEvento>` +
    `<tpEvento>${EVENTO_CIENCIA}</tpEvento>` +
    '<nSeqEvento>1</nSeqEvento>' +
    '<verEvento>1.00</verEvento>' +
    '<detEvento versao="1.00"><descEvento>Ciencia da Operacao</descEvento></detEvento>';

  // Na C14N inclusiva o nó assinado carrega o namespace herdado de envEvento.
  const canonico = `<infEvento xmlns="${NS_NFE}" Id="${id}">${corpo}</infEvento>`;
  const assinatura = gerarAssinatura(canonico, id, p.credencial);
  return `<evento versao="1.00"><infEvento Id="${id}">${corpo}</infEvento>${assinatura}</evento>`;
}

export function montarEnvelopeEventos(idLote: string, eventos: string[]): string {
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<soap12:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap12="http://www.w3.org/2003/05/soap-envelope">'
    + `<soap12:Body><nfeDadosMsg xmlns="${NS_WSDL}">`
    + `<envEvento xmlns="${NS_NFE}" versao="1.00"><idLote>${idLote}</idLote>${eventos.join('')}</envEvento>`
    + '</nfeDadosMsg></soap12:Body></soap12:Envelope>';
}

const tag = (xml: string, nome: string): string | null => {
  const m = xml.match(new RegExp(`<(?:\\w+:)?${nome}(?:\\s[^>]*)?>([^<]*)</(?:\\w+:)?${nome}>`));
  return m ? m[1].trim() : null;
};

export interface RetornoEvento {
  chave: string;
  cStat: string;
  xMotivo: string;
  protocolo: string | null;
}

export interface RespostaEventos {
  /** 128 = lote processado; qualquer outro valor recusou o lote inteiro. */
  cStat: string;
  xMotivo: string;
  eventos: RetornoEvento[];
}

export function lerRespostaEventos(soap: string): RespostaEventos {
  const ret = soap.match(/<retEnvEvento[\s\S]*?<\/retEnvEvento>/)?.[0];
  if (!ret) {
    const falha = tag(soap, 'Text') || tag(soap, 'faultstring') || tag(soap, 'Reason');
    throw new SefazIndisponivelError(`Resposta inesperada da SEFAZ${falha ? `: ${falha}` : '.'}`);
  }
  // Os dados do lote vêm antes do primeiro retEvento; depois vêm os de cada evento.
  const cabecalho = ret.split('<retEvento')[0];
  const eventos: RetornoEvento[] = [];
  for (const m of ret.matchAll(/<retEvento[\s\S]*?<\/retEvento>/g)) {
    const chave = tag(m[0], 'chNFe');
    if (!chave) continue;
    eventos.push({ chave, cStat: tag(m[0], 'cStat') || '', xMotivo: tag(m[0], 'xMotivo') || '', protocolo: tag(m[0], 'nProt') });
  }
  return { cStat: tag(cabecalho, 'cStat') || '', xMotivo: tag(cabecalho, 'xMotivo') || '', eventos };
}

export interface NotaRejeitada {
  chave: string;
  numero: string | null;
  cStat: string | null;
  motivo: string;
}

export interface ResultadoManifestacao {
  /** Quando preenchido, nada foi enviado (certificado, empresa). */
  erro: string | null;
  registradas: number;
  rejeitadas: NotaRejeitada[];
  /** Pedidas mas já com XML, já manifestadas, canceladas, denegadas ou de outra empresa. */
  ignoradas: number;
  /** Ficaram de fora por falha de comunicação ou falta de tempo: podem ser reenviadas. */
  naoEnviadas: number;
}

export async function registrarCiencia(empresaId: string, ids: string[], autor: { userId: string; email: string }): Promise<ResultadoManifestacao> {
  const resultado: ResultadoManifestacao = { erro: null, registradas: 0, rejeitadas: [], ignoradas: 0, naoEnviadas: 0 };

  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { cnpj: true, nfseConfig: true } });
  if (!empresa) return { ...resultado, erro: 'Empresa não encontrada.' };
  const cnpj = apenasDigitos(empresa.cnpj);
  if (cnpj.length !== 14) return { ...resultado, erro: 'A empresa não tem CNPJ válido.' };
  if (!empresa.nfseConfig) return { ...resultado, erro: 'A empresa ainda não tem certificado configurado.' };

  const unicos = [...new Set(ids)];
  const notas = await db.nfeDestinada.findMany({
    where: { id: { in: unicos }, empresaId, possuiXml: false, situacao: 'autorizada', manifestacao: null },
    select: { id: true, chaveAcesso: true, numero: true },
  });
  resultado.ignoradas = unicos.length - notas.length;
  if (notas.length === 0) return resultado;

  let credencial: CredencialA1;
  try {
    const aberta = await abrirCredencial(empresa.nfseConfig);
    if ('erro' in aberta) return { ...resultado, erro: aberta.erro };
    credencial = aberta.credencial;
  } catch (erro) {
    if (erro instanceof CertificadoInvalidoError || erro instanceof CofreNaoConfiguradoError) return { ...resultado, erro: erro.message };
    throw erro;
  }
  const usaEscritorio = empresa.nfseConfig.usarProcuracao;
  if (!usaEscritorio && !certificadoPertenceAoCnpj(credencial, cnpj)) {
    return { ...resultado, erro: 'O certificado A1 da empresa é de outro CNPJ: a SEFAZ só aceita a manifestação do próprio destinatário.' };
  }

  const limite = Date.now() + TEMPO_MAXIMO_MS;
  const dica = usaEscritorio ? ' O envio usou o certificado do escritório: a SEFAZ pode exigir o certificado da própria empresa.' : '';

  for (let i = 0; i < notas.length; i += EVENTOS_POR_LOTE) {
    const lote = notas.slice(i, i + EVENTOS_POR_LOTE);
    const restante = limite - Date.now();
    if (restante <= 1000) {
      resultado.naoEnviadas += notas.length - i;
      break;
    }

    // O registro vem antes do envio: toda tentativa fica no histórico, e sem a tabela nada sai para a SEFAZ.
    await db.nfeManifestacaoEvento.createMany({
      data: lote.map(n => ({ empresaId, chaveAcesso: n.chaveAcesso, tpEvento: EVENTO_CIENCIA, usuarioId: autor.userId, usuarioEmail: autor.email })),
    });
    const atualizarHistorico = (chave: string, dados: { cStat?: string | null; xMotivo: string; protocolo?: string | null; registrado?: boolean }) =>
      db.nfeManifestacaoEvento.updateMany({ where: { empresaId, chaveAcesso: chave, tpEvento: EVENTO_CIENCIA, cStat: null, xMotivo: null }, data: dados });

    let resposta: RespostaEventos;
    try {
      const dhEvento = dataEvento();
      const eventos = lote.map(n => montarEventoCiencia({ chave: n.chaveAcesso, cnpj, ambiente: AMBIENTE, dhEvento, credencial }));
      const envelope = montarEnvelopeEventos(String(Date.now()).slice(-15), eventos);
      const http = await enviarSoap(credencial, ENDPOINTS[AMBIENTE], `${NS_WSDL}/nfeRecepcaoEvento`, envelope, restante);
      resposta = lerRespostaEventos(http.corpo);
    } catch (erro) {
      if (!(erro instanceof SefazIndisponivelError)) throw erro;
      for (const n of lote) await atualizarHistorico(n.chaveAcesso, { xMotivo: erro.message.slice(0, 500) });
      resultado.naoEnviadas += notas.length - i;
      resultado.erro = erro.message;
      break;
    }

    const porChave = new Map(resposta.eventos.map(e => [e.chave, e]));
    for (const nota of lote) {
      const retorno = porChave.get(nota.chaveAcesso);
      // Sem retorno do evento, vale o motivo do lote (ex.: falha de assinatura ou de esquema).
      const cStat = retorno?.cStat ?? (resposta.cStat || null);
      const xMotivo = retorno?.xMotivo ?? (resposta.xMotivo || 'A SEFAZ não devolveu o resultado deste evento.');
      const registrado = Boolean(retorno && STATUS_REGISTRADO.includes(retorno.cStat));

      await atualizarHistorico(nota.chaveAcesso, { cStat, xMotivo: xMotivo.slice(0, 500), protocolo: retorno?.protocolo ?? null, registrado });
      if (registrado) {
        await db.nfeDestinada.update({ where: { id: nota.id }, data: { manifestacao: 'ciencia' } });
        resultado.registradas++;
      } else {
        resultado.rejeitadas.push({ chave: nota.chaveAcesso, numero: nota.numero, cStat, motivo: `${xMotivo}${dica}` });
      }
    }
  }

  return resultado;
}
