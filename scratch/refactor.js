const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../pages/(components)/editor/PropertiesSidebar.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// Normalize CRLF to LF for reliable string matching
content = content.replace(/\r\n/g, '\n');

// 1. Header update
const targetHeader = `            {/* SELECTED ITEM PROPERTIES */}
            {selectedItem && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-xs font-bold mb-3 uppercase tracking-wider text-gray-500">
                  {itemType} Properties
                </div>`;

const replacementHeader = `            {/* SELECTED ITEM PROPERTIES */}
            {selectedItem && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm font-bold text-blue-600 mb-3">
                  Properties
                </div>`;

if (!content.includes(targetHeader)) {
  console.error("Error: targetHeader not found!");
  process.exit(1);
}
content = content.replace(targetHeader, replacementHeader);
console.log("Successfully replaced Header.");

// 2. Coordinate / Dimension Labels
const labels = [
  {
    target: `<span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Pos X ({unitLabel})</span>`,
    replacement: `<span className="text-xs text-gray-500 mb-1">pos x ({unitLabel})</span>`
  },
  {
    target: `<span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Pos Y ({unitLabel})</span>`,
    replacement: `<span className="text-xs text-gray-500 mb-1">pos y ({unitLabel})</span>`
  },
  {
    target: `<span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Width ({unitLabel})</span>`,
    replacement: `<span className="text-xs text-gray-500 mb-1">width ({unitLabel})</span>`
  },
  {
    target: `<span className="text-[10px] text-gray-400 uppercase font-semibold mb-0.5">Height ({unitLabel})</span>`,
    replacement: `<span className="text-xs text-gray-500 mb-1">height ({unitLabel})</span>`
  }
];

for (const label of labels) {
  if (!content.includes(label.target)) {
    console.error(`Error: Label target not found: ${label.target}`);
    process.exit(1);
  }
  content = content.replace(label.target, label.replacement);
}
console.log("Successfully replaced coordinate and dimension labels.");

// 3. Extract and delete the original Appearance block FIRST
const appStartMarker = `                {/* Appearance (Shape/Asset) */}`;
const appEndMarker = `                {/* Text Annotation Properties */}`;

const startIndex = content.indexOf(appStartMarker);
const endIndex = content.indexOf(appEndMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error("Error: Could not locate Appearance block boundaries!");
  process.exit(1);
}

let appearanceBlock = content.substring(startIndex, endIndex).trim();

// Clean up the appearanceBlock: change "Appearance" header to lowercase "appearance"
appearanceBlock = appearanceBlock.replace(
  `<div className="text-xs font-semibold mb-2 text-gray-600">Appearance</div>`,
  `<div className="text-xs text-gray-500 mb-2">appearance</div>`
);

// Remove the outer wrapper `{(itemType === 'shape' || itemType === 'asset') && (` and matching `)}`
appearanceBlock = appearanceBlock.replace(`{(itemType === 'shape' || itemType === 'asset') && (`, ``);
const lastBraceIndex = appearanceBlock.lastIndexOf(`)}`);
if (lastBraceIndex !== -1) {
  appearanceBlock = appearanceBlock.substring(0, lastBraceIndex) + appearanceBlock.substring(lastBraceIndex + 2);
}
appearanceBlock = appearanceBlock.trim();

// Delete original appearance block
content = content.substring(0, startIndex) + content.substring(endIndex);
console.log("Successfully extracted and deleted original Appearance block.");

// 4. Rotation / Flip + Relocated Appearance
const targetRotation = `                {/* Rotation (Unified Shape/Asset) */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="mb-4 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-gray-500">Rotation</span>
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={roundForDisplay((selectedItem as any).rotation || 0)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (itemType === 'shape') updateShape(selectedItem.id, { rotation: val });
                            if (itemType === 'asset') {
                              updateAsset(selectedItem.id, { rotation: val });
                              updateSceneAsset(selectedItem.id, { rotation: val });
                            }
                          }}
                          className="sidebar-input w-16 text-center"
                        />
                        <span className="ml-1 text-gray-400">°</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const currentRot = (selectedItem as any).rotation || 0;
                          const nextRot = (currentRot + 180) % 360;
                          if (itemType === 'shape') updateShape(selectedItem.id, { rotation: nextRot });
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { rotation: nextRot });
                            updateSceneAsset(selectedItem.id, { rotation: nextRot });
                          }
                        }}
                        className="flex-1 py-1 px-2 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors flex items-center justify-center gap-1"
                        title="Flip Horizontally (Rotates 180°)"
                      >
                        ↔ Flip Horizontal
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const currentRot = (selectedItem as any).rotation || 0;
                          const nextRot = (currentRot + 180) % 360;
                          if (itemType === 'shape') updateShape(selectedItem.id, { rotation: nextRot });
                          if (itemType === 'asset') {
                            updateAsset(selectedItem.id, { rotation: nextRot });
                            updateSceneAsset(selectedItem.id, { rotation: nextRot });
                          }
                        }}
                        className="flex-1 py-1 px-2 text-xs border border-gray-200 rounded hover:bg-gray-50 text-gray-600 transition-colors flex items-center justify-center gap-1"
                        title="Flip Vertically (Rotates 180°)"
                      >
                        ↕ Flip Vertical
                      </button>
                    </div>
                  </div>
                )}`;

