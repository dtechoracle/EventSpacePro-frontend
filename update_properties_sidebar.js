const fs = require('fs');

const content = fs.readFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/editor/PropertiesSidebar.tsx', 'utf8');
let lines = content.split('\n');

// Find the Wall Properties section
let wallPropsStart = -1;
for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('itemType === \'wall\' && selectedWall')) {
        wallPropsStart = i;
        break;
    }
}

let wallPropsEnd = -1;
if (wallPropsStart !== -1) {
    // Find the end of this block. It's inside a boolean render block {itemType === 'wall' ... ( ... )}
    // We look for where "Dimension Properties" starts, or the closing of the block
    for (let i = wallPropsStart; i < lines.length; i++) {
        if (lines[i].includes('Dimension Properties')) {
            // Backtrack to find closing brace of wall props
            // Usually it closes before the next block
            wallPropsEnd = i - 2;
            break;
        }
    }
}

if (wallPropsStart !== -1 && wallPropsEnd !== -1) {
    // We will preserve the Fill Type and Thickness sections, but replace everything after Thickness
    // Find where Thickness ends
    let thicknessEnd = -1;
    for (let i = wallPropsStart; i < wallPropsEnd; i++) {
        if (lines[i].includes('/* Wall Thickness */')) {
            // scan until we find the closing div of thickness
            // It typically has input and closing div
            // A safe bet is looking for "/* Move Distance X */" which we want to delete
            for (let j = i; j < wallPropsEnd; j++) {
                if (lines[j].includes('/* Move Distance X */')) {
                    thicknessEnd = j;
                    break;
                }
            }
            break;
        }
    }

    if (thicknessEnd !== -1) {
        // Construct the new Wall Properties content
        const newControls = [
            '',
            '                    {/* Wall Length - Scales the wall around its center */}',
            '                    <div className="flex justify-between items-center mb-2">',
            '                      <span className="text-gray-500">Length</span>',
            '                      <div className="flex items-center gap-1">',
            '                        <input',
            '                          type="number"',
            '                          // Calculate current length from nodes',
            '                          value={(() => {',
            '                             if (selectedWall.nodes && selectedWall.nodes.length > 0) {',
            '                               // Assuming simple straight wall for length property or bounding box width',
            '                               // For complex walls, this "Length" might be ambiguous, but for single segments it works',
            '                               let minX = Infinity, maxX = -Infinity;',
            '                               selectedWall.nodes.forEach(n => {',
            '                                 minX = Math.min(minX, n.x);',
            '                                 maxX = Math.max(maxX, n.x);',
            '                               });',
            '                               return Math.round(maxX - minX) || 0;',
            '                             }',
            '                             return 0;',
            '                          })()}',
            '                          onChange={(e) => {',
            '                            const newLen = Number(e.target.value);',
            '                            if (newLen > 0 && selectedWall.nodes.length > 0) {',
            '                               const xs = selectedWall.nodes.map(n => n.x);',
            '                               const minX = Math.min(...xs);',
            '                               const maxX = Math.max(...xs);',
            '                               const currentLen = maxX - minX;',
            '                               if (currentLen === 0) return;',
            '                               const centerX = (minX + maxX) / 2;',
            '                               const scale = newLen / currentLen;',
            '                               ',
            '                               const updatedNodes = selectedWall.nodes.map(node => ({',
            '                                 ...node,',
            '                                 x: centerX + (node.x - centerX) * scale',
            '                               }));',
            '                               updateWall(selectedWall.id, { nodes: updatedNodes });',
            '                            }',
            '                          }}',
            '                          className="sidebar-input w-16 text-right"',
            '                        />',
            '                        <span className="text-xs text-gray-400">mm</span>',
            '                      </div>',
            '                    </div>',
            '',
            '                    {/* Wall Height (3D) */}',
            '                    <div className="flex justify-between items-center mb-2">',
            '                      <span className="text-gray-500">Height</span>',
            '                      <div className="flex items-center gap-1">',
            '                        <input',
            '                          type="number"',
            '                          value={(selectedWall as any).height || 3000}',
            '                          onChange={(e) => updateWall(selectedWall.id, { height: Number(e.target.value) } as any)}',
            '                          className="sidebar-input w-16 text-right"',
            '                        />',
            '                        <span className="text-xs text-gray-400">mm</span>',
            '                      </div>',
            '                    </div>',
            '',
            '                    {/* Show Dimensions Toggle */}',
            '                    <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-100">',
            '                      <span className="text-gray-500">Show Dimensions</span>',
            '                      <button',
            '                        onClick={() => updateWall(selectedWall.id, { showDimensions: !(selectedWall as any).showDimensions } as any)}',
            '                        className={`w-10 h-5 rounded-full flex items-center transition-colors px-1 ${',
            '                          (selectedWall as any).showDimensions ? "bg-blue-600 justify-end" : "bg-gray-300 justify-start"',
            '                        }`}',
            '                      >',
            '                        <div className="w-3 h-3 bg-white rounded-full shadow-sm" />',
            '                      </button>',
            '                    </div>',
            ''
            // Note: We are deliberately OMITTING MoveX, MoveY, and Rotate sections
        ];

        // Replace from thicknessEnd to wallPropsEnd (exclusive of wallPropsEnd's closing tag line usually)
        // We need to match the previous blocks logic correctly.
        // wallPropsEnd was roughly calculated. Let's find the closing brace index.
        let closingBraceIdx = -1;
        // Search backwards from "Dimension Properties" line index
        for (let i = wallPropsEnd + 2; i > thicknessEnd; i--) { // +2 just to be safe in search range
            if (lines[i] && lines[i].trim() === '</div>' && lines[i - 1] && lines[i - 1].trim() === '</div>') {
                // Heuristic: The block usually ends with nested divs closing
                // But safer is simply to delete everything from `thicknessEnd` up to the line before `selectedWall && (` which closes the block
                // Actually, let's just delete the chunks we know: MoveX, MoveY, Rotate.

                // Let's refine the strategy: Delete specifically the lines containing MoveX, MoveY, Rotate blocks
            }
        }

        // New Strategy: Replace lines from `thicknessEnd` to the end of the wall block with `newControls` + closing tags
        // We need to identify exactly where the wall block ends in the file
        // It ends right before `{/* Dimension Properties */}`

        // Let's find the line index of `{/* Dimension Properties */}`
        let dimPropsIdx = -1;
        for (let k = 0; k < lines.length; k++) {
            if (lines[k].includes('{/* Dimension Properties */}')) {
                dimPropsIdx = k;
                break;
            }
        }

        if (dimPropsIdx !== -1) {
            // The wall block logic:
            // ...
            // </div>
            // )} <--- This is the closing of { itemType === 'wall' ... }

            // We want to insert updates BEFORE the closing `</div>` of the wall container
            // The wall container div opens at `wallPropsStart + 1` (roughly)

            // Let's just locate the specific MoveX/MoveY/Rotate blocks and remove them
            // Then append our new controls
        }
    }
}

