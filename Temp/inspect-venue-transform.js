const fs = require('fs');

function decode(buf) {
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const s = Buffer.from(buf);
    s.swap16();
    return s.toString('utf16le');
  }
  if (buf.length > 4 && buf[1] === 0 && buf[3] === 0 && buf[5] === 0) return buf.toString('utf16le');
  return buf.toString('utf8');
}

for (const name of ['Balmoral', 'Monarch']) {
  const t = decode(fs.readFileSync('public/assets/preloaded-venues/' + name + '.svg'));
  console.log('===', name);
  // find transform context
  const ti = t.indexOf('transform="matrix');
  console.log('transform context:', JSON.stringify(t.slice(Math.max(0, ti - 200), ti + 120)));
  // count g tags
  console.log('g count', (t.match(/<g\b/gi) || []).length);
  // does root have viewBox after any processing?
  console.log('has viewBox attr', /viewBox=/i.test(t.slice(0, 500)));
}
