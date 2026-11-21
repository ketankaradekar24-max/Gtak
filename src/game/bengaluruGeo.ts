import {
  DistrictId,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GeoValidationEntry,
  GeoValidationReport,
  MetroLineId,
  MetroStatus,
  RoadPoint,
} from './types';

/**
 * Documented Geographical Datum & Coordinate Pipeline:
 * Source Coordinates: WGS84 (EPSG:4326)
 * Projected Coordinates: UTM Zone 43N (EPSG:32643)
 * Origin Datum: Central Bengaluru (12.9716° N, 77.5946° E — Cubbon / MG Rd)
 * World Scale: 1 world unit = 12.5 real meters
 * World Axis Convention: +X = East (UTM Easting), -Z = North (UTM Northing)
 * Map Data Attribution: OpenStreetMap contributors (ODbL), BMRCL & BBMP Civic Geography
 */
export const ORIGIN_LAT = 12.9716;
export const ORIGIN_LON = 77.5946;
export const WORLD_SCALE_METERS_PER_UNIT = 12.5;

// WGS84 Ellipsoid & UTM Zone 43N Constants (EPSG:32643)
const WGS84_A = 6378137.0;
const WGS84_F = 1 / 298.257223563;
const WGS84_E2 = 2 * WGS84_F - WGS84_F * WGS84_F;
const WGS84_EP2 = WGS84_E2 / (1 - WGS84_E2);
const UTM_K0 = 0.9996;
const UTM_LON0_RAD = (75.0 * Math.PI) / 180; // Zone 43 central meridian = 75° E

export function latLonToUtm43N(lat: number, lon: number): { easting: number; northing: number } {
  const phi = (lat * Math.PI) / 180;
  const lambda = (lon * Math.PI) / 180;

  const sinPhi = Math.sin(phi);
  const cosPhi = Math.cos(phi);
  const tanPhi = Math.tan(phi);

  const N = WGS84_A / Math.sqrt(1 - WGS84_E2 * sinPhi * sinPhi);
  const T = tanPhi * tanPhi;
  const C = WGS84_EP2 * cosPhi * cosPhi;
  const A = cosPhi * (lambda - UTM_LON0_RAD);

  const e4 = WGS84_E2 * WGS84_E2;
  const e6 = e4 * WGS84_E2;
  const M =
    WGS84_A *
    ((1 - WGS84_E2 / 4 - (3 * e4) / 64 - (5 * e6) / 256) * phi -
      ((3 * WGS84_E2) / 8 + (3 * e4) / 32 + (45 * e6) / 1024) * Math.sin(2 * phi) +
      ((15 * e4) / 256 + (45 * e6) / 1024) * Math.sin(4 * phi) -
      ((35 * e6) / 3072) * Math.sin(6 * phi));

  const easting =
    500000 +
    UTM_K0 *
      N *
      (A +
        ((1 - T + C) * A * A * A) / 6 +
        ((5 - 18 * T + T * T + 72 * C - 58 * WGS84_EP2) * Math.pow(A, 5)) / 120);

  const northing =
    UTM_K0 *
    (M +
      N *
        tanPhi *
        ((A * A) / 2 +
          ((5 - T + 9 * C + 4 * C * C) * Math.pow(A, 4)) / 24 +
          ((61 - 58 * T + T * T + 600 * C - 330 * WGS84_EP2) * Math.pow(A, 6)) / 720));

  return { easting, northing };
}

const ORIGIN_UTM = latLonToUtm43N(ORIGIN_LAT, ORIGIN_LON);

export function latLonToWorld(lat: number, lon: number): { x: number; z: number; easting: number; northing: number } {
  const utm = latLonToUtm43N(lat, lon);
  const x = (utm.easting - ORIGIN_UTM.easting) / WORLD_SCALE_METERS_PER_UNIT;
  const z = -(utm.northing - ORIGIN_UTM.northing) / WORLD_SCALE_METERS_PER_UNIT;
  return { x, z, easting: utm.easting, northing: utm.northing };
}

export function worldToUtm43N(x: number, z: number): { easting: number; northing: number } {
  return {
    easting: ORIGIN_UTM.easting + x * WORLD_SCALE_METERS_PER_UNIT,
    northing: ORIGIN_UTM.northing - z * WORLD_SCALE_METERS_PER_UNIT,
  };
}

export function worldToLatLon(x: number, z: number): { lat: number; lon: number } {
  const dNorth = -z * WORLD_SCALE_METERS_PER_UNIT;
  const dEast = x * WORLD_SCALE_METERS_PER_UNIT;
  const lat = ORIGIN_LAT + dNorth / 110620;
  const lon = ORIGIN_LON + dEast / (111320 * Math.cos((ORIGIN_LAT * Math.PI) / 180));
  return { lat, lon };
}

