import { LibreDwg, Dwg_File_Type } from '@mlightcad/libredwg-web';
import type { DwgDatabase, LibreDwgEx } from '@mlightcad/libredwg-web';

let libredwgInstance: LibreDwgEx | null = null;
let initPromise: Promise<LibreDwgEx> | null = null;

async function getLibredwg(): Promise<LibreDwgEx> {
  if (libredwgInstance) return libredwgInstance;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    const instance = await LibreDwg.create('/wasm/');
    libredwgInstance = instance;
    return instance;
  })();

  return initPromise;
}

const svgCache: Record<string, string> = {};

export async function parseDwgToSvg(dwgArrayBuffer: ArrayBuffer): Promise<string> {
  const libredwg = await getLibredwg();

  const dwgData = libredwg.dwg_read_data(dwgArrayBuffer, Dwg_File_Type.DWG);
  if (dwgData === undefined) {
    throw new Error('Failed to parse DWG/DXF file');
  }

  const db: DwgDatabase = libredwg.convert(dwgData);
  libredwg.dwg_free(dwgData);

  const svgString = libredwg.dwg_to_svg(db);
  return svgString;
}

export async function getDwgSvgString(path: string): Promise<string> {
  if (svgCache[path]) return svgCache[path];

  const res = await fetch(path);
  const buffer = await res.arrayBuffer();
  const svgString = await parseDwgToSvg(buffer);
  svgCache[path] = svgString;
  return svgString;
}

export function extractSvgViewBox(svgString: string): { width: number; height: number } | null {
  const viewBoxMatch = svgString.match(/viewBox=["']([^"']+)["']/);
  if (viewBoxMatch) {
    const parts = viewBoxMatch[1].split(/\s+/).map(Number);
    if (parts.length === 4) {
      return { width: parts[2], height: parts[3] };
    }
  }
  const widthMatch = svgString.match(/width=["']([^"']+)["']/);
  const heightMatch = svgString.match(/height=["']([^"']+)["']/);
  if (widthMatch && heightMatch) {
    return { width: parseFloat(widthMatch[1]), height: parseFloat(heightMatch[1]) };
  }
  return null;
}
