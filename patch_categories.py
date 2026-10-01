with open('lib/assets.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    'ASSET_CATEGORIES: AssetCategory[] = ["Furniture", "Layout", "Dance Floor", "Sitting_Styles", "Space_Elements", "Flowers & Plants", "Trees", "Marquee", "Venue"];',
    'ASSET_CATEGORIES: AssetCategory[] = ["Furniture", "Layout", "Dance Floor", "Sitting_Styles", "Space_Elements", "Flowers & Plants", "Trees", "Marquee", "Venue", "Vehicles"];'
)

c = c.replace(
    'export const IMAGE_ASSET_CATEGORIES: readonly AssetCategory[] = ["Flowers & Plants", "Trees"];',
    'export const IMAGE_ASSET_CATEGORIES: readonly AssetCategory[] = ["Flowers & Plants", "Trees", "Vehicles"];'
)

with open('lib/assets.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("Updated categories")