export function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface GeoLocationRecord {
  id: DistrictId;
  name: string;
  kannadaName: string;
  region: 'Central' | 'East' | 'South' | 'North' | 'West';
  lat: number;
  lon: number;
  radius: number;
  description: string;
  color: string;
}

export const BENGALURU_GEO_LOCATIONS: GeoLocationRecord[] = [
  // CENTRAL BENGALURU (8)
  {
    id: 'mg_road',
    name: 'MG Road',
    kannadaName: 'ಎಂ.ಜಿ ರಸ್ತೆ',
    region: 'Central',
    lat: 12.9756,
    lon: 77.6066,
    radius: 85,
    description: 'Iconic commercial boulevard beneath the elevated Namma Metro Purple Line.',
    color: '#9333ea',
  },
  {
    id: 'brigade_road',
    name: 'Brigade Road',
    kannadaName: 'ಬ್ರಿಗೇಡ್ ರಸ್ತೆ',
    region: 'Central',
    lat: 12.972,
    lon: 77.6075,
    radius: 65,
    description: 'Bustling shopping corridor, street stalls, and neon-lit evening arcades.',
    color: '#ec4899',
  },
  {
    id: 'commercial_street',
    name: 'Commercial Street',
    kannadaName: 'ಕಮರ್ಷಿಯಲ್ ಸ್ಟ್ರೀಟ್',
    region: 'Central',
    lat: 12.9822,
    lon: 77.6083,
    radius: 65,
    description: 'Historic retail lanes packed with textile arcades and street vendors.',
    color: '#f43f5e',
  },
  {
    id: 'shivajinagar',
    name: 'Shivajinagar',
    kannadaName: 'ಶಿವಾಜಿನಗರ',
    region: 'Central',
    lat: 12.9857,
    lon: 77.6057,
    radius: 75,
    description: 'Historic bazaar hub, Russell Market, St. Mary’s Basilica & BMTC depot.',
    color: '#e11d48',
  },
  {
    id: 'cubbon_park',
    name: 'Cubbon Park',
    kannadaName: 'ಕಬ್ಬನ್ ಪಾರ್ಕ್',
    region: 'Central',
    lat: 12.9764,
    lon: 77.5929,
    radius: 95,
    description: 'Lush 300-acre green lung with rain trees, Bandstand, and Attara Kacheri.',
    color: '#16a34a',
  },
  {
    id: 'vidhana_soudha',
    name: 'Vidhana Soudha',
    kannadaName: 'ವಿಧಾನ ಸೌಧ',
    region: 'Central',
    lat: 12.9797,
    lon: 77.5912,
    radius: 75,
    description: 'Grand neo-Dravidian granite civic complex overlooking Cubbon Park.',
    color: '#d97706',
  },
  {
    id: 'kr_market',
    name: 'KR Market',
    kannadaName: 'ಕೆ.ಆರ್ ಮಾರುಕಟ್ಟೆ',
    region: 'Central',
    lat: 12.9633,
    lon: 77.5764,
    radius: 85,
    description: 'Historic wholesale bazaar beside Bangalore Fort & Tipu Summer Palace.',
    color: '#ea580c',
  },
  {
    id: 'majestic',
    name: 'Majestic (Kempegowda)',
    kannadaName: 'ಮೆಜೆಸ್ಟಿಕ್',
    region: 'Central',
    lat: 12.9778,
    lon: 77.5713,
    radius: 95,
    description: 'Kempegowda BMTC Bus Terminal, KSR City Railway Station & Metro Interchange.',
    color: '#2563eb',
  },

  // SOUTH BENGALURU (9 + NICE Road)
  {
    id: 'jayanagar',
    name: 'Jayanagar',
    kannadaName: 'ಜಯನಗರ',
    region: 'South',
    lat: 12.9299,
    lon: 77.5838,
    radius: 115,
    description: 'Planned tree-canopied avenues south of Lalbagh Botanical Garden.',
    color: '#15803d',
  },
  {
    id: 'jp_nagar',
    name: 'JP Nagar',
    kannadaName: 'ಜೆ.ಪಿ ನಗರ',
    region: 'South',
    lat: 12.9063,
    lon: 77.5857,
    radius: 120,
    description: 'Cultural south Bengaluru neighborhood along the Green Line metro corridor.',
    color: '#10b981',
  },
  {
    id: 'btm_layout',
    name: 'BTM Layout',
    kannadaName: 'ಬಿ.ಟಿ.ಎಂ ಲೇಔಟ್',
    region: 'South',
    lat: 12.9166,
    lon: 77.6101,
    radius: 95,
    description: 'Dense southern residential & student corridor next to Silk Board.',
    color: '#14b8a6',
  },
  {
    id: 'koramangala',
    name: 'Koramangala',
    kannadaName: 'ಕೋರಮಂಗಲ',
    region: 'South',
    lat: 12.9352,
    lon: 77.6245,
    radius: 120,
    description: 'Startup hub of 80 Feet Road villas, cafes, and modern residential blocks.',
    color: '#06b6d4',
  },
  {
    id: 'basavanagudi',
    name: 'Basavanagudi',
    kannadaName: 'ಬಸವನಗುಡಿ',
    region: 'South',
    lat: 12.9421,
    lon: 77.5738,
    radius: 95,
    description: 'Heritage South Bengaluru neighborhood home to Bull Temple & Bugle Rock.',
    color: '#f97316',
  },
  {
    id: 'banashankari',
    name: 'Banashankari',
    kannadaName: 'ಬನಶಂಕರಿ',
    region: 'South',
    lat: 12.9255,
    lon: 77.5468,
    radius: 120,
    description: 'Major south-western residential ring anchored by Banashankari TTMC.',
    color: '#f59e0b',
  },
  {
    id: 'silk_board',
    name: 'Silk Board Junction',
    kannadaName: 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್',
    region: 'South',
    lat: 12.9177,
    lon: 77.6233,
    radius: 95,
    description: 'Iconic multi-tier flyover intersection linking Hosur Road and ORR.',
    color: '#ef4444',
  },
  {
    id: 'electronic_city',
    name: 'Electronic City',
    kannadaName: 'ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ',
    region: 'South',
    lat: 12.8452,
    lon: 77.6602,
    radius: 180,
    description: 'Southern IT campus towers connected by the elevated Hosur expressway.',
    color: '#3b82f6',
  },
  {
    id: 'bannerghatta',
    name: 'Bannerghatta Road',
    kannadaName: 'ಬನ್ನೇರುಘಟ್ಟ ರಸ್ತೆ',
    region: 'South',
    lat: 12.8959,
    lon: 77.5994,
    radius: 130,
    description: 'Southern arterial stretching past IIM-B toward Bannerghatta hills.',
    color: '#22c55e',
  },
  {
    id: 'nice_road',
    name: 'NICE Road Expressway',
    kannadaName: 'ನೈಸ್ ರಸ್ತೆ',
    region: 'South',
    lat: 12.874,
    lon: 77.551,
    radius: 175,
    description: 'High-speed peripheral concrete ring expressway skirting south Bengaluru.',
    color: '#eab308',
  },

  // EAST BENGALURU (7)
  {
    id: 'indiranagar',
    name: 'Indiranagar',
    kannadaName: 'ಇಂದಿರಾನಗರ',
    region: 'East',
    lat: 12.9784,
    lon: 77.6408,
    radius: 130,
    description: '100 Feet Road cafes, tree-lined avenues, safehouse, and custom garage.',
    color: '#0ea5e9',
  },
  {
    id: 'hal',
    name: 'HAL Airport Corridor',
    kannadaName: 'ಎಚ್.ಎ.ಎಲ್',
    region: 'East',
    lat: 12.9592,
    lon: 77.6606,
    radius: 120,
    description: 'Aerospace heritage boulevard linking Domlur to Marathahalli.',
    color: '#0284c7',
  },
  {
    id: 'marathahalli',
    name: 'Marathahalli',
    kannadaName: 'ಮಾರತ್ತಹಳ್ಳಿ',
    region: 'East',
    lat: 12.9591,
    lon: 77.6974,
    radius: 135,
    description: 'Major eastern Outer Ring Road bridge and tech commuter junction.',
    color: '#f59e0b',
  },
  {
    id: 'bellandur',
    name: 'Bellandur',
    kannadaName: 'ಬೆಳ್ಳಂದೂರು',
    region: 'East',
    lat: 12.9279,
    lon: 77.6762,
    radius: 135,
    description: 'Tech corridor skirting Bellandur Lake along the Outer Ring Road.',
    color: '#0891b2',
  },
  {
    id: 'whitefield',
    name: 'Whitefield (ITPL)',
    kannadaName: 'ವೈಟ್‌ಫೀಲ್ಡ್',
    region: 'East',
    lat: 12.985,
    lon: 77.7365,
    radius: 165,
    description: 'ITPL glass tech parks, international malls, and Purple Line eastern terminus.',
    color: '#6366f1',
  },
  {
    id: 'kr_puram',
    name: 'KR Puram',
    kannadaName: 'ಕೆ.ಆರ್ ಪುರಂ',
    region: 'East',
    lat: 13.0012,
    lon: 77.6961,
    radius: 130,
    description: 'Cable-stayed hanging bridge, railway hub & Purple/Blue Metro junction.',
    color: '#8b5cf6',
  },
  {
    id: 'orr',
    name: 'Outer Ring Road (Iblur)',
    kannadaName: 'ಹೊರ ವರ್ತುಲ ರಸ್ತೆ',
    region: 'East',
    lat: 12.9212,
    lon: 77.657,
    radius: 130,
    description: 'Multi-lane eastern IT expressway linking Silk Board to Marathahalli.',
    color: '#eab308',
  },

  // NORTH BENGALURU (5 + KIA Airport)
  {
    id: 'hebbal',
    name: 'Hebbal Flyover',
    kannadaName: 'ಹೆಬ್ಬಾಳ',
    region: 'North',
    lat: 13.0358,
    lon: 77.597,
    radius: 140,
    description: 'Iconic multi-loop northern gateway flyover overlooking Hebbal Lake.',
    color: '#06b6d4',
  },
  {
    id: 'yelahanka',
    name: 'Yelahanka',
    kannadaName: 'ಯಲಹಂಕ',
    region: 'North',
    lat: 13.1007,
    lon: 77.5963,
    radius: 160,
    description: 'Northern satellite town along Bellary Road (NH-44) toward the airport.',
    color: '#0ea5e9',
  },
  {
    id: 'jakkur',
    name: 'Jakkur',
    kannadaName: 'ಜಕ್ಕೂರು',
    region: 'North',
    lat: 13.0764,
    lon: 77.6061,
    radius: 135,
    description: 'Historic aerodrome & lakeside corridor along Airport Expressway.',
    color: '#38bdf8',
  },
  {
    id: 'manyata_tech_park',
    name: 'Manyata Tech Park',
    kannadaName: 'ಮಾನ್ಯತಾ ಟೆಕ್ ಪಾರ್ಕ್',
    region: 'North',
    lat: 13.0458,
    lon: 77.62,
    radius: 145,
    description: 'Northern Outer Ring Road IT campus & glass business park.',
    color: '#4f46e5',
  },
  {
    id: 'yeshwanthpur',
    name: 'Yeshwanthpur',
    kannadaName: 'ಯಶವಂತಪುರ',
    region: 'North',
    lat: 13.0285,
    lon: 77.5409,
    radius: 145,
    description: 'Major northern railway junction, APMC market & Tumkur Road flyover.',
    color: '#3b82f6',
  },
  {
    id: 'kia_airport',
    name: 'Kempegowda Int’l Airport',
    kannadaName: 'ಕೆಂಪೇಗೌಡ ವಿಮಾನ ನಿಲ್ದಾಣ',
    region: 'North',
    lat: 13.1986,
    lon: 77.7066,
    radius: 210,
    description: 'Bengaluru Terminal 2 Garden Terminal & Northern Airport Expressway.',
    color: '#2563eb',
  },

  // WEST BENGALURU (4)
  {
    id: 'rajajinagar',
    name: 'Rajajinagar',
    kannadaName: 'ರಾಜಾಜಿನಗರ',
    region: 'West',
    lat: 12.9982,
    lon: 77.553,
    radius: 130,
    description: 'Industrial & residential hub connecting Chord Road, ISKCON & Orion.',
    color: '#8b5cf6',
  },
  {
    id: 'vijayanagar',
    name: 'Vijayanagar',
    kannadaName: 'ವಿಜಯನಗರ',
    region: 'West',
    lat: 12.9719,
    lon: 77.533,
    radius: 135,
    description: 'Western cultural neighborhood along the Chord Road Purple Line.',
    color: '#a855f7',
  },
  {
    id: 'malleshwaram',
    name: 'Malleshwaram',
    kannadaName: 'ಮಲ್ಲೇಶ್ವರಂ',
    region: 'West',
    lat: 13.0055,
    lon: 77.5692,
    radius: 110,
    description: 'Heritage tree-lined western avenues, 8th Cross markets & Sankey Tank.',
    color: '#22c55e',
  },
  {
    id: 'chandra_layout',
    name: 'Chandra Layout',
    kannadaName: 'ಚಂದ್ರಾ ಲೇಔಟ್',
    region: 'West',
    lat: 12.9577,
    lon: 77.5262,
    radius: 120,
    description: 'Western residential quarter linking Vijayanagar & Outer Ring Road.',
    color: '#7c3aed',
  },
];

