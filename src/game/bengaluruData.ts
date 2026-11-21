import { GeoJsonWorldPartitionImporter } from './GeoJsonWorldPartition';
import {
  BENGALURU_GEO_LOCATIONS,
  BENGALURU_OSM_GEOJSON,
  getBengaluruTerrainY,
  latLonToWorld,
} from './bengaluruGeo';
import {
  getFlyoverOrRoadSurfaceY,
  getGradedGroundY,
  isPointOnCurvedRoad,
} from './roadGeometry';
import {
  CollectibleDef,
  DistrictDef,
  GroceryItemDef,
  LandmarkMarker,
  MetroLineId,
  MetroStationDef,
  MetroStatus,
  MissionDef,
  ProtagonistId,
  ProtagonistProfile,
  RadioCategoryId,
  RadioTrack,
  RailBusStationDef,
  RoadSegment,
  VehicleKind,
  WaterZone,
  WeaponKind,
} from './types';

export const WORLD_HALF_SIZE = 2350;

const _geoImporter = new GeoJsonWorldPartitionImporter();
export const INITIAL_OSM_IMPORT = _geoImporter.importGeoJson(BENGALURU_OSM_GEOJSON);

export const PROTAGONIST_PRESETS: Record<ProtagonistId, ProtagonistProfile> = {
  vikram: {
    id: 'vikram',
    name: 'Vikram Rao',
    archetypeTitle: 'The Businessman',
    age: 38,
    personality: 'Confident, commanding corporate strategist across UB City & Whitefield.',
    bodySummary: 'Broad natural build · Short tailored hair · Trimmed beard · Premium casual',
    heightScale: 1.05,
    widthScale: 1.13,
    abdomenScale: 1.04,
    ageGroup: 'middle',
    customization: {
      protagonistId: 'vikram',
      facePreset: 'vikram_exec',
      hairStyle: 'short_crop',
      hairColor: '#1c1917',
      beardStyle: 'trimmed_beard',
      outfitStyle: 'suit',
      jacketColor: '#1e293b',
      shirtColor: '#f8fafc',
      pantsColor: '#0f172a',
      shoeColor: '#3f2314',
      watch: true,
      sunglasses: true,
      backpack: false,
      chain: false,
    },
  },
  arjun: {
    id: 'arjun',
    name: 'Arjun Menon',
    archetypeTitle: 'The Intelligent Professional',
    age: 32,
    personality: 'Calm, sharp-minded Bengaluru architect with natural poise.',
    bodySummary: 'Medium athletic build · Textured medium hair · Natural beard & moustache · Jeans',
    heightScale: 1.02,
    widthScale: 1.0,
    abdomenScale: 0.96,
    ageGroup: 'young',
    customization: {
      protagonistId: 'arjun',
      facePreset: 'arjun_classic',
      hairStyle: 'side_part',
      hairColor: '#18181b',
      beardStyle: 'stubble',
      outfitStyle: 'jacket',
      jacketColor: '#334155',
      shirtColor: '#e2e8f0',
      pantsColor: '#1e293b',
      shoeColor: '#111827',
      watch: true,
      sunglasses: false,
      backpack: true,
      chain: false,
    },
  },
  sathish: {
    id: 'sathish',
    name: 'Sathish Gowda',
    archetypeTitle: 'The Street Character',
    age: 34,
    personality: 'Humorous, fearless old-Bengaluru street fixer with unmistakable charm.',
    bodySummary: 'Heavyset natural build · Medium wavy hair · Bold moustache · Colourful shirt',
    heightScale: 0.99,
    widthScale: 1.22,
    abdomenScale: 1.18,
    ageGroup: 'young',
    customization: {
      protagonistId: 'sathish',
      facePreset: 'sathish_street',
      hairStyle: 'wavy_long',
      hairColor: '#18181b',
      beardStyle: 'moustache',
      outfitStyle: 'street_shirt',
      jacketColor: '#d97706',
      shirtColor: '#ea580c',
      pantsColor: '#172554',
      shoeColor: '#f8fafc',
      watch: true,
      sunglasses: true,
      backpack: false,
      chain: true,
    },
  },
};

export const DISTRICTS: DistrictDef[] = BENGALURU_GEO_LOCATIONS.map((loc) => {
  const p = latLonToWorld(loc.lat, loc.lon);
  return {
    id: loc.id,
    name: loc.name,
    kannadaName: loc.kannadaName,
    region: loc.region,
    lat: loc.lat,
    lon: loc.lon,
    x: p.x,
    z: p.z,
    radius: loc.radius,
    description: loc.description,
    color: loc.color,
  };
});

export function getDistrictCenter(id: DistrictDef['id']): { x: number; z: number } {
  const found = DISTRICTS.find((d) => d.id === id);
  return found ? { x: found.x, z: found.z } : { x: 0, z: 0 };
}

export const ROAD_SEGMENTS: RoadSegment[] = INITIAL_OSM_IMPORT.roads.map((r) =>
  r.id === 'rd_central_loop'
    ? { ...r, oneWay: true, lanes: 3 }
    : { ...r, lanes: r.kind === 'highway' ? 4 : r.kind === 'arterial' ? 3 : 2 }
);
export const WATER_ZONES: WaterZone[] = INITIAL_OSM_IMPORT.waters;

export interface PoliceStationDef {
  id: string;
  name: string;
  kannadaName: string;
  district: DistrictDef['id'];
  lat: number;
  lon: number;
  x: number;
  z: number;
}

export const POLICE_STATIONS: PoliceStationDef[] = (
  [
    { id: 'ps_cubbon', name: 'Cubbon Park Police Station', kannadaName: 'ಕಬ್ಬನ್ ಪಾರ್ಕ್ ಠಾಣೆ', district: 'cubbon_park', lat: 12.9762, lon: 77.5974 },
    { id: 'ps_indiranagar', name: 'Indiranagar Law & Order PS', kannadaName: 'ಇಂದಿರಾನಗರ ಪೊಲೀಸ್ ಠಾಣೆ', district: 'indiranagar', lat: 12.9786, lon: 77.6382 },
    { id: 'ps_koramangala', name: 'Koramangala 3rd Block PS', kannadaName: 'ಕೋರಮಂಗಲ ಪೊಲೀಸ್ ಠಾಣೆ', district: 'koramangala', lat: 12.9344, lon: 77.6242 },
    { id: 'ps_upparpet', name: 'Upparpet / Majestic PS', kannadaName: 'ಉಪ್ಪಾರಪೇಟೆ ಪೊಲೀಸ್ ಠಾಣೆ', district: 'majestic', lat: 12.9769, lon: 77.5742 },
    { id: 'ps_silk_board', name: 'Madivala / Silk Board PS', kannadaName: 'ಮಡಿವಾಳ ಪೊಲೀಸ್ ಠಾಣೆ', district: 'silk_board', lat: 12.921, lon: 77.6208 },
  ] as const
).map((ps) => {
  const w = latLonToWorld(ps.lat, ps.lon);
  return { ...ps, x: w.x, z: w.z };
});

export function getNearestPoliceStation(x: number, z: number): PoliceStationDef {
  let best = POLICE_STATIONS[0];
  let bestD = Infinity;
  for (const ps of POLICE_STATIONS) {
    const d = Math.hypot(x - ps.x, z - ps.z);
    if (d < bestD) {
      bestD = d;
      best = ps;
    }
  }
  return best;
}

export function computeBmrclMetroFare(stops: number, smartCard: boolean): number {
  const s = Math.max(1, stops);
  const base = s <= 2 ? 10 : s <= 4 ? 20 : s <= 6 ? 30 : s <= 9 ? 40 : s <= 12 ? 50 : 60;
  return smartCard ? Math.max(10, Math.round(base * 0.95)) : base;
}

