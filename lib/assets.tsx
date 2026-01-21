export type AssetCategory =
  | "Funiture"
  | "Layout"
  | "Sitting Styles"
  | "Windows and column"

export type AssetDef = {
  name: string
  id: string
  label: string
  path: string
  category: AssetCategory
  width?: number
  height?: number
}

export const ASSET_LIBRARY: AssetDef[] = [
  {
    id: "4 seater cocktail table", label: "4 seater cocktail table", path: "/assets/modal/Funiture/4 seater cocktail table.svg", category: "Funiture", width: 489, height: 489,
    name: ""
  },
  {
    id: "4 seater round table", label: "4 seater round table", path: "/assets/modal/Funiture/4 seater round table.svg", category: "Funiture", width: 795, height: 795,
    name: ""
  },
  {
    id: "6 Seater L Shaped Sofa", label: "6 Seater L Shaped Sofa", path: "/assets/modal/Funiture/6 Seater L Shaped Sofa.svg", category: "Funiture", width: 713, height: 559,
    name: ""
  },
  {
    id: "6 seater rectangular table 4", label: "6 seater rectangular table 4", path: "/assets/modal/Funiture/6 seater rectangular table 4.svg", category: "Funiture", width: 374, height: 463,
    name: ""
  },
  {
    id: "6 seater rectangular table 5", label: "6 seater rectangular table 5", path: "/assets/modal/Funiture/6 seater rectangular table 5.svg", category: "Funiture", width: 374, height: 463,
    name: ""
  },
  {
    id: "6 seater round table", label: "6 seater round table", path: "/assets/modal/Funiture/6 seater round table.svg", category: "Funiture", width: 787, height: 822,
    name: ""
  },
  {
    id: "6ft x 3ft Rectangular Table", label: "6ft x 3ft Rectangular Table", path: "/assets/modal/Funiture/6ft x 3ft Rectangular Table.svg", category: "Funiture", width: 601, height: 277,
    name: ""
  },
  {
    id: "8 seater round table (1550mm table)", label: "8 seater round table (1550mm table)", path: "/assets/modal/Funiture/8 seater round table (1550mm table).svg", category: "Funiture", width: 795, height: 795,
    name: ""
  },
  {
    id: "10 seater rectangular table 1", label: "10 seater rectangular table 1", path: "/assets/modal/Funiture/10 seater rectangular table 1.svg", category: "Funiture", width: 616, height: 463,
    name: ""
  },
  {
    id: "10 seater rectangular table 2", label: "10 seater rectangular table 2", path: "/assets/modal/Funiture/10 seater rectangular table 2.svg", category: "Funiture", width: 383, height: 463,
    name: ""
  },
  {
    id: "10 seater rectangular table 3", label: "10 seater rectangular table 3", path: "/assets/modal/Funiture/10 seater rectangular table 3.svg", category: "Funiture", width: 492, height: 463,
    name: ""
  },
  {
    id: "10 seater round table", label: "10 seater round table", path: "/assets/modal/Funiture/10 seater round table.svg", category: "Funiture", width: 790, height: 793,
    name: ""
  },
  {
    id: "12 seater round table", label: "12 seater round table", path: "/assets/modal/Funiture/12 seater round table.svg", category: "Funiture", width: 793, height: 793,
    name: ""
  },
  {
    id: "16 seater round table", label: "16 seater round table", path: "/assets/modal/Funiture/16 seater round table.svg", category: "Funiture", width: 791, height: 791,
    name: ""
  },
  {
    id: "16_SEATER_EXECUTIVE_TABLE", label: "16_SEATER_EXECUTIVE_TABLE", path: "/assets/modal/Funiture/16_SEATER_EXECUTIVE_TABLE.svg", category: "Funiture", width: 1079, height: 411,
    name: ""
  },
  {
    id: "20 seater doughtnut table", label: "20 seater doughtnut table", path: "/assets/modal/Funiture/20 seater doughtnut table.svg", category: "Funiture", width: 565, height: 565,
    name: ""
  },
  {
    id: "900mm X 900mm Coffee Table", label: "900mm X 900mm Coffee Table", path: "/assets/modal/Funiture/900mm X 900mm Coffee Table.svg", category: "Funiture", width: 795, height: 795,
    name: ""
  },
  {
    id: "1000mm Cocktail table", label: "1000mm Cocktail table", path: "/assets/modal/Funiture/1000mm Cocktail table.svg", category: "Funiture", width: 325, height: 325,
    name: ""
  },
  {
    id: "1200mm X 600mm Coffee Table", label: "1200mm X 600mm Coffee Table", path: "/assets/modal/Funiture/1200mm X 600mm Coffee Table.svg", category: "Funiture", width: 794, height: 398,
    name: ""
  },
  {
    id: "1300mm X 650mm Coffee Table", label: "1300mm X 650mm Coffee Table", path: "/assets/modal/Funiture/1300mm X 650mm Coffee Table.svg", category: "Funiture", width: 1179, height: 590,
    name: ""
  },
  {
    id: "1500mm (5ft) round table", label: "1500mm (5ft) round table", path: "/assets/modal/Funiture/1500mm (5ft) round table.svg", category: "Funiture", width: 794, height: 794,
    name: ""
  },
  {
    id: "1800mm (6ft) round table", label: "1800mm (6ft) round table", path: "/assets/modal/Funiture/1800mm (6ft) round table.svg", category: "Funiture", width: 795, height: 795,
    name: ""
  },
  {
    id: "Event Chair", label: "Event Chair", path: "/assets/modal/Funiture/Event Chair.svg", category: "Funiture", width: 721, height: 826,
    name: ""
  },
  {
    id: "Group", label: "Group", path: "/assets/modal/Funiture/Group.svg", category: "Funiture", width: 640, height: 823,
    name: ""
  },
  {
    id: "Office Chair", label: "Office Chair", path: "/assets/modal/Funiture/Office Chair.svg", category: "Funiture", width: 727, height: 867,
    name: ""
  },

  {
    id: "1m X 1m modular stage 1", label: "1m X 1m modular stage 1", path: "/assets/modal/Layout/1m X 1m modular stage 1.svg", category: "Layout", width: 1650, height: 1650,
    name: ""
  },
  {
    id: "2ft x 2ft modular stage", label: "2ft x 2ft modular stage", path: "/assets/modal/Layout/2ft x 2ft modular stage.svg", category: "Layout", width: 824, height: 824,
    name: ""
  },
  {
    id: "2ft x 4ft modular stage", label: "2ft x 4ft modular stage", path: "/assets/modal/Layout/2ft x 4ft modular stage.svg", category: "Layout", width: 1647, height: 824,
    name: ""
  },
  {
    id: "3ft x 3ft modular stage", label: "3ft x 3ft modular stage", path: "/assets/modal/Layout/3ft x 3ft modular stage.svg", category: "Layout", width: 1650, height: 1650,
    name: ""
  },
  {
    id: "500mm X 500mm Modular Stage", label: "500mm X 500mm Modular Stage", path: "/assets/modal/Layout/500mm X 500mm Modular Stage.svg", category: "Layout", width: 826, height: 826,
    name: ""
  },

  {
    id: "Banquet", label: "Banquet", path: "/assets/modal/Sitting Styles/Banquet.svg", category: "Sitting Styles", width: 1043, height: 1043,
    name: ""
  },
  {
    id: "Boardroom", label: "Boardroom", path: "/assets/modal/Sitting Styles/Boardroom.svg", category: "Sitting Styles", width: 1818, height: 745,
    name: ""
  },
  {
    id: "Chevron", label: "Chevron", path: "/assets/modal/Sitting Styles/Chevron.svg", category: "Sitting Styles", width: 1266, height: 1432,
    name: ""
  },
  {
    id: "Circle", label: "Circle", path: "/assets/modal/Sitting Styles/Circle.svg", category: "Sitting Styles", width: 1126, height: 1126,
    name: ""
  },
  {
    id: "Classroom", label: "Classroom", path: "/assets/modal/Sitting Styles/Classroom.svg", category: "Sitting Styles", width: 1301, height: 1003,
    name: ""
  },
  {
    id: "Crescent or Cabaret", label: "Crescent or Cabaret", path: "/assets/modal/Sitting Styles/Crescent or Cabaret.svg", category: "Sitting Styles", width: 1997, height: 1143,
    name: ""
  },
  {
    id: "Horseshoe", label: "Horseshoe", path: "/assets/modal/Sitting Styles/Horseshoe.svg", category: "Sitting Styles", width: 1104, height: 1236,
    name: ""
  },
  {
    id: "Oval Boardroom", label: "Oval Boardroom", path: "/assets/modal/Sitting Styles/Oval Boardroom.svg", category: "Sitting Styles", width: 2199, height: 742,
    name: ""
  },
  {
    id: "Semi - Circle", label: "Semi - Circle", path: "/assets/modal/Sitting Styles/Semi - Circle.svg", category: "Sitting Styles", width: 1178, height: 708,
    name: ""
  },
  {
    id: "Seminar", label: "Seminar", path: "/assets/modal/Sitting Styles/Seminar.svg", category: "Sitting Styles", width: 1459, height: 846,
    name: ""
  },
  {
    id: "Theatre or Auditorium", label: "Theatre or Auditorium", path: "/assets/modal/Sitting Styles/Theatre or Auditorium.svg", category: "Sitting Styles", width: 960, height: 1317,
    name: ""
  },
  {
    id: "U-Shape", label: "U-Shape", path: "/assets/modal/Sitting Styles/U-Shape.svg", category: "Sitting Styles", width: 971, height: 1233,
    name: ""
  },

  {
    id: "Round Coloumn", label: "Round Coloumn", path: "/assets/modal/Windows and column/Round Coloumn.svg", category: "Windows and column", width: 182, height: 168,
    name: ""
  },
  {
    id: "SQUARE_COLOUMN", label: "SQUARE_COLOUMN", path: "/assets/modal/Windows and column/SQUARE_COLOUMN.svg", category: "Windows and column", width: 190, height: 191,
    name: ""
  },
  {
    id: "Window", label: "Window", path: "/assets/modal/Windows and column/Window.svg", category: "Windows and column", width: 398, height: 67,
    name: ""
  },
]

