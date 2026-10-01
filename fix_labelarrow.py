with open('components/renderers/LabelArrowRenderer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

target = '''    const labelPosition = arrow.textPosition || 'bottom';
    const labelT = labelPosition === 'top' ? 0.86 : labelPosition === 'middle' ? 0.5 : 0.14;
    const labelX = arrow.startPoint.x + dx * labelT;
    const labelY = arrow.startPoint.y + dy * labelT;'''

replacement = '''    const labelPosition = arrow.textPosition || 'bottom';
    let labelX = 0;
    let labelY = 0;
    
    const fontSize = arrow.fontSize || 120;
    const labelStr = arrow.label || '';
    const rectPadH = fontSize * 0.5;
    const rectWidth = Math.max(fontSize * 2, labelStr.length * fontSize * 0.62 + rectPadH * 2);

    if (labelPosition === 'top') {
        // Appended to the very end of the arrow (outwards)
        labelX = arrow.endPoint.x + ux * (rectWidth / 2 + headSize + 10);
        labelY = arrow.endPoint.y + uy * (rectWidth / 2 + headSize + 10);
    } else if (labelPosition === 'bottom') {
        // Appended to the very start of the arrow (outwards)
        labelX = arrow.startPoint.x - ux * (rectWidth / 2 + tailSize + 10);
        labelY = arrow.startPoint.y - uy * (rectWidth / 2 + tailSize + 10);
    } else {
        // Middle - centered on the arrow line
        labelX = arrow.startPoint.x + dx * 0.5;
        labelY = arrow.startPoint.y + dy * 0.5;
    }'''

c = c.replace(target, replacement)
with open('components/renderers/LabelArrowRenderer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Updated LabelArrowRenderer.tsx text position")
