with open('lib/assets.tsx', 'r', encoding='utf-8') as f:
    c = f.read()

c = c.replace(
    '  | "Venue";',
    '  | "Venue"\n  | "Vehicles";'
)

with open('lib/assets.tsx', 'w', encoding='utf-8') as f:
    f.write(c)
print("Updated type")
