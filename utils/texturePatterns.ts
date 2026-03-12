// Texture pattern definitions for SVG fills
export type TextureId =
  | 'grid'
  | 'bricks-01' | 'bricks-02'
  | 'concrete-01' | 'concrete-02' | 'concrete-03' | 'concrete-04'
  | 'dots-01' | 'dots-02'
  | 'grass-01' | 'grass-02' | 'grass-03'
  | 'gravel-01' | 'gravel-02'
  | 'marble-01' | 'marble-02' | 'marble-03'
  | 'paving-01' | 'paving-02'
  | 'porous-cement-wall'
  | 'road-01' | 'road-02' | 'road-03'
  | 'sand-01' | 'sand-02' | 'sand-03'
  | 'soil-01'
  | 'stone-01'
  | 'tile-01' | 'tile-02'
  | 'water-01' | 'water-02'
  | 'white-grunge'
  | 'wood-grain-01' | 'wood-grain-02' | 'wood-grain-03'
  | 'hatch-diagonal-thin' | 'hatch-diagonal-thick' | 'hatch-cross-thin' | 'hatch-vertical-thin' | 'hatch-horizontal-thin'
  | 'hatch-parallel' | 'hatch-cross' | 'hatch-contour' | 'hatch-tick' | 'hatch-scribble' | 'hatch-woven' | 'hatch-stippling' | 'hatch-circulism';

export interface TexturePattern {
  id: TextureId;
  name: string;
  isImage?: boolean;
  path?: string;
  svg?: string;
  tileSize?: number;
}

