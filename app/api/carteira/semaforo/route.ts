import { NextResponse } from 'next/server';
import db from '../../../../lib/prisma';
import { requireAuth } from '../../../../lib/api-auth';
import { TIPO_EMPRESA_SO_EMISSOR } from '../../../../lib/nfse/emissor';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const auth = await requireAuth(request);
    if (auth.error) return auth.error;
    if (auth.session.role === 'cliente') {
      return NextResponse.json({ error: 'Acesso restrito a consultores e administradores.' }, { status: 403 });
    }

    const isAdmin = auth.session.role === 'administrador';
    const empresas = await db.empresa.findMany({
      where: {
        tipo: { not: TIPO_EMPRESA_SO_EMISSOR },
        id: isAdmin ? { not: 'empresa_default' } : { in: auth.session.empresaIds },
      },
      select: {
        id: true,
        razaoSocial: true,
        nomeFantasia: true,
        cnpj: true,
        responsavel: true,
        telefone: true,
      },
      orderBy: { razaoSocial: 'asc' },
    });

    const empIds = empresas.map(e => e.id);
    const hoje = new Date(Date.now() - 3 * 3600 * 1000).toISOString().slice(0, 10);
    const agoraMs = Date.now();

    const [portadores, lancamentos, configs, certidoes, tarefas] = await Promise.all([
      db.portador.findMany({ where: { empresaId: { in: empIds }, ativo: true }, select: { id: true, empresaId: true, saldoInicial: true, saldoInicialData: true } }),
      db.lancamento.findMany({ where: { empresaId: { in: empIds } }, select: { empresaId: true, portadorId: true, tipo: true, valor: true, status: true, data: true } }),
      db.nfseConfig.findMany({ where: { empresaId: { in: empIds } }, select: { empresaId: true, usarProcuracao: true, certValidoAte: true } }),
      db.certidaoFiscal.findMany({ where: { empresaId: { in: empIds }, situacao: 'POSITIVA' }, select: { empresaId: true, tipo: true } }),
      db.agendaTask.findMany({ where: { empresaId: { in: empIds } }, select: { empresaId: true, dateStr: true }, orderBy: { dateStr: 'desc' } }),
    ]);

    const configMap = new Map(configs.map(c => [c.empresaId, c]));
    const cndMap = new Map<string, string[]>();
    for (const c of certidoes) {
      const arr = cndMap.get(c.empresaId) || [];
      if (!arr.includes(c.tipo)) arr.push(c.tipo);
      cndMap.set(c.empresaId, arr);
    }

    const ultimaReuniaoMap = new Map<string, string>();
    for (const t of tarefas) {
      if (!ultimaReuniaoMap.has(t.empresaId)) {
        ultimaReuniaoMap.set(t.empresaId, t.dateStr);
      }
    }

    const carteira = empresas.map(emp => {
      const ports = portadores.filter(p => p.empresaId === emp.id);
      const lancsEmp = lancamentos.filter(l => l.empresaId === emp.id);

      let saldoCaixa = 0;
      for (const p of ports) {
        const inicio = p.saldoInicialData || '1970-01-01';
        const doPort = lancsEmp.filter(l => l.portadorId === p.id && l.status === 'realizado' && l.data >= inicio);
        const rec = doPort.filter(l => l.tipo === 'receita').reduce((s, l) => s + l.valor, 0);
        const desp = doPort.filter(l => l.tipo === 'despesa').reduce((s, l) => s + l.valor, 0);
        saldoCaixa += (p.saldoInicial || 0) + rec - desp;
      }

      const vencidosPagar = lancsEmp.filter(l => l.status === 'previsto' && l.tipo === 'despesa' && l.data < hoje);
      const totalVencidoPagar = vencidosPagar.reduce((s, l) => s + l.valor, 0);

      const cfg = configMap.get(emp.id);
      let certDias: number | null = null;
      if (cfg && !cfg.usarProcuracao && cfg.certValidoAte) {
        certDias = Math.ceil((cfg.certValidoAte.getTime() - agoraMs) / 86400000);
      }

      const cndsPositivas = cndMap.get(emp.id) || [];
      const ultimaReuniao = ultimaReuniaoMap.get(emp.id) || null;
      const diasSemReuniao = ultimaReuniao
        ? Math.floor((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${ultimaReuniao}T12:00:00Z`)) / 86400000)
        : 999;

      const motivos: string[] = [];
      let pontosRisco = 0;

      if (saldoCaixa < 0) {
        motivos.push(`Caixa negativo (${saldoCaixa.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})`);
        pontosRisco += 35;
      }
      if (totalVencidoPagar > 0) {
        motivos.push(`${vencidosPagar.length} conta(s) a pagar vencida(s)`);
        pontosRisco += 25;
      }
      if (certDias !== null && certDias < 0) {
        motivos.push('Certificado A1 VENCIDO');
        pontosRisco += 40;
      } else if (certDias !== null && certDias <= 30) {
        motivos.push(`Certificado A1 vence em ${certDias}d`);
        pontosRisco += 20;
      }
      if (cndsPositivas.length > 0) {
        motivos.push(`CND com pendência (${cndsPositivas.join(', ')})`);
        pontosRisco += 30;
      }
      if (diasSemReuniao >= 45) {
        motivos.push(ultimaReuniao ? `${diasSemReuniao} dias sem reunião na Agenda` : 'Sem reunião registrada na Agenda');
        pontosRisco += 15;
      }

      const semaforo: 'vermelho' | 'amarelo' | 'verde' =
        pontosRisco >= 40 ? 'vermelho' : pontosRisco >= 15 ? 'amarelo' : 'verde';

      return {
        empresaId: emp.id,
        nome: emp.nomeFantasia || emp.razaoSocial,
        cnpj: emp.cnpj,
        responsavel: emp.responsavel,
        telefone: emp.telefone,
        saldoCaixa,
        totalVencidoPagar,
        qtdVencidoPagar: vencidosPagar.length,
        certDias,
        cndsPositivas,
        ultimaReuniao,
        diasSemReuniao: ultimaReuniao ? Math.max(0, diasSemReuniao) : null,
        semaforo,
        scoreSaude: Math.max(0, 100 - pontosRisco),
        motivos,
      };
    });

    carteira.sort((a, b) => a.scoreSaude - b.scoreSaude);

    return NextResponse.json({
      totais: {
        total: carteira.length,
        vermelho: carteira.filter(c => c.semaforo === 'vermelho').length,
        amarelo: carteira.filter(c => c.semaforo === 'amarelo').length,
        verde: carteira.filter(c => c.semaforo === 'verde').length,
      },
      carteira,
    });
  } catch (error) {
    console.error('Erro em GET /api/carteira/semaforo:', error);
    return NextResponse.json({ error: 'Erro ao calcular Semáforo da Carteira.' }, { status: 500 });
  }
}
