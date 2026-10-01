with open('components/renderers/LabelArrowRenderer.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

target = '''    let textAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (textAngle > 90 || textAngle < -90) textAngle += 180;

    const fontSize = arrow.fontSize || 120;
    const fontFamily = arrow.fontFamily || 'Inter, sans-serif';
    const fontWeight = arrow.fontWeight || '700';
    const fontStyle = arrow.fontStyle || 'normal';
    const textDecoration = arrow.textDecoration || 'none';
    const label = arrow.label || '';
    const rectPadH = fontSize * 0.5;
    const rectPadV = fontSize * 0.35;
    const rectWidth = Math.max(fontSize * 2, label.length * fontSize * 0.62 + rectPadH * 2);
    const rectHeight = fontSize + rectPadV * 2;'''

replacement = '''    let textAngle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (textAngle > 90 || textAngle < -90) textAngle += 180;

    const fontFamily = arrow.fontFamily || 'Inter, sans-serif';
    const fontWeight = arrow.fontWeight || '700';
    const fontStyle = arrow.fontStyle || 'normal';
    const textDecoration = arrow.textDecoration || 'none';
    const rectPadV = fontSize * 0.35;
    const rectHeight = fontSize + rectPadV * 2;
    const label = labelStr; // Map to the one declared above
'''

c = c.replace(target, replacement)
with open('components/renderers/LabelArrowRenderer.tsx', 'w', encoding='utf-8') as f:
    f.write(c)

print("Fixed duplicate variables in LabelArrowRenderer.tsx")
