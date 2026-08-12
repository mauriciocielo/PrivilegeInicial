/**
 * Utility to sync backup data to the PostgreSQL database on Railway
 * in small collection-specific chunks to avoid Netlify's 6MB request body limit
 * and 10-second serverless function execution timeout.
 *
 * cf_plano_contas usa uma rota dedicada e leve (/api/plano-contas/upsert) para evitar
 * Inactivity Timeout no Vercel Free (cold start da rota de 1600 linhas era muito lento).
 */

export async function syncBackupInChunks(
  backupText: string,
  onProgress?: (message: string) => void,
  collectionsToSync?: string[]
): Promise<{ success: boolean; error?: string }> {
  try {
    const parsed = JSON.parse(backupText);
    if (!parsed || typeof parsed !== 'object') {
      return { success: false, error: 'Formato de backup inválido.' };
    }

    const data = parsed.data;
    if (!data || typeof data !== 'object') {
      return { success: false, error: 'Dados do backup ausentes.' };
    }

    // Dependency order of collections to avoid foreign key violations
    const collectionsOrder = [
      { key: 'cf_empresas', label: 'Empresas', chunkSize: 25 },
      { key: 'cf_users', label: 'Usuários', chunkSize: 25 },
      { key: 'cf_unidades', label: 'Unidades', chunkSize: 25 },
      { key: 'cf_plano_contas', label: 'Plano de Contas', chunkSize: 25 }, // Alterado para 25 para evitar inumeras requisições no proxy
      { key: 'cf_portadores', label: 'Portadores', chunkSize: 25 },
      { key: 'cf_clientes', label: 'Clientes', chunkSize: 25 },
      { key: 'cf_lancamentos', label: 'Lançamentos', chunkSize: 25 },
      { key: 'cf_endividamentos', label: 'Endividamentos', chunkSize: 25 },
      { key: 'cf_atas', label: 'Atas de Atendimento', chunkSize: 25 },
      { key: 'cf_indicadores', label: 'Indicadores', chunkSize: 25 },
      { key: 'cf_orcamentos', label: 'Orçamentos', chunkSize: 25 },
      { key: 'cf_nfse', label: 'Notas Fiscais (NFS-e)', chunkSize: 25 },
      { key: 'cf_situacao_fiscal', label: 'Situação Fiscal', chunkSize: 25 },
      { key: 'cf_transaction_patterns', label: 'Padrões de Transação', chunkSize: 25 },
      { key: 'cf_atividades_log', label: 'Atividades e Tempo', chunkSize: 25 },
      { key: 'cf_audit_logs', label: 'Log de Auditoria', chunkSize: 25 },
      { key: 'cf_centros_custo', label: 'Centros de Custo', chunkSize: 25 },
      { key: 'cf_agenda_semanal', label: 'Agenda Semanal', chunkSize: 25 }
    ];

    for (const col of collectionsOrder) {
      if (collectionsToSync && !collectionsToSync.includes(col.key)) {
        continue;
      }
      let items = data[col.key];
      if (!Array.isArray(items) || items.length === 0) {
        continue;
      }
      
      // Ordenação para garantir integridade pai/filho no Plano de Contas
      if (col.key === 'cf_plano_contas') {
        items = [...items].sort((a: any, b: any) => {
          const nivelA = Number(a.nivel) || 1;
          const nivelB = Number(b.nivel) || 1;
          if (nivelA !== nivelB) return nivelA - nivelB;
          return String(a.codigo || '').localeCompare(String(b.codigo || ''));
        });
      }

      // ── Envio em chunks ─────────────
      const totalItems = items.length;
      const chunkSize = col.chunkSize;
      console.log(`[Sync Helper] Sincronizando ${totalItems} itens de ${col.label}...`);

      const chunksCount = Math.ceil(totalItems / chunkSize);
      for (let i = 0; i < chunksCount; i++) {
        const start = i * chunkSize;
        const chunk = items.slice(start, start + chunkSize);

        if (onProgress) {
          onProgress(chunksCount === 1
            ? `Sincronizando ${col.label}...`
            : `Sincronizando ${col.label} (Lote ${i + 1}/${chunksCount})...`
          );
        }

        console.log(`[Sync Helper] Enviando lote ${i + 1}/${chunksCount} de ${col.label} (${chunk.length} itens)...`);

        const MAX_RETRIES = 2;
        let lastErr: string | undefined;
        for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
          const res = await fetch('/api/migrate-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: col.key, data: chunk })
          });

          if (res.ok) { lastErr = undefined; break; }

          const errText = await res.text();
          let parsedErr = errText;
          try { parsedErr = JSON.parse(errText).error || errText; } catch {}
          lastErr = `Falha ao sincronizar ${col.label} no lote ${i + 1}/${chunksCount}: ${parsedErr}`;
          if (attempt < MAX_RETRIES) {
            console.warn(`Tentativa ${attempt} falhou para ${col.label} lote ${i + 1}. Retentando em 1s...`);
            await new Promise(r => setTimeout(r, 1000));
          }
        }
        if (lastErr) return { success: false, error: lastErr };
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Erro na sincronização chunked:', err);
    return { success: false, error: (err as Error).message || 'Erro desconhecido.' };
  }
}
