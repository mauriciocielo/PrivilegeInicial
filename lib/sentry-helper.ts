import * as Sentry from '@sentry/nextjs';

/**
 * Envia o erro para o Sentry (se configurado — sem DSN, é um no-op). Nunca
 * lança: monitoramento de erro não pode derrubar a request que está tentando
 * reportar.
 */
export function captureError(error: unknown, extra?: Record<string, unknown>) {
  try {
    Sentry.captureException(error, extra ? { extra } : undefined);
  } catch {
    // ignora falha do próprio monitoramento
  }
}
