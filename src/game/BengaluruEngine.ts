import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BengaluruAudio } from './audio';
import { GeoJsonWorldPartitionImporter, RoadNetworkRouter } from './GeoJsonWorldPartition';
import {
  COLLECTIBLES,
  CONGESTION_ZONES,
  DISTRICTS,
  GROCERY_ITEMS,
  INITIAL_OSM_IMPORT,
  LANDMARK_MARKERS,
  METRO_STATIONS,
  MISSIONS,
  NPC_DIALOGUE_LINES,
  POLICE_STATIONS,
  PROTAGONIST_PRESETS,
  RAIL_BUS_STATIONS,
  ROAD_SEGMENTS,
  SILK_BOARD_FLYOVER_LOOP,
  TV_CHANNELS,
  VEHICLE_SPECS,
  WEAPONS_CATALOG,
  WORLD_HALF_SIZE,
  computeBmrclMetroFare,
  getDistrictAt,
  getDistrictCenter,
  getFlyoverDeckY,
  getGradedTerrainY,
  getNearestPoliceStation,
  isPointInWater,
  isPointOnRoad,
} from './bengaluruData';
import { worldToLatLon, worldToUtm43N } from './bengaluruGeo';
import { ClothUpdateContext } from './cloth';
import { constrainToFlyoverGuardrails, getSampledRoadSpine } from './roadGeometry';
import { VehicleRig, createVehicleRig } from './entities';
import {
  FacialExpression,
  HumanPoseState,
  HumanRig,
  NpcArchetype,
  StreetDogRig,
  createArchetypeHuman,
  createDetailedHumanRig,
  createStreetDogRig,
  disposeHumanRig,
  rebuildPlayerCustomization,
  updateHumanAnimation,
} from './humans';
import { InteriorsManagerHandles, buildAllInteriors } from './interiors';
import { KANNADA_PRIMARY_DIALOGUES, getUiStrings, speakKannadaOrEnglish } from './localization';
import { MetroInteriorHandles, buildMetroInterior } from './metroSim';
import { METRO_DOOR_X, getActiveCoachIndex } from './metroTrain';
import {
  SavePayload,
  getBengaluruSolarTimes,
  getIndiaStandardTime,
  loadGameFromSlot,
  saveGameToSlot,
} from './saveSystem';
import { TextureBundle, createProceduralTextures } from './textures';
import {
  BankTransaction,
  BuildingCollider,
  CameraMode,
  DebugTelemetry,
  DistrictId,
  GameSettings,
  HudSnapshot,
  InteriorId,
  LanguageId,
  MetroJourneyState,
  MetroLineId,
  MetroTicket,
  MetroTrainPhase,
  MissionDef,
  NammaYatriBooking,
  NavigationRoute,
  PhoneMessage,
  PlayerCustomization,
  PolicePursuitStage,
  ProtagonistId,
  RadioCategoryId,
  RoadSegment,
  StudioAngleId,
  StudioLightingPreset,
  StudioPoseId,
  TrafficCongestionState,
  TrainCameraMode,
  TransportMode,
  VehicleKind,
  VehicleTuning,
  WeaponKind,
  WorldPartitionStats,
} from './types';
import { WorldHandles, buildBengaluruWorld } from './world';

interface SimVehicle {
  id: string;
  kind: VehicleKind;
  rig: VehicleRig;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  prevSpeed: number;
  steerAngle: number;
  pitchSpring: number;
  rollSpring: number;
  health: number;
  maxHealth: number;
  isAi: boolean;
  isPolice: boolean;
  roadSeg?: RoadSegment;
  roadPoints: Array<{ x: number; z: number }> | null;
  roadSegIdx: number;
  roadT: number;
  aiDir: 1 | -1;
  laneOffset: number;
  disabledTimer: number;
  honkCooldown: number;
  busStopWaitTimer: number;
  fuel: number;
  overtakeShift?: number;
  pursuitWaypoints?: Array<{ x: number; z: number }>;
  pursuitWpIdx?: number;
  pursuitRepathTimer?: number;
}

interface SimOfficer {
  rig: HumanRig;
  vehicleId: string;
  x: number;
  y: number;
  z: number;
  heading: number;
  speed: number;
  stridePhase: number;
}

interface SimNpc {
  rig: HumanRig;
  archetype: NpcArchetype;
  x: number;
  z: number;
  vx: number;
  vz: number;
  heading: number;
  speed: number;
  stridePhase: number;
  routineTimer: number;
  routineMode: 'walk' | 'phone' | 'talk' | 'sit';
  expression: FacialExpression;
  lineIndex: number;
  hitReactTimer: number;
  knockdownTimer: number;
}

interface SimDog {
  rig: StreetDogRig;
  x: number;
  z: number;
  heading: number;
  speed: number;
  turnTimer: number;
}

interface ActiveMissionState {
  def: MissionDef;
  timeRemaining: number | null;
  checkpointIndex: number;
  evadeTimer: number;
}

const _v1 = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _localOffset = new THREE.Vector3();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

export class BengaluruEngine {
  private container: HTMLElement;
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private textures!: TextureBundle;
  private world!: WorldHandles;
  private interiors!: InteriorsManagerHandles;
  private metroSim!: MetroInteriorHandles;
  public audio = new BengaluruAudio();

  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private paused = false;
  private started = false;
  private clock = new THREE.Clock();
  private elapsed = 0;
  private fpsAccum = 0;
  private fpsFrames = 0;
  private currentFps = 60;

  // Player state (grounded on real MG Road Bengaluru coordinate)
  private playerRig!: HumanRig;
  private playerX = 104;
  private playerY = 0;
  private playerZ = -35;
  private playerVx = 0;
  private playerVz = 0;
  private playerVy = 0;
  private playerHeading = Math.PI * 0.5;
  private playerStridePhase = 0;
  private footstepAccum = 0;
  private punchTimer = 0;
  private kickTimer = 0;
  private dodgeTimer = 0;
  private hitReactTimer = 0;
  private eatTimer = 0;
  private isBlocking = false;
  private isGrounded = true;
  private isSwimming = false;
  private isCrouching = false;
  private isSitting = false;
  private health = 100;
  private maxHealth = 100;
  private armor = 60;
  private maxArmor = 100;
  private stamina = 100;
  private ammo = 36;
  private cash = 12500;
  private bankBalance = 145000;
  private weapon: WeaponKind = 'unarmed';

  // Camera & Cinematography Studio
  private cameraMode: CameraMode = 'chase';
  private studioActive = false;
  private photoMode = false;
  private studioAngle: StudioAngleId = 'three_quarter';
  private studioPose: StudioPoseId = 'idle';
  private studioLighting: StudioLightingPreset = 'daylight';
  private studioYawOffset = 0;
  private camYawOffset = 0;
  private camPitch = 0.26;
  private currentCamPos = new THREE.Vector3(104, 8, -48);
  private currentLookAt = new THREE.Vector3(104, 2, -35);
  private isDraggingCam = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // GeoJSON Importer, Router & World Partition
  private geoImporter = new GeoJsonWorldPartitionImporter();
  private router = new RoadNetworkRouter(ROAD_SEGMENTS);
  private customRoads: RoadSegment[] = [];
  private activeRoute: NavigationRoute | null = null;
  private partitionStats: WorldPartitionStats = {
    totalCells: 0,
    activeHighCells: 0,
    activeMediumCells: 0,
    culledCells: 0,
    importedRoadCount: ROAD_SEGMENTS.length,
    importedFeatureCount: INITIAL_OSM_IMPORT.featureCount,
  };

