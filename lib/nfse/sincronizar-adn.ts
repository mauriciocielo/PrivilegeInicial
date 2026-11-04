// ============================================================
// NFS-e NACIONAL — leitura das notas emitidas e tomadas no ADN
// ============================================================
// Usada pela tela (botão "Buscar notas do portal") e pelo envio diário ao
// setor fiscal. Só lê: cada chamada avança algumas páginas a partir do último
// NSU e avisa se ainda há mais. Nota já existente é mantida; só o
// cancelamento é atualizado. Não gera conta a receber.

import type { Prisma } from '@prisma/client';
import db from '../prisma';
import { abrirCredencial } from './servidor';
import { apenasDigitos, hojeBrasilia } from './dps';
import { criarTransporteMtls, lerCaixaDfe } from './sefin';
import { eventoCancelaNota, extrairDadosEmissor, lerNotaAdn, mesclarServicos, type ServicoConhecido } from './emissor';

export const MESES_PERMITIDOS = [1, 3, 6, 12];

function primeiroDiaDoPeriodo(meses: number): string {
  const [ano, mes] = hojeBrasilia().split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1 - meses, 1));
  return inicio.toISOString().slice(0, 10);
}

export type ResultadoSincronizacaoAdn =
  | {
      ok: true;
      idsAlterados: string[];
      criadas: number;
      criadasEmitidas: number;
      criadasTomadas: number;
      foraDoPeriodo: number;
      servicos: ServicoConhecido[];
      temMais: boolean;
    }
  | { ok: false; status: number; error: string };

