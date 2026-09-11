// ============================================================
// TRILHA DE AUDITORIA — toda requisição mutável da API v1
// ============================================================
// Exigência explícita do escopo: timestamp, IP, endpoint e payload de cada
// chamada que altera dado. Nunca lança — uma falha ao gravar auditoria não
// pode derrubar a requisição de negócio em si.

import db from './prisma';

function extrairIp(request: Request): string | null {
  const fwd = request.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return request.headers.get('x-real-ip');
}

export async function registrarAuditoriaApi(opts: {
  request: Request;
  empresaId?: string | null;
  apiKeyId?: string | null;
  statusCode: number;
  payload?: unknown;
  erro?: string;
}) {
  try {
    const url = new URL(opts.request.url);
    await db.apiAuditLog.create({
      data: {
        empresaId: opts.empresaId ?? null,
        keyId: opts.apiKeyId ?? null,
        metodo: opts.request.method,
        endpoint: url.pathname,
        ip: extrairIp(opts.request),
        statusCode: opts.statusCode,
        // Payload bruto para diagnóstico — truncado para não deixar o log
        // ilimitado em caso de anexo grande mandado por engano.
        payload: opts.payload ? JSON.stringify(opts.payload).slice(0, 8000) : null,
        erro: opts.erro?.slice(0, 2000) ?? null,
      },
    });
  } catch (e) {
    console.error('[api-v1-audit] Falha ao gravar trilha de auditoria (requisição prosseguiu normalmente):', e);
  }
}