function mkMetro(
  id: string,
  name: string,
  kannadaName: string,
  line: MetroLineId,
  order: number,
  status: MetroStatus,
  elevated: boolean,
  lat: number,
  lon: number,
  interchangeWith?: MetroLineId[]
): MetroStationDef {
  const p = latLonToWorld(lat, lon);
  return { id, name, kannadaName, line, order, status, elevated, lat, lon, x: p.x, z: p.z, interchangeWith };
}

export const METRO_STATIONS: MetroStationDef[] = [
  // Purple Line (Operational)
  mkMetro('mp_vijayanagar', 'Vijayanagar Metro', 'ವಿಜಯನಗರ ಮೆಟ್ರೋ', 'purple', 1, 'operational', true, 12.9719, 77.533),
  mkMetro('mp_majestic', 'Nadaprabhu Kempegowda (Majestic)', 'ಮೆಜೆಸ್ಟಿಕ್ ಮೆಟ್ರೋ', 'purple', 2, 'operational', false, 12.9778, 77.5713, ['green']),
  mkMetro('mp_vidhana', 'Dr. B.R. Ambedkar (Vidhana Soudha)', 'ವಿಧಾನ ಸೌಧ ಮೆಟ್ರೋ', 'purple', 3, 'operational', false, 12.9797, 77.5912),
  mkMetro('mp_mg_road', 'MG Road Metro', 'ಎಂ.ಜಿ ರಸ್ತೆ ಮೆಟ್ರೋ', 'purple', 4, 'operational', true, 12.9756, 77.6066, ['pink']),
  mkMetro('mp_trinity', 'Trinity Metro', 'ಟ್ರಿನಿಟಿ ಮೆಟ್ರೋ', 'purple', 5, 'operational', true, 12.9735, 77.6202),
  mkMetro('mp_indiranagar', 'Indiranagar Metro', 'ಇಂದಿರಾನಗರ ಮೆಟ್ರೋ', 'purple', 6, 'operational', true, 12.9784, 77.6408),
  mkMetro('mp_baiyappanahalli', 'Baiyappanahalli Metro', 'ಬೈಯಪ್ಪನಹಳ್ಳಿ ಮೆಟ್ರೋ', 'purple', 7, 'operational', true, 12.9908, 77.6525),
  mkMetro('mp_kr_puram', 'KR Puram Metro', 'ಕೆ.ಆರ್ ಪುರಂ ಮೆಟ್ರೋ', 'purple', 8, 'operational', true, 13.0012, 77.6961, ['blue']),
  mkMetro('mp_whitefield', 'Whitefield (Kadugodi) Metro', 'ವೈಟ್‌ಫೀಲ್ಡ್ ಮೆಟ್ರೋ', 'purple', 9, 'operational', true, 12.985, 77.7365),

  // Green Line (Operational)
  mkMetro('mg_yeshwanthpur', 'Yeshwanthpur Metro', 'ಯಶವಂತಪುರ ಮೆಟ್ರೋ', 'green', 1, 'operational', true, 13.0285, 77.5409),
  mkMetro('mg_rajajinagar', 'Rajajinagar Metro', 'ರಾಜಾಜಿನಗರ ಮೆಟ್ರೋ', 'green', 2, 'operational', true, 12.9982, 77.553),
  mkMetro('mg_majestic', 'Majestic Green Interchange', 'ಮೆಜೆಸ್ಟಿಕ್ ಗ್ರೀನ್', 'green', 3, 'operational', false, 12.9778, 77.5713, ['purple']),
  mkMetro('mg_kr_market', 'KR Market Metro', 'ಕೆ.ಆರ್ ಮಾರುಕಟ್ಟೆ ಮೆಟ್ರೋ', 'green', 4, 'operational', false, 12.9633, 77.5764),
  mkMetro('mg_lalbagh', 'Lalbagh Metro', 'ಲಾಲ್‌ಬಾಗ್ ಮೆಟ್ರೋ', 'green', 5, 'operational', true, 12.9507, 77.5848),
  mkMetro('mg_jayanagar', 'Jayanagar Metro', 'ಜಯನಗರ ಮೆಟ್ರೋ', 'green', 6, 'operational', true, 12.9299, 77.5838),
  mkMetro('mg_rv_road', 'Rashtreeya Vidyalaya Road', 'ಆರ್.ವಿ ರಸ್ತೆ ಮೆಟ್ರೋ', 'green', 7, 'operational', true, 12.9218, 77.5801, ['yellow']),
  mkMetro('mg_jp_nagar', 'JP Nagar Metro', 'ಜೆ.ಪಿ ನಗರ ಮೆಟ್ರೋ', 'green', 8, 'operational', true, 12.9063, 77.5857),

  // Yellow Line (Operational RV Road – Bommasandra)
  mkMetro('my_rv_road', 'RV Road Yellow Terminal', 'ಆರ್.ವಿ ರಸ್ತೆ ಯೆಲ್ಲೋ', 'yellow', 1, 'operational', true, 12.9218, 77.5801, ['green']),
  mkMetro('my_jayadeva', 'Jayadeva Hospital Interchange', 'ಜಯದೇವ ಮೆಟ್ರೋ', 'yellow', 2, 'operational', true, 12.9165, 77.6001, ['pink']),
  mkMetro('my_silk_board', 'Central Silk Board Metro', 'ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಮೆಟ್ರೋ', 'yellow', 3, 'operational', true, 12.9177, 77.6233, ['blue']),
  mkMetro('my_ecity', 'Electronic City Metro', 'ಎಲೆಕ್ಟ್ರಾನಿಕ್ ಸಿಟಿ ಮೆಟ್ರೋ', 'yellow', 4, 'operational', true, 12.8452, 77.6602),
  mkMetro('my_bommasandra', 'Bommasandra Metro', 'ಬೊಮ್ಮಸಂದ್ರ ಮೆಟ್ರೋ', 'yellow', 5, 'operational', true, 12.8152, 77.6911),

  // Pink Line (Under Construction)
  mkMetro('mpk_bannerghatta', 'Kalena Agrahara (Const.)', 'ಕಾಳೇನ ಅಗ್ರಹಾರ (ನಿರ್ಮಾಣ)', 'pink', 1, 'under_construction', true, 12.8959, 77.5994),
  mkMetro('mpk_shivajinagar', 'Shivajinagar UG (Const.)', 'ಶಿವಾಜಿನಗರ (ನಿರ್ಮಾಣ)', 'pink', 2, 'under_construction', false, 12.9857, 77.6057),
  mkMetro('mpk_cantonment', 'Cantonment UG (Const.)', 'ಕಂಟೋನ್ಮೆಂಟ್ (ನಿರ್ಮಾಣ)', 'pink', 3, 'under_construction', false, 12.9936, 77.5981),
  mkMetro('mpk_nagawara', 'Nagawara (Const.)', 'ನಾಗವಾರ (ನಿರ್ಮಾಣ)', 'pink', 4, 'under_construction', false, 13.0445, 77.643, ['blue']),

  // Blue Line (Under Construction)
  mkMetro('mbl_bellandur', 'Bellandur ORR (Const.)', 'ಬೆಳ್ಳಂದೂರು (ನಿರ್ಮಾಣ)', 'blue', 1, 'under_construction', true, 12.9279, 77.6762),
  mkMetro('mbl_marathahalli', 'Marathahalli (Const.)', 'ಮಾರತ್ತಹಳ್ಳಿ (ನಿರ್ಮಾಣ)', 'blue', 2, 'under_construction', true, 12.9591, 77.6974),
  mkMetro('mbl_hebbal', 'Hebbal ORR (Const.)', 'ಹೆಬ್ಬಾಳ (ನಿರ್ಮಾಣ)', 'blue', 3, 'under_construction', true, 13.0358, 77.597),
  mkMetro('mbl_kia', 'KIA Airport Terminal (Const.)', 'ವಿಮಾನ ನಿಲ್ದಾಣ (ನಿರ್ಮಾಣ)', 'blue', 4, 'under_construction', true, 13.1986, 77.7066),
];