export async function sincronizarNotasAdn(
  empresaId: string,
  opcoes: { meses?: number; reiniciar?: boolean } = {},
): Promise<ResultadoSincronizacaoAdn> {
  const meses = MESES_PERMITIDOS.includes(Number(opcoes.meses)) ? Number(opcoes.meses) : 3;

  const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { cnpj: true, razaoSocial: true, nfseConfig: true } });
  if (!empresa) return { ok: false, status: 404, error: 'Empresa não encontrada.' };
  const config = empresa.nfseConfig ?? await db.nfseConfig.create({ data: { empresaId } });

  const aberta = await abrirCredencial(config);
  if ('erro' in aberta) return { ok: false, status: 422, error: aberta.erro };

  const cnpj = apenasDigitos(empresa.cnpj);
  // Período maior que o já coberto: as notas antigas foram puladas, então relê do início.
  const continuar = !!config.adnUltimoNsu && (config.adnMesesImportados ?? 0) >= meses && opcoes.reiniciar !== true;
  const nsuInicial = continuar ? Number(config.adnUltimoNsu) : 0;

  const caixa = await lerCaixaDfe(criarTransporteMtls('producao', aberta.credencial, 'adn'), cnpj, undefined, nsuInicial);
  if (caixa.status === 'sem_procuracao') {
    return { ok: false, status: 422, error: `O certificado não tem procuração desta empresa. ${caixa.mensagem || ''}`.trim() };
  }
  if (caixa.status !== 'ativa') {
    return { ok: false, status: 503, error: `Não foi possível ler as notas agora. ${caixa.mensagem || ''}`.trim() };
  }

  const corte = primeiroDiaDoPeriodo(meses);
  const clientes = await db.cliente.findMany({ where: { empresaId }, select: { id: true, cpfCnpj: true } });
  const clientePorDoc = new Map(clientes.map(c => [apenasDigitos(c.cpfCnpj), c.id]));

  const idsAlterados: string[] = [];
  let foraDoPeriodo = 0;
  let criadas = 0;
  let criadasEmitidas = 0;
  let criadasTomadas = 0;
  // O XML do evento fica guardado: o DANFSe distingue "CANCELADA" de "SUBSTITUÍDA" por ele.
  const eventoPorChave = new Map(caixa.eventos.filter(e => eventoCancelaNota(e.xml)).map(e => [e.chave, e.xml]));
  const cancelamentos = new Set(eventoPorChave.keys());

  for (const xml of caixa.xmls) {
    const nota = lerNotaAdn(xml, cnpj);
    // Traz tanto as notas emitidas (prestador) quanto os serviços tomados (tomador).
    if (!nota) continue;
    if (nota.dataEmissao < corte) { foraDoPeriodo++; continue; }

    const existente = await db.nfsE.findUnique({ where: { chaveAcesso: nota.chaveAcesso }, select: { id: true, empresaId: true } });
    if (existente) {
      if (existente.empresaId === empresaId) idsAlterados.push(existente.id);
      continue;
    }

    const id = `nfse_${nota.chaveAcesso}`;
    const ehTomada = nota.papel === 'tomado';
    await db.nfsE.create({
      data: {
        id,
        empresaId,
        numero: nota.numero,
        serie: nota.serie,
        status: cancelamentos.has(nota.chaveAcesso) ? 'cancelada' : 'emitida',
        prestadorCnpj: ehTomada ? (nota.prestadorDocumento || '') : empresa.cnpj,
        prestadorRazaoSocial: nota.prestadorRazaoSocial || (ehTomada ? 'Prestador não informado' : empresa.razaoSocial),
        prestadorInscricaoMunicipal: nota.prestadorInscricaoMunicipal,
        clienteId: ehTomada ? null : (clientePorDoc.get(nota.tomadorDocumento) ?? null),
        tomadorCnpjCpf: ehTomada ? empresa.cnpj : nota.tomadorDocumento,
        tomadorRazaoSocial: nota.tomadorRazaoSocial || (ehTomada ? empresa.razaoSocial : ''),
        tomadorEmail: nota.tomadorEmail,
        tomadorEndereco: nota.tomadorEndereco,
        tomadorCep: nota.tomadorCep,
        tomadorInscricaoMunicipal: nota.tomadorInscricaoMunicipal,
        tomadorCodigoMunicipio: nota.tomadorCodigoMunicipio,
        tomadorNumero: nota.tomadorNumero,
        tomadorBairro: nota.tomadorBairro,
        dataEmissao: nota.dataEmissao,
        dataCompetencia: nota.dataCompetencia,
        codigoServico: nota.codigoServico,
        cTribMun: nota.cTribMun,
        cNbs: nota.cNbs,
        discriminacao: nota.discriminacao,
        municipioPrestacao: nota.municipioPrestacao,
        valorServicos: nota.valorServicos,
        valorDeducoes: 0,
        valorPis: nota.valorPis,
        valorCofins: nota.valorCofins,
        valorInss: nota.valorInss,
        valorIr: nota.valorIr,
        valorCsll: nota.valorCsll,
        issRetido: nota.issRetido,
        valorIss: nota.valorIss,
        aliquotaIss: nota.aliquotaIss,
        valorBaseCalculo: nota.valorBaseCalculo,
        valorLiquido: nota.valorLiquido,
        ambiente: nota.ambiente,
        nDps: nota.nDps,
        idDps: nota.idDps,
        chaveAcesso: nota.chaveAcesso,
        documento: { create: { nfseXml: xml, eventoXml: eventoPorChave.get(nota.chaveAcesso) ?? null } },
      },
    });
    idsAlterados.push(id);
    criadas++;
    if (ehTomada) criadasTomadas++;
    else criadasEmitidas++;
  }

  // O cancelamento pode chegar em leitura posterior à da nota.
  if (cancelamentos.size > 0) {
    const afetadas = await db.nfsE.findMany({
      where: { empresaId, chaveAcesso: { in: [...cancelamentos] }, status: { not: 'cancelada' } },
      select: { id: true, chaveAcesso: true },
    });
    for (const nota of afetadas) {
      await db.nfsE.update({
        where: { id: nota.id },
        data: {
          status: 'cancelada',
          cancelamentoEmAnalise: false,
          documento: { update: { eventoXml: eventoPorChave.get(nota.chaveAcesso!) } },
        },
      });
      idsAlterados.push(nota.id);
    }
  }

  // Serviços só somam em leitura nova: reler do início recomeça a contagem.
  const atuais = continuar ? ((config.servicosConhecidos as unknown as ServicoConhecido[] | null) || []) : [];
  const servicos = mesclarServicos(atuais, extrairDadosEmissor(caixa.xmls, cnpj).servicos);
  await db.nfseConfig.update({
    where: { empresaId },
    data: {
      adnUltimoNsu: String(caixa.ultimoNsu),
      adnMesesImportados: Math.max(meses, continuar ? (config.adnMesesImportados ?? 0) : 0),
      servicosConhecidos: servicos as unknown as Prisma.InputJsonValue,
    },
  });

  return { ok: true, idsAlterados, criadas, criadasEmitidas, criadasTomadas, foraDoPeriodo, servicos, temMais: caixa.parcial };
}

