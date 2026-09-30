// Проверка отчёта перед публикацией (канон 6.5): синтаксис скриптов и все id, к которым обращается JS.
const fs = require('fs');
const h = fs.readFileSync(process.argv[2] || '../docs/prosvet.html', 'utf8');
const scripts = [...h.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(x => x[1]);
scripts.forEach((s, i) => {
  try { new Function(s); console.log('script', i, 'ok', s.length); }
  catch (e) { console.log('script', i, 'SYNTAX', e.message); }
});
const ids = new Set([...h.matchAll(/id="([^"]+)"/g)].map(x => x[1]));
const used = new Set([...h.matchAll(/\$\('#([A-Za-z0-9_-]+)'\)/g)].map(x => x[1]));
const missing = [...used].filter(x => !ids.has(x));
console.log('ids used', used.size, 'missing:', missing);
process.exit(missing.length ? 1 : 0);
