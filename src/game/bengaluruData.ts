import {
  CollectibleDef,
  DistrictDef,
  LandmarkMarker,
  MissionDef,
  RoadSegment,
  VehicleKind,
  WaterZone,
} from './types';

export const WORLD_HALF_SIZE = 580;

export const DISTRICTS: DistrictDef[] = [
  {
    id: 'vidhana_soudha',
    name: 'Vidhana Soudha',
    kannadaName: 'ವಿಧಾನ ಸೌಧ',
    x: -170,
    z: -160,
    radius: 110,
    description: 'Grand neo-Dravidian granite civic complex overlooking Cubbon Park.',
    color: '#d97706',
  },
  {
    id: 'cubbon_park',
    name: 'Cubbon Park',
    kannadaName: 'ಕಬ್ಬನ್ ಪಾರ್ಕ್',
    x: -130,
    z: 0,
    radius: 120,
    description: 'Lush 300-acre green lung with rain trees, walkways, and Lotus Pond.',
    color: '#16a34a',
  },
  {
    id: 'mg_road',
    name: 'MG Road',
    kannadaName: 'ಎಂ.ಜಿ ರಸ್ತೆ',
    x: 40,
    z: -40,
    radius: 115,
    description: 'Iconic commercial boulevard beneath the elevated Namma Metro Purple Line.',
    color: '#9333ea',
  },
  {
    id: 'brigade_road',
    name: 'Brigade Road',
    kannadaName: 'ಬ್ರಿಗೇಡ್ ರಸ್ತೆ',
    x: 30,
    z: 80,
    radius: 90,
    description: 'Bustling shopping corridor, street stalls, and neon-lit evening arcades.',
    color: '#ec4899',
  },
  {
    id: 'indiranagar',
    name: 'Indiranagar',
    kannadaName: 'ಇಂದಿರಾನಗರ',
    x: 240,
    z: -110,
    radius: 130,
    description: '100 Feet Road cafes, tree-lined avenues, safehouse, and custom garage.',
    color: '#0ea5e9',
  },
  {
    id: 'majestic',
    name: 'Majestic Bus Stand',
    kannadaName: 'ಮೆಜೆಸ್ಟಿಕ್',
    x: -340,
    z: -110,
    radius: 115,
    description: 'Kempegowda transit hub swarming with BMTC buses and commuters.',
    color: '#2563eb',
  },
  {
    id: 'kr_market',
    name: 'KR Market',
    kannadaName: 'ಕೆ.ಆರ್ ಮಾರುಕಟ್ಟೆ',
    x: -330,
    z: 100,
    radius: 115,
    description: 'Historic wholesale bazaar filled with flower awnings, spice stalls, and narrow lanes.',
    color: '#ea580c',
  },
  {
    id: 'lalbagh',
    name: 'Lalbagh Botanical Garden',
    kannadaName: 'ಲಾಲ್‌ಬಾಗ್',
    x: -180,
    z: 270,
    radius: 130,
    description: 'Home to the Glass House conservatory, ancient trees, and Lalbagh Lake.',
    color: '#15803d',
  },
  {
    id: 'koramangala',
    name: 'Koramangala',
    kannadaName: 'ಕೋರಮಂಗಲ',
    x: 200,
    z: 140,
    radius: 120,
    description: 'Startup hub of 80 Feet Road villas, pubs, and modern residential blocks.',
    color: '#06b6d4',
  },
  {
    id: 'silk_board',
    name: 'Silk Board Junction',
    kannadaName: 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್',
    x: 80,
    z: 260,
    radius: 105,
    description: 'Notorious multi-tier intersection linking Hosur Road and the ORR Flyover.',
    color: '#ef4444',
  },
  {
    id: 'orr',
    name: 'Outer Ring Road',
    kannadaName: 'ಹೊರ ವರ್ತುಲ ರಸ್ತೆ',
    x: 280,
    z: 260,
    radius: 130,
    description: 'Elevated multi-lane expressway and flyover deck skirting eastern tech corridors.',
    color: '#f59e0b',
  },
  {
    id: 'whitefield',
    name: 'Whitefield',
    kannadaName: 'ವೈಟ್‌ಫೀಲ್ಡ್',
    x: 420,
    z: -160,
    radius: 140,
    description: 'ITPL glass tech parks, international malls, and late-night tech campuses.',
    color: '#6366f1',
  },
  {
    id: 'electronic_city',
    name: 'Electronic City',
    kannadaName: 'ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ',
    x: 240,
    z: 430,
    radius: 145,
    description: 'Southern IT campus towers connected by the elevated Hosur expressway.',
    color: '#3b82f6',
  },
  {
    id: 'nice_road',
    name: 'NICE Road Expressway',
    kannadaName: 'ನೈಸ್ ರಸ್ತೆ',
    x: -140,
    z: 440,
    radius: 160,
    description: 'High-speed peripheral concrete ring expressway built for 250 km/h runs.',
    color: '#eab308',
  },
];

