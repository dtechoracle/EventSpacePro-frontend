const fs = require('fs');
const path = require('path');

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (e.name.toLowerCase().endsWith('.svg')) out.push(p);
  }
  return out;
}

// Classify path fill/stroke patterns across assets
const stats = { fillOnly: 0, strokeOnly: 0, both: 0, neither: 0, fillRuleNonzero: 0, examples: { fillOnly: [], strokeOnly: [], neither: [], nonzeroG: [] } };

for (const dir of ['public/assets/modal']) {
  for (const file of walk(dir)) {
    const t = fs.readFileSync(file, 'utf8');
    const paths = t.match(/<path\b[^>]*>/gi) || [];
    let hasNonzeroG = /<g\b[^>]*\bfill-rule\s*=\s*["']nonzero["']/i.test(t);
    if (hasNonzeroG && stats.examples.nonzeroG.length < 10) stats.examples.nonzeroG.push(path.basename(file));
    for (const p of paths) {
      const hasFill = /\sfill\s*=/i.test(p);
      const hasStroke = /\sstroke\s*=/i.test(p);
      const hasFR = /\bfill-rule\s*=/i.test(p);
      if (hasFill && hasStroke) stats.both++;
      else if (hasFill) {
        stats.fillOnly++;
        if (stats.examples.fillOnly.length < 8) stats.examples.fillOnly.push(path.basename(file));
      } else if (hasStroke) {
        stats.strokeOnly++;
        if (stats.examples.strokeOnly.length < 8) stats.examples.strokeOnly.push(path.basename(file));
      } else {
        stats.neither++;
        if (stats.examples.neither.length < 8) stats.examples.neither.push(path.basename(file));
      }
    }
    if (/<g\b[^>]*\bfill-rule\s*=\s*["']nonzero["']/i.test(t)) stats.fillRuleNonzero++;
  }
}

console.log(JSON.stringify(stats, null, 2));