function geoPts(coords: Array<[number, number]>): RoadPoint[] {
  return coords.map(([lat, lon]) => {
    const p = latLonToWorld(lat, lon);
    return { x: p.x, z: p.z, lat, lon };
  });
}

export interface GeoRoadDef {
  id: string;
  name: string;
  kind: 'highway' | 'arterial' | 'secondary' | 'flyover' | 'metro';
  width: number;
  elevated?: boolean;
  metroLine?: MetroLineId;
  metroStatus?: MetroStatus;
  coords: Array<[number, number]>;
}

/**
 * Real OpenStreetMap-aligned Bengaluru Road & Namma Metro Corridors (WGS84 coords)
 */
export const BENGALURU_GEO_ROADS_RAW: GeoRoadDef[] = [
  // 1. MG Road - Old Madras Rd - KR Puram - Whitefield
  {
    id: 'rd_mg_whitefield',
    name: 'Kasturba Rd – MG Road – Old Madras Rd – Whitefield',
    kind: 'arterial',
    width: 18,
    coords: [
      [12.9764, 77.5929], // Cubbon Park
      [12.9756, 77.6066], // MG Road
      [12.9735, 77.6202], // Trinity
      [12.9784, 77.6408], // Indiranagar
      [12.9908, 77.6525], // Baiyappanahalli
      [13.0012, 77.6961], // KR Puram
      [12.991, 77.718],   // Hoodi
      [12.985, 77.7365],  // Whitefield
    ],
  },
  // 2. Central Heritage & Shopping Grid: Brigade Rd, Commercial St, Shivajinagar, Majestic, KR Market
  {
    id: 'rd_central_loop',
    name: 'Majestic – Vidhana Soudha – Shivajinagar – Commercial St – Brigade Rd – KR Market',
    kind: 'secondary',
    width: 15,
    coords: [
      [12.9778, 77.5713], // Majestic
      [12.9797, 77.5912], // Vidhana Soudha
      [12.9857, 77.6057], // Shivajinagar
      [12.9822, 77.6083], // Commercial Street
      [12.9756, 77.6066], // MG Road
      [12.972, 77.6075],  // Brigade Road
      [12.9665, 77.599],  // Richmond Circle
      [12.9633, 77.5764], // KR Market
      [12.9778, 77.5713], // Back to Majestic
    ],
  },
  // 3. Hosur Road: Richmond Circle -> Koramangala -> Silk Board -> Electronic City
  {
    id: 'rd_hosur_ecity',
    name: 'Hosur Road (Richmond – Koramangala – Silk Board – Electronic City)',
    kind: 'highway',
    width: 20,
    coords: [
      [12.9665, 77.599],
      [12.952, 77.611],
      [12.9352, 77.6245],
      [12.9177, 77.6233],
      [12.891, 77.641],
      [12.865, 77.653],
      [12.8452, 77.6602],
    ],
  },
  // 4. Electronic City Elevated Expressway
  {
    id: 'flyover_ecity',
    name: 'Silk Board – Electronic City Elevated Expressway',
    kind: 'flyover',
    width: 11,
    elevated: true,
    coords: [
      [12.9177, 77.6233],
      [12.891, 77.641],
      [12.865, 77.653],
      [12.8452, 77.6602],
    ],
  },
  // 5. Outer Ring Road (ORR) Full Loop
  {
    id: 'rd_orr_full',
    name: 'Bengaluru Outer Ring Road (ORR)',
    kind: 'highway',
    width: 22,
    coords: [
      [12.9177, 77.6233], // Silk Board
      [12.9212, 77.657],  // Iblur
      [12.9279, 77.6762], // Bellandur
      [12.9591, 77.6974], // Marathahalli
      [13.0012, 77.6961], // KR Puram
      [13.0445, 77.643],  // Nagawara
      [13.0458, 77.62],   // Manyata Tech Park
      [13.0358, 77.597],  // Hebbal
      [13.0285, 77.5409], // Yeshwanthpur
      [12.9982, 77.553],  // Rajajinagar
      [12.9719, 77.533],  // Vijayanagar
      [12.9577, 77.5262], // Chandra Layout
      [12.9255, 77.5468], // Banashankari ORR
      [12.9063, 77.5857], // JP Nagar ORR
      [12.9166, 77.6101], // BTM Layout
      [12.9177, 77.6233], // Silk Board
    ],
  },
  // 6. Old Airport Road (HAL) + Inner Ring Rd
  {
    id: 'rd_old_airport_hal',
    name: 'Old Airport Rd (Trinity – Domlur – HAL – Marathahalli)',
    kind: 'arterial',
    width: 17,
    coords: [
      [12.9735, 77.6202], // Trinity
      [12.961, 77.638],   // Domlur
      [12.9592, 77.6606], // HAL
      [12.9591, 77.6974], // Marathahalli
    ],
  },
  {
    id: 'rd_indira_100ft',
    name: 'Indiranagar 100 Feet Rd – Domlur – Koramangala Inner Ring Rd',
    kind: 'arterial',
    width: 16,
    coords: [
      [12.9784, 77.6408],
      [12.961, 77.638],
      [12.947, 77.631],
      [12.9352, 77.6245],
    ],
  },
  // 7. Bannerghatta Road
  {
    id: 'rd_bannerghatta',
    name: 'Bannerghatta Road (Shantinagar – Jayadeva – IIM-B – NICE)',
    kind: 'arterial',
    width: 17,
    coords: [
      [12.9554, 77.5931], // Shantinagar
      [12.937, 77.599],   // Dairy Circle
      [12.9165, 77.6001], // Jayadeva
      [12.8959, 77.5994], // Bannerghatta Rd
      [12.866, 77.596],   // NICE Junction
    ],
  },
  // 8. Kanakapura Road & Basavanagudi
  {
    id: 'rd_kanakapura',
    name: 'Kanakapura Rd (KR Market – Basavanagudi – Jayanagar – Banashankari – JP Nagar)',
    kind: 'arterial',
    width: 17,
    coords: [
      [12.9633, 77.5764], // KR Market
      [12.9507, 77.5848], // Lalbagh
      [12.9421, 77.5738], // Basavanagudi
      [12.9299, 77.5838], // Jayanagar
      [12.9255, 77.5468], // Banashankari
      [12.9063, 77.5857], // JP Nagar
      [12.874, 77.551],   // NICE Kanakapura
    ],
  },
  // 9. Mysore Road & Chandra Layout
  {
    id: 'rd_mysore_road',
    name: 'Mysore Road (KR Market – Satellite Bus Stand – Chandra Layout – NICE)',
    kind: 'arterial',
    width: 18,
    coords: [
      [12.9633, 77.5764], // KR Market
      [12.9556, 77.5446], // Satellite Bus Stand
      [12.9577, 77.5262], // Chandra Layout
      [12.9719, 77.533],  // Vijayanagar
      [12.944, 77.515],   // NICE Mysore Rd
    ],
  },
  // 10. Tumkur Road (NH-48): Majestic -> Malleshwaram -> Yeshwanthpur -> BIEC
  {
    id: 'rd_tumkur_road',
    name: 'Tumkur Road NH-48 (Majestic – Malleshwaram – Yeshwanthpur – BIEC)',
    kind: 'highway',
    width: 19,
    coords: [
      [12.9778, 77.5713], // Majestic
      [12.9982, 77.553],  // Rajajinagar
      [13.0055, 77.5692], // Malleshwaram
      [13.0285, 77.5409], // Yeshwanthpur
      [13.0623, 77.4754], // BIEC
    ],
  },
  // 11. Bellary Road (NH-44): Vidhana Soudha -> Bangalore Palace -> Hebbal -> Jakkur -> Yelahanka -> KIA Airport
  {
    id: 'rd_bellary_airport',
    name: 'Bellary Rd NH-44 (Vidhana Soudha – Hebbal – Jakkur – Yelahanka – KIA Airport)',
    kind: 'highway',
    width: 20,
    coords: [
      [12.9797, 77.5912], // Vidhana Soudha
      [12.9988, 77.5921], // Bangalore Palace
      [13.016, 77.589],   // Mekhri Circle
      [13.0358, 77.597],  // Hebbal
      [13.0764, 77.6061], // Jakkur
      [13.1007, 77.5963], // Yelahanka
      [13.1986, 77.7066], // Kempegowda International Airport
    ],
  },
  // 12. NICE Peripheral Ring Expressway
  {
    id: 'rd_nice_expressway',
    name: 'NICE Road Peripheral Expressway',
    kind: 'highway',
    width: 24,
    coords: [
      [13.0623, 77.4754], // Tumkur Rd BIEC NICE
      [12.944, 77.515],   // Mysore Rd NICE
      [12.874, 77.551],   // Kanakapura NICE
      [12.866, 77.596],   // Bannerghatta NICE
      [12.8452, 77.6602], // Electronic City NICE
    ],
  },
  // 13. Cantonment -> Shivajinagar -> Manyata Connector
  {
    id: 'rd_cantonment_north',
    name: 'Cantonment – Tannery Rd – Nagawara – Manyata',
    kind: 'secondary',
    width: 15,
    coords: [
      [12.9857, 77.6057], // Shivajinagar
      [12.9936, 77.5981], // Bengaluru Cantonment
      [13.0445, 77.643],  // Nagawara
      [13.0458, 77.62],   // Manyata Tech Park
    ],
  },
  // 14. Namma Metro Purple Line (Operational)
  {
    id: 'metro_purple',
    name: 'Namma Metro Purple Line (Operational)',
    kind: 'metro',
    width: 7.2,
    elevated: true,
    metroLine: 'purple',
    metroStatus: 'operational',
    coords: [
      [12.9719, 77.533],  // Vijayanagar
      [12.9778, 77.5713], // Majestic
      [12.9797, 77.5912], // Vidhana Soudha
      [12.9756, 77.6066], // MG Road
      [12.9735, 77.6202], // Trinity
      [12.9784, 77.6408], // Indiranagar
      [12.9908, 77.6525], // Baiyappanahalli
      [13.0012, 77.6961], // KR Puram
      [12.985, 77.7365],  // Whitefield (Kadugodi)
    ],
  },
  // 15. Namma Metro Green Line (Operational)
  {
    id: 'metro_green',
    name: 'Namma Metro Green Line (Operational)',
    kind: 'metro',
    width: 7.2,
    elevated: true,
    metroLine: 'green',
    metroStatus: 'operational',
    coords: [
      [13.0285, 77.5409], // Yeshwanthpur
      [12.9982, 77.553],  // Rajajinagar
      [12.9778, 77.5713], // Majestic
      [12.9633, 77.5764], // KR Market
      [12.9507, 77.5848], // Lalbagh
      [12.9299, 77.5838], // Jayanagar
      [12.9218, 77.5801], // RV Road
      [12.9063, 77.5857], // JP Nagar
    ],
  },
  // 16. Namma Metro Yellow Line (Operational RV Road – Bommasandra)
  {
    id: 'metro_yellow',
    name: 'Namma Metro Yellow Line (Operational)',
    kind: 'metro',
    width: 7.2,
    elevated: true,
    metroLine: 'yellow',
    metroStatus: 'operational',
    coords: [
      [12.9218, 77.5801], // RV Road
      [12.9165, 77.6001], // Jayadeva
      [12.9177, 77.6233], // Silk Board
      [12.8452, 77.6602], // Electronic City
      [12.8152, 77.6911], // Bommasandra
    ],
  },
  // 17. Namma Metro Pink Line (Under Construction: Bannerghatta/Kalena Agrahara -> MG Road -> Nagawara)
  {
    id: 'metro_pink',
    name: 'Namma Metro Pink Line (Under Construction)',
    kind: 'metro',
    width: 6.4,
    elevated: true,
    metroLine: 'pink',
    metroStatus: 'under_construction',
    coords: [
      [12.8959, 77.5994], // Kalena Agrahara / Bannerghatta
      [12.9165, 77.6001], // Jayadeva
      [12.9756, 77.6066], // MG Road
      [12.9857, 77.6057], // Shivajinagar
      [12.9936, 77.5981], // Cantonment
      [13.0445, 77.643],  // Nagawara
    ],
  },
  // 18. Namma Metro Blue Line (Under Construction: Silk Board -> KR Puram -> Hebbal -> KIA Airport)
  {
    id: 'metro_blue',
    name: 'Namma Metro Blue Line (Under Construction)',
    kind: 'metro',
    width: 6.4,
    elevated: true,
    metroLine: 'blue',
    metroStatus: 'under_construction',
    coords: [
      [12.9177, 77.6233], // Silk Board
      [12.9279, 77.6762], // Bellandur
      [12.9591, 77.6974], // Marathahalli
      [13.0012, 77.6961], // KR Puram
      [13.0445, 77.643],  // Nagawara
      [13.0358, 77.597],  // Hebbal
      [13.0764, 77.6061], // Jakkur
      [13.1007, 77.5963], // Yelahanka
      [13.1986, 77.7066], // KIA Airport
    ],
  },
];

