// AI Operations - Comprehensive operation definitions for AI capabilities
export type WallType = 'partition-75' | 'partition-100' | 'enclosure-150' | 'enclosure-225';

export interface WallTypeInfo {
    id: WallType;
    label: string;
    thickness: number; // in mm
    aliases: string[];
}

export const WALL_TYPES: WallTypeInfo[] = [
    {
        id: 'partition-75',
        label: 'Partition (75mm)',
        thickness: 75,
        aliases: ['thin', 'partition', 'light wall', '75mm wall'],
    },
    {
        id: 'partition-100',
        label: 'Partition (100mm)',
        thickness: 100,
        aliases: ['standard', 'normal wall', '100mm wall', 'regular partition'],
    },
    {
        id: 'enclosure-150',
        label: 'Enclosure Wall (150mm)',
        thickness: 150,
        aliases: ['thick', 'enclosure', 'heavy wall', '150mm wall'],
    },
    {
        id: 'enclosure-225',
        label: 'Enclosure Wall (225mm)',
        thickness: 225,
        aliases: ['extra thick', 'structural wall', '225mm wall', 'load bearing'],
    },
];

export function findWallType(query: string): WallTypeInfo | null {
    const q = query.toLowerCase().trim();

    // Exact match
    let match = WALL_TYPES.find((w) => w.id === q || w.label.toLowerCase() === q);
    if (match) return match;

    // Alias match
    match = WALL_TYPES.find((w) => w.aliases.some((alias) => alias.toLowerCase() === q));
    if (match) return match;

    // Thickness match (e.g., "75", "100mm")
    const thicknessMatch = q.match(/(\d+)/);
    if (thicknessMatch) {
        const thickness = parseInt(thicknessMatch[1], 10);
        match = WALL_TYPES.find((w) => w.thickness === thickness);
        if (match) return match;
    }

    return null;
}

// Toolbar operations that AI can perform
export interface ToolbarOperation {
    id: string;
    category: string;
    label: string;
    description: string;
    aliases: string[];
}

export const TOOLBAR_OPERATIONS: ToolbarOperation[] = [
    // Drawing operations
    {
        id: 'draw-line',
        category: 'Drawing',
        label: 'Draw Line',
        description: 'Draw a freehand line on the canvas',
        aliases: ['line', 'draw', 'sketch line', 'freehand'],
    },
    {
        id: 'draw-wall',
        category: 'Drawing',
        label: 'Draw Wall',
        description: 'Draw walls to define room boundaries',
        aliases: ['wall', 'create wall', 'add wall', 'room boundary'],
    },

    // Shape operations
    {
        id: 'rectangle',
        category: 'Shapes',
        label: 'Rectangle',
        description: 'Create a rectangular shape',
        aliases: ['rect', 'box', 'square'],
    },
    {
        id: 'circle',
        category: 'Shapes',
        label: 'Circle',
        description: 'Create a circular shape',
        aliases: ['ellipse', 'oval', 'round'],
    },
    {
        id: 'line',
        category: 'Shapes',
        label: 'Line',
        description: 'Create a straight line',
        aliases: ['straight line', 'connector'],
    },

    // Selection operations
    {
        id: 'pointer-select',
        category: 'Selection',
        label: 'Pointer',
        description: 'Select individual items',
        aliases: ['select', 'pointer', 'click select'],
    },
    {
        id: 'rectangular-select',
        category: 'Selection',
        label: 'Rectangular Selector',
        description: 'Select multiple items with a rectangle',
        aliases: ['box select', 'area select', 'multi-select'],
    },

    // Modify operations
    {
        id: 'move',
        category: 'Modify',
        label: 'Move',
        description: 'Move selected items',
        aliases: ['reposition', 'relocate', 'drag'],
    },
    {
        id: 'copy',
        category: 'Modify',
        label: 'Copy',
        description: 'Duplicate selected items',
        aliases: ['duplicate', 'clone', 'replicate'],
    },
    {
        id: 'rotate',
        category: 'Modify',
        label: 'Rotate',
        description: 'Rotate selected items',
        aliases: ['turn', 'spin', 'angle'],
    },
    {
        id: 'trim',
        category: 'Modify',
        label: 'Trim',
        description: 'Trim or cut items',
        aliases: ['cut', 'crop', 'slice'],
    },

    // Annotation operations
    {
        id: 'label-arrow',
        category: 'Annotations',
        label: 'Label with Arrow',
        description: 'Add a label with an arrow pointer',
        aliases: ['arrow label', 'callout', 'pointer label'],
    },
    {
        id: 'dimensions',
        category: 'Annotations',
        label: 'Dimensions',
        description: 'Add dimension measurements',
        aliases: ['measure', 'measurement', 'ruler', 'dimension line'],
    },
    {
        id: 'text-annotation',
        category: 'Annotations',
        label: 'Text',
        description: 'Add text annotation',
        aliases: ['text', 'label', 'note', 'comment'],
    },

    // File operations
    {
        id: 'export-project',
        category: 'File',
        label: 'Export Project',
        description: 'Export the current project',
        aliases: ['export', 'save as', 'download'],
    },
    {
        id: 'import-project',
        category: 'File',
        label: 'Import Project',
        description: 'Import a project file',
        aliases: ['import', 'load', 'open file'],
    },
];

