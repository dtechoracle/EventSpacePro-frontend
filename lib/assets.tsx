export type AssetCategory =
  | "Furniture"
  | "Layout"
  | "Dance Floor"
  | "Sitting_Styles"
  | "Space_Elements"
  | "Flowers & Plants"
  | "Trees"
  | "Marquee"
  | "Venue"
  | "Vehicles";

export type AssetDef = {
  name: string
  id: string
  label: string
  path: string
  category: AssetCategory
  width?: number
  height?: number
}

export const ASSET_CATEGORIES: AssetCategory[] = ["Furniture", "Layout", "Dance Floor", "Sitting_Styles", "Space_Elements", "Flowers & Plants", "Trees", "Marquee", "Venue", "Vehicles"];

/** PNG/image assets — no SVG fill/stroke controls; free-resizable on canvas. */
export const IMAGE_ASSET_CATEGORIES: readonly AssetCategory[] = ["Flowers & Plants", "Trees", "Vehicles"];

import { MARQUEES } from './marquees';
import { PRELOADED_VENUES } from './preloadedVenues';

const CATEGORY_SORT_ORDER: Record<AssetCategory, number> = {
  Furniture: 0,
  Layout: 1,
  "Dance Floor": 2,
  Sitting_Styles: 3,
  Space_Elements: 4,
  "Flowers & Plants": 5,
  Trees: 6,
  Marquee: 7,
  Venue: 8,
  Vehicles: 9,
};

const getAssetArea = (asset: AssetDef) => (asset.width || 0) * (asset.height || 0);
const getNormalizedDims = (asset: AssetDef) => {
  const width = asset.width || 0;
  const height = asset.height || 0;
  return {
    shortSide: Math.min(width, height),
    longSide: Math.max(width, height),
  };
};

const getFurnitureSeatCount = (asset: AssetDef) => {
  const label = asset.label.toLowerCase();
  const explicitSeater = label.match(/(\d+)\s*seater/);
  if (explicitSeater) return Number(explicitSeater[1]);
  if (label.includes('4000mm') || label.includes('1470mm')) return 12;
  if (label.includes('4300mm')) return 10;
  if (label.includes('2150mm')) return 6;

  if (
    label.includes('chair') ||
    label.includes('stool') ||
    label.includes('seminar') ||
    label.includes('office chair') ||
    label.includes('event chair') ||
    label.includes('bar stool')
  ) {
    return 1;
  }

  return Number.POSITIVE_INFINITY;
};

export const compareAssetsForDisplay = (a: AssetDef, b: AssetDef) => {
  const categoryDelta = CATEGORY_SORT_ORDER[a.category] - CATEGORY_SORT_ORDER[b.category];
  if (categoryDelta !== 0) return categoryDelta;

  if (a.category === "Furniture") {
    const seatDelta = getFurnitureSeatCount(a) - getFurnitureSeatCount(b);
    if (seatDelta !== 0) return seatDelta;

    const aDims = getNormalizedDims(a);
    const bDims = getNormalizedDims(b);
    const shortSideDelta = aDims.shortSide - bDims.shortSide;
    if (shortSideDelta !== 0) return shortSideDelta;

    const longSideDelta = aDims.longSide - bDims.longSide;
    if (longSideDelta !== 0) return longSideDelta;

    const areaDelta = getAssetArea(a) - getAssetArea(b);
    if (areaDelta !== 0) return areaDelta;

    const widthDelta = (a.width || 0) - (b.width || 0);
    if (widthDelta !== 0) return widthDelta;

    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
  }

  if (a.category === "Marquee" || a.category === "Layout" || a.category === "Dance Floor") {
    const aDims = getNormalizedDims(a);
    const bDims = getNormalizedDims(b);
    const shortSideDelta = aDims.shortSide - bDims.shortSide;
    if (shortSideDelta !== 0) return shortSideDelta;

    const longSideDelta = aDims.longSide - bDims.longSide;
    if (longSideDelta !== 0) return longSideDelta;

    const areaDelta = getAssetArea(a) - getAssetArea(b);
    if (areaDelta !== 0) return areaDelta;

    const widthDelta = (a.width || 0) - (b.width || 0);
    if (widthDelta !== 0) return widthDelta;

    const heightDelta = (a.height || 0) - (b.height || 0);
    if (heightDelta !== 0) return heightDelta;

    return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
  }

  const areaDelta = getAssetArea(a) - getAssetArea(b);
  if (areaDelta !== 0) return areaDelta;

  return a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
};

const MARQUEE_ASSETS: AssetDef[] = MARQUEES.map(m => ({
    id: m.id,
    label: m.name,
    path: m.path,
    category: "Marquee",
    width: m.width,
    height: m.height,
    name: m.name
}));

const PRELOADED_VENUE_ASSETS: AssetDef[] = PRELOADED_VENUES.map(v => ({
    id: v.id,
    label: v.name,
    path: v.path,
    category: "Venue",
    width: v.width,
    height: v.height,
    name: v.name
}));

