const fs = require('fs');
let content = fs.readFileSync('lib/store.ts', 'utf-8');

content = content.replace(/save([A-Za-z0-9_]+)\(([^:,]+):\s*([a-zA-Z0-9_\\[\\]]+)\)\s*\{/g, (match, methodName, argName, typeName) => {
  if (typeName.includes('[]')) {
    return match + '\n    if (Array.isArray(' + argName + ')) ' + argName + '.forEach(i => i.updatedAt = new Date().toISOString());';
  } else {
    return match + '\n    if (' + argName + ' && typeof ' + argName + ' === String.fromCharCode(111,98,106,101,99,116)) ' + argName + '.updatedAt = new Date().toISOString();';
  }
});

content = content.replace(/delete([A-Za-z0-9_]+)\(id:\s*string\)\s*\{([^}]+)this\.set\('([^']+)'/g, (match, methodName, body, collectionKey) => {
  return 'delete' + methodName + '(id: string) {' + body + 'this.addDeletedRecord(id, String.fromCharCode(39) + collectionKey + String.fromCharCode(39));this.set(String.fromCharCode(39) + collectionKey + String.fromCharCode(39)';
});

content = content.replace(/deleteLancamento\(id: string\)\s*\{/g, 'deleteLancamento(id: string) {\\n    this.addDeletedRecord(id, String.fromCharCode(39) + String.fromCharCode(99,102,95,108,97,110,99,97,109,101,110,116,111,115) + String.fromCharCode(39));');

fs.writeFileSync('lib/store.ts', content);
console.log('Done!');