export function findOperation(query: string): ToolbarOperation | null {
    const q = query.toLowerCase().trim();

    // Exact match
    let match = TOOLBAR_OPERATIONS.find(
        (op) => op.id === q || op.label.toLowerCase() === q
    );
    if (match) return match;

    // Alias match
    match = TOOLBAR_OPERATIONS.find((op) =>
        op.aliases.some((alias) => alias.toLowerCase() === q)
    );
    if (match) return match;

    // Fuzzy match
    match = TOOLBAR_OPERATIONS.find((op) =>
        op.label.toLowerCase().includes(q) || op.description.toLowerCase().includes(q)
    );

    return match || null;
}

export function getOperationsByCategory(category: string): ToolbarOperation[] {
    return TOOLBAR_OPERATIONS.filter(
        (op) => op.category.toLowerCase() === category.toLowerCase()
    );
}

// Advanced layout operations
export interface LayoutOperation {
    id: string;
    label: string;
    description: string;
    aliases: string[];
}

export const LAYOUT_OPERATIONS: LayoutOperation[] = [
    {
        id: 'align-left',
        label: 'Align Left',
        description: 'Align selected items to the left',
        aliases: ['left align', 'align to left edge'],
    },
    {
        id: 'align-right',
        label: 'Align Right',
        description: 'Align selected items to the right',
        aliases: ['right align', 'align to right edge'],
    },
    {
        id: 'align-top',
        label: 'Align Top',
        description: 'Align selected items to the top',
        aliases: ['top align', 'align to top edge'],
    },
    {
        id: 'align-bottom',
        label: 'Align Bottom',
        description: 'Align selected items to the bottom',
        aliases: ['bottom align', 'align to bottom edge'],
    },
    {
        id: 'align-center-horizontal',
        label: 'Align Center Horizontally',
        description: 'Align selected items to horizontal center',
        aliases: ['center horizontally', 'h-center', 'horizontal center'],
    },
    {
        id: 'align-center-vertical',
        label: 'Align Center Vertically',
        description: 'Align selected items to vertical center',
        aliases: ['center vertically', 'v-center', 'vertical center'],
    },
    {
        id: 'distribute-horizontal',
        label: 'Distribute Horizontally',
        description: 'Distribute items evenly horizontally',
        aliases: ['space horizontally', 'even spacing horizontal'],
    },
    {
        id: 'distribute-vertical',
        label: 'Distribute Vertically',
        description: 'Distribute items evenly vertically',
        aliases: ['space vertically', 'even spacing vertical'],
    },
    {
        id: 'group',
        label: 'Group',
        description: 'Group selected items together',
        aliases: ['create group', 'combine', 'group items'],
    },
    {
        id: 'ungroup',
        label: 'Ungroup',
        description: 'Ungroup selected group',
        aliases: ['break group', 'separate', 'ungroup items'],
    },
    {
        id: 'bring-to-front',
        label: 'Bring to Front',
        description: 'Move item to front layer',
        aliases: ['to front', 'top layer', 'bring forward'],
    },
    {
        id: 'send-to-back',
        label: 'Send to Back',
        description: 'Move item to back layer',
        aliases: ['to back', 'bottom layer', 'send backward'],
    },
];

export function findLayoutOperation(query: string): LayoutOperation | null {
    const q = query.toLowerCase().trim();

    let match = LAYOUT_OPERATIONS.find(
        (op) => op.id === q || op.label.toLowerCase() === q
    );
    if (match) return match;

    match = LAYOUT_OPERATIONS.find((op) =>
        op.aliases.some((alias) => alias.toLowerCase() === q || alias.toLowerCase().includes(q))
    );

    return match || null;
}

// Get all operations context for AI
export function getOperationsContext(): string {
    let context = 'Available Operations:\n\n';

    context += 'Toolbar Operations:\n';
    const categories = Array.from(new Set(TOOLBAR_OPERATIONS.map((op) => op.category)));
    categories.forEach((category) => {
        const ops = getOperationsByCategory(category);
        context += `  ${category}:\n`;
        ops.forEach((op) => {
            context += `    - ${op.label}: ${op.description}\n`;
        });
    });

    context += '\nLayout Operations:\n';
    LAYOUT_OPERATIONS.forEach((op) => {
        context += `  - ${op.label}: ${op.description}\n`;
    });

    context += '\nWall Types:\n';
    WALL_TYPES.forEach((wall) => {
        context += `  - ${wall.label} (${wall.thickness}mm)\n`;
    });

    return context;
}