const RAW_ASSET_LIBRARY: AssetDef[] = [
    ...MARQUEE_ASSETS,
    ...PRELOADED_VENUE_ASSETS,
  {
    "id": "10-seater-rectangular-table",
    "label": "10 seater rectangular table",
    "path": "/assets/modal/Furniture/10 seater rectangular table.svg",
    "category": "Furniture",
    "width": 2700,
    "height": 2018,
    "name": "10 seater rectangular table"
  },
  {
    "id": "10-seater-round-table-01",
    "label": "10 seater round table 01",
    "path": "/assets/modal/Furniture/10 seater round table 01.svg",
    "category": "Furniture",
    "width": 2710,
    "height": 2718,
    "name": "10 seater round table 01"
  },
  {
    "id": "10-seater-round-table-02",
    "label": "10 seater round table 02",
    "path": "/assets/modal/Furniture/10 seater round table 02.svg",
    "category": "Furniture",
    "width": 2932,
    "height": 2880,
    "name": "10 seater round table 02"
  },
  {
    "id": "10-seater-serpentine-table",
    "label": "10 seater serpentine table",
    "path": "/assets/modal/Furniture/10 seater serpentine table.svg",
    "category": "Furniture",
    "width": 2983,
    "height": 6573,
    "name": "10 seater serpentine table"
  },
  {
    "id": "10-seater-square-table",
    "label": "10 seater square table",
    "path": "/assets/modal/Furniture/10 seater square table.svg",
    "category": "Furniture",
    "width": 2577,
    "height": 2631,
    "name": "10 seater square table"
  },
  {
    "id": "10-seater-crescent-table",
    "label": "10 seater Crescent Table",
    "path": "/assets/modal/Furniture/10 seater Crescent Table.svg",
    "category": "Furniture",
    "width": 4000,
    "height": 2135,
    "name": "10 seater Crescent Table"
  },
  {
    "id": "1000mm-cocktail-table",
    "label": "1000mm Cocktail table",
    "path": "/assets/modal/Furniture/1000mm Cocktail table.svg",
    "category": "Furniture",
    "width": 1000,
    "height": 1000,
    "name": "1000mm Cocktail table"
  },
  {
    "id": "12-seater-curve-sofa",
    "label": "12 Seater Curve Sofa",
    "path": "/assets/modal/Furniture/12 Seater Curve Sofa.svg",
    "category": "Furniture",
    "width": 3321,
    "height": 3331,
    "name": "12 Seater Curve Sofa"
  },
  {
    "id": "12-seater-round-table-01",
    "label": "12 seater round table 01",
    "path": "/assets/modal/Furniture/12 seater round table 01.svg",
    "category": "Furniture",
    "width": 2868,
    "height": 2868,
    "name": "12 seater round table 01"
  },
  {
    "id": "12-seater-round-table-02",
    "label": "12 seater round table 02",
    "path": "/assets/modal/Furniture/12 seater round table 02.svg",
    "category": "Furniture",
    "width": 3173,
    "height": 3173,
    "name": "12 seater round table 02"
  },
  {
    "id": "1200mm-(4ft)-round-table",
    "label": "1200mm (4ft) round table",
    "path": "/assets/modal/Furniture/1200mm (4ft) round table.svg",
    "category": "Furniture",
    "width": 1200,
    "height": 1200,
    "name": "1200mm (4ft) round table"
  },
  {
    "id": "1200mm-x-600mm-coffee-table",
    "label": "1200mm X 600mm Coffee Table",
    "path": "/assets/modal/Furniture/1200mm X 600mm Coffee Table.svg",
    "category": "Furniture",
    "width": 1200,
    "height": 600,
    "name": "1200mm X 600mm Coffee Table"
  },
  {
    "id": "1300mm-x-650mm-coffee-table",
    "label": "1300mm X 650mm Coffee Table",
    "path": "/assets/modal/Furniture/1300mm X 650mm Coffee Table.svg",
    "category": "Furniture",
    "width": 1296,
    "height": 648,
    "name": "1300mm X 650mm Coffee Table"
  },
  {
    "id": "1500mm-(5ft)-round-table",
    "label": "1500mm (5ft) round table",
    "path": "/assets/modal/Furniture/1500mm (5ft) round table.svg",
    "category": "Furniture",
    "width": 1500,
    "height": 1500,
    "name": "1500mm (5ft) round table"
  },
  {
    "id": "16-executive-table",
    "label": "16 executive table",
    "path": "/assets/modal/Furniture/16 executive table.svg",
    "category": "Furniture",
    "width": 6720,
    "height": 2520,
    "name": "16 executive table"
  },
  {
    "id": "16-seater-round-table",
    "label": "16 seater round table",
    "path": "/assets/modal/Furniture/16 seater round table.svg",
    "category": "Furniture",
    "width": 3468,
    "height": 3468,
    "name": "16 seater round table"
  },
  {
    "id": "18-seater-oval-table",
    "label": "18 seater oval table",
    "path": "/assets/modal/Furniture/18 seater oval table.svg",
    "category": "Furniture",
    "width": 2417,
    "height": 4800,
    "name": "18 seater oval table"
  },
  {
    "id": "1800mm-(6ft)-round-table",
    "label": "1800mm (6ft) round table",
    "path": "/assets/modal/Furniture/1800mm (6ft) round table.svg",
    "category": "Furniture",
    "width": 1800,
    "height": 1800,
    "name": "1800mm (6ft) round table"
  },
  {
    "id": "2-seater-sofa-01",
    "label": "2 Seater Sofa 01",
    "path": "/assets/modal/Furniture/2 Seater Sofa 01.svg",
    "category": "Furniture",
    "width": 1504,
    "height": 690,
    "name": "2 Seater Sofa 01"
  },
  {
    "id": "2-seater-sofa-02",
    "label": "2 Seater Sofa 02",
    "path": "/assets/modal/Furniture/2 Seater Sofa 02.svg",
    "category": "Furniture",
    "width": 1400,
    "height": 810,
    "name": "2 Seater Sofa 02"
  },
  {
    "id": "2-seater-sofa-03",
    "label": "2 Seater Sofa 03",
    "path": "/assets/modal/Furniture/2 Seater Sofa 03.svg",
    "category": "Furniture",
    "width": 1210,
    "height": 800,
    "name": "2 Seater Sofa 03"
  },
  {
    "id": "2-seater-sofa-with-pillows",
    "label": "2 Seater Sofa with pillows",
    "path": "/assets/modal/Furniture/2 Seater Sofa with pillows.svg",
    "category": "Furniture",
    "width": 1565,
    "height": 796,
    "name": "2 Seater Sofa with pillows"
  },
  {
    "id": "20-seater-doughtnut-table",
    "label": "20 seater doughtnut table",
    "path": "/assets/modal/Furniture/20 seater doughtnut table.svg",
    "category": "Furniture",
    "width": 4442,
    "height": 4442,
    "name": "20 seater doughtnut table"
  },
  {
    "id": "20-seater-oval-table",
    "label": "20 seater Oval Table",
    "path": "/assets/modal/Furniture/20 seater Oval Table.svg",
    "category": "Furniture",
    "width": 5000,
    "height": 2670,
    "name": "20 seater Oval Table"
  },
  {
    "id": "20-seater-intertwined-crescent-table",
    "label": "20 seater Intertwined Crescent Table",
    "path": "/assets/modal/Furniture/20 seater Intertwined Crescent Table.svg",
    "category": "Furniture",
    "width": 4200,
    "height": 3294,
    "name": "20 seater Intertwined Crescent Table"
  },
  {
    "id": "2400mm-(8ft)-round-table",
    "label": "2400mm (8ft) round table",
    "path": "/assets/modal/Furniture/2400mm (8ft) round table.svg",
    "category": "Furniture",
    "width": 2450,
    "height": 2450,
    "name": "2400mm (8ft) round table"
  },
  {
    "id": "3-seater-sofa-01",
    "label": "3 Seater Sofa 01",
    "path": "/assets/modal/Furniture/3 Seater Sofa 01.svg",
    "category": "Furniture",
    "width": 2104,
    "height": 690,
    "name": "3 Seater Sofa 01"
  },
  {
    "id": "3-seater-sofa-02",
    "label": "3 Seater Sofa 02",
    "path": "/assets/modal/Furniture/3 Seater Sofa 02.svg",
    "category": "Furniture",
    "width": 2000,
    "height": 810,
    "name": "3 Seater Sofa 02"
  },
  {
    "id": "3-seater-sofa-03",
    "label": "3 Seater Sofa 03",
    "path": "/assets/modal/Furniture/3 Seater Sofa 03.svg",
    "category": "Furniture",
    "width": 1820,
    "height": 800,
    "name": "3 Seater Sofa 03"
  },
  {
    "id": "3-seater-sofa-with-pillows",
    "label": "3 Seater Sofa with pillows",
    "path": "/assets/modal/Furniture/3 Seater Sofa with pillows.svg",
    "category": "Furniture",
    "width": 2031,
    "height": 808,
    "name": "3 Seater Sofa with pillows"
  },
  {
    "id": "40-seater-figure-8-donut-table",
    "label": "40 seater Figure 8 Donut Table",
    "path": "/assets/modal/Furniture/40 seater Figure 8 Donut Table.svg",
    "category": "Furniture",
    "width": 7500,
    "height": 4003,
    "name": "40 seater Figure 8 Donut Table"
  },
  {
    "id": "4-seater-cocktail-table",
    "label": "4 seater cocktail table",
    "path": "/assets/modal/Furniture/4 seater cocktail table.svg",
    "category": "Furniture",
    "width": 1779,
    "height": 1779,
    "name": "4 seater cocktail table"
  },
  {
    "id": "4-seater-round-table",
    "label": "4 seater round table",
    "path": "/assets/modal/Furniture/4 seater round table.svg",
    "category": "Furniture",
    "width": 2028,
    "height": 2028,
    "name": "4 seater round table"
  },
  {
    "id": "4-seater-vip-table",
    "label": "4 seater VIP table",
    "path": "/assets/modal/Furniture/4 seater VIP table.svg",
    "category": "Furniture",
    "width": 2500,
    "height": 1409,
    "name": "4 seater VIP table"
  },
  {
    "id": "4000mm-x-1470mm-oval-table",
    "label": "12 seater 4000mm X 1470mm Oval Table",
    "path": "/assets/modal/Furniture/4000mm X 1470mm Oval Table.svg",
    "category": "Furniture",
    "width": 4000,
    "height": 1470,
    "name": "12 seater 4000mm X 1470mm Oval Table"
  },
  {
    "id": "4300mm-x-2150mm-crescent-table",
    "label": "10 seater 4300mm X 2150mm Crescent Table",
    "path": "/assets/modal/Furniture/4300mm X 2150mm Crescent Table.svg",
    "category": "Furniture",
    "width": 4300,
    "height": 2150,
    "name": "10 seater 4300mm X 2150mm Crescent Table"
  },
  {
    "id": "2150mm-x-2150mm-crescent-table",
    "label": "6 seater 2150mm X 2150mm Crescent Table",
    "path": "/assets/modal/Furniture/2150mm X 2150mm Crescent Table.svg",
    "category": "Furniture",
    "width": 2150,
    "height": 2150,
    "name": "6 seater 2150mm X 2150mm Crescent Table"
  },
  {
    "id": "5-seater-curve-sofa",
    "label": "5 Seater Curve Sofa",
    "path": "/assets/modal/Furniture/5 Seater Curve Sofa.svg",
    "category": "Furniture",
    "width": 2412,
    "height": 1487,
    "name": "5 Seater Curve Sofa"
  },
  {
    "id": "5-seater-vip-table",
    "label": "5 seater VIP table",
    "path": "/assets/modal/Furniture/5 seater VIP table.svg",
    "category": "Furniture",
    "width": 2700,
    "height": 1409,
    "name": "5 seater VIP table"
  },
  {
    "id": "500mm-x-700mm-coffee-table",
    "label": "500mm X 700mm Coffee Table",
    "path": "/assets/modal/Furniture/500mm X 700mm Coffee Table.svg",
    "category": "Furniture",
    "width": 500,
    "height": 700,
    "name": "500mm X 700mm Coffee Table"
  },
  {
    "id": "6-seater-l-shaped-sofa",
    "label": "6 Seater L Shaped Sofa",
    "path": "/assets/modal/Furniture/6 Seater L Shaped Sofa.svg?v=4",
    "category": "Furniture",
    "width": 3506,
    "height": 2746,
    "name": "6 Seater L Shaped Sofa"
  },
  {
    "id": "6-seater-rectangular-table",
    "label": "6 seater rectangular table",
    "path": "/assets/modal/Furniture/6 seater rectangular table.svg",
    "category": "Furniture",
    "width": 2000,
    "height": 2018,
    "name": "6 seater rectangular table"
  },
  {
    "id": "6-seater-round-table-01",
    "label": "6 seater round table 01",
    "path": "/assets/modal/Furniture/6 seater round table 01.svg",
    "category": "Furniture",
    "width": 2179,
    "height": 2278,
    "name": "6 seater round table 01"
  },
  {
    "id": "6-seater-round-table-02",
    "label": "6 seater round table 02",
    "path": "/assets/modal/Furniture/6 seater round table 02.svg",
    "category": "Furniture",
    "width": 2273,
    "height": 2157,
    "name": "6 seater round table 02"
  },
  {
    "id": "6ft-by-2.5ft-rectangular-table",
    "label": "6ft by 2.5ft Rectangular Table",
    "path": "/assets/modal/Furniture/6ft by 2.5ft Rectangular Table.svg",
    "category": "Furniture",
    "width": 1850,
    "height": 850,
    "name": "6ft by 2.5ft Rectangular Table"
  },
  {
    "id": "6ft-x-3ft-rectangular-table",
    "label": "6ft X 3ft Rectangular Table",
    "path": "/assets/modal/Furniture/6ft X 3ft Rectangular Table.svg",
    "category": "Furniture",
    "width": 1850,
    "height": 850,
    "name": "6ft X 3ft Rectangular Table"
  },
  {
    "id": "700mm-cocktail-table",
    "label": "700mm Cocktail table",
    "path": "/assets/modal/Furniture/700mm Cocktail table.svg",
    "category": "Furniture",
    "width": 700,
    "height": 700,
    "name": "700mm Cocktail table"
  },
  {
    "id": "8-seater-rectangular-table",
    "label": "8 seater rectangular table",
    "path": "/assets/modal/Furniture/8 seater rectangular table.svg",
    "category": "Furniture",
    "width": 2500,
    "height": 2018,
    "name": "8 seater rectangular table"
  },
  {
    "id": "8-seater-round-table-(1250mm-table)",
    "label": "8 seater round table (1250mm table)",
    "path": "/assets/modal/Furniture/8 seater round table (1250mm table).svg",
    "category": "Furniture",
    "width": 2278,
    "height": 2278,
    "name": "8 seater round table (1250mm table)"
  },
  {
    "id": "8-seater-round-table-(1550mm-table)",
    "label": "8 seater round table (1550mm table)",
    "path": "/assets/modal/Furniture/8 seater round table (1550mm table).svg",
    "category": "Furniture",
    "width": 2578,
    "height": 2578,
    "name": "8 seater round table (1550mm table)"
  },
  {
    "id": "8-seater-round-table-02",
    "label": "8 seater round table 02",
    "path": "/assets/modal/Furniture/8 seater round table 02.svg",
    "category": "Furniture",
    "width": 2557,
    "height": 2557,
    "name": "8 seater round table 02"
  },
  {
    "id": "8-seater-crescent-table",
    "label": "8 seater Crescent Table",
    "path": "/assets/modal/Furniture/8 seater Crescent Table.svg",
    "category": "Furniture",
    "width": 3600,
    "height": 1823,
    "name": "8 seater Crescent Table"
  },
  {
    "id": "8ft-by-2.5ft-rectangular-table",
    "label": "8ft by 2.5ft Rectangular Table",
    "path": "/assets/modal/Furniture/8ft by 2.5ft Rectangular Table.svg",
    "category": "Furniture",
    "width": 2450,
    "height": 850,
    "name": "8ft by 2.5ft Rectangular Table"
  },
  {
    "id": "900mm-x-900mm-coffee-table",
    "label": "900mm X 900mm Coffee Table",
    "path": "/assets/modal/Furniture/900mm X 900mm Coffee Table.svg",
    "category": "Furniture",
    "width": 900,
    "height": 900,
    "name": "900mm X 900mm Coffee Table"
  },
  {
    "id": "bar-stool",
    "label": "Bar Stool",
    "path": "/assets/modal/Furniture/Bar Stool.svg",
    "category": "Furniture",
    "width": 410,
    "height": 426,
    "name": "Bar Stool"
  },
  {
    "id": "cocktail-stool-1",
    "label": "Cocktail Stool 1",
    "path": "/assets/modal/Furniture/Cocktail Stool 1.svg",
    "category": "Furniture",
    "width": 476,
    "height": 494,
    "name": "Cocktail Stool 1"
  },
  {
    "id": "cocktail-stool-2",
    "label": "Cocktail Stool 2",
    "path": "/assets/modal/Furniture/Cocktail Stool 2.svg",
    "category": "Furniture",
    "width": 508,
    "height": 510,
    "name": "Cocktail Stool 2"
  },
  {
    "id": "event-chair-1",
    "label": "Event Chair 1",
    "path": "/assets/modal/Furniture/Event Chair 1.svg",
    "category": "Furniture",
    "width": 482,
    "height": 517,
    "name": "Event Chair 1"
  },
  {
    "id": "event-chair-2",
    "label": "Event Chair 2",
    "path": "/assets/modal/Furniture/Event Chair 2.svg",
    "category": "Furniture",
    "width": 437,
    "height": 501,
    "name": "Event Chair 2"
  },
  {
    "id": "event-chair-3",
    "label": "Event Chair 3",
    "path": "/assets/modal/Furniture/Event Chair 3.svg",
    "category": "Furniture",
    "width": 488,
    "height": 575,
    "name": "Event Chair 3"
  },
  {
    "id": "event-chair-4",
    "label": "Event Chair 4",
    "path": "/assets/modal/Furniture/Event Chair 4.svg",
    "category": "Furniture",
    "width": 421,
    "height": 470,
    "name": "Event Chair 4"
  },
  {
    "id": "l-shaped-sofa-01",
    "label": "L Shaped Sofa 01",
    "path": "/assets/modal/Furniture/L Shaped Sofa 01.svg",
    "category": "Furniture",
    "width": 3506,
    "height": 1928,
    "name": "L Shaped Sofa 01"
  },
  {
    "id": "l-shaped-sofa-02",
    "label": "L Shaped Sofa 02",
    "path": "/assets/modal/Furniture/L Shaped Sofa 02.svg",
    "category": "Furniture",
    "width": 3000,
    "height": 2300,
    "name": "L Shaped Sofa 02"
  },
  {
    "id": "office-chair-1",
    "label": "Office Chair 1",
    "path": "/assets/modal/Furniture/Office Chair 1.svg",
    "category": "Furniture",
    "width": 448,
    "height": 534,
    "name": "Office Chair 1"
  },
  {
    "id": "office-chair-2",
    "label": "Office Chair 2",
    "path": "/assets/modal/Furniture/Office Chair 2.svg",
    "category": "Furniture",
    "width": 630,
    "height": 510,
    "name": "Office Chair 2"
  },
  {
    "id": "office-chair-3",
    "label": "Office Chair 3",
    "path": "/assets/modal/Furniture/Office Chair 3.svg",
    "category": "Furniture",
    "width": 645,
    "height": 457,
    "name": "Office Chair 3"
  },
  {
    "id": "seminar-chair",
    "label": "Seminar Chair",
    "path": "/assets/modal/Furniture/Seminar Chair.svg",
    "category": "Furniture",
    "width": 525,
    "height": 675,
    "name": "Seminar Chair"
  },
  {
    "id": "sofa-set-with-coffe-table-01",
    "label": "Sofa set with coffe table 01",
    "path": "/assets/modal/Furniture/Sofa set with coffe table 01.svg",
    "category": "Furniture",
    "width": 3725,
    "height": 2118,
    "name": "Sofa set with coffe table 01"
  },
  {
    "id": "sofa-set-with-coffe-table-02",
    "label": "Sofa set with coffe table 02",
    "path": "/assets/modal/Furniture/Sofa set with coffe table 02.svg",
    "category": "Furniture",
    "width": 3168,
    "height": 1893,
    "name": "Sofa set with coffe table 02"
  },
  {
    "id": "sofa-set-with-coffe-table-03",
    "label": "Sofa set with coffe table 03",
    "path": "/assets/modal/Furniture/Sofa set with coffe table 03.svg",
    "category": "Furniture",
    "width": 3506,
    "height": 2746,
    "name": "Sofa set with coffe table 03"
  },
  {
    "id": "sofa-set-with-coffe-table-04",
    "label": "Sofa set with coffe table 04",
    "path": "/assets/modal/Furniture/Sofa set with coffe table 04.svg",
    "category": "Furniture",
    "width": 3912,
    "height": 2411,
    "name": "Sofa set with coffe table 04"
  },
  {
    "id": "sofa-set-with-coffe-table-05",
    "label": "Sofa set with coffe table 05",
    "path": "/assets/modal/Furniture/Sofa set with coffe table 05.svg",
    "category": "Furniture",
    "width": 3749,
    "height": 2326,
    "name": "Sofa set with coffe table 05"
  },
  {
    "id": "1m-x-1m-modular-stage",
    "label": "1m X 1m modular stage",
    "path": "/assets/modal/Layout/1m X 1m modular stage.svg",
    "category": "Layout",
    "width": 1000,
    "height": 1000,
    "name": "1m X 1m modular stage"
  },
  {
    "id": "2ft-x-2ft-modular-stage",
    "label": "2ft X 2ft modular stage",
    "path": "/assets/modal/Layout/2ft X 2ft modular stage.svg",
    "category": "Layout",
    "width": 600,
    "height": 600,
    "name": "2ft X 2ft modular stage"
  },
  {
    "id": "2ft-x-4ft-modular-stage",
    "label": "2ft X 4ft modular stage",
    "path": "/assets/modal/Layout/2ft X 4ft modular stage.svg",
    "category": "Layout",
    "width": 1200,
    "height": 600,
    "name": "2ft X 4ft modular stage"
  },
  {
    "id": "3ft-x-3ft-modular-stage",
    "label": "3ft X 3ft modular stage",
    "path": "/assets/modal/Layout/3ft X 3ft modular stage.svg",
    "category": "Layout",
    "width": 900,
    "height": 900,
    "name": "3ft X 3ft modular stage"
  },
  {
    "id": "500mm-x-500mm-modular-stage",
    "label": "500mm X 500mm Modular Stage",
    "path": "/assets/modal/Layout/500mm X 500mm Modular Stage.svg",
    "category": "Layout",
    "width": 826,
    "height": 826,
    "name": "500mm X 500mm Modular Stage"
  },
  {
    "id": "24ft-by-12ft-stage",
    "label": "24ft by 12ft Stage",
    "path": "/assets/modal/Layout/24ft by 12ft Stage.svg",
    "category": "Layout",
    "width": 7200,
    "height": 3600,
    "name": "24ft by 12ft Stage"
  },
  {
    "id": "36ft-by-12ft-stage",
    "label": "36ft by 12ft Stage",
    "path": "/assets/modal/Layout/36ft by 12ft Stage.svg",
    "category": "Layout",
    "width": 10800,
    "height": 3600,
    "name": "36ft by 12ft Stage"
  },
  {
    "id": "40ft-by-12ft-stage",
    "label": "40ft by 12ft Stage",
    "path": "/assets/modal/Layout/40ft by 12ft Stage.svg",
    "category": "Layout",
    "width": 12000,
    "height": 3600,
    "name": "40ft by 12ft Stage"
  },
  {
    "id": "16ft-by-16ft-dance-floor",
    "label": "16ft by 16ft Dance Floor",
    "path": "/assets/modal/Dance Floor/16ft by 16ft Dance Floor.svg",
    "category": "Dance Floor",
    "width": 4800,
    "height": 4800,
    "name": "16ft by 16ft Dance Floor"
  },
  {
    "id": "16ft-by-16ft-round-dance-floor",
    "label": "16ft by 16ft Round Dance Floor",
    "path": "/assets/modal/Dance Floor/16ft by 16ft Round Dance Floor.svg",
    "category": "Dance Floor",
    "width": 4800,
    "height": 4800,
    "name": "16ft by 16ft Round Dance Floor"
  },
  {
    "id": "20ft-by-20ft-dance-floor",
    "label": "20ft by 20ft Dance Floor",
    "path": "/assets/modal/Dance Floor/20ft by 20ft Dance Floor.svg",
    "category": "Dance Floor",
    "width": 6000,
    "height": 6000,
    "name": "20ft by 20ft Dance Floor"
  },
  {
    "id": "20ft-by-20ft-round-dance-floor",
    "label": "20ft by 20ft Round Dance Floor",
    "path": "/assets/modal/Dance Floor/20ft by 20ft Round Dance Floor.svg",
    "category": "Dance Floor",
    "width": 6000,
    "height": 6000,
    "name": "20ft by 20ft Round Dance Floor"
  },
  {
    "id": "banquet",
    "label": "Banquet",
    "path": "/assets/modal/Sitting_Styles/Banquet.svg",
    "category": "Sitting_Styles",
    "width": 10443,
    "height": 10443,
    "name": "Banquet"
  },
  {
    "id": "boardroom",
    "label": "Boardroom",
    "path": "/assets/modal/Sitting_Styles/Boardroom.svg",
    "category": "Sitting_Styles",
    "width": 6943,
    "height": 2843,
    "name": "Boardroom"
  },
  {
    "id": "chevron",
    "label": "Chevron",
    "path": "/assets/modal/Sitting_Styles/Chevron.svg",
    "category": "Sitting_Styles",
    "width": 7578,
    "height": 8568,
    "name": "Chevron"
  },
  {
    "id": "circle",
    "label": "Circle",
    "path": "/assets/modal/Sitting_Styles/Circle.svg",
    "category": "Sitting_Styles",
    "width": 7952,
    "height": 7952,
    "name": "Circle"
  },
  {
    "id": "classroom",
    "label": "Classroom",
    "path": "/assets/modal/Sitting_Styles/Classroom.svg",
    "category": "Sitting_Styles",
    "width": 7100,
    "height": 5472,
    "name": "Classroom"
  },
  {
    "id": "crescent-or-cabaret",
    "label": "Crescent or Cabaret",
    "path": "/assets/modal/Sitting_Styles/Crescent or Cabaret.svg",
    "category": "Sitting_Styles",
    "width": 10443,
    "height": 5972,
    "name": "Crescent or Cabaret"
  },
  {
    "id": "horseshoe",
    "label": "Horseshoe",
    "path": "/assets/modal/Sitting_Styles/Horseshoe.svg",
    "category": "Sitting_Styles",
    "width": 6943,
    "height": 7772,
    "name": "Horseshoe"
  },
  {
    "id": "oval-boardroom",
    "label": "Oval Boardroom",
    "path": "/assets/modal/Sitting_Styles/Oval Boardroom.svg",
    "category": "Sitting_Styles",
    "width": 8453,
    "height": 2853,
    "name": "Oval Boardroom"
  },
  {
    "id": "semi---circle",
    "label": "Semi - Circle",
    "path": "/assets/modal/Sitting_Styles/Semi - Circle.svg",
    "category": "Sitting_Styles",
    "width": 7952,
    "height": 4259,
    "name": "Semi - Circle"
  },
  {
    "id": "seminar",
    "label": "Seminar",
    "path": "/assets/modal/Sitting_Styles/Seminar.svg",
    "category": "Sitting_Styles",
    "width": 6890,
    "height": 3060,
    "name": "Seminar"
  },
  {
    "id": "theatre-or-auditorium",
    "label": "Theatre or Auditorium",
    "path": "/assets/modal/Sitting_Styles/Theatre or Auditorium.svg",
    "category": "Sitting_Styles",
    "width": 4791,
    "height": 6572,
    "name": "Theatre or Auditorium"
  },
  {
    "id": "u-shape",
    "label": "U-Shape",
    "path": "/assets/modal/Sitting_Styles/U-Shape.svg",
    "category": "Sitting_Styles",
    "width": 5743,
    "height": 6272,
    "name": "U-Shape"
  },
  {
    "id": "1100mm-swing-door",
    "label": "1100mm Swing Door",
    "path": "/assets/modal/Space_Elements/1100mm Swing Door.svg",
    "category": "Space_Elements",
    "width": 1100,
    "height": 1160,
    "name": "1100mm Swing Door"
  },
  {
    "id": "1200mm-double-swing-door",
    "label": "1200mm Double Swing Door",
    "path": "/assets/modal/Space_Elements/1200mm Double Swing Door.svg",
    "category": "Space_Elements",
    "width": 1200,
    "height": 678,
    "name": "1200mm Double Swing Door"
  },
  {
    "id": "1200mm-swing-door",
    "label": "1200mm Swing Door",
    "path": "/assets/modal/Space_Elements/1200mm Swing Door.svg",
    "category": "Space_Elements",
    "width": 1200,
    "height": 1259,
    "name": "1200mm Swing Door"
  },
  {
    "id": "1200mm-window",
    "label": "1200mm Window",
    "path": "/assets/modal/Space_Elements/1200mm Window.svg",
    "category": "Space_Elements",
    "width": 1200,
    "height": 200,
    "name": "1200mm Window"
  },
  {
    "id": "1500mm-double-swing-door",
    "label": "1500mm Double Swing Door",
    "path": "/assets/modal/Space_Elements/1500mm Double Swing Door.svg",
    "category": "Space_Elements",
    "width": 1500,
    "height": 790,
    "name": "1500mm Double Swing Door"
  },
  {
    "id": "1500mm-window",
    "label": "1500mm Window",
    "path": "/assets/modal/Space_Elements/1500mm Window.svg",
    "category": "Space_Elements",
    "width": 1500,
    "height": 200,
    "name": "1500mm Window"
  },
  {
    "id": "1700mm-revolving-door",
    "label": "1700mm Revolving Door",
    "path": "/assets/modal/Space_Elements/1700mm Revolving Door.svg",
    "category": "Space_Elements",
    "width": 2000,
    "height": 1700,
    "name": "1700mm Revolving Door"
  },
  {
    "id": "1800mm-double-swing-door",
    "label": "1800mm Double Swing Door",
    "path": "/assets/modal/Space_Elements/1800mm Double Swing Door.svg",
    "category": "Space_Elements",
    "width": 1800,
    "height": 900,
    "name": "1800mm Double Swing Door"
  },
  {
    "id": "1800mm-window",
    "label": "1800mm Window",
    "path": "/assets/modal/Space_Elements/1800mm Window.svg",
    "category": "Space_Elements",
    "width": 1800,
    "height": 200,
    "name": "1800mm Window"
  },
  {
    "id": "2400mm-window",
    "label": "2400mm Window",
    "path": "/assets/modal/Space_Elements/2400mm Window.svg",
    "category": "Space_Elements",
    "width": 2400,
    "height": 200,
    "name": "2400mm Window"
  },
  {
    "id": "30mm-round-coloumn",
    "label": "30mm Round Coloumn",
    "path": "/assets/modal/Space_Elements/30mm Round Coloumn.svg",
    "category": "Space_Elements",
    "width": 487,
    "height": 451,
    "name": "30mm Round Coloumn"
  },
  {
    "id": "600mm-square-coloumn",
    "label": "600mm Square Coloumn",
    "path": "/assets/modal/Space_Elements/600mm Square Coloumn.svg",
    "category": "Space_Elements",
    "width": 693,
    "height": 695,
    "name": "600mm Square Coloumn"
  },
  {
    "id": "700mm-swing-door",
    "label": "700mm Swing Door",
    "path": "/assets/modal/Space_Elements/700mm Swing Door.svg",
    "category": "Space_Elements",
    "width": 700,
    "height": 720,
    "name": "700mm Swing Door"
  },
  {
    "id": "900mm-swing-door",
    "label": "900mm Swing Door",
    "path": "/assets/modal/Space_Elements/900mm Swing Door.svg",
    "category": "Space_Elements",
    "width": 900,
    "height": 920,
    "name": "900mm Swing Door"
  },
  {
    "id": "900mm-window",
    "label": "900mm Window",
    "path": "/assets/modal/Space_Elements/900mm Window.svg",
    "category": "Space_Elements",
    "width": 900,
    "height": 200,
    "name": "900mm Window"
  },
  {
    "id": "grass-patch",
    "label": "Grass patch",
    "path": "/assets/modal/Flowers & Plants/Grass patch.png",
    "category": "Flowers & Plants",
    "width": 805,
    "height": 731,
    "name": "Grass patch"
  },
  {
    "id": "plant-01",
    "label": "Plant 01",
    "path": "/assets/modal/Flowers & Plants/Plant 01.png",
    "category": "Flowers & Plants",
    "width": 774,
    "height": 740,
    "name": "Plant 01"
  },
  {
    "id": "plant-02",
    "label": "Plant 02",
    "path": "/assets/modal/Flowers & Plants/Plant 02.png",
    "category": "Flowers & Plants",
    "width": 750,
    "height": 703,
    "name": "Plant 02"
  },
  {
    "id": "plant-03",
    "label": "Plant 03",
    "path": "/assets/modal/Flowers & Plants/Plant 03.png",
    "category": "Flowers & Plants",
    "width": 778,
    "height": 725,
    "name": "Plant 03"
  },
  {
    "id": "plant-04",
    "label": "Plant 04",
    "path": "/assets/modal/Flowers & Plants/Plant 04.png",
    "category": "Flowers & Plants",
    "width": 733,
    "height": 725,
    "name": "Plant 04"
  },
  {
    "id": "plant-05",
    "label": "Plant 05",
    "path": "/assets/modal/Flowers & Plants/Plant 05.png",
    "category": "Flowers & Plants",
    "width": 667,
    "height": 750,
    "name": "Plant 05"
  },
  {
    "id": "plant-06",
    "label": "Plant 06",
    "path": "/assets/modal/Flowers & Plants/Plant 06.png",
    "category": "Flowers & Plants",
    "width": 720,
    "height": 679,
    "name": "Plant 06"
  },
  {
    "id": "plant-07",
    "label": "Plant 07",
    "path": "/assets/modal/Flowers & Plants/Plant 07.png",
    "category": "Flowers & Plants",
    "width": 748,
    "height": 708,
    "name": "Plant 07"
  },
  {
    "id": "plant-08",
    "label": "Plant 08",
    "path": "/assets/modal/Flowers & Plants/Plant 08.png",
    "category": "Flowers & Plants",
    "width": 707,
    "height": 742,
    "name": "Plant 08"
  },
  {
    "id": "plant-09",
    "label": "Plant 09",
    "path": "/assets/modal/Flowers & Plants/Plant 09.png",
    "category": "Flowers & Plants",
    "width": 655,
    "height": 685,
    "name": "Plant 09"
  },
  {
    "id": "plant-10",
    "label": "Plant 10",
    "path": "/assets/modal/Flowers & Plants/Plant 10.png",
    "category": "Flowers & Plants",
    "width": 714,
    "height": 708,
    "name": "Plant 10"
  },
  {
    "id": "plant-11",
    "label": "Plant 11",
    "path": "/assets/modal/Flowers & Plants/Plant 11.png",
    "category": "Flowers & Plants",
    "width": 859,
    "height": 864,
    "name": "Plant 11"
  },
  {
    "id": "plant-12",
    "label": "Plant 12",
    "path": "/assets/modal/Flowers & Plants/Plant 12.png",
    "category": "Flowers & Plants",
    "width": 831,
    "height": 815,
    "name": "Plant 12"
  },
  {
    "id": "plant-13",
    "label": "Plant 13",
    "path": "/assets/modal/Flowers & Plants/Plant 13.png",
    "category": "Flowers & Plants",
    "width": 850,
    "height": 925,
    "name": "Plant 13"
  },
  {
    "id": "plant-14",
    "label": "Plant 14",
    "path": "/assets/modal/Flowers & Plants/Plant 14.png",
    "category": "Flowers & Plants",
    "width": 719,
    "height": 785,
    "name": "Plant 14"
  },
  {
    "id": "plant-15",
    "label": "Plant 15",
    "path": "/assets/modal/Flowers & Plants/Plant 15.png",
    "category": "Flowers & Plants",
    "width": 779,
    "height": 751,
    "name": "Plant 15"
  },
  {
    "id": "plant-16",
    "label": "Plant 16",
    "path": "/assets/modal/Flowers & Plants/Plant 16.png",
    "category": "Flowers & Plants",
    "width": 791,
    "height": 747,
    "name": "Plant 16"
  },
  {
    "id": "shrubs",
    "label": "Shrubs",
    "path": "/assets/modal/Flowers & Plants/Shrubs.png",
    "category": "Flowers & Plants",
    "width": 1612,
    "height": 571,
    "name": "Shrubs"
  },
  {
    "id": "tree-01",
    "label": "Tree 01",
    "path": "/assets/modal/Trees/Tree 01.png",
    "category": "Trees",
    "width": 2106,
    "height": 2198,
    "name": "Tree 01"
  },
  {
    "id": "tree-02",
    "label": "Tree 02",
    "path": "/assets/modal/Trees/Tree 02.png",
    "category": "Trees",
    "width": 2208,
    "height": 2258,
    "name": "Tree 02"
  },
  {
    "id": "tree-03",
    "label": "Tree 03",
    "path": "/assets/modal/Trees/Tree 03.png",
    "category": "Trees",
    "width": 2132,
    "height": 2222,
    "name": "Tree 03"
  },
  {
    "id": "tree-04",
    "label": "Tree 04",
    "path": "/assets/modal/Trees/Tree 04.png",
    "category": "Trees",
    "width": 1954,
    "height": 1916,
    "name": "Tree 04"
  },
  {
    "id": "tree-05",
    "label": "Tree 05",
    "path": "/assets/modal/Trees/Tree 05.png",
    "category": "Trees",
    "width": 2128,
    "height": 1966,
    "name": "Tree 05"
  },
  {
      "id": "bike",
      "label": "Bike",
      "path": "/assets/modal/Vehicles/Bike.png",
      "category": "Vehicles",
      "width": 639,
      "height": 426,
      "name": "Bike"
  },
  {
      "id": "boat",
      "label": "Boat",
      "path": "/assets/modal/Vehicles/Boat.png",
      "category": "Vehicles",
      "width": 1000,
      "height": 549,
      "name": "Boat"
  },
  {
      "id": "vehicle-01",
      "label": "Vehicle 01",
      "path": "/assets/modal/Vehicles/Vehicle 01.png",
      "category": "Vehicles",
      "width": 3976,
      "height": 2204,
      "name": "Vehicle 01"
  },
  {
      "id": "vehicle-02",
      "label": "Vehicle 02",
      "path": "/assets/modal/Vehicles/Vehicle 02.png",
      "category": "Vehicles",
      "width": 3704,
      "height": 1920,
      "name": "Vehicle 02"
  },
  {
      "id": "vehicle-03",
      "label": "Vehicle 03",
      "path": "/assets/modal/Vehicles/Vehicle 03.png",
      "category": "Vehicles",
      "width": 3800,
      "height": 2132,
      "name": "Vehicle 03"
  },
  {
      "id": "vehicle-04",
      "label": "Vehicle 04",
      "path": "/assets/modal/Vehicles/Vehicle 04.png",
      "category": "Vehicles",
      "width": 3400,
      "height": 1776,
      "name": "Vehicle 04"
  },
  {
      "id": "vehicle-05",
      "label": "Vehicle 05",
      "path": "/assets/modal/Vehicles/Vehicle 05.png",
      "category": "Vehicles",
      "width": 3788,
      "height": 1900,
      "name": "Vehicle 05"
  },
  {
      "id": "vehicle-06",
      "label": "Vehicle 06",
      "path": "/assets/modal/Vehicles/Vehicle 06.png",
      "category": "Vehicles",
      "width": 3644,
      "height": 2060,
      "name": "Vehicle 06"
  }
];

export const VENUE_ASSET_LIBRARY: AssetDef[] = PRELOADED_VENUES.map((v) => ({
  id: v.id,
  name: v.name,
  label: v.name,
  path: v.path,
  category: "Venue" as const,
  width: v.width,
  height: v.height,
}));

export const ASSET_LIBRARY: AssetDef[] = [...RAW_ASSET_LIBRARY, ...VENUE_ASSET_LIBRARY].filter((a, i, arr) => arr.findIndex((b) => b.id === a.id) === i).sort(compareAssetsForDisplay);
