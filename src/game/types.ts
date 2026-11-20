export type DistrictId =
  | 'mg_road'
  | 'brigade_road'
  | 'indiranagar'
  | 'koramangala'
  | 'electronic_city'
  | 'whitefield'
  | 'silk_board'
  | 'kr_market'
  | 'majestic'
  | 'vidhana_soudha'
  | 'cubbon_park'
  | 'lalbagh'
  | 'orr'
  | 'nice_road';

export type VehicleKind =
  | 'auto'
  | 'bmtc'
  | 'cab'
  | 'bike'
  | 'coupe'
  | 'police_suv'
  | 'police_bike';

export type WeatherMode = 'clear' | 'overcast' | 'monsoon';
export type TimePreset = 'auto' | 'morning' | 'golden' | 'night';
export type WeaponKind = 'unarmed' | 'baton' | 'tactical' | 'emp';

export interface PlayerCustomization {
  jacketColor: string;
  shirtColor: string;
  pantsColor: string;
  sunglasses: boolean;
  backpack: boolean;
}

export interface VehicleTuning {
  color: string;
  engineLevel: number; // 1..3
  handlingLevel: number; // 1..3
  armorLevel: number; // 1..3
}

export interface DistrictDef {
  id: DistrictId;
  name: string;
  kannadaName: string;
  x: number;
  z: number;
  radius: number;
  description: string;
  color: string;
}

export interface LandmarkMarker {
  id: string;
  name: string;
  type: 'mission' | 'garage' | 'safehouse' | 'shop' | 'petrol' | 'landmark';
  x: number;
  z: number;
  district: DistrictId;
  description: string;
}

export interface MissionDef {
  id: string;
  title: string;
  district: DistrictId;
  briefing: string;
  objectiveLabel: string;
  type: 'escape' | 'delivery' | 'race' | 'investigate' | 'stealth';
  startX: number;
  startZ: number;
  targetX: number;
  targetZ: number;
  checkpoints?: Array<{ x: number; z: number }>;
  timeLimitSec?: number;
  wantedStars?: number;
  forceTime?: TimePreset;
  rewardCash: number;
  recommendedVehicle?: VehicleKind;
}

export interface CollectibleDef {
  id: string;
  name: string;
  x: number;
  z: number;
  district: DistrictId;
}

export interface RoadSegment {
  id: string;
  name: string;
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  elevated?: boolean;
}

export interface WaterZone {
  id: string;
  name: string;
  x: number;
  z: number;
  rx: number;
  rz: number;
}

export interface BuildingCollider {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  height: number;
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  cash: number;
  wantedStars: number;
  wantedCooldown: number; // 0..1 when evading
  isEvading: boolean;
  districtName: string;
  districtKannada: string;
  discoveredDistricts: DistrictId[];
  playerX: number;
  playerZ: number;
  playerHeading: number;
  inVehicle: boolean;
  vehicleKind: VehicleKind | null;
  vehicleLabel: string;
  vehicleHealth: number;
  speedKmh: number;
  gear: number;
  headlightsOn: boolean;
  isSwimming: boolean;
  isCrouching: boolean;
  weapon: WeaponKind;
  nearPrompt: string | null;
  nearGarage: boolean;
  timeOfDayHours: number; // 0..24
  weather: WeatherMode;
  activeMission: {
    id: string;
    title: string;
    objective: string;
    timeRemaining: number | null;
    checkpointIndex: number;
    totalCheckpoints: number;
    targetX: number;
    targetZ: number;
  } | null;
  completedMissions: string[];
  collectedIds: string[];
  waypoint: { x: number; z: number; label: string } | null;
  npcSubtitle: { speaker: string; language: string; line: string } | null;
  toastMessage: string | null;
  radioOn: boolean;
  radioTrack: string;
  policeBlips: Array<{ x: number; z: number }>;
}

export interface GameSettings {
  timePreset: TimePreset;
  weather: WeatherMode;
  trafficDensity: 'low' | 'medium' | 'high';
  radioOn: boolean;
  sfxOn: boolean;
  cameraSensitivity: number;
}
