const fs = require('fs');
let content = fs.readFileSync('lib/store.ts', 'utf-8');

content = content.replace(/export interface ([^{]+)\{([^}]+)\}/g, (match, name, body) => {
  if (name.trim() === 'NfsE' || body.includes('updatedAt?: string;')) return match;
  return 'export interface ' + name + '{' + body.replace(/\n\}$/, '\n  updatedAt?: string;\n}') + '}';
});

const injection = 'export interface DeletedRecord { id: string; collection: string; deletedAt: string; }\\n\\nclass DataStore {\\n  getDeletedRecords(): DeletedRecord[] {\\n    this.init();\\n    return this.get<DeletedRecord[]>(\'cf_deleted_records\', []);\\n  }\\n\\n  addDeletedRecord(id: string, collection: string) {\\n    if(!id) return;\\n    const records = this.getDeletedRecords();\\n    records.push({ id, collection, deletedAt: new Date().toISOString() });\\n    this.set(\'cf_deleted_records\', records);\\n  }\\n\\n  clearDeletedRecords() {\\n    this.set(\'cf_deleted_records\', []);\\n  }\\n';

content = content.replace(/class DataStore \{/, injection);
fs.writeFileSync('lib/store.ts', content);
console.log('Done!');