export const BENGALURU_GEO_ROADS = BENGALURU_GEO_ROADS_RAW.map((r) => ({
  id: r.id,
  name: r.name,
  kind: r.kind,
  width: r.width,
  elevated: r.elevated,
  metroLine: r.metroLine,
  metroStatus: r.metroStatus,
  points: geoPts(r.coords),
}));

export const BENGALURU_GEO_LAKES_RAW = [
  { id: 'cubbon_pond', name: 'Cubbon Park Lotus Pond', lat: 12.9752, lon: 77.592, rx: 14, rz: 10 },
  { id: 'ulsoor_lake', name: 'Ulsoor Lake', lat: 12.9817, lon: 77.6202, rx: 52, rz: 36 },
  { id: 'lalbagh_lake', name: 'Lalbagh Lake', lat: 12.9485, lon: 77.5815, rx: 32, rz: 24 },
  { id: 'sankey_tank', name: 'Sankey Tank', lat: 13.0102, lon: 77.5735, rx: 36, rz: 28 },
  { id: 'bellandur_lake', name: 'Bellandur Lake', lat: 12.937, lon: 77.674, rx: 95, rz: 58 },
  { id: 'hebbal_lake', name: 'Hebbal Lake', lat: 13.045, lon: 77.586, rx: 64, rz: 42 },
];

