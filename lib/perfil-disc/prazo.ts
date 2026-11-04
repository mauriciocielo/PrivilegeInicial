// ============================================================
// PERFIL COMPORTAMENTAL — validade do link
// ============================================================

export const HORAS_VALIDADE_LINK = 24;

const HORA_MS = 60 * 60 * 1000;
// Quem começou dentro do prazo não perde as respostas por estar no meio do formulário.
const TOLERANCIA_INICIADO_MS = HORA_MS;

export function fimDoPrazo(createdAt: Date): Date {
  return new Date(createdAt.getTime() + HORAS_VALIDADE_LINK * HORA_MS);
}

export function linkExpirado(
  avaliacao: { createdAt: Date; iniciadoEm: Date | null },
  agora: Date = new Date(),
): boolean {
  const limite = fimDoPrazo(avaliacao.createdAt).getTime();
  return agora.getTime() > limite + (avaliacao.iniciadoEm ? TOLERANCIA_INICIADO_MS : 0);
}
