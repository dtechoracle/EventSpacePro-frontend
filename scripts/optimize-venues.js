const fs = require('fs');
const path = require('path');

const VENUES_DIR = path.join(__dirname, '../public/assets/preloaded-venues');

const styleBlock = `
  <style id="preloaded-venue-style">
    * { 
      vector-effect: non-scaling-stroke !important; 
    }
    path, circle, rect, line, polyline, ellipse {
      stroke: #272235 !important;
    }
  </style>
`;

function optimize() {
  if (!fs.existsSync(VENUES_DIR)) {
    console.error("Directory not found:", VENUES_DIR);
    return;
  }

  const files = fs.readdirSync(VENUES_DIR).filter(f => f.endsWith('.svg'));
  
  files.forEach(file => {
    const filePath = path.join(VENUES_DIR, file);
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Strip unverified QCAD dashed construction paths that cause heavy rendering lag
    content = content.replace(/<path[^>]*qs:layer="ESP-UNVERIFIED"[^>]*\/>\s*/gi, '');

    // Check if style is already injected
    if (content.includes('id="preloaded-venue-style"')) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Already optimized (cleaned): ${file}`);
      return;
    }
    
    // Insert style block right after the opening <svg> tag
    const svgTagIndex = content.indexOf('<svg');
    if (svgTagIndex === -1) {
      console.log(`Could not find <svg tag in ${file}`);
      return;
    }
    
    const svgTagEndIndex = content.indexOf('>', svgTagIndex);
    if (svgTagEndIndex === -1) {
      console.log(`Could not find closing > of <svg tag in ${file}`);
      return;
    }
    
    const before = content.slice(0, svgTagEndIndex + 1);
    const after = content.slice(svgTagEndIndex + 1);
    
    const newContent = before + styleBlock + after;
    
    fs.writeFileSync(filePath, newContent, 'utf8');
    console.log(`Successfully optimized: ${file}`);
  });
}

optimize();
