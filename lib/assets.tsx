export type AssetCategory =
  | "Funiture"
  | "Layout"
  | "Sitting Styles"
  | "Windows and column"

export type AssetDef = {
  id: string
  label: string
  path: string
  category: AssetCategory
}

export const ASSET_LIBRARY: AssetDef[] = [
  { id: "4 seater cocktail table", label: "4 seater cocktail table", path: "/assets/modal/Funiture/4 seater cocktail table.svg", category: "Funiture" },
  { id: "4 seater round table", label: "4 seater round table", path: "/assets/modal/Funiture/4 seater round table.svg", category: "Funiture" },
  { id: "6 Seater L Shaped Sofa", label: "6 Seater L Shaped Sofa", path: "/assets/modal/Funiture/6 Seater L Shaped Sofa.svg", category: "Funiture" },
  { id: "6 seater rectangular table 4", label: "6 seater rectangular table 4", path: "/assets/modal/Funiture/6 seater rectangular table 4.svg", category: "Funiture" },
  { id: "6 seater rectangular table 5", label: "6 seater rectangular table 5", path: "/assets/modal/Funiture/6 seater rectangular table 5.svg", category: "Funiture" },
  { id: "6 seater round table", label: "6 seater round table", path: "/assets/modal/Funiture/6 seater round table.svg", category: "Funiture" },
  { id: "6ft x 3ft Rectangular Table", label: "6ft x 3ft Rectangular Table", path: "/assets/modal/Funiture/6ft x 3ft Rectangular Table.svg", category: "Funiture" },
  { id: "8 seater round table (1550mm table)", label: "8 seater round table (1550mm table)", path: "/assets/modal/Funiture/8 seater round table (1550mm table).svg", category: "Funiture" },
  { id: "10 seater rectangular table 1", label: "10 seater rectangular table 1", path: "/assets/modal/Funiture/10 seater rectangular table 1.svg", category: "Funiture" },
  { id: "10 seater rectangular table 2", label: "10 seater rectangular table 2", path: "/assets/modal/Funiture/10 seater rectangular table 2.svg", category: "Funiture" },
  { id: "10 seater rectangular table 3", label: "10 seater rectangular table 3", path: "/assets/modal/Funiture/10 seater rectangular table 3.svg", category: "Funiture" },
  { id: "10 seater round table", label: "10 seater round table", path: "/assets/modal/Funiture/10 seater round table.svg", category: "Funiture" },
  { id: "12 seater round table", label: "12 seater round table", path: "/assets/modal/Funiture/12 seater round table.svg", category: "Funiture" },
  { id: "16 seater round table", label: "16 seater round table", path: "/assets/modal/Funiture/16 seater round table.svg", category: "Funiture" },
  { id: "16_SEATER_EXECUTIVE_TABLE", label: "16_SEATER_EXECUTIVE_TABLE", path: "/assets/modal/Funiture/16_SEATER_EXECUTIVE_TABLE.svg", category: "Funiture" },
  { id: "20 seater doughtnut table", label: "20 seater doughtnut table", path: "/assets/modal/Funiture/20 seater doughtnut table.svg", category: "Funiture" },
  { id: "900mm X 900mm Coffee Table", label: "900mm X 900mm Coffee Table", path: "/assets/modal/Funiture/900mm X 900mm Coffee Table.svg", category: "Funiture" },
  { id: "1000mm Cocktail table", label: "1000mm Cocktail table", path: "/assets/modal/Funiture/1000mm Cocktail table.svg", category: "Funiture" },
  { id: "1200mm X 600mm Coffee Table", label: "1200mm X 600mm Coffee Table", path: "/assets/modal/Funiture/1200mm X 600mm Coffee Table.svg", category: "Funiture" },
  { id: "1300mm X 650mm Coffee Table", label: "1300mm X 650mm Coffee Table", path: "/assets/modal/Funiture/1300mm X 650mm Coffee Table.svg", category: "Funiture" },
  { id: "1500mm (5ft) round table", label: "1500mm (5ft) round table", path: "/assets/modal/Funiture/1500mm (5ft) round table.svg", category: "Funiture" },
  { id: "1800mm (6ft) round table", label: "1800mm (6ft) round table", path: "/assets/modal/Funiture/1800mm (6ft) round table.svg", category: "Funiture" },
  { id: "Event Chair", label: "Event Chair", path: "/assets/modal/Funiture/Event Chair.svg", category: "Funiture" },
  { id: "Group", label: "Group", path: "/assets/modal/Funiture/Group.svg", category: "Funiture" },
  { id: "Office Chair", label: "Office Chair", path: "/assets/modal/Funiture/Office Chair.svg", category: "Funiture" },

  { id: "1m X 1m modular stage 1", label: "1m X 1m modular stage 1", path: "/assets/modal/Layout/1m X 1m modular stage 1.svg", category: "Layout" },
  { id: "2ft x 2ft modular stage", label: "2ft x 2ft modular stage", path: "/assets/modal/Layout/2ft x 2ft modular stage.svg", category: "Layout" },
  { id: "2ft x 4ft modular stage", label: "2ft x 4ft modular stage", path: "/assets/modal/Layout/2ft x 4ft modular stage.svg", category: "Layout" },
  { id: "3ft x 3ft modular stage", label: "3ft x 3ft modular stage", path: "/assets/modal/Layout/3ft x 3ft modular stage.svg", category: "Layout" },
  { id: "500mm X 500mm Modular Stage", label: "500mm X 500mm Modular Stage", path: "/assets/modal/Layout/500mm X 500mm Modular Stage.svg", category: "Layout" },

  { id: "Banquet", label: "Banquet", path: "/assets/modal/Sitting Styles/Banquet.svg", category: "Sitting Styles" },
  { id: "Boardroom", label: "Boardroom", path: "/assets/modal/Sitting Styles/Boardroom.svg", category: "Sitting Styles" },
  { id: "Chevron", label: "Chevron", path: "/assets/modal/Sitting Styles/Chevron.svg", category: "Sitting Styles" },
  { id: "Circle", label: "Circle", path: "/assets/modal/Sitting Styles/Circle.svg", category: "Sitting Styles" },
  { id: "Classroom", label: "Classroom", path: "/assets/modal/Sitting Styles/Classroom.svg", category: "Sitting Styles" },
  { id: "Crescent or Cabaret", label: "Crescent or Cabaret", path: "/assets/modal/Sitting Styles/Crescent or Cabaret.svg", category: "Sitting Styles" },
  { id: "Horseshoe", label: "Horseshoe", path: "/assets/modal/Sitting Styles/Horseshoe.svg", category: "Sitting Styles" },
  { id: "Oval Boardroom", label: "Oval Boardroom", path: "/assets/modal/Sitting Styles/Oval Boardroom.svg", category: "Sitting Styles" },
  { id: "Semi - Circle", label: "Semi - Circle", path: "/assets/modal/Sitting Styles/Semi - Circle.svg", category: "Sitting Styles" },
  { id: "Seminar", label: "Seminar", path: "/assets/modal/Sitting Styles/Seminar.svg", category: "Sitting Styles" },
  { id: "Theatre or Auditorium", label: "Theatre or Auditorium", path: "/assets/modal/Sitting Styles/Theatre or Auditorium.svg", category: "Sitting Styles" },
  { id: "U-Shape", label: "U-Shape", path: "/assets/modal/Sitting Styles/U-Shape.svg", category: "Sitting Styles" },

  { id: "Round Coloumn", label: "Round Coloumn", path: "/assets/modal/Windows and column/Round Coloumn.svg", category: "Windows and column" },
  { id: "SQUARE_COLOUMN", label: "SQUARE_COLOUMN", path: "/assets/modal/Windows and column/SQUARE_COLOUMN.svg", category: "Windows and column" },
  { id: "Window", label: "Window", path: "/assets/modal/Windows and column/Window.svg", category: "Windows and column" },
]