function mkHub(
  id: string,
  name: string,
  kannadaName: string,
  kind: 'rail' | 'bus',
  lat: number,
  lon: number,
  district: DistrictDef['id'],
  platforms: number,
  routes: string[]
): RailBusStationDef {
  const p = latLonToWorld(lat, lon);
  return { id, name, kannadaName, kind, lat, lon, x: p.x, z: p.z, district, platforms, routes };
}

export const RAIL_BUS_STATIONS: RailBusStationDef[] = [
  mkHub('rail_ksr', 'KSR Bengaluru City Railway Station', 'ಕ್ರಾಂತಿವೀರ ಸಂಗೊಳ್ಳಿ ರಾಯಣ್ಣ', 'rail', 12.9781, 77.5698, 'majestic', 10, ['Mysuru Express', 'Shatabdi', 'Suburban Ring']),
  mkHub('rail_cantonment', 'Bengaluru Cantonment Railway Station', 'ಬೆಂಗಳೂರು ಕಂಟೋನ್ಮೆಂಟ್', 'rail', 12.9936, 77.5981, 'shivajinagar', 4, ['KIA Airport Shuttle Rail', 'Whitefield MEMU']),
  mkHub('rail_yeshwanthpur', 'Yesvantpur Junction', 'ಯಶವಂತಪುರ ಜಂಕ್ಷನ್', 'rail', 13.0285, 77.5409, 'yeshwanthpur', 6, ['Hubballi Express', 'Tumkur MEMU']),
  mkHub('rail_kr_puram', 'Krishnarajapuram Railway Station', 'ಕೆ.ಆರ್ ಪುರಂ ರೈಲು ನಿಲ್ದಾಣ', 'rail', 13.0005, 77.6845, 'kr_puram', 4, ['Whitefield Tech Shuttle', 'Chennai Mail']),
  mkHub('rail_smvt', 'Sir M. Visvesvaraya Terminal (SMVT)', 'ಸರ್ ಎಂ.ವಿ ಟರ್ಮಿನಲ್', 'rail', 12.9946, 77.6562, 'indiranagar', 7, ['Airport Express', 'Bangarapet MEMU']),
  mkHub('bus_majestic', 'Kempegowda Bus Station (Majestic)', 'ಕೆಂಪೇಗೌಡ ಬಸ್ ನಿಲ್ದಾಣ', 'bus', 12.977, 77.5724, 'majestic', 28, ['Vajra V-335E', 'KIAS-9 Airport', '500D ORR']),
  mkHub('bus_shantinagar', 'Shantinagar TTMC Bus Station', 'ಶಾಂತಿನಗರ ಬಸ್ ನಿಲ್ದಾಣ', 'bus', 12.9554, 77.5931, 'mg_road', 14, ['Koramangala Express', 'Bannerghatta 365']),
  mkHub('bus_satellite', 'Mysore Road Satellite Bus Station', 'ಮೈಸೂರು ರಸ್ತೆ ಸ್ಯಾಟಲೈಟ್', 'bus', 12.9556, 77.5446, 'vijayanagar', 16, ['NICE Ring Express', 'Mysuru Airavat']),
];

function mkLandmark(
  id: string,
  name: string,
  type: LandmarkMarker['type'],
  lat: number,
  lon: number,
  district: LandmarkMarker['district'],
  description: string,
  extra?: Partial<LandmarkMarker>
): LandmarkMarker {
  const p = latLonToWorld(lat, lon);
  return { id, name, type, lat, lon, x: p.x, z: p.z, district, description, ...extra };
}

