const fs = require('fs');
const content = fs.readFileSync('scratch/analyze-emails.js', 'utf8');
const match = content.match(/const raw = `([^`]+)`/);
const list = match[1].split(';').map(s => s.trim().toLowerCase()).filter(Boolean);
console.log('Total:', list.length);
const unique = Array.from(new Set(list));
console.log('Unique:', unique.length);

const counts = {};
list.forEach(e => counts[e] = (counts[e] || 0) + 1);
const dups = Object.entries(counts).filter(([_, c]) => c > 1);
console.log('Duplicated emails:', dups);

