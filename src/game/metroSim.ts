import * as THREE from 'three';
import { createArchetypeHuman, HumanRig, updateHumanAnimation } from './humans';
import {
  METRO_DOOR_X,
  buildDetailedPlatformTrain,
  buildWalkableMetroCoach,
} from './metroTrain';
import { TextureBundle } from './textures';
import { BuildingCollider, LanguageId, MetroLineId, MetroTrainPhase } from './types';

export interface MetroInteriorTrigger {
  id:
    | 'ticket_counter'
    | 'tvm_kiosk'
    | 'smart_card_kiosk'
    | 'security_scan'
    | 'qr_gate'
    | 'exit_gate'
    | 'call_elevator_concourse'
    | 'call_elevator_platform'
    | 'use_elevator_cab'
    | 'board_train'
    | 'exit_station'
    | 'leave_train'
    | 'train_seat'
    | 'hold_rail'
    | 'talk_passenger';
  label: string;
  x: number;
  y: number;
  z: number;
  radius: number;
}

export interface MetroCameraBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
}

export interface MetroInteriorHandles {
  group: THREE.Group;
  colliders: BuildingCollider[];
  triggers: MetroInteriorTrigger[];
  concourseSpawn: THREE.Vector3;
  trainCabinSpawn: THREE.Vector3;
  elevatorCabCenter: { x: number; z: number };
  coachCount: number;
  passengerCount: number;
  interactNearestPassenger: (
    px: number,
    pz: number,
    lang: LanguageId
  ) => { speaker: string; text: string; passengerId: string } | null;
  getNearestPassengerPrompt: (px: number, pz: number) => string | null;
  getStationCameraBounds: (px: number, py: number, pz: number) => MetroCameraBounds;
  getFloorY: (x: number, z: number, elevatorY: number) => number;
  getEscalatorMove: (x: number, y: number, z: number) => { dir: 'up' | 'down'; speedZ: number } | null;
  isOnStairs: (x: number, z: number) => boolean;
  configureStation: (
    line: MetroLineId,
    stationName: string,
    stationKannada: string,
    elevated: boolean,
    isInterchange: boolean
  ) => void;
  update: (params: {
    dt: number;
    elapsed: number;
    gateUnlocked: boolean;
    trainWaitSec: number;
    trainPhase: MetroTrainPhase;
    trainDoorOpen: number;
    coachDoorOpen?: number;
    trainSpeedKmh?: number;
    elevatorY: number;
    elevatorDoorOpen: number;
    isRiding: boolean;
    isArrived?: boolean;
    line: MetroLineId;
    stationName: string;
    stationKannada: string;
    destinationName?: string;
    nextStopText: string;
    stopsRemaining: number;
    rideProgress?: number;
  }) => void;
}

function lineColorHex(line: MetroLineId): number {
  switch (line) {
    case 'purple':
      return 0x9333ea;
    case 'green':
      return 0x16a34a;
    case 'yellow':
      return 0xeab308;
    case 'pink':
      return 0xec4899;
    case 'blue':
      return 0x2563eb;
  }
}

