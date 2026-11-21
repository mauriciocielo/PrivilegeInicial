import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { listCampaigns } from '../../../../lib/campaign-manager';

export const dynamic = 'force-dynamic';

export interface PrioridadeBriefing {
  titulo: string;
  detalhe: string;
  tom: 'critico' | 'atencao' | 'positivo' | 'info';
  href: string;
  acaoLabel: string;
}

export interface BriefingDiaPayload {
  data: string;
  saudacao: string;
  resumoExecutivo: string;
  prioridades: PrioridadeBriefing[];
  dicaEstrategica: string;
  fonte: 'ia' | 'sistema';
  metricas: {
    compromissosHoje: number;
    crVencidas: number;
    cpVencidas: number;
    nfseMes: number;
    nfseErros: number;
    certsAlerta: number;
    campanhasAtivas: number;
  };
}

function saudacaoHorario(nome: string): string {
  const horaStr = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    hour: '2-digit',
    hour12: false,
  }).format(new Date());
  const hora = Number(horaStr) || 9;
  const primeiro = (nome || '').trim().split(/\s+/)[0] || '';
  const base = hora < 12 ? 'Bom dia' : hora < 18 ? 'Boa tarde' : 'Boa noite';
  return primeiro ? `${base}, ${primeiro}!` : `${base}!`;
}

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const empresaId = (searchParams.get('empresaId') || '').trim();
    const role = (auth.session.role || '').toLowerCase();
    const isCliente = role === 'cliente';
    const prefixo = isCliente ? '/cliente' : '/consultor';

    const agora = new Date();
    const hojeIso = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora);
    const mesAtual = hojeIso.slice(0, 7);
    const em30Dias = new Date(agora.getTime() + 30 * 24 * 60 * 60 * 1000);

    const user = await db.user
      .findUnique({ where: { id: auth.session.userId }, select: { name: true } })
      .catch(() => null);
    const empresa = empresaId && !empresaId.startsWith('grupo:')
      ? await db.empresa
          .findUnique({ where: { id: empresaId }, select: { nomeFantasia: true, razaoSocial: true } })
          .catch(() => null)
      : null;

    const empresaNome = empresa?.nomeFantasia || empresa?.razaoSocial || 'sua operação';
    const filtroEmp = empresaId && !empresaId.startsWith('grupo:') ? { empresaId } : {};

    // Coleta paralela de métricas reais do dia
    const [
      compromissosHoje,
      crVencidas,
      cpVencidas,
      nfseMes,
      nfseErros,
      certsAlerta,
      campanhasAtivas,
    ] = await Promise.all([
      db.agendaTask.findMany({
        where: { dateStr: hojeIso, completed: false, ...(isCliente ? filtroEmp : {}) },
        select: { title: true, horario: true },
        orderBy: { horario: 'asc' },
        take: 5,
      }).catch(() => []),
      empresaId && !empresaId.startsWith('grupo:')
        ? db.contaReceber.count({ where: { empresaId, status: 'aberto', dataVencimento: { lt: hojeIso } } }).catch(() => 0)
        : Promise.resolve(0),
      empresaId && !empresaId.startsWith('grupo:')
        ? db.contaPagar.count({ where: { empresaId, status: 'aberto', dataVencimento: { lt: hojeIso } } }).catch(() => 0)
        : Promise.resolve(0),
      db.nfsE.count({ where: { ...filtroEmp, status: 'emitida', dataCompetencia: mesAtual } }).catch(() => 0),
      db.nfsE.count({ where: { ...filtroEmp, status: 'rascunho', ultimoErro: { not: null } } }).catch(() => 0),
      !isCliente
        ? db.nfseConfig.count({ where: { usarProcuracao: false, certValidoAte: { lte: em30Dias } } }).catch(() => 0)
        : Promise.resolve(0),
      !isCliente
        ? listCampaigns().then(cs => cs.filter(c => c.status === 'em_andamento').length).catch(() => 0)
        : Promise.resolve(0),
    ]);

    const metricas = {
      compromissosHoje: compromissosHoje.length,
      crVencidas,
      cpVencidas,
      nfseMes,
      nfseErros,
      certsAlerta,
      campanhasAtivas,
    };

    // Monta prioridades determinísticas reais (base para fallback e validação)
    const prioridadesBase: PrioridadeBriefing[] = [];
    if (nfseErros > 0) {
      prioridadesBase.push({
        titulo: `${nfseErros} NFS-e com erro de transmissão`,
        detalhe: 'Há rascunhos rejeitados pelo Sefin aguardando ajuste rápido para emissão.',
        tom: 'critico',
        href: `${prefixo}/nfse`,
        acaoLabel: 'Corrigir NFS-e',
      });
    }
    if (crVencidas > 0 || cpVencidas > 0) {
      prioridadesBase.push({
        titulo: `${crVencidas} a receber e ${cpVencidas} a pagar em atraso`,
        detalhe: `Revise os títulos vencidos de ${empresaNome} para proteger o fluxo de caixa.`,
        tom: 'atencao',
        href: crVencidas > 0 ? `${prefixo}/lancamentos` : `${prefixo}/lancamentos`,
        acaoLabel: 'Ver financeiro',
      });
    }
    if (compromissosHoje.length > 0) {
      const prox = compromissosHoje[0];
      prioridadesBase.push({
        titulo: `${compromissosHoje.length} compromisso(s) na agenda hoje`,
        detalhe: `Próximo: ${prox.horario || ''} — ${prox.title}`.trim(),
        tom: 'info',
        href: `${prefixo}/agenda`,
        acaoLabel: 'Abrir agenda',
      });
    }
    if (!isCliente && certsAlerta > 0) {
      prioridadesBase.push({
        titulo: `${certsAlerta} certificado(s) A1 próximo(s) do vencimento`,
        detalhe: 'Renove com antecedência para não interromper emissões fiscais.',
        tom: 'atencao',
        href: '/consultor/configuracoes-avancadas',
        acaoLabel: 'Ver Monitor 24h',
      });
    }
    if (prioridadesBase.length === 0) {
      prioridadesBase.push({
        titulo: 'Operação em dia hoje',
        detalhe: `${nfseMes} NFS-e emitida(s) no mês atual em ${empresaNome}, sem pendências críticas registradas.`,
        tom: 'positivo',
        href: `${prefixo}/nfse`,
        acaoLabel: 'Abrir NFS-e',
      });
    }

    const saudacao = saudacaoHorario(user?.name || '');
    let resumoExecutivo =
      prioridadesBase.some(p => p.tom === 'critico' || p.tom === 'atencao')
        ? `Hoje há pontos de atenção em ${empresaNome} que valem revisão logo no início do expediente para manter o caixa e o fiscal sob controle.`
        : `Cenário tranquilo em ${empresaNome} hoje: ${nfseMes} NFS-e emitida(s) no mês e nenhuma pendência crítica aberta.`;
    let dicaEstrategica = isCliente
      ? 'Acompanhe o saldo previsto dos próximos 7 dias e mantenha suas notas fiscais emitidas assim que concluir cada serviço para acelerar o recebimento.'
      : 'Use o atalho Ctrl+K para navegar rápido entre empresas e acompanhe os lotes 24h pelo sininho de alertas no topo.';
    let fonte: 'ia' | 'sistema' = 'sistema';

    // Enriquece com Gemini no servidor se a chave estiver disponível
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (apiKey) {
      try {
        const prompt = `Você é o consultor executivo de IA da Privilege Contabilidade e Consultoria.
Gere um briefing matinal MUITO curto, natural, direto e útil em Português do Brasil para ${isCliente ? 'o empresário cliente' : 'o consultor/gestor'} (${user?.name || 'Usuário'}) sobre "${empresaNome}" hoje (${hojeIso}).

DADOS REAIS DE HOJE:
- Compromissos hoje na agenda: ${compromissosHoje.length} (${compromissosHoje.map(c => `${c.horario} ${c.title}`).join('; ') || 'nenhum'})
- Contas a receber vencidas: ${crVencidas}
- Contas a pagar vencidas: ${cpVencidas}
- NFS-e emitidas no mês: ${nfseMes}
- NFS-e com erro de transmissão: ${nfseErros}
- Certificados A1 vencendo/vencidos: ${certsAlerta}
- Campanhas WhatsApp 24h ativas: ${campanhasAtivas}

Retorne APENAS um JSON válido sem markdown:
{
  "resumoExecutivo": "1 frase executiva objetiva (máx. 170 caracteres) resumindo o foco do dia com os números reais.",
  "dicaEstrategica": "1 dica prática e acionável (máx. 160 caracteres) de gestão financeira/fiscal/comercial para hoje."
}`;

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 6500);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.4 },
            }),
          }
        );
        clearTimeout(timer);

        if (res.ok) {
          const data = await res.json();
          const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (raw) {
            const parsed = JSON.parse(raw.trim());
            if (typeof parsed.resumoExecutivo === 'string' && parsed.resumoExecutivo.trim()) {
              resumoExecutivo = parsed.resumoExecutivo.trim();
              fonte = 'ia';
            }
            if (typeof parsed.dicaEstrategica === 'string' && parsed.dicaEstrategica.trim()) {
              dicaEstrategica = parsed.dicaEstrategica.trim();
            }
          }
        }
      } catch {
        // mantém fallback determinístico sem erro
      }
    }

    const payload: BriefingDiaPayload = {
      data: hojeIso,
      saudacao,
      resumoExecutivo,
      prioridades: prioridadesBase.slice(0, 3),
      dicaEstrategica,
      fonte,
      metricas,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('Erro em GET /api/ai/briefing-dia:', error);
    return NextResponse.json({ error: 'Falha ao gerar briefing do dia.' }, { status: 500 });
  }
}