export const texturePatterns: TexturePattern[] = [
  {
    id: 'grid',
    name: 'Grid',
    svg: `<pattern id="grid" patternUnits="userSpaceOnUse" width="100" height="100">
      <rect width="100" height="100" fill="#ffffff"/>
      <path d="M0,0 L0,100 M0,0 L100,0" stroke="#cccccc" stroke-width="5"/>
    </pattern>`,
    tileSize: 100
  },
  // Generated from directory listing
  { id: 'bricks-01', name: 'Bricks 01', isImage: true, path: '/assets/textures/Bricks 01.png', tileSize: 800 },
  { id: 'bricks-02', name: 'Bricks 02', isImage: true, path: '/assets/textures/Bricks 02.png', tileSize: 800 },
  { id: 'concrete-01', name: 'Concrete 01', isImage: true, path: '/assets/textures/Concrete 01.png', tileSize: 1024 },
  { id: 'concrete-02', name: 'Concrete 02', isImage: true, path: '/assets/textures/Concrete 02.png', tileSize: 1024 },
  { id: 'concrete-03', name: 'Concrete 03', isImage: true, path: '/assets/textures/Concrete 03.png', tileSize: 1024 },
  { id: 'concrete-04', name: 'Concrete 04', isImage: true, path: '/assets/textures/Concrete 04.png', tileSize: 1024 },
  { id: 'dots-01', name: 'Dots 01', isImage: true, path: '/assets/textures/Dots 01.png', tileSize: 400 },
  { id: 'dots-02', name: 'Dots 02', isImage: true, path: '/assets/textures/Dots 02.png', tileSize: 400 },
  { id: 'grass-01', name: 'Grass 01', isImage: true, path: '/assets/textures/Grass 01.png', tileSize: 1024 },
  { id: 'grass-02', name: 'Grass 02', isImage: true, path: '/assets/textures/Grass 02.png', tileSize: 1024 },
  { id: 'grass-03', name: 'Grass 03', isImage: true, path: '/assets/textures/Grass 03.png', tileSize: 1024 },
  { id: 'gravel-01', name: 'Gravel 01', isImage: true, path: '/assets/textures/Gravel 01.png', tileSize: 800 },
  { id: 'gravel-02', name: 'Gravel 02', isImage: true, path: '/assets/textures/Gravel 02.png', tileSize: 800 },
  { id: 'marble-01', name: 'Marble 01', isImage: true, path: '/assets/textures/Marble 01.png', tileSize: 1024 },
  { id: 'marble-02', name: 'Marble 02', isImage: true, path: '/assets/textures/Marble 02.png', tileSize: 1024 },
  { id: 'marble-03', name: 'Marble 03', isImage: true, path: '/assets/textures/Marble 03.png', tileSize: 1024 },
  { id: 'paving-01', name: 'Paving 01', isImage: true, path: '/assets/textures/Paving 01.png', tileSize: 800 },
  { id: 'paving-02', name: 'Paving 02', isImage: true, path: '/assets/textures/Paving 02.png', tileSize: 800 },
  { id: 'porous-cement-wall', name: 'Porous Cement Wall', isImage: true, path: '/assets/textures/porous-cement-wall.jpg', tileSize: 1024 },
  { id: 'road-01', name: 'Road 01', isImage: true, path: '/assets/textures/Road 01.png', tileSize: 1024 },
  { id: 'road-02', name: 'Road 02', isImage: true, path: '/assets/textures/Road 02.png', tileSize: 1024 },
  { id: 'road-03', name: 'Road 03', isImage: true, path: '/assets/textures/Road 03.png', tileSize: 1024 },
  { id: 'sand-01', name: 'Sand 01', isImage: true, path: '/assets/textures/Sand 01.png', tileSize: 800 },
  { id: 'sand-02', name: 'Sand 02', isImage: true, path: '/assets/textures/Sand 02.png', tileSize: 800 },
  { id: 'sand-03', name: 'Sand 03', isImage: true, path: '/assets/textures/Sand 03.png', tileSize: 800 },
  { id: 'soil-01', name: 'Soil 01', isImage: true, path: '/assets/textures/Soil 01.png', tileSize: 800 },
  { id: 'stone-01', name: 'Stone 01', isImage: true, path: '/assets/textures/Stone 01.png', tileSize: 800 },
  { id: 'tile-01', name: 'Tile 01', isImage: true, path: '/assets/textures/Tile 01.png', tileSize: 800 },
  { id: 'tile-02', name: 'Tile 02', isImage: true, path: '/assets/textures/Tile 02.png', tileSize: 800 },
  { id: 'water-01', name: 'Water 01', isImage: true, path: '/assets/textures/Water 01.png', tileSize: 1024 },
  { id: 'water-02', name: 'Water 02', isImage: true, path: '/assets/textures/Water 02.png', tileSize: 1024 },
  { id: 'white-grunge', name: 'White Grunge', isImage: true, path: '/assets/textures/White grunge.jpg', tileSize: 1024 },
  { id: 'wood-grain-01', name: 'Wood Grain 01', isImage: true, path: '/assets/textures/Wood grain 01.png', tileSize: 800 },
  { id: 'wood-grain-02', name: 'Wood Grain 02', isImage: true, path: '/assets/textures/Wood grain 02.png', tileSize: 800 },
  { id: 'wood-grain-03', name: 'Wood Grain 03', isImage: true, path: '/assets/textures/Wood grain 03.png', tileSize: 800 },
  {
    id: 'hatch-diagonal-thin',
    name: 'Diagonal Thin',
    svg: `<pattern id="hatch-diagonal-thin" patternUnits="userSpaceOnUse" width="10" height="10" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="0.5" />
    </pattern>`,
    tileSize: 10
  },
  {
    id: 'hatch-diagonal-thick',
    name: 'Diagonal Thick',
    svg: `<pattern id="hatch-diagonal-thick" patternUnits="userSpaceOnUse" width="20" height="20" patternTransform="rotate(45)">
      <rect x="0" y="0" width="8" height="20" fill="currentColor" fill-opacity="0.9" />
      <line x1="14" y1="0" x2="14" y2="20" stroke="currentColor" stroke-width="1" opacity="0.4" />
    </pattern>`,
    tileSize: 20
  },
  {
    id: 'hatch-cross-thin',
    name: 'Grid Hatch',
    svg: `<pattern id="hatch-cross-thin" patternUnits="userSpaceOnUse" width="10" height="10">
      <line x1="0" y1="0" x2="10" y2="0" stroke="currentColor" stroke-width="1" />
      <line x1="0" y1="0" x2="0" y2="10" stroke="currentColor" stroke-width="1" />
    </pattern>`,
    tileSize: 10
  },
  {
    id: 'hatch-vertical-thin',
    name: 'Vertical Thin',
    svg: `<pattern id="hatch-vertical-thin" patternUnits="userSpaceOnUse" width="6" height="6">
      <line x1="3" y1="0" x2="3" y2="6" stroke="currentColor" stroke-width="0.8" />
      <line x1="0" y1="2" x2="6" y2="2" stroke="currentColor" stroke-width="0.2" opacity="0.3" />
    </pattern>`,
    tileSize: 6
  },
  {
    id: 'hatch-horizontal-thin',
    name: 'Horizontal Thin',
    svg: `<pattern id="hatch-horizontal-thin" patternUnits="userSpaceOnUse" width="8" height="8">
      <line x1="0" y1="4" x2="8" y2="4" stroke="currentColor" stroke-width="1" />
    </pattern>`,
    tileSize: 8
  },
  {
    id: 'hatch-parallel',
    name: 'Parallel Hatching',
    svg: `<pattern id="hatch-parallel" patternUnits="userSpaceOnUse" width="25" height="25" patternTransform="rotate(20)">
      <line x1="5" y1="2" x2="5" y2="23" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" />
      <line x1="12" y1="5" x2="12" y2="20" stroke="currentColor" stroke-width="0.8" stroke-linecap="round" opacity="0.7" />
      <line x1="19" y1="0" x2="19" y2="25" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" />
    </pattern>`,
    tileSize: 25
  },
  {
    id: 'hatch-cross',
    name: 'Cross-Hatching',
    svg: `<pattern id="hatch-cross" patternUnits="userSpaceOnUse" width="15" height="15" patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="15" stroke="currentColor" stroke-width="1" />
      <line x1="0" y1="0" x2="15" y2="0" stroke="currentColor" stroke-width="1" />
      <line x1="7.5" y1="0" x2="7.5" y2="15" stroke="currentColor" stroke-width="0.5" opacity="0.5" />
    </pattern>`,
    tileSize: 15
  },
  {
    id: 'hatch-contour',
    name: 'Contour Hatching',
    svg: `<pattern id="hatch-contour" patternUnits="userSpaceOnUse" width="40" height="40">
      <path d="M0,10 Q20,0 40,10 M0,20 Q20,10 40,20 M0,30 Q20,20 40,30 M0,40 Q20,30 40,40" fill="none" stroke="currentColor" stroke-width="1" />
    </pattern>`,
    tileSize: 40
  },
  {
    id: 'hatch-tick',
    name: 'Tick Hatching',
    svg: `<pattern id="hatch-tick" patternUnits="userSpaceOnUse" width="25" height="25">
      <line x1="2" y1="4" x2="8" y2="2" stroke="currentColor" stroke-width="1" />
      <line x1="15" y1="12" x2="21" y2="10" stroke="currentColor" stroke-width="1" />
      <line x1="6" y1="20" x2="12" y2="18" stroke="currentColor" stroke-width="1" />
      <line x1="18" y1="22" x2="24" y2="20" stroke="currentColor" stroke-width="1" />
    </pattern>`,
    tileSize: 25
  },
  {
    id: 'hatch-scribble',
    name: 'Scribble Hatching',
    svg: `<pattern id="hatch-scribble" patternUnits="userSpaceOnUse" width="50" height="50">
      <path d="M5,15 C15,0 35,45 45,10 C40,40 10,50 5,15 M15,25 C25,10 45,45 25,25" fill="none" stroke="currentColor" stroke-width="1.2" />
    </pattern>`,
    tileSize: 50
  },
  {
    id: 'hatch-woven',
    name: 'Woven Hatching',
    svg: `<pattern id="hatch-woven" patternUnits="userSpaceOnUse" width="40" height="40">
      <line x1="5" y1="10" x2="15" y2="10" stroke="currentColor" stroke-width="1" />
      <line x1="5" y1="15" x2="15" y2="15" stroke="currentColor" stroke-width="1" />
      <line x1="25" y1="25" x2="25" y2="35" stroke="currentColor" stroke-width="1" />
      <line x1="30" y1="25" x2="30" y2="35" stroke="currentColor" stroke-width="1" />
      <line x1="25" y1="10" x2="35" y2="10" stroke="currentColor" stroke-width="1" />
      <line x1="25" y1="15" x2="35" y2="15" stroke="currentColor" stroke-width="1" />
      <line x1="10" y1="25" x2="10" y2="35" stroke="currentColor" stroke-width="1" />
      <line x1="15" y1="25" x2="15" y2="35" stroke="currentColor" stroke-width="1" />
    </pattern>`,
    tileSize: 40
  },
  {
    id: 'hatch-stippling',
    name: 'Stippling',
    svg: `<pattern id="hatch-stippling" patternUnits="userSpaceOnUse" width="30" height="30">
      <circle cx="5" cy="5" r="1.2" fill="currentColor" />
      <circle cx="18" cy="8" r="0.9" fill="currentColor" />
      <circle cx="10" cy="20" r="1.4" fill="currentColor" />
      <circle cx="24" cy="22" r="1" fill="currentColor" />
      <circle cx="8" cy="26" r="1.1" fill="currentColor" />
      <circle cx="20" cy="28" r="0.8" fill="currentColor" />
    </pattern>`,
    tileSize: 30
  },
  {
    id: 'hatch-circulism',
    name: 'Circulism',
    svg: `<pattern id="hatch-circulism" patternUnits="userSpaceOnUse" width="30" height="30">
      <circle cx="8" cy="8" r="5" fill="none" stroke="currentColor" stroke-width="1" />
      <circle cx="22" cy="22" r="6" fill="none" stroke="currentColor" stroke-width="1" />
      <circle cx="22" cy="8" r="3" fill="none" stroke="currentColor" stroke-width="1" />
      <circle cx="8" cy="22" r="4" fill="none" stroke="currentColor" stroke-width="1" />
    </pattern>`,
    tileSize: 30
  },
];

export function getTextureFill(textureId: TextureId): string {
  return `url(#${textureId})`;
}
