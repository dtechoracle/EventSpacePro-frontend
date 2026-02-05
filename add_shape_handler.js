const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
let lines = content.split('\n');

// Find the end of the Assets block
// It ends with createdAssetsInBatch.push... and a closing brace
let assetsBlockEndIdx = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('createdAssetsInBatch.push(a as any);')) {
        // lines[i+1] is '      });'
        // lines[i+2] is '    }'
        assetsBlockEndIdx = i + 3;
        break;
    }
}

if (assetsBlockEndIdx !== -1) {
    const shapeHandler = [
        '',
        '    // Shapes',
        '    if (Array.isArray(plan.shapes) && plan.shapes.length > 0) {',
        '      setMessages((m) => [...m, { role: \'assistant\', content: `📐 Adding ${plan.shapes.length} shapes` }]);',
        '      plan.shapes.forEach((shape: any) => {',
        '        const s: any = {',
        '          id: `shape-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,',
        '          type: shape.type,',
        '          x: Number(shape.xMm || shape.x || 0),',
        '          y: Number(shape.yMm || shape.y || 0),',
        '          width: Number(shape.widthMm || shape.width || 100),',
        '          height: Number(shape.heightMm || shape.height || 100),',
        '          radius: Number(shape.radiusMm || shape.radius || 50),',
        '          rotation: 0,',
        '          fillColor: shape.fillColor || "#cccccc",',
        '          strokeColor: shape.strokeColor || "#000000",',
        '          strokeWidth: Number(shape.strokeWidth || 1),',
        '          zIndex: 1,',
        '        };',
        '        addProjectShape(s);',
        '      });',
        '    }',
    ];
    lines.splice(assetsBlockEndIdx, 0, ...shapeHandler);
    console.log('✅ Added shape handler');
} else {
    console.log('⚠️ Could not find assets block end');
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');