/**
 * Generates an OpenStreetMap-compliant GeoJSON FeatureCollection for Bengaluru
 * (EPSG:4326 WGS84 [lon, lat] coordinate ordering) consumed by GeoJsonWorldPartitionImporter.
 */
export const BENGALURU_OSM_GEOJSON: GeoJsonFeatureCollection = {
  type: 'FeatureCollection',
  name: 'Bengaluru_OSM_Network_WGS84',
  crs: { type: 'name', properties: { name: 'EPSG:4326' } },
  features: [
    ...BENGALURU_GEO_ROADS_RAW.map(
      (road): GeoJsonFeature => ({
        type: 'Feature',
        id: road.id,
        properties: {
          name: road.name,
          highway: road.kind === 'highway' ? 'trunk' : road.kind === 'flyover' ? 'motorway' : road.kind === 'arterial' ? 'primary' : road.kind === 'secondary' ? 'secondary' : undefined,
          railway: road.kind === 'metro' ? 'subway' : undefined,
          metroLine: road.metroLine,
          metroStatus: road.metroStatus,
          width: road.width,
          bridge: road.elevated ? 'yes' : undefined,
          layer: road.elevated ? 1 : 0,
        },
        geometry: {
          type: 'LineString',
          coordinates: road.coords.map(([lat, lon]) => [lon, lat]),
        },
      })
    ),
    ...BENGALURU_GEO_LAKES_RAW.map(
      (lake): GeoJsonFeature => ({
        type: 'Feature',
        id: lake.id,
        properties: {
          name: lake.name,
          natural: 'water',
          rx: lake.rx,
          rz: lake.rz,
        },
        geometry: {
          type: 'Point',
          coordinates: [lake.lon, lake.lat],
        },
      })
    ),
  ],
};