// Now construct the replacement for Rotation using string concatenation
const replacementRotation = `                {/* Rotation (Unified Shape/Asset) */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="mb-4 pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-xs text-gray-500">rotation</span>
                      <div className="flex items-center">
                        <input
                          type="number"
                          value={roundForDisplay((selectedItem as any).rotation || 0)}
                          onChange={(e) => {
                            const val = Number(e.target.value);
                            if (itemType === 'shape') updateShape(selectedItem.id, { rotation: val });
                            if (itemType === 'asset') {
                              updateAsset(selectedItem.id, { rotation: val });
                              updateSceneAsset(selectedItem.id, { rotation: val });
                            }
                          }}
                          className="sidebar-input w-16 text-center"
                        />
                        <span className="ml-1 text-gray-400">°</span>
                      </div>
                    </div>

                    {/* Redesigned Flip Controls */}
                    <div className="flex justify-between items-center mb-3 py-2 border-t border-gray-100">
                      <span className="text-xs text-gray-500">flip</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          title="Horizontal"
                          onClick={() => {
                            const next = !(selectedItem as any).flipY;
                            if (itemType === 'shape') updateShape(selectedItem.id, { flipY: next });
                            if (itemType === 'asset') {
                              updateAsset(selectedItem.id, { flipY: next });
                              updateSceneAsset(selectedItem.id, { flipY: next });
                            }
                          }}
                          className={\`px-3 py-1 text-xs border rounded transition-colors \${(selectedItem as any).flipY ? 'bg-blue-100 border-blue-200 text-blue-600 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}\`}
                        >H</button>
                        <button
                          type="button"
                          title="Vertical"
                          onClick={() => {
                            const next = !(selectedItem as any).flipX;
                            if (itemType === 'shape') updateShape(selectedItem.id, { flipX: next });
                            if (itemType === 'asset') {
                              updateAsset(selectedItem.id, { flipX: next });
                              updateSceneAsset(selectedItem.id, { flipX: next });
                            }
                          }}
                          className={\`px-3 py-1 text-xs border rounded transition-colors \${(selectedItem as any).flipX ? 'bg-blue-100 border-blue-200 text-blue-600 font-medium' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}\`}
                        >V</button>
                      </div>
                    </div>

                    {/* Relocated Appearance Section */}
` + "                    " + appearanceBlock + `
                  </div>
                )}`;

if (!content.includes(targetRotation)) {
  console.error("Error: targetRotation block not found!");
  process.exit(1);
}
content = content.replace(targetRotation, replacementRotation);
console.log("Successfully replaced Rotation and relocated Appearance.");

// 5. Simplify Auto Dimensions Display (Shape/Asset)
const autoDimStart = `                {/* Auto Dimensions Settings */}`;
const wallDimStart = `                {/* Dimensions (Wall specific) */}`;
const autoDimIndex = content.indexOf(autoDimStart);
const wallDimIndex = content.indexOf(wallDimStart);

console.log("autoDimStart in content:", content.includes(autoDimStart));
console.log("wallDimStart in content:", content.includes(wallDimStart));
console.log("autoDimIndex:", autoDimIndex, "wallDimIndex:", wallDimIndex);

if (autoDimIndex === -1 || wallDimIndex === -1) {
  console.error("Error: Could not locate Auto Dimensions Display section!");
  process.exit(1);
}

const simplifiedAutoDim = `                {/* Auto Dimensions Settings */}
                {(itemType === 'shape' || itemType === 'asset') && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-3">
                      dimensions display
                    </div>

                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Show Dimensions</span>
                      <button
                        onClick={() => {
                          const val = !((selectedItem as any).showDimensions);
                          if (itemType === 'shape') updateShape(selectedItem.id, { showDimensions: val });
                          if (itemType === 'asset') updateAsset(selectedItem.id, { showDimensions: val });
                        }}
                        className={\`w-10 h-5 rounded-full flex items-center transition-colors px-1 \${(selectedItem as any).showDimensions ? 'bg-blue-600' : 'bg-gray-300'
                          }\`}
                      >
                        <div
                          className={\`w-3.5 h-3.5 bg-white rounded-full shadow-sm transform transition-transform \${(selectedItem as any).showDimensions ? 'translate-x-5' : 'translate-x-0'
                            }\`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                `;

content = content.substring(0, autoDimIndex) + simplifiedAutoDim + content.substring(wallDimIndex);
console.log("Successfully simplified Auto Dimensions section.");

// 6. Simplify Wall Dimensions Display Settings
const newWallDimStart = `                {/* Dimensions (Wall specific) */}`;
const arrowPropStart = `                {/* ARROW PROPERTIES */}`;
const newWallIndex = content.indexOf(newWallDimStart);
const arrowIndex = content.indexOf(arrowPropStart);

if (newWallIndex === -1 || arrowIndex === -1) {
  console.error("Error: Could not locate Wall Specific Dimensions section!");
  process.exit(1);
}

const simplifiedWallDim = `                {/* Dimensions (Wall specific) */}
                {itemType === 'wall' && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="text-xs text-gray-500 mb-3">
                      dimensions display
                    </div>

                    <div className="flex justify-between items-center mb-2">
                      <span className="text-gray-500">Show Dimensions</span>
                      <button
                        onClick={() => {
                          const val = !((selectedItem as any).showDimensions);
                          updateWall(selectedItem.id, { showDimensions: val });
                        }}
                        className={\`w-10 h-5 rounded-full flex items-center transition-colors px-1 \${(selectedItem as any).showDimensions ? 'bg-blue-600' : 'bg-gray-300'
                          }\`}
                      >
                        <div
                          className={\`w-3.5 h-3.5 bg-white rounded-full shadow-sm transform transition-transform \${(selectedItem as any).showDimensions ? 'translate-x-5' : 'translate-x-0'
                            }\`}
                        />
                      </button>
                    </div>
                  </div>
                )}

                `;

content = content.substring(0, newWallIndex) + simplifiedWallDim + content.substring(arrowIndex);
console.log("Successfully simplified Wall specific dimensions section.");

fs.writeFileSync(filePath, content, 'utf8');
console.log("Refactoring written back successfully!");
