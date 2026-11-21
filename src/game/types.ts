export type ProtagonistId = 'vikram' | 'arjun' | 'sathish';

export type LanguageId = 'kn' | 'en' | 'hi' | 'ta' | 'te';

export type DistrictId =
  // Central Bengaluru (8)
  | 'mg_road'
  | 'brigade_road'
  | 'commercial_street'
  | 'shivajinagar'
  | 'cubbon_park'
  | 'vidhana_soudha'
  | 'kr_market'
  | 'majestic'
  // South Bengaluru (9)
  | 'jayanagar'
  | 'jp_nagar'
  | 'btm_layout'
  | 'koramangala'
  | 'basavanagudi'
  | 'banashankari'
  | 'silk_board'
  | 'electronic_city'
  | 'bannerghatta'
  // East Bengaluru (7)
  | 'indiranagar'
  | 'hal'
  | 'marathahalli'
  | 'bellandur'
  | 'whitefield'
  | 'kr_puram'
  | 'orr'
  // North Bengaluru (5)
  | 'hebbal'
  | 'yelahanka'
  | 'jakkur'
  | 'manyata_tech_park'
  | 'yeshwanthpur'
  // West Bengaluru (4) + Peripheral Expressways/Hubs (2)
  | 'rajajinagar'
  | 'vijayanagar'
  | 'malleshwaram'
  | 'chandra_layout'
  | 'nice_road'
  | 'kia_airport';

export type VehicleKind =
  | 'auto'
  | 'bmtc'
  | 'cab'
  | 'bike'
  | 'coupe'
  | 'hatchback'
  | 'suv'
  | 'scooter'
  | 'truck'
  | 'police_suv'
  | 'police_bike'
  | 'ambulance'
  | 'delivery';

export type WeatherMode =
  | 'clear'
  | 'cloudy'
  | 'light_rain'
  | 'monsoon'
  | 'thunderstorm'
  | 'fog';

export type TimePreset = 'auto' | 'ist_realtime' | 'morning' | 'golden' | 'night';
export type WeaponKind = 'unarmed' | 'baton' | 'tactical' | 'emp';
export type CameraMode = 'chase' | 'cockpit' | 'cinematic' | 'closeup';
export type GraphicsQuality = 'low' | 'medium' | 'high' | 'ultra';

export type FacePresetId = 'vikram_exec' | 'arjun_classic' | 'sathish_street' | 'karthik_warm' | 'rohan_sharp';
export type HairStyleId = 'short_crop' | 'side_part' | 'wavy_long' | 'swept' | 'curly' | 'bun';
export type BeardStyleId = 'trimmed_beard' | 'stubble' | 'moustache' | 'full_beard' | 'clean';
export type OutfitStyleId = 'suit' | 'jacket' | 'street_shirt' | 'kurta' | 'office' | 'hoodie';

export type StudioAngleId =
  | 'three_quarter'
  | 'front'
  | 'back'
  | 'left_profile'
  | 'right_profile'
  | 'face_closeup'
  | 'full_body';

export type StudioPoseId =
  | 'idle'
  | 'walk'
  | 'run'
  | 'talk'
  | 'laugh'
  | 'anger'
  | 'fear'
  | 'fight';

export type StudioLightingPreset = 'daylight' | 'golden_hour' | 'softbox' | 'night_neon';

export type MetroLineId = 'purple' | 'green' | 'yellow' | 'pink' | 'blue';
export type MetroStatus = 'operational' | 'under_construction';
export type TransportMode = 'walk' | 'drive' | 'auto' | 'bus' | 'metro' | 'rail';

export type RadioCategoryId =
  | 'kannada_classic'
  | 'kannada_evergreen'
  | 'kannada_90s'
  | 'kannada_2000s'
  | 'kannada_modern'
  | 'kannada_folk'
  | 'instrumental'
  | 'indian_music'
  | 'custom_local';

export interface RadioTrack {
  id: string;
  title: string;
  artist: string;
  category: RadioCategoryId;
  bpm: number;
  scaleHz: number[];
  bassHz: number[];
  mood: string;
  localUrl?: string;
}

export type RadioRepeatMode = 'off' | 'all' | 'one';

