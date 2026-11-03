import { NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import db from '../../../../../../lib/prisma';
import { requireAuth } from '../../../../../../lib/api-auth';
import { captureError } from '../../../../../../lib/sentry-helper';
import { abrirCredencial, acessoEmissaoNegado } from '../../../../../../lib/nfse/servidor';
import { apenasDigitos, hojeBrasilia } from '../../../../../../lib/nfse/dps';
import { CertificadoInvalidoError } from '../../../../../../lib/nfse/assinatura';
import { CofreNaoConfiguradoError } from '../../../../../../lib/nfse/cofre';
import { criarTransporteMtls, lerCaixaDfe, SefinIndisponivelError } from '../../../../../../lib/nfse/sefin';
import { eventoCancelaNota, extrairDadosEmissor, lerNotaEmitida, mesclarServicos, type ServicoConhecido } from '../../../../../../lib/nfse/emissor';

const MESES_PERMITIDOS = [1, 3, 6, 12];

function primeiroDiaDoPeriodo(meses: number): string {
  const [ano, mes] = hojeBrasilia().split('-').map(Number);
  const inicio = new Date(Date.UTC(ano, mes - 1 - meses, 1));
  return inicio.toISOString().slice(0, 10);
}

const colunasDevolvidas = {
  id: true, empresaId: true, numero: true, serie: true, status: true, motivoCancelamento: true,
  prestadorCnpj: true, prestadorRazaoSocial: true, prestadorInscricaoMunicipal: true,
  clienteId: true, tomadorCnpjCpf: true, tomadorRazaoSocial: true, tomadorEmail: true, tomadorEndereco: true,
  tomadorCep: true, tomadorInscricaoMunicipal: true, tomadorCodigoMunicipio: true, tomadorNumero: true, tomadorBairro: true,
  dataEmissao: true, dataCompetencia: true, codigoServico: true, cTribMun: true, cNbs: true, discriminacao: true, municipioPrestacao: true,
  valorServicos: true, valorDeducoes: true, valorPis: true, valorCofins: true, valorInss: true, valorIr: true, valorCsll: true,
  issRetido: true, valorIss: true, aliquotaIss: true, valorBaseCalculo: true, valorLiquido: true,
  ambiente: true, nDps: true, idDps: true, chaveAcesso: true, gerarContaReceber: true, cancelamentoEmAnalise: true, lancamentoId: true, createdAt: true,
} as const;

/**
 * Traz as notas emitidas no portal, para servir de base. Só lê: cada chamada avança
 * até 10 páginas a partir de onde parou e avisa se ainda há mais. Nota que já existe
 * no sistema é mantida; só o cancelamento é atualizado. Não gera conta a receber.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = requireAuth(request);
    if (auth.error) return auth.error;
    const { id: empresaId } = await params;
    const negado = await acessoEmissaoNegado(auth.session, empresaId);
    if (negado) return negado;

    const body = await request.json().catch(() => ({}));
    const meses = MESES_PERMITIDOS.includes(Number(body?.meses)) ? Number(body.meses) : 3;

    const empresa = await db.empresa.findUnique({ where: { id: empresaId }, select: { cnpj: true, razaoSocial: true, nfseConfig: true } });
    if (!empresa) return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    const config = empresa.nfseConfig ?? await db.nfseConfig.create({ data: { empresaId } });

    const aberta = await abrirCredencial(config);
    if ('erro' in aberta) return NextResponse.json({ error: aberta.erro }, { status: 422 });

    const cnpj = apenasDigitos(empresa.cnpj);
    // Período maior que o já coberto: as notas antigas foram puladas, então relê do início.
    const continuar = !!config.adnUltimoNsu && (config.adnMesesImportados ?? 0) >= meses && body?.reiniciar !== true;
    const nsuInicial = continuar ? Number(config.adnUltimoNsu) : 0;

    const caixa = await lerCaixaDfe(criarTransporteMtls('producao', aberta.credencial, 'adn'), cnpj, undefined, nsuInicial);
    if (caixa.status === 'sem_procuracao') {
      return NextResponse.json({ error: `O certificado não tem procuração desta empresa. ${caixa.mensagem || ''}`.trim() }, { status: 422 });
    }
    if (caixa.status !== 'ativa') {
      return NextResponse.json({ error: `Não foi possível ler as notas agora. ${caixa.mensagem || ''}`.trim() }, { status: 503 });
    }

    const corte = primeiroDiaDoPeriodo(meses);
    const clientes = await db.cliente.findMany({ where: { empresaId }, select: { id: true, cpfCnpj: true } });
    const clientePorDoc = new Map(clientes.map(c => [apenasDigitos(c.cpfCnpj), c.id]));

    const idsAlterados: string[] = [];
    let foraDoPeriodo = 0;
    let criadas = 0;
    // O XML do evento fica guardado: o DANFSe distingue "CANCELADA" de "SUBSTITUÍDA" por ele.
    const eventoPorChave = new Map(caixa.eventos.filter(e => eventoCancelaNota(e.xml)).map(e => [e.chave, e.xml]));
    const cancelamentos = new Set(eventoPorChave.keys());

    for (const xml of caixa.xmls) {
      const nota = lerNotaEmitida(xml, cnpj);
      // A caixa também traz o que a empresa recebeu como tomador: isso não é nota emitida.
      if (!nota) continue;
      if (nota.dataEmissao < corte) { foraDoPeriodo++; continue; }

      const existente = await db.nfsE.findUnique({ where: { chaveAcesso: nota.chaveAcesso }, select: { id: true } });
      if (existente) {
        // Os dados do sistema prevalecem, mas a tela pode ainda não ter esta nota.
        idsAlterados.push(existente.id);
        continue;
      }

      const id = `nfse_${nota.chaveAcesso}`;
      await db.nfsE.create({
        data: {
          id,
          empresaId,
          numero: nota.numero,
          serie: nota.serie,
          status: cancelamentos.has(nota.chaveAcesso) ? 'cancelada' : 'emitida',
          prestadorCnpj: empresa.cnpj,
          prestadorRazaoSocial: nota.prestadorRazaoSocial || empresa.razaoSocial,
          prestadorInscricaoMunicipal: nota.prestadorInscricaoMunicipal,
          clienteId: clientePorDoc.get(nota.tomadorDocumento) ?? null,
          tomadorCnpjCpf: nota.tomadorDocumento,
          tomadorRazaoSocial: nota.tomadorRazaoSocial,
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

    const notas = idsAlterados.length > 0
      ? await db.nfsE.findMany({ where: { id: { in: [...new Set(idsAlterados)] } }, select: colunasDevolvidas })
      : [];

    return NextResponse.json({ notas, criadas, foraDoPeriodo, servicos, temMais: caixa.parcial });
  } catch (error) {
    if (error instanceof SefinIndisponivelError) {
      return NextResponse.json({ error: `${error.message} Tente de novo: a leitura continua de onde parou.` }, { status: 503 });
    }
    if (error instanceof CertificadoInvalidoError || error instanceof CofreNaoConfiguradoError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Erro em POST nfse/emissores/notas:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao buscar as notas do portal.' }, { status: 500 });
  }
}