export const LANDMARK_MARKERS: LandmarkMarker[] = [
  // 15 Famous Bengaluru Landmarks
  mkLandmark('lm_vidhana_soudha', 'Vidhana Soudha', 'landmark', 12.9797, 77.5912, 'vidhana_soudha', 'Grand neo-Dravidian granite legislature with illuminated central dome.'),
  mkLandmark('lm_bangalore_palace', 'Bangalore Palace', 'landmark', 12.9988, 77.5921, 'vidhana_soudha', 'Tudor-style stone fortress towers & royal gardens.'),
  mkLandmark('lm_lalbagh_glasshouse', 'Lalbagh Glass House', 'landmark', 12.9507, 77.5848, 'jayanagar', 'Historic iron-and-glass botanical conservatory.'),
  mkLandmark('lm_cubbon_park', 'Cubbon Park & Bandstand', 'landmark', 12.9764, 77.5929, 'cubbon_park', '300-acre rain-tree heritage park & Victorian bandstand.'),
  mkLandmark('lm_attara_kacheri', 'Attara Kacheri (High Court)', 'landmark', 12.9776, 77.5925, 'cubbon_park', 'Pompeian-red two-storey classical Karnataka High Court colonnade.'),
  mkLandmark('lm_tipu_palace', 'Tipu Sultan’s Summer Palace', 'landmark', 12.9593, 77.5736, 'kr_market', 'Ornate carved teakwood pavilion beside KR Market.'),
  mkLandmark('lm_iskcon', 'ISKCON Temple Bengaluru', 'landmark', 13.0098, 77.5511, 'rajajinagar', 'Stepped golden-kalasha marble & glass hill shrine.'),
  mkLandmark('lm_bull_temple', 'Bull Temple (Dodda Basavana Gudi)', 'landmark', 12.9419, 77.568, 'basavanagudi', 'Dravidian granite gopuram & sacred Nandi shrine in Basavanagudi.'),
  mkLandmark('lm_chinnaswamy', 'M. Chinnaswamy Stadium', 'landmark', 12.9788, 77.5996, 'mg_road', 'Iconic floodlit cricket bowl overlooking Cubbon Park.'),
  mkLandmark('lm_ub_city', 'UB City Luxury Skyscrapers', 'landmark', 12.9716, 77.5961, 'mg_road', 'High-rise glass luxury towers & rooftop helipad spire.'),
  mkLandmark('lm_biec', 'Bangalore International Exhibition Centre (BIEC)', 'landmark', 13.0623, 77.4754, 'yeshwanthpur', 'Expansive vaulted convention exhibition halls on Tumkur Road.'),
  mkLandmark('lm_kia_airport', 'Kempegowda International Airport (T2)', 'landmark', 13.1986, 77.7066, 'kia_airport', 'Bamboo-clad Terminal 2, ATC control tower & runway apron.'),
  mkLandmark('lm_kr_market', 'KR Market (City Market)', 'landmark', 12.9633, 77.5764, 'kr_market', 'Bustling heritage wholesale market & colourful floral stalls.'),
  mkLandmark('lm_freedom_park', 'Freedom Park Memorial', 'landmark', 12.9777, 77.5818, 'majestic', 'Open civic amphitheatre, clock watchtower & freedom plaza.'),
  mkLandmark('lm_bangalore_fort', 'Bangalore Fort (Kempegowda Fort)', 'landmark', 12.9628, 77.5758, 'kr_market', '16th-century granite bastions and arched Delhi Gate.'),

  // Safehouses, Garages, Outfitters, Petrol, Darshinis, ATMs, Benches
  mkLandmark('safehouse_indira', 'Indiranagar 100ft Safehouse', 'safehouse', 12.9768, 77.6416, 'indiranagar', 'Rest, restore armor & health, and clear police heat.'),
  mkLandmark('garage_indira', '100ft Road Custom Garage', 'garage', 12.9795, 77.6402, 'indiranagar', 'Respray paint, repair chassis, upgrade turbo & swap stored vehicles.'),
  mkLandmark('garage_kora', 'Koramangala Mod Bay', 'garage', 12.9365, 77.6232, 'koramangala', 'Street tuning bay for bikes, autos, and sports coupes.'),
  mkLandmark('shop_brigade', 'Brigade & Commercial St Outfitters', 'shop', 12.9731, 77.6074, 'brigade_road', 'Switch protagonists and customize suits, shirts, sunglasses & chains.'),
  mkLandmark('petrol_silkboard', 'Silk Board Fuel & Service', 'petrol', 12.9192, 77.6226, 'silk_board', 'Instant vehicle repair, fuel top-up & nitro service.'),
  mkLandmark('petrol_indira', 'Indiranagar 100ft Fuel Pump', 'petrol', 12.9762, 77.6408, 'indiranagar', '24h Bengaluru IndianOil & EV station (Fuel + Repair).', { kannadaName: 'ಇಂದಿರಾನಗರ ಪೆಟ್ರೋಲ್ ಬಂಕ್' }),
  mkLandmark('petrol_whitefield', 'Whitefield ITPL Fuel Hub', 'petrol', 12.9841, 77.7342, 'whitefield', 'Highway fuel dispenser & chassis service.', { kannadaName: 'ವೈಟ್‌ಫೀಲ್ಡ್ ಪೆಟ್ರೋಲ್ ಬಂಕ್' }),
  mkLandmark('petrol_hebbal', 'Hebbal Bellary Rd Fuel Pump', 'petrol', 13.0342, 77.5964, 'hebbal', 'Airport expressway fuel & diagnostic bay.', { kannadaName: 'ಹೆಬ್ಬಾಳ ಪೆಟ್ರೋಲ್ ಬಂಕ್' }),
  mkLandmark('darshini_mg', 'Sri Ganesh Darshini (MG Rd)', 'darshini', 12.9746, 77.6054, 'mg_road', 'Order hot Masala Dosa & Filter Kaapi (+40 Health, ₹80).'),
  mkLandmark('darshini_indira', '100ft Kaapi Corner', 'darshini', 12.978, 77.6396, 'indiranagar', 'Authentic South Indian tiffin & filter coffee (+40 Health, ₹80).'),
  mkLandmark('darshini_jayanagar', 'Jayanagar 4th Block Tiffin', 'darshini', 12.9299, 77.5838, 'jayanagar', 'Hot Idli-Vada & strong filter kaapi (+40 Health, ₹80).'),
  mkLandmark('atm_brigade', 'Brigade Road ATM', 'atm', 12.972, 77.6079, 'brigade_road', 'Withdraw emergency funds (+₹2,500).'),
  mkLandmark('bench_cubbon', 'Cubbon Park Rain-Tree Bench', 'bench', 12.9764, 77.5929, 'cubbon_park', 'Sit and enjoy the Cubbon Park canopy breeze.'),
  mkLandmark('bench_lalbagh', 'Lalbagh Lake Bench', 'bench', 12.9495, 77.5825, 'jayanagar', 'Relax beside Lalbagh Lake.'),

  // Enterable 3D Interiors (Homes, Supermarket, Armory, Gym)
  mkLandmark('int_indira_villa', 'Indiranagar Luxury Villa', 'interior', 12.9754, 77.6431, 'indiranagar', 'Enterable 3D luxury residence: sofa, TV, kitchen, bed, lights & curtains.', {
    kannadaName: 'ಇಂದಿರಾನಗರ ಐಷಾರಾಮಿ ವಿಲ್ಲಾ',
    interiorId: 'indiranagar_villa',
    price: 0,
  }),
  mkLandmark('int_kora_house', 'Koramangala Modern House', 'interior', 12.9372, 77.6248, 'koramangala', 'Purchasable 3D modern Bengaluru residence (₹85,000).', {
    kannadaName: 'ಕೋರಮಂಗಲ ಮನೆ',
    interiorId: 'koramangala_house',
    price: 85000,
  }),
  mkLandmark('int_whitefield_apt', 'Whitefield Sky Apartment', 'interior', 12.9862, 77.7375, 'whitefield', 'Purchasable 3D high-rise sky suite near ITPL (₹1,25,000).', {
    kannadaName: 'ವೈಟ್‌ಫೀಲ್ಡ್ ಅಪಾರ್ಟ್‌ಮೆಂಟ್',
    interiorId: 'whitefield_apt',
    price: 125000,
  }),
  mkLandmark('int_namma_mart', 'Namma Mart Supermarket', 'interior', 12.9742, 77.6088, 'mg_road', 'Walkable 3D grocery market: browse aisles, collect basket & checkout.', {
    kannadaName: 'ನಮ್ಮ ಮಾರ್ಟ್ ಸೂಪರ್‌ಮಾರ್ಕೆಟ್',
    interiorId: 'namma_mart',
  }),
  mkLandmark('int_weapon_shop', 'Deccan Tactical Armory', 'interior', 12.9736, 77.6062, 'brigade_road', 'Authorized weapon counter: buy Batons, Tactical Rifles, EMP & Armor.', {
    kannadaName: 'ಡೆಕ್ಕನ್ ಆರ್ಮರಿ',
    interiorId: 'weapon_shop',
  }),
  mkLandmark('int_bengaluru_gym', 'Koramangala Iron Club Gym', 'interior', 12.9348, 77.6218, 'koramangala', 'Train stamina, strength & martial combat inside the 3D gym.', {
    kannadaName: 'ಬೆಂಗಳೂರು ಜಿಮ್',
    interiorId: 'bengaluru_gym',
  }),
];

function pt(lat: number, lon: number): { x: number; z: number } {
  const p = latLonToWorld(lat, lon);
  return { x: p.x, z: p.z };
}

