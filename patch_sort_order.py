with open('lib/assets.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    '  Venue: 8,',
    '  Venue: 8,\n  Vehicles: 9,'
)

with open('lib/assets.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("Updated CATEGORY_SORT_ORDER")
