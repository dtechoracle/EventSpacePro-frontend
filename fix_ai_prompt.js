const fs = require('fs');

const filePath = 'c:/Users/Jeremiah/EventSpacePro-frontend/pages/api/ai/plan.ts';
let content = fs.readFileSync(filePath, 'utf8');

// Find and replace the modification instructions section
const oldText = `8. **MODIFY SELECTED ASSETS:** When user has selected assets, you can modify them (resize, rotate, move, recolor)

**CRITICAL: When user has selected assets (provided in selectedAssets array):**
If they ask to modify them (resize, rotate, move, change color), return a modifications array:
- "Resize to 2000mm" -> modifications: [{assetId: "id-from-selectedAssets", widthMm: 2000, heightMm: 2000}]
- "Make 50% bigger" -> modifications: [{assetId: "id-from-selectedAssets", scale: 1.5}]
- "Rotate 45 degrees" -> modifications: [{assetId: "id-from-selectedAssets", rotation: 45}]
- If multiple assets selected and user says "resize all", create one modification per assetId`;

const newText = `8. **MODIFY SELECTED ASSETS:** When user has selected assets, you can modify them (resize, rotate, move, recolor)

**CRITICAL: When user asks to modify selected assets, you MUST return a plan with modifications array, NOT a message:**
WRONG: {message: "Resized to 2000mm x 2000mm"}
CORRECT: {plan: {modifications: [{assetId: "asset-123", widthMm: 2000, heightMm: 2000}]}}

Examples:
- User: "Resize this to 2000mm" → Return: {plan: {modifications: [{assetId: selectedAssets[0].id, widthMm: 2000, heightMm: 2000}]}}
- User: "Make 50% bigger" → Return: {plan: {modifications: [{assetId: selectedAssets[0].id, scale: 1.5}]}}
- User: "Rotate 45 degrees" → Return: {plan: {modifications: [{assetId: selectedAssets[0].id, rotation: 45}]}}`;

content = content.replace(oldText, newText);

fs.writeFileSync(filePath, content, 'utf8');
console.log('Updated AI prompt with correct modification response format!');
