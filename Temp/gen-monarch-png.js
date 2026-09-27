const fs = require('fs/promises');
const path = require('path');
const sharp = require('sharp');

const ROOT = process.cwd();
const SVG_PATH = path.join(ROOT, 'public', 'assets', 'preloaded-venues', 'Monarch.svg');
const PNG_PATH = path.join(ROOT, 'public', 'assets', 'thumbnails', 'preloaded-venues', 'Monarch.png');

function decodeSvg(buf) {
  // UTF-16 LE/BE with BOM
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString('utf16le');
  if (buf[0] === 0xfe && buf[1] === 0xff) {
    const swapped = Buffer.from(buf);
    swapped.swap16();
    return swapped.toString('utf16le');
  }
  // UTF-16 without BOM heuristic: lots of null high/low bytes
  if (buf.length > 4 && buf[1] === 0x00 && buf[3] === 0x00 && buf[5] === 0x00) {
    return buf.toString('utf16le');
  }
  return buf.toString('utf8');
}

(async () => {
  const raw = await fs.readFile(SVG_PATH);
  let svgText = decodeSvg(raw);
  if (!/<svg[\s>]/i.test(svgText)) {
    throw new Error('Decoded SVG does not contain <svg> tag');
  }

  const viewBoxMatch = svgText.match(/viewBox=["']([\d\s.,-]+)["']/i);
  let vbWidth = 1000, vbHeight = 1000;
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].trim().split(/[\s,]+/).map(Number);
    if (parts.length === 4) { vbWidth = Math.abs(parts[2]); vbHeight = Math.abs(parts[3]); }
  }

  const sw = Math.max(3, Math.round(Math.max(vbWidth, vbHeight) * 0.004));

  svgText = svgText.replace(/<style id="preloaded-venue-style">[\s\S]*?<\/style>/gi, '');
  svgText = svgText.replace(/<!--[\s\S]*?-->/g, '');
  svgText = svgText.replace(/<metadata[\s\S]*?<\/metadata>/gi, '');

  svgText = svgText.replace(/stroke-width="[^"]*"/gi, `stroke-width="${sw}"`);
  svgText = svgText.replace(/stroke="[^"]*"/gi, 'stroke="#272235"');
  svgText = svgText.replace(/fill="[^"]*"/gi, 'fill="none"');
  svgText = svgText.replace(/style="[^"]*stroke-width[^"]*"/gi, `style="stroke-width:${sw}"`);
  svgText = svgText.replace(/style="[^"]*stroke:[^"]*"/gi, 'style="stroke:#272235"');

  await fs.mkdir(path.dirname(PNG_PATH), { recursive: true });
  await sharp(Buffer.from(svgText), { density: 24, limitInputPixels: false })
    .resize({ width: 512, height: 512, fit: 'contain', background: { r: 255, g: 255, b: 255, alpha: 0 }, withoutEnlargement: true })
    .png()
    .toFile(PNG_PATH);

  const st = await fs.stat(PNG_PATH);
  console.log(`Monarch.svg -> PNG: ${(st.size / 1024).toFixed(1)}KB (stroke ${sw}, vb ${vbWidth}x${vbHeight})`);
})().catch((e) => { console.error(e); process.exit(1); });
