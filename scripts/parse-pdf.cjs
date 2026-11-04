const fs = require('fs');

async function checkMatches() {
  const text = fs.readFileSync('scripts/temp-pdf-text.txt', 'utf8');
  const matches = text.match(/\((.*?)\)Tj/g);
  if (matches) {
    const lines = matches.map(m => m.replace(/^\(|\)Tj$/g, ''));
    console.log('Lines found:', lines.length);
    console.log(lines.join(' | '));
  }
}
