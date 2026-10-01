with open("components/editor/ExportPanel.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# Fix ExportPanel.tsx
old_is_sitting = """        // Strictly Seating / Tables keyword check
        const sittingKeywords = ['chair', 'table', 'stool', 'sofa', 'bench', 'seater'];
        const matchesKeyword = sittingKeywords.some(kw => name.includes(kw));"""

new_is_sitting = """        // Strictly Seating / Tables keyword check
        const sittingKeywords = ['chair', 'table', 'stool', 'sofa', 'bench', 'seater'];
        let matchesKeyword = sittingKeywords.some(kw => name.includes(kw));
        
        // Exclude singular tables (tables without 'seater' or 'chairs' in the name)
        if (matchesKeyword && name.includes('table') && !name.includes('seater') && !name.match(/\d+\s*chairs/)) {
            matchesKeyword = false;
        }"""

c = c.replace(old_is_sitting, new_is_sitting)
with open("components/editor/ExportPanel.tsx", "w", encoding="utf-8") as f:
    f.write(c)
print("Updated ExportPanel.tsx")
