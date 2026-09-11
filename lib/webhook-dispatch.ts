// ============================================================
// DISPARO DE WEBHOOK — notifica o ERP do cliente quando uma CR/CP muda
// ============================================================
// Best-effort e síncrono (sem fila/retry em background — não há
// infraestrutura de worker neste projeto). Cada tentativa fica registrada em
// WebhookDelivery para diagnóstico e reenvio manual; uma falha de entrega
// nunca deve derrubar a requisição que a originou.

import crypto from 'crypto';
import db from './prisma';

export type WebhookEvento = 'conta_receber.liquidada' | 'conta_receber.conciliada' | 'conta_pagar.liquidada';

export async function dispararWebhook(empresaId: string, evento: WebhookEvento, payload: Record<string, unknown>) {
  const assinaturas = await db.webhookSubscription.findMany({
    where: { empresaId, ativo: true, eventos: { has: evento } },
  }).catch(() => []);

  for (const sub of assinaturas) {
    const corpo = JSON.stringify({ evento, dados: payload, enviadoEm: new Date().toISOString() });
    // HMAC-SHA256 do corpo com o segredo da assinatura — é assim que o ERP do
    // cliente confirma que o webhook realmente veio do BPO, não de terceiro.
    const assinatura = crypto.createHmac('sha256', sub.segredo).update(corpo).digest('hex');

    let statusCode: number | null = null;
    let sucesso = false;
    try {
      const res = await fetch(sub.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Webhook-Signature': assinatura },
        body: corpo,
        signal: AbortSignal.timeout(8000),
      });
      statusCode = res.status;
      sucesso = res.ok;
    } catch {
      sucesso = false;
    }

    await db.webhookDelivery.create({
      data: { subscriptionId: sub.id, evento, payload: corpo, statusCode, sucesso, tentativas: 1 },
    }).catch(() => {});
  }
}