export interface RadioState {
  playing: boolean;
  category: RadioCategoryId;
  trackIndex: number;
  trackTitle: string;
  trackArtist: string;
  volume: number;
  shuffle: boolean;
  repeat: RadioRepeatMode;
  customTracks: RadioTrack[];
}

export type InteriorId =
  | 'indiranagar_villa'
  | 'koramangala_house'
  | 'whitefield_apt'
  | 'namma_mart'
  | 'weapon_shop'
  | 'bengaluru_gym'
  | 'police_jail';

export type PolicePursuitStage =
  | 'none'
  | 'pursuit'
  | 'officers_approaching'
  | 'cuffing'
  | 'escorting_to_car'
  | 'driving_to_station'
  | 'booking_jail';

export interface GroceryItemDef {
  id: string;
  name: string;
  kannadaName: string;
  category: 'Dairy' | 'Bakery' | 'Grains' | 'Produce' | 'Snacks' | 'Beverages' | 'Household';
  price: number;
  healthRestore: number;
  color: string;
}

export interface MetroTicket {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  line: MetroLineId;
  fare: number;
  qrCode: string;
  timestamp: string;
  used: boolean;
}

export type MetroJourneyPhase =
  | 'none'
  | 'concourse'
  | 'platform'
  | 'riding'
  | 'arrived';

export type MetroTrainPhase =
  | 'approaching'
  | 'boarding'
  | 'doors_closing'
  | 'departing'
  | 'moving'
  | 'stopped';

export type TrainCameraMode = 'chase' | 'interior' | 'window' | 'cinematic';

export interface TrafficCongestionState {
  active: boolean;
  zoneId: DistrictId;
  zoneName: string;
  severity: 'light' | 'moderate' | 'heavy';
  speedFactor: number;
  vehicleCount: number;
  reason: string;
}

export interface MetroJourneyState {
  phase: MetroJourneyPhase;
  stationId: string;
  stationName: string;
  stationKannada: string;
  line: MetroLineId;
  elevatedStation: boolean;
  destinationId: string | null;
  destinationName: string | null;
  interchangeStationName: string | null;
  routeLineSequence: MetroLineId[];
  stopsRemaining: number;
  trainWaitSec: number;
  trainPhase: MetroTrainPhase;
  trainDoorOpen: number;
  trainSpeedKmh: number;
  trainCameraMode: TrainCameraMode;
  holdingRail: boolean;
  boardingTransition: boolean;
  passengerCount: number;
  activeDoorSide: 'left' | 'right';
  elevatorFloor: 'concourse' | 'platform';
  elevatorMoving: boolean;
  onEscalator: 'up' | 'down' | null;
  rideProgress: number;
  gateUnlocked: boolean;
  securityCleared: boolean;
  smartCardOwned: boolean;
  smartCardBalance: number;
  exitGateCleared: boolean;
  coachCount: number;
  activeCoachIndex: number;
  farePaid: number;
  announcement: string;
}

export interface DebugTelemetry {
  worldX: number;
  worldY: number;
  worldZ: number;
  anchorX: number;
  anchorZ: number;
  resolvedLocation: string;
  movementState: string;
  cameraMode: CameraMode;
  cameraPos: [number, number, number];
  fov: number;
  activeVehiclesCount: number;
  activeNpcsCount: number;
  policeCount: number;
  renderError: string | null;
}

export type NammaYatriStatus =
  | 'idle'
  | 'en_route_pickup'
  | 'waiting_pickup'
  | 'riding'
  | 'arrived';

export interface NammaYatriBooking {
  status: NammaYatriStatus;
  rideType: 'auto' | 'cab';
  driverName: string;
  plateNumber: string;
  destName: string;
  destX: number;
  destZ: number;
  fare: number;
  distanceKm: number;
  etaSec: number;
}

export interface BankTransaction {
  id: string;
  label: string;
  amount: number;
  time: string;
}

export interface PhoneMessage {
  id: string;
  sender: string;
  role: string;
  text: string;
  kannadaText?: string;
  time: string;
  fromPlayer?: boolean;
}

export interface SaveSlotSummary {
  slot: number;
  savedAt: string;
  protagonistName: string;
  districtName: string;
  cash: number;
  completedMissions: number;
  ownedProperties: number;
}

