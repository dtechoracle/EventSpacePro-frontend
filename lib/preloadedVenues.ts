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
    width: 119100,
    height: 168400,
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
    id: "eko-hotel-convention-centre",
    name: "Eko Hotel Convention Centre",
    path: "/assets/preloaded-venues/Eko Hotel Convention Centre.svg",
    width: 114691,
    height: 79152,
    latitude: 6.4267,
    longitude: 3.4301,
    address: "Eko Hotel Convention Centre, Plot 1415 Adetokunbo Ademola St, Victoria Island, Lagos, Nigeria",
    capacity: "Up to 6,000 guests",
    description: "Part of the prestigious Eko Hotels complex, this is the largest and most famous multipurpose concert and event centre in Nigeria. Home to major global summits, music concerts, exhibitions, pageants, and high-profile corporate galas.",
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
  },
  {
    id: "la-madison-dome",
    name: "La Madison Dome",
    path: "/assets/preloaded-venues/La Madison Dome.svg",
    width: 25000,
    height: 50000,
    latitude: 6.4370,
    longitude: 3.4300,
    address: "Block 2, Plot 1, Okunade Bluewaters Scheme, Lekki, Lagos, Nigeria",
    capacity: "Up to 1,000 guests",
    description: "A stunning dome-shaped event space within La Madison Place, a one-stop hospitality centre in Lekki. Features a functionally aesthetic dome with 4 access doors, full-service kitchen, and ample parking for over 150 vehicles. Ideal for weddings, corporate events, exhibitions, and social gatherings.",
    features: ["Dome Architecture", "4 Access Doors", "Loading Shutter", "Full-Service Kitchen", "Ample Parking", "Air-Conditioned"]
  },
  {
    id: "civic-centre",
    name: "Civic Centre",
    path: "/assets/preloaded-venues/Civic Centre.svg",
    width: 24958,
    height: 26604,
    latitude: 6.4305,
    longitude: 3.4105,
    address: "The Civic Centre, Ozumba Mbadiwe Ave, Opposite 1004, Victoria Island, Lagos, Nigeria",
    capacity: "Up to 1,000 guests",
    description: "An iconic Victoria Island landmark with distinctive basket-weave architecture overlooking the lagoon. Offers versatile halls including the Grand Banquet Hall and Panoramic View Hall, with in-house catering, ample secure parking, and professional event support.",
    features: ["Grand Banquet Hall", "Lagoon Views", "In-house Catering", "Ample Secure Parking"]
  },
  {
    id: "national-theatre-banquet-hall",
    name: "National Theatre (Banquet Hall)",
    path: "/assets/preloaded-venues/Banquet Hall National Theatre.svg",
    width: 56092,
    height: 27324,
    latitude: 6.4762,
    longitude: 3.2728,
    address: "National Theatre (Wole Soyinka Centre), Iganmu, Surulere, Lagos, Nigeria",
    capacity: "Up to 1,000 guests",
    description: "The multipurpose banquet hall of Nigeria's iconic National Theatre in Iganmu, newly renovated as part of the Wole Soyinka Centre for Culture and the Creative Arts. A grand fan-shaped ceremonial space blending Nigerian art with a modern stage and advanced acoustic design.",
    features: ["Newly Renovated", "Advanced Acoustics", "Cultural Landmark", "Modern Stage"]
  }
];
