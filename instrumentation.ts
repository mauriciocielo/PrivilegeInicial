// Captura de erros no servidor (rotas de API, SSR). Convenção do Next.js —
// register() roda uma vez quando o processo do servidor sobe. Só ativa se
// SENTRY_DSN estiver definido — sem DSN, é um no-op completo.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return;

  const Sentry = await import('@sentry/nextjs');
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
  });
}
