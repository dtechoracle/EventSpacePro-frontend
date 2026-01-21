// Texture pattern definitions for SVG fills
export const texturePatterns = [
  {
    id: 'wood-grain',
    name: 'Wood Grain',
    svg: `<pattern id="wood-grain" patternUnits="userSpaceOnUse" width="500" height="500">
      <rect width="500" height="500" fill="#8B4513"/>
      <path d="M0,50 Q125,25 250,50 T500,50" stroke="#654321" stroke-width="10" fill="none" opacity="0.3"/>
      <path d="M0,150 Q125,125 250,150 T500,150" stroke="#654321" stroke-width="8" fill="none" opacity="0.2"/>
      <path d="M0,250 Q125,240 250,250 T500,250" stroke="#654321" stroke-width="10" fill="none" opacity="0.3"/>
      <path d="M0,350 Q125,340 250,350 T500,350" stroke="#654321" stroke-width="5" fill="none" opacity="0.2"/>
      <path d="M0,450 Q125,440 250,450 T500,450" stroke="#654321" stroke-width="8" fill="none" opacity="0.25"/>
    </pattern>`
  },
  {
    id: 'brick',
    name: 'Brick',
    svg: `<pattern id="brick" patternUnits="userSpaceOnUse" width="300" height="200">
      <rect width="300" height="200" fill="#8B4513"/>
      <rect x="0" y="0" width="140" height="90" fill="#A0522D" stroke="#654321" stroke-width="5"/>
      <rect x="150" y="0" width="140" height="90" fill="#A0522D" stroke="#654321" stroke-width="5"/>
      <rect x="75" y="100" width="140" height="90" fill="#A0522D" stroke="#654321" stroke-width="5"/>
    </pattern>`
  },
  {
    id: 'dots',
    name: 'Dots',
    svg: `<pattern id="dots" patternUnits="userSpaceOnUse" width="100" height="100">
      <rect width="100" height="100" fill="#ffffff"/>
      <circle cx="50" cy="50" r="15" fill="#333333"/>
    </pattern>`
  },
  {
    id: 'diagonal-lines',
    name: 'Diagonal Lines',
    svg: `<pattern id="diagonal-lines" patternUnits="userSpaceOnUse" width="50" height="50">
      <rect width="50" height="50" fill="#ffffff"/>
      <path d="M0,50 L50,0" stroke="#333333" stroke-width="5"/>
    </pattern>`
  },
  {
    id: 'grid',
    name: 'Grid',
    svg: `<pattern id="grid" patternUnits="userSpaceOnUse" width="100" height="100">
      <rect width="100" height="100" fill="#ffffff"/>
      <path d="M0,0 L0,100 M0,0 L100,0" stroke="#cccccc" stroke-width="5"/>
    </pattern>`
  },
  {
    id: 'crosshatch',
    name: 'Crosshatch',
    svg: `<pattern id="crosshatch" patternUnits="userSpaceOnUse" width="50" height="50">
      <rect width="50" height="50" fill="#ffffff"/>
      <path d="M0,0 L50,50 M50,0 L0,50" stroke="#666666" stroke-width="2.5"/>
    </pattern>`
  },
  {
    id: 'marble',
    name: 'Marble',
    svg: `<pattern id="marble" patternUnits="userSpaceOnUse" width="500" height="500">
      <rect width="500" height="500" fill="#f0f0f0"/>
      <path d="M0,100 Q150,75 300,125 T500,100" stroke="#d0d0d0" stroke-width="15" fill="none" opacity="0.5"/>
      <path d="M0,250 Q200,225 350,275 T500,250" stroke="#c0c0c0" stroke-width="10" fill="none" opacity="0.4"/>
      <path d="M0,400 Q125,375 250,425 T500,400" stroke="#d5d5d5" stroke-width="12.5" fill="none" opacity="0.3"/>
    </pattern>`
  },
  {
    id: 'grass',
    name: 'Grass',
    svg: `<pattern id="grass" patternUnits="userSpaceOnUse" width="200" height="200">
      <rect width="200" height="200" fill="#228B22"/>
      <path d="M25,200 L25,150 L35,125 L25,100" stroke="#1a6b1a" stroke-width="5" fill="none"/>
      <path d="M75,200 L75,140 L85,115 L75,90" stroke="#1a6b1a" stroke-width="5" fill="none"/>
      <path d="M125,200 L125,160 L135,135 L125,110" stroke="#1a6b1a" stroke-width="5" fill="none"/>
      <path d="M175,200 L175,150 L185,125 L175,100" stroke="#1a6b1a" stroke-width="5" fill="none"/>
    </pattern>`
  }
  ,
  {
    id: 'sand',
    name: 'Sand',
    svg: `<pattern id="sand" patternUnits="userSpaceOnUse" width="200" height="200">
      <rect width="200" height="200" fill="#F4A460"/>
      <circle cx="20" cy="20" r="2" fill="#D2691E" opacity="0.5"/>
      <circle cx="50" cy="80" r="3" fill="#D2691E" opacity="0.4"/>
      <circle cx="120" cy="40" r="2" fill="#D2691E" opacity="0.5"/>
      <circle cx="160" cy="150" r="3" fill="#D2691E" opacity="0.4"/>
      <circle cx="80" cy="180" r="2" fill="#D2691E" opacity="0.5"/>
      <path d="M0,50 Q50,40 100,50 T200,50" stroke="#D2691E" stroke-width="2" fill="none" opacity="0.2"/>
      <path d="M0,150 Q50,140 100,150 T200,150" stroke="#D2691E" stroke-width="2" fill="none" opacity="0.2"/>
    </pattern>`
  }
];

export type TextureId = 'wood-grain' | 'brick' | 'dots' | 'diagonal-lines' | 'grid' | 'crosshatch' | 'marble' | 'grass' | 'sand';

export function getTextureFill(textureId: TextureId): string {
  return `url(#${textureId})`;
}
