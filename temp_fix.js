// Temporary fix - rewrite the problematic section
const fixedContent = `4. **Room-relative positioning**:
   - If user says "starting from right", calculate x positions from room's right edge
   - "3 per vertical row starting from right" = 3 columns, rightmost column at x = roomMaxX - margin
   - Always provide EXACT xMm and yMm coordinates for every item

EXAMPLE for "12 cocktail tables in 3 columns on the right side" in 10m x 8m room:
Room is 10000mm x 8000mm. Calculate 3 columns on right side:
- Column 1 (rightmost): x=9000mm, y values: 1500, 3000, 4500, 6000
- Column 2 (middle): x=7500mm, y values: 1500, 3000, 4500, 6000  
- Column 3 (left): x=6000mm, y values: 1500, 3000, 4500, 6000
Return tables array with 12 items each having exact xMm and yMm coordinates.

**Your Full Capabilities:**`;

console.log(fixedContent);
