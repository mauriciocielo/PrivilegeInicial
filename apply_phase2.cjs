const fs = require('fs');

// ==== PHASE 2: lib/sync-helper.ts ====
let syncHelper = fs.readFileSync('lib/sync-helper.ts', 'utf-8');

// Modify syncBackupInChunks to only send items changed after last sync
// And to gather deleted items
let newSyncHelper = syncHelper.replace(/export async function syncBackupInChunks\\([\\s\\S]*?\\)\\s*:\\s*Promise<\\{\\s*success:\\s*boolean;\\s*error\\?:\\s*string\\s*\\}>\\s*\\{/g, 
\export async function syncBackupInChunks(
  backupText: string,
  onProgress?: (message: string) => void,
  collectionsToSync?: string[]
): Promise<{ success: boolean; error?: string }> {
  const lastSyncRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('cf_last_sync_timestamp') : null;
  const lastSyncTime = lastSyncRaw ? new Date(lastSyncRaw).getTime() : 0;
\);

newSyncHelper = newSyncHelper.replace(/let items = data\\[col\\.key\\];/g, \let items = data[col.key];
      if (items && Array.isArray(items)) {
        items = items.filter(item => {
          if (!lastSyncTime) return true; // first sync, send all
          const dTime = new Date(item.updatedAt || item.createdAt || 0).getTime();
          return dTime > lastSyncTime;
        });
      }\);

newSyncHelper = newSyncHelper.replace(/return \\{ success: true \\};/g, \// Also send deletions if any
    const deletedRecordsRaw = typeof localStorage !== 'undefined' ? localStorage.getItem('cf_deleted_records') : null;
    if (deletedRecordsRaw) {
      try {
        const deletedRecords = JSON.parse(deletedRecordsRaw);
        if (Array.isArray(deletedRecords) && deletedRecords.length > 0) {
          if (onProgress) onProgress('Excluindo registros no servidor...');
          await fetch('/api/migrate-backup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ collection: 'cf_deleted_records', data: deletedRecords })
          });
          if (typeof localStorage !== 'undefined') localStorage.setItem('cf_deleted_records', '[]');
        }
      } catch (err) {
        console.error('Falha ao processar excluídos', err);
      }
    }

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('cf_last_sync_timestamp', new Date().toISOString());
    }

    return { success: true };\);

fs.writeFileSync('lib/sync-helper.ts', newSyncHelper);

// ==== PHASE 3: app/api/migrate-backup/route.ts ====
let apiRoute = fs.readFileSync('app/api/migrate-backup/route.ts', 'utf-8');

const deletionsInjection = \    // Handle Deletions
    if (collection === 'cf_deleted_records') {
      console.log('Processando exclusões: ' + data.length + ' registros');
      for (const record of data) {
        if (!record.id || !record.collection) continue;
        try {
          switch(record.collection) {
            case 'cf_empresas': await db.empresa.deleteMany({ where: { id: record.id } }); break;
            case 'cf_users': await db.user.deleteMany({ where: { id: record.id } }); break;
            case 'cf_plano_contas': await db.planoConta.deleteMany({ where: { id: record.id } }); break;
            case 'cf_portadores': await db.portador.deleteMany({ where: { id: record.id } }); break;
            case 'cf_clientes': await db.cliente.deleteMany({ where: { id: record.id } }); break;
            case 'cf_lancamentos': await db.lancamento.deleteMany({ where: { id: record.id } }); break;
            case 'cf_endividamentos': await db.endividamento.deleteMany({ where: { id: record.id } }); break;
            case 'cf_atas': await db.ataAtendimento.deleteMany({ where: { id: record.id } }); break;
            case 'cf_indicadores': await db.indicadorMensal.deleteMany({ where: { id: record.id } }); break;
            case 'cf_orcamentos': await db.orcamentoMensal.deleteMany({ where: { id: record.id } }); break;
            case 'cf_nfse': await db.nfsE.deleteMany({ where: { id: record.id } }); break;
            case 'cf_situacao_fiscal': await db.situacaoFiscal.deleteMany({ where: { id: record.id } }); break;
            case 'cf_transaction_patterns': await db.transactionPattern.deleteMany({ where: { id: record.id } }); break;
            case 'cf_atividades_log': await db.atividade.deleteMany({ where: { id: record.id } }); break;
            case 'cf_audit_logs': await db.auditLog.deleteMany({ where: { id: record.id } }); break;
            case 'cf_centros_custo': await db.centroCusto.deleteMany({ where: { id: record.id } }); break;
            case 'cf_agenda_semanal': await db.agendaTask.deleteMany({ where: { id: record.id } }); break;
            case 'cf_inteligencia_docs': await db.inteligenciaDoc.deleteMany({ where: { id: record.id } }); break;
            case 'cf_unidades': await db.unidade.deleteMany({ where: { id: record.id } }); break;
          }
        } catch(e) {
          console.error('Falha ao excluir ' + record.id, e);
        }
      }
      return NextResponse.json({ success: true, count: data.length });
    }\;

if (!apiRoute.includes('cf_deleted_records')) {
  apiRoute = apiRoute.replace(/export async function POST\\(req: Request\\) \\{(?:\\s*const \\{ collection, data \\} = await req\\.json\\(\\);)/, (match) => {
    return 'export async function POST(req: Request) {\\n  const { collection, data } = await req.json();\\n' + deletionsInjection;
  });
  
  if (!apiRoute.includes('cf_deleted_records')) {
     apiRoute = apiRoute.replace('const { collection, data } = await req.json();', 'const { collection, data } = await req.json();\\n' + deletionsInjection);
  }

  fs.writeFileSync('app/api/migrate-backup/route.ts', apiRoute);
}

console.log('Phase 2 and 3 applied successfully');