  // Vehicles, Entities & Spatial Collision Grid
  private colliderGrid = new Map<string, BuildingCollider[]>();
  private readonly colliderCellSize = 48;
  private vehicles: SimVehicle[] = [];
  private activeVehicle: SimVehicle | null = null;
  private headlightsOn = true;
  private doorAnimTimers = new Map<string, number>();
  private npcs: SimNpc[] = [];
  private dogs: SimDog[] = [];
  private projectiles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; isEmp: boolean }> = [];
  private splashParticles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number }> = [];

  // Police, Pursuit & Arrest Lifecycle
  private wantedStars = 0;
  private wantedCooldown = 0;
  private isEvading = false;
  private policeOfficers: SimOfficer[] = [];
  private arrestStage: PolicePursuitStage = 'none';
  private arrestTimer = 0;
  private arrestStoppedAccum = 0;
  private arrestEscortVehicle: SimVehicle | null = null;
  private arrestTargetStation = POLICE_STATIONS[0];
  private arrestWaypoints: Array<{ x: number; z: number }> = [];
  private arrestWpIdx = 0;
  private hornAlertTimer = 0;

  // Progression, Interiors, Metro, Smartphone & Life Simulator State
  private discoveredDistricts = new Set<DistrictId>(['mg_road']);
  private completedMissions = new Set<string>();
  private collectedIds = new Set<string>();
  private activeMission: ActiveMissionState | null = null;
  private waypoint: { x: number; z: number; label: string } | null = null;
  private timeOfDayHours = 10.5;
  private istClockLabel = '10:30:00 IST';
  private istDateLabel = '';
  private istWeekday = '';
  private timezoneLabel = 'Asia/Kolkata (IST)';
  private istDayOfYear = 120;
  private phoneOpen = false;
  private movementState = 'idle';
  private renderError: string | null = null;
  private npcSubtitle: { speaker: string; language: string; line: string } | null = null;
  private subtitleTimer = 0;
  private toastMessage: string | null = null;
  private toastTimer = 0;

  private activeInterior: InteriorId | null = null;
  private interiorReturnPos = new THREE.Vector3();
  private interiorAction: string | null = null;
  private tvState = { on: true, channel: 1 };
  private homeLightsOn = true;
  private homeCurtainsOpen = true;
  private ownedProperties: InteriorId[] = ['indiranagar_villa'];
  private groceryBasket: Record<string, number> = {};
  private pantryItems: Record<string, number> = {
    g_nandini_milk: 2,
    g_filter_kaapi: 1,
    g_maddur_vada: 2,
  };

  private metroJourney: MetroJourneyState = {
    phase: 'none',
    stationId: '',
    stationName: '',
    stationKannada: '',
    line: 'purple',
    elevatedStation: true,
    destinationId: null,
    destinationName: null,
    interchangeStationName: null,
    routeLineSequence: ['purple'],
    stopsRemaining: 0,
    trainWaitSec: 0,
    trainPhase: 'approaching',
    trainDoorOpen: 0,
    trainSpeedKmh: 0,
    trainCameraMode: 'interior',
    holdingRail: false,
    boardingTransition: false,
    passengerCount: 10,
    activeDoorSide: 'left',
    elevatorFloor: 'concourse',
    elevatorMoving: false,
    onEscalator: null,
    rideProgress: 0,
    gateUnlocked: false,
    securityCleared: false,
    smartCardOwned: false,
    smartCardBalance: 0,
    exitGateCleared: true,
    coachCount: 4,
    activeCoachIndex: 2,
    farePaid: 0,
    announcement: '',
  };
  private metroTickets: MetroTicket[] = [];
  private securityCleared = false;
  private smartCardOwned = false;
  private smartCardBalance = 0;
  private exitGateCleared = true;
  private hasRiddenMetro = false;
  private metroFarePaid = 0;
  private metroReturnPos = new THREE.Vector3();
  private elevatorY = -140;
  private elevatorTargetY = -140;
  private elevatorDoorOpen = 1;
  private trainPhase: MetroTrainPhase = 'approaching';
  private trainDoorOpen = 0;
  private trainPhaseTimer = 0;
  private metroRouteIds: string[] = [];
  private boardingTransition = false;
  private boardingTimer = 0;
  private boardingTargetX = 0;
  private boardingTargetZ = 0;
  private coachDoorOpen = 0;
  private trainStopPauseTimer = 0;
  private lastAnnouncedHop = -1;
  private holdingRail = false;

  private trafficCongestion: TrafficCongestionState = {
    active: false,
    zoneId: 'mg_road',
    zoneName: 'MG Road – Trinity Boulevard',
    severity: 'light',
    speedFactor: 1,
    vehicleCount: 0,
    reason: 'Smooth traffic flow',
  };

  private cityShowcaseActive = false;
  private cityShowcaseTimer = 0;
  private cityShowcaseSavedTime: number | null = null;
  private cityShowcaseLabel: string | null = null;

  private nammaYatri: NammaYatriBooking = {
    status: 'idle',
    rideType: 'auto',
    driverName: '',
    plateNumber: '',
    destName: '',
    destX: 0,
    destZ: 0,
    fare: 0,
    distanceKm: 0,
    etaSec: 0,
  };
  private nammaYatriVehicle: SimVehicle | null = null;
  private nammaYatriDriverRig: HumanRig | null = null;
  private nammaYatriWaypoints: Array<{ x: number; z: number }> = [];
  private nammaYatriWpIdx = 0;

  private transactions: BankTransaction[] = [
    { id: 'tx_0', label: 'Bengaluru Studio Retainer', amount: 145000, time: '09:30 IST' },
  ];
  private messages: PhoneMessage[] = [
    {
      id: 'm_1',
      sender: 'Ramesh (Auto Anna)',
      role: 'Namma Yatri Partner',
      text: 'Sir, Silk Board traffic cleared. Book anytime!',
      kannadaText: 'ಸರ್, ಸಿಲ್ಕ್ ಬೋರ್ಡ್ ಟ್ರಾಫಿಕ್ ಕ್ಲಿಯರ್ ಆಗಿದೆ. ಯಾವಾಗ ಬೇಕಾದ್ರೂ ಬುಕ್ ಮಾಡಿ!',
      time: '09:42 IST',
    },
    {
      id: 'm_2',
      sender: 'Priya (Architect)',
      role: 'Indiranagar Studio',
      text: 'Namma Mart has fresh filter kaapi & Maddur vada today.',
      kannadaText: 'ನಮ್ಮ ಮಾರ್ಟ್‌ನಲ್ಲಿ ಫಿಲ್ಟರ್ ಕಾಫಿ ಮತ್ತು ಮದ್ದೂರು ವಡೆ ಫ್ರೆಶ್ ಇದೆ.',
      time: '10:15 IST',
    },
  ];

  // Customization & Settings (Default timePreset: 1:1 Asia/Kolkata IST Real-Time)
  private playerCustom: PlayerCustomization = { ...PROTAGONIST_PRESETS.arjun.customization };
  private vehicleTuning: VehicleTuning = {
    color: '#f97316',
    engineLevel: 1,
    handlingLevel: 1,
    armorLevel: 1,
  };
  private settings: GameSettings = {
    timePreset: 'ist_realtime',
    weather: 'clear',
    trafficDensity: 'medium',
    graphicsQuality: 'high',
    radioOn: true,
    sfxOn: true,
    cameraSensitivity: 1.0,
    language: 'kn',
  };

  // Input
  private keys = new Set<string>();
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onContextLost: () => void;
  private onRenderError?: (err: string) => void;
  private lastHudEmit = 0;

  private handleResizeBound: () => void;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerUpBound: () => void;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onContextLost: () => void,
    onRenderError?: (err: string) => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onContextLost = onContextLost;
    this.onRenderError = onRenderError;

    this.handleResizeBound = this.onResize.bind(this);
    this.handleKeyDownBound = this.onKeyDown.bind(this);
    this.handleKeyUpBound = this.onKeyUp.bind(this);
    this.handlePointerDownBound = this.onPointerDown.bind(this);
    this.handlePointerMoveBound = this.onPointerMove.bind(this);
    this.handlePointerUpBound = this.onPointerUp.bind(this);

    const ist = getIndiaStandardTime();
    this.istClockLabel = ist.clockLabel;
    this.istDateLabel = ist.dateLabel;
    this.istWeekday = ist.weekdayLabel;
    this.timezoneLabel = ist.timezoneLabel;
    this.istDayOfYear = ist.dayOfYear;
    this.timeOfDayHours = ist.hoursDecimal;

    this.init();
  }

  private init(): void {
    this.isSoftwareGl = detectSoftwareWebGL();
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.08;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height);
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.onContextLost();
    });

    this.scene = new THREE.Scene();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.15, 1600);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.world = buildBengaluruWorld(this.scene, this.textures);
    this.buildColliderSpatialGrid();
    this.interiors = buildAllInteriors(this.scene);
    this.metroSim = buildMetroInterior(this.scene, this.textures);

    // Spawn on real MG Road coordinate
    const mg = getDistrictCenter('mg_road');
    this.playerX = mg.x - 6;
    this.playerZ = mg.z + 10;
    this.playerY = getFlyoverDeckY(this.playerX, this.playerZ);
    this.currentCamPos.set(this.playerX - 5, this.playerY + 3, this.playerZ + 12);
    this.currentLookAt.set(this.playerX, this.playerY + 1.5, this.playerZ);

    const prof = PROTAGONIST_PRESETS[this.playerCustom.protagonistId];
    this.playerRig = createDetailedHumanRig(
      {
        ...this.playerCustom,
        ageGroup: prof.ageGroup,
        heightScale: prof.heightScale,
        widthScale: prof.widthScale,
        abdomenScale: prof.abdomenScale,
        seed: 42,
        enableCloth: true,
      },
      this.textures
    );
    this.playerRig.group.position.set(this.playerX, this.playerY, this.playerZ);
    this.scene.add(this.playerRig.group);

    // Hero & Bengaluru Showcase Vehicles across MG Road, Indiranagar, Majestic, Koramangala
    const ind = getDistrictCenter('indiranagar');
    const maj = getDistrictCenter('majestic');
    const kor = getDistrictCenter('koramangala');
    this.spawnVehicle('coupe', mg.x + 8, mg.z + 8, Math.PI * 0.5, false, false, this.vehicleTuning.color);
    this.spawnVehicle('auto', mg.x - 16, mg.z + 12, 0, false, false);
    this.spawnVehicle('bike', mg.x + 16, mg.z - 6, -Math.PI * 0.5, false, false);
    this.spawnVehicle('hatchback', mg.x - 22, mg.z - 8, 0, false, false);
    this.spawnVehicle('scooter', ind.x - 8, ind.z + 12, Math.PI * 0.5, false, false);
    this.spawnVehicle('suv', ind.x + 18, ind.z - 10, 0, false, false);
    this.spawnVehicle('cab', ind.x + 10, ind.z + 8, Math.PI * 0.5, false, false);
    this.spawnVehicle('bmtc', maj.x + 12, maj.z + 10, 0, false, false);
    this.spawnVehicle('truck', maj.x - 16, maj.z + 14, Math.PI * 0.5, false, false);
    this.spawnVehicle('coupe', kor.x - 10, kor.z + 10, 0, false, false, '#2563eb');

    this.populateTraffic();
    this.populateNpcs();
    this.populateStreetDogs();

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResizeBound);
    window.addEventListener('keydown', this.handleKeyDownBound);
    window.addEventListener('keyup', this.handleKeyUpBound);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDownBound);
    window.addEventListener('pointermove', this.handlePointerMoveBound);
    window.addEventListener('pointerup', this.handlePointerUpBound);

    this.emitHud(true);
    this.tick();
  }

  private spawnVehicle(
    kind: VehicleKind,
    x: number,
    z: number,
    heading: number,
    isAi: boolean,
    isPolice: boolean,
    overrideColor?: string
  ): SimVehicle {
    const spec = VEHICLE_SPECS[kind];
    const rig = createVehicleRig(kind, overrideColor || spec.baseColor, this.textures.contactShadow);
    const y = getFlyoverDeckY(x, z);
    rig.group.position.set(x, y, z);
    rig.group.rotation.y = heading;
    if (rig.riderGroup && isAi && (kind === 'bike' || kind === 'police_bike')) {
      rig.riderGroup.visible = true;
    }
    this.scene.add(rig.group);

    const v: SimVehicle = {
      id: `v_${Math.random().toString(36).slice(2, 9)}`,
      kind,
      rig,
      x,
      y,
      z,
      heading,
      speed: isAi ? spec.maxSpeed * 0.44 : 0,
      prevSpeed: 0,
      steerAngle: 0,
      pitchSpring: 0,
      rollSpring: 0,
      health: spec.maxHealth,
      maxHealth: spec.maxHealth,
      isAi,
      isPolice,
      roadPoints: null,
      roadSegIdx: 0,
      roadT: 0,
      aiDir: 1,
      laneOffset: 4.0,
      disabledTimer: 0,
      honkCooldown: 2 + Math.random() * 6,
      busStopWaitTimer: 0,
      fuel: 100,
    };
    this.vehicles.push(v);
    return v;
  }

  private populateTraffic(): void {
    const drivableRoads = ROAD_SEGMENTS.filter((r) => r.kind !== 'metro' && r.kind !== 'flyover' && r.points.length >= 2);
    const kinds: VehicleKind[] = [
      'auto',
      'hatchback',
      'cab',
      'scooter',
      'bike',
      'suv',
      'bmtc',
      'truck',
      'delivery',
      'ambulance',
      'auto',
      'scooter',
      'cab',
    ];

    const bottleneckCenters = CONGESTION_ZONES.map((z) => getDistrictCenter(z.zoneId));
    const bottleneckRoads = drivableRoads.filter((r) =>
      r.points.some((pt) => bottleneckCenters.some((c) => Math.hypot(pt.x - c.x, pt.z - c.z) < 220))
    );

    const totalVehicles = 108;
    for (let i = 0; i < totalVehicles; i++) {
      const useBottleneck = i >= 72 && bottleneckRoads.length > 0;
      const roadPool = useBottleneck ? bottleneckRoads : drivableRoads;
      const road = roadPool[i % roadPool.length];
      const spine = getSampledRoadSpine(road);
      const pts = spine.points;
      if (pts.length < 2) continue;

      const segIdx = i % (pts.length - 1);
      const t = ((i * 0.23) % 0.82) + 0.09;
      // One-way roads stay +1; dual roads split +/-1 keeping strictly Indian Left-Hand Driving
      const dir: 1 | -1 = road.oneWay ? 1 : i % 2 === 0 ? 1 : -1;
      const a = pts[segIdx];
      const b = pts[segIdx + 1];
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len = Math.hypot(dx, dz) || 1;
      const nx = -dz / len;
      const nz = dx / len;
      const kind = kinds[i % kinds.length];
      const fp = this.getVehicleFootprint(kind);
      const maxLane = Math.max(1.3, road.width * 0.5 - fp.halfW - 0.55);
      const desiredLane = kind === 'bike' || kind === 'scooter' ? 2.15 : 3.45;
      // Indian Left-Hand Driving: facing (dx*dir, dz*dir), left normal is -(nx*dir, nz*dir)
      const lane = -dir * Math.min(desiredLane, maxLane);

      const x = a.x + dx * t + nx * lane;
      const z = a.z + dz * t + nz * lane;
      const heading = Math.atan2(dx * dir, dz * dir);

      const v = this.spawnVehicle(kind, x, z, heading, true, false);
      v.roadSeg = road;
      v.roadPoints = pts;
      v.roadSegIdx = segIdx;
      v.roadT = t;
      v.aiDir = dir;
      v.laneOffset = lane;
      v.overtakeShift = 0;
    }
  }

  private populateNpcs(): void {
    const archetypes: NpcArchetype[] = [
      'it_pro',
      'saree_woman',
      'student',
      'kurta_citizen',
      'auto_driver',
      'delivery_rider',
      'traffic_police',
      'vendor',
      'construction',
      'elder',
    ];
    const hubs = [
      'mg_road',
      'brigade_road',
      'commercial_street',
      'cubbon_park',
      'indiranagar',
      'koramangala',
      'silk_board',
      'majestic',
      'kr_market',
      'jayanagar',
      'whitefield',
      'hebbal',
    ] as const;

    for (let i = 0; i < 48; i++) {
      const center = getDistrictCenter(hubs[i % hubs.length]);
      const archetype = archetypes[i % archetypes.length];
      let x = center.x + (Math.random() - 0.5) * 44;
      let z = center.z + (Math.random() - 0.5) * 44;

      if (archetype === 'traffic_police' && this.world.trafficSignals.length > 0) {
        const sig = this.world.trafficSignals[i % this.world.trafficSignals.length];
        x = sig.x + (i % 2 === 0 ? 7.2 : -7.2);
        z = sig.z + (i % 4 < 2 ? 7.2 : -7.2);
      } else {
        // Snap civilian spawns onto sidewalk edge flanking nearest Bengaluru road
        const nearest = this.router.getNearestRoadInfo(x, z, false);
        if (nearest) {
          const side = i % 2 === 0 ? 1 : -1;
          const sidewalkOffset = nearest.halfWidth + 2.0 + (i % 3) * 0.4;
          x = nearest.closestX + nearest.normalX * side * sidewalkOffset;
          z = nearest.closestZ + nearest.normalZ * side * sidewalkOffset;
        }
      }

      const rig = createArchetypeHuman(archetype, i + 10, this.textures);
      rig.group.position.set(x, getGradedTerrainY(x, z), z);
      this.scene.add(rig.group);
      this.npcs.push({
        rig,
        archetype,
        x,
        z,
        vx: 0,
        vz: 0,
        heading: archetype === 'traffic_police' ? Math.atan2(center.x - x, center.z - z) : Math.random() * Math.PI * 2,
        speed: archetype === 'elder' ? 1.15 : archetype === 'student' ? 1.9 : 1.55,
        stridePhase: Math.random() * 6,
        routineTimer: 3 + Math.random() * 6,
        routineMode: archetype === 'traffic_police' ? 'talk' : i % 5 === 0 ? 'phone' : i % 6 === 0 ? 'talk' : 'walk',
        expression: i % 4 === 0 ? 'happy' : 'neutral',
        lineIndex: i % NPC_DIALOGUE_LINES.length,
        hitReactTimer: 0,
        knockdownTimer: 0,
      });
    }
  }

  private populateStreetDogs(): void {
    const hubs = ['mg_road', 'kr_market', 'indiranagar', 'koramangala', 'jayanagar'] as const;
    const cols = [0xc28549, 0x3f3f46, 0xd6a168, 0x926036, 0xa16207];
    hubs.forEach((hId, idx) => {
      const c = getDistrictCenter(hId);
      const dx = c.x + 12;
      const dz = c.z - 14;
      const rig = createStreetDogRig(cols[idx], this.textures.contactShadow);
      rig.group.position.set(dx, getGradedTerrainY(dx, dz), dz);
      this.scene.add(rig.group);
      this.dogs.push({
        rig,
        x: dx,
        z: dz,
        heading: Math.random() * Math.PI * 2,
        speed: 1.4,
        turnTimer: 2 + Math.random() * 4,
      });
    });
  }

  private onResize(): void {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  private onKeyDown(e: KeyboardEvent): void {
    const tag = (e.target as HTMLElement | null)?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    const code = e.code;
    this.keys.add(code);
    this.audio.unlock();

    if (!this.started || this.paused) return;
    if (
      this.arrestStage === 'cuffing' ||
      this.arrestStage === 'escorting_to_car' ||
      this.arrestStage === 'driving_to_station'
    ) {
      return;
    }

    if (code === 'KeyF' || code === 'KeyE') {
      if (!this.studioActive && !this.cityShowcaseActive) this.handleInteractOrVehicle();
    } else if (code === 'KeyC' && !this.activeVehicle && !this.studioActive) {
      this.isCrouching = !this.isCrouching;
      this.isSitting = false;
      this.holdingRail = false;
    } else if (code === 'KeyV' && !this.studioActive) {
      this.cycleCameraMode();
    } else if (code === 'KeyK' && !this.studioActive) {
      this.toggleCloseupCamera();
    } else if (code === 'KeyP') {
      this.cycleProtagonist();
    } else if (code === 'KeyU') {
      this.toggleStudioMode();
    } else if (code === 'KeyH' && this.activeVehicle) {
      this.audio.playHorn(this.activeVehicle.kind);
      this.hornAlertTimer = 1.8;
    } else if (code === 'KeyL' && this.activeVehicle) {
      this.headlightsOn = !this.headlightsOn;
      this.updateVehicleLights(this.activeVehicle, false);
    } else if (code === 'KeyR') {
      this.toggleRadio();
    } else if (code === 'Digit1') {
      this.weapon = 'unarmed';
    } else if (code === 'Digit2') {
      this.weapon = 'baton';
    } else if (code === 'Digit3') {
      this.weapon = 'tactical';
    } else if (code === 'Digit4') {
      this.weapon = 'emp';
    } else if (code === 'KeyG' && !this.studioActive) {
      this.triggerAction();
    } else if (code === 'KeyX' && !this.studioActive && !this.activeVehicle) {
      this.triggerKick();
    } else if (code === 'KeyQ' && !this.studioActive && !this.activeVehicle) {
      this.isBlocking = true;
    } else if ((code === 'KeyZ' || code === 'AltLeft') && !this.studioActive && !this.activeVehicle) {
      this.triggerDodge();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
    if (e.code === 'KeyQ') {
      this.isBlocking = false;
    }
  }

  private onPointerDown(e: PointerEvent): void {
    this.audio.unlock();
    if (!this.started || this.paused) return;
    if (e.button === 0) {
      this.isDraggingCam = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else if (e.button === 2 && !this.studioActive) {
      this.triggerAction();
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isDraggingCam || this.paused) return;
    const dx = e.clientX - this.lastPointerX;
    const dy = e.clientY - this.lastPointerY;
    this.lastPointerX = e.clientX;
    this.lastPointerY = e.clientY;
    const sens = 0.0045 * this.settings.cameraSensitivity;
    this.camYawOffset -= dx * sens;
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * sens, 0.04, 0.85);
  }

  private onPointerUp(): void {
    this.isDraggingCam = false;
  }

  public switchProtagonist(id: ProtagonistId): void {
    const profile = PROTAGONIST_PRESETS[id];
    if (!profile) return;
    this.playerCustom = { ...profile.customization };
    this.playerRig = rebuildPlayerCustomization(this.playerRig, this.playerCustom, this.textures, profile);
    this.showToast(`Switched Protagonist: ${profile.name} (${profile.archetypeTitle})`);
    this.emitHud(true);
  }

  public cycleProtagonist(): void {
    const order: ProtagonistId[] = ['vikram', 'arjun', 'sathish'];
    const idx = order.indexOf(this.playerCustom.protagonistId);
    this.switchProtagonist(order[(idx + 1) % order.length]);
  }

  public toggleStudioMode(): void {
    if (this.studioActive) {
      this.studioActive = false;
      this.cameraMode = 'chase';
      this.camYawOffset = 0;
      this.showToast('Returned to Bengaluru Open World.');
    } else {
      if (this.activeVehicle) {
        this.handleInteractOrVehicle();
      }
      this.studioActive = true;
      this.studioAngle = 'three_quarter';
      this.studioPose = 'idle';
      this.showToast('Character Cinematography Studio: Inspect Faces, Bodies & Chaos Cloth.');
    }
    this.emitHud(true);
  }

  public setStudioAngle(angle: StudioAngleId): void {
    this.studioAngle = angle;
    this.emitHud(true);
  }

  public setStudioPose(pose: StudioPoseId): void {
    this.studioPose = pose;
    this.emitHud(true);
  }

  public setStudioLighting(preset: StudioLightingPreset): void {
    this.studioLighting = preset;
    this.showToast(`Studio Lighting: ${preset.replace('_', ' ').toUpperCase()}`);
    this.emitHud(true);
  }

  public setStudioYawOffset(deg: number): void {
    this.studioYawOffset = (deg * Math.PI) / 180;
    this.emitHud(true);
  }

  public cycleCameraMode(): void {
    if (this.metroJourney.phase === 'riding' || this.metroJourney.phase === 'arrived') {
      this.cycleTrainCameraMode();
      return;
    }
    const modes: CameraMode[] = this.activeVehicle
      ? ['chase', 'cockpit', 'cinematic']
      : ['chase', 'closeup', 'cinematic'];
    const idx = modes.indexOf(this.cameraMode);
    this.cameraMode = modes[(idx + 1) % modes.length];
    this.audio.setInteriorMuffled(this.cameraMode === 'cockpit' && !!this.activeVehicle);
    const label =
      this.cameraMode === 'cockpit'
        ? 'First-Person Cockpit View'
        : this.cameraMode === 'closeup'
        ? 'Close-Up Character Face Camera'
        : this.cameraMode === 'cinematic'
        ? 'Cinematic Camera'
        : 'Third-Person Chase Camera';
    this.showToast(label);
    this.emitHud(true);
  }

  public cycleTrainCameraMode(): void {
    const order: TrainCameraMode[] = ['interior', 'window', 'chase', 'cinematic'];
    const idx = order.indexOf(this.metroJourney.trainCameraMode);
    const next = order[(idx + 1) % order.length];
    this.metroJourney.trainCameraMode = next;
    const label =
      next === 'interior'
        ? 'Metro Camera: Coach Interior'
        : next === 'window'
        ? 'Metro Camera: Window Skyline View'
        : next === 'chase'
        ? 'Metro Camera: Aisle Follow'
        : 'Metro Camera: Cinematic Coach';
    this.showToast(label);
    this.emitHud(true);
  }

  public sitInTrain(): void {
    if (this.metroJourney.phase !== 'riding' && this.metroJourney.phase !== 'arrived') return;
    if (this.isSitting) {
      this.isSitting = false;
      this.showToast('Stood up inside Metro coach.');
      this.emitHud(true);
      return;
    }
    const seats = this.metroSim.triggers.filter((t) => t.id === 'train_seat');
    if (seats.length === 0) return;
    let bestSeat = seats[0];
    let bestD = Infinity;
    for (const s of seats) {
      const d = Math.hypot(this.playerX - s.x, this.playerZ - s.z);
      if (d < bestD) {
        bestD = d;
        bestSeat = s;
      }
    }
    this.isSitting = true;
    this.holdingRail = false;
    this.metroJourney.holdingRail = false;
    const onRightSide = bestSeat.x > this.metroSim.trainCabinSpawn.x;
    this.playerX = bestSeat.x + (onRightSide ? 0.24 : -0.24);
    this.playerZ = bestSeat.z;
    this.playerHeading = onRightSide ? -Math.PI * 0.5 : Math.PI * 0.5;
    this.showToast('Seated inside Namma Metro coach.');
    this.emitHud(true);
  }

  public toggleHoldRail(): void {
    if (this.metroJourney.phase !== 'riding' && this.metroJourney.phase !== 'arrived') return;
    this.holdingRail = !this.holdingRail;
    if (this.holdingRail) this.isSitting = false;
    this.metroJourney.holdingRail = this.holdingRail;
    this.showToast(this.holdingRail ? 'Holding overhead Metro handrail.' : 'Released handrail.');
    this.emitHud(true);
  }

  public talkToMetroPassenger(): void {
    if (this.metroJourney.phase !== 'riding' && this.metroJourney.phase !== 'arrived') return;
    const res = this.metroSim.interactNearestPassenger(this.playerX, this.playerZ, this.settings.language);
    if (!res) {
      this.showToast('Walk closer to a fellow passenger to chat in Kannada.');
      return;
    }
    this.npcSubtitle = {
      speaker: res.speaker,
      language: 'Kannada / English',
      line: res.text,
    };
    this.subtitleTimer = 4.8;
    speakKannadaOrEnglish(res.text, this.settings.language);
    this.emitHud(true);
  }

  public toggleCityShowcase(): void {
    if (this.cityShowcaseActive) {
      this.cityShowcaseActive = false;
      this.cityShowcaseLabel = null;
      if (this.cityShowcaseSavedTime !== null && this.settings.timePreset !== 'ist_realtime') {
        this.timeOfDayHours = this.cityShowcaseSavedTime;
      }
      this.cityShowcaseSavedTime = null;
      this.currentCamPos.set(this.playerX - 5, this.playerY + 3, this.playerZ + 12);
      this.currentLookAt.set(this.playerX, this.playerY + 1.5, this.playerZ);
      this.showToast('Exited Live 3D City Showcase.');
    } else {
      if (this.studioActive) this.studioActive = false;
      this.cityShowcaseSavedTime = this.timeOfDayHours;
      this.cityShowcaseActive = true;
      this.cityShowcaseTimer = 0;
      this.cityShowcaseLabel = 'MG Road – Namma Metro Viaduct';
      this.showToast('Live 3D City Showcase — Press [F8] or [Esc] to return to gameplay.');
    }
    this.emitHud(true);
  }

  public toggleCloseupCamera(): void {
    if (this.activeVehicle) {
      this.cameraMode = this.cameraMode === 'cockpit' ? 'chase' : 'cockpit';
      this.audio.setInteriorMuffled(this.cameraMode === 'cockpit');
    } else {
      this.cameraMode = this.cameraMode === 'closeup' ? 'chase' : 'closeup';
      this.camYawOffset = this.cameraMode === 'closeup' ? Math.PI : 0;
      this.showToast(this.cameraMode === 'closeup' ? 'Close-Up Face Inspection Camera' : 'Third-Person Camera');
    }
    this.emitHud(true);
  }

  public startGame(): void {
    this.started = true;
    this.paused = false;
    this.audio.unlock();
    this.audio.setSettings(this.settings.sfxOn, this.settings.radioOn);
    const ui = getUiStrings(this.settings.language);
    this.showToast(ui.welcomeToast);
    this.emitHud(true);
  }

  public setPhoneOpen(open: boolean): void {
    this.phoneOpen = open;
    this.emitHud(true);
  }

  public setPaused(p: boolean): void {
    this.paused = p;
    if (p) {
      this.keys.clear();
      this.isBlocking = false;
    }
  }

  public selectWeapon(w: WeaponKind): void {
    this.weapon = w;
    this.emitHud(true);
  }

  public triggerKick(): void {
    if (!this.started || this.paused || this.activeVehicle || this.kickTimer > 0) return;
    if (this.stamina < 8) return;
    this.stamina = Math.max(0, this.stamina - 8);
    this.kickTimer = 0.36;
    this.audio.playActionPulse(false);
    this.applyMeleeHit(2.5, true);
  }

  public triggerDodge(): void {
    if (!this.started || this.paused || this.activeVehicle || this.dodgeTimer > 0) return;
    if (this.stamina < 14) return;
    this.stamina = Math.max(0, this.stamina - 14);
    this.dodgeTimer = 0.42;
    this.audio.playFootstep(false);
  }

  private applyMeleeHit(range: number, isHeavy: boolean): void {
    const px = this.playerX;
    const pz = this.playerZ;
    for (const npc of this.npcs) {
      const d = Math.hypot(npc.x - px, npc.z - pz);
      if (d < range && npc.knockdownTimer <= 0) {
        if (isHeavy) {
          npc.knockdownTimer = 3.2;
          npc.hitReactTimer = 0;
        } else {
          npc.hitReactTimer = 0.65;
        }
        npc.expression = 'fear';
        this.audio.playImpact(isHeavy ? 0.85 : 0.45);
        this.addWantedStars(1);
        break;
      }
    }
  }

  public triggerAction(): void {
    if (!this.started || this.paused || this.activeVehicle) return;
    if (this.weapon === 'unarmed' || this.weapon === 'baton') {
      if (this.stamina < 5) return;
      this.stamina = Math.max(0, this.stamina - 5);
      this.audio.playActionPulse(false);
      this.punchTimer = 0.28;
      this.applyMeleeHit(this.weapon === 'baton' ? 2.6 : 2.1, this.weapon === 'baton');
      return;
    }

    if (this.ammo <= 0) {
      this.showToast('Out of ammo! Visit Deccan Tactical Armory on Brigade Rd.');
      return;
    }
    this.ammo--;
    const isEmp = this.weapon === 'emp';
    this.audio.playActionPulse(isEmp);
    const orb = new THREE.Mesh(
      new THREE.SphereGeometry(isEmp ? 0.28 : 0.16, 8, 8),
      new THREE.MeshBasicMaterial({ color: isEmp ? 0x38bdf8 : 0xf59e0b })
    );
    const dirX = Math.sin(this.playerHeading);
    const dirZ = Math.cos(this.playerHeading);
    orb.position.set(this.playerX + dirX * 0.9, this.playerY + 1.35, this.playerZ + dirZ * 0.9);
    this.scene.add(orb);
    this.projectiles.push({ mesh: orb, vx: dirX * 48, vy: 0, vz: dirZ * 48, life: 1.2, isEmp });
    this.emitHud(false);
  }

  private handleInteractOrVehicle(): void {
    if (this.activeVehicle) {
      const v = this.activeVehicle;
      if (v === this.nammaYatriVehicle && this.nammaYatri.status === 'riding') {
        this.cleanupNammaYatriDriver();
        this.nammaYatri.status = 'idle';
        this.nammaYatriVehicle = null;
        v.isAi = true;
      }
      this.doorAnimTimers.set(v.id, 0.9);
      const fp = this.getVehicleFootprint(v.kind);
      const sideDist = fp.halfW + 1.25;
      const exitAngles = [v.heading + Math.PI * 0.5, v.heading - Math.PI * 0.5, v.heading + Math.PI];
      let chosenX = v.x + Math.sin(exitAngles[0]) * sideDist;
      let chosenZ = v.z + Math.cos(exitAngles[0]) * sideDist;
      let chosenY = getFlyoverDeckY(chosenX, chosenZ);
      let bestPenalty = Infinity;
      for (const ang of exitAngles) {
        const cx = v.x + Math.sin(ang) * sideDist;
        const cz = v.z + Math.cos(ang) * sideDist;
        const [rx, rz] = this.resolveBuildingCollision(cx, cz, 0.55, v.y);
        const cy = getFlyoverDeckY(rx, rz);
        const water = isPointInWater(rx, rz);
        const pen = Math.hypot(rx - cx, rz - cz) * 10 + (water ? 50 : 0) + (Math.abs(cy - v.y) > 2.5 ? 100 : 0);
        if (pen < bestPenalty) {
          bestPenalty = pen;
          chosenX = rx;
          chosenZ = rz;
          chosenY = cy;
        }
      }
      this.playerX = chosenX;
      this.playerZ = chosenZ;
      this.playerY = chosenY;
      this.playerHeading = v.heading;
      if (v.rig.riderGroup) v.rig.riderGroup.visible = false;
      this.activeVehicle = null;
      this.isSitting = false;
      if (this.cameraMode === 'cockpit') this.cameraMode = 'chase';
      this.audio.setInteriorMuffled(false);
      this.playerRig.group.visible = true;
      this.emitHud(true);
      return;
    }

    if (this.isSitting) {
      this.isSitting = false;
      this.showToast('Stood up.');
      this.emitHud(true);
      return;
    }

    // 1. Inside 3D Metro Station / Train Cabin Interactions
    if (this.metroJourney.phase !== 'none') {
      if (this.metroJourney.phase === 'riding' || this.metroJourney.phase === 'arrived') {
        const leaveTrig = this.metroSim.triggers.find(
          (t) => t.id === 'leave_train' && Math.hypot(this.playerX - t.x, this.playerZ - t.z) < t.radius
        );
        if (leaveTrig) {
          if (this.metroJourney.phase === 'arrived') {
            this.alightToPlatform();
          } else {
            this.showToast(`Train in motion — ${this.metroJourney.stopsRemaining} stop(s) remaining.`);
          }
          return;
        }
        const paxPrompt = this.metroSim.getNearestPassengerPrompt(this.playerX, this.playerZ);
        if (paxPrompt) {
          this.talkToMetroPassenger();
          return;
        }
        const seatTrig = this.metroSim.triggers.find(
          (t) => t.id === 'train_seat' && Math.hypot(this.playerX - t.x, this.playerZ - t.z) < t.radius
        );
        if (seatTrig) {
          this.isSitting = !this.isSitting;
          this.holdingRail = false;
          this.metroJourney.holdingRail = false;
          const onRight = seatTrig.x > this.metroSim.trainCabinSpawn.x;
          this.playerX = seatTrig.x + (onRight ? 0.24 : -0.24);
          this.playerZ = seatTrig.z;
          this.playerHeading = onRight ? -Math.PI * 0.5 : Math.PI * 0.5;
          this.showToast(this.isSitting ? 'Seated inside Namma Metro coach.' : 'Stood up.');
          this.emitHud(true);
          return;
        }
        const railTrig = this.metroSim.triggers.find(
          (t) => t.id === 'hold_rail' && Math.hypot(this.playerX - t.x, this.playerZ - t.z) < t.radius
        );
        if (railTrig) {
          this.toggleHoldRail();
          return;
        }
        if (this.metroJourney.phase === 'arrived') {
          this.alightToPlatform();
        }
        return;
      }

      let bestTrig: (typeof this.metroSim.triggers)[number] | null = null;
      let bestDist = Infinity;
      for (const trig of this.metroSim.triggers) {
        const d = Math.hypot(this.playerX - trig.x, this.playerZ - trig.z);
        const yOk = trig.id === 'use_elevator_cab' || Math.abs(this.playerY - trig.y) < 2.3;
        if (d < trig.radius && yOk && d < bestDist) {
          bestDist = d;
          bestTrig = trig;
        }
      }

      // Platform fail-safe: if standing near train doors while doors are open, board immediately
      if (
        (!bestTrig || bestTrig.id === 'board_train') &&
        this.metroJourney.phase === 'platform' &&
        this.trainPhase === 'boarding' &&
        this.playerZ < -1236
      ) {
        this.boardMetroTrain();
        return;
      }

      if (bestTrig) {
        if (bestTrig.id === 'exit_station') {
          this.exitMetroJourney();
          return;
        }
        if (bestTrig.id === 'ticket_counter') {
          const sameLine = METRO_STATIONS.filter(
            (s) => s.line === this.metroJourney.line && s.status === 'operational'
          ).sort((a, b) => a.order - b.order);
          const curIdx = sameLine.findIndex((s) => s.id === this.metroJourney.stationId);
          const nextSt = sameLine[(curIdx + 1) % sameLine.length];
          if (nextSt) this.buyMetroTicket(this.metroJourney.stationId, nextSt.id);
          return;
        }
        if (bestTrig.id === 'tvm_kiosk') {
          this.openTvmModal();
          return;
        }
        if (bestTrig.id === 'smart_card_kiosk') {
          this.openSmartCardModal();
          return;
        }
        if (bestTrig.id === 'security_scan') {
          this.scanSecurityGate();
          return;
        }
        if (bestTrig.id === 'qr_gate') {
          this.scanQrGate();
          return;
        }
        if (bestTrig.id === 'exit_gate') {
          this.scanExitGate();
          return;
        }
        if (bestTrig.id === 'call_elevator_concourse') {
          if (Math.abs(this.elevatorY - -140) < 0.15) {
            this.elevatorDoorOpen = 1;
            this.showToast('Elevator at Concourse — step inside & press F to ride to Platform.');
          } else {
            this.elevatorTargetY = -140;
            this.metroJourney.elevatorMoving = true;
            this.showToast('Calling Glass Elevator down to Concourse...');
          }
          this.emitHud(true);
          return;
        }
        if (bestTrig.id === 'call_elevator_platform') {
          if (Math.abs(this.elevatorY - -135.2) < 0.15) {
            this.elevatorDoorOpen = 1;
            this.showToast('Elevator at Platform — step inside & press F to ride to Concourse.');
          } else {
            this.elevatorTargetY = -135.2;
            this.metroJourney.elevatorMoving = true;
            this.showToast('Calling Glass Elevator up to Platform...');
          }
          this.emitHud(true);
          return;
        }
        if (bestTrig.id === 'use_elevator_cab') {
          if (this.metroJourney.elevatorMoving) {
            this.showToast('Elevator in motion — wait for doors to open.');
            return;
          }
          const goingUp = this.elevatorY < -137.5;
          this.elevatorTargetY = goingUp ? -135.2 : -140;
          this.metroJourney.elevatorMoving = true;
          this.audio.playMetroChime();
          this.showToast(goingUp ? 'Elevator ascending to Platform...' : 'Elevator descending to Concourse...');
          this.emitHud(true);
          return;
        }
        if (bestTrig.id === 'board_train') {
          this.boardMetroTrain();
          return;
        }
      }
      return;
    }

    // 2. Inside Walkable 3D Interior Interactions (Homes, Namma Mart, Armory, Gym)
    if (this.activeInterior) {
      const pocket = this.interiors.pockets[this.activeInterior];
      for (const trig of pocket.triggers) {
        const d = Math.hypot(this.playerX - trig.x, this.playerZ - trig.z);
        if (d < trig.radius) {
          if (trig.id === 'exit_door') {
            if (this.activeInterior === 'police_jail' && (this.arrestStage === 'booking_jail' || this.wantedStars > 0)) {
              this.interiorAction = 'jail_booking';
              this.showToast('Complete Police Booking (Pay Bail or Serve Sentence) before leaving!');
            } else {
              this.exitInterior();
            }
          } else if (trig.id === 'jail_booking') {
            this.interiorAction = 'jail_booking';
          } else if (trig.id === 'sofa') {
            this.isSitting = true;
            this.playerX = trig.x;
            this.playerZ = trig.z + 0.5;
            this.playerHeading = Math.PI;
            this.showToast('Relaxing on sofa. Press F or move to stand.');
          } else if (trig.id === 'tv') {
            this.interiorAction = 'tv';
            this.tvState.on = true;
            this.interiors.updateHomeVisuals(
              this.activeInterior,
              this.homeLightsOn,
              this.homeCurtainsOpen,
              this.tvState.on,
              this.tvState.channel
            );
          } else if (trig.id === 'bed') {
            this.health = this.maxHealth;
            this.armor = this.maxArmor;
            this.stamina = 100;
            if (this.settings.timePreset === 'auto') {
              this.timeOfDayHours = (this.timeOfDayHours + 6) % 24;
            }
            this.saveGameSlot(1);
            this.audio.playPickup();
            this.showToast('Slept & rested (+100% Health, Armor, Stamina · Auto-Saved Slot 1).');
          } else if (trig.id === 'lights') {
            this.toggleHomeLights();
          } else if (trig.id === 'curtains') {
            this.toggleHomeCurtains();
          } else if (trig.id === 'kitchen') {
            this.interiorAction = 'pantry';
          } else if (trig.id === 'shower') {
            this.stamina = 100;
            this.health = Math.min(this.maxHealth, this.health + 15);
            this.audio.playPickup();
            this.showToast('Refreshed after shower! (+100% Stamina, +15 Health)');
          } else if (trig.id === 'shelf' || trig.id === 'checkout') {
            this.interiorAction = 'mart';
          } else if (trig.id === 'armory_counter') {
            this.interiorAction = 'armory';
          } else if (trig.id === 'gym_workout') {
            this.stamina = 100;
            this.maxArmor = Math.min(140, this.maxArmor + 5);
            this.armor = Math.min(this.maxArmor, this.armor + 25);
            this.health = Math.min(this.maxHealth, this.health + 15);
            this.audio.playPickup();
            this.showToast('Bengaluru Gym Workout complete! (+Max Armor, +Stamina)');
          }
          this.emitHud(true);
          return;
        }
      }
      return;
    }

    // 3. Exterior Landmark Markers (Safehouses, Petrol Pumps, Darshinis, ATMs, Benches, Enterable Interiors)
    for (const lm of LANDMARK_MARKERS) {
      if (Math.hypot(this.playerX - lm.x, this.playerZ - lm.z) < 7.5) {
        if (lm.type === 'interior' && lm.interiorId) {
          this.enterInterior(lm.interiorId);
          return;
        }
        if (lm.type === 'safehouse') {
          this.health = this.maxHealth;
          this.armor = this.maxArmor;
          this.stamina = 100;
          this.wantedStars = 0;
          this.wantedCooldown = 0;
          this.isEvading = false;
          this.audio.playPickup();
          this.showToast('Indiranagar Safehouse: Health & Armor restored, heat cleared.');
          this.emitHud(true);
          return;
        }
        if (lm.type === 'petrol') {
          this.audio.playPickup();
          this.repairNearestVehicle();
          return;
        }
        if (lm.type === 'darshini') {
          if (this.cash >= 80) {
            this.cash -= 80;
            this.eatTimer = 1.6;
            this.health = Math.min(this.maxHealth, this.health + 40);
            this.stamina = Math.min(100, this.stamina + 35);
            this.audio.playPickup();
            this.showToast(`${lm.name}: Masala Dosa & Filter Kaapi! (+40 HP, -₹80)`);
          } else {
            this.showToast('Not enough cash for tiffin (₹80 needed).');
          }
          this.emitHud(true);
          return;
        }
        if (lm.type === 'atm') {
          if (this.bankBalance >= 2500) {
            this.bankBalance -= 2500;
            this.cash += 2500;
            this.addBankTransaction('Brigade ATM Withdrawal', -2500);
            this.audio.playPickup();
            this.showToast('Brigade ATM: Withdrew ₹2,500.');
          } else {
            this.cash += 2500;
            this.showToast('Emergency ATM Credit: +₹2,500.');
          }
          this.emitHud(true);
          return;
        }
        if (lm.type === 'bench') {
          this.isSitting = true;
          this.playerX = lm.x;
          this.playerZ = lm.z;
          this.showToast(`Sitting on ${lm.name}. Press F or move to stand.`);
          this.emitHud(true);
          return;
        }
      }
    }

    if (!this.activeMission) {
      for (const m of MISSIONS) {
        if (Math.hypot(this.playerX - m.startX, this.playerZ - m.startZ) < 10) {
          this.startMission(m.id);
          return;
        }
      }
    }

    // 4. Walkable Namma Metro Station Entry & Rail/Bus Hubs
    for (const ms of METRO_STATIONS) {
      if (Math.hypot(this.playerX - ms.x, this.playerZ - ms.z) < 11) {
        if (ms.status === 'under_construction') {
          this.showToast(`${ms.name} (${ms.line.toUpperCase()} Line) is under construction — boarding closed.`);
          this.emitHud(true);
          return;
        }
        this.enterMetroStation(ms.id);
        return;
      }
    }

    for (const rb of RAIL_BUS_STATIONS) {
      if (Math.hypot(this.playerX - rb.x, this.playerZ - rb.z) < 13) {
        const sameKind = RAIL_BUS_STATIONS.filter((s) => s.kind === rb.kind);
        const idx = sameKind.findIndex((s) => s.id === rb.id);
        const nextHub = sameKind[(idx + 1) % sameKind.length];
        if (nextHub && nextHub.id !== rb.id) {
          const route = this.planRoute(nextHub.x, nextHub.z, nextHub.name, rb.kind);
          this.travelRoute(route);
        }
        return;
      }
    }

    // 5. Board Namma Yatri Ride (Passenger Seat + Visible Driver) or Nearest Vehicle
    if (
      this.nammaYatriVehicle &&
      this.nammaYatri.status === 'waiting_pickup' &&
      Math.hypot(this.nammaYatriVehicle.x - this.playerX, this.nammaYatriVehicle.z - this.playerZ) < 7.5
    ) {
      const nv = this.nammaYatriVehicle;
      this.activeVehicle = nv;
      nv.isAi = false;
      this.doorAnimTimers.set(nv.id, 0.9);
      this.nammaYatri.status = 'riding';
      this.nammaYatriWaypoints = this.router.findRoadWaypoints(
        nv.x,
        nv.z,
        this.nammaYatri.destX,
        this.nammaYatri.destZ
      );
      this.nammaYatriWpIdx = 0;
      this.isCrouching = false;
      this.isSwimming = false;
      this.isSitting = true;
      this.isBlocking = false;
      this.playerRig.group.visible = true; // Player sits visibly in rear passenger seat!
      this.audio.playHorn(nv.kind);
      this.showToast(`Seated in Namma Yatri passenger seat → ${this.nammaYatri.destName}...`);
      this.emitHud(true);
      return;
    }

    let closest: SimVehicle | null = null;
    let bestD = 5.8;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.x - this.playerX, v.z - this.playerZ);
      if (d < bestD) {
        bestD = d;
        closest = v;
      }
    }
    if (closest) {
      this.enterVehicle(closest);
    }
  }

  private enterVehicle(v: SimVehicle): void {
    this.activeVehicle = v;
    v.isAi = false;
    v.disabledTimer = 0;
    this.doorAnimTimers.set(v.id, 0.9);
    if (v.rig.riderGroup) v.rig.riderGroup.visible = true;
    this.playerRig.group.visible = false;
    this.isCrouching = false;
    this.isSwimming = false;
    this.isSitting = false;
    this.isBlocking = false;
    if (this.cameraMode === 'closeup') this.cameraMode = 'chase';
    this.camYawOffset = 0;
    this.audio.setInteriorMuffled(this.cameraMode === 'cockpit');
    this.audio.playHorn(v.kind);
    if (v.isPolice && this.wantedStars < 2) {
      this.addWantedStars(2);
    }
    this.emitHud(true);
  }

  public startMission(missionId: string): void {
    const def = MISSIONS.find((m) => m.id === missionId);
    if (!def) return;

    this.studioActive = false;
    this.activeMission = {
      def,
      timeRemaining: def.timeLimitSec ?? null,
      checkpointIndex: 0,
      evadeTimer: 0,
    };

    if (Math.hypot(this.playerX - def.startX, this.playerZ - def.startZ) > 35) {
      if (this.activeVehicle) {
        this.activeVehicle.x = def.startX;
        this.activeVehicle.z = def.startZ;
        this.activeVehicle.y = getFlyoverDeckY(def.startX, def.startZ);
        this.activeVehicle.speed = 0;
      } else {
        this.playerX = def.startX;
        this.playerZ = def.startZ;
        this.playerY = getFlyoverDeckY(def.startX, def.startZ);
      }
    }

    if (def.recommendedVehicle && !this.activeVehicle) {
      const spawned = this.spawnVehicle(
        def.recommendedVehicle,
        def.startX + 4,
        def.startZ + 4,
        Math.PI * 0.5,
        false,
        false,
        def.recommendedVehicle === 'coupe' ? this.vehicleTuning.color : undefined
      );
      this.enterVehicle(spawned);
    }

    if (def.wantedStars) this.addWantedStars(def.wantedStars);
    else {
      this.wantedStars = 0;
      this.isEvading = false;
    }

    if (def.forceTime === 'night') this.timeOfDayHours = 22.5;
    this.showToast(`Mission Started: ${def.title}`);
    this.emitHud(true);
  }

  public cancelMission(): void {
    if (!this.activeMission) return;
    this.activeMission = null;
    this.world.missionBeacon.visible = false;
    this.showToast('Mission cancelled.');
    this.emitHud(true);
  }

  public setCustomWaypoint(x: number, z: number, label = 'Custom GPS Pin'): void {
    this.waypoint = { x, z, label };
    this.showToast(`GPS Route set to ${label}`);
    this.emitHud(true);
  }

  public clearWaypoint(): void {
    this.waypoint = null;
    this.activeRoute = null;
    this.world.navigationLine.visible = false;
    this.emitHud(true);
  }

  public planRoute(
    targetX: number,
    targetZ: number,
    destinationName: string,
    mode: TransportMode
  ): NavigationRoute {
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    return this.router.planRoute(
      px,
      pz,
      targetX,
      targetZ,
      destinationName,
      mode,
      METRO_STATIONS,
      RAIL_BUS_STATIONS
    );
  }

  public startNavigation(route: NavigationRoute): void {
    this.activeRoute = route;
    this.waypoint = { x: route.targetX, z: route.targetZ, label: route.destinationName };
    const pts = route.pathPoints.map((pt) => new THREE.Vector3(pt.x, getFlyoverDeckY(pt.x, pt.z) + 0.55, pt.z));
    if (pts.length >= 2) {
      this.world.navigationLine.geometry.dispose();
      this.world.navigationLine.geometry = new THREE.BufferGeometry().setFromPoints(pts);
      this.world.navigationLine.visible = true;
    }
    this.showToast(`GPS Active: ${route.summary} (${route.distanceKm.toFixed(1)} km · ~${route.etaMinutes} min)`);
    this.emitHud(true);
  }

  public cancelNavigation(): void {
    this.activeRoute = null;
    this.waypoint = null;
    this.world.navigationLine.visible = false;
    this.emitHud(true);
  }

  public travelRoute(route: NavigationRoute): void {
    const fare =
      route.mode === 'metro'
        ? 40
        : route.mode === 'rail'
        ? 35
        : route.mode === 'bus'
        ? 30
        : route.mode === 'auto'
        ? 120
        : 0;
    if (fare > 0 && this.cash < fare) {
      this.showToast(`Insufficient cash (₹${fare} required for ${route.mode.toUpperCase()}).`);
      return;
    }
    this.cash -= fare;

    if ((route.mode === 'metro' || route.mode === 'rail' || route.mode === 'bus') && this.activeVehicle) {
      const v = this.activeVehicle;
      v.isAi = false;
      if (v.rig.riderGroup) v.rig.riderGroup.visible = false;
      this.activeVehicle = null;
      if (this.cameraMode === 'cockpit') this.cameraMode = 'chase';
      this.audio.setInteriorMuffled(false);
      this.playerRig.group.visible = true;
    }

    const ty = getFlyoverDeckY(route.targetX, route.targetZ);
    if (this.activeVehicle) {
      this.activeVehicle.x = route.targetX;
      this.activeVehicle.z = route.targetZ;
      this.activeVehicle.y = ty;
      this.activeVehicle.speed = 0;
    }
    this.playerX = route.targetX;
    this.playerZ = route.targetZ;
    this.playerY = ty;
    this.studioActive = false;

    const destDistrict = getDistrictAt(route.targetX, route.targetZ);
    this.discoveredDistricts.add(destDistrict.id);
    this.timeOfDayHours = (this.timeOfDayHours + Math.min(2.0, route.etaMinutes / 60)) % 24;
    this.activeRoute = null;
    this.waypoint = null;
    this.world.navigationLine.visible = false;
    this.audio.playPickup();
    this.showToast(
      `Arrived at ${route.destinationName} via ${route.mode.toUpperCase()} (${route.distanceKm.toFixed(1)} km${
        fare > 0 ? ` · -₹${fare}` : ''
      })`
    );
    this.emitHud(true);
  }

  public importCustomGeoJson(rawJson: string): {
    ok: boolean;
    roadsAdded: number;
    features: number;
    message: string;
  } {
    const fc = this.geoImporter.parseJsonString(rawJson);
    if (!fc) {
      return { ok: false, roadsAdded: 0, features: 0, message: 'Invalid GeoJSON FeatureCollection JSON.' };
    }
    const imported = this.geoImporter.importGeoJson(fc);
    if (imported.roads.length === 0 && imported.featureCount === 0) {
      return { ok: false, roadsAdded: 0, features: 0, message: 'No LineString/Polygon features found.' };
    }
    this.customRoads = [...this.customRoads, ...imported.roads];
    this.router.rebuild([...ROAD_SEGMENTS, ...this.customRoads]);
    this.world.rebuildCustomRoads(this.customRoads);
    this.world.partition.setImportCounts(
      ROAD_SEGMENTS.length + this.customRoads.length,
      INITIAL_OSM_IMPORT.featureCount + imported.featureCount
    );
    this.showToast(`Imported ${imported.roads.length} OSM road(s) into World Partition.`);
    this.emitHud(true);
    return {
      ok: true,
      roadsAdded: imported.roads.length,
      features: imported.featureCount,
      message: `Converted ${imported.featureCount} WGS84 features → ${imported.roads.length} 3D corridors.`,
    };
  }

  public getAllRoads(): RoadSegment[] {
    return [...ROAD_SEGMENTS, ...this.customRoads];
  }

  public teleportToDistrict(districtId: DistrictId): void {
    const d = DISTRICTS.find((item) => item.id === districtId);
    if (!d) return;
    const tx = d.x + 8;
    const tz = d.z + 8;
    const ty = getFlyoverDeckY(tx, tz);
    if (this.activeVehicle) {
      this.activeVehicle.x = tx;
      this.activeVehicle.z = tz;
      this.activeVehicle.y = ty;
      this.activeVehicle.speed = 0;
    } else {
      this.playerX = tx;
      this.playerZ = tz;
      this.playerY = ty;
    }
    this.discoveredDistricts.add(d.id);
    this.showToast(`Fast traveled to ${d.name} (${d.lat.toFixed(4)}°N, ${d.lon.toFixed(4)}°E)`);
    this.emitHud(true);
  }

  public applyCustomization(custom: PlayerCustomization): void {
    this.playerCustom = { ...custom };
    const profile = PROTAGONIST_PRESETS[custom.protagonistId] || PROTAGONIST_PRESETS.arjun;
    this.playerRig = rebuildPlayerCustomization(this.playerRig, this.playerCustom, this.textures, profile);
    this.showToast('Character appearance & Chaos Cloth wardrobe updated.');
    this.emitHud(true);
  }

  public getCustomization(): PlayerCustomization {
    return { ...this.playerCustom };
  }

  public applyVehicleTuning(tuning: VehicleTuning): void {
    this.vehicleTuning = { ...tuning };
    if (this.activeVehicle) {
      (this.activeVehicle.rig.bodyMesh.material as THREE.MeshPhysicalMaterial).color.set(tuning.color);
      this.activeVehicle.health = this.activeVehicle.maxHealth;
    }
    this.showToast('Garage modifications applied!');
    this.emitHud(true);
  }

  public getVehicleTuning(): VehicleTuning {
    return { ...this.vehicleTuning };
  }

  public spawnGarageVehicle(kind: VehicleKind): void {
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    if (this.activeVehicle) {
      this.activeVehicle.isAi = false;
      if (this.activeVehicle.rig.riderGroup) this.activeVehicle.rig.riderGroup.visible = false;
      this.activeVehicle = null;
    }
    const v = this.spawnVehicle(
      kind,
      px,
      pz,
      this.playerHeading,
      false,
      false,
      kind === 'coupe' ? this.vehicleTuning.color : undefined
    );
    this.enterVehicle(v);
    this.showToast(`Delivered ${VEHICLE_SPECS[kind].label}`);
  }

  public repairNearestVehicle(): void {
    let target = this.activeVehicle;
    if (!target) {
      let best = Infinity;
      for (const v of this.vehicles) {
        const d = Math.hypot(v.x - this.playerX, v.z - this.playerZ);
        if (d < best) {
          best = d;
          target = v;
        }
      }
    }
    if (target) {
      target.health = target.maxHealth;
      target.fuel = 100;
      this.showToast(`${VEHICLE_SPECS[target.kind].label} repaired & refueled to 100%.`);
      this.emitHud(true);
    }
  }

  // === Walkable 3D Interiors, TV, Grocery, Pantry, Armory & Properties ===
  public enterInterior(id: InteriorId): void {
    const lm = LANDMARK_MARKERS.find((l) => l.interiorId === id);
    if (lm?.price && lm.price > 0 && !this.ownedProperties.includes(id)) {
      this.showToast(`Property locked (${lm.name} — ₹${lm.price.toLocaleString()}). Purchase in Phone -> Homes!`);
      return;
    }
    const pocket = this.interiors.pockets[id];
    if (!pocket) return;
    if (this.activeVehicle) this.handleInteractOrVehicle();
    this.interiorReturnPos.set(this.playerX, this.playerY, this.playerZ);
    this.activeInterior = id;
    this.interiorAction = null;
    this.playerX = pocket.spawn.x;
    this.playerY = pocket.floorY;
    this.playerZ = pocket.spawn.z;
    this.playerHeading = Math.PI;
    this.currentCamPos.set(this.playerX, this.playerY + 2.4, this.playerZ + 4.2);
    this.currentLookAt.set(this.playerX, this.playerY + 1.4, this.playerZ - 2);
    this.interiors.updateHomeVisuals(id, this.homeLightsOn, this.homeCurtainsOpen, this.tvState.on, this.tvState.channel);
    this.audio.setInteriorMuffled(true);
    this.showToast(`Entered ${lm?.name ?? id}. Walk around & press F on objects.`);
    this.emitHud(true);
  }

  public exitInterior(): void {
    if (!this.activeInterior) return;
    this.activeInterior = null;
    this.interiorAction = null;
    this.isSitting = false;
    this.playerX = this.interiorReturnPos.x;
    this.playerY = this.interiorReturnPos.y;
    this.playerZ = this.interiorReturnPos.z;
    this.currentCamPos.set(this.playerX - 4, this.playerY + 3, this.playerZ + 8);
    this.audio.setInteriorMuffled(false);
    this.showToast('Stepped outside to Bengaluru street.');
    this.emitHud(true);
  }

  public clearInteriorAction(): void {
    this.interiorAction = null;
    this.emitHud(true);
  }

  public setTvState(on: boolean, channel: number): void {
    this.tvState = { on, channel };
    this.interiors.updateHomeVisuals(
      this.activeInterior,
      this.homeLightsOn,
      this.homeCurtainsOpen,
      on,
      channel
    );
    const ch = TV_CHANNELS.find((c) => c.channel === channel);
    if (on && ch) this.showToast(`TV Channel ${ch.channel}: ${ch.name}`);
    this.emitHud(true);
  }

  public toggleHomeLights(): void {
    this.homeLightsOn = !this.homeLightsOn;
    this.interiors.updateHomeVisuals(
      this.activeInterior,
      this.homeLightsOn,
      this.homeCurtainsOpen,
      this.tvState.on,
      this.tvState.channel
    );
    this.showToast(this.homeLightsOn ? 'Home Lights: ON' : 'Home Lights: DIMMED');
    this.emitHud(true);
  }

  public toggleHomeCurtains(): void {
    this.homeCurtainsOpen = !this.homeCurtainsOpen;
    this.interiors.updateHomeVisuals(
      this.activeInterior,
      this.homeLightsOn,
      this.homeCurtainsOpen,
      this.tvState.on,
      this.tvState.channel
    );
    this.showToast(this.homeCurtainsOpen ? 'Window Curtains: OPEN' : 'Window Curtains: CLOSED');
    this.emitHud(true);
  }

  public addToBasket(itemId: string, delta: number): void {
    const cur = this.groceryBasket[itemId] || 0;
    const next = Math.max(0, cur + delta);
    if (next === 0) {
      const copy = { ...this.groceryBasket };
      delete copy[itemId];
      this.groceryBasket = copy;
    } else {
      this.groceryBasket = { ...this.groceryBasket, [itemId]: next };
    }
    this.emitHud(true);
  }

  public checkoutGroceryBasket(): void {
    let total = 0;
    let count = 0;
    for (const [id, qty] of Object.entries(this.groceryBasket)) {
      const item = GROCERY_ITEMS.find((g) => g.id === id);
      if (item && qty > 0) {
        total += item.price * qty;
        count += qty;
      }
    }
    if (count === 0) {
      this.showToast('Basket is empty!');
      return;
    }
    if (this.cash < total && this.bankBalance < total) {
      this.showToast(`Need ₹${total} to complete Namma Mart checkout.`);
      return;
    }
    if (this.cash >= total) {
      this.cash -= total;
    } else {
      this.bankBalance -= total;
      this.addBankTransaction('Namma Mart Supermarket UPI', -total);
    }
    const nextPantry = { ...this.pantryItems };
    for (const [id, qty] of Object.entries(this.groceryBasket)) {
      nextPantry[id] = (nextPantry[id] || 0) + qty;
    }
    this.pantryItems = nextPantry;
    this.groceryBasket = {};
    this.interiorAction = null;
    this.audio.playPickup();
    this.showToast(`Purchased ${count} item(s) at Namma Mart (-₹${total})! Stored in Home Pantry.`);
    this.emitHud(true);
  }

  public eatFromPantry(itemId: string): void {
    const qty = this.pantryItems[itemId] || 0;
    const item = GROCERY_ITEMS.find((g) => g.id === itemId);
    if (!item || qty <= 0) return;
    const next = { ...this.pantryItems, [itemId]: qty - 1 };
    if (next[itemId] <= 0) delete next[itemId];
    this.pantryItems = next;
    this.eatTimer = 1.8;
    this.health = Math.min(this.maxHealth, this.health + item.healthRestore);
    this.stamina = Math.min(100, this.stamina + 25);
    this.audio.playPickup();
    this.showToast(`Enjoyed ${item.name} (+${item.healthRestore} Health)!`);
    this.emitHud(true);
  }

  public buyWeaponFromArmory(weaponId: WeaponKind): void {
    const item = WEAPONS_CATALOG.find((w) => w.id === weaponId);
    if (!item) return;
    if (this.cash < item.price && this.bankBalance < item.price) {
      this.showToast(`Insufficient funds (₹${item.price.toLocaleString()} required).`);
      return;
    }
    if (this.cash >= item.price) this.cash -= item.price;
    else {
      this.bankBalance -= item.price;
      this.addBankTransaction(`Deccan Armory: ${item.name}`, -item.price);
    }
    this.weapon = weaponId;
    this.ammo += item.ammoGrant;
    this.armor = this.maxArmor;
    this.audio.playPickup();
    this.showToast(`Equipped ${item.name} (+${item.ammoGrant} ammo, Armor 100%)!`);
    this.emitHud(true);
  }

  public buyProperty(id: InteriorId): void {
    if (this.ownedProperties.includes(id)) {
      this.showToast('You already own this Bengaluru property!');
      return;
    }
    const lm = LANDMARK_MARKERS.find((l) => l.interiorId === id);
    const price = lm?.price ?? 85000;
    const totalFunds = this.cash + this.bankBalance;
    if (totalFunds < price) {
      this.showToast(`Need ₹${price.toLocaleString()} to purchase ${lm?.name ?? id}.`);
      return;
    }
    if (this.bankBalance >= price) {
      this.bankBalance -= price;
      this.addBankTransaction(`Property Deed: ${lm?.name ?? id}`, -price);
    } else {
      const rem = price - this.bankBalance;
      if (this.bankBalance > 0) this.addBankTransaction(`Property Deed: ${lm?.name ?? id}`, -this.bankBalance);
      this.bankBalance = 0;
      this.cash -= rem;
    }
    this.ownedProperties = [...this.ownedProperties, id];
    this.audio.playPickup();
    this.showToast(`Congratulations! Purchased ${lm?.name ?? id}.`);
    this.emitHud(true);
  }

  // === Walkable 3D Namma Metro Station & Train Ride ===
  public enterMetroStation(stationId: string): void {
    const st = METRO_STATIONS.find((s) => s.id === stationId);
    if (!st || st.status === 'under_construction') return;
    if (this.activeVehicle) this.handleInteractOrVehicle();
    this.metroReturnPos.set(this.playerX, this.playerY, this.playerZ);
    const validTicket = this.metroTickets.find((t) => !t.used && (t.fromId === st.id || t.line === st.line));
    const ui = getUiStrings(this.settings.language);

    this.elevatorY = -140;
    this.elevatorTargetY = -140;
    this.elevatorDoorOpen = 1;
    this.trainPhase = 'approaching';
    this.trainDoorOpen = 0;
    this.trainPhaseTimer = 0;
    this.metroRouteIds = [];
    this.boardingTransition = false;
    this.boardingTimer = 0;
    this.coachDoorOpen = 0;
    this.trainStopPauseTimer = 0;
    this.lastAnnouncedHop = -1;
    this.holdingRail = false;
    this.securityCleared = false;
    this.exitGateCleared = true;
    this.hasRiddenMetro = false;
    this.metroFarePaid = 0;

    this.metroSim.configureStation(
      st.line,
      st.name,
      st.kannadaName,
      st.elevated,
      Boolean(st.interchangeWith?.length)
    );

    this.metroJourney = {
      phase: 'concourse',
      stationId: st.id,
      stationName: st.name,
      stationKannada: st.kannadaName,
      line: st.line,
      elevatedStation: st.elevated,
      destinationId: validTicket?.toId ?? null,
      destinationName: validTicket?.toName ?? null,
      interchangeStationName: st.interchangeWith?.length ? st.name : null,
      routeLineSequence: [st.line],
      stopsRemaining: 0,
      trainWaitSec: 5.5,
      trainPhase: 'approaching',
      trainDoorOpen: 0,
      trainSpeedKmh: 0,
      trainCameraMode: 'interior',
      holdingRail: false,
      boardingTransition: false,
      passengerCount: this.metroSim.passengerCount,
      activeDoorSide: 'left',
      elevatorFloor: 'concourse',
      elevatorMoving: false,
      onEscalator: null,
      rideProgress: 0,
      gateUnlocked: false,
      securityCleared: false,
      smartCardOwned: this.smartCardOwned,
      smartCardBalance: this.smartCardBalance,
      exitGateCleared: true,
      coachCount: this.metroSim.coachCount,
      activeCoachIndex: 2,
      farePaid: 0,
      announcement: ui.metroWelcome(st.kannadaName, st.name),
    };
    this.playerX = this.metroSim.concourseSpawn.x;
    this.playerY = this.metroSim.concourseSpawn.y;
    this.playerZ = this.metroSim.concourseSpawn.z;
    this.playerHeading = Math.PI;
    this.currentCamPos.set(this.playerX, this.playerY + 2.1, this.playerZ + 3.4);
    this.currentLookAt.set(this.playerX, this.playerY + 1.45, this.playerZ - 6);
    this.audio.setInteriorMuffled(true);
    this.audio.playMetroChime();
    speakKannadaOrEnglish(this.metroJourney.announcement, this.settings.language);
    this.emitHud(true);
  }

  public openTvmModal(): void {
    this.interiorAction = 'tvm';
    this.emitHud(true);
  }

  public openSmartCardModal(): void {
    this.interiorAction = 'smart_card';
    this.emitHud(true);
  }

  public buySmartCard(): void {
    if (this.smartCardOwned) {
      this.showToast('You already own a Namma Metro Smart Card! Use Recharge to add balance.');
      return;
    }
    const cost = 100;
    if (this.cash < cost && this.bankBalance < cost) {
      this.showToast('Need ₹100 (Cash or UPI) to issue a Namma Metro Smart Card.');
      return;
    }
    if (this.cash >= cost) this.cash -= cost;
    else {
      this.bankBalance -= cost;
      this.addBankTransaction('Namma Metro Smart Card Issue', -cost);
    }
    this.smartCardOwned = true;
    this.smartCardBalance += 100;
    this.metroJourney.smartCardOwned = true;
    this.metroJourney.smartCardBalance = this.smartCardBalance;
    this.audio.playPickup();
    this.showToast('Namma Metro Smart Card issued! Loaded ₹100 balance (5% discount per ride).');
    this.emitHud(true);
  }

  public topUpSmartCard(amount: number): void {
    if (!this.smartCardOwned) {
      this.buySmartCard();
      return;
    }
    const amt = Math.max(50, Math.round(amount));
    if (this.cash < amt && this.bankBalance < amt) {
      this.showToast(`Insufficient funds to recharge ₹${amt}.`);
      return;
    }
    if (this.cash >= amt) this.cash -= amt;
    else {
      this.bankBalance -= amt;
      this.addBankTransaction('Namma Metro Smart Card Top-Up', -amt);
    }
    this.smartCardBalance += amt;
    this.metroJourney.smartCardBalance = this.smartCardBalance;
    this.audio.playPickup();
    this.showToast(`Smart Card recharged +₹${amt}! Balance: ₹${this.smartCardBalance}.`);
    this.emitHud(true);
  }

  public scanSecurityGate(): void {
    if (this.metroJourney.phase === 'none') return;
    this.securityCleared = true;
    this.metroJourney.securityCleared = true;
    this.audio.playScannerBeep();
    this.showToast('Security X-Ray & Metal Check Cleared! Proceed to Entry QR / Smart Card Gate.');
    this.emitHud(true);
  }

  public buyMetroTicket(fromId: string, toId: string): MetroTicket | null {
    const fromSt = METRO_STATIONS.find((s) => s.id === fromId);
    const toSt = METRO_STATIONS.find((s) => s.id === toId);
    if (!fromSt || !toSt || toSt.status === 'under_construction') {
      this.showToast('Selected destination is unavailable or under construction.');
      return null;
    }
    const routeStations = this.router.findMetroRouteStations(fromSt.id, toSt.id, METRO_STATIONS);
    const stops = Math.max(1, routeStations.length > 1 ? routeStations.length - 1 : Math.abs(toSt.order - fromSt.order));
    const fare = computeBmrclMetroFare(stops, false);
    if (this.cash < fare && this.bankBalance < fare) {
      this.showToast(`Insufficient funds (₹${fare} Metro fare required).`);
      return null;
    }
    if (this.cash >= fare) this.cash -= fare;
    else {
      this.bankBalance -= fare;
      this.addBankTransaction(`Namma Metro QR (${toSt.name})`, -fare);
    }
    const ticket: MetroTicket = {
      id: `mt_${Date.now()}`,
      fromId: fromSt.id,
      fromName: fromSt.name,
      toId: toSt.id,
      toName: toSt.name,
      line: toSt.line,
      fare,
      qrCode: `NM-${fromSt.line.slice(0, 2).toUpperCase()}-${Math.floor(100000 + Math.random() * 899999)}`,
      timestamp: this.istClockLabel,
      used: false,
    };
    this.metroTickets = [ticket, ...this.metroTickets.slice(0, 5)];
    if (this.metroJourney.phase !== 'none') {
      this.metroJourney.destinationId = toSt.id;
      this.metroJourney.destinationName = toSt.name;
    }
    this.audio.playPickup();
    this.showToast(`Metro QR Ticket issued to ${toSt.name} (₹${fare}). Pass Security & Scan at Gate!`);
    this.emitHud(true);
    return ticket;
  }

  public scanQrGate(): void {
    if (!this.securityCleared) {
      this.showToast('Complete Security Bag & Metal Scan [F] first before entering fare gates!');
      return;
    }
    const t = this.metroTickets.find((tk) => !tk.used);
    if (t) {
      t.used = true;
      this.metroFarePaid = t.fare;
      this.metroJourney.farePaid = t.fare;
      this.metroJourney.gateUnlocked = true;
      this.metroJourney.phase = 'platform';
      this.metroJourney.destinationId = t.toId;
      this.metroJourney.destinationName = t.toName;
      if (this.trainPhase === 'departing') {
        this.trainPhase = 'approaching';
        this.metroJourney.trainWaitSec = 4;
      }
      this.audio.playGatePass();
      this.showToast('QR Gate Unlocked! Take Stairs, Moving Escalator, or Glass Elevator to Platform.');
      this.emitHud(true);
      return;
    }
    if (this.smartCardOwned && this.smartCardBalance >= 10) {
      this.metroFarePaid = 0;
      this.metroJourney.gateUnlocked = true;
      this.metroJourney.phase = 'platform';
      if (this.trainPhase === 'departing') {
        this.trainPhase = 'approaching';
        this.metroJourney.trainWaitSec = 4;
      }
      this.audio.playGatePass();
      this.showToast(
        `Namma Metro Smart Card Tapped In (Balance ₹${this.smartCardBalance})! Proceed to Platform.`
      );
      this.emitHud(true);
      return;
    }
    this.showToast('No QR Ticket or Smart Card balance! Buy at Counter, TVM [F], or Smart Card Kiosk.');
  }

  public scanExitGate(): void {
    if (this.metroJourney.phase === 'none') return;
    if (!this.hasRiddenMetro || this.exitGateCleared) {
      this.exitGateCleared = true;
      this.metroJourney.exitGateCleared = true;
      this.audio.playGatePass();
      this.showToast('Exit Gate Open — proceed outside to Bengaluru Street [F].');
      this.emitHud(true);
      return;
    }
    if (this.metroFarePaid > 0) {
      this.exitGateCleared = true;
      this.metroJourney.exitGateCleared = true;
      this.audio.playGatePass();
      this.showToast('QR Exit Validated! Walk through to Street Exit [F].');
      this.emitHud(true);
      return;
    }
    const stops = Math.max(1, this.metroRouteIds.length > 1 ? this.metroRouteIds.length - 1 : 2);
    const fare = computeBmrclMetroFare(stops, this.smartCardOwned);
    if (this.smartCardOwned && this.smartCardBalance >= fare) {
      this.smartCardBalance -= fare;
      this.metroJourney.smartCardBalance = this.smartCardBalance;
    } else if (this.smartCardOwned) {
      const rem = fare - this.smartCardBalance;
      this.smartCardBalance = 0;
      this.metroJourney.smartCardBalance = 0;
      this.cash = Math.max(0, this.cash - rem);
    } else {
      this.cash = Math.max(0, this.cash - fare);
    }
    this.metroFarePaid = fare;
    this.metroJourney.farePaid = fare;
    this.exitGateCleared = true;
    this.metroJourney.exitGateCleared = true;
    this.audio.playGatePass();
    this.showToast(
      `Exit Gate Tap-Out (-₹${fare}${this.smartCardOwned ? ` · Smart Card ₹${this.smartCardBalance}` : ''}). Welcome to Bengaluru!`
    );
    this.emitHud(true);
  }

  public boardMetroTrain(): void {
    if (this.boardingTransition) return;
    if (!this.metroJourney.gateUnlocked) {
      const unused = this.metroTickets.find((tk) => !tk.used);
      if (unused) {
        unused.used = true;
        this.metroJourney.gateUnlocked = true;
        this.metroJourney.phase = 'platform';
        this.metroJourney.destinationId = unused.toId;
        this.metroJourney.destinationName = unused.toName;
      } else {
        this.showToast('Please buy and scan a QR ticket at the gate first!');
        return;
      }
    }
    if (this.trainPhase !== 'boarding' || this.trainDoorOpen < 0.35) {
      this.showToast(
        this.trainPhase === 'approaching'
          ? `Train arriving in ${Math.ceil(this.metroJourney.trainWaitSec)}s — stand behind yellow line!`
          : 'Doors closing / departing — wait for next train!'
      );
      return;
    }

    let nearestDoorX: number = METRO_DOOR_X[0];
    let bestD = Infinity;
    for (const dx of METRO_DOOR_X) {
      const d = Math.abs(this.playerX - dx);
      if (d < bestD) {
        bestD = d;
        nearestDoorX = dx;
      }
    }
    this.boardingTargetX = nearestDoorX;
    this.boardingTargetZ = -1246.2;
    this.boardingTransition = true;
    this.boardingTimer = 0.65;
    this.metroJourney.boardingTransition = true;
    this.audio.playMetroChime();
    this.showToast('Boarding Namma Metro train...');
    this.emitHud(true);
  }

  private finishBoardingIntoTrain(): void {
    this.boardingTransition = false;
    this.metroJourney.boardingTransition = false;
    const startSt = METRO_STATIONS.find((s) => s.id === this.metroJourney.stationId);
    const destSt =
      METRO_STATIONS.find((s) => s.id === this.metroJourney.destinationId && s.status === 'operational') ||
      METRO_STATIONS.find(
        (s) => s.line === this.metroJourney.line && s.status === 'operational' && s.id !== this.metroJourney.stationId
      );

    const routeStations =
      startSt && destSt
        ? this.router.findMetroRouteStations(startSt.id, destSt.id, METRO_STATIONS)
        : [];
    this.metroRouteIds = routeStations.map((s) => s.id);
    const lines: MetroLineId[] = [];
    routeStations.forEach((s) => {
      if (lines[lines.length - 1] !== s.line) lines.push(s.line);
    });
    let interchangeName: string | null = null;
    for (let i = 1; i < routeStations.length; i++) {
      if (routeStations[i].line !== routeStations[i - 1].line) {
        interchangeName = routeStations[i - 1].name;
        break;
      }
    }

    this.metroJourney.phase = 'riding';
    this.metroJourney.trainPhase = 'moving';
    this.trainPhase = 'moving';
    this.metroJourney.rideProgress = 0;
    this.metroJourney.trainSpeedKmh = 6;
    this.metroJourney.holdingRail = false;
    this.metroJourney.trainCameraMode = 'interior';
    this.metroJourney.stopsRemaining = Math.max(1, routeStations.length - 1);
    this.metroJourney.interchangeStationName = interchangeName;
    this.metroJourney.routeLineSequence = lines.length > 0 ? lines : [this.metroJourney.line];
    this.metroJourney.destinationId = destSt?.id ?? null;
    this.metroJourney.destinationName = destSt?.name ?? 'MG Road Metro';
    this.hasRiddenMetro = true;
    this.exitGateCleared = false;
    this.metroJourney.exitGateCleared = false;
    this.metroJourney.farePaid = this.metroFarePaid;
    this.metroJourney.coachCount = this.metroSim.coachCount;
    this.coachDoorOpen = 0;
    this.trainStopPauseTimer = 0;
    this.lastAnnouncedHop = 0;
    const ui = getUiStrings(this.settings.language);
    this.metroJourney.announcement = interchangeName
      ? `${ui.metroArrival(destSt?.kannadaName ?? '', destSt?.name ?? '')} · Interchange at ${interchangeName}`
      : ui.metroArrival(destSt?.kannadaName ?? 'ಎಂ.ಜಿ ರಸ್ತೆ', destSt?.name ?? 'MG Road Metro');
    this.playerX = this.metroSim.trainCabinSpawn.x;
    this.playerY = this.metroSim.trainCabinSpawn.y;
    this.playerZ = this.metroSim.trainCabinSpawn.z;
    this.metroJourney.activeCoachIndex = getActiveCoachIndex(this.playerZ);
    this.playerHeading = Math.PI;
    this.isSitting = false;
    this.holdingRail = false;
    this.currentCamPos.set(this.playerX + 1.0, this.playerY + 1.7, this.playerZ + 2.8);
    this.audio.playMetroChime();
    speakKannadaOrEnglish(this.metroJourney.announcement, this.settings.language);
    this.emitHud(true);
  }

  public alightToPlatform(): void {
    if (this.metroJourney.phase !== 'arrived') {
      if (this.metroJourney.phase === 'riding') {
        this.showToast(`Train in motion — ${this.metroJourney.stopsRemaining} stop(s) remaining.`);
      }
      return;
    }
    const destSt =
      (this.metroJourney.destinationId &&
        METRO_STATIONS.find((s) => s.id === this.metroJourney.destinationId)) ||
      METRO_STATIONS.find((s) => s.id === this.metroJourney.stationId);

    if (destSt) {
      this.metroJourney.stationId = destSt.id;
      this.metroJourney.stationName = destSt.name;
      this.metroJourney.stationKannada = destSt.kannadaName;
      this.metroJourney.line = destSt.line;
      this.metroJourney.elevatedStation = destSt.elevated;
      this.metroJourney.interchangeStationName = destSt.interchangeWith?.length ? destSt.name : null;
      this.metroSim.configureStation(
        destSt.line,
        destSt.name,
        destSt.kannadaName,
        destSt.elevated,
        Boolean(destSt.interchangeWith?.length)
      );
      this.metroReturnPos.set(destSt.x + 8, getFlyoverDeckY(destSt.x + 8, destSt.z + 10), destSt.z + 10);
      const dist = getDistrictAt(destSt.x, destSt.z);
      this.discoveredDistricts.add(dist.id);
    }

    this.metroJourney.phase = 'platform';
    this.metroJourney.gateUnlocked = true;
    this.metroJourney.destinationId = null;
    this.metroJourney.destinationName = null;
    this.metroJourney.trainSpeedKmh = 0;
    this.metroJourney.holdingRail = false;
    this.metroJourney.boardingTransition = false;
    this.metroJourney.announcement = `Welcome to ${destSt?.name ?? 'Destination'} (${
      destSt?.kannadaName ?? ''
    }). Use Escalator, Stairs, or Lift to Concourse & scan Exit Gate.`;
    this.holdingRail = false;
    this.isSitting = false;
    this.coachDoorOpen = 1;
    this.trainPhase = 'boarding';
    this.trainDoorOpen = 1;
    this.trainPhaseTimer = 10.0;
    this.playerX = 0;
    this.playerY = -135.2;
    this.playerZ = -1241.5;
    this.playerHeading = 0;
    this.currentCamPos.set(0, -133.1, -1244.5);
    this.currentLookAt.set(0, -133.7, -1236.0);
    this.audio.playMetroChime();
    this.showToast(`Stepped onto ${destSt?.name ?? 'Destination'} Platform! Head down to Concourse & scan Exit Gate.`);
    this.emitHud(true);
  }

  public exitMetroJourney(): void {
    const destSt =
      (this.metroJourney.phase === 'arrived' && this.metroJourney.destinationId
        ? METRO_STATIONS.find((s) => s.id === this.metroJourney.destinationId)
        : METRO_STATIONS.find((s) => s.id === this.metroJourney.stationId)) ?? null;
    const wasArrived = this.metroJourney.phase === 'arrived';
    // Auto-settle smart card / ticket on HUD button exit, or enforce exit gate on foot at exit_station
    if (this.hasRiddenMetro && !this.exitGateCleared) {
      this.scanExitGate();
    }
    this.metroJourney = {
      phase: 'none',
      stationId: '',
      stationName: '',
      stationKannada: '',
      line: 'purple',
      elevatedStation: true,
      destinationId: null,
      destinationName: null,
      interchangeStationName: null,
      routeLineSequence: ['purple'],
      stopsRemaining: 0,
      trainWaitSec: 0,
      trainPhase: 'approaching',
      trainDoorOpen: 0,
      trainSpeedKmh: 0,
      trainCameraMode: 'interior',
      holdingRail: false,
      boardingTransition: false,
      passengerCount: this.metroSim.passengerCount,
      activeDoorSide: 'left',
      elevatorFloor: 'concourse',
      elevatorMoving: false,
      onEscalator: null,
      rideProgress: 0,
      gateUnlocked: false,
      securityCleared: false,
      smartCardOwned: this.smartCardOwned,
      smartCardBalance: this.smartCardBalance,
      exitGateCleared: true,
      coachCount: this.metroSim.coachCount,
      activeCoachIndex: 2,
      farePaid: 0,
      announcement: '',
    };
    this.boardingTransition = false;
    this.holdingRail = false;
    this.isSitting = false;
    this.securityCleared = false;
    this.exitGateCleared = true;
    this.hasRiddenMetro = false;
    this.metroFarePaid = 0;
    this.audio.setInteriorMuffled(false);
    if (wasArrived && destSt) {
      this.playerX = destSt.x + 8;
      this.playerZ = destSt.z + 10;
      this.playerY = getFlyoverDeckY(this.playerX, this.playerZ);
      const dist = getDistrictAt(destSt.x, destSt.z);
      this.discoveredDistricts.add(dist.id);
      this.showToast(`Arrived at ${destSt.name} (${destSt.kannadaName})!`);
    } else {
      this.playerX = this.metroReturnPos.x;
      this.playerY = this.metroReturnPos.y;
      this.playerZ = this.metroReturnPos.z;
      this.showToast(destSt ? `Exited onto ${destSt.name} Street.` : 'Exited Namma Metro station.');
    }
    this.currentCamPos.set(this.playerX - 5, this.playerY + 3, this.playerZ + 10);
    this.emitHud(true);
  }

  // === Police Jail Bail & Sentence Completion ===
  private cleanupArrestOfficers(): void {
    for (const off of this.policeOfficers) {
      off.rig.group.removeFromParent();
      disposeHumanRig(off.rig);
    }
    this.policeOfficers = [];
    this.arrestEscortVehicle = null;
    this.arrestWaypoints = [];
    this.arrestWpIdx = 0;
  }

  public payJailBail(): void {
    const bailCost = Math.max(500, this.wantedStars * 800);
    if (this.cash >= bailCost) {
      this.cash -= bailCost;
    } else if (this.bankBalance >= bailCost) {
      this.bankBalance -= bailCost;
      this.addBankTransaction(`Police Bail (${this.arrestTargetStation.name})`, -bailCost);
    } else {
      const paid = this.cash + this.bankBalance;
      this.cash = 0;
      this.bankBalance = 0;
      if (paid > 0) this.addBankTransaction(`Police Bail Settlement`, -paid);
    }
    this.wantedStars = 0;
    this.wantedCooldown = 0;
    this.isEvading = false;
    this.arrestStage = 'none';
    this.arrestStoppedAccum = 0;
    this.cleanupArrestOfficers();
    this.clearInteriorAction();
    this.exitInterior();
    this.audio.playPickup();
    this.showToast(`Bail paid (-₹${bailCost.toLocaleString('en-IN')}). Released from ${this.arrestTargetStation.name}.`);
    this.emitHud(true);
  }

  public serveJailTime(): void {
    if (this.settings.timePreset !== 'ist_realtime') {
      this.timeOfDayHours = (this.timeOfDayHours + 6) % 24;
    }
    this.weapon = 'unarmed';
    this.wantedStars = 0;
    this.wantedCooldown = 0;
    this.isEvading = false;
    this.arrestStage = 'none';
    this.arrestStoppedAccum = 0;
    this.cleanupArrestOfficers();
    this.clearInteriorAction();
    this.exitInterior();
    this.audio.playPickup();
    this.showToast(`Served sentence at ${this.arrestTargetStation.name} (+6h · Weapons confiscated).`);
    this.emitHud(true);
  }

  private cleanupNammaYatriDriver(): void {
    if (this.nammaYatriDriverRig) {
      this.nammaYatriDriverRig.group.removeFromParent();
      disposeHumanRig(this.nammaYatriDriverRig);
      this.nammaYatriDriverRig = null;
    }
  }

  // === Namma Yatri Live Simulated Auto/Cab Dispatch (Road-Graph Driver + Rear Passenger Mode) ===
  public bookNammaYatri(rideType: 'auto' | 'cab', destName: string, destX: number, destZ: number): void {
    const anchor = this.getResolvedExternalAnchor();
    const px = anchor.x;
    const pz = anchor.z;
    const distKm = Math.max(0.6, Math.hypot(destX - px, destZ - pz) * 0.01);
    const fare = rideType === 'auto' ? Math.round(35 + distKm * 18) : Math.round(60 + distKm * 28);
    if (this.cash + this.bankBalance < fare) {
      this.showToast(`Insufficient funds for Namma Yatri (₹${fare} estimated).`);
      return;
    }
    this.cleanupNammaYatriDriver();
    if (this.nammaYatriVehicle) {
      this.nammaYatriVehicle.isAi = true;
    }
    const ang = Math.random() * Math.PI * 2;
    const spawnX = THREE.MathUtils.clamp(px + Math.cos(ang) * 52, -WORLD_HALF_SIZE + 25, WORLD_HALF_SIZE - 25);
    const spawnZ = THREE.MathUtils.clamp(pz + Math.sin(ang) * 52, -WORLD_HALF_SIZE + 25, WORLD_HALF_SIZE - 25);
    const v = this.spawnVehicle(rideType, spawnX, spawnZ, Math.atan2(px - spawnX, pz - spawnZ), false, false);
    if (v.rig.riderGroup) v.rig.riderGroup.visible = false;

    // Visible 3D Driver NPC sitting inside the dispatched Auto/Cab front seat
    const driverRig = createArchetypeHuman('auto_driver', 915, this.textures);
    driverRig.group.position.copy(v.rig.driverSeatOffset);
    driverRig.group.rotation.y = 0;
    v.rig.chassisGroup.add(driverRig.group);
    updateHumanAnimation(driverRig, {
      pose: 'sit',
      speedNorm: 0,
      stridePhase: 0,
      elapsed: this.elapsed,
      dt: 0.016,
      expression: 'neutral',
      lookYaw: 0,
      lookPitch: 0,
      holdingUmbrella: false,
      simulateCloth: false,
    });
    this.nammaYatriDriverRig = driverRig;
    this.nammaYatriVehicle = v;
    this.nammaYatriWaypoints = this.router.findRoadWaypoints(spawnX, spawnZ, px + 3.2, pz + 3.2);
    this.nammaYatriWpIdx = 0;

    const drivers = ['Ramesh Gowda', 'Karthik Shetty', 'Manjunath K', 'Suresh Babu'];
    const driverName = drivers[Math.floor(Math.random() * drivers.length)];
    const plateNumber = `KA 01 NY ${Math.floor(1000 + Math.random() * 8999)}`;
    this.nammaYatri = {
      status: 'en_route_pickup',
      rideType,
      driverName,
      plateNumber,
      destName,
      destX,
      destZ,
      fare,
      distanceKm: Number(distKm.toFixed(1)),
      etaSec: 8,
    };
    this.audio.playPhoneRing();
    this.showToast(`Namma Yatri ${rideType.toUpperCase()} dispatched: ${driverName} (${plateNumber})`);
    this.emitHud(true);
  }

  public cancelNammaYatri(): void {
    if (this.activeVehicle && this.activeVehicle === this.nammaYatriVehicle) {
      this.handleInteractOrVehicle();
    } else {
      this.cleanupNammaYatriDriver();
      if (this.nammaYatriVehicle) {
        this.nammaYatriVehicle.isAi = true;
        this.nammaYatriVehicle = null;
      }
    }
    this.nammaYatri.status = 'idle';
    this.showToast('Namma Yatri ride cancelled.');
    this.emitHud(true);
  }

  // === Smartphone Messages, Calls, Bank, Radio, Photo Mode, Language & Save/Load ===
  public sendPhoneMessage(recipient: string, text: string): void {
    const clean = text.trim();
    if (!clean) return;
    this.messages = [
      ...this.messages,
      {
        id: `mp_${Date.now()}`,
        sender: 'You',
        role: recipient,
        text: clean,
        time: this.istClockLabel.slice(0, 5) + ' IST',
        fromPlayer: true,
      },
      {
        id: `mr_${Date.now() + 1}`,
        sender: recipient,
        role: 'Bengaluru Contact',
        text: 'Got it! Meet near MG Road Metro or Indiranagar 100ft Rd soon.',
        kannadaText: 'ಸರಿ ಗುರು! ಎಂ.ಜಿ ರಸ್ತೆ ಮೆಟ್ರೋ ಅಥವಾ ಇಂದಿರಾನಗರದಲ್ಲಿ ಸಿಗೋಣ.',
        time: this.istClockLabel.slice(0, 5) + ' IST',
      },
    ];
    this.audio.playPickup();
    this.emitHud(true);
  }

  public makeSimulatedCall(contactName: string): void {
    const sample = KANNADA_PRIMARY_DIALOGUES[Math.floor(Math.random() * KANNADA_PRIMARY_DIALOGUES.length)];
    this.audio.playPhoneRing();
    this.npcSubtitle = {
      speaker: contactName,
      language: 'Kannada / English',
      line: this.settings.language === 'kn' ? sample.kn : sample.en,
    };
    this.subtitleTimer = 5.0;
    speakKannadaOrEnglish(this.npcSubtitle.line, this.settings.language);
    this.emitHud(true);
  }

  public transferBankToCash(amount: number): void {
    if (this.bankBalance < amount) {
      this.showToast('Insufficient bank balance.');
      return;
    }
    this.bankBalance -= amount;
    this.cash += amount;
    this.addBankTransaction('UPI Cash Withdrawal', -amount);
    this.audio.playPickup();
    this.emitHud(true);
  }

  private addBankTransaction(label: string, amount: number): void {
    this.transactions = [
      { id: `tx_${Date.now()}`, label, amount, time: `${this.istClockLabel.slice(0, 5)} IST` },
      ...this.transactions.slice(0, 14),
    ];
  }

  public setRadioCategory(cat: RadioCategoryId): void {
    this.settings.radioOn = true;
    this.audio.setCategory(cat);
    this.audio.setSettings(this.settings.sfxOn, true);
    this.emitHud(true);
  }

  public selectRadioTrack(idx: number): void {
    this.settings.radioOn = true;
    this.audio.selectTrack(idx);
    this.audio.setSettings(this.settings.sfxOn, true);
    this.emitHud(true);
  }

  public nextRadioTrack(): void {
    this.settings.radioOn = true;
    this.audio.nextTrack();
    this.audio.setSettings(this.settings.sfxOn, true);
    this.emitHud(true);
  }

  public prevRadioTrack(): void {
    this.settings.radioOn = true;
    this.audio.prevTrack();
    this.audio.setSettings(this.settings.sfxOn, true);
    this.emitHud(true);
  }

  public setRadioVolume(v: number): void {
    this.audio.setVolume(v);
    this.emitHud(true);
  }

  public toggleRadioShuffle(): void {
    this.audio.toggleShuffle();
    this.emitHud(true);
  }

  public cycleRadioRepeat(): void {
    this.audio.cycleRepeat();
    this.emitHud(true);
  }

  public uploadCustomRadioTrack(title: string, objectUrl: string): void {
    this.settings.radioOn = true;
    this.audio.addCustomTrack(title, objectUrl);
    this.audio.setSettings(this.settings.sfxOn, true);
    this.showToast(`Loaded local track: ${title}`);
    this.emitHud(true);
  }

  public togglePhotoMode(): void {
    this.photoMode = !this.photoMode;
    this.showToast(this.photoMode ? 'Photo Mode Active — Drag to orbit, click Snapshot.' : 'Photo Mode Closed.');
    this.emitHud(true);
  }

  public setLanguage(lang: LanguageId): void {
    this.settings.language = lang;
    this.emitHud(true);
  }

  public saveGameSlot(slot: number): void {
    const anchor = this.getResolvedExternalAnchor();
    const px = anchor.x;
    const pz = anchor.z;
    const py = getFlyoverDeckY(px, pz);
    const dist = getDistrictAt(px, pz);
    const prof = PROTAGONIST_PRESETS[this.playerCustom.protagonistId];
    const payload: SavePayload = {
      version: 1,
      slot,
      savedAt: `${this.istDateLabel} ${this.istClockLabel}`,
      protagonistName: prof.name,
      districtName: dist.name,
      playerX: px,
      playerY: py,
      playerZ: pz,
      playerHeading: this.playerHeading,
      health: this.health,
      maxHealth: this.maxHealth,
      armor: this.armor,
      cash: this.cash,
      bankBalance: this.bankBalance,
      ammo: this.ammo,
      timeOfDayHours: this.timeOfDayHours,
      customization: this.playerCustom,
      vehicleTuning: this.vehicleTuning,
      settings: this.settings,
      discoveredDistricts: Array.from(this.discoveredDistricts),
      completedMissions: Array.from(this.completedMissions),
      collectedIds: Array.from(this.collectedIds),
      ownedProperties: this.ownedProperties,
      pantryItems: this.pantryItems,
      metroTickets: this.metroTickets,
      transactions: this.transactions,
      messages: this.messages,
    };
    saveGameToSlot(slot, payload);
    this.audio.playPickup();
    this.showToast(`Game saved to Slot ${slot}!`);
    this.emitHud(true);
  }

  public loadGameSlot(slot: number): void {
    const data = loadGameFromSlot(slot);
    if (!data) {
      this.showToast(`Save Slot ${slot} is empty.`);
      return;
    }
    if (this.activeInterior) this.exitInterior();
    if (this.metroJourney.phase !== 'none') this.exitMetroJourney();
    if (this.activeVehicle) this.handleInteractOrVehicle();

    this.playerX = data.playerX;
    this.playerZ = data.playerZ;
    this.playerY = typeof data.playerY === 'number' ? data.playerY : getFlyoverDeckY(this.playerX, this.playerZ);
    this.playerHeading = data.playerHeading;
    this.health = data.health;
    this.maxHealth = data.maxHealth || 100;
    this.armor = data.armor;
    this.ammo = data.ammo;
    this.cash = data.cash;
    this.bankBalance = data.bankBalance;
    this.timeOfDayHours = data.timeOfDayHours;
    this.playerCustom = data.customization;
    this.vehicleTuning = data.vehicleTuning;
    this.settings = { ...this.settings, ...data.settings };
    this.discoveredDistricts = new Set(data.discoveredDistricts);
    this.completedMissions = new Set(data.completedMissions);
    this.collectedIds = new Set(data.collectedIds);
    this.ownedProperties = data.ownedProperties.length > 0 ? data.ownedProperties : ['indiranagar_villa'];
    this.pantryItems = data.pantryItems || {};
    this.metroTickets = data.metroTickets || [];
    this.transactions = data.transactions || this.transactions;
    this.messages = data.messages || this.messages;
    this.applyCustomization(this.playerCustom);
    this.updateSettings(this.settings);
    this.showToast(`Loaded Save Slot ${slot} (${data.districtName})!`);
    this.emitHud(true);
  }

  public updateSettings(next: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...next };
    if (next.timePreset === 'morning') this.timeOfDayHours = 9.5;
    else if (next.timePreset === 'golden') this.timeOfDayHours = 17.6;
    else if (next.timePreset === 'night') this.timeOfDayHours = 22.5;
    else if (next.timePreset === 'ist_realtime') {
      this.timeOfDayHours = getIndiaStandardTime().hoursDecimal;
    }

    if (next.graphicsQuality && !this.isSoftwareGl) {
      const q = next.graphicsQuality;
      this.renderer.setPixelRatio(
        q === 'low' ? 1 : q === 'medium' ? Math.min(window.devicePixelRatio, 1.25) : Math.min(window.devicePixelRatio, 2)
      );
      this.renderer.shadowMap.enabled = q !== 'low';
    }
    this.audio.setSettings(this.settings.sfxOn, this.settings.radioOn);
    this.emitHud(true);
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public toggleRadio(): void {
    this.settings.radioOn = !this.settings.radioOn;
    this.audio.setSettings(this.settings.sfxOn, this.settings.radioOn);
    const tr = this.audio.getCurrentTrack();
    this.showToast(this.settings.radioOn ? `Radio: ${tr.title}` : 'Radio Off');
    this.emitHud(true);
  }

  private addWantedStars(stars: number): void {
    const prev = this.wantedStars;
    this.wantedStars = Math.min(5, Math.max(this.wantedStars, stars));
    this.wantedCooldown = 1;
    this.isEvading = false;
    if (this.wantedStars > prev) {
      this.spawnPoliceUnit();
      this.showToast(`Wanted Level ${this.wantedStars} — Karnataka Police alerted!`);
    }
  }

  private spawnPoliceUnit(): void {
    const policeCount = this.vehicles.filter((v) => v.isPolice).length;
    if (policeCount >= this.wantedStars + 1) return;
    const angle = Math.random() * Math.PI * 2;
    const px = THREE.MathUtils.clamp(this.playerX + Math.cos(angle) * 75, -WORLD_HALF_SIZE + 30, WORLD_HALF_SIZE - 30);
    const pz = THREE.MathUtils.clamp(this.playerZ + Math.sin(angle) * 75, -WORLD_HALF_SIZE + 30, WORLD_HALF_SIZE - 30);
    const kind: VehicleKind = Math.random() > 0.4 ? 'police_suv' : 'police_bike';
    this.spawnVehicle(kind, px, pz, 0, true, true);
  }

  private showToast(msg: string): void {
    this.toastMessage = msg;
    this.toastTimer = 4.2;
  }

  private getCurrentWind(): { wx: number; wz: number } {
    const isStorm = this.settings.weather === 'thunderstorm';
    const isRain = this.settings.weather === 'monsoon' || this.settings.weather === 'light_rain';
    const base = isStorm ? 7.5 : isRain ? 4.2 : 1.6;
    return {
      wx: base + Math.sin(this.elapsed * 0.7) * base * 0.4,
      wz: base * 0.5 + Math.cos(this.elapsed * 0.55) * base * 0.35,
    };
  }

  private getResolvedExternalAnchor(): { x: number; z: number; label: string } {
    if (this.metroJourney.phase !== 'none') {
      const st = METRO_STATIONS.find((s) => s.id === this.metroJourney.stationId);
      const dest = this.metroJourney.destinationId
        ? METRO_STATIONS.find((s) => s.id === this.metroJourney.destinationId)
        : null;
      if (this.metroJourney.phase === 'riding' && st && dest) {
        const u = this.metroJourney.rideProgress;
        return {
          x: THREE.MathUtils.lerp(st.x, dest.x, u),
          z: THREE.MathUtils.lerp(st.z, dest.z, u),
          label: `Metro → ${dest.name}`,
        };
      }
      if (st) return { x: st.x, z: st.z, label: st.name };
      return {
        x: this.metroReturnPos.x,
        z: this.metroReturnPos.z,
        label: this.metroJourney.stationName || 'Namma Metro',
      };
    }
    if (this.activeInterior) {
      const lm = LANDMARK_MARKERS.find((l) => l.interiorId === this.activeInterior);
      if (lm) return { x: lm.x, z: lm.z, label: lm.name };
      return {
        x: this.interiorReturnPos.x,
        z: this.interiorReturnPos.z,
        label: this.activeInterior,
      };
    }
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    return { x: px, z: pz, label: getDistrictAt(px, pz).name };
  }

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    this.fpsAccum += rawDt;
    this.fpsFrames++;
    if (this.fpsAccum >= 0.5) {
      this.currentFps = Math.round(this.fpsFrames / this.fpsAccum);
      this.fpsAccum = 0;
      this.fpsFrames = 0;
    }

    try {
      if (!this.paused) {
        this.elapsed += dt;
        const ist = getIndiaStandardTime();
        this.istClockLabel = ist.clockLabel;
        this.istDateLabel = ist.dateLabel;
        this.istWeekday = ist.weekdayLabel;
        this.timezoneLabel = ist.timezoneLabel;
        this.istDayOfYear = ist.dayOfYear;
        if (this.settings.timePreset === 'ist_realtime') {
          this.timeOfDayHours = ist.hoursDecimal;
        } else if (this.settings.timePreset === 'auto') {
          this.timeOfDayHours = (this.timeOfDayHours + dt * 0.05) % 24;
        }

        if (this.toastTimer > 0) {
          this.toastTimer -= dt;
          if (this.toastTimer <= 0) this.toastMessage = null;
        }
        if (this.subtitleTimer > 0) {
          this.subtitleTimer -= dt;
          if (this.subtitleTimer <= 0) this.npcSubtitle = null;
        }
        if (this.punchTimer > 0) this.punchTimer -= dt;
        if (this.kickTimer > 0) this.kickTimer -= dt;
        if (this.dodgeTimer > 0) this.dodgeTimer -= dt;
        if (this.hitReactTimer > 0) this.hitReactTimer -= dt;
        if (this.eatTimer > 0) this.eatTimer -= dt;
        if (this.hornAlertTimer > 0) this.hornAlertTimer -= dt;

        // Vehicle hinged door open/close animations
        this.doorAnimTimers.forEach((rem, vid) => {
          const next = rem - dt;
          const veh = this.vehicles.find((vv) => vv.id === vid);
          if (veh?.rig.driverDoorPivot) {
            const swing = next > 0 ? Math.sin((next / 0.9) * Math.PI) * 1.15 : 0;
            veh.rig.driverDoorPivot.rotation.y = swing;
          }
          if (next <= 0) this.doorAnimTimers.delete(vid);
          else this.doorAnimTimers.set(vid, next);
        });

        const lockedByArrest =
          this.arrestStage === 'cuffing' ||
          this.arrestStage === 'escorting_to_car' ||
          this.arrestStage === 'driving_to_station';

        if (this.started) {
          if (this.cityShowcaseActive) {
            this.cityShowcaseTimer += dt;
          } else if (this.studioActive) {
            this.updateStudioShowcase(dt);
          } else if (!lockedByArrest) {
            if (this.activeVehicle) {
              this.updatePlayerDriving(dt);
            } else {
              this.updatePlayerOnFoot(dt);
            }
          }

          if (this.metroJourney.phase !== 'none') {
            this.updateMetroJourney(dt);
          }
          if (this.nammaYatri.status !== 'idle') {
            this.updateNammaYatri(dt);
          }

          if (!this.activeInterior && this.metroJourney.phase === 'none') {
            this.updateProjectiles(dt);
            this.updateSplashParticles(dt);
            this.updateTrafficSignals();
            this.updateAiVehicles(dt);
            this.updateNpcs(dt);
            this.updateStreetDogs(dt);
            if (!this.studioActive && !this.cityShowcaseActive) {
              this.updatePoliceWanted(dt);
              this.updatePoliceArrestLifecycle(dt);
              this.updateCollectiblesAndDiscovery();
              this.updateMission(dt);
            }
          }
        }

        const anchor = this.cityShowcaseActive
          ? { x: this.currentLookAt.x, z: this.currentLookAt.z, label: this.cityShowcaseLabel || 'Bengaluru Showcase' }
          : this.getResolvedExternalAnchor();
        const inPocket = !this.cityShowcaseActive && (!!this.activeInterior || this.metroJourney.phase !== 'none');
        this.partitionStats = this.world.partition.updateStreaming(anchor.x, anchor.z, this.settings.graphicsQuality);

        if (this.activeRoute && Math.hypot(anchor.x - this.activeRoute.targetX, anchor.z - this.activeRoute.targetZ) < 12) {
          const dest = this.activeRoute.destinationName;
          this.activeRoute = null;
          this.waypoint = null;
          this.world.navigationLine.visible = false;
          this.audio.playPickup();
          this.showToast(`Arrived at ${dest}!`);
        }

        const effectiveHours = this.studioActive
          ? this.studioLighting === 'golden_hour'
            ? 17.5
            : this.studioLighting === 'night_neon'
            ? 22.3
            : this.studioLighting === 'softbox'
            ? 12.2
            : 11.0
          : this.timeOfDayHours;

        this.world.updateAtmosphere(
          effectiveHours,
          this.studioActive ? 'clear' : this.settings.weather,
          anchor.x,
          anchor.z,
          this.elapsed,
          dt,
          () => this.audio.playThunder(),
          inPocket
        );
        if (this.studioActive && this.studioLighting === 'softbox') {
          this.world.hemiLight.intensity = 1.45;
          this.world.sunLight.intensity = 1.55;
        }
        this.updateCamera(dt);

        const speedNorm = this.activeVehicle
          ? Math.min(1, Math.abs(this.activeVehicle.speed) / VEHICLE_SPECS[this.activeVehicle.kind].maxSpeed)
          : 0;
        this.audio.updateContinuous(
          !!this.activeVehicle,
          this.activeVehicle?.kind ?? null,
          speedNorm,
          this.wantedStars,
          this.settings.weather,
          this.elapsed
        );

        if (this.elapsed - this.lastHudEmit > 0.08) {
          this.emitHud(false);
          this.lastHudEmit = this.elapsed;
        }
      }

      this.renderer.render(this.scene, this.camera);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (this.renderError !== msg) {
        this.renderError = msg;
        this.onRenderError?.(msg);
      }
    }

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    gl.flush();
    const poll = () => {
      if (this.disposed) return;
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private updateMetroJourney(dt: number): void {
    const mj = this.metroJourney;

    // 0. Smooth Boarding Walk-In Transition across Platform Screen Doors -> Train Coach
    if (this.boardingTransition) {
      this.boardingTimer -= dt;
      this.playerX = THREE.MathUtils.damp(this.playerX, this.boardingTargetX, 7.5, dt);
      this.playerZ = THREE.MathUtils.damp(this.playerZ, this.boardingTargetZ, 6.5, dt);
      this.playerHeading = Math.PI;
      if (this.boardingTimer <= 0) {
        this.finishBoardingIntoTrain();
      }
    }

    // 1. Smooth physical Glass Elevator motion (Concourse -140 <-> Platform -135.2)
    const elevDiff = this.elevatorTargetY - this.elevatorY;
    if (Math.abs(elevDiff) > 0.02) {
      this.elevatorDoorOpen = Math.max(0, this.elevatorDoorOpen - dt * 3.5);
      if (this.elevatorDoorOpen <= 0.05) {
        const step = Math.sign(elevDiff) * Math.min(Math.abs(elevDiff), dt * 2.1);
        this.elevatorY += step;
        mj.elevatorMoving = true;
      }
    } else {
      this.elevatorY = this.elevatorTargetY;
      this.elevatorDoorOpen = Math.min(1, this.elevatorDoorOpen + dt * 3.0);
      mj.elevatorMoving = false;
      mj.elevatorFloor = this.elevatorY < -137.5 ? 'concourse' : 'platform';
    }

    // 2. Multi-Car Platform Train Phase Lifecycle (approaching -> boarding -> doors_closing -> departing)
    if (mj.phase === 'concourse' || mj.phase === 'platform') {
      if (this.trainPhase === 'approaching') {
        mj.trainWaitSec = Math.max(0, mj.trainWaitSec - dt);
        this.trainDoorOpen = 0;
        if (mj.trainWaitSec <= 0) {
          this.trainPhase = 'boarding';
          this.trainPhaseTimer = 12.0;
          this.audio.playMetroChime();
        }
      } else if (this.trainPhase === 'boarding') {
        this.trainDoorOpen = Math.min(1, this.trainDoorOpen + dt * 2.8);
        if (!this.boardingTransition) {
          this.trainPhaseTimer -= dt;
          if (this.trainPhaseTimer <= 0) {
            this.trainPhase = 'doors_closing';
            this.trainPhaseTimer = 1.6;
            this.audio.playMetroChime();
          }
        }
      } else if (this.trainPhase === 'doors_closing') {
        this.trainDoorOpen = Math.max(0, this.trainDoorOpen - dt * 2.8);
        this.trainPhaseTimer -= dt;
        if (this.trainPhaseTimer <= 0) {
          this.trainPhase = 'departing';
          this.trainPhaseTimer = 2.6;
        }
      } else if (this.trainPhase === 'departing') {
        this.trainPhaseTimer -= dt;
        if (this.trainPhaseTimer <= 0) {
          this.trainPhase = 'approaching';
          mj.trainWaitSec = 5.5;
        }
      }
      mj.trainPhase = this.trainPhase;
      mj.trainDoorOpen = this.trainDoorOpen;
      mj.trainSpeedKmh = this.trainPhase === 'approaching' ? 32 : this.trainPhase === 'departing' ? 40 : 0;
    } else if (mj.phase === 'riding') {
      const totalHops = Math.max(2, this.metroRouteIds.length - 1);
      mj.activeCoachIndex = getActiveCoachIndex(this.playerZ);

      if (this.trainStopPauseTimer > 0) {
        mj.trainSpeedKmh = Math.round(THREE.MathUtils.damp(mj.trainSpeedKmh, 0, 8, dt));
        this.coachDoorOpen = Math.min(1, this.coachDoorOpen + dt * 3.0);
        this.trainStopPauseTimer -= dt;
        if (this.trainStopPauseTimer <= 0) {
          const dest = mj.destinationName || 'MG Road Metro';
          mj.announcement = `ದಯವಿಟ್ಟು ಗಮನಿಸಿ · Doors closing, next stop towards ${dest} · कृपया ध्यान दें`;
          this.audio.playMetroChime();
        }
      } else {
        this.coachDoorOpen = Math.max(0, this.coachDoorOpen - dt * 3.2);
        const hopFrac = (mj.rideProgress * totalHops) % 1;
        const targetKmh =
          mj.rideProgress > 0.88
            ? 26
            : hopFrac > 0.85 || hopFrac < 0.12
            ? 42
            : 78;
        mj.trainSpeedKmh = Math.round(THREE.MathUtils.damp(mj.trainSpeedKmh, targetKmh, 3.2, dt));
        mj.rideProgress = Math.min(
          1,
          mj.rideProgress + dt * (Math.max(16, mj.trainSpeedKmh) / 78) * 0.095
        );

        const hopIdx = Math.min(totalHops, Math.floor(mj.rideProgress * totalHops));
        mj.stopsRemaining = Math.max(0, totalHops - hopIdx);

        if (hopIdx > this.lastAnnouncedHop && hopIdx < totalHops) {
          this.lastAnnouncedHop = hopIdx;
          const curStId = this.metroRouteIds[hopIdx];
          const curSt = curStId ? METRO_STATIONS.find((s) => s.id === curStId) : null;
          if (curSt) {
            mj.stationId = curSt.id;
            mj.stationName = curSt.name;
            mj.stationKannada = curSt.kannadaName;
            mj.elevatedStation = curSt.elevated;
            if (curSt.line !== mj.line) {
              mj.line = curSt.line;
              this.showToast(`Interchange transfer onto ${curSt.line.toUpperCase()} Line at ${curSt.name}!`);
            } else {
              this.showToast(`Station Stop: ${curSt.name} (${curSt.kannadaName})`);
            }
            mj.announcement = `ಮುಂದಿನ ನಿಲ್ದಾಣ ${curSt.kannadaName} · Now at ${curSt.name} · अगला स्टेशन ${curSt.name} · Doors Opening`;
            this.audio.playMetroChime();
            this.trainStopPauseTimer = 3.5;
          }
        }
      }

      if (mj.rideProgress >= 1) {
        mj.phase = 'arrived';
        mj.trainPhase = 'stopped';
        mj.trainSpeedKmh = 0;
        this.trainPhase = 'stopped';
        this.coachDoorOpen = 1;
        this.trainDoorOpen = 1;
        mj.trainDoorOpen = 1;
        mj.stopsRemaining = 0;
        const destLabel = mj.destinationName || 'Destination';
        mj.announcement = `ನಿಲ್ದಾಣ ಬಂತು: ${destLabel} · Arrived at ${destLabel} · गंतव्य स्टेशन आ गया है · Press [F] at doors or Exit Train!`;
        this.audio.playMetroChime();
        speakKannadaOrEnglish(mj.announcement, this.settings.language);
      }
    } else if (mj.phase === 'arrived') {
      mj.trainSpeedKmh = 0;
      mj.activeCoachIndex = getActiveCoachIndex(this.playerZ);
      this.coachDoorOpen = Math.min(1, this.coachDoorOpen + dt * 3.0);
    }

    mj.securityCleared = this.securityCleared;
    mj.smartCardOwned = this.smartCardOwned;
    mj.smartCardBalance = this.smartCardBalance;
    mj.exitGateCleared = this.exitGateCleared;
    mj.coachCount = this.metroSim.coachCount;
    mj.farePaid = this.metroFarePaid;

    this.metroSim.update({
      dt,
      elapsed: this.elapsed,
      gateUnlocked: mj.gateUnlocked,
      trainWaitSec: mj.trainWaitSec,
      trainPhase: mj.trainPhase,
      trainDoorOpen: this.trainDoorOpen,
      coachDoorOpen: this.coachDoorOpen,
      trainSpeedKmh: mj.trainSpeedKmh,
      elevatorY: this.elevatorY,
      elevatorDoorOpen: this.elevatorDoorOpen,
      isRiding: mj.phase === 'riding',
      isArrived: mj.phase === 'arrived',
      line: mj.line,
      stationName: mj.stationName,
      stationKannada: mj.stationKannada,
      destinationName: mj.destinationName || 'MG Road Metro',
      nextStopText: mj.destinationName || 'MG ROAD',
      stopsRemaining: mj.stopsRemaining,
      rideProgress: mj.rideProgress,
    });
  }

  private updateNammaYatri(dt: number): void {
    const ny = this.nammaYatri;
    const v = this.nammaYatriVehicle;
    if (!v || ny.status === 'idle') return;

    const finalX = ny.status === 'riding' ? ny.destX : this.playerX + 3.2;
    const finalZ = ny.status === 'riding' ? ny.destZ : this.playerZ + 3.2;
    const finalDist = Math.hypot(finalX - v.x, finalZ - v.z);

    if (ny.status === 'en_route_pickup' && finalDist < 6.8) {
      v.speed = 0;
      ny.status = 'waiting_pickup';
      ny.etaSec = 0;
      this.audio.playHorn(v.kind);
      const ui = getUiStrings(this.settings.language);
      const msg = ui.nammaYatriArrived(ny.driverName, ny.plateNumber);
      this.showToast(msg);
      speakKannadaOrEnglish(msg, this.settings.language);
      this.emitHud(true);
      return;
    }

    if (ny.status === 'riding' && finalDist < 10.5) {
      v.speed = 0;
      if (this.cash >= ny.fare) this.cash -= ny.fare;
      else {
        this.bankBalance = Math.max(0, this.bankBalance - ny.fare);
        this.addBankTransaction(`Namma Yatri (${ny.destName})`, -ny.fare);
      }
      this.cleanupNammaYatriDriver();
      ny.status = 'idle';
      this.nammaYatriVehicle = null;
      v.isAi = true;
      this.handleInteractOrVehicle();
      this.audio.playPickup();
      this.showToast(`Arrived at ${ny.destName} via Namma Yatri (-₹${ny.fare})!`);
      this.emitHud(true);
      return;
    }

    if (ny.status === 'en_route_pickup' || ny.status === 'riding') {
      // Follow Dijkstra road waypoints when available
      let wpX = finalX;
      let wpZ = finalZ;
      if (this.nammaYatriWaypoints.length > 0 && this.nammaYatriWpIdx < this.nammaYatriWaypoints.length) {
        const curWp = this.nammaYatriWaypoints[this.nammaYatriWpIdx];
        if (Math.hypot(curWp.x - v.x, curWp.z - v.z) < 12 && this.nammaYatriWpIdx < this.nammaYatriWaypoints.length - 1) {
          this.nammaYatriWpIdx++;
        }
        wpX = this.nammaYatriWaypoints[this.nammaYatriWpIdx].x;
        wpZ = this.nammaYatriWaypoints[this.nammaYatriWpIdx].z;
      }

      const dx = wpX - v.x;
      const dz = wpZ - v.z;
      const desired = Math.atan2(dx, dz);
      let hDiff = desired - v.heading;
      while (hDiff > Math.PI) hDiff -= Math.PI * 2;
      while (hDiff < -Math.PI) hDiff += Math.PI * 2;
      v.heading += THREE.MathUtils.clamp(hDiff, -3.2 * dt, 3.2 * dt);
      v.steerAngle = THREE.MathUtils.clamp(hDiff, -0.45, 0.45);

      let targetSpeed = ny.status === 'riding' ? (ny.rideType === 'auto' ? 23 : 31) : ny.rideType === 'auto' ? 18 : 23;

      // Chauffeur obeys 3-phase Bengaluru traffic signals & vehicle headway!
      const cycleT = this.elapsed % 24;
      const nsStop = cycleT >= 9.5;
      const ewStop = cycleT < 12 || cycleT >= 21.5;
      const isEW = Math.abs(Math.sin(v.heading)) > 0.7;
      for (const sig of this.world.trafficSignals) {
        const dSig = Math.hypot(sig.x - v.x, sig.z - v.z);
        if (dSig > 9 && dSig < 21 && (isEW ? ewStop : nsStop)) {
          targetSpeed = 0;
          break;
        }
      }
      for (const other of this.vehicles) {
        if (other === v) continue;
        const odx = other.x - v.x;
        const odz = other.z - v.z;
        const od = Math.hypot(odx, odz);
        if (od < 9.5) {
          const fwdDot = odx * Math.sin(v.heading) + odz * Math.cos(v.heading);
          if (fwdDot > 2.2) {
            targetSpeed = 0;
            break;
          }
        }
      }

      v.speed = THREE.MathUtils.damp(v.speed, targetSpeed, 5, dt);
      ny.etaSec = Math.max(1, Math.round(finalDist / Math.max(8, v.speed)));
      v.x += Math.sin(v.heading) * v.speed * dt;
      v.z += Math.cos(v.heading) * v.speed * dt;
      v.y = getFlyoverDeckY(v.x, v.z);
      v.rig.group.position.set(v.x, v.y, v.z);
      v.rig.group.rotation.y = v.heading;
      v.rig.frontSteerPivots.forEach((pv) => (pv.rotation.y = v.steerAngle));
      if (v.rig.steeringWheel) v.rig.steeringWheel.rotation.z = -v.steerAngle * 2.2;
      v.rig.wheels.forEach((w) => (w.rotation.x += v.speed * dt * 2.2));
      this.updateVehicleLights(v, targetSpeed === 0);

      // Keep seated 3D driver animating naturally
      if (this.nammaYatriDriverRig) {
        updateHumanAnimation(this.nammaYatriDriverRig, {
          pose: 'sit',
          speedNorm: 0,
          stridePhase: 0,
          elapsed: this.elapsed,
          dt,
          expression: 'neutral',
          lookYaw: THREE.MathUtils.clamp(v.steerAngle * 0.4, -0.35, 0.35),
          lookPitch: 0,
          holdingUmbrella: false,
          simulateCloth: false,
        });
      }

      // Position Player Visibly in Rear Passenger Seat!
      if (ny.status === 'riding') {
        this.movementState = 'namma_yatri_passenger';
        const seatLocal = v.rig.passengerSeatOffset.clone().applyAxisAngle(_v1.set(0, 1, 0), v.heading);
        this.playerX = v.x;
        this.playerY = v.y;
        this.playerZ = v.z;
        this.playerHeading = v.heading;
        this.playerRig.group.visible = true;
        this.playerRig.group.position.set(v.x + seatLocal.x, v.y + seatLocal.y, v.z + seatLocal.z);
        this.playerRig.group.rotation.set(0, v.heading, 0);
        updateHumanAnimation(this.playerRig, {
          pose: 'sit',
          speedNorm: 0,
          stridePhase: 0,
          elapsed: this.elapsed,
          dt,
          expression: 'neutral',
          lookYaw: Math.sin(this.elapsed * 0.5) * 0.12,
          lookPitch: 0,
          holdingUmbrella: false,
          holdingPhone: this.phoneOpen,
          protagonistId: this.playerCustom.protagonistId,
          simulateCloth: false,
        });
      }
    }
  }

  private buildColliderSpatialGrid(): void {
    this.colliderGrid.clear();
    const cell = this.colliderCellSize;
    for (const c of this.world.colliders) {
      const gx0 = Math.floor(c.minX / cell);
      const gx1 = Math.floor(c.maxX / cell);
      const gz0 = Math.floor(c.minZ / cell);
      const gz1 = Math.floor(c.maxZ / cell);
      for (let gx = gx0; gx <= gx1; gx++) {
        for (let gz = gz0; gz <= gz1; gz++) {
          const key = `${gx},${gz}`;
          let bucket = this.colliderGrid.get(key);
          if (!bucket) {
            bucket = [];
            this.colliderGrid.set(key, bucket);
          }
          bucket.push(c);
        }
      }
    }
  }

  private getVehicleFootprint(kind: VehicleKind): { halfW: number; halfL: number; wheelR: number } {
    switch (kind) {
      case 'bmtc':
        return { halfW: 1.38, halfL: 4.35, wheelR: 0.45 };
      case 'truck':
        return { halfW: 1.28, halfL: 3.45, wheelR: 0.46 };
      case 'ambulance':
      case 'delivery':
        return { halfW: 1.12, halfL: 2.5, wheelR: 0.38 };
      case 'auto':
        return { halfW: 0.88, halfL: 1.48, wheelR: 0.28 };
      case 'bike':
      case 'police_bike':
      case 'scooter':
        return { halfW: 0.48, halfL: 1.05, wheelR: 0.3 };
      default:
        return { halfW: 1.08, halfL: 2.15, wheelR: 0.36 };
    }
  }

  private resolveVehicleWorldCollision(
    x: number,
    z: number,
    heading: number,
    kind: VehicleKind,
    y: number
  ): { x: number; z: number; hitBuilding: boolean; hitGuardrail: boolean; inDeepWater: boolean } {
    const fp = this.getVehicleFootprint(kind);
    const sinH = Math.sin(heading);
    const cosH = Math.cos(heading);
    const offsets = fp.halfL > fp.halfW * 1.4 ? [fp.halfL * 0.64, 0, -fp.halfL * 0.64] : [0];

    let curX = x;
    let curZ = z;
    let hitBuilding = false;

    for (const off of offsets) {
      const sx = curX + sinH * off;
      const sz = curZ + cosH * off;
      const [rx, rz] = this.resolveBuildingCollision(sx, sz, fp.halfW, y);
      const dx = rx - sx;
      const dz = rz - sz;
      if (dx * dx + dz * dz > 0.0009) {
        curX += dx;
        curZ += dz;
        hitBuilding = true;
      }
    }

    const guard = constrainToFlyoverGuardrails(
      curX,
      curZ,
      y,
      fp.halfW,
      this.getAllRoads(),
      SILK_BOARD_FLYOVER_LOOP
    );
    let hitGuardrail = false;
    if (guard.hit) {
      curX = guard.x;
      curZ = guard.z;
      hitGuardrail = true;
    }

    let inDeepWater = false;
    const water = isPointInWater(curX, curZ);
    if (water) {
      const wx = (curX - water.x) / water.rx;
      const wz = (curZ - water.z) / water.rz;
      const norm = Math.hypot(wx, wz);
      if (norm < 0.78) {
        const scale = 0.78 / Math.max(0.05, norm);
        curX = water.x + (curX - water.x) * scale;
        curZ = water.z + (curZ - water.z) * scale;
        inDeepWater = true;
      }
    }

    return { x: curX, z: curZ, hitBuilding, hitGuardrail, inDeepWater };
  }

  private resolveBuildingCollision(x: number, z: number, radius: number, currentY: number): [number, number] {
    if (this.metroJourney.phase !== 'none') {
      let nx = x;
      let nz = z;
      // Enforce mandatory Security Bag & Metal Check Arch (z = -1197.2)
      if (!this.securityCleared && this.playerZ >= -1197.2 && nz - radius < -1197.2 && Math.abs(nx) < 12) {
        if (Math.abs(nx) < 2.2) {
          this.scanSecurityGate();
        } else {
          nz = -1197.2 + radius;
          if (!this.toastMessage) {
            this.showToast('Pass through the Security X-Ray & Metal Check Arch [F] before entering Fare Gates!');
          }
        }
      }
      // Enforce QR / Smart Card gate barrier until scanned (z = -1206)
      if (!this.metroJourney.gateUnlocked && this.playerZ >= -1205.8 && nz - radius < -1205.7 && Math.abs(nx) < 7.8) {
        nz = -1205.7 + radius;
        if (!this.toastMessage) {
          this.showToast('Scan QR Ticket or Smart Card at the Gate [F] before entering Escalators / Platform!');
        }
      }
      // Enforce Exit Gate tap-out after riding Metro when returning south across concourse gates
      if (this.hasRiddenMetro && !this.exitGateCleared && this.playerZ < -1205.2 && nz + radius > -1205.0 && Math.abs(nx) < 12) {
        if (nx > 2.8 && nx < 8.5) {
          this.scanExitGate();
        } else {
          nz = -1205.0 - radius;
          if (!this.toastMessage) {
            this.showToast('Tap QR / Smart Card at Exit Gate (right lane) [F] before leaving concourse!');
          }
        }
      }
      // Keep rider safely inside glass elevator cab while doors are closed / lift moving
      if (this.metroJourney.elevatorMoving && Math.abs(this.playerX - this.metroSim.elevatorCabCenter.x) < 2.2 && Math.abs(this.playerZ - this.metroSim.elevatorCabCenter.z) < 2.2) {
        const ex = this.metroSim.elevatorCabCenter.x;
        const ez = this.metroSim.elevatorCabCenter.z;
        nx = THREE.MathUtils.clamp(nx, ex - 1.35, ex + 1.35);
        nz = THREE.MathUtils.clamp(nz, ez - 1.35, ez + 1.35);
      }
      for (const c of this.metroSim.colliders) {
        if (nx + radius > c.minX && nx - radius < c.maxX && nz + radius > c.minZ && nz - radius < c.maxZ) {
          const dxL = Math.abs(nx + radius - c.minX);
          const dxR = Math.abs(c.maxX - (nx - radius));
          const dzT = Math.abs(nz + radius - c.minZ);
          const dzB = Math.abs(c.maxZ - (nz - radius));
          const minPen = Math.min(dxL, dxR, dzT, dzB);
          if (minPen === dxL) nx = c.minX - radius;
          else if (minPen === dxR) nx = c.maxX + radius;
          else if (minPen === dzT) nz = c.minZ - radius;
          else nz = c.maxZ + radius;
        }
      }
      return [nx, nz];
    }
    if (this.activeInterior) {
      const pocket = this.interiors.pockets[this.activeInterior];
      let nx = x;
      let nz = z;
      for (const c of pocket.colliders) {
        if (nx + radius > c.minX && nx - radius < c.maxX && nz + radius > c.minZ && nz - radius < c.maxZ) {
          const dxL = Math.abs(nx + radius - c.minX);
          const dxR = Math.abs(c.maxX - (nx - radius));
          const dzT = Math.abs(nz + radius - c.minZ);
          const dzB = Math.abs(c.maxZ - (nz - radius));
          const minPen = Math.min(dxL, dxR, dzT, dzB);
          if (minPen === dxL) nx = c.minX - radius;
          else if (minPen === dxR) nx = c.maxX + radius;
          else if (minPen === dzT) nz = c.minZ - radius;
          else nz = c.maxZ + radius;
        }
      }
      return [nx, nz];
    }

    let nx = THREE.MathUtils.clamp(x, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
    let nz = THREE.MathUtils.clamp(z, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);

    const cell = this.colliderCellSize;
    const gx0 = Math.floor((nx - radius - 2) / cell);
    const gx1 = Math.floor((nx + radius + 2) / cell);
    const gz0 = Math.floor((nz - radius - 2) / cell);
    const gz1 = Math.floor((nz + radius + 2) / cell);
    const checked = new Set<BuildingCollider>();

    for (let gx = gx0; gx <= gx1; gx++) {
      for (let gz = gz0; gz <= gz1; gz++) {
        const bucket = this.colliderGrid.get(`${gx},${gz}`);
        if (!bucket) continue;
        for (const c of bucket) {
          if (checked.has(c)) continue;
          checked.add(c);
          if (currentY > c.height + 0.5) continue;

          if (
            c.rotationY &&
            Math.abs(c.rotationY) > 1e-4 &&
            c.cx !== undefined &&
            c.cz !== undefined &&
            c.halfW !== undefined &&
            c.halfD !== undefined
          ) {
            const cosR = Math.cos(c.rotationY);
            const sinR = Math.sin(c.rotationY);
            const dx = nx - c.cx;
            const dz = nz - c.cz;
            const lx = dx * cosR - dz * sinR;
            const lz = dx * sinR + dz * cosR;
            const clx = Math.max(-c.halfW, Math.min(c.halfW, lx));
            const clz = Math.max(-c.halfD, Math.min(c.halfD, lz));
            const dlx = lx - clx;
            const dlz = lz - clz;
            const dSq = dlx * dlx + dlz * dlz;
            if (dSq < radius * radius) {
              let nlx = lx;
              let nlz = lz;
              if (dSq > 1e-8) {
                const d = Math.sqrt(dSq);
                nlx = clx + (dlx / d) * radius;
                nlz = clz + (dlz / d) * radius;
              } else {
                const penX = c.halfW - Math.abs(lx);
                const penZ = c.halfD - Math.abs(lz);
                if (penX < penZ) nlx = (lx >= 0 ? 1 : -1) * (c.halfW + radius);
                else nlz = (lz >= 0 ? 1 : -1) * (c.halfD + radius);
              }
              nx = c.cx + nlx * cosR + nlz * sinR;
              nz = c.cz - nlx * sinR + nlz * cosR;
            }
          } else {
            const cx = Math.max(c.minX, Math.min(c.maxX, nx));
            const cz = Math.max(c.minZ, Math.min(c.maxZ, nz));
            const dx = nx - cx;
            const dz = nz - cz;
            const dSq = dx * dx + dz * dz;
            if (dSq < radius * radius) {
              if (dSq > 1e-8) {
                const d = Math.sqrt(dSq);
                nx = cx + (dx / d) * radius;
                nz = cz + (dz / d) * radius;
              } else {
                const dxL = Math.abs(nx + radius - c.minX);
                const dxR = Math.abs(c.maxX - (nx - radius));
                const dzT = Math.abs(nz + radius - c.minZ);
                const dzB = Math.abs(c.maxZ - (nz - radius));
                const minPen = Math.min(dxL, dxR, dzT, dzB);
                if (minPen === dxL) nx = c.minX - radius;
                else if (minPen === dxR) nx = c.maxX + radius;
                else if (minPen === dzT) nz = c.minZ - radius;
                else nz = c.maxZ + radius;
              }
            }
          }
        }
      }
    }
    return [nx, nz];
  }

  private updateStudioShowcase(dt: number): void {
    let pose: HumanPoseState = 'idle';
    let expr: FacialExpression = 'neutral';
    let speedNorm = 0;

    if (this.studioPose === 'walk') {
      pose = 'walk';
      speedNorm = 0.6;
      this.playerStridePhase += 6.2 * dt;
    } else if (this.studioPose === 'run') {
      pose = 'run';
      speedNorm = 0.95;
      this.playerStridePhase += 10.5 * dt;
    } else if (this.studioPose === 'talk') {
      pose = 'talk';
      expr = 'talking';
    } else if (this.studioPose === 'laugh') {
      pose = 'idle';
      expr = 'laugh';
    } else if (this.studioPose === 'anger') {
      pose = 'idle';
      expr = 'anger';
    } else if (this.studioPose === 'fear') {
      pose = 'react_fear';
      expr = 'fear';
    } else if (this.studioPose === 'fight') {
      pose = 'fight';
      expr = 'anger';
    }

    const wind = this.getCurrentWind();
    const clothCtx: ClothUpdateContext = {
      dt,
      windX: wind.wx * 1.4,
      windZ: wind.wz * 1.4,
      charVelX: Math.sin(this.playerHeading) * speedNorm * 6,
      charVelZ: Math.cos(this.playerHeading) * speedNorm * 6,
      charHeading: this.playerHeading,
      strideSpeed: speedNorm,
      elapsed: this.elapsed,
    };

    updateHumanAnimation(this.playerRig, {
      pose,
      speedNorm,
      stridePhase: this.playerStridePhase,
      elapsed: this.elapsed,
      dt,
      expression: expr,
      lookYaw: Math.sin(this.elapsed * 0.6) * 0.18,
      lookPitch: 0,
      holdingUmbrella: false,
      protagonistId: this.playerCustom.protagonistId,
      clothCtx,
      simulateCloth: true,
    });
    this.playerRig.group.position.set(this.playerX, this.playerY, this.playerZ);
    this.playerRig.group.rotation.set(0, this.playerHeading, 0);
  }

  private updatePlayerOnFoot(dt: number): void {
    let moveFwd = 0;
    let moveRight = 0;
    if (!this.boardingTransition) {
      if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveFwd += 1;
      if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveFwd -= 1;
      if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveRight -= 1;
      if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveRight += 1;
    }

    const inPocket = !!this.activeInterior || this.metroJourney.phase !== 'none';
    const water = inPocket ? null : isPointInWater(this.playerX, this.playerZ);
    this.isSwimming = !!water && this.playerY <= getGradedTerrainY(this.playerX, this.playerZ) + 0.5;

    const wantsSprint = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const sprinting = wantsSprint && this.stamina > 4 && (moveFwd !== 0 || moveRight !== 0);
    if (sprinting) {
      this.stamina = Math.max(0, this.stamina - 16 * dt);
    } else {
      this.stamina = Math.min(100, this.stamina + 12 * dt);
    }

    const baseSpeed = this.dodgeTimer > 0
      ? 14.5
      : this.isSwimming
      ? 4.8
      : this.isCrouching
      ? 3.5
      : sprinting
      ? 11.8
      : inPocket
      ? 4.8
      : 6.6;

    let pose: HumanPoseState = 'idle';
    let speedNorm = 0;

    if (this.boardingTransition) {
      this.playerStridePhase += 5.5 * dt;
      pose = 'walk';
      speedNorm = 0.65;
    } else if (moveFwd !== 0 || moveRight !== 0 || this.dodgeTimer > 0) {
      this.isSitting = false;
      this.holdingRail = false;
      this.metroJourney.holdingRail = false;
      const viewAngle = this.cameraMode === 'closeup' ? this.playerHeading : this.playerHeading + this.camYawOffset;
      const viewDirX = Math.sin(viewAngle);
      const viewDirZ = Math.cos(viewAngle);
      const rightDirX = Math.cos(viewAngle);
      const rightDirZ = -Math.sin(viewAngle);

      let vx = this.dodgeTimer > 0 && moveFwd === 0 && moveRight === 0 ? -viewDirX : viewDirX * moveFwd + rightDirX * moveRight;
      let vz = this.dodgeTimer > 0 && moveFwd === 0 && moveRight === 0 ? -viewDirZ : viewDirZ * moveFwd + rightDirZ * moveRight;
      const len = Math.hypot(vx, vz) || 1;
      vx /= len;
      vz /= len;

      if (this.dodgeTimer <= 0) {
        const targetHeading = Math.atan2(vx, vz);
        let hDiff = targetHeading - this.playerHeading;
        while (hDiff > Math.PI) hDiff -= Math.PI * 2;
        while (hDiff < -Math.PI) hDiff += Math.PI * 2;
        this.playerHeading += hDiff * Math.min(1, 12 * dt);
      }

      if (this.cameraMode !== 'closeup') {
        this.camYawOffset = THREE.MathUtils.damp(this.camYawOffset, 0, 2.2, dt);
      }

      const prevX = this.playerX;
      const prevZ = this.playerZ;
      const nextX = this.playerX + vx * baseSpeed * dt;
      const nextZ = this.playerZ + vz * baseSpeed * dt;
      const [rx, rz] = this.resolveBuildingCollision(nextX, nextZ, 0.55, this.playerY);
      this.playerX = rx;
      this.playerZ = rz;
      this.playerVx = (rx - prevX) / Math.max(0.001, dt);
      this.playerVz = (rz - prevZ) / Math.max(0.001, dt);

      const distMoved = Math.hypot(this.playerX - prevX, this.playerZ - prevZ);
      this.playerStridePhase += distMoved * (sprinting ? 1.75 : 2.1);
      this.footstepAccum += distMoved;
      if (this.footstepAccum > (sprinting ? 2.1 : 1.75) && this.isGrounded && !this.isSwimming) {
        this.footstepAccum = 0;
        this.audio.playFootstep(!inPocket && !isPointOnRoad(this.playerX, this.playerZ));
      }

      speedNorm = sprinting ? 1.0 : 0.6;
      pose =
        this.dodgeTimer > 0
          ? 'dodge'
          : this.kickTimer > 0
          ? 'kick'
          : this.isBlocking
          ? 'block'
          : this.isSwimming
          ? 'swim'
          : this.isCrouching
          ? 'crouch'
          : sprinting
          ? 'sprint'
          : 'walk';
    } else {
      this.playerVx = 0;
      this.playerVz = 0;
      pose =
        this.hitReactTimer > 0
          ? 'hit_react'
          : this.kickTimer > 0
          ? 'kick'
          : this.isBlocking
          ? 'block'
          : this.eatTimer > 0
          ? 'eat'
          : this.isSwimming
          ? 'swim'
          : this.isSitting
          ? 'sit'
          : this.holdingRail
          ? 'talk'
          : this.isCrouching
          ? 'crouch'
          : 'idle';
    }

    const inStation = this.metroJourney.phase !== 'none';
    const onStairs = inStation && this.metroSim.isOnStairs(this.playerX, this.playerZ);
    const escMove = inStation ? this.metroSim.getEscalatorMove(this.playerX, this.playerY, this.playerZ) : null;
    this.metroJourney.onEscalator = escMove ? escMove.dir : null;
    if (escMove) {
      const nextZ = this.playerZ + escMove.speedZ * dt;
      const [rx, rz] = this.resolveBuildingCollision(this.playerX, nextZ, 0.55, this.playerY);
      this.playerX = rx;
      this.playerZ = rz;
    }

    if (this.keys.has('Space') && this.isGrounded && !this.isSwimming && !escMove) {
      this.playerVy = 8.4;
      this.isGrounded = false;
      this.isCrouching = false;
      this.isSitting = false;
    }
    const groundY = inStation
      ? this.metroSim.getFloorY(this.playerX, this.playerZ, this.elevatorY)
      : this.activeInterior
      ? this.interiors.pockets[this.activeInterior].floorY
      : getFlyoverDeckY(this.playerX, this.playerZ);

    const ridingElev =
      inStation &&
      this.metroJourney.elevatorMoving &&
      Math.abs(this.playerX - this.metroSim.elevatorCabCenter.x) < 2.0 &&
      Math.abs(this.playerZ - this.metroSim.elevatorCabCenter.z) < 2.0;

    if (ridingElev) {
      this.playerY = this.elevatorY;
      this.playerVy = 0;
      this.isGrounded = true;
    } else {
      this.playerVy -= 21 * dt;
      this.playerY += this.playerVy * dt;
      if (this.playerY <= groundY) {
        this.playerY = groundY;
        this.playerVy = 0;
        this.isGrounded = true;
      }
    }

    if (onStairs && (moveFwd !== 0 || moveRight !== 0)) {
      pose = 'climb_stairs';
    }

    this.movementState = inStation && this.metroJourney.phase === 'riding'
      ? 'metro_riding'
      : ridingElev
      ? 'elevator_riding'
      : escMove
      ? `escalator_${escMove.dir}`
      : onStairs
      ? 'climbing_stairs'
      : pose;

    const isRaining =
      !inPocket &&
      (this.settings.weather === 'light_rain' ||
        this.settings.weather === 'monsoon' ||
        this.settings.weather === 'thunderstorm');

    const wind = inPocket ? { wx: 0.2, wz: 0.1 } : this.getCurrentWind();
    const clothCtx: ClothUpdateContext = {
      dt,
      windX: wind.wx,
      windZ: wind.wz,
      charVelX: this.playerVx,
      charVelZ: this.playerVz,
      charHeading: this.playerHeading,
      strideSpeed: speedNorm,
      elapsed: this.elapsed,
    };

    const terrainSlopePitch = inPocket
      ? onStairs
        ? 0.28
        : 0
      : THREE.MathUtils.clamp(
          (getFlyoverDeckY(this.playerX + Math.sin(this.playerHeading) * 0.32, this.playerZ + Math.cos(this.playerHeading) * 0.32) -
            getFlyoverDeckY(this.playerX - Math.sin(this.playerHeading) * 0.32, this.playerZ - Math.cos(this.playerHeading) * 0.32)) *
            0.65,
          -0.35,
          0.35
        );

    updateHumanAnimation(this.playerRig, {
      pose,
      speedNorm,
      stridePhase: this.playerStridePhase,
      elapsed: this.elapsed,
      dt,
      expression: this.wantedStars > 0 || this.punchTimer > 0 || this.kickTimer > 0 ? 'focused' : 'neutral',
      lookYaw: this.cameraMode === 'closeup' ? Math.sin(this.elapsed * 0.7) * 0.25 : 0,
      lookPitch: 0,
      holdingUmbrella: isRaining && !sprinting && this.weapon === 'unarmed' && !this.isSitting,
      holdingPhone:
        this.phoneOpen &&
        !this.isSitting &&
        !this.isSwimming &&
        this.weapon === 'unarmed' &&
        this.punchTimer <= 0 &&
        this.kickTimer <= 0,
      punchTimer: this.punchTimer,
      kickTimer: this.kickTimer,
      protagonistId: this.playerCustom.protagonistId,
      clothCtx,
      simulateCloth: true,
      terrainSlopePitch,
    });

    this.playerRig.group.rotation.x = THREE.MathUtils.damp(
      this.playerRig.group.rotation.x,
      this.isSwimming ? 1.1 : 0,
      8,
      dt
    );
    this.playerRig.group.position.set(
      this.playerX,
      this.isSwimming ? groundY - 0.35 : this.playerY,
      this.playerZ
    );
    this.playerRig.group.rotation.y = this.playerHeading;
  }

  private updatePlayerDriving(dt: number): void {
    const v = this.activeVehicle!;
    if (this.nammaYatri.status === 'riding' && v === this.nammaYatriVehicle) {
      return; // Namma Yatri chauffeur controls driving automatically; player controls locked
    }
    this.movementState = 'driving';
    const spec = VEHICLE_SPECS[v.kind];
    const engineBoost = 1 + (this.vehicleTuning.engineLevel - 1) * 0.14;
    const handlingBoost = 1 + (this.vehicleTuning.handlingLevel - 1) * 0.14;
    const maxSpd = spec.maxSpeed * engineBoost;

    let throttle = 0;
    let steer = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) throttle += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) throttle -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) steer += 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) steer -= 1;
    const handbrake = this.keys.has('Space');
    const nitro = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');

    const isWet =
      this.settings.weather === 'light_rain' ||
      this.settings.weather === 'monsoon' ||
      this.settings.weather === 'thunderstorm';
    const gripMult = isWet ? 0.84 : 1.0;

    v.prevSpeed = v.speed;
    if (v.fuel <= 0) {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 4.0, dt);
      if (throttle !== 0 && !this.toastMessage) {
        this.showToast('Out of fuel! Refuel at Silk Board, Indiranagar, Whitefield or Hebbal Pump.');
      }
    } else if (throttle > 0) {
      v.speed += spec.accel * engineBoost * (nitro ? 1.25 : 1) * dt;
    } else if (throttle < 0) {
      if (v.speed > 1) v.speed -= spec.brake * dt;
      else v.speed -= spec.accel * 0.55 * dt;
    } else {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 1.8, dt);
    }

    if (Math.abs(v.speed) > 1.5 && v.fuel > 0) {
      v.fuel = Math.max(0, v.fuel - spec.fuelConsumption * (Math.abs(v.speed) / 25) * dt);
    }

    if (handbrake) {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 5.5, dt);
    }

    v.speed = THREE.MathUtils.clamp(v.speed, -maxSpd * 0.35, maxSpd * (nitro ? 1.15 : 1));

    const speedFactor = Math.min(1, Math.abs(v.speed) / 8);
    const steerSign = v.speed >= -0.1 ? 1 : -1;
    v.steerAngle = THREE.MathUtils.damp(v.steerAngle, steer * 0.45, 10, dt);
    v.heading += steer * spec.turnRate * handlingBoost * gripMult * speedFactor * steerSign * dt;

    const accelDelta = (v.speed - v.prevSpeed) / Math.max(0.001, dt);
    const targetPitch = THREE.MathUtils.clamp(-accelDelta * 0.0022, -0.065, 0.065);
    const targetRoll =
      (v.kind === 'bike' || v.kind === 'police_bike' ? -0.36 : 0.085) * steer * speedFactor;
    v.pitchSpring = THREE.MathUtils.damp(v.pitchSpring, targetPitch, 9, dt);
    v.rollSpring = THREE.MathUtils.damp(v.rollSpring, targetRoll, 8, dt);

    const prevX = v.x;
    const prevZ = v.z;
    const nextX = v.x + Math.sin(v.heading) * v.speed * dt;
    const nextZ = v.z + Math.cos(v.heading) * v.speed * dt;
    const worldCol = this.resolveVehicleWorldCollision(nextX, nextZ, v.heading, v.kind, v.y);
    let rx = worldCol.x;
    let rz = worldCol.z;

    if ((worldCol.hitBuilding || worldCol.hitGuardrail) && Math.abs(v.speed) > 9) {
      this.audio.playImpact(Math.abs(v.speed) / maxSpd);
      v.health = Math.max(10, v.health - Math.abs(v.speed) * (worldCol.hitGuardrail ? 0.18 : 0.35));
      v.speed *= worldCol.hitGuardrail ? 0.65 : 0.45;
    } else if (worldCol.inDeepWater) {
      v.speed *= 0.68;
    }

    const myFp = this.getVehicleFootprint(v.kind);
    const myEffR = (myFp.halfW + myFp.halfL) * 0.48;
    for (const other of this.vehicles) {
      if (other === v) continue;
      const otherFp = this.getVehicleFootprint(other.kind);
      const minD = myEffR + (otherFp.halfW + otherFp.halfL) * 0.48;
      const dx = rx - other.x;
      const dz = rz - other.z;
      const dist = Math.hypot(dx, dz);
      if (dist < minD && Math.abs(v.y - other.y) < 2.8) {
        const sepX = dist > 0.01 ? dx / dist : Math.sin(v.heading);
        const sepZ = dist > 0.01 ? dz / dist : Math.cos(v.heading);
        const overlap = minD - dist;
        rx += sepX * overlap * 0.72;
        rz += sepZ * overlap * 0.72;
        if (!other.isPolice) {
          other.x -= sepX * overlap * 0.28;
          other.z -= sepZ * overlap * 0.28;
        }
        [rx, rz] = this.resolveBuildingCollision(rx, rz, myFp.halfW, v.y);

        if (Math.abs(v.speed) > 12) {
          this.audio.playImpact(0.7);
          other.speed = v.speed * 0.5;
          v.speed *= 0.55;
          if (other.isPolice || Math.abs(v.speed) > 18) {
            this.addWantedStars(other.isPolice ? 2 : 1);
          }
        } else {
          v.speed *= 0.78;
        }
      }
    }

    v.x = rx;
    v.z = rz;
    const targetY = getFlyoverDeckY(v.x, v.z);
    v.y = THREE.MathUtils.damp(v.y, targetY, 16, dt);

    v.rig.group.position.set(v.x, v.y, v.z);
    v.rig.group.rotation.y = v.heading;
    v.rig.chassisGroup.rotation.x = v.pitchSpring;
    v.rig.chassisGroup.rotation.z = v.rollSpring;

    const wheelDelta = (Math.hypot(v.x - prevX, v.z - prevZ) * Math.sign(v.speed)) / myFp.wheelR;
    v.rig.wheels.forEach((w) => (w.rotation.x += wheelDelta));
    v.rig.frontSteerPivots.forEach((pv) => (pv.rotation.y = v.steerAngle));
    if (v.rig.steeringWheel) {
      v.rig.steeringWheel.rotation.z = -v.steerAngle * 2.2;
    }
    const wiperAngle = isWet ? Math.sin(this.elapsed * 7.5) * 0.55 : 0.45;
    v.rig.wipers.forEach((wp) => (wp.rotation.z = wiperAngle));

    const blink = Math.floor(this.elapsed * 4) % 2 === 0;
    v.rig.leftIndicators.forEach((m) => {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = steer > 0.2 && blink ? 2.2 : 0.05;
    });
    v.rig.rightIndicators.forEach((m) => {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = steer < -0.2 && blink ? 2.2 : 0.05;
    });

    if (isWet && Math.abs(v.speed) > 14 && Math.random() < 0.45) {
      const drop = new THREE.Mesh(
        new THREE.SphereGeometry(0.11, 5, 5),
        new THREE.MeshBasicMaterial({ color: 0xe2e8f0, transparent: true, opacity: 0.6 })
      );
      drop.position.set(v.x - Math.sin(v.heading) * 1.6, v.y + 0.25, v.z - Math.cos(v.heading) * 1.6);
      this.scene.add(drop);
      this.splashParticles.push({
        mesh: drop,
        vx: (Math.random() - 0.5) * 3,
        vy: 1.8 + Math.random() * 1.8,
        vz: (Math.random() - 0.5) * 3,
        life: 0.38,
      });
    }

    this.updateVehicleLights(v, throttle < 0 || handbrake);

    this.playerX = v.x;
    this.playerY = v.y;
    this.playerZ = v.z;
    this.playerHeading = v.heading;
    if (this.cameraMode !== 'cockpit') {
      this.camYawOffset = THREE.MathUtils.damp(this.camYawOffset, 0, 1.4, dt);
    }
  }

  private updateSplashParticles(dt: number): void {
    for (let i = this.splashParticles.length - 1; i >= 0; i--) {
      const p = this.splashParticles[i];
      p.life -= dt;
      p.vy -= 9 * dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.y += p.vy * dt;
      p.mesh.position.z += p.vz * dt;
      if (p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.splashParticles.splice(i, 1);
      }
    }
  }

  private updateVehicleLights(v: SimVehicle, braking: boolean): void {
    const isNight = this.timeOfDayHours < 6.5 || this.timeOfDayHours >= 18.5;
    const hlIntensity = this.headlightsOn ? (isNight ? 2.2 : 0.65) : 0.05;
    v.rig.headlights.forEach((m) => {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = hlIntensity;
    });
    v.rig.taillights.forEach((m) => {
      (m.material as THREE.MeshStandardMaterial).emissiveIntensity = braking ? 2.2 : 0.35;
    });
  }

  private updateTrafficSignals(): void {
    const t = this.elapsed % 24;
    const nsG = t < 9.5;
    const nsY = t >= 9.5 && t < 12;
    const nsR = t >= 12;
    const ewR = t < 12;
    const ewG = t >= 12 && t < 21.5;
    const ewY = t >= 21.5;

    for (const sig of this.world.trafficSignals) {
      (sig.nsGreen.material as THREE.MeshStandardMaterial).emissiveIntensity = nsG ? 2.4 : 0.08;
      (sig.nsYellow.material as THREE.MeshStandardMaterial).emissiveIntensity = nsY ? 2.4 : 0.08;
      (sig.nsRed.material as THREE.MeshStandardMaterial).emissiveIntensity = nsR ? 2.4 : 0.08;
      (sig.ewGreen.material as THREE.MeshStandardMaterial).emissiveIntensity = ewG ? 2.4 : 0.08;
      (sig.ewYellow.material as THREE.MeshStandardMaterial).emissiveIntensity = ewY ? 2.4 : 0.08;
      (sig.ewRed.material as THREE.MeshStandardMaterial).emissiveIntensity = ewR ? 2.4 : 0.08;
    }
  }

  private updateAiVehicles(dt: number): void {
    const rushHour =
      (this.timeOfDayHours >= 7.5 && this.timeOfDayHours <= 11.5) ||
      (this.timeOfDayHours >= 16.5 && this.timeOfDayHours <= 21.2);
    const baseDensity =
      this.settings.trafficDensity === 'low'
        ? 44
        : this.settings.trafficDensity === 'medium'
        ? 78
        : 108;
    const densityLimit = Math.round(baseDensity * (rushHour ? 1.0 : 0.8));
    const cycleT = this.elapsed % 24;
    const nsStop = cycleT >= 9.5;
    const nsYellow = cycleT >= 9.5 && cycleT < 12;
    const ewStop = cycleT < 12 || cycleT >= 21.5;
    const ewYellow = cycleT >= 21.5;

    const busHubs = RAIL_BUS_STATIONS.filter((s) => s.kind === 'bus');
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    const drivableRoads = ROAD_SEGMENTS.filter((r) => r.kind !== 'metro' && r.kind !== 'flyover' && r.points.length >= 2);
    const blink = Math.floor(this.elapsed * 4) % 2 === 0;

    // Evaluate dynamic Bengaluru congestion zones by IST time + vehicle clustering
    const zoneScores = CONGESTION_ZONES.map((z) => {
      const center = getDistrictCenter(z.zoneId);
      const inPeakWindow = z.peakHours.some(
        ([startH, endH]) => this.timeOfDayHours >= startH && this.timeOfDayHours <= endH
      );
      let count = 0;
      for (const veh of this.vehicles) {
        if (Math.hypot(veh.x - center.x, veh.z - center.z) < z.radius) count++;
      }
      const densityBoost = this.settings.trafficDensity === 'high' ? 1.25 : this.settings.trafficDensity === 'low' ? 0.55 : 1.0;
      const peakMult = inPeakWindow ? 1.15 : 0.45;
      const intensity = z.baseWeight * peakMult * densityBoost * (0.65 + Math.min(0.6, count * 0.04));
      const playerDist = Math.hypot(px - center.x, pz - center.z);
      return { z, center, inPeakWindow, count, intensity, playerDist };
    });

    const nearZone = zoneScores
      .filter((zs) => zs.playerDist < zs.z.radius * 1.4)
      .sort((a, b) => a.playerDist - b.playerDist)[0];
    const hottestZone = [...zoneScores].sort((a, b) => b.intensity - a.intensity)[0];
    const displayZone = nearZone || hottestZone;

    if (displayZone) {
      const severity: TrafficCongestionState['severity'] =
        displayZone.intensity >= 0.85 ? 'heavy' : displayZone.intensity >= 0.52 ? 'moderate' : 'light';
      const speedFactor = severity === 'heavy' ? 0.35 : severity === 'moderate' ? 0.58 : 1.0;
      this.trafficCongestion = {
        active: Boolean(nearZone ? severity !== 'light' || rushHour : displayZone.intensity >= 0.65),
        zoneId: displayZone.z.zoneId,
        zoneName: displayZone.z.zoneName,
        severity,
        speedFactor,
        vehicleCount: displayZone.count,
        reason: displayZone.z.reason,
      };
    }

    const activeEmergencyVehicles = this.vehicles.filter(
      (ev) => ev.kind === 'ambulance' || (ev.isPolice && this.wantedStars > 0)
    );
    const playerEmergency =
      this.activeVehicle &&
      (this.activeVehicle.kind === 'ambulance' ||
        this.activeVehicle.kind === 'police_suv' ||
        this.activeVehicle.kind === 'police_bike');

    let aiCounter = 0;
    for (const v of this.vehicles) {
      if (!v.isAi) continue;
      aiCounter++;
      const distToPlayer = Math.hypot(v.x - px, v.z - pz);

      // Relocate distant civilian traffic onto nearby Bengaluru roads so city stays lively everywhere
      if (!v.isPolice && v !== this.nammaYatriVehicle && distToPlayer > 920 && drivableRoads.length > 0) {
        const nearbyRoads = drivableRoads.filter((r) =>
          r.points.some((pt) => Math.hypot(pt.x - px, pt.z - pz) < 420)
        );
        const pool = nearbyRoads.length > 0 ? nearbyRoads : drivableRoads;
        const picked = pool[aiCounter % pool.length];
        const pts = getSampledRoadSpine(picked).points;
        const segIdx = Math.floor(Math.random() * Math.max(1, pts.length - 1));
        const a = pts[segIdx];
        const b = pts[segIdx + 1];
        const t = 0.2 + Math.random() * 0.6;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const dir: 1 | -1 = picked.oneWay ? 1 : v.aiDir;
        const fp = this.getVehicleFootprint(v.kind);
        const maxLane = Math.max(1.3, picked.width * 0.5 - fp.halfW - 0.55);
        const desiredLane = v.kind === 'bike' || v.kind === 'scooter' ? 2.15 : 3.45;
        v.aiDir = dir;
        v.laneOffset = -dir * Math.min(desiredLane, maxLane);
        v.overtakeShift = 0;
        v.roadSeg = picked;
        v.roadPoints = pts;
        v.roadSegIdx = segIdx;
        v.roadT = t;
        v.x = a.x + dx * t + (-dz / len) * v.laneOffset;
        v.z = a.z + dz * t + (dx / len) * v.laneOffset;
        v.heading = Math.atan2(dx * dir, dz * dir);
      }

      const visible = (v.isPolice || aiCounter <= densityLimit) && Math.hypot(v.x - px, v.z - pz) < 620;
      v.rig.group.visible = visible;
      if (!visible) continue;

      if (v.disabledTimer > 0) {
        v.disabledTimer -= dt;
        continue;
      }

      const spec = VEHICLE_SPECS[v.kind];

      // Flashing emergency lightbars for active police units & ambulances
      if (v.rig.policeLights && ((v.isPolice && this.wantedStars > 0) || v.kind === 'ambulance')) {
        const flash = Math.floor(this.elapsed * 9) % 2 === 0;
        (v.rig.policeLights.red.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 2.6 : 0.1;
        (v.rig.policeLights.blue.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.1 : 2.6;
      } else if (v.rig.policeLights) {
        (v.rig.policeLights.red.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
        (v.rig.policeLights.blue.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.12;
      }

      if (v.isPolice && this.wantedStars > 0) {
        // Freeze active ramming during officer disembarkation/arrest/escort
        if (this.arrestStage !== 'none' && this.arrestStage !== 'pursuit') {
          v.speed = THREE.MathUtils.damp(v.speed, 0, 8, dt);
          this.updateVehicleLights(v, true);
          v.y = getFlyoverDeckY(v.x, v.z);
          v.rig.group.position.set(v.x, v.y, v.z);
          v.rig.group.rotation.y = v.heading;
          continue;
        }

        // Road-following coordinated police pursuit & blocking intercept
        const pHeading = this.activeVehicle ? this.activeVehicle.heading : this.playerHeading;
        const unitIdx = this.vehicles.filter((u) => u.isPolice).indexOf(v);
        const leadDist = unitIdx % 2 === 1 && distToPlayer > 16 ? 18 : 0;
        const targetX = this.playerX + Math.sin(pHeading) * leadDist;
        const targetZ = this.playerZ + Math.cos(pHeading) * leadDist;

        v.pursuitRepathTimer = (v.pursuitRepathTimer ?? 0) - dt;
        if (!v.pursuitWaypoints || v.pursuitWaypoints.length === 0 || v.pursuitRepathTimer <= 0) {
          v.pursuitWaypoints = this.router.findRoadWaypoints(v.x, v.z, targetX, targetZ);
          v.pursuitWpIdx = 0;
          v.pursuitRepathTimer = 0.9;
        }

        let navX = targetX;
        let navZ = targetZ;
        if (distToPlayer > 22 && v.pursuitWaypoints && v.pursuitWaypoints.length > 0) {
          const idx = Math.min(v.pursuitWpIdx ?? 0, v.pursuitWaypoints.length - 1);
          const wp = v.pursuitWaypoints[idx];
          if (Math.hypot(wp.x - v.x, wp.z - v.z) < 14 && idx < v.pursuitWaypoints.length - 1) {
            v.pursuitWpIdx = idx + 1;
          }
          const nextWp = v.pursuitWaypoints[Math.min(v.pursuitWpIdx ?? 0, v.pursuitWaypoints.length - 1)];
          navX = nextWp.x;
          navZ = nextWp.z;
        }

        const dx = navX - v.x;
        const dz = navZ - v.z;
        const dist = distToPlayer;
        const desiredHeading = Math.atan2(dx, dz);
        let diff = desiredHeading - v.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        v.heading += THREE.MathUtils.clamp(diff, -2.8 * dt, 2.8 * dt);
        v.steerAngle = THREE.MathUtils.clamp(diff, -0.45, 0.45);
        const chaseSpeed = dist > 11 ? spec.maxSpeed * (0.78 + Math.min(0.22, this.wantedStars * 0.04)) : dist > 5.5 ? 6 : 0;
        v.speed = THREE.MathUtils.damp(v.speed, chaseSpeed, 4.0, dt);

        let nx = v.x + Math.sin(v.heading) * v.speed * dt;
        let nz = v.z + Math.cos(v.heading) * v.speed * dt;
        if (dist > 22) {
          const roadCheck = this.router.getNearestRoadInfo(nx, nz, false);
          if (roadCheck && roadCheck.dist > roadCheck.halfWidth + 2.5) {
            const pull = Math.min(1, 3.0 * dt);
            nx = THREE.MathUtils.lerp(nx, roadCheck.closestX, pull);
            nz = THREE.MathUtils.lerp(nz, roadCheck.closestZ, pull);
          }
        }
        const pCol = this.resolveVehicleWorldCollision(nx, nz, v.heading, v.kind, v.y);
        v.x = pCol.x;
        v.z = pCol.z;

        if (dist < 28) {
          v.honkCooldown -= dt;
          if (v.honkCooldown <= 0) {
            v.honkCooldown = 3.8 + Math.random() * 2.5;
            this.audio.playHorn(v.kind);
          }
        }

        if (dist < 4.2 && this.activeVehicle && Math.abs(v.speed) > 10) {
          this.activeVehicle.health = Math.max(5, this.activeVehicle.health - 6 * dt);
        } else if (dist < 3.6 && !this.activeVehicle && this.wantedStars >= 3) {
          this.damagePlayer(8 * dt);
        }
        this.updateVehicleLights(v, chaseSpeed < 1);
      } else if (v.roadPoints && v.roadPoints.length >= 2) {
        let localCongestionFactor = rushHour ? 0.8 : 1.0;
        for (const zs of zoneScores) {
          if (Math.hypot(v.x - zs.center.x, v.z - zs.center.z) < zs.z.radius) {
            const f = zs.intensity >= 0.85 ? 0.32 : zs.intensity >= 0.52 ? 0.55 : 0.92;
            localCongestionFactor = Math.min(localCongestionFactor, f);
          }
        }
        let targetSpeed = spec.maxSpeed * (rushHour ? 0.44 : 0.54) * localCongestionFactor;

        // Yield toward left shoulder if an ambulance or active siren unit approaches within 28m
        let yieldingEmergency = false;
        if (v.kind !== 'ambulance' && !v.isPolice) {
          for (const ev of activeEmergencyVehicles) {
            if (ev !== v && Math.hypot(ev.x - v.x, ev.z - v.z) < 28) {
              yieldingEmergency = true;
              break;
            }
          }
          if (!yieldingEmergency && playerEmergency && distToPlayer < 28) {
            yieldingEmergency = true;
          }
        }
        if (yieldingEmergency) {
          targetSpeed = Math.min(targetSpeed, spec.maxSpeed * 0.24);
        }

        // BMTC buses pause near major Bengaluru Bus Hubs
        if (v.kind === 'bmtc') {
          if (v.busStopWaitTimer > 0) {
            v.busStopWaitTimer -= dt;
            targetSpeed = 0;
          } else if (busHubs.some((h) => Math.hypot(v.x - h.x, v.z - h.z) < 30) && Math.random() < 0.025) {
            v.busStopWaitTimer = 4.0;
          }
        }

        // 3-phase traffic light obedience + crosswalk pedestrian check near signaled intersections
        let stoppedAtSignal = false;
        const isEW = Math.abs(Math.sin(v.heading)) > 0.7;
        const mustStopOnAxis = isEW ? ewStop : nsStop;
        const isYellowOnAxis = isEW ? ewYellow : nsYellow;
        for (const sig of this.world.trafficSignals) {
          const sdx = sig.x - v.x;
          const sdz = sig.z - v.z;
          const dSig = Math.hypot(sdx, sdz);
          const approaching = sdx * Math.sin(v.heading) + sdz * Math.cos(v.heading) > 0;
          if (approaching && dSig > 10 && dSig < 24 && mustStopOnAxis) {
            if (!isYellowOnAxis || dSig > 13.5) {
              targetSpeed = 0;
              stoppedAtSignal = true;
              break;
            }
          }
          if (approaching && dSig < 18) {
            for (const npc of this.npcs) {
              if (!npc.rig.group.visible) continue;
              if (Math.hypot(npc.x - sig.x, npc.z - sig.z) < 10 && Math.hypot(npc.x - v.x, npc.z - v.z) < 11) {
                const nFwd = (npc.x - v.x) * Math.sin(v.heading) + (npc.z - v.z) * Math.cos(v.heading);
                if (nFwd > 1.5) {
                  targetSpeed = 0;
                  stoppedAtSignal = true;
                  break;
                }
              }
            }
            if (stoppedAtSignal) break;
          }
        }

        // Safe headway + right-side passing/overtaking in Indian LHD when safe
        let queuedBehind = false;
        let wantsOvertake = false;
        const fwdX = Math.sin(v.heading);
        const fwdZ = Math.cos(v.heading);
        for (const other of this.vehicles) {
          if (other === v) continue;
          const dx = other.x - v.x;
          const dz = other.z - v.z;
          const d = Math.hypot(dx, dz);
          if (d < 13.0) {
            const fwdDot = dx * fwdX + dz * fwdZ;
            const latDot = Math.abs(dx * fwdZ - dz * fwdX);
            if (fwdDot > 2.2 && latDot < 2.2) {
              if (
                !stoppedAtSignal &&
                !yieldingEmergency &&
                v.kind !== 'bmtc' &&
                v.kind !== 'truck' &&
                Math.abs(other.speed) < 6 &&
                localCongestionFactor > 0.45
              ) {
                wantsOvertake = true;
                targetSpeed = Math.min(targetSpeed, spec.maxSpeed * 0.42);
              } else {
                targetSpeed = v.kind === 'bike' && localCongestionFactor > 0.4 ? spec.maxSpeed * 0.22 : 0;
                queuedBehind = true;
              }
              break;
            }
          }
        }

        const shiftGoal = yieldingEmergency ? -v.aiDir * 1.25 : wantsOvertake ? v.aiDir * 2.15 : 0;
        v.overtakeShift = THREE.MathUtils.damp(v.overtakeShift ?? 0, shiftGoal, 3.6, dt);

        v.rig.leftIndicators.forEach((m) => {
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = yieldingEmergency && blink ? 2.2 : 0.05;
        });
        v.rig.rightIndicators.forEach((m) => {
          (m.material as THREE.MeshStandardMaterial).emissiveIntensity = wantsOvertake && blink ? 2.2 : 0.05;
        });

        const distPlayer = Math.hypot(this.playerX - v.x, this.playerZ - v.z);
        if (distPlayer < 11.5) {
          const pFwd = (this.playerX - v.x) * fwdX + (this.playerZ - v.z) * fwdZ;
          if (pFwd > 1.5) {
            targetSpeed = 0;
            queuedBehind = true;
          }
        }
        if (queuedBehind && distPlayer < 30) {
          v.honkCooldown -= dt;
          if (v.honkCooldown <= 0) {
            v.honkCooldown = 4.5 + Math.random() * 6;
            if (localCongestionFactor < 0.6 || distPlayer < 22) {
              this.audio.playHorn(v.kind);
            }
          }
        }

        v.speed = THREE.MathUtils.damp(v.speed, targetSpeed, 4.5, dt);
        this.updateVehicleLights(v, targetSpeed < 1.5 || queuedBehind || stoppedAtSignal);

        // Advance smoothly along curved road polyline with connected junction turns
        const pts = v.roadPoints;
        const a = pts[v.roadSegIdx];
        const b = pts[v.roadSegIdx + 1];
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const segLen = Math.hypot(dx, dz) || 1;
        v.roadT += ((v.speed * dt) / segLen) * v.aiDir;

        const fp = this.getVehicleFootprint(v.kind);
        const desiredLane = v.kind === 'bike' || v.kind === 'scooter' ? 2.15 : 3.45;
        const getClampedLane = (road: RoadSegment | undefined, dir: 1 | -1) => {
          const halfW = (road?.width ?? 14) * 0.5;
          const maxL = Math.max(1.3, halfW - fp.halfW - 0.55);
          return -dir * Math.min(desiredLane, maxL);
        };
        let switchedRoad = false;

        if (v.roadT > 1) {
          v.roadT = 0;
          v.roadSegIdx++;
          if (v.roadSegIdx >= pts.length - 1) {
            const endPt = pts[pts.length - 1];
            const targets = this.router.getConnectedIntersectionTargets(endPt.x, endPt.z, v.heading, true);
            if (targets.length > 0 && drivableRoads.length > 0) {
              const pick = targets[aiCounter % targets.length];
              for (const cand of drivableRoads) {
                const candPts = getSampledRoadSpine(cand).points;
                if (cand === v.roadSeg || candPts === pts || candPts.length < 2) continue;
                const p0 = candPts[0];
                const pEnd = candPts[candPts.length - 1];
                if (Math.hypot(p0.x - endPt.x, p0.z - endPt.z) < 28) {
                  v.roadSeg = cand;
                  v.roadPoints = candPts;
                  v.roadSegIdx = 0;
                  v.roadT = 0.02;
                  v.aiDir = 1;
                  v.laneOffset = getClampedLane(cand, 1);
                  v.overtakeShift = 0;
                  switchedRoad = true;
                  break;
                } else if (!cand.oneWay && Math.hypot(pEnd.x - endPt.x, pEnd.z - endPt.z) < 28) {
                  const candH = Math.atan2(candPts[candPts.length - 2].x - pEnd.x, candPts[candPts.length - 2].z - pEnd.z);
                  if (Math.abs(candH - pick.heading) < 1.35) {
                    v.roadSeg = cand;
                    v.roadPoints = candPts;
                    v.roadSegIdx = candPts.length - 2;
                    v.roadT = 0.98;
                    v.aiDir = -1;
                    v.laneOffset = getClampedLane(cand, -1);
                    v.overtakeShift = 0;
                    switchedRoad = true;
                    break;
                  }
                }
              }
            }
            if (!switchedRoad) {
              const curRoad = v.roadSeg || drivableRoads.find((r) => getSampledRoadSpine(r).points === pts);
              if (curRoad?.oneWay) {
                v.roadSegIdx = 0;
                v.roadT = 0;
              } else {
                v.roadSegIdx = pts.length - 2;
                v.roadT = 1;
                v.aiDir = -1;
                v.laneOffset = getClampedLane(curRoad, -1);
              }
            }
          }
        } else if (v.roadT < 0) {
          v.roadT = 1;
          v.roadSegIdx--;
          if (v.roadSegIdx < 0) {
            const startPt = pts[0];
            const targets = this.router.getConnectedIntersectionTargets(startPt.x, startPt.z, v.heading, true);
            if (targets.length > 0 && drivableRoads.length > 0) {
              for (const cand of drivableRoads) {
                const candPts = getSampledRoadSpine(cand).points;
                if (cand === v.roadSeg || candPts === pts || candPts.length < 2) continue;
                const p0 = candPts[0];
                const pEnd = candPts[candPts.length - 1];
                if (Math.hypot(p0.x - startPt.x, p0.z - startPt.z) < 28) {
                  v.roadSeg = cand;
                  v.roadPoints = candPts;
                  v.roadSegIdx = 0;
                  v.roadT = 0.02;
                  v.aiDir = 1;
                  v.laneOffset = getClampedLane(cand, 1);
                  v.overtakeShift = 0;
                  switchedRoad = true;
                  break;
                } else if (!cand.oneWay && Math.hypot(pEnd.x - startPt.x, pEnd.z - startPt.z) < 28) {
                  v.roadSeg = cand;
                  v.roadPoints = candPts;
                  v.roadSegIdx = candPts.length - 2;
                  v.roadT = 0.98;
                  v.aiDir = -1;
                  v.laneOffset = getClampedLane(cand, -1);
                  v.overtakeShift = 0;
                  switchedRoad = true;
                  break;
                }
              }
            }
            if (!switchedRoad) {
              const curRoad = v.roadSeg || drivableRoads.find((r) => getSampledRoadSpine(r).points === pts);
              v.roadSegIdx = 0;
              v.roadT = 0;
              v.aiDir = 1;
              v.laneOffset = getClampedLane(curRoad, 1);
            }
          }
        }

        const activePts = v.roadPoints ?? pts;
        const ca = activePts[v.roadSegIdx];
        const cb = activePts[v.roadSegIdx + 1];
        const cdx = cb.x - ca.x;
        const cdz = cb.z - ca.z;
        const clen = Math.hypot(cdx, cdz) || 1;
        const nx = -cdz / clen;
        const nz = cdx / clen;

        const curRoadHalfW = (v.roadSeg?.width ?? 14) * 0.5;
        const maxLat = Math.max(1.3, curRoadHalfW - fp.halfW - 0.5);
        const effectiveOffset = THREE.MathUtils.clamp(v.laneOffset + (v.overtakeShift ?? 0), -maxLat, maxLat);
        const rawX = ca.x + cdx * v.roadT + nx * effectiveOffset;
        const rawZ = ca.z + cdz * v.roadT + nz * effectiveOffset;
        const aiCol = this.resolveVehicleWorldCollision(rawX, rawZ, v.heading, v.kind, v.y);
        v.x = aiCol.x;
        v.z = aiCol.z;
        const desiredHeading = Math.atan2(cdx * v.aiDir, cdz * v.aiDir);
        let hDiff = desiredHeading - v.heading;
        while (hDiff > Math.PI) hDiff -= Math.PI * 2;
        while (hDiff < -Math.PI) hDiff += Math.PI * 2;
        v.heading += hDiff * Math.min(1, 6 * dt);
      }

      v.y = getFlyoverDeckY(v.x, v.z);
      v.rig.group.position.set(v.x, v.y, v.z);
      v.rig.group.rotation.y = v.heading;
      v.rig.wheels.forEach((w) => (w.rotation.x += v.speed * dt * 2.2));
    }
  }

  private updateNpcs(dt: number): void {
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    const isRaining =
      this.settings.weather === 'light_rain' ||
      this.settings.weather === 'monsoon' ||
      this.settings.weather === 'thunderstorm';
    const wind = this.getCurrentWind();

    let clothBudget = 0;

    for (const npc of this.npcs) {
      if (npc.knockdownTimer > 0) {
        npc.knockdownTimer -= dt;
        updateHumanAnimation(npc.rig, {
          pose: npc.knockdownTimer < 0.7 ? 'recover' : 'knockdown',
          speedNorm: 0,
          stridePhase: 0,
          elapsed: this.elapsed,
          dt,
          expression: 'fear',
          lookYaw: 0,
          lookPitch: 0,
          holdingUmbrella: false,
          simulateCloth: false,
        });
        continue;
      }
      if (npc.hitReactTimer > 0) {
        npc.hitReactTimer -= dt;
        updateHumanAnimation(npc.rig, {
          pose: 'hit_react',
          speedNorm: 0,
          stridePhase: 0,
          elapsed: this.elapsed,
          dt,
          expression: 'fear',
          lookYaw: 0,
          lookPitch: 0,
          holdingUmbrella: false,
          simulateCloth: false,
        });
        continue;
      }

      npc.routineTimer -= dt;
      if (npc.routineTimer <= 0) {
        npc.routineTimer = 4 + Math.random() * 7;
        const r = Math.random();
        if (npc.archetype === 'traffic_police') {
          npc.routineMode = 'talk';
        } else if (r < 0.62) {
          npc.routineMode = 'walk';
          npc.heading += (Math.random() - 0.5) * 2.0;
        } else if (r < 0.82) {
          npc.routineMode = 'phone';
        } else {
          npc.routineMode = 'talk';
        }
      }

      let dangerNear = false;
      for (const v of this.vehicles) {
        const d = Math.hypot(v.x - npc.x, v.z - npc.z);
        const isEmergencyHorn =
          (v.kind === 'ambulance' || (v.isPolice && this.wantedStars > 0)) && d < 15.0;
        const playerHornNear = v === this.activeVehicle && this.hornAlertTimer > 0 && d < 15.0;
        if ((Math.abs(v.speed) >= 4 && d < 8.5) || isEmergencyHorn || playerHornNear) {
          dangerNear = true;
          const awayHeading = Math.atan2(npc.x - v.x, npc.z - v.z);
          npc.heading = awayHeading;
          npc.vx = Math.sin(awayHeading) * 3.4;
          npc.vz = Math.cos(awayHeading) * 3.4;
          npc.x += npc.vx * dt;
          npc.z += npc.vz * dt;
          break;
        }
      }

      let pose: HumanPoseState = 'idle';
      let speedNorm = 0;

      if (dangerNear) {
        pose = 'react_fear';
      } else if (npc.archetype === 'traffic_police') {
        npc.vx = 0;
        npc.vz = 0;
        pose = 'traffic_direct';
      } else if (npc.routineMode === 'walk') {
        const nx = npc.x + Math.sin(npc.heading) * npc.speed * dt;
        const nz = npc.z + Math.cos(npc.heading) * npc.speed * dt;
        // Crosswalk curb pause: wait if stepping onto road during green traffic flow at signaled junction
        let pauseForCrosswalk = false;
        if (!isPointOnRoad(npc.x, npc.z) && isPointOnRoad(nx, nz)) {
          const cycleT = this.elapsed % 24;
          for (const sig of this.world.trafficSignals) {
            if (Math.hypot(sig.x - npc.x, sig.z - npc.z) < 16) {
              const walkingEW = Math.abs(Math.sin(npc.heading)) > 0.7;
              const trafficFlowingAcross = walkingEW ? cycleT < 9.5 : cycleT >= 12 && cycleT < 21.5;
              if (trafficFlowingAcross) {
                pauseForCrosswalk = true;
                break;
              }
            }
          }
        }
        if (pauseForCrosswalk) {
          npc.vx = 0;
          npc.vz = 0;
          pose = 'idle';
        } else {
          const [rx, rz] = this.resolveBuildingCollision(nx, nz, 0.45, getGradedTerrainY(nx, nz));
          if (Math.hypot(rx - nx, rz - nz) > 0.05) npc.heading += Math.PI * 0.7;
          const dist = Math.hypot(rx - npc.x, rz - npc.z);
          npc.vx = (rx - npc.x) / Math.max(0.001, dt);
          npc.vz = (rz - npc.z) / Math.max(0.001, dt);
          npc.x = rx;
          npc.z = rz;
          npc.stridePhase += dist * 2.3;
          pose = 'walk';
          speedNorm = 0.55;
        }
      } else if (npc.routineMode === 'phone') {
        npc.vx = 0;
        npc.vz = 0;
        pose = 'phone';
      } else if (npc.routineMode === 'talk') {
        npc.vx = 0;
        npc.vz = 0;
        pose = 'talk';
      }

      npc.rig.group.position.set(npc.x, getGradedTerrainY(npc.x, npc.z), npc.z);
      npc.rig.group.rotation.y = npc.heading;

      const distPlayer = Math.hypot(npc.x - px, npc.z - pz);
      if (distPlayer > 240) {
        npc.rig.group.visible = false;
        continue;
      }
      npc.rig.group.visible = true;

      let lookYaw = 0;
      if (distPlayer < 9) {
        const angleToPlayer = Math.atan2(px - npc.x, pz - npc.z);
        let diff = angleToPlayer - npc.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        lookYaw = THREE.MathUtils.clamp(diff, -0.7, 0.7);
      }

      const simulateCloth = distPlayer < 45 && clothBudget < 10;
      if (simulateCloth) clothBudget++;

      const expr: FacialExpression = dangerNear
        ? 'fear'
        : npc.routineMode === 'talk'
        ? 'talking'
        : npc.expression;

      updateHumanAnimation(npc.rig, {
        pose,
        speedNorm,
        stridePhase: npc.stridePhase,
        elapsed: this.elapsed,
        dt,
        expression: expr,
        lookYaw,
        lookPitch: 0,
        holdingUmbrella: isRaining && npc.archetype !== 'traffic_police',
        simulateCloth,
        clothCtx: simulateCloth
          ? {
              dt,
              windX: wind.wx,
              windZ: wind.wz,
              charVelX: npc.vx,
              charVelZ: npc.vz,
              charHeading: npc.heading,
              strideSpeed: speedNorm,
              elapsed: this.elapsed,
            }
          : undefined,
      });

      if (!this.activeVehicle && !this.studioActive && this.subtitleTimer <= 0 && distPlayer < 6.5) {
        this.npcSubtitle = NPC_DIALOGUE_LINES[npc.lineIndex];
        this.subtitleTimer = 4.0;
      }
    }
  }

  private updateStreetDogs(dt: number): void {
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    for (const dog of this.dogs) {
      const dist = Math.hypot(dog.x - px, dog.z - pz);
      if (dist > 220) {
        dog.rig.group.visible = false;
        continue;
      }
      dog.rig.group.visible = true;
      dog.turnTimer -= dt;
      if (dog.turnTimer <= 0) {
        dog.turnTimer = 2 + Math.random() * 4;
        dog.heading += (Math.random() - 0.5) * 2.2;
      }
      dog.x += Math.sin(dog.heading) * dog.speed * dt;
      dog.z += Math.cos(dog.heading) * dog.speed * dt;
      const [rx, rz] = this.resolveBuildingCollision(dog.x, dog.z, 0.35, getGradedTerrainY(dog.x, dog.z));
      dog.x = rx;
      dog.z = rz;
      dog.rig.group.position.set(dog.x, getGradedTerrainY(dog.x, dog.z), dog.z);
      dog.rig.group.rotation.y = dog.heading;
      dog.rig.tail.rotation.z = Math.sin(this.elapsed * 11) * 0.45;
      const trot = Math.sin(this.elapsed * 9) * 0.4;
      dog.rig.legs[0].rotation.x = trot;
      dog.rig.legs[3].rotation.x = trot;
      dog.rig.legs[1].rotation.x = -trot;
      dog.rig.legs[2].rotation.x = -trot;
    }
  }

  private updateProjectiles(dt: number): void {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.mesh.position.x += p.vx * dt;
      p.mesh.position.z += p.vz * dt;

      let hit = false;
      for (const v of this.vehicles) {
        if (v === this.activeVehicle) continue;
        if (Math.hypot(p.mesh.position.x - v.x, p.mesh.position.z - v.z) < 2.6) {
          v.disabledTimer = p.isEmp ? 8.0 : 3.5;
          v.speed = 0;
          this.audio.playImpact(0.8);
          this.addWantedStars(v.isPolice ? 3 : 2);
          hit = true;
          break;
        }
      }

      if (hit || p.life <= 0) {
        this.scene.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }
  }

  private updatePoliceWanted(dt: number): void {
    if (this.wantedStars <= 0) {
      if (this.arrestStage === 'pursuit') {
        this.arrestStage = 'none';
        this.arrestStoppedAccum = 0;
      }
      return;
    }

    if (this.arrestStage === 'none') {
      this.arrestStage = 'pursuit';
    }
    if (this.arrestStage !== 'pursuit') {
      this.isEvading = false;
      return;
    }

    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    let activePolice = 0;
    let minPoliceDist = Infinity;
    for (const v of this.vehicles) {
      if (!v.isPolice || v.disabledTimer > 0) continue;
      activePolice++;
      const d = Math.hypot(v.x - px, v.z - pz);
      if (d < minPoliceDist) minPoliceDist = d;
    }

    // Spawn pursuit / roadblock units up to wanted level
    if (activePolice < Math.min(5, this.wantedStars + 1) && minPoliceDist > 120) {
      this.spawnPoliceUnit();
    }

    if (minPoliceDist > 95) {
      this.isEvading = true;
      this.wantedCooldown -= dt / (8 + this.wantedStars * 2);
      if (this.wantedCooldown <= 0) {
        this.wantedStars = 0;
        this.wantedCooldown = 0;
        this.isEvading = false;
        this.arrestStage = 'none';
        this.arrestStoppedAccum = 0;
        this.showToast('Pursuit evaded! Wanted level cleared.');
      }
    } else {
      this.isEvading = false;
      this.wantedCooldown = 1;
    }
  }

  private updatePoliceArrestLifecycle(dt: number): void {
    if (this.wantedStars <= 0 && this.arrestStage === 'none') return;

    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;

    if (this.arrestStage === 'pursuit') {
      let closestPolice: SimVehicle | null = null;
      let minDist = Infinity;
      for (const v of this.vehicles) {
        if (!v.isPolice || v.disabledTimer > 0) continue;
        const d = Math.hypot(v.x - px, v.z - pz);
        if (d < minDist) {
          minDist = d;
          closestPolice = v;
        }
      }
      const playerSpeed = this.activeVehicle
        ? Math.abs(this.activeVehicle.speed)
        : Math.hypot(this.playerVx, this.playerVz);

      if (closestPolice && minDist < 14.0 && playerSpeed < 2.2) {
        this.arrestStoppedAccum += dt;
        if (this.arrestStoppedAccum >= 1.2) {
          this.arrestStage = 'officers_approaching';
          this.arrestEscortVehicle = closestPolice;
          closestPolice.speed = 0;
          this.policeOfficers = [0, 1].map((idx) => {
            const side = idx === 0 ? -1.8 : 1.8;
            const ox = closestPolice!.x + Math.cos(closestPolice!.heading) * side;
            const oz = closestPolice!.z - Math.sin(closestPolice!.heading) * side;
            const rig = createArchetypeHuman('police_officer', 900 + idx, this.textures);
            const oy = getFlyoverDeckY(ox, oz);
            rig.group.position.set(ox, oy, oz);
            this.scene.add(rig.group);
            return {
              rig,
              vehicleId: closestPolice!.id,
              x: ox,
              y: oy,
              z: oz,
              heading: closestPolice!.heading,
              speed: 3.3,
              stridePhase: idx * 1.4,
            };
          });
          this.showToast('Karnataka Police: Stop & Hands Up! Officers approaching.');
          this.emitHud(true);
        }
      } else {
        this.arrestStoppedAccum = Math.max(0, this.arrestStoppedAccum - dt * 0.8);
      }
      return;
    }

    if (this.arrestStage === 'officers_approaching') {
      let minOffDist = Infinity;
      for (const off of this.policeOfficers) {
        const dx = px - off.x;
        const dz = pz - off.z;
        const d = Math.hypot(dx, dz);
        if (d < minOffDist) minOffDist = d;
        if (d > 1.3) {
          off.heading = Math.atan2(dx, dz);
          off.x += (dx / d) * off.speed * dt;
          off.z += (dz / d) * off.speed * dt;
          off.y = getFlyoverDeckY(off.x, off.z);
          off.stridePhase += off.speed * dt * 2.2;
        }
        off.rig.group.position.set(off.x, off.y, off.z);
        off.rig.group.rotation.y = off.heading;
        updateHumanAnimation(off.rig, {
          pose: 'arrest_approach',
          speedNorm: 0.65,
          stridePhase: off.stridePhase,
          elapsed: this.elapsed,
          dt,
          expression: 'anger',
          lookYaw: 0,
          lookPitch: 0,
          holdingUmbrella: false,
          simulateCloth: false,
        });
      }

      if (minOffDist > 24.0) {
        this.cleanupArrestOfficers();
        this.arrestStoppedAccum = 0;
        this.arrestStage = 'pursuit';
        this.showToast('Escaped officers on foot — Police resuming pursuit!');
        return;
      }

      if (minOffDist < 2.4) {
        if (this.activeVehicle) {
          const av = this.activeVehicle;
          const exitAngle = av.heading + Math.PI * 0.5;
          this.playerX = av.x + Math.sin(exitAngle) * 2.2;
          this.playerZ = av.z + Math.cos(exitAngle) * 2.2;
          this.playerY = getFlyoverDeckY(this.playerX, this.playerZ);
          if (av.rig.riderGroup) av.rig.riderGroup.visible = false;
          this.activeVehicle = null;
          if (this.cameraMode === 'cockpit') this.cameraMode = 'chase';
          this.audio.setInteriorMuffled(false);
          this.playerRig.group.visible = true;
        }
        this.audio.playHandcuffClick();
        this.arrestStage = 'cuffing';
        this.arrestTimer = 1.4;
        this.showToast('BUSTED — Handcuffed by Karnataka Police!');
        this.emitHud(true);
      }
      return;
    }

    if (this.arrestStage === 'cuffing') {
      this.arrestTimer -= dt;
      updateHumanAnimation(this.playerRig, {
        pose: 'handcuffed',
        speedNorm: 0,
        stridePhase: 0,
        elapsed: this.elapsed,
        dt,
        expression: 'fear',
        lookYaw: 0,
        lookPitch: 0,
        holdingUmbrella: false,
        protagonistId: this.playerCustom.protagonistId,
        simulateCloth: false,
      });
      for (const off of this.policeOfficers) {
        updateHumanAnimation(off.rig, {
          pose: 'arrest_approach',
          speedNorm: 0,
          stridePhase: off.stridePhase,
          elapsed: this.elapsed,
          dt,
          expression: 'anger',
          lookYaw: 0,
          lookPitch: 0,
          holdingUmbrella: false,
          simulateCloth: false,
        });
      }
      if (this.arrestTimer <= 0) {
        this.arrestStage = 'escorting_to_car';
        this.arrestTimer = 2.6;
        this.emitHud(true);
      }
      return;
    }

    if (this.arrestStage === 'escorting_to_car') {
      this.arrestTimer -= dt;
      const ev = this.arrestEscortVehicle;
      if (!ev) {
        this.arrestStage = 'booking_jail';
        return;
      }
      const doorX = ev.x - Math.cos(ev.heading) * 1.9;
      const doorZ = ev.z + Math.sin(ev.heading) * 1.9;
      const dx = doorX - this.playerX;
      const dz = doorZ - this.playerZ;
      const d = Math.hypot(dx, dz);
      if (d > 0.35) {
        const step = Math.min(d, 3.0 * dt);
        this.playerX += (dx / d) * step;
        this.playerZ += (dz / d) * step;
        this.playerY = getFlyoverDeckY(this.playerX, this.playerZ);
        this.playerHeading = Math.atan2(dx, dz);
        this.playerStridePhase += step * 2.1;
      }
      this.playerRig.group.position.set(this.playerX, this.playerY, this.playerZ);
      this.playerRig.group.rotation.set(0, this.playerHeading, 0);
      updateHumanAnimation(this.playerRig, {
        pose: 'handcuffed',
        speedNorm: d > 0.35 ? 0.5 : 0,
        stridePhase: this.playerStridePhase,
        elapsed: this.elapsed,
        dt,
        expression: 'fear',
        lookYaw: 0,
        lookPitch: 0,
        holdingUmbrella: false,
        protagonistId: this.playerCustom.protagonistId,
        simulateCloth: false,
      });

      this.policeOfficers.forEach((off, idx) => {
        const side = idx === 0 ? -1.0 : 1.0;
        off.x = this.playerX + Math.cos(this.playerHeading) * side;
        off.z = this.playerZ - Math.sin(this.playerHeading) * side;
        off.y = getFlyoverDeckY(off.x, off.z);
        off.heading = this.playerHeading;
        off.stridePhase += (d > 0.35 ? 3.0 * dt * 2.1 : 0);
        off.rig.group.position.set(off.x, off.y, off.z);
        off.rig.group.rotation.y = off.heading;
        updateHumanAnimation(off.rig, {
          pose: 'walk',
          speedNorm: d > 0.35 ? 0.5 : 0,
          stridePhase: off.stridePhase,
          elapsed: this.elapsed,
          dt,
          expression: 'neutral',
          lookYaw: 0,
          lookPitch: 0,
          holdingUmbrella: false,
          simulateCloth: false,
        });
      });

      if (d < 0.9 || this.arrestTimer <= 0) {
        for (const off of this.policeOfficers) {
          off.rig.group.removeFromParent();
          disposeHumanRig(off.rig);
        }
        this.policeOfficers = [];
        this.playerRig.group.visible = false;
        this.arrestTargetStation = getNearestPoliceStation(ev.x, ev.z);
        this.arrestWaypoints = this.router.findRoadWaypoints(
          ev.x,
          ev.z,
          this.arrestTargetStation.x,
          this.arrestTargetStation.z
        );
        this.arrestWpIdx = 0;
        this.arrestTimer = 15.0;
        this.arrestStage = 'driving_to_station';
        this.showToast(`Police Escort: Transporting to ${this.arrestTargetStation.name}...`);
        this.emitHud(true);
      }
      return;
    }

    if (this.arrestStage === 'driving_to_station') {
      this.arrestTimer -= dt;
      const ev = this.arrestEscortVehicle;
      if (!ev) {
        this.arrestTimer = 0;
      } else {
        let wpX = this.arrestTargetStation.x;
        let wpZ = this.arrestTargetStation.z;
        if (this.arrestWaypoints.length > 0 && this.arrestWpIdx < this.arrestWaypoints.length) {
          const wp = this.arrestWaypoints[this.arrestWpIdx];
          if (Math.hypot(wp.x - ev.x, wp.z - ev.z) < 14 && this.arrestWpIdx < this.arrestWaypoints.length - 1) {
            this.arrestWpIdx++;
          }
          wpX = this.arrestWaypoints[this.arrestWpIdx].x;
          wpZ = this.arrestWaypoints[this.arrestWpIdx].z;
        }
        const dx = wpX - ev.x;
        const dz = wpZ - ev.z;
        const desiredH = Math.atan2(dx, dz);
        let hDiff = desiredH - ev.heading;
        while (hDiff > Math.PI) hDiff -= Math.PI * 2;
        while (hDiff < -Math.PI) hDiff += Math.PI * 2;
        ev.heading += THREE.MathUtils.clamp(hDiff, -3.0 * dt, 3.0 * dt);
        ev.speed = THREE.MathUtils.damp(ev.speed, 22, 4.0, dt);
        ev.x += Math.sin(ev.heading) * ev.speed * dt;
        ev.z += Math.cos(ev.heading) * ev.speed * dt;
        ev.y = getFlyoverDeckY(ev.x, ev.z);
        ev.rig.group.position.set(ev.x, ev.y, ev.z);
        ev.rig.group.rotation.y = ev.heading;
        ev.rig.wheels.forEach((w) => (w.rotation.x += ev.speed * dt * 2.2));
        this.playerX = ev.x;
        this.playerY = ev.y;
        this.playerZ = ev.z;
        this.playerHeading = ev.heading;
      }

      const distStation = ev
        ? Math.hypot(ev.x - this.arrestTargetStation.x, ev.z - this.arrestTargetStation.z)
        : 0;
      if (distStation < 18 || this.arrestTimer <= 0) {
        if (ev) ev.speed = 0;
        this.cleanupArrestOfficers();
        this.playerRig.group.visible = true;
        this.enterInterior('police_jail');
        this.interiorReturnPos.set(
          this.arrestTargetStation.x + 6,
          getFlyoverDeckY(this.arrestTargetStation.x + 6, this.arrestTargetStation.z + 8),
          this.arrestTargetStation.z + 8
        );
        this.arrestStage = 'booking_jail';
        this.interiorAction = 'jail_booking';
        this.showToast(`Booked at ${this.arrestTargetStation.name} (${this.arrestTargetStation.kannadaName}).`);
        this.emitHud(true);
      }
    }
  }

  private damagePlayer(amount: number): void {
    if (this.dodgeTimer > 0) return;
    if (this.isBlocking) amount *= 0.25;
    if (amount > 2) this.hitReactTimer = 0.28;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 100;
      this.armor = 50;
      this.wantedStars = 0;
      this.isEvading = false;
      this.activeVehicle = null;
      this.playerRig.group.visible = true;
      const mg = getDistrictCenter('mg_road');
      this.playerX = mg.x;
      this.playerZ = mg.z;
      this.playerY = getFlyoverDeckY(mg.x, mg.z);
      this.cash = Math.max(0, this.cash - 500);
      this.showToast('Recovered at St. Martha Medical Hub (-₹500 treatment fee).');
    }
  }

  private updateCollectiblesAndDiscovery(): void {
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;

    const district = getDistrictAt(px, pz);
    if (!this.discoveredDistricts.has(district.id)) {
      this.discoveredDistricts.add(district.id);
      this.cash += 1000;
      this.audio.playPickup();
      this.showToast(`District Discovered: ${district.name} (+₹1,000)`);
    }

    for (const col of COLLECTIBLES) {
      if (this.collectedIds.has(col.id)) continue;
      if (Math.hypot(px - col.x, pz - col.z) < 4.0) {
        this.collectedIds.add(col.id);
        this.cash += 2500;
        this.audio.playPickup();
        const mesh = this.world.collectibleMeshes.get(col.id);
        if (mesh) mesh.visible = false;
        this.showToast(`Collected ${col.name}! (+₹2,500)`);
      }
    }
  }

  private updateMission(dt: number): void {
    if (!this.activeMission) {
      this.world.missionBeacon.visible = false;
      return;
    }

    const am = this.activeMission;
    if (am.timeRemaining !== null) {
      am.timeRemaining -= dt;
      if (am.timeRemaining <= 0) {
        this.showToast(`Mission Failed: Time expired on ${am.def.title}`);
        this.activeMission = null;
        this.world.missionBeacon.visible = false;
        return;
      }
    }

    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;

    let tx = am.def.targetX;
    let tz = am.def.targetZ;
    if (am.def.checkpoints && am.checkpointIndex < am.def.checkpoints.length) {
      const cp = am.def.checkpoints[am.checkpointIndex];
      tx = cp.x;
      tz = cp.z;
    }

    const ty = getFlyoverDeckY(tx, tz);
    this.world.missionBeacon.visible = true;
    this.world.missionBeacon.position.set(tx, ty, tz);

    if (Math.hypot(px - tx, pz - tz) < 11) {
      if (am.def.checkpoints && am.checkpointIndex < am.def.checkpoints.length - 1) {
        am.checkpointIndex++;
        this.audio.playPickup();
        this.showToast(`Checkpoint ${am.checkpointIndex}/${am.def.checkpoints.length} cleared!`);
      } else if (am.def.type === 'escape' && this.wantedStars > 0) {
        this.wantedCooldown = Math.min(this.wantedCooldown, 0.25);
        this.wantedStars = 0;
        this.isEvading = false;
        this.completeMission();
      } else {
        this.completeMission();
      }
    }
  }

  private completeMission(): void {
    if (!this.activeMission) return;
    const def = this.activeMission.def;
    this.completedMissions.add(def.id);
    this.cash += def.rewardCash;
    this.audio.playPickup();
    this.showToast(`Mission Complete: ${def.title} (+₹${def.rewardCash.toLocaleString()})`);
    this.activeMission = null;
    this.world.missionBeacon.visible = false;
    this.emitHud(true);
  }

  private updateCamera(dt: number): void {
    const escortingCar =
      this.arrestStage === 'driving_to_station' ? this.arrestEscortVehicle : null;
    const camVehicle = this.activeVehicle || escortingCar;
    const px = camVehicle ? camVehicle.x : this.playerX;
    const py = camVehicle ? camVehicle.y : this.playerY;
    const pz = camVehicle ? camVehicle.z : this.playerZ;
    const heading = camVehicle ? camVehicle.heading : this.playerHeading;

    // Live 3D City Showcase Mode (tours 6 Bengaluru vistas including Silk Board, Whitefield & Night Skyline)
    if (this.cityShowcaseActive) {
      const showcaseStops: Array<{
        label: string;
        district: DistrictId;
        radius: number;
        height: number;
        lookY: number;
        timeHours: number;
      }> = [
        { label: 'MG Road – Namma Metro Viaduct', district: 'mg_road', radius: 68, height: 32, lookY: 8, timeHours: 9.5 },
        { label: 'Vidhana Soudha & Cubbon Park', district: 'vidhana_soudha', radius: 74, height: 34, lookY: 10, timeHours: 11.4 },
        { label: 'Silk Board Multi-Level Flyover & ORR', district: 'silk_board', radius: 86, height: 40, lookY: 9, timeHours: 17.5 },
        { label: 'Whitefield ITPL Tech Skyline', district: 'whitefield', radius: 88, height: 44, lookY: 14, timeHours: 15.6 },
        { label: 'KR Market & Majestic Transit Hub', district: 'majestic', radius: 76, height: 32, lookY: 8, timeHours: 18.2 },
        { label: 'Bengaluru Night Skyline & Metro Lights', district: 'mg_road', radius: 112, height: 56, lookY: 12, timeHours: 22.3 },
      ];
      const shotDuration = 6.5;
      const totalCycle = showcaseStops.length * shotDuration;
      const t = this.cityShowcaseTimer % totalCycle;
      const idx = Math.floor(t / shotDuration);
      const localU = (t % shotDuration) / shotDuration;
      const stop = showcaseStops[idx];
      const center = getDistrictCenter(stop.district);
      this.cityShowcaseLabel = stop.label;
      if (this.settings.timePreset !== 'ist_realtime') {
        this.timeOfDayHours = THREE.MathUtils.damp(this.timeOfDayHours, stop.timeHours, 2.2, dt);
      }
      const orbitAng = idx * 1.15 + localU * 0.95;
      _camDesired.set(
        center.x + Math.sin(orbitAng) * stop.radius,
        stop.height + Math.sin(localU * Math.PI) * 6,
        center.z + Math.cos(orbitAng) * stop.radius
      );
      _v1.set(center.x, stop.lookY, center.z);
      this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, _camDesired.x, 3.2, dt);
      this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, _camDesired.y, 3.2, dt);
      this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, _camDesired.z, 3.2, dt);
      this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, _v1.x, 4.0, dt);
      this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, _v1.y, 4.0, dt);
      this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, _v1.z, 4.0, dt);
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 54, 4, dt);
      this.camera.updateProjectionMatrix();
      return;
    }

    // Character Cinematography Studio Angles
    if (this.studioActive) {
      let yawRel = 0.55;
      let dist = 2.25;
      let camH = 1.48;
      let lookH = 1.18;
      let fov = 42;

      switch (this.studioAngle) {
        case 'front':
          yawRel = 0;
          dist = 2.05;
          camH = 1.45;
          lookH = 1.2;
          break;
        case 'back':
          yawRel = Math.PI;
          dist = 2.2;
          camH = 1.45;
          lookH = 1.15;
          break;
        case 'left_profile':
          yawRel = -Math.PI * 0.5;
          dist = 1.85;
          camH = 1.52;
          lookH = 1.42;
          break;
        case 'right_profile':
          yawRel = Math.PI * 0.5;
          dist = 1.85;
          camH = 1.52;
          lookH = 1.42;
          break;
        case 'face_closeup':
          yawRel = 0.14;
          dist = 0.68;
          camH = 1.66;
          lookH = 1.62;
          fov = 34;
          break;
        case 'full_body':
          yawRel = 0.25;
          dist = 3.25;
          camH = 1.25;
          lookH = 0.95;
          fov = 45;
          break;
        case 'three_quarter':
        default:
          yawRel = 0.62;
          dist = 2.3;
          camH = 1.48;
          lookH = 1.22;
          break;
      }

      const ang = heading + yawRel + this.studioYawOffset + this.camYawOffset;
      _camDesired.set(px + Math.sin(ang) * dist, py + camH, pz + Math.cos(ang) * dist);
      _v1.set(px, py + lookH, pz);

      this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, _camDesired.x, 12, dt);
      this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, _camDesired.y, 12, dt);
      this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, _camDesired.z, 12, dt);
      this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, _v1.x, 14, dt);
      this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, _v1.y, 14, dt);
      this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, _v1.z, 14, dt);

      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, fov, 8, dt);
      this.camera.updateProjectionMatrix();
      return;
    }

    // 4 Dedicated Namma Metro Coach Camera Modes
    if (this.metroJourney.phase === 'riding' || this.metroJourney.phase === 'arrived') {
      const tMode = this.metroJourney.trainCameraMode;
      const b = this.metroSim.getStationCameraBounds(px, py, pz);
      const totalYaw = heading + this.camYawOffset;
      if (tMode === 'window') {
        const trainCx = this.metroSim.trainCabinSpawn.x;
        _camDesired.set(trainCx - 1.25, py + 1.58, pz);
        _v1.set(trainCx - 22, py + 1.45, pz - 4);
        this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, _camDesired.x, 10, dt);
        this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, _camDesired.y, 10, dt);
        this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, _camDesired.z, 10, dt);
        this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, _v1.x, 10, dt);
        this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, _v1.y, 10, dt);
        this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, _v1.z, 10, dt);
        this.camera.position.copy(this.currentCamPos);
        this.camera.lookAt(this.currentLookAt);
        this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 66, 6, dt);
        this.camera.updateProjectionMatrix();
        return;
      }
      if (tMode === 'cinematic') {
        const trainCx = this.metroSim.trainCabinSpawn.x;
        const trainCz = this.metroSim.trainCabinSpawn.z;
        _camDesired.set(trainCx + 1.35, py + 2.35, Math.min(b.maxZ, trainCz + 8.5));
        _v1.set(px, py + 1.35, Math.max(b.minZ, pz - 4));
      } else {
        const cDist = tMode === 'chase' ? 3.8 : 2.35;
        const cH = tMode === 'chase' ? 1.82 : 1.55;
        _camDesired.set(
          px - Math.sin(totalYaw) * cDist * Math.cos(this.camPitch),
          py + cH + Math.sin(this.camPitch) * cDist * 0.5,
          pz - Math.cos(totalYaw) * cDist * Math.cos(this.camPitch)
        );
        _v1.set(px, py + 1.38, pz);
      }
      this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, _camDesired.x, 9, dt);
      this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, _camDesired.y, 9, dt);
      this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, _camDesired.z, 9, dt);
      this.currentCamPos.x = THREE.MathUtils.clamp(this.currentCamPos.x, b.minX, b.maxX);
      this.currentCamPos.y = THREE.MathUtils.clamp(this.currentCamPos.y, b.minY, b.maxY);
      this.currentCamPos.z = THREE.MathUtils.clamp(this.currentCamPos.z, b.minZ, b.maxZ);
      this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, _v1.x, 12, dt);
      this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, _v1.y, 12, dt);
      this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, _v1.z, 12, dt);
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, tMode === 'cinematic' ? 58 : 64, 6, dt);
      this.camera.updateProjectionMatrix();
      return;
    }

    if (this.activeVehicle && this.cameraMode === 'cockpit') {
      const v = this.activeVehicle;
      const seatOff =
        this.nammaYatri.status === 'riding' && v === this.nammaYatriVehicle
          ? v.rig.passengerCockpitOffset
          : v.rig.cockpitOffset;
      _localOffset.copy(seatOff).applyAxisAngle(_v1.set(0, 1, 0), v.heading);
      _camDesired.set(v.x + _localOffset.x, v.y + _localOffset.y, v.z + _localOffset.z);
      const lookYaw = v.heading + this.camYawOffset;
      _v1.set(
        _camDesired.x + Math.sin(lookYaw) * 18,
        _camDesired.y - 0.5 + (this.camPitch - 0.28) * 6,
        _camDesired.z + Math.cos(lookYaw) * 18
      );
      this.currentCamPos.copy(_camDesired);
      this.currentLookAt.copy(_v1);
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);
      const speedRatio = Math.min(1, Math.abs(v.speed) / 55);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 68 + speedRatio * 10, 6, dt);
      this.camera.updateProjectionMatrix();
      return;
    }

    if (!this.activeVehicle && this.cameraMode === 'closeup') {
      const totalYaw = heading + this.camYawOffset;
      _camDesired.set(px - Math.sin(totalYaw) * 0.85, py + 1.66, pz - Math.cos(totalYaw) * 0.85);
      _v1.set(px, py + 1.6, pz);
      this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, _camDesired.x, 12, dt);
      this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, _camDesired.y, 12, dt);
      this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, _camDesired.z, 12, dt);
      this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, _v1.x, 14, dt);
      this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, _v1.y, 14, dt);
      this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, _v1.z, 14, dt);
      this.camera.position.copy(this.currentCamPos);
      this.camera.lookAt(this.currentLookAt);
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, 38, 6, dt);
      this.camera.updateProjectionMatrix();
      return;
    }

    const inStation = this.metroJourney.phase !== 'none';
    const interiorPocket = this.activeInterior ? this.interiors.pockets[this.activeInterior] : null;
    const inIndoor = inStation || !!interiorPocket;

    const totalYaw = heading + this.camYawOffset;
    const isCinematic = this.cameraMode === 'cinematic';
    const dist = camVehicle
      ? camVehicle.kind === 'bmtc'
        ? 14.5
        : isCinematic
        ? 7.2
        : 9.8
      : inIndoor
      ? inStation
        ? 3.45
        : 2.75
      : isCinematic
      ? 3.8
      : 5.4;
    const heightOffset = camVehicle
      ? isCinematic
        ? 1.4
        : 3.2
      : inIndoor
      ? 1.55
      : isCinematic
      ? 1.2
      : 2.1;

    _camDesired.set(
      px - Math.sin(totalYaw) * dist * Math.cos(this.camPitch),
      py + heightOffset + Math.sin(this.camPitch) * dist,
      pz - Math.cos(totalYaw) * dist * Math.cos(this.camPitch)
    );
    _v1.set(px, py + (camVehicle ? 1.45 : 1.42), pz);

    this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, _camDesired.x, 8.5, dt);
    this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, _camDesired.y, 7.5, dt);
    this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, _camDesired.z, 8.5, dt);

    // Strictly clamp camera inside station / train / interior walls so it can never clip behind walls!
    if (inStation) {
      const b = this.metroSim.getStationCameraBounds(px, py, pz);
      this.currentCamPos.x = THREE.MathUtils.clamp(this.currentCamPos.x, b.minX, b.maxX);
      this.currentCamPos.y = THREE.MathUtils.clamp(this.currentCamPos.y, b.minY, b.maxY);
      this.currentCamPos.z = THREE.MathUtils.clamp(this.currentCamPos.z, b.minZ, b.maxZ);
    } else if (interiorPocket) {
      const b = interiorPocket.bounds;
      this.currentCamPos.x = THREE.MathUtils.clamp(this.currentCamPos.x, b.minX, b.maxX);
      this.currentCamPos.y = THREE.MathUtils.clamp(this.currentCamPos.y, b.minY, b.maxY);
      this.currentCamPos.z = THREE.MathUtils.clamp(this.currentCamPos.z, b.minZ, b.maxZ);
    }

    this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, _v1.x, 12, dt);
    this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, _v1.y, 12, dt);
    this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, _v1.z, 12, dt);

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);

    const speedRatio = this.activeVehicle ? Math.min(1, Math.abs(this.activeVehicle.speed) / 55) : 0;
    const targetFov = (isCinematic ? 54 : inIndoor ? 64 : 60) + speedRatio * 14;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private emitHud(force: boolean): void {
    void force;
    const anchor = this.getResolvedExternalAnchor();
    const px = anchor.x;
    const pz = anchor.z;
    const district = getDistrictAt(px, pz);
    const latLon = worldToLatLon(px, pz);
    const utm = worldToUtm43N(px, pz);
    const prof = PROTAGONIST_PRESETS[this.playerCustom.protagonistId];

    let nearPrompt: string | null = null;
    let nearGarage = false;

    if (!this.activeVehicle && !this.studioActive) {
      if (this.metroJourney.phase !== 'none') {
        let bestD = Infinity;
        for (const trig of this.metroSim.triggers) {
          const d = Math.hypot(this.playerX - trig.x, this.playerZ - trig.z);
          const yOk = trig.id === 'use_elevator_cab' || Math.abs(this.playerY - trig.y) < 2.3;
          if (d < trig.radius && yOk && d < bestD) {
            bestD = d;
            nearPrompt = trig.label;
          }
        }
      } else if (this.activeInterior) {
        const pocket = this.interiors.pockets[this.activeInterior];
        for (const trig of pocket.triggers) {
          if (Math.hypot(this.playerX - trig.x, this.playerZ - trig.z) < trig.radius) {
            nearPrompt = trig.label;
            break;
          }
        }
      } else if (this.isSitting) {
        nearPrompt = 'Relaxing · Press F or move to stand';
      } else {
        for (const lm of LANDMARK_MARKERS) {
          if (Math.hypot(px - lm.x, pz - lm.z) < 7.5) {
            if (lm.type === 'garage') {
              nearPrompt = `At ${lm.name} — Open Garage to customize`;
              nearGarage = true;
            } else if (lm.type === 'interior') {
              const owned = !lm.price || (lm.interiorId && this.ownedProperties.includes(lm.interiorId));
              nearPrompt = owned
                ? `Press F to enter ${lm.name}`
                : `${lm.name} (₹${lm.price?.toLocaleString()}) — Purchase in Phone -> Homes`;
            } else if (lm.type === 'safehouse') {
              nearPrompt = `Press F to rest at ${lm.name}`;
            } else if (lm.type === 'petrol') {
              nearPrompt = `Press F to refuel & repair at ${lm.name}`;
            } else if (lm.type === 'darshini') {
              nearPrompt = `Press F for Masala Dosa & Kaapi (₹80, +40 HP) at ${lm.name}`;
            } else if (lm.type === 'atm') {
              nearPrompt = `Press F to withdraw ₹2,500 at ${lm.name}`;
            } else if (lm.type === 'bench') {
              nearPrompt = `Press F to sit on ${lm.name}`;
            }
            break;
          }
        }
      }
      if (!nearPrompt && !this.activeMission && !this.activeInterior && this.metroJourney.phase === 'none') {
        for (const m of MISSIONS) {
          if (Math.hypot(px - m.startX, pz - m.startZ) < 10) {
            nearPrompt = `Press F to start ${m.title}`;
            break;
          }
        }
      }
      if (!nearPrompt && !this.activeInterior && this.metroJourney.phase === 'none') {
        if (
          this.nammaYatriVehicle &&
          this.nammaYatri.status === 'waiting_pickup' &&
          Math.hypot(this.nammaYatriVehicle.x - px, this.nammaYatriVehicle.z - pz) < 7.5
        ) {
          nearPrompt = `Press F to board Namma Yatri passenger seat (${this.nammaYatri.driverName})`;
        } else {
          for (const v of this.vehicles) {
            if (Math.hypot(v.x - px, v.z - pz) < 5.8) {
              nearPrompt = `Press F to enter ${VEHICLE_SPECS[v.kind].label}`;
              break;
            }
          }
        }
      }
    } else if (this.activeVehicle) {
      if (this.nammaYatri.status === 'riding' && this.activeVehicle === this.nammaYatriVehicle) {
        nearPrompt = `Namma Yatri Chauffeur Mode → ${this.nammaYatri.destName} (ETA ${this.nammaYatri.etaSec}s) · [F] Exit Ride`;
      } else {
        for (const lm of LANDMARK_MARKERS) {
          if (lm.type === 'garage' && Math.hypot(px - lm.x, pz - lm.z) < 9.5) {
            nearGarage = true;
            nearPrompt = `At ${lm.name} — Open Garage to tune vehicle`;
            break;
          }
        }
      }
    }

    const speedKmh = this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 4.2) : 0;
    const gear = !this.activeVehicle
      ? 0
      : this.activeVehicle.speed < -0.5
      ? -1
      : Math.min(6, Math.max(1, Math.ceil(speedRatioToGear(speedKmh))));

    let missionInfo: HudSnapshot['activeMission'] = null;
    if (this.activeMission) {
      const am = this.activeMission;
      const cp =
        am.def.checkpoints && am.checkpointIndex < am.def.checkpoints.length
          ? am.def.checkpoints[am.checkpointIndex]
          : null;
      missionInfo = {
        id: am.def.id,
        title: am.def.title,
        objective: am.def.objectiveLabel,
        timeRemaining: am.timeRemaining,
        checkpointIndex: am.checkpointIndex,
        totalCheckpoints: am.def.checkpoints?.length ?? 1,
        targetX: cp ? cp.x : am.def.targetX,
        targetZ: cp ? cp.z : am.def.targetZ,
      };
    }

    let nearStation: HudSnapshot['nearStation'] = null;
    if (this.metroJourney.phase === 'none' && !this.activeInterior) {
      for (const ms of METRO_STATIONS) {
        if (Math.hypot(px - ms.x, pz - ms.z) < 11) {
          nearStation = {
            id: ms.id,
            name: ms.name,
            kannadaName: ms.kannadaName,
            kind: 'metro',
            line: ms.line,
            status: ms.status,
          };
          if (!nearPrompt && !this.activeVehicle && !this.studioActive) {
            nearPrompt =
              ms.status === 'under_construction'
                ? `${ms.name} (${ms.line.toUpperCase()} Line) — Under Construction (Boarding Unavailable)`
                : `Press F to enter ${ms.name} (${ms.line.toUpperCase()} Line)`;
          }
          break;
        }
      }
      if (!nearStation) {
        for (const rb of RAIL_BUS_STATIONS) {
          if (Math.hypot(px - rb.x, pz - rb.z) < 13) {
            nearStation = {
              id: rb.id,
              name: rb.name,
              kannadaName: rb.kannadaName,
              kind: rb.kind,
            };
            if (!nearPrompt && !this.activeVehicle && !this.studioActive) {
              nearPrompt = `Press F to travel via ${
                rb.kind === 'rail' ? 'Bengaluru Suburban Rail' : 'BMTC Express'
              } (₹35) from ${rb.name}`;
            }
            break;
          }
        }
      }
    }

    const policeBlips = this.vehicles
      .filter((v) => v.isPolice && v.disabledTimer <= 0)
      .map((v) => ({ x: v.x, z: v.z }));

    const radioState = this.audio.getRadioState();
    const solarTimes = getBengaluruSolarTimes(this.timeOfDayHours, this.istDayOfYear);
    const clockModeLabel =
      this.settings.timePreset === 'ist_realtime'
        ? 'Real-Time IST (1:1)'
        : this.settings.timePreset === 'auto'
        ? 'Game-Time Cycle'
        : `Preset (${this.settings.timePreset})`;

    const debugTelemetry: DebugTelemetry = {
      worldX: Number((this.activeVehicle ? this.activeVehicle.x : this.playerX).toFixed(2)),
      worldY: Number((this.activeVehicle ? this.activeVehicle.y : this.playerY).toFixed(2)),
      worldZ: Number((this.activeVehicle ? this.activeVehicle.z : this.playerZ).toFixed(2)),
      anchorX: Number(px.toFixed(2)),
      anchorZ: Number(pz.toFixed(2)),
      resolvedLocation: `${anchor.label} (${district.name})`,
      movementState: this.movementState,
      cameraMode: this.cameraMode,
      cameraPos: [
        Number(this.camera.position.x.toFixed(2)),
        Number(this.camera.position.y.toFixed(2)),
        Number(this.camera.position.z.toFixed(2)),
      ],
      fov: Math.round(this.camera.fov),
      activeVehiclesCount: this.vehicles.filter((v) => v.rig.group.visible).length,
      activeNpcsCount: this.npcs.filter((n) => n.rig.group.visible).length,
      policeCount: policeBlips.length,
      renderError: this.renderError,
    };

    const nearPassengerPrompt =
      this.metroJourney.phase === 'riding' || this.metroJourney.phase === 'arrived'
        ? this.metroSim.getNearestPassengerPrompt(this.playerX, this.playerZ)
        : null;
    if (nearPassengerPrompt && !nearPrompt) {
      nearPrompt = nearPassengerPrompt;
    }
    const canBoardMetro =
      this.metroJourney.phase === 'platform' &&
      this.trainPhase === 'boarding' &&
      this.trainDoorOpen >= 0.4 &&
      this.playerZ < -1233 &&
      !this.boardingTransition;
    const canExitTrain = this.metroJourney.phase === 'arrived';
    const canSitInTrain =
      this.metroJourney.phase === 'riding' || this.metroJourney.phase === 'arrived';
    const canHoldRail =
      this.metroJourney.phase === 'riding' || this.metroJourney.phase === 'arrived';

    const nearTriggerCheck = (trigId: string) =>
      this.metroJourney.phase !== 'none' &&
      this.metroSim.triggers.some(
        (t) =>
          t.id === trigId &&
          Math.hypot(this.playerX - t.x, this.playerZ - t.z) < t.radius &&
          Math.abs(this.playerY - t.y) < 2.3
      );
    const canUseTvm = nearTriggerCheck('tvm_kiosk');
    const canUseSmartCard = nearTriggerCheck('smart_card_kiosk');
    const canPassSecurity = nearTriggerCheck('security_scan') && !this.securityCleared;
    const canScanExitGate = nearTriggerCheck('exit_gate') && !this.exitGateCleared;

    this.onHudUpdate({
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      armor: Math.round(this.armor),
      maxArmor: this.maxArmor,
      stamina: Math.round(this.stamina),
      ammo: this.ammo,
      cash: this.cash,
      bankBalance: this.bankBalance,
      wantedStars: this.wantedStars,
      wantedCooldown: this.wantedCooldown,
      isEvading: this.isEvading,
      protagonistId: this.playerCustom.protagonistId,
      protagonistName: prof.name,
      districtName: district.name,
      districtKannada: district.kannadaName,
      discoveredDistricts: Array.from(this.discoveredDistricts),
      totalDistricts: DISTRICTS.length,
      playerX: px,
      playerZ: pz,
      playerLat: latLon.lat,
      playerLon: latLon.lon,
      utmEasting: Math.round(utm.easting),
      utmNorthing: Math.round(utm.northing),
      playerHeading: this.activeVehicle ? this.activeVehicle.heading : this.playerHeading,
      inVehicle: !!this.activeVehicle,
      vehicleKind: this.activeVehicle?.kind ?? null,
      vehicleLabel: this.activeVehicle ? VEHICLE_SPECS[this.activeVehicle.kind].label : '',
      vehicleHealth: this.activeVehicle
        ? Math.round((this.activeVehicle.health / this.activeVehicle.maxHealth) * 100)
        : 100,
      vehicleFuel: this.activeVehicle ? Math.round(this.activeVehicle.fuel) : 100,
      speedKmh,
      gear,
      headlightsOn: this.headlightsOn,
      isSwimming: this.isSwimming,
      isCrouching: this.isCrouching,
      isSitting: this.isSitting,
      isBlocking: this.isBlocking,
      cameraMode: this.cameraMode,
      studioActive: this.studioActive,
      studioAngle: this.studioAngle,
      studioPose: this.studioPose,
      studioLighting: this.studioLighting,
      studioYawOffset: Math.round((this.studioYawOffset * 180) / Math.PI),
      weapon: this.weapon,
      nearPrompt,
      nearGarage,
      nearStation,
      activeInterior: this.activeInterior,
      interiorAction: this.interiorAction,
      tvState: this.tvState,
      homeLightsOn: this.homeLightsOn,
      homeCurtainsOpen: this.homeCurtainsOpen,
      ownedProperties: this.ownedProperties,
      groceryBasket: this.groceryBasket,
      pantryItems: this.pantryItems,
      metroJourney: { ...this.metroJourney },
      metroTickets: this.metroTickets,
      nammaYatri: { ...this.nammaYatri },
      transactions: this.transactions,
      messages: this.messages,
      activeRoute: this.activeRoute,
      partitionStats: this.partitionStats,
      timeOfDayHours: this.timeOfDayHours,
      timePreset: this.settings.timePreset,
      istClockLabel: this.istClockLabel,
      istDateLabel: this.istDateLabel,
      istWeekday: this.istWeekday,
      timezoneLabel: this.timezoneLabel,
      clockModeLabel,
      solarTimes,
      locationAnchorLabel: anchor.label,
      nammaYatriPassengerMode: this.nammaYatri.status === 'riding' && this.activeVehicle === this.nammaYatriVehicle,
      weather: this.settings.weather,
      language: this.settings.language,
      photoMode: this.photoMode,
      activeMission: missionInfo,
      completedMissions: Array.from(this.completedMissions),
      collectedIds: Array.from(this.collectedIds),
      waypoint: this.waypoint,
      npcSubtitle: this.npcSubtitle,
      toastMessage: this.toastMessage,
      radioOn: this.settings.radioOn,
      radioTrack: `${radioState.trackTitle} — ${radioState.trackArtist}`,
      radioState,
      policeBlips,
      arrestStage: this.arrestStage,
      arrestStationName: this.arrestTargetStation.name,
      arrestOfficerCount: this.policeOfficers.length,
      jailBailCost: Math.max(500, this.wantedStars * 800),
      trafficCongestion: { ...this.trafficCongestion },
      canBoardMetro,
      canExitTrain,
      canUseTvm,
      canUseSmartCard,
      canPassSecurity,
      canScanExitGate,
      nearPassengerPrompt,
      canSitInTrain,
      canHoldRail,
      cityShowcaseActive: this.cityShowcaseActive,
      cityShowcaseLabel: this.cityShowcaseLabel,
      fps: this.currentFps,
      debugTelemetry,
    });
  }

  public captureScreenshotDataUrl(): string | null {
    if (this.disposed || !this.renderer) return null;
    this.renderer.render(this.scene, this.camera);
    try {
      return this.renderer.domElement.toDataURL('image/png');
    } catch {
      return null;
    }
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    window.removeEventListener('resize', this.handleResizeBound);
    window.removeEventListener('keydown', this.handleKeyDownBound);
    window.removeEventListener('keyup', this.handleKeyUpBound);
    window.removeEventListener('pointermove', this.handlePointerMoveBound);
    window.removeEventListener('pointerup', this.handlePointerUpBound);
    this.cleanupNammaYatriDriver();
    this.cleanupArrestOfficers();
    disposeHumanRig(this.playerRig);
    for (const npc of this.npcs) disposeHumanRig(npc.rig);
    this.audio.dispose();
    this.textures.dispose();
    this.scene.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        obj.geometry.dispose();
        if (Array.isArray(obj.material)) obj.material.forEach((m) => m.dispose());
        else obj.material.dispose();
      }
    });
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}

function speedRatioToGear(kmh: number): number {
  if (kmh < 2) return 1;
  if (kmh < 35) return 1;
  if (kmh < 70) return 2;
  if (kmh < 110) return 3;
  if (kmh < 155) return 4;
  if (kmh < 205) return 5;
  return 6;
}
