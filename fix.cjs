const fs = require('fs');
let content = fs.readFileSync('lib/store.ts', 'utf-8');
content = content.replaceAll('\\n', '\n');
fs.writeFileSync('lib/store.ts', content);
console.log('Fixed');
