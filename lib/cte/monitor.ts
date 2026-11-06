// ============================================================
// CT-e MONITOR — Distribuição de Fretes (SVRS) por Empresa
// ============================================================

import db from '../prisma';
import { apenasDigitos } from '../nfse/dps';
import { abrirCredencial } from '../nfse/servidor';
import {
  enviarDistribuicaoCte, interpretarDocumentoCte, lerRespostaDistribuicaoCte,
  montarEnvelopeDistribuicaoCte, SefazCteIndisponivelError, type AmbienteCte, type DadosCte
} from './distribuicao';
import { registrarLogFiscal } from '../nfe/logger';
import { ehHorarioNoturnoBrasilia } from '../nfe/monitor';

const MAX_PAGINAS_POR_CONSULTA = 8;
// Janela noturna: busca todos os CT-e de uma vez (teto alto), igual ao monitor de NF-e.
const MAX_PAGINAS_NOTURNO = 160;
const AMBIENTE: AmbienteCte = 'producao';

export interface ResultadoConsultaCte {
  empresaId: string;
  executada: boolean;
  cStat: string | null;
  mensagem: string;
  paginas: number;
  novas: number;
  atualizadas: number;
  ultNsuCte: string;
  maxNsuCte: string;
  temMais: boolean;
}

const ufDoMunicipio = (codigoMunicipio: string | null | undefined) =>
  (/^\d{7}$/.test(codigoMunicipio || '') ? String(codigoMunicipio).slice(0, 2) : undefined);

async function gravarCte(empresaId: string, nsu: string, nota: DadosCte, xml: string | null): Promise<'nova' | 'atualizada'> {
  const chave = { empresaId_chaveAcesso: { empresaId, chaveAcesso: nota.chave } };
  const existente = await db.nfeDestinada.findUnique({
    where: chave,
    select: { id: true, possuiXml: true, situacao: true },
  });

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
      data: {
        empresaId,
        chaveAcesso: nota.chave,
        nsu,
        situacao: nota.situacao,
        ...dados,
        ...(xml ? { possuiXml: true, xml } : {}),
      },
    });
    return 'nova';
  }

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

/**
 * Executa uma rodada de consulta de CT-e na SEFAZ SVRS para a empresa informada.
 * `limiteMs` (epoch) é o prazo da rodada em lote: a consulta para ao atingi-lo para
 * não estourar o tempo da função serverless (retoma do NSU gravado na próxima rodada).
 */
