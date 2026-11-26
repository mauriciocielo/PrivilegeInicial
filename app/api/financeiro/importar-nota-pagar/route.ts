import { NextResponse } from 'next/server';
import crypto from 'crypto';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { captureError } from '../../../../lib/sentry-helper';

export const dynamic = 'force-dynamic';

const digitos = (v?: string | null) => String(v || '').replace(/\D/g, '');

function formatarDoc(doc: string): string {
  const d = digitos(doc);
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
  return doc;
}

function lerTagXml(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([^<]*)</${tag}>`, 'i'));
  return m?.[1]?.trim() || '';
}

function lerBlocoXml(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, 'i'));
  return m?.[0] || '';
}

function extrairDetalhesXmlNfe(xml: string) {
  const emit = lerBlocoXml(xml, 'emit');
  const enderEmit = lerBlocoXml(emit, 'enderEmit');
  const cobr = lerBlocoXml(xml, 'cobr');

  const parcelas: Array<{ numero: string; dataVencimento: string; valor: number }> = [];
  const dupMatches = cobr.matchAll(/<dup>([\s\S]*?)<\/dup>/gi);
  for (const m of dupMatches) {
    const bloco = m[1];
    const nDup = lerTagXml(bloco, 'nDup') || String(parcelas.length + 1).padStart(3, '0');
    const dVenc = lerTagXml(bloco, 'dVenc');
    const vDup = parseFloat(lerTagXml(bloco, 'vDup').replace(',', '.')) || 0;
    if (dVenc && vDup > 0) {
      parcelas.push({ numero: nDup, dataVencimento: dVenc.slice(0, 10), valor: Math.round(vDup * 100) / 100 });
    }
  }

  const produtos: string[] = [];
  for (const m of xml.matchAll(/<xProd>([^<]+)<\/xProd>/gi)) {
    const nome = m[1]?.trim();
    if (nome && produtos.length < 3) produtos.push(nome);
  }

  const logradouro = [lerTagXml(enderEmit, 'xLgr'), lerTagXml(enderEmit, 'nro'), lerTagXml(enderEmit, 'xBairro')]
    .filter(Boolean)
    .join(', ');

  return {
    parcelas,
    resumoProdutos: produtos.join(', '),
    fornecedorExtra: {
      nomeFantasia: lerTagXml(emit, 'xFant') || null,
      telefone: lerTagXml(enderEmit, 'fone') || null,
      endereco: logradouro || null,
      cidade: lerTagXml(enderEmit, 'xMun') || null,
      estado: lerTagXml(enderEmit, 'UF') || null,
      cep: digitos(lerTagXml(enderEmit, 'CEP')) || null,
    },
  };
}

async function verificarAcessoEmpresa(userId: string, role: string, empresaId: string): Promise<boolean> {
  if (role === 'administrador') return true;
  const user = await db.user.findUnique({ where: { id: userId }, select: { empresaIds: true } });
  return Boolean(user?.empresaIds?.includes(empresaId));
}

/**
 * GET /api/financeiro/importar-nota-pagar?empresaId=...&nfeId=...&chaveAcesso=...
 * Retorna parcelas extraídas do XML da NF-e (se houver), dados extras do fornecedor
 * e se a nota já foi lançada no Contas a Pagar desta empresa.
 */
export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const url = new URL(request.url);
    const empresaId = (url.searchParams.get('empresaId') || '').trim();
    const nfeId = (url.searchParams.get('nfeId') || '').trim();
    const chaveParam = (url.searchParams.get('chaveAcesso') || '').trim();

    if (!empresaId) return NextResponse.json({ error: 'empresaId obrigatório.' }, { status: 400 });
    const permitido = await verificarAcessoEmpresa(auth.session.userId, auth.session.role, empresaId);
    if (!permitido) return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });

    let chave = chaveParam;
    let detalhesXml: ReturnType<typeof extrairDetalhesXmlNfe> | null = null;

    if (nfeId) {
      const nfe = await db.nfeDestinada.findFirst({
        where: { id: nfeId, empresaId },
        select: { chaveAcesso: true, xml: true },
      });
      if (nfe) {
        chave = chave || nfe.chaveAcesso;
        if (nfe.xml) detalhesXml = extrairDetalhesXmlNfe(nfe.xml);
      }
    }

    let jaLancada = false;
    if (chave) {
      const existente = await db.lancamento.findFirst({
        where: {
          empresaId,
          tipo: 'despesa',
          observacao: { contains: chave },
        },
        select: { id: true },
      });
      jaLancada = Boolean(existente);
    }

    return NextResponse.json({
      jaLancada,
      parcelas: detalhesXml?.parcelas || [],
      resumoProdutos: detalhesXml?.resumoProdutos || '',
      fornecedorExtra: detalhesXml?.fornecedorExtra || null,
    });
  } catch (error) {
    console.error('Erro em GET /api/financeiro/importar-nota-pagar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao consultar dados da nota.' }, { status: 500 });
  }
}

/**
 * POST /api/financeiro/importar-nota-pagar
 * Cadastra automaticamente o Fornecedor (se não existir) e lança o(s) título(s) no
 * Contas a Pagar (Lancamento despesa previsto + ContaPagar aberto) sem duplicar.
 */
export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const body = await request.json().catch(() => ({}));
    const empresaId = String(body?.empresaId || '').trim();
    const origem = body?.origem === 'nfe' ? 'nfe' : 'nfse';
    const chaveAcesso = String(body?.chaveAcesso || '').trim();
    const numeroDocumento = String(body?.numeroDocumento || '').trim();
    const dataEmissao = String(body?.dataEmissao || new Date().toISOString().slice(0, 10)).slice(0, 10);
    const descricaoBase = String(body?.descricao || '').trim();
    const planoContaId = String(body?.planoContaId || '').trim();
    const portadorId = String(body?.portadorId || '').trim();
    const formaPagamento = String(body?.formaPagamento || 'Boleto').trim();
    const permitirDuplicado = Boolean(body?.permitirDuplicado);

    const forn = body?.fornecedor || {};
    const docFornecedor = digitos(forn.cpfCnpj);
    const nomeFornecedor = String(forn.nome || '').trim();

    const parcelasRaw = Array.isArray(body?.parcelas) ? body.parcelas : [];
    const parcelas = parcelasRaw
      .map((p: any, idx: number) => ({
        numero: String(p?.numero || `${idx + 1}/${parcelasRaw.length}`),
        dataVencimento: String(p?.dataVencimento || '').slice(0, 10),
        valor: Math.round((Number(p?.valor) || 0) * 100) / 100,
      }))
      .filter((p: any) => p.dataVencimento && p.valor > 0);

    if (!empresaId) return NextResponse.json({ error: 'Empresa não informada.' }, { status: 400 });
    if (!nomeFornecedor) return NextResponse.json({ error: 'Nome do fornecedor obrigatório.' }, { status: 400 });
    if (parcelas.length === 0) return NextResponse.json({ error: 'Informe ao menos uma parcela com valor e vencimento.' }, { status: 400 });

    const permitido = await verificarAcessoEmpresa(auth.session.userId, auth.session.role, empresaId);
    if (!permitido) return NextResponse.json({ error: 'Sem acesso a esta empresa.' }, { status: 403 });

    // Anti-duplicidade pela chave de acesso
    if (chaveAcesso && !permitirDuplicado) {
      const jaExiste = await db.lancamento.findFirst({
        where: {
          empresaId,
          tipo: 'despesa',
          observacao: { contains: chaveAcesso },
        },
        select: { id: true },
      });
      if (jaExiste) {
        return NextResponse.json(
          { error: 'Esta nota fiscal já foi lançada no Contas a Pagar desta empresa.', jaLancada: true },
          { status: 409 }
        );
      }
    }

    // 1. Busca ou cria o Fornecedor na tabela Cliente (tipo = 'fornecedor' | 'ambos')
    const clientesEmpresa = await db.cliente.findMany({
      where: { empresaId },
      select: { id: true, cpfCnpj: true, tipo: true, nome: true },
    });

    let fornecedor = clientesEmpresa.find(c => docFornecedor && digitos(c.cpfCnpj) === docFornecedor) || null;
    let fornecedorCriado = false;

    if (!fornecedor) {
      const novoFornecedor = await db.cliente.create({
        data: {
          id: crypto.randomUUID(),
          empresaId,
          tipo: 'fornecedor',
          nome: nomeFornecedor,
          nomeFantasia: forn.nomeFantasia || null,
          cpfCnpj: formatarDoc(docFornecedor || forn.cpfCnpj || ''),
          email: forn.email || null,
          telefone: forn.telefone || null,
          endereco: forn.endereco || null,
          cidade: forn.cidade || null,
          estado: forn.estado || null,
          cep: forn.cep || null,
          observacao: `Cadastrado automaticamente via importação de ${origem === 'nfe' ? 'NF-e Recebida' : 'NFS-e Tomada'}`,
          ativo: true,
        },
      });
      fornecedor = novoFornecedor;
      fornecedorCriado = true;
    } else if (fornecedor.tipo === 'cliente') {
      await db.cliente.update({
        where: { id: fornecedor.id },
        data: { tipo: 'ambos' },
      });
      fornecedor = { ...fornecedor, tipo: 'ambos' };
    }

    const fornecedorCompleto = await db.cliente.findUnique({ where: { id: fornecedor.id } });

    // 2. Cria cada parcela em Lancamento (Contas a Pagar do painel) + ContaPagar (ERP/BPO)
    const lancamentosCriados: any[] = [];
    const totalParcelas = parcelas.length;
    const prefixoDoc = numeroDocumento || (origem === 'nfe' ? 'NF-e' : 'NFS-e');

    for (let i = 0; i < totalParcelas; i++) {
      const p = parcelas[i];
      const sufixoParc = totalParcelas > 1 ? ` (${i + 1}/${totalParcelas})` : '';
      const descFinal = `${descricaoBase || `${origem === 'nfe' ? 'NF-e' : 'NFS-e'} ${prefixoDoc} — ${nomeFornecedor}`}${sufixoParc}`;
      const numDocFinal = totalParcelas > 1 ? `${prefixoDoc}-${i + 1}/${totalParcelas}` : prefixoDoc;
      const obs = [
        `Origem: ${origem === 'nfe' ? 'NF-e Recebida' : 'NFS-e Tomada'}`,
        `Fornecedor: ${nomeFornecedor}`,
        formaPagamento ? `Forma: ${formaPagamento}` : '',
        chaveAcesso ? `Chave: ${chaveAcesso}` : '',
      ].filter(Boolean).join(' | ');

      const lanc = await db.lancamento.create({
        data: {
          id: crypto.randomUUID(),
          empresaId,
          data: p.dataVencimento,
          descricao: descFinal,
          valor: p.valor,
          tipo: 'despesa',
          planoContaId: planoContaId || '',
          portadorId: portadorId || '',
          status: 'previsto',
          numeroDocumento: numDocFinal,
          observacao: obs,
          clienteId: fornecedor.id,
          origem: 'manual',
        },
      });
      lancamentosCriados.push(lanc);

      await db.contaPagar.create({
        data: {
          id: crypto.randomUUID(),
          empresaId,
          fornecedorId: fornecedor.id,
          planoContaId: planoContaId || null,
          numeroDocumento: numDocFinal,
          descricao: descFinal,
          dataEmissao,
          dataVencimento: p.dataVencimento,
          valorOriginal: p.valor,
          acrescimos: 0,
          descontos: 0,
          valorLiquido: p.valor,
          status: 'aberto',
          formaPagamentoPrevista: formaPagamento || null,
        },
      }).catch(err => console.warn('Aviso ao espelhar ContaPagar:', err));
    }

    return NextResponse.json({
      ok: true,
      fornecedorCriado,
      fornecedor: fornecedorCompleto,
      lancamentos: lancamentosCriados,
      totalParcelas,
    });
  } catch (error) {
    console.error('Erro em POST /api/financeiro/importar-nota-pagar:', error);
    captureError(error);
    return NextResponse.json({ error: 'Erro ao importar nota para o Contas a Pagar.' }, { status: 500 });
  }
}
