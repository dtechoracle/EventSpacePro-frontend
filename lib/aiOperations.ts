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
    {
        id: 'arrow-shape',
        category: 'Shapes',
        label: 'Arrow',
        description: 'Create an arrow shape',
        aliases: ['arrow', 'arrow shape', 'pointer'],
    },
    {
        id: 'freehand',
        category: 'Shapes',
        label: 'Freehand',
        description: 'Draw freehand on the canvas',
        aliases: ['freehand draw', 'free hand', 'scribble'],
    },
    {
        id: 'polygon',
        category: 'Shapes',
        label: 'Polygon',
        description: 'Create a polygon shape',
        aliases: ['multi sided shape', 'hexagon', 'pentagon'],
    },
    {
        id: 'arch',
        category: 'Shapes',
        label: 'Arch',
        description: 'Create an arch',
        aliases: ['arc', 'curved', 'arched'],
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
    {
        id: 'pan',
        category: 'Selection',
        label: 'Pan',
        description: 'Pan around the canvas',
        aliases: ['pan', 'move view', 'hand tool'],
    },
    {
        id: 'open-assets',
        category: 'Selection',
        label: 'Open Assets',
        description: 'Open the asset library',
        aliases: ['assets', 'asset library', 'browse assets'],
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
    {
        id: 'trim-to-blend',
        category: 'Modify',
        label: 'Trim to Blend',
        description: 'Trim items to blend with the canvas',
        aliases: ['trim to blend', 'blend', 'intersect'],
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

// Editor / workspace operations (view & file level commands)
export interface EditorOperation {
    id: string;
    category: string;
    label: string;
    description: string;
    aliases: string[];
}

export const EDITOR_OPERATIONS: EditorOperation[] = [
    {
        id: 'undo',
        category: 'Edit',
        label: 'Undo',
        description: 'Undo the last action',
        aliases: ['undo last', 'go back', 'revert', 'undo it', 'undo that', 'rollback'],
    },
    {
        id: 'redo',
        category: 'Edit',
        label: 'Redo',
        description: 'Redo the last undone action',
        aliases: ['redo last', 'reapply', 'redo it', 'do it again'],
    },
    {
        id: 'zoom-in',
        category: 'View',
        label: 'Zoom In',
        description: 'Zoom the canvas in (closer)',
        aliases: ['zoom closer', 'magnify', 'enlarge view', 'zoom in on', 'look closer'],
    },
    {
        id: 'zoom-out',
        category: 'View',
        label: 'Zoom Out',
        description: 'Zoom the canvas out (further away)',
        aliases: ['zoom further', 'zoom away', 'shrink view', 'see more', 'widen view'],
    },
    {
        id: 'zoom-reset',
        category: 'View',
        label: 'Reset Zoom',
        description: 'Reset the canvas zoom to 100%',
        aliases: ['reset view', 'fit to screen', 'zoom to fit', 'zoom fit', 'show everything'],
    },
    {
        id: 'toggle-grid',
        category: 'View',
        label: 'Toggle Grid',
        description: 'Show or hide the grid overlay',
        aliases: ['show grid', 'hide grid', 'grid on', 'grid off', 'display grid', 'gridlines'],
    },
    {
        id: 'snap-grid',
        category: 'View',
        label: 'Snap to Grid',
        description: 'Toggle snapping to the grid',
        aliases: ['snap to grid', 'enable grid snap', 'disable grid snap', 'grid snapping'],
    },
    {
        id: 'snap-objects',
        category: 'View',
        label: 'Snap to Objects',
        description: 'Toggle snapping to other objects',
        aliases: ['snap to objects', 'snap to shapes', 'object snapping'],
    },
    {
        id: 'select-all',
        category: 'Selection',
        label: 'Select All',
        description: 'Select every item on the canvas',
        aliases: ['select everything', 'select all items', 'select every item', 'select all objects'],
    },
    {
        id: 'deselect',
        category: 'Selection',
        label: 'Deselect All',
        description: 'Clear the current selection',
        aliases: ['deselect all', 'clear selection', 'unselect all', 'deselect everything'],
    },
    {
        id: 'export-project',
        category: 'File',
        label: 'Export Project',
        description: 'Export the current project to a file',
        aliases: ['export', 'export project', 'download file', 'save file', 'save project'],
    },
    {
        id: 'import-project',
        category: 'File',
        label: 'Import Project',
        description: 'Import a project file',
        aliases: ['import', 'import project', 'open file', 'load file'],
    },
];

export function findEditorOperation(query: string): EditorOperation | null {
    const q = query.toLowerCase().trim();
    let match = EDITOR_OPERATIONS.find(
        (op) => op.id === q || op.label.toLowerCase() === q
    );
    if (match) return match;
    match = EDITOR_OPERATIONS.find((op) =>
        op.aliases.some((alias) => alias.toLowerCase() === q || alias.toLowerCase().includes(q))
    );
    return match || null;
}

// ─── Workspace operation intent detection ────────────────────────────────
// Maps natural-language workspace commands (tool switching, align, distribute,
// undo/redo, zoom, grid/snap, delete, duplicate, layers) to structured
// operation objects that the frontend can execute directly.

export type DetectedOperation =
    | { type: 'tool'; tool: string }
    | { type: 'align'; alignment: 'left' | 'right' | 'center' | 'top' | 'middle' | 'bottom' }
    | { type: 'distribute'; direction: 'horizontal' | 'vertical' }
    | { type: 'group' }
    | { type: 'ungroup' }
    | { type: 'delete'; deleteSelected: boolean; deleteAll?: boolean }
    | { type: 'duplicate'; count: number }
    | { type: 'bring-to-front' }
    | { type: 'send-to-back' }
    | { type: 'undo' }
    | { type: 'redo' }
    | { type: 'zoom'; zoom: 'in' | 'out' | 'reset' }
    | { type: 'toggle-grid' }
    | { type: 'snap'; snap: 'grid' | 'objects' }
    | { type: 'select'; selectAll?: boolean; assetType?: string }
    | { type: 'deselect' }
    | { type: 'export-project' }
    | { type: 'import-project' };

const normalizeOpText = (value: string) =>
    String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s']/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const TOOL_ALIASES: Record<string, string[]> = {
    'draw-line': ['draw line', 'draw a line', 'freehand', 'pen tool', 'sketch tool', 'line drawing'],
    'draw-wall': ['draw wall', 'draw a wall', 'wall tool', 'add wall', 'create wall', 'wall drawing', 'partition tool'],
    rectangle: ['rectangle', 'square', 'box tool', 'rect tool', 'draw rectangle', 'draw a rectangle', 'rectangle tool'],
    circle: ['circle', 'ellipse', 'oval', 'round tool', 'draw circle', 'draw a circle', 'circle tool'],
    line: ['straight line', 'line tool', 'draw straight line', 'connector line'],
    'arrow-shape': ['arrow', 'arrow shape', 'draw arrow', 'arrow tool', 'add arrow'],
    freehand: ['freehand draw', 'freehand tool', 'free hand'],
    polygon: ['polygon', 'polygon tool', 'draw polygon', 'draw a polygon'],
    arch: ['arch', 'arch tool', 'draw arch', 'draw an arch'],
    'pointer-select': ['pointer', 'select tool', 'pointer select', 'cursor tool', 'click select', 'select mode'],
    'rectangular-select': ['rectangular select', 'box select', 'area select', 'marquee select', 'drag select'],
    pan: ['pan', 'pan tool', 'hand tool', 'move view', 'pan around'],
    trim: ['trim', 'trim tool', 'slice', 'cut tool', 'slice tool'],
    'trim-to-blend': ['trim to blend', 'blend tool'],
    'label-arrow': ['label arrow', 'label with arrow', 'callout', 'pointer label'],
    dimensions: ['dimension', 'dimensions', 'measure', 'measurement', 'ruler', 'dimension tool', 'measure tool'],
    'text-annotation': ['text', 'text tool', 'add text', 'label', 'annotation', 'text annotation', 'add annotation'],
    'open-assets': ['assets', 'open assets', 'asset library', 'browse assets', 'add furniture', 'furniture library'],
    'export-project': ['export', 'export project', 'export file', 'download file'],
    'import-project': ['import', 'import project', 'open file', 'load file'],
};

export function detectToolIntent(text: string): string | null {
    const lower = normalizeOpText(text);
    const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const entries = Object.entries(TOOL_ALIASES);
    for (const [tool, aliases] of entries) {
        for (const alias of aliases) {
            const pattern = new RegExp(`(?:^|[^a-z0-9])${escapeRegExp(alias).replace(/\s+/g, '\\s+')}(?:$|[^a-z0-9])`, 'i');
            if (pattern.test(lower)) return tool;
        }
    }
    return null;
}

export function detectWorkspaceOperation(text: string): DetectedOperation | null {
    const lower = normalizeOpText(text);
    if (!lower) return null;

    const has = (...phrases: string[]) => phrases.some((p) => lower.includes(p));

    // Undo / Redo
    if (has('undo last', 'undo that', 'undo it', 'go back one', 'revert', 'rollback', 'undo this')) {
        return { type: 'undo' };
    }
    if (has('redo last', 'redo it', 'reapply', 'do it again')) {
        return { type: 'redo' };
    }

    // Zoom
    if (has('zoom in', 'zoom closer', 'magnify', 'enlarge view', 'look closer')) {
        return { type: 'zoom', zoom: 'in' };
    }
    if (has('zoom out', 'zoom away', 'shrink view', 'widen view', 'zoom further')) {
        return { type: 'zoom', zoom: 'out' };
    }
    if (has('reset zoom', 'reset view', 'fit to screen', 'zoom to fit', 'zoom fit', 'show everything')) {
        return { type: 'zoom', zoom: 'reset' };
    }

    // Grid / Snap
    if (has('toggle grid', 'show grid', 'hide grid', 'grid on', 'grid off', 'display grid', 'gridlines')) {
        return { type: 'toggle-grid' };
    }
    if (has('snap to grid', 'grid snap', 'snap grid', 'enable grid snap', 'disable grid snap')) {
        return { type: 'snap', snap: 'grid' };
    }
    if (has('snap to object', 'object snap', 'snap to shapes')) {
        return { type: 'snap', snap: 'objects' };
    }

    // Selection
    if (has('select all', 'select everything', 'select all items', 'select every item', 'select all objects')) {
        return { type: 'select', selectAll: true };
    }
    if (has('deselect all', 'clear selection', 'unselect all', 'deselect everything')) {
        return { type: 'deselect' };
    }

    // Layers
    if (has('bring to front', 'bring to top', 'to front', 'on top of everything', 'top layer', 'bring forward')) {
        return { type: 'bring-to-front' };
    }
    if (has('send to back', 'send behind', 'to back', 'behind everything', 'bottom layer', 'send backward')) {
        return { type: 'send-to-back' };
    }

    // Delete
    if (has('delete selected', 'delete selection', 'remove selected', 'delete these', 'remove these')) {
        return { type: 'delete', deleteSelected: true };
    }
    if (has('delete all', 'delete everything', 'remove everything', 'clear the canvas', 'clear canvas', 'delete all items')) {
        return { type: 'delete', deleteSelected: false, deleteAll: true };
    }
    if (has('delete it', 'delete this', 'remove it', 'remove this', 'delete the selected', 'erase')) {
        return { type: 'delete', deleteSelected: true };
    }

    // Duplicate
    if (has('duplicate', 'make a copy', 'make copies', 'copy selected', 'duplicate selected', 'copy these', 'clone')) {
        const countMatch = lower.match(/(\d+)\s*(?:copies|times|duplicates?)/);
        return { type: 'duplicate', count: countMatch ? Math.max(1, Math.min(20, Number(countMatch[1]))) : 1 };
    }

    // Align
    if (has('align left', 'left align', 'align to the left', 'align to left')) {
        return { type: 'align', alignment: 'left' };
    }
    if (has('align right', 'right align', 'align to the right', 'align to right')) {
        return { type: 'align', alignment: 'right' };
    }
    if (has('align top', 'top align', 'align to the top', 'align to top')) {
        return { type: 'align', alignment: 'top' };
    }
    if (has('align bottom', 'bottom align', 'align to the bottom', 'align to bottom')) {
        return { type: 'align', alignment: 'bottom' };
    }
    if (has('align center', 'center align', 'align center', 'align to center', 'align centre', 'centre align', 'align horizontally center', 'align horizontal')) {
        return { type: 'align', alignment: 'center' };
    }
    if (has('align middle', 'middle align', 'align vertically center', 'align vertical', 'align vertical center')) {
        return { type: 'align', alignment: 'middle' };
    }

    // Distribute
    if (has('distribute horizontal', 'space horizontally', 'evenly horizontally', 'spread horizontally')) {
        return { type: 'distribute', direction: 'horizontal' };
    }
    if (has('distribute vertical', 'space vertically', 'evenly vertically', 'spread vertically')) {
        return { type: 'distribute', direction: 'vertical' };
    }
    if (has('distribute evenly', 'evenly space', 'equal spacing', 'even spacing', 'spread out evenly', 'distribute')) {
        return { type: 'distribute', direction: 'horizontal' };
    }

    // Group / Ungroup
    if (has('group together', 'group these', 'group them', 'group selected', 'group the selected', 'make a group', 'group items', 'combine into a group')) {
        return { type: 'group' };
    }
    if (has('ungroup', 'break group', 'ungroup selected', 'separate group', 'ungroup these')) {
        return { type: 'ungroup' };
    }

    // Tool switching
    const tool = detectToolIntent(text);
    if (tool) return { type: 'tool', tool };

    return null;
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

    context += '\nEditor Operations:\n';
    EDITOR_OPERATIONS.forEach((op) => {
        context += `  - ${op.label}: ${op.description}\n`;
    });

    context += '\nWall Types:\n';
    WALL_TYPES.forEach((wall) => {
        context += `  - ${wall.label} (${wall.thickness}mm)\n`;
    });

    return context;
}
