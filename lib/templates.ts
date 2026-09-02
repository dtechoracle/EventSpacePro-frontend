import banquetData from './template-banquet.json';
import beachWeddingData from './template-beach-wedding.json';

export type TemplateDef = {
    id: string;
    name: string;
    description: string;
    icon: string;
    canvasData?: {
        walls: { id: string; start: { x: number; y: number }; end: { x: number; y: number }; thickness: number }[];
        assets: { id: string; type: string; x: number; y: number; width: number; height: number; rotation: number }[];
        shapes: any[];
    };
    canvasAssets?: any[];
    canvases?: { size: string; width: number; height: number }[];
    category?: string;
    tags?: string[];
    author?: string;
    authorAvatar?: string;
    rating?: number;
    usageCount?: number;
};

export const TEMPLATES: TemplateDef[] = [
    {
        id: "bedroom",
        name: "Outdoor Event",
        description: "Outdoor beach wedding with stage, seating and entrance arch",
        icon: "🌳",
        canvasAssets: beachWeddingData,
        canvases: [{ size: "layout", width: 20000, height: 20000 }],
    },
    {
        id: "indoor",
        name: "Indoor Event",
        description: "Indoor event layout with walls and seating",
        icon: "🏠",
        canvasAssets: banquetData,
        canvases: [{ size: "layout", width: 80000, height: 32000 }],
    },
    {
        id: "office",
        name: "Marquee Event",
        description: "Large marquee setup for special events",
        icon: "🎪",
        canvasData: {
            walls: [
                { id: "w1", start: { x: 100, y: 100 }, end: { x: 600, y: 100 }, thickness: 10 },
                { id: "w2", start: { x: 600, y: 100 }, end: { x: 600, y: 400 }, thickness: 10 },
                { id: "w3", start: { x: 600, y: 400 }, end: { x: 100, y: 400 }, thickness: 10 },
                { id: "w4", start: { x: 100, y: 400 }, end: { x: 100, y: 100 }, thickness: 10 }
            ],
            assets: [],
            shapes: []
        }
    },
    {
        id: "starter",
        name: "Starter Canvas",
        description: "Empty large canvas ready for design",
        icon: "📐",
        canvasData: {
            walls: [],
            assets: [],
            shapes: []
        }
    }
];