// Clean rewrite of the strategy using specific replace ranges
// We know exact content from previous `view_file`

// 1. Delete Move X Block
const moveXStart = lines.findIndex(l => l.includes('{/* Move Distance X */}'));
// Find end of Move X
let moveXEnd = -1;
if (moveXStart !== -1) {
    for (let i = moveXStart; i < lines.length; i++) {
        if (lines[i].includes('</div>') && lines[i + 1].includes('{/* Move Distance Y */}')) {
            moveXEnd = i + 1;
            break;
        }
    }
}

// 2. Delete Move Y Block
let moveYStart = -1;
let moveYEnd = -1;
// ... (Logic gets complex to parse via script linearly)

// Easier Logic:
// We know the structure is sequential: Move X -> Move Y -> Rotate
// We can find the start of Move X and the end of Rotate
const startDeleteToken = '{/* Move Distance X */}';
const endDeleteToken = '</div>'; // This is ambiguous
// Better end token: The start of the next section is `)}` closing the wall block? No.
// Inspecting file:
// Rotate block ends with `</div>`
// Then `</div>` (closing "mt-3 pt-3...")
// Then `)}` (closing condition)

// Let's find the line with `{/* Rotation */}` (or Rotate Angle as it is in file `/* Rotate Angle */`)
const rotateLabelIdx = lines.findIndex(l => l.includes('{/* Rotate Angle */}'));
let rotateEndIdx = -1;
if (rotateLabelIdx !== -1) {
    let divCount = 0;
    for (let i = rotateLabelIdx; i < lines.length; i++) {
        // Find the closing div for this specific control
        // It has `flex justify-between` ...
        if (lines[i].includes('<div className="flex justify-between')) divCount++;
        if (lines[i].includes('</div>')) {
            // This is heuristic and fragile
        }
    }
}

// FORCEFUL STRATEGY:
// Identify the range from `{/* Move Distance X */}` down to the end of the Rotate block.
// And replace it with our new controls.

const startIdx = lines.findIndex(l => l.includes('{/* Move Distance X */}'));

// Find where the wall block content ends.
// It ends before `)}` which is followed by `{/* Dimension Properties */}`
const dimPropsIdx = lines.findIndex(l => l.includes('{/* Dimension Properties */}'));
// Look backwards from dimPropsIdx
let endIdx = dimPropsIdx - 1;
// We need to keep the closing `</div>` of the container "mt-3 pt-3" and the `)}`
// The container closing div is likely line `dimPropsIdx - 2`
// The `)}` is line `dimPropsIdx - 1`

// So start replacing from `startIdx`
// Stop replacing at `dimPropsIdx - 3` (keeping the last closing div of the container)