export function buildMetroInterior(scene: THREE.Scene, textures?: TextureBundle): MetroInteriorHandles {
  const group = new THREE.Group();
  const colliders: BuildingCollider[] = [];

  const baseX = 0;
  const baseY = -140;
  const baseZ = -1200;
  const platY = baseY + 4.8;

  const graniteMat = new THREE.MeshStandardMaterial({ color: 0xdbe4ee, roughness: 0.36, metalness: 0.08 });
  const platTileMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.32, metalness: 0.12 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.65, metalness: 0.12 });
  const accentWallMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.55 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72 });
  const canopySkyMat = new THREE.MeshStandardMaterial({
    color: 0x7dd3fc,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.28,
    roughness: 0.35,
  });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.88 });
  const darkMetalMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.7 });
  const yellowTactileMat = new THREE.MeshStandardMaterial({
    color: 0xfacc15,
    emissive: 0xca8a04,
    emissiveIntensity: 0.15,
    roughness: 0.6,
  });
  const lineAccentMat = new THREE.MeshStandardMaterial({
    color: 0x9333ea,
    emissive: 0x7e22ce,
    emissiveIntensity: 0.25,
    roughness: 0.35,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.08,
    metalness: 0.1,
    transparent: true,
    opacity: 0.38,
  });

  // ==========================================================
  // 1. FULL-SCALE 5-CAR STATION SHELL
  // X: [-48 .. +48], Z: [baseZ - 55 .. baseZ + 15.5], Y: [baseY .. baseY + 13.5]
  // ==========================================================
  const concourseFloor = new THREE.Mesh(new THREE.BoxGeometry(96, 0.5, 40), graniteMat);
  concourseFloor.position.set(baseX, baseY - 0.25, baseZ - 4);
  concourseFloor.receiveShadow = true;
  group.add(concourseFloor);

  const backWall = new THREE.Mesh(new THREE.BoxGeometry(96, 13.5, 0.6), wallMat);
  backWall.position.set(baseX, baseY + 6.75, baseZ + 15.5);
  const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 13.5, 72), wallMat);
  leftWall.position.set(baseX - 48, baseY + 6.75, baseZ - 20);
  const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.6, 13.5, 72), wallMat);
  rightWall.position.set(baseX + 48, baseY + 6.75, baseZ - 20);
  const farTrackWall = new THREE.Mesh(new THREE.BoxGeometry(98, 13.5, 0.8), accentWallMat);
  farTrackWall.position.set(baseX, baseY + 6.75, baseZ - 55);
  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(97, 0.6, 72), roofMat);
  ceiling.position.set(baseX, baseY + 13.5, baseZ - 20);
  group.add(backWall, leftWall, rightWall, farTrackWall, ceiling);

  // Elevated skylight ribs vs underground vault light panels
  const skyCanopyPanels: THREE.Mesh[] = [];
  for (let i = 0; i < 4; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(84, 0.18, 8.5), canopySkyMat);
    panel.position.set(baseX, baseY + 13.12, baseZ - 3 - i * 13.5);
    group.add(panel);
    skyCanopyPanels.push(panel);
  }

  // Structural BMRCL Columns along concourse & 5-car platform
  for (const cx of [-38, -22, 22, 38]) {
    for (const cz of [baseZ + 8, baseZ - 3, baseZ - 26, baseZ - 38]) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.5, 13.2, 12), accentWallMat);
      col.position.set(cx, baseY + 6.6, cz);
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.49, 0.49, 0.9, 12), lineAccentMat);
      band.position.set(cx, (cz < baseZ - 16 ? platY : baseY) + 2.4, cz);
      group.add(col, band);
    }
  }

  // Outer room perimeter colliders (doors open cleanly along 10 METRO_DOOR_X portals)
  colliders.push(
    { minX: baseX - 48.5, maxX: baseX + 48.5, minZ: baseZ + 14.9, maxZ: baseZ + 16.2, height: baseY + 15 },
    { minX: baseX - 48.5, maxX: baseX - 47.3, minZ: baseZ - 55, maxZ: baseZ + 16.2, height: baseY + 15 },
    { minX: baseX + 47.3, maxX: baseX + 48.5, minZ: baseZ - 55, maxZ: baseZ + 16.2, height: baseY + 15 },
    { minX: baseX - 48.5, maxX: baseX + 48.5, minZ: baseZ - 46.6, maxZ: baseZ - 45.8, height: baseY + 15 }
  );

  // Bilingual Station Branding Board CanvasTexture
  const signCanvas = document.createElement('canvas');
  signCanvas.width = 768;
  signCanvas.height = 192;
  const signTex = new THREE.CanvasTexture(signCanvas);
  signTex.colorSpace = THREE.SRGBColorSpace;
  const signMat = new THREE.MeshStandardMaterial({
    map: signTex,
    emissive: 0xffffff,
    emissiveMap: signTex,
    emissiveIntensity: 0.45,
    roughness: 0.25,
  });

  // Exit Portal Arch on back wall (z = baseZ + 14.95)
  const exitPortal = new THREE.Mesh(
    new THREE.BoxGeometry(5.8, 3.8, 0.45),
    new THREE.MeshStandardMaterial({ color: 0x16a34a, emissive: 0x15803d, emissiveIntensity: 0.45 })
  );
  exitPortal.position.set(baseX, baseY + 1.9, baseZ + 14.95);
  const exitHeader = new THREE.Mesh(new THREE.BoxGeometry(7.2, 1.35, 0.3), signMat);
  exitHeader.position.set(baseX, baseY + 4.7, baseZ + 14.85);
  exitHeader.rotation.y = Math.PI;
  const mainHeader = new THREE.Mesh(new THREE.BoxGeometry(10.5, 1.85, 0.25), signMat);
  mainHeader.position.set(baseX, baseY + 6.4, baseZ - 6);
  group.add(exitPortal, exitHeader, mainHeader);

  // Security Bag X-Ray Scanner & Metal Detector Gate (z = baseZ + 2.8)
  const secFrameL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 2.5, 0.6), darkMetalMat);
  secFrameL.position.set(baseX - 1.5, baseY + 1.25, baseZ + 2.8);
  const secFrameR = secFrameL.clone();
  secFrameR.position.set(baseX + 1.5, baseY + 1.25, baseZ + 2.8);
  const secTop = new THREE.Mesh(new THREE.BoxGeometry(3.35, 0.35, 0.65), lineAccentMat);
  secTop.position.set(baseX, baseY + 2.55, baseZ + 2.8);
  const secStatusLight = new THREE.Mesh(
    new THREE.BoxGeometry(0.65, 0.16, 0.72),
    new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.85 })
  );
  secStatusLight.position.set(baseX, baseY + 2.8, baseZ + 2.8);
  const xrayBelt = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.9, 1.2), darkMetalMat);
  xrayBelt.position.set(baseX + 3.6, baseY + 0.45, baseZ + 2.8);
  const xrayTunnel = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 1.25), steelMat);
  xrayTunnel.position.set(baseX + 3.6, baseY + 1.35, baseZ + 2.8);
  // Queue glass dividers steering concourse passengers toward security arch
  const secBarrierL = new THREE.Mesh(new THREE.BoxGeometry(16, 1.3, 0.14), glassMat);
  secBarrierL.position.set(baseX - 9.8, baseY + 0.65, baseZ + 2.8);
  const secBarrierR = new THREE.Mesh(new THREE.BoxGeometry(16, 1.3, 0.14), glassMat);
  secBarrierR.position.set(baseX + 13.0, baseY + 0.65, baseZ + 2.8);
  group.add(secFrameL, secFrameR, secTop, secStatusLight, xrayBelt, xrayTunnel, secBarrierL, secBarrierR);

  // Staffed Ticket Counter (left) & Self-Service TVM + Smart Card Counter + Shop Stall (right)
  const counterDesk = new THREE.Mesh(new THREE.BoxGeometry(6.8, 1.18, 2.0), steelMat);
  counterDesk.position.set(baseX - 10.5, baseY + 0.59, baseZ + 5.5);
  const counterGlass = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.7, 0.14), glassMat);
  counterGlass.position.set(baseX - 10.5, baseY + 2.0, baseZ + 6.4);
  const counterSign = new THREE.Mesh(new THREE.BoxGeometry(6.6, 0.72, 0.2), lineAccentMat);
  counterSign.position.set(baseX - 10.5, baseY + 3.25, baseZ + 6.4);
  group.add(counterDesk, counterGlass, counterSign);

  // TVM Ticket Vending Machines (x: baseX + 14.5) & Namma Smart Card Kiosk (x: baseX + 18.2)
  for (let k = 0; k < 2; k++) {
    const kiosk = new THREE.Mesh(new THREE.BoxGeometry(1.1, 2.0, 0.85), lineAccentMat);
    kiosk.position.set(baseX + 13.8 + k * 1.4, baseY + 1.0, baseZ + 6.5);
    const screen = new THREE.Mesh(
      new THREE.PlaneGeometry(0.75, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.75 })
    );
    screen.position.set(baseX + 13.8 + k * 1.4, baseY + 1.35, baseZ + 6.94);
    group.add(kiosk, screen);
  }
  const smartCardDesk = new THREE.Mesh(
    new THREE.BoxGeometry(2.4, 1.9, 1.1),
    new THREE.MeshStandardMaterial({ color: 0x0f766e, roughness: 0.4 })
  );
  smartCardDesk.position.set(baseX + 18.2, baseY + 0.95, baseZ + 6.5);
  const smartCardScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 0.65),
    new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.6 })
  );
  smartCardScreen.position.set(baseX + 18.2, baseY + 1.4, baseZ + 7.06);
  group.add(smartCardDesk, smartCardScreen);

  const cafeBooth = new THREE.Mesh(
    new THREE.BoxGeometry(5.2, 2.8, 2.6),
    new THREE.MeshStandardMaterial({ color: 0xb45309, roughness: 0.55 })
  );
  cafeBooth.position.set(baseX + 28.5, baseY + 1.4, baseZ + 4.5);
  const cafeCounter = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.25, 3.1), steelMat);
  cafeCounter.position.set(baseX + 28.5, baseY + 1.15, baseZ + 4.5);
  group.add(cafeBooth, cafeCounter);

  // Concourse Seating Benches, Dustbins & CCTV Cameras
  [-24.5, 24.5].forEach((bx) => {
    const bench = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.52, 0.85), steelMat);
    bench.position.set(bx, baseY + 0.26, baseZ + 9.5);
    const bin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.28, 0.24, 0.85, 10),
      new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.4 })
    );
    bin.position.set(bx + (bx < 0 ? 2.4 : -2.4), baseY + 0.42, baseZ + 9.5);
    group.add(bench, bin);
  });

  [-28, 28].forEach((cx) => {
    const cam = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.42), darkMetalMat);
    cam.position.set(cx, baseY + 7.2, baseZ + 11.5);
    cam.rotation.x = 0.45;
    group.add(cam);
  });

  // ==========================================================
  // 2. ENTRY & EXIT AFC FARE GATES (z = baseZ - 5.2)
  // Entry lane x: [-5 .. +2.5], Dedicated Exit lane x: [+3.5 .. +7.5]
  // ==========================================================
  const gateBars: THREE.Mesh[] = [];
  for (let i = -3; i <= 4; i++) {
    const gx = baseX + i * 2.1;
    const isExitCol = i >= 2;
    const housing = new THREE.Mesh(new THREE.BoxGeometry(0.42, 1.15, 1.9), steelMat);
    housing.position.set(gx, baseY + 0.58, baseZ - 5.2);
    const readerLed = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.12, 0.24),
      new THREE.MeshStandardMaterial({
        color: isExitCol ? 0xf59e0b : 0x22c55e,
        emissive: isExitCol ? 0xf59e0b : 0x22c55e,
        emissiveIntensity: 0.9,
      })
    );
    readerLed.position.set(gx, baseY + 1.2, baseZ - 4.5);
    group.add(housing, readerLed);
    if (i < 4 && i !== 1) {
      const flap = new THREE.Mesh(
        new THREE.BoxGeometry(1.62, 0.82, 0.08),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.4 })
      );
      flap.position.set(gx + 1.05, baseY + 0.65, baseZ - 5.2);
      group.add(flap);
      gateBars.push(flap);
    }
  }
  // Side glass barriers keeping paid concourse separate across the 96m width
  const leftGateGlass = new THREE.Mesh(new THREE.BoxGeometry(40, 2.1, 0.18), glassMat);
  leftGateGlass.position.set(baseX - 27, baseY + 1.05, baseZ - 5.2);
  const rightGateGlass = new THREE.Mesh(new THREE.BoxGeometry(38, 2.1, 0.18), glassMat);
  rightGateGlass.position.set(baseX + 28, baseY + 1.05, baseZ - 5.2);
  group.add(leftGateGlass, rightGateGlass);
  colliders.push(
    { minX: baseX - 47.5, maxX: baseX - 6.8, minZ: baseZ - 5.5, maxZ: baseZ - 4.9, height: baseY + 3 },
    { minX: baseX + 8.8, maxX: baseX + 47.5, minZ: baseZ - 5.5, maxZ: baseZ - 4.9, height: baseY + 3 }
  );

  // ==========================================================
  // 3. THREE VERTICAL CONNECTORS: STAIRS, MOVING ESCALATORS & WORKING 3D ELEVATOR
  // Transition zone Z: baseZ - 10 (Concourse) -> baseZ - 24 (Platform, y = platY = baseY + 4.8)
  // ==========================================================
  // A. Walkable Granite Staircase (x: -12 .. -6)
  const stairSteps = 20;
  for (let s = 0; s < stairSteps; s++) {
    const u = (s + 0.5) / stairSteps;
    const stepY = baseY + u * 4.8;
    const stepZ = baseZ - 10 - u * 14;
    const step = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.28, 0.85), graniteMat);
    step.position.set(baseX - 9, stepY - 0.12, stepZ);
    group.add(step);
  }
  [-11.8, -6.2].forEach((hx) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.12, 15.2), steelMat);
    rail.position.set(hx, baseY + 3.3, baseZ - 17);
    rail.rotation.x = Math.atan2(4.8, 14);
    group.add(rail);
  });

  // B. Moving Escalators (Up Lane x: -3.0..-0.6, Down Lane x: +0.6..+3.0)
  const escStepsUp: THREE.Mesh[] = [];
  const escStepsDown: THREE.Mesh[] = [];
  [-3.2, -0.4, 0.4, 3.2].forEach((bx) => {
    const bal = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.05, 15.4), glassMat);
    bal.position.set(bx, baseY + 2.95, baseZ - 17);
    bal.rotation.x = Math.atan2(4.8, 14);
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 15.5), darkMetalMat);
    hand.position.set(bx, baseY + 3.52, baseZ - 17);
    hand.rotation.x = Math.atan2(4.8, 14);
    group.add(bal, hand);
  });
  for (let i = 0; i < 18; i++) {
    const stepUp = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.65), steelMat);
    group.add(stepUp);
    escStepsUp.push(stepUp);
    const stepDn = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.22, 0.65), steelMat);
    group.add(stepDn);
    escStepsDown.push(stepDn);
  }

  // C. Working 3D Glass & Steel Elevator (x: +11 .. +15, z: baseZ - 14 .. baseZ - 10)
  const elevX = baseX + 13;
  const elevZ = baseZ - 12;
  // Shaft corner columns & glass panels
  [-1.9, 1.9].forEach((ox) => {
    [-1.9, 1.9].forEach((oz) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 10.5, 0.22), darkMetalMat);
      post.position.set(elevX + ox, baseY + 5.25, elevZ + oz);
      group.add(post);
    });
  });
  // Concourse-level rear safety screen (below platform height) + Side Glass Shaft
  const shaftLowerBack = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.6, 0.12), glassMat);
  shaftLowerBack.position.set(elevX, baseY + 2.3, elevZ - 1.95);
  const shaftUpperFront = new THREE.Mesh(new THREE.BoxGeometry(3.8, 4.8, 0.12), glassMat);
  shaftUpperFront.position.set(elevX, platY + 2.4, elevZ + 1.95);
  const shaftGlassLeft = new THREE.Mesh(new THREE.BoxGeometry(0.12, 10.2, 3.8), glassMat);
  shaftGlassLeft.position.set(elevX - 1.95, baseY + 5.1, elevZ);
  const shaftGlassRight = new THREE.Mesh(new THREE.BoxGeometry(0.12, 10.2, 3.8), glassMat);
  shaftGlassRight.position.set(elevX + 1.95, baseY + 5.1, elevZ);
  group.add(shaftLowerBack, shaftUpperFront, shaftGlassLeft, shaftGlassRight);

  // Moving Elevator Cab Group (pass-through: +Z door at Concourse, -Z door at Platform)
  const elevatorCab = new THREE.Group();
  const cabFloor = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.22, 3.5), graniteMat);
  cabFloor.position.y = -0.11;
  const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.22, 3.5), steelMat);
  cabRoof.position.y = 3.05;
  const cabWallL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.0, 3.4), glassMat);
  cabWallL.position.set(-1.7, 1.5, 0);
  const cabWallR = cabWallL.clone();
  cabWallR.position.set(1.7, 1.5, 0);
  const cabDoorL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.75, 0.1), steelMat);
  cabDoorL.position.set(-0.78, 1.38, 1.72);
  const cabDoorR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.75, 0.1), steelMat);
  cabDoorR.position.set(0.78, 1.38, 1.72);
  const cabBackDoorL = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.75, 0.1), steelMat);
  cabBackDoorL.position.set(-0.78, 1.38, -1.72);
  const cabBackDoorR = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.75, 0.1), steelMat);
  cabBackDoorR.position.set(0.78, 1.38, -1.72);
  const cabLight = new THREE.PointLight(0xfef3c7, 1.6, 9);
  cabLight.position.set(0, 2.75, 0);
  const cabPanel = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.65, 0.1),
    new THREE.MeshStandardMaterial({ color: 0x0ea5e9, emissive: 0x38bdf8, emissiveIntensity: 0.7 })
  );
  cabPanel.position.set(1.42, 1.35, 1.45);
  elevatorCab.add(
    cabFloor,
    cabRoof,
    cabWallL,
    cabWallR,
    cabDoorL,
    cabDoorR,
    cabBackDoorL,
    cabBackDoorR,
    cabLight,
    cabPanel
  );
  elevatorCab.position.set(elevX, baseY, elevZ);
  group.add(elevatorCab);

  // ==========================================================
  // 4. FULL-LENGTH 5-CAR PLATFORM LEVEL (platY = baseY + 4.8, Z: baseZ - 24 .. baseZ - 45)
  // ==========================================================
  const platDeck = new THREE.Mesh(new THREE.BoxGeometry(96, 0.6, 22), platTileMat);
  platDeck.position.set(baseX, platY - 0.3, baseZ - 35);
  platDeck.receiveShadow = true;
  group.add(platDeck);

  // Platform corridor bridge connecting escalator/stairs/elevator to platform edge cleanly
  const platBridgeL = new THREE.Mesh(new THREE.BoxGeometry(36, 0.4, 8), platTileMat);
  platBridgeL.position.set(baseX - 30, platY - 0.2, baseZ - 21);
  const platBridgeR = new THREE.Mesh(new THREE.BoxGeometry(31, 0.4, 15), platTileMat);
  platBridgeR.position.set(baseX + 32, platY - 0.2, baseZ - 17);
  const platElevApron = new THREE.Mesh(new THREE.BoxGeometry(5.5, 0.4, 14), platTileMat);
  platElevApron.position.set(elevX, platY - 0.2, baseZ - 17);
  group.add(platBridgeL, platBridgeR, platElevApron);

  // Yellow Tactile Strip & Aligned Platform Screen Safety Doors (10 exact portals matching METRO_DOOR_X)
  const tactileStrip = new THREE.Mesh(new THREE.BoxGeometry(94, 0.05, 0.78), yellowTactileMat);
  tactileStrip.position.set(baseX, platY + 0.025, baseZ - 44.1);
  group.add(tactileStrip);

  const psdLeftDoors: THREE.Mesh[] = [];
  const psdRightDoors: THREE.Mesh[] = [];
  const doorPortalHalf = 1.15;
  const fixedRanges: Array<[number, number]> = [
    [-47.2, METRO_DOOR_X[0] - doorPortalHalf],
    [METRO_DOOR_X[0] + doorPortalHalf, METRO_DOOR_X[1] - doorPortalHalf],
    [METRO_DOOR_X[1] + doorPortalHalf, METRO_DOOR_X[2] - doorPortalHalf],
    [METRO_DOOR_X[2] + doorPortalHalf, METRO_DOOR_X[3] - doorPortalHalf],
    [METRO_DOOR_X[3] + doorPortalHalf, METRO_DOOR_X[4] - doorPortalHalf],
    [METRO_DOOR_X[4] + doorPortalHalf, METRO_DOOR_X[5] - doorPortalHalf],
    [METRO_DOOR_X[5] + doorPortalHalf, METRO_DOOR_X[6] - doorPortalHalf],
    [METRO_DOOR_X[6] + doorPortalHalf, METRO_DOOR_X[7] - doorPortalHalf],
    [METRO_DOOR_X[7] + doorPortalHalf, METRO_DOOR_X[8] - doorPortalHalf],
    [METRO_DOOR_X[8] + doorPortalHalf, METRO_DOOR_X[9] - doorPortalHalf],
    [METRO_DOOR_X[9] + doorPortalHalf, 47.2],
  ];
  fixedRanges.forEach(([x0, x1]) => {
    const w = x1 - x0;
    const cx = (x0 + x1) * 0.5;
    if (w < 0.4) return;
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 1.35, 0.14), glassMat);
    rail.position.set(cx, platY + 0.68, baseZ - 45.25);
    const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.06, 0.12, 0.18), steelMat);
    frame.position.set(cx, platY + 1.38, baseZ - 45.25);
    group.add(rail, frame);
    colliders.push({
      minX: x0,
      maxX: x1,
      minZ: baseZ - 45.65,
      maxZ: baseZ - 44.85,
      height: platY + 2.5,
    });
  });

  METRO_DOOR_X.forEach((dx) => {
    const psdL = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.32, 0.1), glassMat);
    psdL.position.set(dx - 0.55, platY + 0.67, baseZ - 45.18);
    psdL.userData.baseX = dx - 0.55;
    const psdR = new THREE.Mesh(new THREE.BoxGeometry(1.08, 1.32, 0.1), glassMat);
    psdR.position.set(dx + 0.55, platY + 0.67, baseZ - 45.18);
    psdR.userData.baseX = dx + 0.55;
    group.add(psdL, psdR);
    psdLeftDoors.push(psdL);
    psdRightDoors.push(psdR);
  });

  // Platform Waiting Benches & Route Signboards
  [-24, -10, 10, 24].forEach((bx) => {
    const pBench = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.55, 0.9), steelMat);
    pBench.position.set(bx, platY + 0.28, baseZ - 32);
    const pBoard = new THREE.Mesh(new THREE.BoxGeometry(4.6, 1.3, 0.2), signMat);
    pBoard.position.set(bx, platY + 4.0, baseZ - 34);
    group.add(pBench, pBoard);
  });

  // Dynamic Digital LED Train Arrival Board above platform
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 512;
  ledCanvas.height = 128;
  const ledTex = new THREE.CanvasTexture(ledCanvas);
  ledTex.colorSpace = THREE.SRGBColorSpace;
  const ledBoardMat = new THREE.MeshStandardMaterial({
    map: ledTex,
    emissive: 0xffffff,
    emissiveMap: ledTex,
    emissiveIntensity: 0.85,
  });
  const ledBoard = new THREE.Mesh(new THREE.BoxGeometry(8.8, 1.7, 0.3), ledBoardMat);
  ledBoard.position.set(baseX, platY + 4.4, baseZ - 36);
  group.add(ledBoard);

  // Track Bed & Dual Steel Rails below platform edge
  const trackBed = new THREE.Mesh(new THREE.BoxGeometry(104, 0.45, 9), roofMat);
  trackBed.position.set(baseX, platY - 1.35, baseZ - 49.5);
  group.add(trackBed);
  [-47.2, -50.2].forEach((rz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(104, 0.14, 0.12), steelMat);
    rail.position.set(baseX, platY - 1.05, baseZ + rz);
    group.add(rail);
  });

  // ==========================================================
  // 5. DETAILED 5-CAR ARTICULATED NAMMA METRO TRAIN ON PLATFORM TRACK
  // ==========================================================
  const platformTrainHandles = buildDetailedPlatformTrain(steelMat, darkMetalMat, glassMat);
  platformTrainHandles.group.position.set(baseX, platY - 1.05, baseZ - 48.2);
  group.add(platformTrainHandles.group);

  // Rich Station Interior Lighting
  const stationHemi = new THREE.HemisphereLight(0xf8fafc, 0x334155, 0.95);
  const concourseLightL = new THREE.PointLight(0xf8fafc, 2.8, 56);
  concourseLightL.position.set(baseX - 18, baseY + 10.5, baseZ + 2);
  const concourseLightR = new THREE.PointLight(0xf8fafc, 2.8, 56);
  concourseLightR.position.set(baseX + 18, baseY + 10.5, baseZ + 2);
  const midStairLight = new THREE.PointLight(0xfef9c3, 2.4, 48);
  midStairLight.position.set(baseX, baseY + 11.2, baseZ - 16);
  const platLightL = new THREE.PointLight(0xe0f2fe, 3.0, 64);
  platLightL.position.set(baseX - 24, platY + 6.8, baseZ - 35);
  const platLightR = new THREE.PointLight(0xe0f2fe, 3.0, 64);
  platLightR.position.set(baseX + 24, platY + 6.8, baseZ - 35);
  group.add(stationHemi, concourseLightL, concourseLightR, midStairLight, platLightL, platLightR);

  // ==========================================================
  // 6. WALKABLE 4-COACH RIDING TRAIN CABIN POCKET (300, -140, -1200)
  // ==========================================================
  const coach = buildWalkableMetroCoach(
    group,
    steelMat,
    darkMetalMat,
    graniteMat,
    wallMat,
    glassMat,
    ledBoardMat,
    textures
  );
  const trainX = coach.trainX;
  const trainY = coach.trainY;
  const trainZ = coach.trainZ;
  colliders.push(...coach.colliders);

  // ==========================================================
  // 7. STATION SECURITY, QUEUE & PLATFORM COMMUTER NPCS
  // ==========================================================
  const stationNpcs: Array<{ rig: HumanRig; mode: 'stand' | 'sit' | 'queue' | 'scan'; phase: number }> = [];
  if (textures) {
    const npcSpecs: Array<{
      arch: 'security_guard' | 'traffic_police' | 'it_pro' | 'student' | 'saree_woman' | 'kurta_citizen';
      x: number;
      y: number;
      z: number;
      rot: number;
      mode: 'stand' | 'sit' | 'queue' | 'scan';
    }> = [
      { arch: 'security_guard', x: baseX - 2.3, y: baseY, z: baseZ + 2.8, rot: 0.4, mode: 'scan' },
      { arch: 'kurta_citizen', x: baseX - 10.5, y: baseY, z: baseZ + 8.0, rot: Math.PI, mode: 'queue' },
      { arch: 'student', x: baseX + 14.5, y: baseY, z: baseZ + 8.2, rot: Math.PI, mode: 'queue' },
      { arch: 'it_pro', x: baseX - 22, y: platY, z: baseZ - 39, rot: 0.2, mode: 'stand' },
      { arch: 'saree_woman', x: baseX + 10.5, y: platY, z: baseZ - 32, rot: Math.PI, mode: 'sit' },
      { arch: 'student', x: baseX + 26.5, y: platY, z: baseZ - 39, rot: 0, mode: 'stand' },
      { arch: 'kurta_citizen', x: baseX - 3.6, y: platY, z: baseZ - 42.2, rot: Math.PI, mode: 'stand' },
    ];
    npcSpecs.forEach((ns, idx) => {
      const rig = createArchetypeHuman(ns.arch, 700 + idx, textures);
      rig.group.position.set(ns.x, ns.y, ns.z);
      rig.group.rotation.y = ns.rot;
      group.add(rig.group);
      stationNpcs.push({ rig, mode: ns.mode, phase: idx * 1.4 });
    });
  }

  scene.add(group);

  // Interactive triggers across station + Ticketing / TVM / Smart Card / Security / Entry+Exit Gates + ALL 10 Boarding Doors + 4 Coach Interiors
  const triggers: MetroInteriorTrigger[] = [
    { id: 'ticket_counter', label: 'Staffed Ticket Counter [F]', x: baseX - 10.5, y: baseY, z: baseZ + 7.6, radius: 3.4 },
    { id: 'tvm_kiosk', label: 'Ticket Vending Machine (TVM) [F]', x: baseX + 14.5, y: baseY, z: baseZ + 8.1, radius: 3.2 },
    { id: 'smart_card_kiosk', label: 'Namma Metro Smart Card Counter [F]', x: baseX + 18.2, y: baseY, z: baseZ + 8.1, radius: 3.0 },
    { id: 'security_scan', label: 'Security Bag & Metal Check [F]', x: baseX, y: baseY, z: baseZ + 2.8, radius: 3.8 },
    { id: 'qr_gate', label: 'Entry QR / Smart Card Gate [F]', x: baseX - 1.5, y: baseY, z: baseZ - 4.0, radius: 3.8 },
    { id: 'exit_gate', label: 'Exit Gate Validation [F]', x: baseX + 5.5, y: baseY, z: baseZ - 4.0, radius: 3.2 },
    { id: 'call_elevator_concourse', label: 'Call / Board Elevator (Concourse) [F]', x: elevX, y: baseY, z: elevZ + 3.0, radius: 2.8 },
    { id: 'call_elevator_platform', label: 'Call / Board Elevator (Platform) [F]', x: elevX, y: platY, z: elevZ - 3.1, radius: 2.8 },
    { id: 'use_elevator_cab', label: 'Ride Elevator Up / Down [F]', x: elevX, y: baseY, z: elevZ, radius: 2.1 },
    ...METRO_DOOR_X.map(
      (dx): MetroInteriorTrigger => ({
        id: 'board_train',
        label: 'Board Namma Metro Train [F]',
        x: dx,
        y: platY,
        z: baseZ - 43.2,
        radius: 4.6,
      })
    ),
    { id: 'exit_station', label: 'Exit to Bengaluru Street [F]', x: baseX, y: baseY, z: baseZ + 13.8, radius: 3.4 },
    ...coach.triggers,
  ];

  const getStationCameraBounds = (px: number, _py: number, _pz: number): MetroCameraBounds => {
    if (px > 200) {
      return {
        minX: trainX - 1.88,
        maxX: trainX + 1.88,
        minY: trainY + 0.55,
        maxY: trainY + 2.95,
        minZ: trainZ - 25.8,
        maxZ: trainZ + 43.8,
      };
    }
    return {
      minX: baseX - 46.8,
      maxX: baseX + 46.8,
      minY: baseY + 0.55,
      maxY: baseY + 12.6,
      minZ: baseZ - 45.2,
      maxZ: baseZ + 14.6,
    };
  };

  const isOnStairs = (x: number, z: number): boolean => {
    return x >= baseX - 12 && x <= baseX - 6 && z <= baseZ - 10 && z >= baseZ - 24;
  };

  const getEscalatorMove = (x: number, _y: number, z: number): { dir: 'up' | 'down'; speedZ: number } | null => {
    if (z <= baseZ - 10 && z >= baseZ - 24) {
      if (x >= baseX - 3.2 && x <= baseX - 0.4) return { dir: 'up', speedZ: -2.4 };
      if (x >= baseX + 0.4 && x <= baseX + 3.2) return { dir: 'down', speedZ: 2.4 };
    }
    return null;
  };

  const getFloorY = (x: number, z: number, elevatorY: number): number => {
    if (x > 200) return trainY;
    // Elevator cab footprint
    if (Math.abs(x - elevX) < 1.85 && Math.abs(z - elevZ) < 1.85) {
      return elevatorY;
    }
    // Walkable Staircase & Escalators slope (baseZ - 10 .. baseZ - 24)
    if (z <= baseZ - 10 && z >= baseZ - 24) {
      if (
        (x >= baseX - 12 && x <= baseX - 6) ||
        (x >= baseX - 3.2 && x <= baseX + 3.2)
      ) {
        const u = THREE.MathUtils.clamp((baseZ - 10 - z) / 14, 0, 1);
        return baseY + u * (platY - baseY);
      }
      // Side floor aprons at platform height
      if (x > baseX + 6 || x < baseX - 14) {
        return platY;
      }
    }
    if (z < baseZ - 24) return platY;
    return baseY;
  };

  let lastConfigKey = '';
  const configureStation = (
    line: MetroLineId,
    stationName: string,
    stationKannada: string,
    elevated: boolean,
    isInterchange: boolean
  ) => {
    const key = `${line}|${stationName}|${elevated}|${isInterchange}`;
    if (key === lastConfigKey) return;
    lastConfigKey = key;

    const hex = lineColorHex(line);
    lineAccentMat.color.setHex(hex);
    lineAccentMat.emissive.setHex(hex);
    platformTrainHandles.stripeMat.color.setHex(hex);

    // Distinct architectural tone between elevated sunlit viaduct stations vs underground stations
    if (elevated) {
      canopySkyMat.color.setHex(0xbae6fd);
      canopySkyMat.emissive.setHex(0x38bdf8);
      canopySkyMat.emissiveIntensity = 0.42;
      wallMat.color.setHex(0x334155);
    } else {
      canopySkyMat.color.setHex(0xfef3c7);
      canopySkyMat.emissive.setHex(0xfde68a);
      canopySkyMat.emissiveIntensity = 0.25;
      wallMat.color.setHex(0x1e293b);
    }

    const ctx = signCanvas.getContext('2d')!;
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 768, 192);
    ctx.fillStyle = `#${hex.toString(16).padStart(6, '0')}`;
    ctx.fillRect(0, 0, 768, 22);
    ctx.fillRect(0, 170, 768, 22);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 42px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${stationKannada}  ·  ${stationName}`, 384, 88);
    ctx.fillStyle = '#fde68a';
    ctx.font = '26px sans-serif';
    ctx.fillText(
      `ನಮ್ಮ ಮೆಟ್ರೋ  |  ${line.toUpperCase()} LINE${isInterchange ? ' · INTERCHANGE HUB' : ''} (${
        elevated ? 'ELEVATED' : 'UNDERGROUND'
      })`,
      384,
      142
    );
    signTex.needsUpdate = true;
  };

  let escScroll = 0;
  let lastLedText = '';

  const update: MetroInteriorHandles['update'] = ({
    dt,
    elapsed,
    gateUnlocked,
    trainWaitSec,
    trainPhase,
    trainDoorOpen,
    coachDoorOpen = 0,
    trainSpeedKmh = 0,
    elevatorY,
    elevatorDoorOpen,
    isRiding,
    isArrived = false,
    line,
    stationName,
    stationKannada,
    destinationName = 'MG Road Metro',
    nextStopText,
    stopsRemaining,
    rideProgress = 0,
  }) => {
    const col = lineColorHex(line);
    platformTrainHandles.stripeMat.color.setHex(col);

    // QR Gate Flaps
    gateBars.forEach((bar) => {
      const targetScale = gateUnlocked ? 0.08 : 1.0;
      bar.scale.x += (targetScale - bar.scale.x) * Math.min(1, dt * 8);
      const mat = bar.material as THREE.MeshStandardMaterial;
      mat.color.setHex(gateUnlocked ? 0x22c55e : 0xef4444);
      mat.emissive.setHex(gateUnlocked ? 0x22c55e : 0xef4444);
    });

    // Moving Escalator Treads
    escScroll = (escScroll + dt * 0.18) % 1;
    for (let i = 0; i < escStepsUp.length; i++) {
      const uUp = (i / escStepsUp.length + escScroll) % 1;
      escStepsUp[i].position.set(
        baseX - 1.8,
        baseY + uUp * (platY - baseY),
        baseZ - 10 - uUp * 14
      );
      const uDn = ((i / escStepsDown.length) - escScroll + 1) % 1;
      escStepsDown[i].position.set(
        baseX + 1.8,
        baseY + uDn * (platY - baseY),
        baseZ - 10 - uDn * 14
      );
    }

    // 3D Elevator Position & Dual Front/Rear Doors
    elevatorCab.position.y = elevatorY;
    const atConcourse = elevatorY < baseY + 1.5;
    const atPlatform = elevatorY > platY - 1.5;
    const frontOpen = atConcourse ? elevatorDoorOpen : 0;
    const backOpen = atPlatform ? elevatorDoorOpen : 0;
    cabDoorL.position.x = -0.78 - frontOpen * 0.85;
    cabDoorR.position.x = 0.78 + frontOpen * 0.85;
    cabBackDoorL.position.x = -0.78 - backOpen * 0.85;
    cabBackDoorR.position.x = 0.78 + backOpen * 0.85;

    // Platform Multi-Car Train Position + Aligned Sliding Doors + Platform Screen Doors
    let trainPosX = baseX;
    if (trainPhase === 'approaching') {
      trainPosX = baseX - Math.max(0, trainWaitSec) * 9.5;
    } else if (trainPhase === 'departing') {
      trainPosX = baseX + (1 - trainDoorOpen) * 28;
    }
    platformTrainHandles.group.position.x = trainPosX;
    const trainMovingDelta = trainPhase === 'approaching' || trainPhase === 'departing' ? dt * 6 : 0;
    platformTrainHandles.bogieWheels.forEach((w) => (w.rotation.z -= trainMovingDelta));

    platformTrainHandles.slidingLeftDoors.forEach((d) => {
      d.position.x = (d.userData.baseX as number) - trainDoorOpen * 0.76;
    });
    platformTrainHandles.slidingRightDoors.forEach((d) => {
      d.position.x = (d.userData.baseX as number) + trainDoorOpen * 0.76;
    });

    const psdSlide = trainPhase === 'boarding' || trainPhase === 'doors_closing' ? trainDoorOpen * 0.92 : 0;
    psdLeftDoors.forEach((d) => {
      d.position.x = (d.userData.baseX as number) - psdSlide;
    });
    psdRightDoors.forEach((d) => {
      d.position.x = (d.userData.baseX as number) + psdSlide;
    });

    const ledHex =
      trainPhase === 'boarding' ? 0x22c55e : trainPhase === 'doors_closing' ? 0xf59e0b : 0xef4444;
    platformTrainHandles.doorStatusMats.forEach((m) => {
      m.color.setHex(ledHex);
      m.emissive.setHex(ledHex);
    });
    platformTrainHandles.updateLedHeader(line, destinationName || stationName, trainPhase);

    // Digital LED Platform & In-Train Announcement Board
    const ledText = isRiding
      ? `NEXT: ${nextStopText} (${stopsRemaining} stops) · BENGALURU METRO`
      : trainPhase === 'boarding'
      ? `DOORS OPEN · ${line.toUpperCase()} LINE TRAIN AT PLATFORM`
      : trainPhase === 'doors_closing'
      ? `DOORS CLOSING · STAND CLEAR OF YELLOW LINE`
      : `${stationName.toUpperCase()} · NEXT TRAIN ${Math.ceil(trainWaitSec)}s`;

    if (ledText !== lastLedText) {
      lastLedText = ledText;
      const lCtx = ledCanvas.getContext('2d')!;
      lCtx.fillStyle = '#020617';
      lCtx.fillRect(0, 0, 512, 128);
      lCtx.strokeStyle = '#334155';
      lCtx.lineWidth = 4;
      lCtx.strokeRect(2, 2, 508, 124);
      lCtx.fillStyle = '#22c55e';
      lCtx.font = 'bold 21px monospace';
      lCtx.textAlign = 'center';
      lCtx.fillText(ledText.slice(0, 42), 256, 54);
      lCtx.fillStyle = '#fde68a';
      lCtx.font = '18px sans-serif';
      lCtx.fillText(`${stationKannada} · ನಮ್ಮ ಮೆಟ್ರೋ`, 256, 96);
      ledTex.needsUpdate = true;
    }

    // Update Walkable Coach Interior (speed-synced viaducts, 10 animated passengers, route strip)
    coach.update({
      dt,
      elapsed,
      isRiding,
      isArrived,
      trainSpeedKmh,
      coachDoorOpen,
      line,
      destinationName,
      nextStopText,
      stopsRemaining,
      rideProgress,
    });

    // Animate station staff, security guard, queues & platform commuters
    stationNpcs.forEach((s) => {
      const pose = s.mode === 'sit' ? 'sit' : s.mode === 'scan' ? 'bag_scan' : s.mode === 'queue' ? 'queue_wait' : 'idle';
      updateHumanAnimation(s.rig, {
        pose,
        speedNorm: 0,
        stridePhase: 0,
        elapsed: elapsed + s.phase,
        dt,
        expression: 'neutral',
        lookYaw: Math.sin(elapsed * 0.6 + s.phase) * 0.25,
        lookPitch: 0,
        holdingUmbrella: false,
        simulateCloth: false,
      });
    });
  };

  return {
    group,
    colliders,
    triggers,
    concourseSpawn: new THREE.Vector3(baseX, baseY, baseZ + 8.5),
    trainCabinSpawn: new THREE.Vector3(trainX, trainY, trainZ),
    elevatorCabCenter: { x: elevX, z: elevZ },
    coachCount: coach.coachCount,
    passengerCount: coach.passengerCount,
    interactNearestPassenger: coach.interactNearestPassenger,
    getNearestPassengerPrompt: coach.getNearestPassengerPrompt,
    getStationCameraBounds,
    getFloorY,
    getEscalatorMove,
    isOnStairs,
    configureStation,
    update,
  };
}
