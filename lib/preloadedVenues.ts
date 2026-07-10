export type PreloadedVenueDef = {
  id: string;
  name: string;
  path: string;
  width: number;
  height: number;
  latitude: number;
  longitude: number;
  address: string;
  capacity: string;
  description: string;
  features: string[];
};

export const PRELOADED_VENUES: PreloadedVenueDef[] = [
  {
    id: "5-palm-imperial",
    name: "5 Palm Imperial",
    path: "/assets/preloaded-venues/5 Palm Imperial.svg",
    width: 241231,
    height: 111306,
    latitude: 6.4281,
    longitude: 3.4219,
    address: "5 Palm Imperial, Lekki Phase 1, Lagos, Nigeria",
    capacity: "Up to 1,500 guests",
    description: "A luxury waterfront event space located in Lekki, Lagos. Offers stunning panoramic views of the water, premium interior finishings, and state-of-the-art facilities.",
    features: ["Waterfront View", "Valet Parking", "Advanced Climate Control", "Pre-function Area"]
  },
  {
    id: "balmoral",
    name: "Balmoral",
    path: "/assets/preloaded-venues/Balmoral.svg",
    width: 39723,
    height: 67385,
    latitude: 6.4253,
    longitude: 3.4025,
    address: "Balmoral Convention Centre, Federal Palace Hotel, Victoria Island, Lagos, Nigeria",
    capacity: "Up to 2,000 guests",
    description: "An iconic Victoria Island venue featuring multi-functional halls, premium air conditioning, and top-tier security. Perfect for massive exhibitions and banquets.",
    features: ["Prime Location", "5-Star Hotel Venue", "Multi-functional Halls", "Elite Security"]
  },
  {
    id: "eko-hotel-convention-centre-individual-halls",
    name: "Eko hotel Convention Centre (Individual Halls)",
    path: "/assets/preloaded-venues/Eko hotel Convention Centre (Individual Halls).svg",
    width: 114691,
    height: 79152,
    latitude: 6.4267,
    longitude: 3.4301,
    address: "Eko Hotel Convention Centre, Plot 1415 Adetokunbo Ademola St, Victoria Island, Lagos, Nigeria",
    capacity: "Halls range 500 - 1,500 guests",
    description: "Part of the prestigious Eko Hotels complex. These individual halls can be configured for exhibitions, seminars, weddings, and medium-scale corporate functions.",
    features: ["Hotel Amenities", "High-end AV Systems", "Flexible Layout Configs", "Catering Services"]
  },
  {
    id: "eko-hotel-convention-centre-main-hall",
    name: "Eko hotel Convention Centre (Main Hall)",
    path: "/assets/preloaded-venues/Eko hotel Convention Centre (Main Hall).svg",
    width: 114691,
    height: 79152,
    latitude: 6.4267,
    longitude: 3.4301,
    address: "Eko Hotel Convention Centre, Plot 1415 Adetokunbo Ademola St, Victoria Island, Lagos, Nigeria",
    capacity: "Up to 6,000 guests",
    description: "The largest and most famous multipurpose concert and event hall in Nigeria. Home to major global summits, music concerts, pageants, and high-profile corporate galas.",
    features: ["Massive Ceiling Height", "Vip Dressing Rooms", "Press Center Access", "Concert Grade Acoustics"]
  },
  {
    id: "harbour-point",
    name: "Harbour point",
    path: "/assets/preloaded-venues/Harbour point.svg",
    width: 74885,
    height: 28047,
    latitude: 6.4312,
    longitude: 3.4184,
    address: "Harbour Point, 4 Wilmot Point Rd, Victoria Island, Lagos, Nigeria",
    capacity: "1,000 banquet / 2,000 theater",
    description: "A premier waterfront venue in Victoria Island. Boasts high ceilings, fully air-conditioned halls, and expansive secured parking space. Managed to international standards.",
    features: ["Waterfront View", "Professional Event Management", "Large Secure Parking", "Back-up Generators"]
  },
  {
    id: "landmark-centre-halls",
    name: "Landmark Centre Halls",
    path: "/assets/preloaded-venues/Landmark Centre Halls.svg",
    width: 116972,
    height: 54548,
    latitude: 6.4239,
    longitude: 3.4449,
    address: "Landmark Centre, Plot 2 & 3, Water Corporation Dr, Victoria Island, Lagos, Nigeria",
    capacity: "Up to 3,000 guests",
    description: "A world-class exhibition and convention facility adjacent to the Atlantic Ocean. Known for high infrastructure support, massive floor plans, and highly accessible location.",
    features: ["Exhibition Drains", "Heavy Load Flooring", "Beachfront Access", "Retail Village Proximity"]
  },
  {
    id: "monarch",
    name: "Monarch",
    path: "/assets/preloaded-venues/Monarch.svg",
    width: 34026,
    height: 44793,
    latitude: 6.4371,
    longitude: 3.4682,
    address: "The Monarch Event Centre, Lekki - Epe Express Rd, Lekki, Lagos, Nigeria",
    capacity: "Up to 1,200 guests",
    description: "A state-of-the-art luxury pavilion featuring stunning crystal chandeliers, digital screens, and elite decor capabilities. Designed for high-society events and weddings.",
    features: ["Crystal Chandeliers", "LED Screen Walls", "Luxury Bridal Suite", "Gourmet Kitchen Space"]
  }
];
