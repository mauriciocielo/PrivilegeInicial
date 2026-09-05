const fs = require('fs');
let content = fs.readFileSync('lib/store.ts', 'utf-8');

// Fix broken deletes
content = content.replace(/this\.addDeletedRecord\(id,\s*String\.fromCharCode\(39\)\s*\+\s*collectionKey\s*\+\s*String\.fromCharCode\(39\)\);this\.set\(String\.fromCharCode\(39\)\s*\+\s*collectionKey\s*\+\s*String\.fromCharCode\(39\),\s*this\.get([^)]+)\(\)\.filter\([^\)]+\)\);/g, (match, getMethodName) => {
  let col = '';
  switch(getMethodName) {
    case 'Empresas': col = 'cf_empresas'; break;
    case 'Users': col = 'cf_users'; break;
    case 'PlanoContas': col = 'cf_plano_contas'; break;
    case 'Portadores': col = 'cf_portadores'; break;
    case 'CentrosCusto': col = 'cf_centros_custo'; break;
    case 'InteligenciaDocs': col = 'cf_inteligencia_docs'; break;
    case 'Orcamentos': col = 'cf_orcamentos'; break;
    case 'Indicadores': col = 'cf_indicadores'; break;
    case 'Endividamentos': col = 'cf_endividamentos'; break;
    case 'Atas': col = 'cf_atas'; break;
    case 'Unidades': col = 'cf_unidades'; break;
    case 'Clientes': col = 'cf_clientes'; break;
    case 'Lancamentos': col = 'cf_lancamentos'; break;
    default: col = 'cf_' + getMethodName.toLowerCase();
  }
  return 'this.addDeletedRecord(id, "' + col + '");\n    this.set("' + col + '", this.get' + getMethodName + '().filter(x => x.id !== id));';
});

content = content.replace(/this\.addDeletedRecord\(id, String\.fromCharCode\(39\) \+ String\.fromCharCode\(99,102,95,108,97,110,99,97,109,101,110,116,111,115\) \+ String\.fromCharCode\(39\)\);/g, 'this.addDeletedRecord(id, "cf_lancamentos");');

// Inject updatedAt into singular save methods correctly
content = content.replace(/save([A-Za-z0-9_]+)\(([^:,]+):\s*([a-zA-Z0-9_\[\]]+)\)\s*\{/g, (match, methodName, argName, typeName) => {
  if (typeName.includes('[]')) {
    return match + '\n    if (Array.isArray(' + argName + ')) ' + argName + '.forEach(i => i.updatedAt = new Date().toISOString());';
  } else {
    return match + '\n    if (' + argName + ' && typeof ' + argName + ' === "object") ' + argName + '.updatedAt = new Date().toISOString();';
  }
});

fs.writeFileSync('lib/store.ts', content);
console.log('Fixed completely');