export const MISSIONS: MissionDef[] = [
  {
    id: 'm1_mg_escape',
    title: '01. MG Road Breakout',
    district: 'mg_road',
    briefing:
      'A corrupt tech fixer tipped off patrol units near MG Road Metro. Grab wheels, shake the 2-star pursuit, and reach the Indiranagar 100ft Safehouse.',
    objectiveLabel: 'Evade police along MG Rd and reach Indiranagar Safehouse',
    type: 'escape',
    ...(() => {
      const s = pt(12.9752, 77.605);
      const t = pt(12.9768, 77.6416);
      return { startX: s.x, startZ: s.z, targetX: t.x, targetZ: t.z };
    })(),
    wantedStars: 2,
    rewardCash: 15000,
    recommendedVehicle: 'coupe',
  },
  {
    id: 'm2_silk_delivery',
    title: '02. Silk Board Express',
    district: 'koramangala',
    briefing:
      'Deliver a prototype quantum chip from Koramangala through Silk Board Junction traffic down the Hosur Elevated Expressway to Electronic City.',
    objectiveLabel: 'Deliver prototype through Silk Board to Electronic City',
    type: 'delivery',
    ...(() => {
      const s = pt(12.9352, 77.6245);
      const t = pt(12.8452, 77.6602);
      return {
        startX: s.x,
        startZ: s.z,
        targetX: t.x,
        targetZ: t.z,
        checkpoints: [
          pt(12.9177, 77.6233),
          pt(12.891, 77.641),
          pt(12.8452, 77.6602),
        ],
      };
    })(),
    timeLimitSec: 120,
    rewardCash: 25000,
    recommendedVehicle: 'auto',
  },
  {
    id: 'm3_hebbal_sprint',
    title: '03. Bellary Rd – Hebbal Apex',
    district: 'vidhana_soudha',
    briefing:
      'Midnight street racers own Bellary Road (NH-44). Blast north past Vidhana Soudha and Mekhri Circle over Hebbal Flyover to Manyata Tech Park.',
    objectiveLabel: 'Clear Bellary Rd & Hebbal checkpoints to Manyata Tech Park',
    type: 'race',
    ...(() => {
      const s = pt(12.9797, 77.5912);
      const t = pt(13.0458, 77.62);
      return {
        startX: s.x,
        startZ: s.z,
        targetX: t.x,
        targetZ: t.z,
        checkpoints: [
          pt(13.001, 77.584),
          pt(13.016, 77.589),
          pt(13.0358, 77.597),
          pt(13.0458, 77.62),
        ],
      };
    })(),
    timeLimitSec: 95,
    rewardCash: 32000,
    recommendedVehicle: 'bike',
  },
  {
    id: 'm4_kr_market',
    title: '04. KR Market – Majestic Shadow',
    district: 'kr_market',
    briefing:
      'Syndicate smugglers are moving black-market hardware between KR Market flower awnings and Majestic Bus Stand. Inspect the drop points.',
    objectiveLabel: 'Investigate KR Market & Majestic drop zones',
    type: 'investigate',
    ...(() => {
      const s = pt(12.9633, 77.5764);
      const t = pt(12.9778, 77.5713);
      return {
        startX: s.x,
        startZ: s.z,
        targetX: t.x,
        targetZ: t.z,
        checkpoints: [
          pt(12.965, 77.575),
          pt(12.971, 77.572),
          pt(12.9778, 77.5713),
        ],
      };
    })(),
    wantedStars: 1,
    rewardCash: 25000,
  },
  {
    id: 'm5_whitefield_night',
    title: '05. Whitefield ITPL Midnight',
    district: 'marathahalli',
    briefing:
      'Under cover of darkness along Old Madras Rd & ITPL, intercept encrypted server drives from Marathahalli to Whitefield.',
    objectiveLabel: 'Collect server drives across Marathahalli & Whitefield ITPL',
    type: 'stealth',
    ...(() => {
      const s = pt(12.9591, 77.6974);
      const t = pt(12.985, 77.7365);
      return {
        startX: s.x,
        startZ: s.z,
        targetX: t.x,
        targetZ: t.z,
        checkpoints: [pt(12.991, 77.718), pt(12.985, 77.7365)],
      };
    })(),
    forceTime: 'night',
    timeLimitSec: 110,
    rewardCash: 35000,
    recommendedVehicle: 'cab',
  },
  {
    id: 'm6_flyover_escape',
    title: '06. ORR Bellandur Escape',
    district: 'silk_board',
    briefing:
      'Patrol units have locked down Central Bengaluru! Race east along the curved Outer Ring Road past Bellandur Lake & Marathahalli to Indiranagar.',
    objectiveLabel: 'Cross ORR Bellandur & Marathahalli to Indiranagar Garage',
    type: 'escape',
    ...(() => {
      const s = pt(12.9177, 77.6233);
      const t = pt(12.9795, 77.6402);
      return {
        startX: s.x,
        startZ: s.z,
        targetX: t.x,
        targetZ: t.z,
        checkpoints: [pt(12.9279, 77.6762), pt(12.9591, 77.6974), pt(12.9795, 77.6402)],
      };
    })(),
    wantedStars: 3,
    rewardCash: 45000,
    recommendedVehicle: 'coupe',
  },
  {
    id: 'm7_nice_road',
    title: '07. NICE Road 250',
    district: 'nice_road',
    briefing:
      'The concrete ribbon of NICE Road Peripheral Expressway is wide open. Push the Deccan GT to redline from NICE South to Electronic City.',
    objectiveLabel: 'Blast down NICE Road expressway checkpoints under 80s',
    type: 'race',
    ...(() => {
      const s = pt(12.898, 77.532);
      const t = pt(12.8452, 77.6602);
      return {
        startX: s.x,
        startZ: s.z,
        targetX: t.x,
        targetZ: t.z,
        checkpoints: [pt(12.874, 77.551), pt(12.866, 77.596), pt(12.8452, 77.6602)],
      };
    })(),
    timeLimitSec: 80,
    rewardCash: 60000,
    recommendedVehicle: 'coupe',
  },
];

function mkCol(id: string, name: string, lat: number, lon: number, district: CollectibleDef['district']): CollectibleDef {
  const p = latLonToWorld(lat, lon);
  return { id, name, x: p.x, z: p.z, district };
}

export const COLLECTIBLES: CollectibleDef[] = [
  mkCol('c1', 'Vidhana Granite Seal', 12.9799, 77.5916, 'vidhana_soudha'),
  mkCol('c2', 'Cubbon Rain-Tree Token', 12.9758, 77.5934, 'cubbon_park'),
  mkCol('c3', 'MG Metro Commemorative Coin', 12.9759, 77.607, 'mg_road'),
  mkCol('c4', 'Commercial St Brass Lantern', 12.9822, 77.6083, 'commercial_street'),
  mkCol('c5', 'Indiranagar Filter Kaapi Cup', 12.9784, 77.6414, 'indiranagar'),
  mkCol('c6', 'Majestic Vintage Bus Ticket', 12.9775, 77.572, 'majestic'),
  mkCol('c7', 'KR Market Saffron Crate', 12.9635, 77.577, 'kr_market'),
  mkCol('c8', 'Lalbagh Glass Dome Key', 12.9507, 77.5844, 'jayanagar'),
  mkCol('c9', 'Koramangala Startup Badge', 12.9355, 77.6249, 'koramangala'),
  mkCol('c10', 'Hebbal Flyover Crest', 13.0358, 77.5975, 'hebbal'),
  mkCol('c11', 'Whitefield Silicon Wafer', 12.985, 77.7358, 'whitefield'),
  mkCol('c12', 'NICE Road Golden Toll Pass', 12.874, 77.5515, 'nice_road'),
];

export const NPC_DIALOGUE_LINES: Array<{ speaker: string; language: string; line: string }> = [
  { speaker: 'Auto Anna', language: 'Kannada', line: 'Silk Board inda Marathahalli traffic tumba heavy ide guru!' },
  { speaker: 'Tech Commuter', language: 'English', line: 'Purple Line metro gets me from MG Road to Whitefield ITPL in twenty minutes.' },
  { speaker: 'Chai Vendor', language: 'Hindi', line: 'Garam masala chai aur filter kaapi ready hai bhaiya!' },
  { speaker: 'Cubbon Jogger', language: 'Kannada', line: 'Cubbon Park morning breeze tumba super aagide!' },
  { speaker: 'KR Market Florist', language: 'Kannada', line: 'Mallige hoovu fresh ide madam, banni banni!' },
  { speaker: 'Cab Driver', language: 'Hindi', line: 'Meter se chalo sir, NICE Road se seedha Electronic City!' },
  { speaker: 'Indiranagar Local', language: 'English', line: 'Check out the custom mod bay on 100 Feet Road if your ride took a hit.' },
  { speaker: 'BMTC Conductor', language: 'Kannada', line: 'Majestic, Shivajinagar, Jayanagar, Hebbal... munde banni!' },
];

