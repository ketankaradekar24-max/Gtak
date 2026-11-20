import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BengaluruAudio } from './audio';
import {
  COLLECTIBLES,
  DISTRICTS,
  LANDMARK_MARKERS,
  MISSIONS,
  NPC_DIALOGUE_LINES,
  RADIO_TRACKS,
  VEHICLE_SPECS,
  WORLD_HALF_SIZE,
  getDistrictAt,
  getFlyoverDeckY,
  isPointInWater,
} from './bengaluruData';
import {
  PlayerRig,
  VehicleRig,
  applyPlayerCustomization,
  createNpcRig,
  createPlayerRig,
  createVehicleRig,
} from './entities';
import { TextureBundle, createProceduralTextures } from './textures';
import {
  DistrictId,
  GameSettings,
  HudSnapshot,
  MissionDef,
  PlayerCustomization,
  VehicleKind,
  VehicleTuning,
  WeaponKind,
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
  steerAngle: number;
  health: number;
  maxHealth: number;
  isAi: boolean;
  isPolice: boolean;
  aiAxis: 'ns' | 'ew';
  aiDir: 1 | -1;
  aiLaneOffset: number;
  disabledTimer: number;
  honkCooldown: number;
}

interface SimNpc {
  rig: ReturnType<typeof createNpcRig>;
  x: number;
  z: number;
  heading: number;
  speed: number;
  turnTimer: number;
  lineIndex: number;
}

interface ActiveMissionState {
  def: MissionDef;
  timeRemaining: number | null;
  checkpointIndex: number;
  evadeTimer: number;
}

