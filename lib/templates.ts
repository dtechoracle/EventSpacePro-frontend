export const TEMPLATES = [
    {
        id: "bedroom",
        name: "Outdoor Event",
        description: "Outdoor event layout with various zones",
        icon: "🌳",
        canvasData: {
            walls: [
                { id: "w1", start: { x: 100, y: 100 }, end: { x: 500, y: 100 }, thickness: 10 },
                { id: "w2", start: { x: 500, y: 100 }, end: { x: 500, y: 500 }, thickness: 10 },
                { id: "w3", start: { x: 500, y: 500 }, end: { x: 100, y: 500 }, thickness: 10 },
                { id: "w4", start: { x: 100, y: 500 }, end: { x: 100, y: 100 }, thickness: 10 }
            ],
            assets: [
                { id: "bed1", type: "furniture-bed-king", x: 250, y: 150, width: 100, height: 120, rotation: 0 },
                { id: "wardrobe1", type: "furniture-wardrobe", x: 120, y: 450, width: 100, height: 40, rotation: 0 }
            ],
            shapes: []
        }
    },
    {
        id: "indoor",
        name: "Indoor Event",
        description: "Indoor event layout with walls and seating",
        icon: "🏠",
        canvasData: {
            walls: [
                { id: "w1", start: { x: 100, y: 100 }, end: { x: 600, y: 100 }, thickness: 10 },
                { id: "w2", start: { x: 600, y: 100 }, end: { x: 600, y: 500 }, thickness: 10 },
                { id: "w3", start: { x: 600, y: 500 }, end: { x: 100, y: 500 }, thickness: 10 },
                { id: "w4", start: { x: 100, y: 500 }, end: { x: 100, y: 100 }, thickness: 10 }
            ],
            assets: [],
            shapes: []
        }
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