// Primary navigable road network (major avenues & expressways)
export const ROAD_SEGMENTS: RoadSegment[] = [
  // East-West Arterials
  { id: 'ew_north', name: 'Raj Bhavan – Indiranagar – Whitefield Rd', x1: -480, z1: -200, x2: 480, z2: -200, width: 18 },
  { id: 'ew_mg', name: 'MG Road – Old Madras Rd', x1: -480, z1: -40, x2: 480, z2: -40, width: 20 },
  { id: 'ew_central', name: 'KR Market – Brigade – Koramangala Rd', x1: -480, z1: 110, x2: 480, z2: 110, width: 18 },
  { id: 'ew_silk', name: 'Silk Board – Outer Ring Road', x1: -480, z1: 260, x2: 480, z2: 260, width: 22 },
  { id: 'ew_nice', name: 'NICE Road Expressway', x1: -500, z1: 430, x2: 500, z2: 430, width: 24 },

  // North-South Arterials
  { id: 'ns_west', name: 'Majestic – KR Market – Lalbagh Rd', x1: -340, z1: -480, x2: -340, z2: 480, width: 18 },
  { id: 'ns_cubbon', name: 'Vidhana Soudha – Cubbon – Lalbagh Ave', x1: -170, z1: -480, x2: -170, z2: 480, width: 18 },
  { id: 'ns_brigade', name: 'Brigade – Hosur – Silk Board Rd', x1: 40, z1: -480, x2: 40, z2: 480, width: 20 },
  { id: 'ns_indira', name: '100 Feet Rd – Koramangala – E-City', x1: 230, z1: -480, x2: 230, z2: 480, width: 20 },
  { id: 'ns_east', name: 'Whitefield – ITPL – ORR East', x1: 420, z1: -480, x2: 420, z2: 480, width: 18 },

  // Elevated Silk Board – ORR Flyover (drivable ramp + deck)
  { id: 'flyover_orr', name: 'Silk Board – ORR Elevated Flyover', x1: -40, z1: 260, x2: 340, z2: 260, width: 12, elevated: true },
];

export const WATER_ZONES: WaterZone[] = [
  { id: 'cubbon_pond', name: 'Cubbon Park Lotus Pond', x: -105, z: 32, rx: 32, rz: 24 },
  { id: 'lalbagh_lake', name: 'Lalbagh Lake', x: -245, z: 315, rx: 52, rz: 38 },
];

export const LANDMARK_MARKERS: LandmarkMarker[] = [
  {
    id: 'safehouse_indira',
    name: 'Indiranagar Safehouse',
    type: 'safehouse',
    x: 195,
    z: -135,
    district: 'indiranagar',
    description: 'Rest, restore armor & health, and clear heat.',
  },
  {
    id: 'garage_indira',
    name: '100ft Road Custom Garage',
    type: 'garage',
    x: 270,
    z: -80,
    district: 'indiranagar',
    description: 'Respray paint, repair chassis, upgrade turbo & swap stored vehicles.',
  },
  {
    id: 'garage_kora',
    name: 'Koramangala Mod Bay',
    type: 'garage',
    x: 185,
    z: 155,
    district: 'koramangala',
    description: 'Street tuning bay for bikes, autos, and sports coupes.',
  },
  {
    id: 'shop_brigade',
    name: 'Brigade Outfitters & Gear',
    type: 'shop',
    x: 68,
    z: 65,
    district: 'brigade_road',
    description: 'Customize jackets, sunglasses, and tactical gear.',
  },
  {
    id: 'petrol_silkboard',
    name: 'Silk Board Fuel & Repair',
    type: 'petrol',
    x: 10,
    z: 225,
    district: 'silk_board',
    description: 'Instant vehicle repair and nitro top-up.',
  },
  {
    id: 'landmark_vidhana',
    name: 'Vidhana Soudha',
    type: 'landmark',
    x: -225,
    z: -150,
    district: 'vidhana_soudha',
    description: 'Seat of Karnataka legislature with illuminated granite domes.',
  },
  {
    id: 'landmark_metro',
    name: 'MG Road Metro Station',
    type: 'landmark',
    x: 40,
    z: -40,
    district: 'mg_road',
    description: 'Elevated Purple Line Namma Metro transit concourse.',
  },
  {
    id: 'landmark_glasshouse',
    name: 'Lalbagh Glass House',
    type: 'landmark',
    x: -145,
    z: 270,
    district: 'lalbagh',
    description: 'Historic iron-and-glass botanical conservatory.',
  },
];

