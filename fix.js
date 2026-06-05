const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(function(file) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(walk(file));
    } else { 
      if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
    }
  });
  return results;
}

const files = walk('./app');
let changed = 0;
for (const file of files) {
  const content = fs.readFileSync(file, 'utf8');
  if (content.includes("|| 'e1'")) {
    const newContent = content.replace(/\|\|\s*'e1'/g, "|| (store.getEmpresas()[0]?.id ?? '')");
    fs.writeFileSync(file, newContent, 'utf8');
    changed++;
  }
}
console.log('Files changed: ' + changed);
