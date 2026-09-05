/**
 * Fonte única de verdade sobre quais coleções sincronizam com o Postgres.
 *
 * Antes desta lista existir, cada parte do pipeline de sincronização mantinha
 * sua própria lista de coleções à mão (o gatilho de auto-salvamento, o envio em
 * lotes, o backup completo, o mapeamento de rota→coleção para polling). Bastava
 * uma pessoa esquecer de atualizar UMA dessas listas para uma coleção inteira
 * ficar presa só no navegador de quem a criou, sem nunca alcançar o banco —
 * foi exatamente o que aconteceu com Atividades, Log de Auditoria, Centros de
 * Custo, Agenda Semanal e Documentos de Inteligência.
 *
 * Agora: para adicionar uma nova coleção sincronizável, basta um item aqui —
 * (mais a implementação de fato no servidor, ver app/api/migrate-backup/route.ts,
 * que valida em tempo de execução se cada chave daqui tem migrator/query
 * correspondente e avisa alto se não tiver).
 */

export interface SyncCollectionConfig {
  /** Chave usada no localStorage e no corpo das requisições (ex: 'cf_empresas'). */
  key: string;
  /** Nome amigável usado em logs/mensagens de progresso. */
  label: string;
  /** Tamanho do lote ao enviar para o servidor. */
  chunkSize: number;
  /**
   * Se true, editar esta coleção dispara o envio automático debounced (~1s)
   * para o servidor. cf_lancamentos é o único caso com autoSync=false: tem seu
   * próprio caminho de tempo real mais granular (IndexedDB + eventos WebSocket
   * por item + polling leve por timestamp) em vez do lote genérico — mas ainda
   * usa este mesmo registro para saber como ser enviado quando necessário
   * (backup completo, inicialização de banco vazio, etc).
   */
  autoSync: boolean;
  /**
   * Trechos de rota que, quando presentes no pathname atual, indicam que esta
   * é a coleção "ativa" da página — usado pelo polling de fallback em tempo
   * real. Uma coleção sem pagePaths simplesmente não tem fallback de polling
   * dedicado (ainda recebe atualizações via WebSocket).
   */
  pagePaths?: string[];
}

export const SYNC_COLLECTIONS: SyncCollectionConfig[] = [
  { key: 'cf_empresas', label: 'Empresas', chunkSize: 25, autoSync: true, pagePaths: ['/empresas'] },
  { key: 'cf_users', label: 'Usuários', chunkSize: 25, autoSync: true, pagePaths: ['/usuarios'] },
  { key: 'cf_unidades', label: 'Unidades', chunkSize: 25, autoSync: true },
  { key: 'cf_plano_contas', label: 'Plano de Contas', chunkSize: 25, autoSync: true, pagePaths: ['/plano-de-contas'] },
  { key: 'cf_portadores', label: 'Portadores', chunkSize: 25, autoSync: true, pagePaths: ['/portadores'] },
  { key: 'cf_clientes', label: 'Clientes', chunkSize: 25, autoSync: true, pagePaths: ['/clientes'] },
  { key: 'cf_lancamentos', label: 'Lançamentos', chunkSize: 25, autoSync: false, pagePaths: ['/lancamentos'] },
  { key: 'cf_endividamentos', label: 'Endividamentos', chunkSize: 25, autoSync: true, pagePaths: ['/endividamento'] },
  { key: 'cf_atas', label: 'Atas de Atendimento', chunkSize: 25, autoSync: true, pagePaths: ['/atas'] },
  { key: 'cf_indicadores', label: 'Indicadores', chunkSize: 25, autoSync: true, pagePaths: ['/indicadores'] },
  { key: 'cf_orcamentos', label: 'Orçamentos', chunkSize: 25, autoSync: true, pagePaths: ['/orcamento'] },
  { key: 'cf_contas_balanco', label: 'Contas do Balanço Patrimonial', chunkSize: 25, autoSync: true, pagePaths: ['/balanco-patrimonial'] },
  { key: 'cf_balancos_patrimoniais', label: 'Balanços Patrimoniais', chunkSize: 25, autoSync: true, pagePaths: ['/balanco-patrimonial'] },
  { key: 'cf_diagnosticos_360', label: 'Diagnósticos 360º', chunkSize: 10, autoSync: true, pagePaths: ['/diagnostico-360'] },
  { key: 'cf_curva_abc_config', label: 'Configuração Curva ABC', chunkSize: 25, autoSync: true, pagePaths: ['/curva-abc'] },
  { key: 'cf_curvas_abc', label: 'Curvas ABC', chunkSize: 10, autoSync: true, pagePaths: ['/curva-abc'] },
  { key: 'cf_nfse', label: 'Notas Fiscais (NFS-e)', chunkSize: 25, autoSync: true, pagePaths: ['/nfse'] },
  { key: 'cf_situacao_fiscal', label: 'Situação Fiscal', chunkSize: 25, autoSync: true },
  { key: 'cf_transaction_patterns', label: 'Padrões de Transação', chunkSize: 25, autoSync: true },
  { key: 'cf_atividades_log', label: 'Atividades e Tempo', chunkSize: 25, autoSync: true },
  { key: 'cf_audit_logs', label: 'Log de Auditoria', chunkSize: 25, autoSync: true, pagePaths: ['/administrativo', '/configuracoes-avancadas'] },
  { key: 'cf_centros_custo', label: 'Centros de Custo', chunkSize: 25, autoSync: true, pagePaths: ['/centros-custo'] },
  { key: 'cf_agenda_semanal', label: 'Agenda Semanal', chunkSize: 25, autoSync: true, pagePaths: ['/agenda'] },
  { key: 'cf_inteligencia_docs', label: 'Documentos de Inteligência', chunkSize: 10, autoSync: true },
];

export const SYNC_COLLECTION_KEYS = SYNC_COLLECTIONS.map(c => c.key);

export function getCollectionForPath(path: string): string | null {
  for (const col of SYNC_COLLECTIONS) {
    if (col.pagePaths?.some(p => path.includes(p))) return col.key;
  }
  return null;
}
