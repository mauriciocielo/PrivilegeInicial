const fs = require('fs');
let content = fs.readFileSync('lib/store.ts', 'utf-8');

// 1. Add updatedAt to interfaces
content = content.replace(/export interface ([^{]+)\{([^}]+)\}/g, (match, name, body) => {
  if (name.trim() === 'NfsE' || body.includes('updatedAt')) return match;
  return 'export interface ' + name + '{' + body.replace(/\n\}$/, '\n  updatedAt?: string;\n}') + '}';
});

// 2. Add DeletedRecord system to DataStore class
if (!content.includes('getDeletedRecords')) {
  const injection = 'export interface DeletedRecord { id: string; collection: string; deletedAt: string; }\n\nclass DataStore {\n  getDeletedRecords(): DeletedRecord[] {\n    this.init();\n    return this.get<DeletedRecord[]>("cf_deleted_records", []);\n  }\n\n  addDeletedRecord(id: string, collection: string) {\n    if(!id) return;\n    const records = this.getDeletedRecords();\n    records.push({ id, collection, deletedAt: new Date().toISOString() });\n    this.set("cf_deleted_records", records);\n  }\n\n  clearDeletedRecords() {\n    this.set("cf_deleted_records", []);\n  }\n';
  content = content.replace(/class DataStore \{/, injection);
}

// 3. Inject updatedAt = new Date() into save functions
content = content.replace(/save([A-Za-z0-9_]+)\(([^:,]+):\s*([a-zA-Z0-9_\[\]]+)\)\s*\{/g, (match, methodName, argName, typeName) => {
  if (typeName.includes('[]')) {
    return match + '\n    if (Array.isArray(' + argName + ')) ' + argName + '.forEach(i => i.updatedAt = new Date().toISOString());';
  } else {
    return match + '\n    if (' + argName + ' && typeof ' + argName + ' === "object") ' + argName + '.updatedAt = new Date().toISOString();';
  }
});

// 4. Hook delete functions to record deleted items
content = content.replace(/delete([A-Za-z0-9_]+)\(id:\s*string\)\s*\{([^}]+)this\.set\('([^']+)'/g, (match, methodName, body, collectionKey) => {
  if (body.includes('addDeletedRecord')) return match; 
  return 'delete' + methodName + '(id: string) {' + body + 'this.addDeletedRecord(id, "' + collectionKey + '");\n    this.set("' + collectionKey + '"';
});

content = content.replace(/deleteLancamento\(id: string\)\s*\{/g, 'deleteLancamento(id: string) {\n    this.addDeletedRecord(id, "cf_lancamentos");');

fs.writeFileSync('lib/store.ts', content);
console.log('Phase 1 applied over clean file');