export async function consultarCteEmpresa(empresaId: string, limiteMs?: number): Promise<ResultadoConsultaCte> {
  const empresa = await db.empresa.findUnique({
    where: { id: empresaId },
    select: {
      id: true,
      cnpj: true,
      razaoSocial: true,
      nfseConfig: true,
      nfeDistribuicao: { select: { ultNsuCte: true, maxNsuCte: true } },
    },
  });

  if (!empresa) {
    return {
      empresaId,
      executada: false,
      cStat: null,
      mensagem: 'Empresa não encontrada.',
      paginas: 0,
      novas: 0,
      atualizadas: 0,
      ultNsuCte: '0',
      maxNsuCte: '0',
      temMais: false,
    };
  }

  if (!empresa.nfseConfig) {
    return {
      empresaId,
      executada: false,
      cStat: null,
      mensagem: 'Empresa sem configuração de certificado A1.',
      paginas: 0,
      novas: 0,
      atualizadas: 0,
      ultNsuCte: '0',
      maxNsuCte: '0',
      temMais: false,
    };
  }

  // Abre credencial A1 do cofre
  let aberta;
  try {
    aberta = await abrirCredencial(empresa.nfseConfig);
  } catch (erro: any) {
    return {
      empresaId,
      executada: false,
      cStat: null,
      mensagem: erro?.message || 'Falha ao abrir credencial A1.',
      paginas: 0,
      novas: 0,
      atualizadas: 0,
      ultNsuCte: '0',
      maxNsuCte: '0',
      temMais: false,
    };
  }

  if ('erro' in aberta) {
    return {
      empresaId,
      executada: false,
      cStat: null,
      mensagem: aberta.erro,
      paginas: 0,
      novas: 0,
      atualizadas: 0,
      ultNsuCte: '0',
      maxNsuCte: '0',
      temMais: false,
    };
  }

  const { credencial } = aberta;
  const cnpj = apenasDigitos(empresa.cnpj);
  const cUfAutor = ufDoMunicipio(empresa.nfseConfig?.codigoMunicipio) || '41';

  let ultNsu = empresa.nfeDistribuicao?.ultNsuCte || '0';
  let maxNsu = empresa.nfeDistribuicao?.maxNsuCte || '0';

  let paginas = 0;
  let novas = 0;
  let atualizadas = 0;
  let ultimoCstat = '';
  let ultimoMotivo = '';
  let temMais = false;

  // No modo noturno busca todos os CT-e de uma vez (teto alto). O prazo é o MENOR entre
  // o orçamento próprio e o limite da rodada em lote (`limiteMs`), para nunca estourar o
  // tempo da função serverless. Ao atingi-lo, retoma do NSU gravado na próxima rodada.
  const maxPaginas = ehHorarioNoturnoBrasilia() ? MAX_PAGINAS_NOTURNO : MAX_PAGINAS_POR_CONSULTA;
  const ORCAMENTO_MS = 45_000;
  const prazo = Math.min(Date.now() + ORCAMENTO_MS, limiteMs ?? Number.MAX_SAFE_INTEGER);

  for (let i = 0; i < maxPaginas; i++) {
    if (i > 0 && Date.now() >= prazo) { temMais = BigInt(ultNsu || '0') < BigInt(maxNsu || '0'); break; }
    paginas++;
    const envelope = montarEnvelopeDistribuicaoCte({
      ambiente: AMBIENTE,
      cnpj,
      ultNsu,
      cUfAutor,
    });

    let resposta;
    try {
      resposta = await enviarDistribuicaoCte(credencial, AMBIENTE, envelope);
    } catch (erro: any) {
      await registrarLogFiscal({
        empresaId,
        tipo: 'cte',
        status: 'erro',
        mensagem: erro?.message || 'Falha de comunicação com a SEFAZ para CT-e.',
      });
      return {
        empresaId,
        executada: paginas > 1,
        cStat: ultimoCstat || null,
        mensagem: erro?.message || 'Falha de comunicação com a SEFAZ para CT-e.',
        paginas,
        novas,
        atualizadas,
        ultNsuCte: ultNsu,
        maxNsuCte: maxNsu,
        temMais: false,
      };
    }

    const parsed = lerRespostaDistribuicaoCte(resposta.corpo);

    ultimoCstat = parsed.cStat;
    ultimoMotivo = parsed.xMotivo;
    ultNsu = parsed.ultNsu || ultNsu;
    maxNsu = parsed.maxNsu || maxNsu;

    // 137: Nenhum documento novo localizado na SVRS
    if (parsed.cStat === '137') {
      temMais = false;
      break;
    }

    // 138: Documentos localizados
    if (parsed.cStat === '138') {
      for (const doc of parsed.documentos) {
        const interpretado = interpretarDocumentoCte(doc.schema, doc.xml);
        if (!interpretado) continue;

        if (interpretado.tipo === 'resumo' || interpretado.tipo === 'completa') {
          const resultado = await gravarCte(
            empresaId,
            doc.nsu,
            interpretado.nota,
            interpretado.tipo === 'completa' ? interpretado.xml : null
          );
          if (resultado === 'nova') novas++;
          else atualizadas++;
        } else if (interpretado.tipo === 'evento') {
          if (interpretado.tpEvento === '110111') {
            await db.nfeDestinada.updateMany({
              where: { empresaId, chaveAcesso: interpretado.chave },
              data: { situacao: 'cancelada' },
            });
          }
        }
      }

      // Atualiza o ponteiro de NSU de CT-e no banco
      await db.nfeDistribuicao.upsert({
        where: { empresaId },
        update: { ultNsuCte: ultNsu, maxNsuCte: maxNsu },
        create: { empresaId, ultNsuCte: ultNsu, maxNsuCte: maxNsu },
      });

      const nsuAtual = BigInt(ultNsu || '0');
      const nsuMax = BigInt(maxNsu || '0');
      if (nsuAtual < nsuMax) {
        temMais = true;
      } else {
        temMais = false;
        break;
      }
    } else {
      // Outro status (ex: 656 consumo indevido)
      break;
    }
  }

  // Atualiza ponteiro final no banco
  await db.nfeDistribuicao.upsert({
    where: { empresaId },
    update: { ultNsuCte: ultNsu, maxNsuCte: maxNsu },
    create: { empresaId, ultNsuCte: ultNsu, maxNsuCte: maxNsu },
  });

  // Registra log se houver novidades ou rejeições
  if (novas > 0) {
    await registrarLogFiscal({
      empresaId,
      tipo: 'cte',
      status: 'sucesso',
      cStat: ultimoCstat || '138',
      mensagem: `SEFAZ CT-e: ${novas} novo(s) frete(s) localizado(s).`,
      novas,
      atualizadas,
    });
  } else if (ultimoCstat && !['137', '138'].includes(ultimoCstat)) {
    await registrarLogFiscal({
      empresaId,
      tipo: 'cte',
      status: 'alerta',
      cStat: ultimoCstat,
      mensagem: `SEFAZ CT-e [${ultimoCstat}] ${ultimoMotivo}`.trim(),
    });
  }

  return {
    empresaId,
    executada: true,
    cStat: ultimoCstat,
    mensagem: ultimoMotivo || (ultimoCstat === '137' ? 'Nenhum CT-e novo na SEFAZ' : 'Consulta de CT-e concluída'),
    paginas,
    novas,
    atualizadas,
    ultNsuCte: ultNsu,
    maxNsuCte: maxNsu,
    temMais,
  };
}
