// scripts/adjust-ruaro-plan.ts
// Execute with: npx ts-node scripts/adjust-ruaro-plan.ts

import db from '../lib/prisma';
import { DEFAULT_PLANO_CONTAS } from '../lib/store';

(async () => {
  try {
    // Find empresa Ruaro (match by razaoSocial or nomeFantasia containing 'ruaro')
    const empresa = await db.empresa.findFirst({
      where: {
        OR: [
          { razaoSocial: { contains: 'ruaro', mode: 'insensitive' } },
          { nomeFantasia: { contains: 'ruaro', mode: 'insensitive' } }
        ]
      }
    });

    if (!empresa) {
      console.log('Empresa "ruaro" não encontrada.');
      return;
    }
    const empId = empresa.id;
    console.log(`Empresa ruaro encontrada: ${empId}`);

    // Remove plano de conta auto‑criado (código 999) para esta empresa
    const deleted = await db.planoConta.deleteMany({
      where: { empresaId: empId, codigo: '999' }
    });
    console.log(`Planos de conta auto‑criados removidos: ${deleted.count}`);

    // Inserir plano de contas padrão (adaptado) para a empresa
    const newPlans = DEFAULT_PLANO_CONTAS.map(p => ({
      ...p,
      id: `pc_${empId}_${p.id}`,
      empresaId: empId,
      // Ajuste opcional da descrição para ruaro
      descricao: p.descricao + ' (Ruaro)'
    }));

    for (const pc of newPlans) {
      await db.planoConta.upsert({
        where: { id: pc.id },
        update: pc,
        create: pc,
      });
    }
    console.log(`Planos de conta padrão importados (${newPlans.length} itens) para empresa ruaro.`);
  } catch (err) {
    console.error('Erro ao ajustar plano de contas:', err);
  } finally {
    await db.$disconnect();
  }
})();
