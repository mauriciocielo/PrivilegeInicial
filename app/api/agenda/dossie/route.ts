import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';

export const dynamic = 'force-dynamic';

const moeda = (v: number) =>
  (Number(v) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export async function POST(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito a consultores e administradores.' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const empresaId = typeof body?.empresaId === 'string' ? body.empresaId.trim() : '';
    const tituloReuniao = typeof body?.titulo === 'string' ? body.titulo.trim() : 'Reunião com o cliente';

    if (!empresaId) {
      return NextResponse.json({ error: 'Selecione uma empresa para gerar o Dossiê Pré-Reunião.' }, { status: 400 });
    }

    const empresa = await db.empresa.findUnique({
      where: { id: empresaId },
      select: { id: true, razaoSocial: true, nomeFantasia: true, cnpj: true, responsavel: true, cidade: true, uf: true },
    });
    if (!empresa) {
      return NextResponse.json({ error: 'Empresa não encontrada.' }, { status: 404 });
    }

    const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const mesAtual = hoje.slice(0, 7);

    // 1. Saldo consolidado em caixa + contas vencidas
    const [portadores, lancsRealizados, lancsVencidos, notasMes, nfseConfig, certidoes, ultimaAta] = await Promise.all([
      db.portador.findMany({ where: { empresaId, ativo: true }, select: { id: true, saldoInicial: true, saldoInicialData: true } }),
      db.lancamento.findMany({ where: { empresaId, status: 'realizado' }, select: { tipo: true, valor: true, data: true, portadorId: true } }),
      db.lancamento.findMany({ where: { empresaId, status: 'previsto', data: { lt: hoje } }, select: { tipo: true, valor: true } }),
      db.nfsE.findMany({
        where: { empresaId, status: 'emitida', dataEmissao: { gte: `${mesAtual}-01` } },
        select: { valorServicos: true, prestadorCnpj: true },
      }),
      db.nfseConfig.findUnique({
        where: { empresaId },
        select: { usarProcuracao: true, certValidoAte: true, procuracaoStatus: true },
      }),
      db.certidaoFiscal.findMany({
        where: { empresaId },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { tipo: true, situacao: true, validoAte: true },
      }),
      db.ataAtendimento.findFirst({
        where: { empresaId },
        orderBy: { createdAt: 'desc' },
        select: { data: true, titulo: true, conteudo: true },
      }),
    ]);

    let saldoCaixa = 0;
    for (const p of portadores) {
      const inicio = p.saldoInicialData || '1970-01-01';
      const doPort = lancsRealizados.filter(l => l.portadorId === p.id && l.data >= inicio);
      const rec = doPort.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
      const desp = doPort.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
      saldoCaixa += (p.saldoInicial || 0) + rec - desp;
    }

    const pagarVencido = lancsVencidos.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
    const receberVencido = lancsVencidos.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
    const faturamentoNfseMes = notasMes.reduce((s, n) => s + (n.valorServicos || 0), 0);

    let certStatus = 'Não configurado';
    let certAlerta = false;
    if (nfseConfig?.usarProcuracao) {
      certStatus = nfseConfig.procuracaoStatus === 'ativa' ? 'Procuração Eletrônica Ativa' : 'Procuração pendente';
    } else if (nfseConfig?.certValidoAte) {
      const dias = Math.ceil((nfseConfig.certValidoAte.getTime() - Date.now()) / 86400000);
      const dtBr = nfseConfig.certValidoAte.toISOString().slice(0, 10).split('-').reverse().join('/');
      if (dias < 0) {
        certStatus = `VENCIDO (${dtBr})`;
        certAlerta = true;
      } else if (dias <= 30) {
        certStatus = `Vence em ${dias}d (${dtBr})`;
        certAlerta = true;
      } else {
        certStatus = `Válido até ${dtBr}`;
      }
    }

    const cndsPendencias = certidoes.filter(c => c.situacao === 'POSITIVA').map(c => c.tipo);
    const resumoDados = {
      empresa: empresa.nomeFantasia || empresa.razaoSocial,
      cnpj: empresa.cnpj,
      responsavel: empresa.responsavel,
      saldoCaixa,
      pagarVencido,
      receberVencido,
      qtdNotasMes: notasMes.length,
      faturamentoNfseMes,
      certStatus,
      certAlerta,
      cndsPendencias,
      ultimaAta: ultimaAta ? { data: ultimaAta.data, titulo: ultimaAta.titulo, resumo: ultimaAta.conteudo.slice(0, 260) } : null,
    };

    // 2. Gera recomendações de pauta via Gemini (server-side) com fallback determinístico
    let pontosIA: string[] = [];
    const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY;
    if (geminiKey) {
      try {
        const prompt = [
          `Você é um consultor sênior da Privilege Contabilidade preparando o consultor para uma reunião.`,
          `Reunião: "${tituloReuniao}" com a empresa "${resumoDados.empresa}".`,
          `Dados reais atuais:`,
          `- Saldo em Caixa: ${moeda(saldoCaixa)}`,
          `- Contas a Pagar Vencidas: ${moeda(pagarVencido)}`,
          `- Contas a Receber Vencidas: ${moeda(receberVencido)}`,
          `- NFS-e no mês: ${notasMes.length} nota(s), total ${moeda(faturamentoNfseMes)}`,
          `- Certificado A1: ${certStatus}`,
          `- CNDs com débito: ${cndsPendencias.length > 0 ? cndsPendencias.join(', ') : 'Nenhuma'}`,
          ultimaAta ? `- Última Ata (${ultimaAta.data} — ${ultimaAta.titulo}): ${ultimaAta.conteudo.slice(0, 300)}` : '- Sem ata anterior registrada',
          ``,
          `Gere EXATAMENTE 3 pontos objetivos de pauta/alerta (máximo 1 frase direta por ponto) para o consultor levar para a reunião. Responda apenas as 3 linhas começando com "- ".`,
        ].join('\n');

        const gRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
            signal: AbortSignal.timeout(9000),
          }
        );
        if (gRes.ok) {
          const gJson = await gRes.json();
          const txt: string = gJson?.candidates?.[0]?.content?.parts?.[0]?.text || '';
          pontosIA = txt
            .split('\n')
            .map(l => l.replace(/^[-*•\d.)\s]+/, '').trim())
            .filter(l => l.length > 12)
            .slice(0, 4);
        }
      } catch {
        // usa fallback abaixo
      }
    }

    if (pontosIA.length === 0) {
      if (saldoCaixa < 0) pontosIA.push(`Caixa consolidado negativo (${moeda(saldoCaixa)}) — priorizar plano de recomposição de fluxo de caixa.`);
      if (pagarVencido > 0) pontosIA.push(`Há ${moeda(pagarVencido)} em contas a pagar vencidas aguardando regularização ou renegociação.`);
      if (receberVencido > 0) pontosIA.push(`Existem ${moeda(receberVencido)} em recebíveis em atraso — revisar régua de cobrança com o cliente.`);
      if (certAlerta) pontosIA.push(`Certificado Digital A1 em atenção (${certStatus}) — alinhar renovação imediata.`);
      if (cndsPendencias.length > 0) pontosIA.push(`Pendência fiscal detectada em CND (${cndsPendencias.join(', ')}) — verificar parcelamento ou regularização.`);
      if (pontosIA.length === 0) {
        pontosIA.push(`Situação financeira e fiscal equilibrada (caixa em ${moeda(saldoCaixa)} e ${notasMes.length} NFS-e no mês) — foco em metas de crescimento e planejamento tributário.`);
      }
    }

    return NextResponse.json({
      ok: true,
      dados: resumoDados,
      pontosIA,
    });
  } catch (error) {
    console.error('Erro em POST /api/agenda/dossie:', error);
    return NextResponse.json({ error: 'Erro ao gerar Dossiê Pré-Reunião.' }, { status: 500 });
  }
}