// Pre-allocated math scratch (Zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _camDesired = new THREE.Vector3();
const _camTarget = new THREE.Vector3();

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
  public audio = new BengaluruAudio();

  private isSoftwareGl = false;
  private frameId = 0;
  private disposed = false;
  private paused = false;
  private started = false;
  private clock = new THREE.Clock();
  private elapsed = 0;

  // Player state
  private playerRig!: PlayerRig;
  private playerX = 48;
  private playerY = 0;
  private playerZ = -22;
  private playerVy = 0;
  private playerHeading = Math.PI * 0.5;
  private isGrounded = true;
  private isSwimming = false;
  private isCrouching = false;
  private health = 100;
  private maxHealth = 100;
  private armor = 60;
  private maxArmor = 100;
  private cash = 12500;
  private weapon: WeaponKind = 'unarmed';

  // Camera orbit offset
  private camYawOffset = 0;
  private camPitch = 0.28;
  private currentCamPos = new THREE.Vector3(48, 8, -36);
  private currentLookAt = new THREE.Vector3(48, 2, -22);
  private isDraggingCam = false;
  private lastPointerX = 0;
  private lastPointerY = 0;

  // Vehicles & Entities
  private vehicles: SimVehicle[] = [];
  private activeVehicle: SimVehicle | null = null;
  private headlightsOn = true;
  private npcs: SimNpc[] = [];
  private projectiles: Array<{ mesh: THREE.Mesh; vx: number; vy: number; vz: number; life: number; isEmp: boolean }> = [];

  // Police & Wanted
  private wantedStars = 0;
  private wantedCooldown = 0;
  private isEvading = false;

  // Progression & World State
  private discoveredDistricts = new Set<DistrictId>(['mg_road']);
  private completedMissions = new Set<string>();
  private collectedIds = new Set<string>();
  private activeMission: ActiveMissionState | null = null;
  private waypoint: { x: number; z: number; label: string } | null = null;
  private timeOfDayHours = 10.5; // Starts bright Bengaluru morning
  private npcSubtitle: { speaker: string; language: string; line: string } | null = null;
  private subtitleTimer = 0;
  private toastMessage: string | null = null;
  private toastTimer = 0;
  private radioTrackIdx = 0;

  // Customization & Settings
  private playerCustom: PlayerCustomization = {
    jacketColor: '#b45309',
    shirtColor: '#f8fafc',
    pantsColor: '#1e293b',
    sunglasses: true,
    backpack: false,
  };
  private vehicleTuning: VehicleTuning = {
    color: '#f97316',
    engineLevel: 1,
    handlingLevel: 1,
    armorLevel: 1,
  };
  private settings: GameSettings = {
    timePreset: 'auto',
    weather: 'clear',
    trafficDensity: 'medium',
    radioOn: true,
    sfxOn: true,
    cameraSensitivity: 1.0,
  };

  // Input
  private keys = new Set<string>();
  private onHudUpdate: (snap: HudSnapshot) => void;
  private onContextLost: () => void;
  private lastHudEmit = 0;

  // Event handler refs for cleanup
  private handleResizeBound: () => void;
  private handleKeyDownBound: (e: KeyboardEvent) => void;
  private handleKeyUpBound: (e: KeyboardEvent) => void;
  private handlePointerDownBound: (e: PointerEvent) => void;
  private handlePointerMoveBound: (e: PointerEvent) => void;
  private handlePointerUpBound: () => void;

  constructor(
    container: HTMLElement,
    onHudUpdate: (snap: HudSnapshot) => void,
    onContextLost: () => void
  ) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;
    this.onContextLost = onContextLost;

    this.handleResizeBound = this.onResize.bind(this);
    this.handleKeyDownBound = this.onKeyDown.bind(this);
    this.handleKeyUpBound = this.onKeyUp.bind(this);
    this.handlePointerDownBound = this.onPointerDown.bind(this);
    this.handlePointerMoveBound = this.onPointerMove.bind(this);
    this.handlePointerUpBound = this.onPointerUp.bind(this);

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
    this.renderer.toneMappingExposure = 1.1;
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

    this.camera = new THREE.PerspectiveCamera(62, width / height, 0.25, 900);

    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();
    this.textures = createProceduralTextures(maxAniso);
    this.world = buildBengaluruWorld(this.scene, this.textures);

    // Player protagonist
    this.playerRig = createPlayerRig(this.playerCustom, this.textures.contactShadow);
    this.playerRig.group.position.set(this.playerX, 0, this.playerZ);
    this.scene.add(this.playerRig.group);

    // Spawn Hero Parked Vehicles near MG Road, Indiranagar & Iconic Spots
    this.spawnVehicle('coupe', 58, -18, Math.PI * 0.5, false, false, this.vehicleTuning.color);
    this.spawnVehicle('auto', 32, -26, 0, false, false);
    this.spawnVehicle('bike', 68, -32, -Math.PI * 0.5, false, false);
    this.spawnVehicle('cab', 260, -90, Math.PI * 0.5, false, false);
    this.spawnVehicle('bmtc', -332, -95, 0, false, false);

    // Spawn Bengaluru AI Traffic
    this.populateTraffic();

    // Spawn Bengaluru Pedestrians
    this.populateNpcs();

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
      speed: isAi ? spec.maxSpeed * 0.45 : 0,
      steerAngle: 0,
      health: spec.maxHealth,
      maxHealth: spec.maxHealth,
      isAi,
      isPolice,
      aiAxis: Math.abs(Math.sin(heading)) > 0.7 ? 'ew' : 'ns',
      aiDir: Math.sin(heading) >= 0 && Math.cos(heading) >= 0 ? 1 : -1,
      aiLaneOffset: 4.5,
      disabledTimer: 0,
      honkCooldown: 2 + Math.random() * 6,
    };
    this.vehicles.push(v);
    return v;
  }

  private populateTraffic(): void {
    const ewZ = [-200, -40, 110, 260, 430];
    const nsX = [-340, -170, 40, 230, 420];
    const kinds: VehicleKind[] = ['auto', 'auto', 'cab', 'bike', 'bmtc', 'cab', 'auto'];

    for (let i = 0; i < 28; i++) {
      const kind = kinds[i % kinds.length];
      const isEw = i % 2 === 0;
      if (isEw) {
        const zBase = ewZ[i % ewZ.length];
        const dir: 1 | -1 = i % 4 === 0 ? 1 : -1;
        const x = -420 + ((i * 73) % 840);
        const heading = dir === 1 ? Math.PI * 0.5 : -Math.PI * 0.5;
        const v = this.spawnVehicle(kind, x, zBase + dir * 4.2, heading, true, false);
        v.aiAxis = 'ew';
        v.aiDir = dir;
      } else {
        const xBase = nsX[i % nsX.length];
        const dir: 1 | -1 = i % 4 === 1 ? 1 : -1;
        const z = -420 + ((i * 89) % 840);
        const heading = dir === 1 ? 0 : Math.PI;
        const v = this.spawnVehicle(kind, xBase - dir * 4.2, z, heading, true, false);
        v.aiAxis = 'ns';
        v.aiDir = dir;
      }
    }
  }

  private populateNpcs(): void {
    const shirts = [0xef4444, 0xf59e0b, 0x10b981, 0x3b82f6, 0xec4899, 0xf8fafc, 0x8b5cf6];
    const pants = [0x1e293b, 0x334155, 0x172554, 0x451a03];
    const hubs: Array<[number, number]> = [
      [40, -25],
      [45, 75],
      [-130, -10],
      [-335, 95],
      [-340, -105],
      [235, -105],
      [210, 130],
      [-160, 265],
    ];
    for (let i = 0; i < 36; i++) {
      const [hx, hz] = hubs[i % hubs.length];
      const x = hx + (Math.random() - 0.5) * 70;
      const z = hz + (Math.random() - 0.5) * 70;
      const rig = createNpcRig(shirts[i % shirts.length], pants[i % pants.length], this.textures.contactShadow);
      rig.group.position.set(x, 0, z);
      this.scene.add(rig.group);
      this.npcs.push({
        rig,
        x,
        z,
        heading: Math.random() * Math.PI * 2,
        speed: 1.6 + Math.random() * 1.1,
        turnTimer: 2 + Math.random() * 5,
        lineIndex: i % NPC_DIALOGUE_LINES.length,
      });
    }
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
    const code = e.code;
    this.keys.add(code);
    this.audio.unlock();

    if (!this.started || this.paused) return;

    if (code === 'KeyF' || code === 'KeyE') {
      this.handleInteractOrVehicle();
    } else if (code === 'KeyC' && !this.activeVehicle) {
      this.isCrouching = !this.isCrouching;
    } else if (code === 'KeyH' && this.activeVehicle) {
      this.audio.playHorn(this.activeVehicle.kind);
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
    } else if (code === 'KeyG') {
      this.triggerAction();
    }
  }

  private onKeyUp(e: KeyboardEvent): void {
    this.keys.delete(e.code);
  }

  private onPointerDown(e: PointerEvent): void {
    this.audio.unlock();
    if (!this.started || this.paused) return;
    if (e.button === 0) {
      this.isDraggingCam = true;
      this.lastPointerX = e.clientX;
      this.lastPointerY = e.clientY;
    } else if (e.button === 2) {
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
    this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * sens, 0.08, 0.85);
  }

  private onPointerUp(): void {
    this.isDraggingCam = false;
  }

  public startGame(): void {
    this.started = true;
    this.paused = false;
    this.audio.unlock();
    this.audio.setSettings(this.settings.sfxOn, this.settings.radioOn);
    this.showToast('Welcome to Bengaluru. Explore MG Road or press M for the City Map.');
    this.emitHud(true);
  }

  public setPaused(p: boolean): void {
    this.paused = p;
    if (p) this.keys.clear();
  }

  public selectWeapon(w: WeaponKind): void {
    this.weapon = w;
    this.emitHud(true);
  }

  public triggerAction(): void {
    if (!this.started || this.paused || this.activeVehicle) return;
    if (this.weapon === 'unarmed' || this.weapon === 'baton') {
      this.audio.playActionPulse(false);
      // Stun nearby hostile / push away NPC or raise wanted if hitting traffic
      this.playerRig.rightArm.rotation.x = -1.4;
      return;
    }

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
    this.projectiles.push({
      mesh: orb,
      vx: dirX * 48,
      vy: 0,
      vz: dirZ * 48,
      life: 1.2,
      isEmp,
    });
  }

  private handleInteractOrVehicle(): void {
    if (this.activeVehicle) {
      // Exit vehicle safely to left side
      const v = this.activeVehicle;
      const exitAngle = v.heading + Math.PI * 0.5;
      this.playerX = v.x + Math.sin(exitAngle) * 2.4;
      this.playerZ = v.z + Math.cos(exitAngle) * 2.4;
      this.playerY = getFlyoverDeckY(this.playerX, this.playerZ);
      this.playerHeading = v.heading;
      if (v.rig.riderGroup) v.rig.riderGroup.visible = false;
      this.activeVehicle = null;
      this.playerRig.group.visible = true;
      this.emitHud(true);
      return;
    }

    // Check landmark interactions (Safehouse, Garage, Petrol)
    for (const lm of LANDMARK_MARKERS) {
      if (Math.hypot(this.playerX - lm.x, this.playerZ - lm.z) < 7) {
        if (lm.type === 'safehouse') {
          this.health = this.maxHealth;
          this.armor = this.maxArmor;
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
          this.showToast('Silk Board Station: Nearest vehicle refueled & repaired.');
          this.repairNearestVehicle();
          return;
        }
      }
    }

    // Check mission start markers if no active mission
    if (!this.activeMission) {
      for (const m of MISSIONS) {
        if (Math.hypot(this.playerX - m.startX, this.playerZ - m.startZ) < 9) {
          this.startMission(m.id);
          return;
        }
      }
    }

    // Find closest vehicle within 5.5m
    let closest: SimVehicle | null = null;
    let bestD = 5.5;
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
    if (v.rig.riderGroup) v.rig.riderGroup.visible = true;
    this.playerRig.group.visible = false;
    this.isCrouching = false;
    this.isSwimming = false;
    this.camYawOffset = 0;
    this.audio.playHorn(v.kind);
    if (v.isPolice && this.wantedStars < 2) {
      this.addWantedStars(2);
    }
    this.emitHud(true);
  }

  public startMission(missionId: string): void {
    const def = MISSIONS.find((m) => m.id === missionId);
    if (!def) return;

    this.activeMission = {
      def,
      timeRemaining: def.timeLimitSec ?? null,
      checkpointIndex: 0,
      evadeTimer: 0,
    };

    // Move player to mission start if far away (so launching from Menu works seamlessly)
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

    // Spawn recommended vehicle nearby if not driving
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

    if (def.wantedStars) {
      this.addWantedStars(def.wantedStars);
    } else {
      this.wantedStars = 0;
      this.isEvading = false;
    }

    if (def.forceTime === 'night') {
      this.timeOfDayHours = 22.5;
    }

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
    this.emitHud(true);
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
    this.showToast(`Fast traveled to ${d.name}`);
    this.emitHud(true);
  }

  public applyCustomization(custom: PlayerCustomization): void {
    this.playerCustom = { ...custom };
    applyPlayerCustomization(this.playerRig, this.playerCustom);
    this.showToast('Character wardrobe updated.');
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
      // Exit current
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
    const target = this.activeVehicle || this.vehicles[0];
    if (target) {
      target.health = target.maxHealth;
      this.showToast(`${VEHICLE_SPECS[target.kind].label} repaired to 100%.`);
      this.emitHud(true);
    }
  }

  public updateSettings(next: Partial<GameSettings>): void {
    this.settings = { ...this.settings, ...next };
    if (next.timePreset === 'morning') this.timeOfDayHours = 9.5;
    else if (next.timePreset === 'golden') this.timeOfDayHours = 17.6;
    else if (next.timePreset === 'night') this.timeOfDayHours = 22.5;
    this.audio.setSettings(this.settings.sfxOn, this.settings.radioOn);
    this.emitHud(true);
  }

  public getSettings(): GameSettings {
    return { ...this.settings };
  }

  public toggleRadio(): void {
    if (!this.settings.radioOn) {
      this.settings.radioOn = true;
    } else {
      this.radioTrackIdx = (this.radioTrackIdx + 1) % (RADIO_TRACKS.length + 1);
      if (this.radioTrackIdx === RADIO_TRACKS.length) {
        this.settings.radioOn = false;
        this.radioTrackIdx = 0;
      }
    }
    this.audio.setSettings(this.settings.sfxOn, this.settings.radioOn);
    this.showToast(this.settings.radioOn ? `Radio: ${RADIO_TRACKS[this.radioTrackIdx]}` : 'Radio Off');
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

  private tick = (): void => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (!this.paused) {
      this.elapsed += dt;
      if (this.settings.timePreset === 'auto') {
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

      if (this.started) {
        if (this.activeVehicle) {
          this.updatePlayerDriving(dt);
        } else {
          this.updatePlayerOnFoot(dt);
        }
        this.updateProjectiles(dt);
        this.updateTrafficSignals();
        this.updateAiVehicles(dt);
        this.updateNpcs(dt);
        this.updatePoliceWanted(dt);
        this.updateCollectiblesAndDiscovery();
        this.updateMission(dt);
      }

      const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
      const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
      this.world.updateAtmosphere(this.timeOfDayHours, this.settings.weather, px, pz, this.elapsed, dt);
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

  private resolveBuildingCollision(x: number, z: number, radius: number, currentY: number): [number, number] {
    let nx = THREE.MathUtils.clamp(x, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
    let nz = THREE.MathUtils.clamp(z, -WORLD_HALF_SIZE, WORLD_HALF_SIZE);
    for (const c of this.world.colliders) {
      if (currentY > c.height + 0.5) continue;
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

  private updatePlayerOnFoot(dt: number): void {
    let moveFwd = 0;
    let moveRight = 0;
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) moveFwd += 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) moveFwd -= 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) moveRight -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) moveRight += 1;

    const water = isPointInWater(this.playerX, this.playerZ);
    this.isSwimming = !!water && this.playerY <= 0.4;

    const sprinting = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const baseSpeed = this.isSwimming ? 4.8 : this.isCrouching ? 3.5 : sprinting ? 12.2 : 7.0;

    if (moveFwd !== 0 || moveRight !== 0) {
      const camYaw = this.playerHeading + this.camYawOffset;
      const inputAngle = Math.atan2(moveRight, moveFwd);
      const targetHeading = camYaw + inputAngle * 0.55;
      // Compute world movement vector aligned to camera view direction
      const viewDirX = Math.sin(this.playerHeading + this.camYawOffset);
      const viewDirZ = Math.cos(this.playerHeading + this.camYawOffset);
      const rightDirX = Math.cos(this.playerHeading + this.camYawOffset);
      const rightDirZ = -Math.sin(this.playerHeading + this.camYawOffset);

      let vx = viewDirX * moveFwd + rightDirX * moveRight;
      let vz = viewDirZ * moveFwd + rightDirZ * moveRight;
      const len = Math.hypot(vx, vz) || 1;
      vx /= len;
      vz /= len;

      this.playerHeading = Math.atan2(vx, vz);
      this.camYawOffset = THREE.MathUtils.damp(this.camYawOffset, 0, 2.2, dt);

      const nextX = this.playerX + vx * baseSpeed * dt;
      const nextZ = this.playerZ + vz * baseSpeed * dt;
      const [rx, rz] = this.resolveBuildingCollision(nextX, nextZ, 0.55, this.playerY);
      this.playerX = rx;
      this.playerZ = rz;

      // Limb animation
      const freq = sprinting ? 14 : 9;
      const amp = this.isSwimming ? 0.55 : sprinting ? 0.85 : 0.55;
      const swing = Math.sin(this.elapsed * freq) * amp;
      this.playerRig.leftLeg.rotation.x = swing;
      this.playerRig.rightLeg.rotation.x = -swing;
      this.playerRig.leftArm.rotation.x = -swing * 0.8;
      this.playerRig.rightArm.rotation.x = swing * 0.8;
      void targetHeading;
    } else {
      this.playerRig.leftLeg.rotation.x = THREE.MathUtils.damp(this.playerRig.leftLeg.rotation.x, 0, 10, dt);
      this.playerRig.rightLeg.rotation.x = THREE.MathUtils.damp(this.playerRig.rightLeg.rotation.x, 0, 10, dt);
      this.playerRig.leftArm.rotation.x = THREE.MathUtils.damp(this.playerRig.leftArm.rotation.x, 0, 10, dt);
      this.playerRig.rightArm.rotation.x = THREE.MathUtils.damp(this.playerRig.rightArm.rotation.x, 0, 10, dt);
    }

    // Jump & Gravity + Flyover Surface Y
    if (this.keys.has('Space') && this.isGrounded && !this.isSwimming) {
      this.playerVy = 8.4;
      this.isGrounded = false;
      this.isCrouching = false;
    }
    const groundY = getFlyoverDeckY(this.playerX, this.playerZ);
    this.playerVy -= 21 * dt;
    this.playerY += this.playerVy * dt;
    if (this.playerY <= groundY) {
      this.playerY = groundY;
      this.playerVy = 0;
      this.isGrounded = true;
    }

    // Crouch / Swim pose
    const targetScaleY = this.isCrouching ? 0.72 : 1.0;
    this.playerRig.group.scale.y = THREE.MathUtils.damp(this.playerRig.group.scale.y, targetScaleY, 12, dt);
    this.playerRig.group.rotation.x = THREE.MathUtils.damp(
      this.playerRig.group.rotation.x,
      this.isSwimming ? 1.1 : 0,
      8,
      dt
    );
    this.playerRig.group.position.set(this.playerX, this.isSwimming ? -0.35 : this.playerY, this.playerZ);
    this.playerRig.group.rotation.y = this.playerHeading;
  }

  private updatePlayerDriving(dt: number): void {
    const v = this.activeVehicle!;
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

    const gripMult = this.settings.weather === 'monsoon' ? 0.84 : 1.0;

    if (throttle > 0) {
      v.speed += spec.accel * engineBoost * (nitro ? 1.25 : 1) * dt;
    } else if (throttle < 0) {
      if (v.speed > 1) v.speed -= spec.brake * dt;
      else v.speed -= spec.accel * 0.55 * dt;
    } else {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 1.8, dt);
    }

    if (handbrake) {
      v.speed = THREE.MathUtils.damp(v.speed, 0, 5.5, dt);
    }

    v.speed = THREE.MathUtils.clamp(v.speed, -maxSpd * 0.35, maxSpd * (nitro ? 1.15 : 1));

    const speedFactor = Math.min(1, Math.abs(v.speed) / 8);
    const steerSign = v.speed >= -0.1 ? 1 : -1;
    v.steerAngle = THREE.MathUtils.damp(v.steerAngle, steer * 0.45, 10, dt);
    v.heading += steer * spec.turnRate * handlingBoost * gripMult * speedFactor * steerSign * dt;

    const prevX = v.x;
    const prevZ = v.z;
    const nextX = v.x + Math.sin(v.heading) * v.speed * dt;
    const nextZ = v.z + Math.cos(v.heading) * v.speed * dt;
    const [rx, rz] = this.resolveBuildingCollision(nextX, nextZ, v.kind === 'bmtc' ? 2.4 : 1.55, v.y);

    if (Math.hypot(rx - nextX, rz - nextZ) > 0.05 && Math.abs(v.speed) > 10) {
      this.audio.playImpact(Math.abs(v.speed) / maxSpd);
      v.health = Math.max(10, v.health - Math.abs(v.speed) * 0.35);
      v.speed *= 0.45;
    }

    // Check collisions with AI traffic
    for (const other of this.vehicles) {
      if (other === v) continue;
      const minD = (v.kind === 'bmtc' ? 3.5 : 2.1) + (other.kind === 'bmtc' ? 3.5 : 2.1);
      const dist = Math.hypot(rx - other.x, rz - other.z);
      if (dist < minD && Math.abs(v.y - other.y) < 3) {
        if (Math.abs(v.speed) > 12) {
          this.audio.playImpact(0.7);
          other.speed = v.speed * 0.5;
          v.speed *= 0.55;
          if (other.isPolice || Math.abs(v.speed) > 18) {
            this.addWantedStars(other.isPolice ? 2 : 1);
          }
        } else {
          v.speed *= 0.8;
        }
      }
    }

    v.x = rx;
    v.z = rz;
    const targetY = getFlyoverDeckY(v.x, v.z);
    v.y = THREE.MathUtils.damp(v.y, targetY, 16, dt);

    v.rig.group.position.set(v.x, v.y, v.z);
    v.rig.group.rotation.y = v.heading;
    // Subtle motorcycle lean & car roll
    const leanTarget = (v.kind === 'bike' || v.kind === 'police_bike' ? -0.35 : 0.06) * steer * speedFactor;
    v.rig.group.rotation.z = THREE.MathUtils.damp(v.rig.group.rotation.z, leanTarget, 8, dt);

    // Wheel spin & front wheel steering
    const wheelDelta = (Math.hypot(v.x - prevX, v.z - prevZ) * Math.sign(v.speed)) / 0.36;
    v.rig.wheels.forEach((w) => (w.rotation.x += wheelDelta));
    v.rig.frontSteerPivots.forEach((pv) => (pv.rotation.y = v.steerAngle));

    this.updateVehicleLights(v, throttle < 0 || handbrake);

    this.playerX = v.x;
    this.playerY = v.y;
    this.playerZ = v.z;
    this.playerHeading = v.heading;
    this.camYawOffset = THREE.MathUtils.damp(this.camYawOffset, 0, 1.4, dt);
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
    const phase = Math.floor(this.elapsed / 7) % 2; // 0: NS green, 1: EW green
    for (const sig of this.world.trafficSignals) {
      (sig.nsGreen.material as THREE.MeshStandardMaterial).emissiveIntensity = phase === 0 ? 2.2 : 0.1;
      (sig.nsRed.material as THREE.MeshStandardMaterial).emissiveIntensity = phase === 1 ? 2.2 : 0.1;
      (sig.ewGreen.material as THREE.MeshStandardMaterial).emissiveIntensity = phase === 1 ? 2.2 : 0.1;
      (sig.ewRed.material as THREE.MeshStandardMaterial).emissiveIntensity = phase === 0 ? 2.2 : 0.1;
    }
  }

  private updateAiVehicles(dt: number): void {
    const densityLimit = this.settings.trafficDensity === 'low' ? 14 : this.settings.trafficDensity === 'medium' ? 24 : 34;
    const signalPhase = Math.floor(this.elapsed / 7) % 2;

    let aiCounter = 0;
    for (const v of this.vehicles) {
      if (!v.isAi) continue;
      aiCounter++;
      const visible = v.isPolice || aiCounter <= densityLimit;
      v.rig.group.visible = visible;
      if (!visible) continue;

      if (v.disabledTimer > 0) {
        v.disabledTimer -= dt;
        continue;
      }

      const spec = VEHICLE_SPECS[v.kind];

      if (v.isPolice && this.wantedStars > 0) {
        // Police pursuit steering toward player
        const dx = this.playerX - v.x;
        const dz = this.playerZ - v.z;
        const dist = Math.hypot(dx, dz);
        const desiredHeading = Math.atan2(dx, dz);
        let diff = desiredHeading - v.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        v.heading += THREE.MathUtils.clamp(diff, -2.5 * dt, 2.5 * dt);
        v.speed = THREE.MathUtils.damp(v.speed, dist > 7 ? spec.maxSpeed * 0.85 : 6, 3, dt);

        if (dist < 4.2 && this.activeVehicle && Math.abs(v.speed) > 10) {
          this.activeVehicle.health = Math.max(5, this.activeVehicle.health - 8 * dt);
        } else if (dist < 3.6 && !this.activeVehicle) {
          this.damagePlayer(12 * dt);
        }

        // Flash red-blue police lightbars
        if (v.rig.policeLights) {
          const flash = Math.floor(this.elapsed * 9) % 2 === 0;
          (v.rig.policeLights.red.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 2.5 : 0.1;
          (v.rig.policeLights.blue.material as THREE.MeshStandardMaterial).emissiveIntensity = flash ? 0.1 : 2.5;
        }
      } else {
        // Civilian Bengaluru Traffic AI
        let targetSpeed = spec.maxSpeed * 0.48;

        // Check red traffic signal ahead
        const intersections = [-340, -170, 40, 230, 420];
        const ewRoads = [-200, -40, 110, 260, 430];
        if (v.aiAxis === 'ew' && signalPhase === 0) {
          for (const ix of intersections) {
            const distToStop = (ix - v.x) * v.aiDir;
            if (distToStop > 8 && distToStop < 22) targetSpeed = 0;
          }
        } else if (v.aiAxis === 'ns' && signalPhase === 1) {
          for (const iz of ewRoads) {
            const distToStop = (iz - v.z) * v.aiDir;
            if (distToStop > 8 && distToStop < 22) targetSpeed = 0;
          }
        }

        // Slow down if player is directly in front
        const distPlayer = Math.hypot(this.playerX - v.x, this.playerZ - v.z);
        if (distPlayer < 12) {
          targetSpeed = 0;
          v.honkCooldown -= dt;
          if (v.honkCooldown <= 0) {
            v.honkCooldown = 4 + Math.random() * 5;
            if (distPlayer < 26) this.audio.playHorn(v.kind);
          }
        }

        v.speed = THREE.MathUtils.damp(v.speed, targetSpeed, 4, dt);
      }

      const nx = v.x + Math.sin(v.heading) * v.speed * dt;
      const nz = v.z + Math.cos(v.heading) * v.speed * dt;
      const [rx, rz] = this.resolveBuildingCollision(nx, nz, 1.5, v.y);
      v.x = rx;
      v.z = rz;

      // Wrap traffic seamlessly across Bengaluru boundaries
      if (!v.isPolice) {
        if (v.x > 490) v.x = -490;
        if (v.x < -490) v.x = 490;
        if (v.z > 490) v.z = -490;
        if (v.z < -490) v.z = 490;
      }

      v.y = v.isPolice ? getFlyoverDeckY(v.x, v.z) : 0;
      v.rig.group.position.set(v.x, v.y, v.z);
      v.rig.group.rotation.y = v.heading;
      v.rig.wheels.forEach((w) => (w.rotation.x += v.speed * dt * 2.2));
    }
  }

  private updateNpcs(dt: number): void {
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;

    for (const npc of this.npcs) {
      npc.turnTimer -= dt;
      if (npc.turnTimer <= 0) {
        npc.heading += (Math.random() - 0.5) * 2.2;
        npc.turnTimer = 3 + Math.random() * 5;
      }
      const nx = npc.x + Math.sin(npc.heading) * npc.speed * dt;
      const nz = npc.z + Math.cos(npc.heading) * npc.speed * dt;
      const [rx, rz] = this.resolveBuildingCollision(nx, nz, 0.4, 0);
      if (Math.hypot(rx - nx, rz - nz) > 0.05) {
        npc.heading += Math.PI * 0.7;
      }
      npc.x = rx;
      npc.z = rz;
      npc.rig.group.position.set(npc.x, 0, npc.z);
      npc.rig.group.rotation.y = npc.heading;
      const swing = Math.sin(this.elapsed * 6 + npc.lineIndex) * 0.45;
      npc.rig.leftLeg.rotation.x = swing;
      npc.rig.rightLeg.rotation.x = -swing;

      // Trigger Kannada/English/Hindi ambient dialogue subtitle when player walks nearby
      if (!this.activeVehicle && this.subtitleTimer <= 0 && Math.hypot(npc.x - px, npc.z - pz) < 6.5) {
        this.npcSubtitle = NPC_DIALOGUE_LINES[npc.lineIndex];
        this.subtitleTimer = 4.0;
      }
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
    if (this.wantedStars <= 0) return;

    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    let minPoliceDist = Infinity;
    for (const v of this.vehicles) {
      if (!v.isPolice || v.disabledTimer > 0) continue;
      const d = Math.hypot(v.x - px, v.z - pz);
      if (d < minPoliceDist) minPoliceDist = d;
    }

    if (minPoliceDist > 95) {
      this.isEvading = true;
      this.wantedCooldown -= dt / (8 + this.wantedStars * 2);
      if (this.wantedCooldown <= 0) {
        this.wantedStars = 0;
        this.wantedCooldown = 0;
        this.isEvading = false;
        this.showToast('Pursuit evaded! Wanted level cleared.');
      }
    } else {
      this.isEvading = false;
      this.wantedCooldown = 1;
    }
  }

  private damagePlayer(amount: number): void {
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, amount);
      this.armor -= absorbed;
      amount -= absorbed;
    }
    this.health -= amount;
    if (this.health <= 0) {
      // Respawn safely at St. Martha's / Cubbon Medical Center near MG Road
      this.health = 100;
      this.armor = 50;
      this.wantedStars = 0;
      this.isEvading = false;
      this.activeVehicle = null;
      this.playerRig.group.visible = true;
      this.playerX = -60;
      this.playerZ = -20;
      this.playerY = 0;
      this.cash = Math.max(0, this.cash - 500);
      this.showToast('Recovered at Bengaluru Medical Hub (-₹500 treatment fee).');
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

    if (Math.hypot(px - tx, pz - tz) < 10.5) {
      if (am.def.checkpoints && am.checkpointIndex < am.def.checkpoints.length - 1) {
        am.checkpointIndex++;
        this.audio.playPickup();
        this.showToast(`Checkpoint ${am.checkpointIndex}/${am.def.checkpoints.length} cleared!`);
      } else if (am.def.type === 'escape' && this.wantedStars > 0) {
        // Need to lose police stars or hold at safehouse
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
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const py = this.activeVehicle ? this.activeVehicle.y : this.playerY;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    const heading = this.activeVehicle ? this.activeVehicle.heading : this.playerHeading;

    const totalYaw = heading + this.camYawOffset;
    const dist = this.activeVehicle ? (this.activeVehicle.kind === 'bmtc' ? 14.5 : 9.8) : 5.6;
    const heightOffset = this.activeVehicle ? 3.2 : 2.1;

    _camDesired.set(
      px - Math.sin(totalYaw) * dist * Math.cos(this.camPitch),
      py + heightOffset + Math.sin(this.camPitch) * dist,
      pz - Math.cos(totalYaw) * dist * Math.cos(this.camPitch)
    );
    _v1.set(px, py + (this.activeVehicle ? 1.5 : 1.45), pz);

    this.currentCamPos.x = THREE.MathUtils.damp(this.currentCamPos.x, _camDesired.x, 8.5, dt);
    this.currentCamPos.y = THREE.MathUtils.damp(this.currentCamPos.y, _camDesired.y, 7.5, dt);
    this.currentCamPos.z = THREE.MathUtils.damp(this.currentCamPos.z, _camDesired.z, 8.5, dt);

    this.currentLookAt.x = THREE.MathUtils.damp(this.currentLookAt.x, _v1.x, 12, dt);
    this.currentLookAt.y = THREE.MathUtils.damp(this.currentLookAt.y, _v1.y, 12, dt);
    this.currentLookAt.z = THREE.MathUtils.damp(this.currentLookAt.z, _v1.z, 12, dt);

    this.camera.position.copy(this.currentCamPos);
    this.camera.lookAt(this.currentLookAt);

    // Dynamic FOV widening with vehicle speed
    const speedRatio = this.activeVehicle ? Math.min(1, Math.abs(this.activeVehicle.speed) / 55) : 0;
    const targetFov = 60 + speedRatio * 14;
    if (Math.abs(this.camera.fov - targetFov) > 0.05) {
      this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 5, dt);
      this.camera.updateProjectionMatrix();
    }
  }

  private emitHud(force: boolean): void {
    void force;
    const px = this.activeVehicle ? this.activeVehicle.x : this.playerX;
    const pz = this.activeVehicle ? this.activeVehicle.z : this.playerZ;
    const district = getDistrictAt(px, pz);

    // Nearest prompt
    let nearPrompt: string | null = null;
    let nearGarage = false;

    if (!this.activeVehicle) {
      for (const lm of LANDMARK_MARKERS) {
        if (Math.hypot(px - lm.x, pz - lm.z) < 7) {
          if (lm.type === 'garage') {
            nearPrompt = `Press G or click Garage to customize at ${lm.name}`;
            nearGarage = true;
          } else if (lm.type === 'safehouse') {
            nearPrompt = `Press F to rest at ${lm.name}`;
          } else if (lm.type === 'petrol') {
            nearPrompt = `Press F to repair & refuel`;
          }
          break;
        }
      }
      if (!nearPrompt && !this.activeMission) {
        for (const m of MISSIONS) {
          if (Math.hypot(px - m.startX, pz - m.startZ) < 9) {
            nearPrompt = `Press F to start ${m.title}`;
            break;
          }
        }
      }
      if (!nearPrompt) {
        for (const v of this.vehicles) {
          if (Math.hypot(v.x - px, v.z - pz) < 5.5) {
            nearPrompt = `Press F to enter ${VEHICLE_SPECS[v.kind].label}`;
            break;
          }
        }
      }
    } else {
      for (const lm of LANDMARK_MARKERS) {
        if (lm.type === 'garage' && Math.hypot(px - lm.x, pz - lm.z) < 9) {
          nearGarage = true;
          nearPrompt = `At ${lm.name} — Open Garage to tune vehicle`;
          break;
        }
      }
    }

    const speedKmh = this.activeVehicle ? Math.round(Math.abs(this.activeVehicle.speed) * 4.2) : 0;
    const gear = !this.activeVehicle ? 0 : this.activeVehicle.speed < -0.5 ? -1 : Math.min(6, Math.max(1, Math.ceil(speedRatioToGear(speedKmh))));

    let missionInfo: HudSnapshot['activeMission'] = null;
    if (this.activeMission) {
      const am = this.activeMission;
      const cp = am.def.checkpoints && am.checkpointIndex < am.def.checkpoints.length ? am.def.checkpoints[am.checkpointIndex] : null;
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

    const policeBlips = this.vehicles
      .filter((v) => v.isPolice && v.disabledTimer <= 0)
      .map((v) => ({ x: v.x, z: v.z }));

    this.onHudUpdate({
      health: Math.round(this.health),
      maxHealth: this.maxHealth,
      armor: Math.round(this.armor),
      maxArmor: this.maxArmor,
      cash: this.cash,
      wantedStars: this.wantedStars,
      wantedCooldown: this.wantedCooldown,
      isEvading: this.isEvading,
      districtName: district.name,
      districtKannada: district.kannadaName,
      discoveredDistricts: Array.from(this.discoveredDistricts),
      playerX: px,
      playerZ: pz,
      playerHeading: this.activeVehicle ? this.activeVehicle.heading : this.playerHeading,
      inVehicle: !!this.activeVehicle,
      vehicleKind: this.activeVehicle?.kind ?? null,
      vehicleLabel: this.activeVehicle ? VEHICLE_SPECS[this.activeVehicle.kind].label : '',
      vehicleHealth: this.activeVehicle ? Math.round((this.activeVehicle.health / this.activeVehicle.maxHealth) * 100) : 100,
      speedKmh,
      gear,
      headlightsOn: this.headlightsOn,
      isSwimming: this.isSwimming,
      isCrouching: this.isCrouching,
      weapon: this.weapon,
      nearPrompt,
      nearGarage,
      timeOfDayHours: this.timeOfDayHours,
      weather: this.settings.weather,
      activeMission: missionInfo,
      completedMissions: Array.from(this.completedMissions),
      collectedIds: Array.from(this.collectedIds),
      waypoint: this.waypoint,
      npcSubtitle: this.npcSubtitle,
      toastMessage: this.toastMessage,
      radioOn: this.settings.radioOn,
      radioTrack: RADIO_TRACKS[this.radioTrackIdx] || RADIO_TRACKS[0],
      policeBlips,
    });
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
