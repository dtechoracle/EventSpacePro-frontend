with open("components/editor/PropertiesSidebar.tsx", "r", encoding="utf-8") as f:
    c = f.read()

# Add state subscription for tableNumberingVisible
old_subscribe = "  const [showTableNumbering, setShowTableNumbering] = useState(false);"
new_subscribe = """  const [showTableNumbering, setShowTableNumbering] = useState(false);
  const tableNumberingVisible = useProjectStore(s => s.tableNumberingVisible ?? true);
  const setTableNumberingVisible = useProjectStore(s => s.setTableNumberingVisible);"""

c = c.replace(old_subscribe, new_subscribe, 1)

# Now update the header section to include a toggle switch
old_header = """          <button
            type="button"
            onClick={() => setShowTableNumbering(s => !s)}
            className="flex w-full items-center justify-between text-left mb-2"
          >
            <div className="text-sm font-bold text-[#0056A9]">Table Numbering</div>
            {showTableNumbering ? <FaChevronDown size={12} className="text-[#0056A9]" /> : <FaChevronRight size={12} className="text-[#0056A9]" />}
          </button>"""

new_header = """          <div className="flex items-center justify-between mb-2">
            <button
              type="button"
              onClick={() => setShowTableNumbering(s => !s)}
              className="flex items-center gap-2 text-left"
            >
              <div className="text-sm font-bold text-[#0056A9]">Table Numbering</div>
              {showTableNumbering ? <FaChevronDown size={12} className="text-[#0056A9]" /> : <FaChevronRight size={12} className="text-[#0056A9]" />}
            </button>
            {/* Enable/disable toggle */}
            <label className="flex items-center gap-1.5 cursor-pointer" title={tableNumberingVisible ? "Hide numbering" : "Show numbering"}>
              <div
                onClick={() => setTableNumberingVisible(!tableNumberingVisible)}
                className={`relative w-8 h-4 rounded-full transition-colors cursor-pointer ${tableNumberingVisible ? 'bg-blue-500' : 'bg-gray-300'}`}
              >
                <div className={`absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white shadow transition-transform ${tableNumberingVisible ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </label>
          </div>"""

if old_header in c:
    c = c.replace(old_header, new_header, 1)
    print("Added tableNumberingVisible toggle to PropertiesSidebar")
else:
    print("HEADER PATTERN NOT FOUND!")

with open("components/editor/PropertiesSidebar.tsx", "w", encoding="utf-8") as f:
    f.write(c)