/**
 * Mysore Plateau topographic heightfield for Bengaluru (meters above Cubbon datum).
 */
export function getBengaluruTerrainY(x: number, z: number): number {
  let h =
    Math.sin(x * 0.0042) * Math.cos(z * 0.0048) * 1.4 +
    Math.sin((x + z) * 0.0021) * 0.9;

  // Lalbagh peninsular gneiss hillock
  const dLal = Math.hypot(x - -85, z - 185);
  if (dLal < 75) {
    h += Math.cos((dLal / 75) * Math.PI * 0.5) * 2.4;
  }

  // Bellandur valley basin
  const dBell = Math.hypot(x - 690, z - 305);
  if (dBell < 150) {
    h -= Math.cos((dBell / 150) * Math.PI * 0.5) * 1.6;
  }

  return Math.max(-0.6, h * 0.55);
}

/**
 * Automated Geographical Map Validation comparing WGS84 Haversine ground-truth
 * distances against projected UTM 43N / Game World coordinates.
 */
export function validateBengaluruGeography(): GeoValidationReport {
  const entries: GeoValidationEntry[] = [];
  let sumErrorPct = 0;
  let maxErrMeters = 0;

  for (const loc of BENGALURU_GEO_LOCATIONS) {
    const proj = latLonToWorld(loc.lat, loc.lon);
    const realDistM = haversineMeters(ORIGIN_LAT, ORIGIN_LON, loc.lat, loc.lon);
    const projDistM = Math.hypot(proj.x, proj.z) * WORLD_SCALE_METERS_PER_UNIT;
    const errMeters = Math.abs(realDistM - projDistM);
    if (realDistM > 50) {
      sumErrorPct += (errMeters / realDistM) * 100;
    }
    if (errMeters > maxErrMeters) maxErrMeters = errMeters;

    const bearingRad = Math.atan2(proj.x, -proj.z);
    const bearingDeg = ((bearingRad * 180) / Math.PI + 360) % 360;

    entries.push({
      id: loc.id,
      name: loc.name,
      region: loc.region,
      lat: loc.lat,
      lon: loc.lon,
      utmEasting: Math.round(proj.easting),
      utmNorthing: Math.round(proj.northing),
      worldX: Math.round(proj.x * 10) / 10,
      worldZ: Math.round(proj.z * 10) / 10,
      realDistKm: Math.round((realDistM / 1000) * 100) / 100,
      projectedDistKm: Math.round((projDistM / 1000) * 100) / 100,
      bearingDeg: Math.round(bearingDeg),
      errorMeters: Math.round(errMeters * 10) / 10,
    });
  }

  const uniqueJunctions = new Set<string>();
  for (const r of BENGALURU_GEO_ROADS) {
    for (const pt of r.points) {
      uniqueJunctions.add(`${Math.round(pt.x / 5)}_${Math.round(pt.z / 5)}`);
    }
  }

  return {
    datum: 'WGS84 (EPSG:4326)',
    projection: 'UTM Zone 43N (EPSG:32643)',
    originLat: ORIGIN_LAT,
    originLon: ORIGIN_LON,
    scaleMetersPerUnit: WORLD_SCALE_METERS_PER_UNIT,
    attribution: 'OpenStreetMap contributors (ODbL) · BMRCL & BBMP Civic Geography',
    meanScaleErrorPct: Math.round((sumErrorPct / BENGALURU_GEO_LOCATIONS.length) * 1000) / 1000,
    maxDistanceErrorMeters: Math.round(maxErrMeters * 10) / 10,
    connectedRoadCount: BENGALURU_GEO_ROADS.length,
    junctionCount: uniqueJunctions.size,
    entries,
  };
}