export const RADIO_CATEGORIES: Array<{ id: RadioCategoryId; label: string; kannada: string }> = [
  { id: 'kannada_classic', label: 'Kannada Classic', kannada: 'ಕನ್ನಡ ಕ್ಲಾಸಿಕ್' },
  { id: 'kannada_evergreen', label: 'Kannada Evergreen', kannada: 'ಎವರ್‌ಗ್ರೀನ್' },
  { id: 'kannada_90s', label: 'Kannada 90s Hits', kannada: '90ರ ದಶಕ' },
  { id: 'kannada_2000s', label: 'Kannada 2000s Hits', kannada: '2000ರ ಹಿಟ್ಸ್' },
  { id: 'kannada_modern', label: 'Kannada Modern', kannada: 'ಮಾಡರ್ನ್ ಬೀಟ್ಸ್' },
  { id: 'kannada_folk', label: 'Kannada Folk / Janapada', kannada: 'ಜನಪದ ಗೀತೆ' },
  { id: 'instrumental', label: 'Instrumental / Veena', kannada: 'ವಾದ್ಯ ಸಂಗೀತ' },
  { id: 'indian_music', label: 'Indian Fusion / Film', kannada: 'ಭಾರತೀಯ ಸಂಗೀತ' },
  { id: 'custom_local', label: 'Local Uploaded Audio', kannada: 'ನಿಮ್ಮ ಆಡಿಯೋ' },
];

export const RADIO_CATALOG: RadioTrack[] = [
  // 1. Kannada Classic
  { id: 'kc_1', title: 'Mysuru Mallige Raga', artist: 'Sandalwood Vintage Ensemble', category: 'kannada_classic', bpm: 88, scaleHz: [261.63, 293.66, 329.63, 392.0, 440.0, 523.25], bassHz: [130.81, 164.81, 196.0], mood: 'Nostalgic Flute & Strings' },
  { id: 'kc_2', title: 'Kaveri Teera Classic', artist: 'Namma Heritage Orchestra', category: 'kannada_classic', bpm: 92, scaleHz: [246.94, 293.66, 329.63, 369.99, 440.0], bassHz: [123.47, 146.83, 185.0], mood: 'Harmonium Melody' },
  { id: 'kc_3', title: 'Gandhadagudi Breeze', artist: 'Bengaluru Retro Studio', category: 'kannada_classic', bpm: 84, scaleHz: [261.63, 311.13, 349.23, 392.0, 466.16], bassHz: [130.81, 174.61, 196.0], mood: 'Warm Classic' },
  // 2. Kannada Evergreen
  { id: 'ke_1', title: 'Lalbagh Morning Dew', artist: 'Kaveri Melodies', category: 'kannada_evergreen', bpm: 96, scaleHz: [293.66, 329.63, 369.99, 440.0, 493.88, 587.33], bassHz: [146.83, 185.0, 220.0], mood: 'Acoustic Guitar & Sitar' },
  { id: 'ke_2', title: 'Nandi Hills Sunrise', artist: 'Deccan Strings', category: 'kannada_evergreen', bpm: 100, scaleHz: [261.63, 293.66, 349.23, 392.0, 440.0], bassHz: [130.81, 174.61, 196.0], mood: 'Evergreen Ballad' },
  { id: 'ke_3', title: 'Bengaluru Rain Chorus', artist: 'Malnad Echo', category: 'kannada_evergreen', bpm: 94, scaleHz: [220.0, 261.63, 293.66, 329.63, 392.0], bassHz: [110.0, 146.83, 164.81], mood: 'Soft Monsoon Ballad' },
  // 3. Kannada 90s
  { id: 'k90_1', title: 'Majestic Night Express 95', artist: 'Sandalwood Tape Deck', category: 'kannada_90s', bpm: 112, scaleHz: [261.63, 329.63, 392.0, 440.0, 523.25], bassHz: [130.81, 196.0, 146.83], mood: '90s Analog Synth' },
  { id: 'k90_2', title: 'Brigade Road Neon 98', artist: 'Retro Karnataka', category: 'kannada_90s', bpm: 116, scaleHz: [293.66, 349.23, 440.0, 523.25, 587.33], bassHz: [146.83, 220.0, 174.61], mood: '90s Cassette Pop' },
  { id: 'k90_3', title: 'Chinnaswamy Cheering 96', artist: 'Bengaluru Brass', category: 'kannada_90s', bpm: 118, scaleHz: [246.94, 293.66, 392.0, 440.0, 493.88], bassHz: [123.47, 196.0, 146.83], mood: 'Upbeat Nostalgia' },
  // 4. Kannada 2000s
  { id: 'k2k_1', title: 'Mungaru Rain Highway', artist: 'Koramangala Collective', category: 'kannada_2000s', bpm: 108, scaleHz: [261.63, 293.66, 329.63, 392.0, 493.88], bassHz: [130.81, 164.81, 196.0], mood: '2000s Romantic Acoustic' },
  { id: 'k2k_2', title: 'Indiranagar 100ft Cruise', artist: 'Namma FM Sessions', category: 'kannada_2000s', bpm: 120, scaleHz: [293.66, 369.99, 440.0, 493.88, 587.33], bassHz: [146.83, 185.0, 220.0], mood: '2000s Pop Rock' },
  { id: 'k2k_3', title: 'Jayanagar Evening Jam', artist: 'South End Band', category: 'kannada_2000s', bpm: 114, scaleHz: [220.0, 246.94, 329.63, 392.0, 440.0], bassHz: [110.0, 164.81, 196.0], mood: 'Electric Clean Riff' },
  // 5. Kannada Modern
  { id: 'km_1', title: 'Metro Purple Pulse', artist: 'UB City Bassline', category: 'kannada_modern', bpm: 126, scaleHz: [261.63, 311.13, 392.0, 466.16, 523.25], bassHz: [130.81, 155.56, 196.0], mood: 'Modern Trap & Synth' },
  { id: 'km_2', title: 'Silk Board Drift', artist: 'Electronic City DJs', category: 'kannada_modern', bpm: 128, scaleHz: [220.0, 261.63, 329.63, 392.0, 440.0], bassHz: [110.0, 130.81, 196.0], mood: 'High-Energy Club' },
  { id: 'km_3', title: 'Bengaluru Midnight Drop', artist: 'Koramangala Bass', category: 'kannada_modern', bpm: 124, scaleHz: [246.94, 293.66, 369.99, 440.0, 587.33], bassHz: [123.47, 146.83, 185.0], mood: 'Modern Groove' },
  // 6. Kannada Folk / Janapada
  { id: 'kf_1', title: 'Dollu Kunitha Rhythm', artist: 'Janapada Kalavidaru', category: 'kannada_folk', bpm: 122, scaleHz: [261.63, 293.66, 349.23, 392.0, 440.0, 523.25], bassHz: [130.81, 196.0, 130.81], mood: 'Traditional Drum & Folk' },
  { id: 'kf_2', title: 'Karaga Festival Beat', artist: 'Old Bengaluru Troupe', category: 'kannada_folk', bpm: 130, scaleHz: [293.66, 329.63, 392.0, 440.0, 523.25], bassHz: [146.83, 196.0, 146.83], mood: 'Festive Janapada' },
  { id: 'kf_3', title: 'Malnad Harvest Song', artist: 'Sahyadri Folk', category: 'kannada_folk', bpm: 108, scaleHz: [220.0, 261.63, 293.66, 349.23, 440.0], bassHz: [110.0, 146.83, 174.61], mood: 'Earthy Folk Melody' },
  // 7. Instrumental
  { id: 'in_1', title: 'Carnatic Veena Midnight', artist: 'Malleswaram Sabha', category: 'instrumental', bpm: 86, scaleHz: [261.63, 277.18, 329.63, 349.23, 392.0, 415.3], bassHz: [130.81, 196.0, 130.81], mood: 'Classical Veena Pluck' },
  { id: 'in_2', title: 'Bansuri over Ulsoor', artist: 'Cubbon Wind Ensemble', category: 'instrumental', bpm: 80, scaleHz: [293.66, 329.63, 392.0, 440.0, 523.25], bassHz: [146.83, 220.0, 146.83], mood: 'Ambient Flute' },
  { id: 'in_3', title: 'Deccan Lo-Fi Kaapi', artist: 'HSR Study Beats', category: 'instrumental', bpm: 90, scaleHz: [220.0, 261.63, 329.63, 392.0, 493.88], bassHz: [110.0, 164.81, 196.0], mood: 'Chill Instrumental' },
  // 8. Indian Music
  { id: 'im_1', title: 'Tabla & Electric Sitar', artist: 'Pan-India Fusion', category: 'indian_music', bpm: 115, scaleHz: [261.63, 311.13, 349.23, 392.0, 466.16, 523.25], bassHz: [130.81, 174.61, 196.0], mood: 'Desi Fusion Groove' },
  { id: 'im_2', title: 'Monsoon Express Highway', artist: 'Desi Beats Collective', category: 'indian_music', bpm: 120, scaleHz: [246.94, 293.66, 349.23, 440.0, 523.25], bassHz: [123.47, 174.61, 220.0], mood: 'Cinema Soundtrack Vibe' },
  { id: 'im_3', title: 'Sufi & Carnatic Twilight', artist: 'Bengaluru Cultural Fest', category: 'indian_music', bpm: 98, scaleHz: [220.0, 246.94, 293.66, 329.63, 415.3], bassHz: [110.0, 146.83, 164.81], mood: 'Soulful Indian Fusion' },
];