export const MISSIONS: MissionDef[] = [
  {
    id: 'm1_mg_escape',
    title: '01. MG Road Breakout',
    district: 'mg_road',
    briefing:
      'A corrupt tech fixer tipped off patrol units near MG Road Metro. Grab wheels, shake the 2-star pursuit, and reach the Indiranagar Safehouse.',
    objectiveLabel: 'Evade police and reach Indiranagar Safehouse',
    type: 'escape',
    startX: 65,
    startZ: -15,
    targetX: 195,
    targetZ: -135,
    wantedStars: 2,
    rewardCash: 15000,
    recommendedVehicle: 'coupe',
  },
  {
    id: 'm2_silk_delivery',
    title: '02. Silk Board Express',
    district: 'koramangala',
    briefing:
      'Deliver a prototype quantum chip from Koramangala through Silk Board Junction traffic to Electronic City before the 90-second timer expires.',
    objectiveLabel: 'Deliver prototype through Silk Board to Electronic City',
    type: 'delivery',
    startX: 200,
    startZ: 130,
    targetX: 245,
    targetZ: 390,
    checkpoints: [
      { x: 40, z: 260 },
      { x: 230, z: 260 },
      { x: 245, z: 390 },
    ],
    timeLimitSec: 95,
    rewardCash: 22000,
    recommendedVehicle: 'auto',
  },
  {
    id: 'm3_ecity_race',
    title: '03. Electronic City Apex',
    district: 'electronic_city',
    briefing:
      'Midnight street racers own the Hosur tech corridor. Hit every checkpoint around Electronic City and ORR at full throttle.',
    objectiveLabel: 'Clear all Electronic City motorcycle checkpoints',
    type: 'race',
    startX: 215,
    startZ: 380,
    targetX: 420,
    targetZ: 260,
    checkpoints: [
      { x: 230, z: 430 },
      { x: 420, z: 430 },
      { x: 420, z: 260 },
      { x: 230, z: 260 },
    ],
    timeLimitSec: 85,
    rewardCash: 30000,
    recommendedVehicle: 'bike',
  },
  {
    id: 'm4_kr_market',
    title: '04. KR Market Shadow',
    district: 'kr_market',
    briefing:
      'Syndicate smugglers are moving black-market hardware behind KR Market spice stalls. Inspect the three drop points and neutralize the stash.',
    objectiveLabel: 'Investigate KR Market drop zones',
    type: 'investigate',
    startX: -310,
    startZ: 85,
    targetX: -375,
    targetZ: 145,
    checkpoints: [
      { x: -365, z: 75 },
      { x: -305, z: 145 },
      { x: -375, z: 145 },
    ],
    wantedStars: 1,
    rewardCash: 25000,
  },
  {
    id: 'm5_whitefield_night',
    title: '05. Whitefield Midnight Run',
    district: 'whitefield',
    briefing:
      'Under cover of darkness in Whitefield ITPL, intercept encrypted server drives across the tech park towers before dawn.',
    objectiveLabel: 'Collect server drives across Whitefield tech towers',
    type: 'stealth',
    startX: 390,
    startZ: -155,
    targetX: 455,
    targetZ: -235,
    checkpoints: [
      { x: 445, z: -135 },
      { x: 385, z: -225 },
      { x: 455, z: -235 },
    ],
    forceTime: 'night',
    timeLimitSec: 100,
    rewardCash: 35000,
    recommendedVehicle: 'cab',
  },
  {
    id: 'm6_flyover_escape',
    title: '06. Flyover Escape',
    district: 'silk_board',
    briefing:
      'Patrol units have locked down surface lanes! Hit the Silk Board – ORR elevated flyover ramp, outrun a 3-star response, and vanish into Indiranagar.',
    objectiveLabel: 'Cross the ORR Flyover deck and evade 3-star pursuit',
    type: 'escape',
    startX: -10,
    startZ: 245,
    targetX: 270,
    targetZ: -80,
    checkpoints: [
      { x: 140, z: 260 },
      { x: 310, z: 260 },
      { x: 270, z: -80 },
    ],
    wantedStars: 3,
    rewardCash: 45000,
    recommendedVehicle: 'coupe',
  },
  {
    id: 'm7_nice_road',
    title: '07. NICE Road 250',
    district: 'nice_road',
    briefing:
      'The concrete ribbon of NICE Road is wide open. Push the Deccan GT to redline across the entire southern expressway sprint.',
    objectiveLabel: 'Blast down NICE Road expressway checkpoints under 75s',
    type: 'race',
    startX: -410,
    startZ: 430,
    targetX: 410,
    targetZ: 430,
    checkpoints: [
      { x: -170, z: 430 },
      { x: 40, z: 430 },
      { x: 230, z: 430 },
      { x: 410, z: 430 },
    ],
    timeLimitSec: 75,
    rewardCash: 60000,
    recommendedVehicle: 'coupe',
  },
];