export interface PlayerCustomization {
  protagonistId: ProtagonistId;
  facePreset: FacePresetId;
  hairStyle: HairStyleId;
  hairColor: string;
  beardStyle: BeardStyleId;
  outfitStyle: OutfitStyleId;
  jacketColor: string;
  shirtColor: string;
  pantsColor: string;
  shoeColor: string;
  watch: boolean;
  sunglasses: boolean;
  backpack: boolean;
  chain: boolean;
}

export interface ProtagonistProfile {
  id: ProtagonistId;
  name: string;
  archetypeTitle: string;
  age: number;
  personality: string;
  bodySummary: string;
  customization: PlayerCustomization;
  heightScale: number;
  widthScale: number;
  abdomenScale: number;
  ageGroup: 'young' | 'middle' | 'elder';
}

export interface VehicleTuning {
  color: string;
  engineLevel: number;
  handlingLevel: number;
  armorLevel: number;
}

export interface DistrictDef {
  id: DistrictId;
  name: string;
  kannadaName: string;
  region: 'Central' | 'East' | 'South' | 'North' | 'West';
  lat: number;
  lon: number;
  x: number;
  z: number;
  radius: number;
  description: string;
  color: string;
}

export interface LandmarkMarker {
  id: string;
  name: string;
  kannadaName?: string;
  type:
    | 'mission'
    | 'garage'
    | 'safehouse'
    | 'shop'
    | 'petrol'
    | 'landmark'
    | 'darshini'
    | 'atm'
    | 'bench'
    | 'metro'
    | 'bus_hub'
    | 'rail'
    | 'interior';
  x: number;
  z: number;
  lat: number;
  lon: number;
  district: DistrictId;
  description: string;
  status?: MetroStatus;
  line?: MetroLineId;
  interiorId?: InteriorId;
  price?: number;
}

export interface MetroStationDef {
  id: string;
  name: string;
  kannadaName: string;
  line: MetroLineId;
  order: number;
  status: MetroStatus;
  elevated: boolean;
  lat: number;
  lon: number;
  x: number;
  z: number;
  interchangeWith?: MetroLineId[];
}

export interface RailBusStationDef {
  id: string;
  name: string;
  kannadaName: string;
  kind: 'rail' | 'bus';
  lat: number;
  lon: number;
  x: number;
  z: number;
  district: DistrictId;
  platforms: number;
  routes: string[];
}

