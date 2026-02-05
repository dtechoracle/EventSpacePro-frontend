const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', 'utf8');
const lines = content.split('\n');

// Find where we define functions (after applyPlan starts)
const applyPlanIdx = lines.findIndex(l => l.includes('const applyPlan = (plan: any) => {'));
if (applyPlanIdx === -1) {
    console.log('Could not find applyPlan');
    process.exit(1);
}

// Add a simple grid calculator function right after applyPlan starts
const gridFunction = `
    // Simple grid position calculator
    const calculateGridPositions = (
      itemCount: number,
      itemWidth: number,
      itemHeight: number,
      wallBounds: { minX: number; minY: number; maxX: number; maxY: number },
      cols: number,
      rows: number
    ) => {
      const wallWidth = wallBounds.maxX - wallBounds.minX;
      const wallHeight = wallBounds.maxY - wallBounds.minY;
      
      // Total space taken by all items
      const totalItemsWidth = cols * itemWidth;
      const totalItemsHeight = rows * itemHeight;
      
      // Remaining space to distribute
      const remainingWidth = wallWidth - totalItemsWidth;
      const remainingHeight = wallHeight - totalItemsHeight;
      
      // Gap between items (divide remaining space by gaps)
      const gapX = cols > 1 ? remainingWidth / (cols + 1) : remainingWidth / 2;
      const gapY = rows > 1 ? remainingHeight / (rows + 1) : remainingHeight / 2;
      
      // Calculate positions
      const positions = [];
      for (let i = 0; i < itemCount; i++) {
        const row = Math.floor(i / cols);
        const col = i % cols;
        
        // Center of each item
        const x = wallBounds.minX + gapX + (col * (itemWidth + gapX)) + itemWidth / 2;
        const y = wallBounds.minY + gapY + (row * (itemHeight + gapY)) + itemHeight / 2;
        
        positions.push({ x, y });
      }
      
      return positions;
    };
`;

// Insert after the first line of applyPlan (after the opening brace)
lines.splice(applyPlanIdx + 1, 0, gridFunction);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/AiTrigger.tsx', lines.join('\n'), 'utf8');

console.log('✅ Added simple grid calculator function!');
