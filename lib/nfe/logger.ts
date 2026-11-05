import db from '../prisma';

export interface ParametrosLogFiscal {
  empresaId?: string | null;
  tipo: 'nfe' | 'cte' | 'nfse' | 'geral' | 'lote';
  origem?: 'cron' | 'manual';
  status: 'sucesso' | 'erro' | 'alerta';
  cStat?: string | null;
  mensagem: string;
  novas?: number;
  atualizadas?: number;
  detalhes?: string | null;
}

/**
 * Registra um log de execução no histórico de monitoramento fiscal.
 * Não lança exceção para não interromper o fluxo principal.
 */
export async function registrarLogFiscal(dados: ParametrosLogFiscal) {
  try {
    return await db.fiscalMonitorLog.create({
      data: {
        empresaId: dados.empresaId || null,
        tipo: dados.tipo,
        origem: dados.origem || 'cron',
        status: dados.status,
        cStat: dados.cStat || null,
        mensagem: dados.mensagem.slice(0, 500),
        novas: dados.novas || 0,
        atualizadas: dados.atualizadas || 0,
        detalhes: dados.detalhes ? dados.detalhes.slice(0, 4000) : null,
      },
    });
  } catch (err) {
    console.error('[FiscalMonitorLog] Falha ao registrar log:', err);
    return null;
  }
}