export interface NavigationRoute {
  mode: TransportMode;
  destinationName: string;
  targetX: number;
  targetZ: number;
  distanceKm: number;
  etaMinutes: number;
  pathPoints: Array<{ x: number; z: number }>;
  stationStops?: string[];
  summary: string;
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

export interface RoadPoint {
  x: number;
  z: number;
  lat: number;
  lon: number;
}

export interface RoadSegment {
  id: string;
  name: string;
  kind: 'highway' | 'arterial' | 'secondary' | 'flyover' | 'metro';
  points: RoadPoint[];
  width: number;
  elevated?: boolean;
  oneWay?: boolean;
  lanes?: number;
  metroLine?: MetroLineId;
  metroStatus?: MetroStatus;
}

export interface WaterZone {
  id: string;
  name: string;
  lat: number;
  lon: number;
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
  cx?: number;
  cz?: number;
  halfW?: number;
  halfD?: number;
  rotationY?: number;
}

export interface GeoJsonFeature {
  type: 'Feature';
  id?: string;
  properties: Record<string, string | number | boolean | undefined>;
  geometry:
    | { type: 'Point'; coordinates: [number, number] }
    | { type: 'LineString'; coordinates: Array<[number, number]> }
    | { type: 'MultiLineString'; coordinates: Array<Array<[number, number]>> }
    | { type: 'Polygon'; coordinates: Array<Array<[number, number]>> };
}

export interface GeoJsonFeatureCollection {
  type: 'FeatureCollection';
  name?: string;
  crs?: { type: string; properties: { name: string } };
  features: GeoJsonFeature[];
}

export interface WorldPartitionStats {
  totalCells: number;
  activeHighCells: number;
  activeMediumCells: number;
  culledCells: number;
  importedRoadCount: number;
  importedFeatureCount: number;
}

export interface GeoValidationEntry {
  id: string;
  name: string;
  region: string;
  lat: number;
  lon: number;
  utmEasting: number;
  utmNorthing: number;
  worldX: number;
  worldZ: number;
  realDistKm: number;
  projectedDistKm: number;
  bearingDeg: number;
  errorMeters: number;
}

export interface GeoValidationReport {
  datum: string;
  projection: string;
  originLat: number;
  originLon: number;
  scaleMetersPerUnit: number;
  attribution: string;
  meanScaleErrorPct: number;
  maxDistanceErrorMeters: number;
  connectedRoadCount: number;
  junctionCount: number;
  entries: GeoValidationEntry[];
}

export interface HudSnapshot {
  health: number;
  maxHealth: number;
  armor: number;
  maxArmor: number;
  stamina: number;
  ammo: number;
  cash: number;
  bankBalance: number;
  wantedStars: number;
  wantedCooldown: number;
  isEvading: boolean;
  protagonistId: ProtagonistId;
  protagonistName: string;
  districtName: string;
  districtKannada: string;
  discoveredDistricts: DistrictId[];
  totalDistricts: number;
  playerX: number;
  playerZ: number;
  playerLat: number;
  playerLon: number;
  utmEasting: number;
  utmNorthing: number;
  playerHeading: number;
  inVehicle: boolean;
  vehicleKind: VehicleKind | null;
  vehicleLabel: string;
  vehicleHealth: number;
  vehicleFuel: number;
  speedKmh: number;
  gear: number;
  headlightsOn: boolean;
  isSwimming: boolean;
  isCrouching: boolean;
  isSitting: boolean;
  isBlocking: boolean;
  cameraMode: CameraMode;
  studioActive: boolean;
  studioAngle: StudioAngleId;
  studioPose: StudioPoseId;
  studioLighting: StudioLightingPreset;
  studioYawOffset: number;
  weapon: WeaponKind;
  nearPrompt: string | null;
  nearGarage: boolean;
  nearStation: {
    id: string;
    name: string;
    kannadaName: string;
    kind: 'metro' | 'rail' | 'bus';
    line?: MetroLineId;
    status?: MetroStatus;
  } | null;
  activeInterior: InteriorId | null;
  interiorAction: string | null;
  tvState: { on: boolean; channel: number };
  homeLightsOn: boolean;
  homeCurtainsOpen: boolean;
  ownedProperties: InteriorId[];
  groceryBasket: Record<string, number>;
  pantryItems: Record<string, number>;
  metroJourney: MetroJourneyState;
  metroTickets: MetroTicket[];
  nammaYatri: NammaYatriBooking;
  transactions: BankTransaction[];
  messages: PhoneMessage[];
  activeRoute: NavigationRoute | null;
  partitionStats: WorldPartitionStats;
  timeOfDayHours: number;
  timePreset: TimePreset;
  istClockLabel: string;
  istDateLabel: string;
  istWeekday: string;
  timezoneLabel: string;
  clockModeLabel: string;
  solarTimes: { sunrise: string; sunset: string; elevationDeg: number };
  locationAnchorLabel: string;
  nammaYatriPassengerMode: boolean;
  weather: WeatherMode;
  language: LanguageId;
  photoMode: boolean;
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
  radioState: RadioState;
  policeBlips: Array<{ x: number; z: number }>;
  arrestStage: PolicePursuitStage;
  arrestStationName: string | null;
  arrestOfficerCount: number;
  jailBailCost: number;
  trafficCongestion: TrafficCongestionState;
  canBoardMetro: boolean;
  canExitTrain: boolean;
  canUseTvm: boolean;
  canUseSmartCard: boolean;
  canPassSecurity: boolean;
  canScanExitGate: boolean;
  nearPassengerPrompt: string | null;
  canSitInTrain: boolean;
  canHoldRail: boolean;
  cityShowcaseActive: boolean;
  cityShowcaseLabel: string | null;
  fps: number;
  debugTelemetry: DebugTelemetry;
}

export interface GameSettings {
  timePreset: TimePreset;
  weather: WeatherMode;
  trafficDensity: 'low' | 'medium' | 'high';
  graphicsQuality: GraphicsQuality;
  radioOn: boolean;
  sfxOn: boolean;
  cameraSensitivity: number;
  language: LanguageId;
}
