const fs = require('fs');
let content = fs.readFileSync('lib/store.ts', 'utf-8');

// Add updatedAt?: string; to all interfaces except those who already have it
content = content.replace(/export interface ([^{]+)\{([^}]+)\}/g, (match, name, body) => {
  if (name.trim() === 'NfsE' || body.includes('updatedAt')) return match;
  return 'export interface ' + name + '{' + body.replace(/\n\}$/, '\n  updatedAt?: string;\n}') + '}';
});

// Add the deleted records code at the start of DataStore class
const injection = 
export interface DeletedRecord { id: string; collection: string; deletedAt: string; }

class DataStore {
  getDeletedRecords(): DeletedRecord[] {
    this.init();
    return this.get<DeletedRecord[]>('cf_deleted_records', []);
  }

  addDeletedRecord(id: string, collection: string) {
    if(!id) return;
    const records = this.getDeletedRecords();
    records.push({ id, collection, deletedAt: new Date().toISOString() });
    this.set('cf_deleted_records', records);
  }

  clearDeletedRecords() {
    this.set('cf_deleted_records', []);
  }
;
content = content.replace(/class DataStore \{/, injection);

// Let's hook the save functions to add updatedAt
// A function usually looks like saveOcorrencia(ocorrencia: Ocorrencia) {
// I can just replace 	his.set('cf_ or similar, but the safest is to modify the objects before saving.
// I'll do this in a later step manually.

fs.writeFileSync('lib/store.ts', content);
console.log('Script finalizado');
