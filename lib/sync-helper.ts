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
      { key: 'cf_plano_contas', label: 'Plano de Contas', chunkSize: 1 }, // Rota dedicada: /api/plano-contas/upsert (1 por vez)
      { key: 'cf_portadores', label: 'Portadores', chunkSize: 25 },
      { key: 'cf_clientes', label: 'Clientes', chunkSize: 25 },
      { key: 'cf_lancamentos', label: 'Lançamentos', chunkSize: 25 },
      { key: 'cf_endividamentos', label: 'Endividamentos', chunkSize: 25 },
      { key: 'cf_atas', label: 'Atas de Atendimento', chunkSize: 25 },
      { key: 'cf_indicadores', label: 'Indicadores', chunkSize: 25 },
      { key: 'cf_orcamentos', label: 'Orçamentos', chunkSize: 25 },
      { key: 'cf_nfse', label: 'Notas Fiscais (NFS-e)', chunkSize: 25 },
      { key: 'cf_situacao_fiscal', label: 'Situação Fiscal', chunkSize: 25 },
      { key: 'cf_transaction_patterns', label: 'Padrões de Transação', chunkSize: 25 }
    ];

    for (const col of collectionsOrder) {
      if (collectionsToSync && !collectionsToSync.includes(col.key)) {
        continue;
      }
      let items = data[col.key];
      if (!Array.isArray(items) || items.length === 0) {
        continue;
      }

      // ── Plano de Contas: rota dedicada, 1 item por vez ──────────────────────
      if (col.key === 'cf_plano_contas') {
        // Ordena para garantir que pais (nível menor) sejam criados antes dos filhos
        items = [...items].sort((a: any, b: any) => {
          const nivelA = Number(a.nivel) || 1;
          const nivelB = Number(b.nivel) || 1;
          if (nivelA !== nivelB) return nivelA - nivelB;
          return String(a.codigo || '').localeCompare(String(b.codigo || ''));
        });

        const total = items.length;
        for (let i = 0; i < total; i++) {
          const item = items[i];
          if (onProgress) onProgress(`Plano de Contas (${i + 1}/${total})...`);

          const MAX_RETRIES = 3;
          let lastErr: string | undefined;
          for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
            try {
              const res = await fetch('/api/plano-contas/upsert', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(item)
              });
              if (res.ok) { lastErr = undefined; break; }
              const errText = await res.text();
              let parsedErr = errText;
              try { parsedErr = JSON.parse(errText).error || errText; } catch {}
              lastErr = `Erro ao salvar conta ${item.codigo || item.id}: ${parsedErr}`;
            } catch (fetchErr: any) {
              lastErr = `Falha de rede (tentativa ${attempt}): ${fetchErr.message}`;
            }
            if (attempt < MAX_RETRIES) {
              console.warn(`Tentativa ${attempt} falhou para PlanoConta ${item.id}. Retentando em 1s...`);
              await new Promise(r => setTimeout(r, 1000));
            }
          }
          if (lastErr) {
            // Não interrompe toda a migração por um item — apenas loga e continua
            console.error('Falha definitiva no PlanoConta (ignorando):', lastErr);
          }
        }
        continue; // passa para a próxima coleção
      }

      // ── Todas as outras coleções: /api/migrate-backup em chunks ─────────────
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