if (startIdx !== -1 && dimPropsIdx !== -1) {
    const replacementEndIdx = dimPropsIdx - 3; // Keep the last two lines before DimProps (which are usually </div> and )})

    // Check if the lines to remove look correct
    // lines[startIdx] = {/* Move Distance X */}
    // lines[replacementEndIdx] should be the closing </div> of the Rotate block

    const newLines = [
        '                    {/* Wall Length & Height */}',
        '                    <div className="flex justify-between items-center mb-2">',
        '                      <span className="text-gray-500">Length</span>',
        '                      <div className="flex items-center gap-1">',
        '                        <input',
        '                          type="number"',
        '                          value={(() => {',
        '                             if (selectedWall.nodes && selectedWall.nodes.length > 0) {',
        '                               const xs = selectedWall.nodes.map(n => n.x);',
        '                               return Math.round(Math.max(...xs) - Math.min(...xs)) || 0;',
        '                             }',
        '                             return 0;',
        '                          })()}',
        '                          onChange={(e) => {',
        '                            const newLen = Number(e.target.value);',
        '                            if (newLen > 0 && selectedWall.nodes.length > 0) {',
        '                               const xs = selectedWall.nodes.map(n => n.x);',
        '                               const minX = Math.min(...xs);',
        '                               const maxX = Math.max(...xs);',
        '                               const currentLen = maxX - minX;',
        '                               if (currentLen === 0) return;',
        '                               const centerX = (minX + maxX) / 2;',
        '                               const scale = newLen / currentLen;',
        '                               const updatedNodes = selectedWall.nodes.map(node => ({',
        '                                 ...node,',
        '                                 x: centerX + (node.x - centerX) * scale',
        '                               }));',
        '                               updateWall(selectedWall.id, { nodes: updatedNodes });',
        '                            }',
        '                          }}',
        '                          className="sidebar-input w-16 text-right"',
        '                        />',
        '                        <span className="text-xs text-gray-400">mm</span>',
        '                      </div>',
        '                    </div>',
        '',
        '                    <div className="flex justify-between items-center mb-2">',
        '                      <span className="text-gray-500">Height</span>',
        '                      <div className="flex items-center gap-1">',
        '                        <input',
        '                          type="number"',
        '                          value={(selectedWall as any).height || 3000}',
        '                          onChange={(e) => updateWall(selectedWall.id, { height: Number(e.target.value) } as any)}',
        '                          className="sidebar-input w-16 text-right"',
        '                        />',
        '                        <span className="text-xs text-gray-400">mm</span>',
        '                      </div>',
        '                    </div>',
        '',
        '                    {/* Show Dimensions Toggle */}',
        '                    <div className="flex justify-between items-center mb-2 pt-2 border-t border-gray-100">',
        '                      <span className="text-gray-500">Show Dimensions</span>',
        '                      <button',
        '                        onClick={() => updateWall(selectedWall.id, { showDimensions: !(selectedWall as any).showDimensions } as any)}',
        '                        className={`w-10 h-5 rounded-full flex items-center transition-colors px-1 ${',
        '                          (selectedWall as any).showDimensions ? "bg-blue-600 justify-end" : "bg-gray-300 justify-start"',
        '                        }`}',
        '                      >',
        '                        <div className="w-3 h-3 bg-white rounded-full shadow-sm" />',
        '                      </button>',
        '                    </div>',
    ];

    // We remove the range [startIdx, replacementEndIdx] inclusive
    // and insert newLines

    // Let'sverify replacementEndIdx points to the line: </div> closing the Rotate block
    // file lines:
    // ... Rotate block ...
    // ... input ...
    // ... </div> (flex)
    // </div> (container) <-- We want to insert BEFORE this
    // )}
    // {/* Dimension Properties */} (line 1380 in orig view)

    // dimPropsIdx = 1380 (approx)
    // dimPropsIdx - 1 = )}
    // dimPropsIdx - 2 = </div> (container)
    // dimPropsIdx - 3 = </div> (rotate block closing) <-- This is usually what we want to include in deletion

    // So we delete up to and including dimPropsIdx - 3 ? No, we want to replace the content *inside* the container
    // so we delete everything up to the line *before* the container close.

    // Let's use `lines.splice`
    // splice(start, deleteCount, ...items)
    // deleteCount = (dimPropsIdx - 2) - startIdx (?)

    // Actually, simpler:
    // Insert new lines at startIdx
    // Then calculate how many lines to remove
    const removeCount = (dimPropsIdx - 2) - startIdx;

    lines.splice(startIdx, removeCount, ...newLines);
}

fs.writeFileSync('c:/Users/Jeremiah/EventSpacePro-frontend/pages/(components)/editor/PropertiesSidebar.tsx', lines.join('\n'), 'utf8');
