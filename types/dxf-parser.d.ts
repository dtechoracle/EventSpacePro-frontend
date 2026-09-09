declare module 'dxf-parser' {
  interface DxfParser {
    parseSync(source: string): {
      entities: Array<{
        type: string;
        layer?: string;
        vertices?: Array<{ x: number; y: number; z: number }>;
        start?: { x: number; y: number; z: number };
        end?: { x: number; y: number; z: number };
        center?: { x: number; y: number; z: number };
        radius?: number;
        startAngle?: number;
        endAngle?: number;
        text?: string;
        height?: number;
        insertionPoint?: { x: number; y: number; z: number };
        majorAxisEndPoint?: { x: number; y: number; z: number };
        ratioOfEllipseAxis?: number;
        polyline?: {
          vertices: Array<{ x: number; y: number; z: number }>;
          isClosed?: boolean;
        };
        points?: Array<{ x: number; y: number; z: number }>;
        bulge?: number;
      }>;
      header?: Record<string, unknown>;
      tables?: Record<string, unknown>;
    };
  }

  const DxfParser: {
    new (): DxfParser;
  };
  export default DxfParser;
}