export const RADIO_TRACKS = RADIO_CATALOG.map((t) => `${t.title} — ${t.artist}`);

export const GROCERY_ITEMS: GroceryItemDef[] = [
  { id: 'g_nandini_milk', name: 'Nandini GoodLife Milk (1L)', kannadaName: 'ನಂದಿನಿ ಹಾಲು', category: 'Dairy', price: 54, healthRestore: 14, color: '#38bdf8' },
  { id: 'g_paneer', name: 'Fresh Malai Paneer (200g)', kannadaName: 'ತಾಜಾ ಪನೀರ್', category: 'Dairy', price: 95, healthRestore: 22, color: '#f8fafc' },
  { id: 'g_bread', name: 'Whole Wheat Toast Loaf', kannadaName: 'ಬ್ರೆಡ್ ಲೋಫ್', category: 'Bakery', price: 52, healthRestore: 15, color: '#d97706' },
  { id: 'g_bun_nippat', name: 'Bengaluru Masala Bun', kannadaName: 'ಮಸಾಲೆ ಬನ್', category: 'Bakery', price: 45, healthRestore: 18, color: '#b45309' },
  { id: 'g_sona_rice', name: 'Sona Masoori Rice (5kg)', kannadaName: 'ಸೋನಾ ಮಸೂರಿ ಅಕ್ಕಿ', category: 'Grains', price: 320, healthRestore: 30, color: '#fef3c7' },
  { id: 'g_ragi_flour', name: 'Organic Ragi Flour (1kg)', kannadaName: 'ರಾಗಿ ಹಿಟ್ಟು', category: 'Grains', price: 78, healthRestore: 24, color: '#78350f' },
  { id: 'g_tomato', name: 'Farm Fresh Tomatoes (1kg)', kannadaName: 'ಟೊಮೇಟೊ', category: 'Produce', price: 48, healthRestore: 12, color: '#ef4444' },
  { id: 'g_banana', name: 'Yelakki Bananas (12 pcs)', kannadaName: 'ಏಲಕ್ಕಿ ಬಾಳೆಹಣ್ಣು', category: 'Produce', price: 72, healthRestore: 20, color: '#facc15' },
  { id: 'g_maddur_vada', name: 'Crispy Maddur Vada Pack', kannadaName: 'ಮದ್ದೂರು ವಡೆ', category: 'Snacks', price: 60, healthRestore: 25, color: '#ea580c' },
  { id: 'g_mysore_pak', name: 'Ghee Mysore Pak Box', kannadaName: 'ಮೈಸೂರು ಪಾಕ್', category: 'Snacks', price: 180, healthRestore: 35, color: '#f59e0b' },
  { id: 'g_filter_kaapi', name: 'Chikmagalur Filter Kaapi Tin', kannadaName: 'ಫಿಲ್ಟರ್ ಕಾಫಿ ಪುಡಿ', category: 'Beverages', price: 210, healthRestore: 32, color: '#451a03' },
  { id: 'g_tender_coconut', name: 'Maddur Tender Coconut', kannadaName: 'ಎಳನೀರು', category: 'Beverages', price: 45, healthRestore: 22, color: '#22c55e' },
  { id: 'g_sandal_soap', name: 'Mysore Sandal Soap Pack', kannadaName: 'ಮೈಸೂರು ಸ್ಯಾಂಡಲ್', category: 'Household', price: 140, healthRestore: 10, color: '#a16207' },
];

export const WEAPONS_CATALOG: Array<{
  id: WeaponKind;
  name: string;
  kannadaName: string;
  price: number;
  ammoGrant: number;
  damage: number;
  description: string;
}> = [
  { id: 'baton', name: 'Tactical Tonfa Baton', kannadaName: 'ಲಾಠಿ / ಬ್ಯಾಟನ್', price: 1200, ammoGrant: 0, damage: 28, description: 'Heavy close-combat baton with extended reach.' },
  { id: 'tactical', name: 'Deccan 9mm Tactical', kannadaName: 'ಟ್ಯಾಕ್ಟಿಕಲ್ ಪಿಸ್ತೂಲ್', price: 4500, ammoGrant: 48, damage: 45, description: 'Precision sidearm + 48 rounds.' },
  { id: 'emp', name: 'Bengaluru EMP Disruptor', kannadaName: 'ಇಎಂಪಿ ಡಿಸ್ರಪ್ಟರ್', price: 7800, ammoGrant: 24, damage: 60, description: 'Disables hostile vehicles & stuns targets (+24 cells).' },
];

export const TV_CHANNELS: Array<{
  channel: number;
  name: string;
  kannadaName: string;
  program: string;
  color: string;
  ticker: string;
}> = [
  {
    channel: 1,
    name: 'Namma News 24x7 (Simulated)',
    kannadaName: 'ನಮ್ಮ ನ್ಯೂಸ್ ೨೪x೭',
    program: 'Bengaluru Traffic, Silk Board & Namma Metro Live Bulletin',
    color: '#ef4444',
    ticker: 'ಬ್ರೇಕಿಂಗ್: ಎಂ.ಜಿ ರಸ್ತೆಯಿಂದ ವೈಟ್‌ಫೀಲ್ಡ್ ಪರ್ಪಲ್ ಲೈನ್ ಮೆಟ್ರೋ ಸುಗಮ ಸಂಚಾರ · Bengaluru monsoon pleasant.',
  },
  {
    channel: 2,
    name: 'Sandalwood Cinema HD (Simulated)',
    kannadaName: 'ಸ್ಯಾಂಡಲ್‌ವುಡ್ ಸಿನಿಮಾ',
    program: 'Kannada Evergreen Classic Double Feature',
    color: '#f59e0b',
    ticker: 'ಈಗ ಪ್ರಸಾರ: ಬೆಂಗಳೂರು 1988 ಕ್ಲಾಸಿಕ್ · Directed in Mysuru & Lalbagh Gardens.',
  },
  {
    channel: 3,
    name: 'Chinnaswamy Sports TV (Simulated)',
    kannadaName: 'ಚಿನ್ನಸ್ವಾಮಿ ಸ್ಪೋರ್ಟ್ಸ್',
    program: 'Namma Bengaluru T20 Floodlight Highlights',
    color: '#22c55e',
    ticker: 'ಸ್ಕೋರ್: ಬೆಂಗಳೂರು ರಾಯಲ್ಸ್ 208/4 (20 ಓವರ್) · Chinnaswamy Stadium packed!',
  },
  {
    channel: 4,
    name: 'Malnad Nature & Music (Simulated)',
    kannadaName: 'ಮಲೆನಾಡು ಪ್ರಕೃತಿ',
    program: 'Western Ghats Coffee Estates & Carnatic Veena',
    color: '#38bdf8',
    ticker: 'ಶಿವಮೊಗ್ಗ ಮತ್ತು ಚಿಕ್ಕಮಗಳೂರು ಮಳೆಯ ದೃಶ್ಯಾವಳಿ · Relaxing ambient audio.',
  },
];

