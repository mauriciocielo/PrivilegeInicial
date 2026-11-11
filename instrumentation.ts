// Captura de erros no servidor (rotas de API, SSR). Convenção do Next.js —
// register() roda uma vez quando o processo do servidor sobe.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.NEXT_PHASE === 'phase-production-build') return;

  // Inicia worker da fila de e-mails em lote a cada 65 min
  try {
    const { iniciarWorkerFilaEmail } = await import('./lib/email-queue');
    iniciarWorkerFilaEmail();
  } catch (e) {
    console.error('Falha ao iniciar worker da fila de e-mails:', e);
  }

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
