const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', 'utf8');
let lines = content.split('\n');

// Find the Operation type definition
let startIdx = -1;
for (let i = 315; i < 330; i++) {
    if (lines[i].includes('type Operation = {')) {
        startIdx = i;
        break;
    }
}

if (startIdx === -1) {
    console.log('Could not find Operation type');
    process.exit(1);
}

// Find the end of the Operation type (closing brace and semicolon)
let endIdx = startIdx;
for (let i = startIdx; i < startIdx + 10; i++) {
    if (lines[i].includes('};')) {
        endIdx = i;
        break;
    }
}

console.log(`Replacing Operation type from line ${startIdx} to ${endIdx}`);

// Replace with expanded Operation type
const newOperationType = [
    'type Operation = {',
    '  type: \'delete\' | \'align\' | \'distribute\' | \'duplicate\' | \'group\' | \'ungroup\' | \'select\';',
    '  ',
    '  // Deletion',
    '  assetIds?: string[];       // IDs of assets to delete',
    '  wallIds?: string[];        // IDs of walls to delete',
    '  deleteAll?: boolean;       // Delete everything',
    '  deleteSelected?: boolean;  // Delete selected items',
    '  ',
    '  // Alignment',
    '  alignment?: \'left\' | \'right\' | \'center\' | \'top\' | \'bottom\' | \'middle\';',
    '  relativeTo?: \'canvas\' | \'selection\' | \'first\';',
    '  ',
    '  // Distribution',
    '  direction?: \'horizontal\' | \'vertical\';',
    '  spacing?: number;  // Optional fixed spacing in mm',
    '  ',
    '  // Duplication',
    '  count?: number;    // Number of copies',
    '  offsetX?: number;  // X offset for each copy',
    '  offsetY?: number;  // Y offset for each copy',
    '  ',
    '  // Selection',
    '  criteria?: {',
    '    assetType?: string;',
    '    color?: string;',
    '    minSize?: number;',
    '    maxSize?: number;',
    '  };',
    '  selectAll?: boolean;',
    '  deselectAll?: boolean;',
    '};'
];

lines.splice(startIdx, endIdx - startIdx + 1, ...newOperationType);

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts', lines.join('\n'), 'utf8');

console.log('✅ Updated Operation type!');
