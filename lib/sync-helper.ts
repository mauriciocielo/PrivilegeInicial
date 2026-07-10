/**
 * Utility to sync backup data to the PostgreSQL database on Railway
 * in small collection-specific chunks to avoid Netlify's 6MB request body limit
 * and 10-second serverless function execution timeout.
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
      { key: 'cf_plano_contas', label: 'Plano de Contas', chunkSize: 5 }, // ⚠️ Double-pass (upsert + hierarchy) = half the throughput, must be small
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

      if (col.key === 'cf_plano_contas') {
        // Ordena para garantir que contas pais (níveis menores)
        // sejam processadas antes de contas filhas (níveis maiores),
        // permitindo o uso seguro de loteamento (chunks).
        items = [...items].sort((a: any, b: any) => {
          const nivelA = Number(a.nivel) || 1;
          const nivelB = Number(b.nivel) || 1;
          if (nivelA !== nivelB) return nivelA - nivelB;
          return String(a.codigo || '').localeCompare(String(b.codigo || ''));
        });
      }

      const totalItems = items.length;
      const chunkSize = col.chunkSize;

      console.log(`[Sync Helper] Sincronizando ${totalItems} itens de ${col.label}...`);

      if (totalItems <= chunkSize) {
        if (onProgress) onProgress(`Sincronizando ${col.label}...`);
        const res = await fetch('/api/migrate-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            collection: col.key,
            data: items
          })
        });

        if (!res.ok) {
          const errText = await res.text();
          let parsedErr = errText;
          try { parsedErr = JSON.parse(errText).error || errText; } catch {}
          return { success: false, error: `Falha ao sincronizar ${col.label}: ${parsedErr}` };
        }
      } else {
        // Splitting into chunks
        const chunksCount = Math.ceil(totalItems / chunkSize);
        for (let i = 0; i < chunksCount; i++) {
          const start = i * chunkSize;
          const chunk = items.slice(start, start + chunkSize);
          
          if (onProgress) {
            onProgress(`Sincronizando ${col.label} (Lote ${i + 1}/${chunksCount})...`);
          }

          console.log(`[Sync Helper] Enviando lote ${i + 1}/${chunksCount} de ${col.label} (${chunk.length} itens)...`);

          const res = await fetch('/api/migrate-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              collection: col.key,
              data: chunk
            })
          });

          if (!res.ok) {
            const errText = await res.text();
            let parsedErr = errText;
            try { parsedErr = JSON.parse(errText).error || errText; } catch {}
            return { success: false, error: `Falha ao sincronizar ${col.label} no lote ${i + 1}/${chunksCount}: ${parsedErr}` };
          }
        }
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Erro na sincronização chunked:', err);
    return { success: false, error: (err as Error).message || 'Erro desconhecido.' };
  }
}