export const VEHICLE_SPECS: Record<
  VehicleKind,
  {
    label: string;
    maxSpeed: number;
    accel: number;
    brake: number;
    turnRate: number;
    maxHealth: number;
    baseColor: string;
    fuelConsumption: number;
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
    fuelConsumption: 0.45,
  },
  bmtc: {
    label: 'BMTC Volvo Vajra',
    maxSpeed: 26,
    accel: 11,
    brake: 20,
    turnRate: 1.4,
    maxHealth: 220,
    baseColor: '#2563eb',
    fuelConsumption: 0.65,
  },
  cab: {
    label: 'Namma City Cab',
    maxSpeed: 38,
    accel: 22,
    brake: 32,
    turnRate: 2.2,
    maxHealth: 115,
    baseColor: '#f1f5f9',
    fuelConsumption: 0.42,
  },
  bike: {
    label: 'Bengaluru Streetfighter 650',
    maxSpeed: 48,
    accel: 32,
    brake: 38,
    turnRate: 2.9,
    maxHealth: 80,
    baseColor: '#dc2626',
    fuelConsumption: 0.32,
  },
  coupe: {
    label: 'Deccan GT Coupe',
    maxSpeed: 58,
    accel: 34,
    brake: 42,
    turnRate: 2.4,
    maxHealth: 140,
    baseColor: '#f97316',
    fuelConsumption: 0.58,
  },
  hatchback: {
    label: 'Indiranagar Swift Hatch',
    maxSpeed: 40,
    accel: 24,
    brake: 34,
    turnRate: 2.4,
    maxHealth: 120,
    baseColor: '#0ea5e9',
    fuelConsumption: 0.36,
  },
  suv: {
    label: 'Coorg Overland SUV',
    maxSpeed: 44,
    accel: 25,
    brake: 32,
    turnRate: 2.0,
    maxHealth: 180,
    baseColor: '#1e293b',
    fuelConsumption: 0.55,
  },
  scooter: {
    label: 'Namma Activa Scooter',
    maxSpeed: 31,
    accel: 23,
    brake: 32,
    turnRate: 3.1,
    maxHealth: 75,
    baseColor: '#e2e8f0',
    fuelConsumption: 0.24,
  },
  truck: {
    label: 'Kaveri Cargo Lorry',
    maxSpeed: 29,
    accel: 12,
    brake: 22,
    turnRate: 1.5,
    maxHealth: 260,
    baseColor: '#b45309',
    fuelConsumption: 0.72,
  },
  police_suv: {
    label: 'Karnataka Police Patrol',
    maxSpeed: 46,
    accel: 27,
    brake: 36,
    turnRate: 2.3,
    maxHealth: 160,
    baseColor: '#ffffff',
    fuelConsumption: 0.4,
  },
  police_bike: {
    label: 'Traffic Police Interceptor',
    maxSpeed: 50,
    accel: 33,
    brake: 38,
    turnRate: 2.8,
    maxHealth: 95,
    baseColor: '#f8fafc',
    fuelConsumption: 0.3,
  },
  ambulance: {
    label: '108 Arogyakavacha Ambulance',
    maxSpeed: 46,
    accel: 26,
    brake: 35,
    turnRate: 2.2,
    maxHealth: 180,
    baseColor: '#f8fafc',
    fuelConsumption: 0.45,
  },
  delivery: {
    label: 'Namma Express Cargo Van',
    maxSpeed: 36,
    accel: 21,
    brake: 30,
    turnRate: 2.1,
    maxHealth: 150,
    baseColor: '#ea580c',
    fuelConsumption: 0.44,
  },
};

export interface CongestionZoneConfig {
  zoneId: DistrictDef['id'];
  zoneName: string;
  radius: number;
  baseWeight: number;
  peakHours: Array<[number, number]>;
  reason: string;
}

export const CONGESTION_ZONES: CongestionZoneConfig[] = [
  {
    zoneId: 'silk_board',
    zoneName: 'Central Silk Board Junction',
    radius: 170,
    baseWeight: 1.0,
    peakHours: [[7.5, 11.5], [16.5, 21.5]],
    reason: 'ORR – Hosur Rd Flyover Merge & Metro Intersect',
  },
  {
    zoneId: 'orr',
    zoneName: 'Outer Ring Road Tech Corridor',
    radius: 210,
    baseWeight: 0.92,
    peakHours: [[8.0, 11.2], [17.0, 21.2]],
    reason: 'IT Shuttle & Commuter Peak Hour Flow',
  },
  {
    zoneId: 'marathahalli',
    zoneName: 'Marathahalli Bridge Bottleneck',
    radius: 165,
    baseWeight: 0.88,
    peakHours: [[8.0, 11.0], [17.0, 21.0]],
    reason: 'ORR – HAL Airport Road Junction',
  },
  {
    zoneId: 'mg_road',
    zoneName: 'MG Road – Trinity Boulevard',
    radius: 150,
    baseWeight: 0.72,
    peakHours: [[9.5, 12.0], [17.5, 21.0]],
    reason: 'Central Business District Signal Cycle',
  },
  {
    zoneId: 'majestic',
    zoneName: 'Majestic Kempegowda Hub',
    radius: 165,
    baseWeight: 0.85,
    peakHours: [[7.5, 11.0], [16.5, 21.0]],
    reason: 'BMTC Terminus & KSR Railway Feeder Traffic',
  },
  {
    zoneId: 'electronic_city',
    zoneName: 'Electronic City Toll Plaza',
    radius: 175,
    baseWeight: 0.78,
    peakHours: [[8.0, 10.8], [17.5, 20.8]],
    reason: 'Elevated Expressway Exit Ramp Queue',
  },
  {
    zoneId: 'hebbal',
    zoneName: 'Hebbal Flyover Merge',
    radius: 175,
    baseWeight: 0.86,
    peakHours: [[7.8, 11.0], [16.8, 20.8]],
    reason: 'Bellary Rd NH-44 Airport & ORR Convergence',
  },
];

export const SILK_BOARD_FLYOVER_LOOP: Array<{ x: number; z: number }> = (() => {
  const sb = getDistrictCenter('silk_board');
  return [
    { x: sb.x - 92, z: sb.z + 18 },
    { x: sb.x - 42, z: sb.z + 6 },
    { x: sb.x, z: sb.z - 2 },
    { x: sb.x + 44, z: sb.z - 12 },
    { x: sb.x + 96, z: sb.z - 26 },
  ];
})();

export function getGradedTerrainY(x: number, z: number): number {
  return getGradedGroundY(x, z, ROAD_SEGMENTS, WATER_ZONES);
}

export function getFlyoverDeckY(x: number, z: number): number {
  return getFlyoverOrRoadSurfaceY(x, z, ROAD_SEGMENTS, SILK_BOARD_FLYOVER_LOOP, WATER_ZONES);
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

export function isPointOnRoad(x: number, z: number, extraClearance = 1.2): boolean {
  return isPointOnCurvedRoad(x, z, ROAD_SEGMENTS, extraClearance);
}
