// AI Asset Library - Comprehensive asset knowledge for AI operations
import { ASSET_LIBRARY, AssetDef } from './assets';

export interface AIAssetKnowledge {
    id: string;
    name: string;
    category: string;
    aliases: string[]; // Alternative names users might use
    description: string;
    defaultWidth: number;
    defaultHeight: number;
    tags: string[]; // Searchable tags
}

// Build comprehensive AI knowledge base from asset library
export const AI_ASSET_KNOWLEDGE: AIAssetKnowledge[] = ASSET_LIBRARY.map((asset) => {
    const aliases: string[] = [];
    const tags: string[] = [];
    const name = asset.label.toLowerCase();

    // Extract common patterns and create aliases
    if (name.includes('table')) {
        tags.push('table', 'furniture', 'seating');
        if (name.includes('round')) aliases.push('circular table', 'round table');
        if (name.includes('rectangular')) aliases.push('rect table', 'rectangle table');
        if (name.includes('cocktail')) aliases.push('standing table', 'high table');
        if (name.includes('coffee')) aliases.push('low table', 'lounge table');
    }

    if (name.includes('chair')) {
        tags.push('chair', 'seating', 'furniture');
        if (name.includes('office')) aliases.push('desk chair', 'work chair');
        if (name.includes('event')) aliases.push('banquet chair', 'conference chair');
    }

    if (name.includes('sofa') || name.includes('couch')) {
        tags.push('sofa', 'couch', 'lounge', 'furniture', 'seating');
        aliases.push('couch', 'settee');
    }

    if (name.includes('stage')) {
        tags.push('stage', 'platform', 'layout');
        aliases.push('platform', 'riser');
    }

    if (name.includes('column') || name.includes('coloumn')) {
        tags.push('column', 'pillar', 'structural');
        aliases.push('pillar', 'post');
    }

    if (name.includes('window')) {
        tags.push('window', 'opening', 'architectural');
    }

    // Seating style patterns (now all under 'test')
    if (name.includes('boardroom') || name.includes('auditorium') || name.includes('classroom') || name.includes('banquet')) {
        tags.push('layout', 'arrangement', 'seating style', 'configuration');
        aliases.push(`${asset.label} arrangement`, `${asset.label} layout`, `${asset.label} setup`);
    }

    return {
        id: asset.id,
        name: asset.label,
        category: asset.category,
        aliases,
        description: `${asset.label} from ${asset.category} category`,
        defaultWidth: asset.width || 500,
        defaultHeight: asset.height || 500,
        tags,
    };
});

// Asset search function for AI
export function findAssetByName(query: string): AssetDef | null {
    const q = query.toLowerCase().trim();

    // Exact match on ID or label
    let match = ASSET_LIBRARY.find(
        (a) => a.id.toLowerCase() === q || a.label.toLowerCase() === q
    );
    if (match) return match;

    // Check AI knowledge base for aliases and tags
    const knowledge = AI_ASSET_KNOWLEDGE.find((k) => {
        if (k.name.toLowerCase() === q) return true;
        if (k.aliases.some((alias) => alias.toLowerCase() === q)) return true;
        if (k.tags.some((tag) => tag.toLowerCase() === q)) return true;
        return false;
    });

    if (knowledge) {
        return ASSET_LIBRARY.find((a) => a.id === knowledge.id) || null;
    }

    // Fuzzy match - contains query
    match = ASSET_LIBRARY.find((a) =>
        a.label.toLowerCase().includes(q) || a.id.toLowerCase().includes(q)
    );

    return match || null;
}

// Get assets by category
export function getAssetsByCategory(category: string): AssetDef[] {
    return ASSET_LIBRARY.filter((a) =>
        a.category.toLowerCase() === category.toLowerCase()
    );
}

// Get all asset categories
export function getAllCategories(): string[] {
    return Array.from(new Set(ASSET_LIBRARY.map((a) => a.category)));
}

// Search assets by tags
export function searchAssetsByTags(tags: string[]): AIAssetKnowledge[] {
    return AI_ASSET_KNOWLEDGE.filter((k) =>
        tags.some((tag) => k.tags.includes(tag.toLowerCase()))
    );
}

// Get asset suggestions based on context
export function getAssetSuggestions(context: {
    eventType?: string;
    capacity?: number;
    style?: string;
}): AssetDef[] {
    const suggestions: AssetDef[] = [];

    // Event type based suggestions
    if (context.eventType) {
        const type = context.eventType.toLowerCase();
        if (type.includes('wedding') || type.includes('banquet')) {
            suggestions.push(...getAssetsByCategory('test').filter(a =>
                a.label.includes('Banquet') || a.label.includes('Crescent')
            ));
        }
        if (type.includes('conference') || type.includes('meeting')) {
            suggestions.push(...getAssetsByCategory('test').filter(a =>
                a.label.includes('Boardroom') || a.label.includes('Classroom')
            ));
        }
        if (type.includes('theater') || type.includes('presentation')) {
            suggestions.push(...getAssetsByCategory('test').filter(a =>
                a.label.includes('Theatre') || a.label.includes('Seminar')
            ));
        }
    }

    return suggestions;
}

// Export comprehensive asset list for AI context
export function getAIAssetContext(): string {
    const categories = getAllCategories();
    let context = 'Available Assets:\n\n';

    categories.forEach((category) => {
        const assets = getAssetsByCategory(category);
        context += `${category} (${assets.length} items):\n`;
        assets.forEach((asset) => {
            context += `  - "${asset.label}" (${asset.width}mm x ${asset.height}mm)\n`;
        });
        context += '\n';
    });

    return context;
}

// Get compact asset list for AI (just names and IDs)
export function getCompactAssetList(): { id: string; name: string; category: string }[] {
    return ASSET_LIBRARY.map((a) => ({
        id: a.id,
        name: a.label,
        category: a.category,
    }));
}