export const COLLECTIBLES: CollectibleDef[] = [
  { id: 'c1', name: 'Vidhana Granite Seal', x: -215, z: -185, district: 'vidhana_soudha' },
  { id: 'c2', name: 'Cubbon Rain-Tree Token', x: -120, z: -10, district: 'cubbon_park' },
  { id: 'c3', name: 'MG Metro Commemorative Coin', x: 55, z: -58, district: 'mg_road' },
  { id: 'c4', name: 'Brigade Arcade Cassette', x: 52, z: 95, district: 'brigade_road' },
  { id: 'c5', name: 'Indiranagar Filter Kaapi Cup', x: 255, z: -125, district: 'indiranagar' },
  { id: 'c6', name: 'Majestic Vintage Bus Ticket', x: -365, z: -130, district: 'majestic' },
  { id: 'c7', name: 'KR Market Saffron Crate', x: -355, z: 125, district: 'kr_market' },
  { id: 'c8', name: 'Lalbagh Glass Dome Key', x: -145, z: 252, district: 'lalbagh' },
  { id: 'c9', name: 'Koramangala Startup Badge', x: 215, z: 165, district: 'koramangala' },
  { id: 'c10', name: 'Silk Board Flyover Crest', x: 150, z: 260, district: 'silk_board' },
  { id: 'c11', name: 'Whitefield Silicon Wafer', x: 440, z: -175, district: 'whitefield' },
  { id: 'c12', name: 'NICE Road Golden Toll Pass', x: -20, z: 430, district: 'nice_road' },
];

export const NPC_DIALOGUE_LINES: Array<{ speaker: string; language: string; line: string }> = [
  { speaker: 'Auto Anna', language: 'Kannada', line: 'Silk Board traffic tumba heavy ide guru, flyover thogoli!' },
  { speaker: 'Tech Commuter', language: 'English', line: 'Purple Line metro gets me from MG Road to Whitefield in twenty minutes.' },
  { speaker: 'Chai Vendor', language: 'Hindi', line: 'Garam masala chai aur filter kaapi ready hai bhaiya!' },
  { speaker: 'Cubbon Jogger', language: 'Kannada', line: 'Bengaluru weather indina super aagide, full cool breeze!' },
  { speaker: 'KR Market Florist', language: 'Kannada', line: 'Mallige hoovu fresh ide madam, banni banni!' },
  { speaker: 'Cab Driver', language: 'Hindi', line: 'Meter se chalo sir, NICE Road se 20 minute mein Electronic City!' },
  { speaker: 'Indiranagar Local', language: 'English', line: 'Check out the custom mod bay on 100 Feet Road if your ride took a hit.' },
  { speaker: 'BMTC Conductor', language: 'Kannada', line: 'Majestic, Shivajinagar, MG Road... munde banni, pass togorri!' },
];

export const RADIO_TRACKS = [
  'Namma FM 91.9 — Deccan Monsoon Synth',
  'Brigade Beats — Neon Filter Kaapi',
  'ORR Midnight — Electronic City Cruise',
  'Carnatic Bassline — Bengaluru After Hours',
];

export const VEHICLE_SPECS: Record<
  VehicleKind,
  {
    label: string;
    maxSpeed: number; // world units/s (~m/s * 1.4)
    accel: number;
    brake: number;
    turnRate: number;
    maxHealth: number;
    baseColor: string;
  }
> = {
  auto: {
    label: 'Namma Auto KA-01',
    maxSpeed: 28,
    accel: 18,
    brake: 28,
    turnRate: 2.5,
    maxHealth: 90,
    baseColor: '#eab308',
  },
  bmtc: {
    label: 'BMTC Volvo Vajra',
    maxSpeed: 26,
    accel: 11,
    brake: 20,
    turnRate: 1.4,
    maxHealth: 220,
    baseColor: '#2563eb',
  },
  cab: {
    label: 'Namma City Cab',
    maxSpeed: 38,
    accel: 22,
    brake: 32,
    turnRate: 2.2,
    maxHealth: 115,
    baseColor: '#f1f5f9',
  },
  bike: {
    label: 'Bengaluru Streetfighter 650',
    maxSpeed: 48,
    accel: 32,
    brake: 38,
    turnRate: 2.9,
    maxHealth: 80,
    baseColor: '#dc2626',
  },
  coupe: {
    label: 'Deccan GT Coupe',
    maxSpeed: 58,
    accel: 34,
    brake: 42,
    turnRate: 2.4,
    maxHealth: 140,
    baseColor: '#f97316',
  },
  police_suv: {
    label: 'Karnataka Police Patrol',
    maxSpeed: 46,
    accel: 27,
    brake: 36,
    turnRate: 2.3,
    maxHealth: 160,
    baseColor: '#ffffff',
  },
  police_bike: {
    label: 'Traffic Police Interceptor',
    maxSpeed: 50,
    accel: 33,
    brake: 38,
    turnRate: 2.8,
    maxHealth: 95,
    baseColor: '#f8fafc',
  },
};

/**
 * Returns the drivable road/flyover elevation at (x, z).
 * The Silk Board - ORR Flyover spans x = -40..340 along z = 260 (half-width 6).
 * Ramps rise smoothly from x = -40..30 and descend x = 270..340 to height 7.5m.
 */
export function getFlyoverDeckY(x: number, z: number): number {
  if (Math.abs(z - 260) > 6.2) return 0;
  if (x < -40 || x > 340) return 0;
  if (x < 30) {
    return ((x - -40) / 70) * 7.5;
  }
  if (x > 270) {
    return ((340 - x) / 70) * 7.5;
  }
  return 7.5;
}

export function getDistrictAt(x: number, z: number): DistrictDef {
  let closest = DISTRICTS[0];
  let bestDistSq = Infinity;
  for (const d of DISTRICTS) {
    const dx = x - d.x;
    const dz = z - d.z;
    const distSq = dx * dx + dz * dz;
    if (distSq < bestDistSq) {
      bestDistSq = distSq;
      closest = d;
    }
  }
  return closest;
}

export function isPointInWater(x: number, z: number): WaterZone | null {
  for (const w of WATER_ZONES) {
    const nx = (x - w.x) / w.rx;
    const nz = (z - w.z) / w.rz;
    if (nx * nx + nz * nz <= 1.0) return w;
  }
  return null;
}

export function isPointOnRoad(x: number, z: number): boolean {
  for (const r of ROAD_SEGMENTS) {
    const halfW = r.width * 0.5 + 1;
    const minX = Math.min(r.x1, r.x2) - halfW;
    const maxX = Math.max(r.x1, r.x2) + halfW;
    const minZ = Math.min(r.z1, r.z2) - halfW;
    const maxZ = Math.max(r.z1, r.z2) + halfW;
    if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
      return true;
    }
  }
  return false;
}
