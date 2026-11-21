import * as THREE from 'three';
import { VehicleKind } from './types';

export interface VehicleRig {
  group: THREE.Group;
  chassisGroup: THREE.Group;
  bodyMesh: THREE.Mesh;
  wheels: THREE.Mesh[];
  frontSteerPivots: THREE.Group[];
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
  leftIndicators: THREE.Mesh[];
  rightIndicators: THREE.Mesh[];
  steeringWheel?: THREE.Group;
  driverDoorPivot?: THREE.Group;
  wipers: THREE.Mesh[];
  cockpitOffset: THREE.Vector3;
  driverSeatOffset: THREE.Vector3;
  passengerSeatOffset: THREE.Vector3;
  passengerCockpitOffset: THREE.Vector3;
  policeLights?: { red: THREE.Mesh; blue: THREE.Mesh };
  riderGroup?: THREE.Group;
  contactShadow: THREE.Mesh;
}

const rubberMat = new THREE.MeshStandardMaterial({
  color: 0x181a1f,
  roughness: 0.88,
  metalness: 0.05,
});

const rimMat = new THREE.MeshStandardMaterial({
  color: 0xcbd5e1,
  roughness: 0.25,
  metalness: 0.88,
});

const darkTrimMat = new THREE.MeshStandardMaterial({
  color: 0x1e293b,
  roughness: 0.62,
  metalness: 0.25,
});

const glassMat = new THREE.MeshPhysicalMaterial({
  color: 0x1e293b,
  roughness: 0.06,
  metalness: 0.1,
  clearcoat: 1.0,
  transparent: true,
  opacity: 0.52,
});

const plateCache = new Map<string, THREE.CanvasTexture>();
function getIndianPlateTexture(plateText: string, isCommercial: boolean): THREE.CanvasTexture {
  const key = `${plateText}_${isCommercial}`;
  const cached = plateCache.get(key);
  if (cached) return cached;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = isCommercial ? '#facc15' : '#f8fafc';
  ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = '#1d4ed8';
  ctx.fillRect(4, 4, 24, 56);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('IND', 6, 42);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 26px monospace';
  ctx.textAlign = 'center';
  ctx.fillText(plateText, 142, 42);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  plateCache.set(key, tex);
  return tex;
}

function createWheel(radius: number, width: number): THREE.Mesh {
  const wheelGeo = new THREE.CylinderGeometry(radius, radius, width, 20);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheel = new THREE.Mesh(wheelGeo, rubberMat);
  wheel.castShadow = true;

  const hubGeo = new THREE.CylinderGeometry(radius * 0.58, radius * 0.58, width + 0.025, 14);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  const lugCapGeo = new THREE.CylinderGeometry(radius * 0.2, radius * 0.2, width + 0.04, 10);
  lugCapGeo.rotateZ(Math.PI / 2);
  const lugCap = new THREE.Mesh(lugCapGeo, darkTrimMat);
  wheel.add(hub, lugCap);
  return wheel;
}

function createShadowPlane(w: number, l: number, shadowTex: THREE.Texture): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, l);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.03;
  return m;
}

function createInteriorAssembly(width: number, dashY: number, dashZ: number, seatZ: number): {
  interior: THREE.Group;
  steeringWheel: THREE.Group;
} {
  const interior = new THREE.Group();
  const dashMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.72 });
  const seatMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 });

  // Dashboard + illuminated digital speedometer cluster
  const dash = new THREE.Mesh(new THREE.BoxGeometry(width - 0.34, 0.24, 0.34), dashMat);
  dash.position.set(0, dashY, dashZ);
  interior.add(dash);

  const gauge = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.12, 0.04),
    new THREE.MeshStandardMaterial({ color: 0x020617, emissive: 0x38bdf8, emissiveIntensity: 0.85 })
  );
  gauge.position.set(width * 0.2, dashY + 0.08, dashZ - 0.16);
  interior.add(gauge);

  // Right-hand drive steering wheel (authentic Indian RHD layout!)
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(-width * 0.22, dashY + 0.06, dashZ - 0.24);
  steeringWheel.rotation.x = 0.38;
  const swRing = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.022, 8, 20), darkTrimMat);
  const swSpoke = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.03, 0.02), darkTrimMat);
  steeringWheel.add(swRing, swSpoke);
  interior.add(steeringWheel);

  // Seats & Gear Lever
  [-width * 0.22, width * 0.22].forEach((sx) => {
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.12), seatMat);
    seatBack.position.set(sx, dashY + 0.12, seatZ - 0.18);
    seatBack.rotation.x = -0.15;
    const seatBase = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.12, 0.44), seatMat);
    seatBase.position.set(sx, dashY - 0.16, seatZ);
    interior.add(seatBack, seatBase);
  });

  const gearStick = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.22, 6), rimMat);
  gearStick.position.set(0, dashY - 0.05, dashZ - 0.28);
  gearStick.rotation.x = -0.2;
  interior.add(gearStick);

  return { interior, steeringWheel };
}

export function createVehicleRig(
  kind: VehicleKind,
  colorHex: string,
  shadowTex: THREE.Texture
): VehicleRig {
  const group = new THREE.Group();
  const chassisGroup = new THREE.Group();
  group.add(chassisGroup);

  const wheels: THREE.Mesh[] = [];
  const frontSteerPivots: THREE.Group[] = [];
  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];
  const leftIndicators: THREE.Mesh[] = [];
  const rightIndicators: THREE.Mesh[] = [];
  const wipers: THREE.Mesh[] = [];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.2,
    metalness: 0.68,
    clearcoat: 0.96,
    clearcoatRoughness: 0.1,
  });

  const headLightMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 0.35,
      roughness: 0.1,
    });

  const tailLightMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    });

  const indMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.05,
      roughness: 0.2,
    });

  let bodyMesh: THREE.Mesh;
  let steeringWheel: THREE.Group | undefined;
  let driverDoorPivot: THREE.Group | undefined;
  let cockpitOffset = new THREE.Vector3(-0.35, 1.3, 0.05);
  let driverSeatOffset = new THREE.Vector3(-0.35, 0.42, 0.1);
  let passengerSeatOffset = new THREE.Vector3(0.32, 0.42, -0.58);
  let passengerCockpitOffset = new THREE.Vector3(0.32, 1.32, -0.55);
  let policeLights: { red: THREE.Mesh; blue: THREE.Mesh } | undefined;
  let riderGroup: THREE.Group | undefined;
  let shadowW = 2.6;
  let shadowL = 4.6;

  const isCommercial =
    kind === 'auto' || kind === 'bmtc' || kind === 'cab' || kind === 'truck' || kind === 'delivery';
  const plateCode =
    kind === 'auto'
      ? 'KA 01 AE 4821'
      : kind === 'bmtc'
      ? 'KA 57 F 335E'
      : kind === 'cab'
      ? 'KA 05 MJ 8192'
      : kind === 'truck'
      ? 'KA 01 TR 7710'
      : kind === 'delivery'
      ? 'KA 02 EX 6412'
      : kind === 'ambulance'
      ? 'KA 01 G 1080'
      : kind === 'scooter'
      ? 'KA 03 EQ 2204'
      : kind === 'police_suv' || kind === 'police_bike'
      ? 'KA 01 G 0100'
      : 'KA 03 N 9024';
  const plateMat = new THREE.MeshStandardMaterial({
    map: getIndianPlateTexture(plateCode, isCommercial),
    roughness: 0.4,
  });

  if (kind === 'auto') {
    shadowW = 2.0;
    shadowL = 3.2;
    cockpitOffset.set(0, 1.38, 0.2);
    driverSeatOffset.set(0, 0.42, 0.48);
    passengerSeatOffset.set(0.24, 0.44, -0.42);
    passengerCockpitOffset.set(0.24, 1.35, -0.38);

    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.72, 2.55),
      new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.42, metalness: 0.3 })
    );
    lowerBody.position.set(0, 0.68, 0);
    lowerBody.castShadow = true;
    chassisGroup.add(lowerBody);

    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.85, 2.2), paintMat);
    bodyMesh.position.set(0, 1.45, -0.14);
    bodyMesh.castShadow = true;
    chassisGroup.add(bodyMesh);

    const frontShield = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.56, 0.08), glassMat);
    frontShield.position.set(0, 1.38, 1.0);
    frontShield.rotation.x = -0.22;
    chassisGroup.add(frontShield);

    // Handlebar steering
    steeringWheel = new THREE.Group();
    steeringWheel.position.set(0, 1.08, 0.75);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.68, 0.04, 0.05), darkTrimMat);
    steeringWheel.add(bar);
    chassisGroup.add(steeringWheel);

    // Auto wiper
    const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.38, 0.03), darkTrimMat);
    wiper.position.set(0, 1.18, 1.05);
    chassisGroup.add(wiper);
    wipers.push(wiper);

    const spare = createWheel(0.24, 0.14);
    spare.rotation.y = Math.PI / 2;
    spare.position.set(0, 0.72, -1.33);
    chassisGroup.add(spare);

    const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.14, 0.03), plateMat);
    plateR.position.set(0, 0.42, -1.3);
    chassisGroup.add(plateR);

    const frontPivot = new THREE.Group();
    frontPivot.position.set(0, 0.3, 1.12);
    const fw = createWheel(0.3, 0.18);
    frontPivot.add(fw);
    group.add(frontPivot);
    frontSteerPivots.push(frontPivot);
    wheels.push(fw);

    const rwl = createWheel(0.3, 0.18);
    rwl.position.set(-0.74, 0.3, -0.82);
    const rwr = createWheel(0.3, 0.18);
    rwr.position.set(0.74, 0.3, -0.82);
    group.add(rwl, rwr);
    wheels.push(rwl, rwr);

    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), headLightMat());
    hl.rotation.x = Math.PI / 2;
    hl.position.set(0, 0.85, 1.3);
    chassisGroup.add(hl);
    headlights.push(hl);

    [-0.54, 0.54].forEach((x, idx) => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), tailLightMat());
      tl.position.set(x, 0.68, -1.3);
      chassisGroup.add(tl);
      taillights.push(tl);

      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.08), indMat());
      ind.position.set(x * 1.15, 0.82, -1.3);
      chassisGroup.add(ind);
      if (idx === 0) leftIndicators.push(ind);
      else rightIndicators.push(ind);
    });
  } else if (kind === 'bmtc') {
    shadowW = 3.2;
    shadowL = 9.4;
    cockpitOffset.set(-0.68, 2.05, 3.6);

    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.25, 8.6), paintMat);
    bodyMesh.position.set(0, 1.65, 0);
    bodyMesh.castShadow = true;
    chassisGroup.add(bodyMesh);

    const silverBand = new THREE.Mesh(
      new THREE.BoxGeometry(2.59, 0.46, 8.62),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.6 })
    );
    silverBand.position.set(0, 0.92, 0);
    chassisGroup.add(silverBand);

    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.95, 7.8), glassMat);
    sideGlass.position.set(0, 1.95, 0);
    chassisGroup.add(sideGlass);

    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.15, 0.08), glassMat);
    frontGlass.position.set(0, 1.92, 4.31);
    chassisGroup.add(frontGlass);

    const destBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.25, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0xf59e0b, emissiveIntensity: 0.85 })
    );
    destBoard.position.set(0, 2.62, 4.31);
    chassisGroup.add(destBoard);

    const acPod = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.32, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.2 })
    );
    acPod.position.set(0, 2.93, -0.4);
    chassisGroup.add(acPod);

    const plateF = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.04), plateMat);
    plateF.position.set(0, 0.62, 4.33);
    const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.2, 0.04), plateMat);
    plateR.position.set(0, 0.62, -4.33);
    chassisGroup.add(plateF, plateR);

    [-0.55, 0.55].forEach((wx) => {
      const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.72, 0.03), darkTrimMat);
      wiper.position.set(wx, 1.48, 4.36);
      chassisGroup.add(wiper);
      wipers.push(wiper);
    });

    [
      [-1.26, 2.65, true],
      [1.26, 2.65, true],
      [-1.26, -2.55, false],
      [1.26, -2.55, false],
    ].forEach(([x, z, isFront]) => {
      const w = createWheel(0.5, 0.3);
      if (isFront) {
        const pv = new THREE.Group();
        pv.position.set(x as number, 0.5, z as number);
        pv.add(w);
        group.add(pv);
        frontSteerPivots.push(pv);
      } else {
        w.position.set(x as number, 0.5, z as number);
        group.add(w);
      }
      wheels.push(w);
    });

    [-0.95, 0.95].forEach((x, idx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headLightMat());
      hl.position.set(x, 0.82, 4.32);
      chassisGroup.add(hl);
      headlights.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.08), tailLightMat());
      tl.position.set(x, 0.95, -4.32);
      chassisGroup.add(tl);
      taillights.push(tl);

      const ind = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.14, 0.08), indMat());
      ind.position.set(x * 1.15, 0.82, 4.32);
      chassisGroup.add(ind);
      if (idx === 0) leftIndicators.push(ind);
      else rightIndicators.push(ind);
    });
  } else if (kind === 'bike' || kind === 'police_bike') {
    shadowW = 1.1;
    shadowL = 2.4;
    cockpitOffset.set(0, 1.48, 0.15);

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 1.55), darkTrimMat);
    frame.position.set(0, 0.65, 0);
    frame.castShadow = true;
    chassisGroup.add(frame);

    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.72), paintMat);
    bodyMesh.position.set(0, 0.92, 0.22);
    bodyMesh.castShadow = true;
    chassisGroup.add(bodyMesh);

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.14, 0.68),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 })
    );
    seat.position.set(0, 0.88, -0.36);
    chassisGroup.add(seat);

    [-0.22, 0.22].forEach((x) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 8), rimMat);
      pipe.rotation.x = Math.PI / 2 - 0.12;
      pipe.position.set(x, 0.46, -0.58);
      chassisGroup.add(pipe);
    });

    const frontPivot = new THREE.Group();
    frontPivot.position.set(0, 0.36, 0.78);
    const fw = createWheel(0.36, 0.14);
    frontPivot.add(fw);

    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.78, 8), rimMat);
    fork.position.set(0, 0.36, -0.08);
    fork.rotation.x = -0.3;
    frontPivot.add(fork);

    steeringWheel = new THREE.Group();
    steeringWheel.position.set(0, 0.72, -0.18);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.06), darkTrimMat);
    steeringWheel.add(bar);
    frontPivot.add(steeringWheel);

    const hl = new THREE.Mesh(new THREE.SphereGeometry(0.11, 10, 10), headLightMat());
    hl.position.set(0, 0.56, 0.08);
    frontPivot.add(hl);
    headlights.push(hl);

    group.add(frontPivot);
    frontSteerPivots.push(frontPivot);
    wheels.push(fw);

    const rw = createWheel(0.36, 0.18);
    rw.position.set(0, 0.36, -0.78);
    group.add(rw);
    wheels.push(rw);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.08), tailLightMat());
    tl.position.set(0, 0.86, -0.82);
    chassisGroup.add(tl);
    taillights.push(tl);

    if (kind === 'police_bike') {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.75, 6), rimMat);
      pole.position.set(-0.18, 1.2, -0.72);
      const beaconRed = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.5 })
      );
      beaconRed.position.set(-0.18, 1.58, -0.72);
      const beaconBlue = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.12, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.1 })
      );
      beaconBlue.position.set(0.18, 1.12, -0.72);
      chassisGroup.add(pole, beaconRed, beaconBlue);
      policeLights = { red: beaconRed, blue: beaconBlue };
    }

    riderGroup = new THREE.Group();
    const riderBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.42, 0.55, 0.24),
      new THREE.MeshStandardMaterial({ color: kind === 'police_bike' ? 0x1e3a8a : 0x1e293b, roughness: 0.6 })
    );
    riderBody.position.set(0, 1.24, -0.2);
    riderBody.rotation.x = 0.28;
    const helmet = new THREE.Mesh(
      new THREE.SphereGeometry(0.17, 12, 10),
      new THREE.MeshPhysicalMaterial({ color: kind === 'police_bike' ? 0xf8fafc : 0x0f172a, clearcoat: 1 })
    );
    helmet.position.set(0, 1.62, -0.05);
    riderGroup.add(riderBody, helmet);
    riderGroup.visible = false;
    chassisGroup.add(riderGroup);
  } else if (kind === 'scooter') {
    shadowW = 0.95;
    shadowL = 2.05;
    cockpitOffset.set(0, 1.42, 0.1);

    const floorDeck = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.16, 1.2), darkTrimMat);
    floorDeck.position.set(0, 0.38, -0.04);
    chassisGroup.add(floorDeck);

    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.56, 0.72), paintMat);
    bodyMesh.position.set(0, 0.68, -0.34);
    bodyMesh.castShadow = true;
    chassisGroup.add(bodyMesh);

    const shield = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.68, 0.18), paintMat);
    shield.position.set(0, 0.76, 0.46);
    shield.rotation.x = -0.18;
    chassisGroup.add(shield);

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.36, 0.12, 0.66),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 })
    );
    seat.position.set(0, 0.86, -0.24);
    chassisGroup.add(seat);

    const frontPivot = new THREE.Group();
    frontPivot.position.set(0, 0.25, 0.62);
    const fw = createWheel(0.25, 0.11);
    frontPivot.add(fw);
    steeringWheel = new THREE.Group();
    steeringWheel.position.set(0, 0.78, -0.05);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.66, 0.05, 0.07), darkTrimMat);
    steeringWheel.add(bar);
    frontPivot.add(steeringWheel);
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.08), headLightMat());
    hl.position.set(0, 0.78, 0.05);
    frontPivot.add(hl);
    headlights.push(hl);
    group.add(frontPivot);
    frontSteerPivots.push(frontPivot);
    wheels.push(fw);

    const rw = createWheel(0.25, 0.12);
    rw.position.set(0, 0.25, -0.62);
    group.add(rw);
    wheels.push(rw);

    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.08), tailLightMat());
    tl.position.set(0, 0.76, -0.72);
    chassisGroup.add(tl);
    taillights.push(tl);
  } else if (kind === 'truck') {
    shadowW = 2.9;
    shadowL = 7.4;
    cockpitOffset.set(-0.62, 1.95, 2.2);

    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.85, 2.1), paintMat);
    cab.position.set(0, 1.48, 2.15);
    cab.castShadow = true;
    chassisGroup.add(cab);

    const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.78, 0.08), glassMat);
    windshield.position.set(0, 1.88, 3.21);
    chassisGroup.add(windshield);

    const cargoBox = new THREE.Mesh(
      new THREE.BoxGeometry(2.45, 2.25, 4.45),
      new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.78, metalness: 0.2 })
    );
    cargoBox.position.set(0, 1.75, -1.25);
    cargoBox.castShadow = true;
    chassisGroup.add(cargoBox);

    bodyMesh = cab;
    const plateF = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.16, 0.03), plateMat);
    plateF.position.set(0, 0.58, 3.23);
    const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.16, 0.03), plateMat);
    plateR.position.set(0, 0.62, -3.5);
    chassisGroup.add(plateF, plateR);

    [
      [-1.16, 2.25, true],
      [1.16, 2.25, true],
      [-1.16, -0.75, false],
      [1.16, -0.75, false],
      [-1.16, -2.2, false],
      [1.16, -2.2, false],
    ].forEach(([x, z, isFront]) => {
      const w = createWheel(0.48, 0.3);
      if (isFront) {
        const pv = new THREE.Group();
        pv.position.set(x as number, 0.48, z as number);
        pv.add(w);
        group.add(pv);
        frontSteerPivots.push(pv);
      } else {
        w.position.set(x as number, 0.48, z as number);
        group.add(w);
      }
      wheels.push(w);
    });

    [-0.86, 0.86].forEach((x, idx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headLightMat());
      hl.position.set(x, 0.82, 3.21);
      chassisGroup.add(hl);
      headlights.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), tailLightMat());
      tl.position.set(x, 0.72, -3.49);
      chassisGroup.add(tl);
      taillights.push(tl);

      const indF = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.08), indMat());
      indF.position.set(x * 1.24, 0.82, 3.22);
      const indR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.08), indMat());
      indR.position.set(x * 1.24, 0.72, -3.49);
      chassisGroup.add(indF, indR);
      if (idx === 0) leftIndicators.push(indF, indR);
      else rightIndicators.push(indF, indR);
    });
  } else if (kind === 'ambulance' || kind === 'delivery') {
    const isAmb = kind === 'ambulance';
    const bodyW = 2.08;
    const bodyH = isAmb ? 1.52 : 1.48;
    const bodyL = isAmb ? 5.1 : 4.9;
    shadowW = bodyW + 0.65;
    shadowL = bodyL + 0.65;

    // Sloped Cab Nose + Sculpted Box Utility Compartment + Wheel Arch Housings
    const cabHood = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.06, 0.78, 1.15), paintMat);
    cabHood.position.set(0, 0.76, bodyL * 0.5 - 0.56);
    cabHood.rotation.x = 0.08;
    cabHood.castShadow = true;

    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.14, 0.78, 1.32), paintMat);
    cabRoof.position.set(0, 1.56, bodyL * 0.5 - 1.28);
    cabRoof.castShadow = true;

    const windshield = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW - 0.24, 0.72, 0.08),
      new THREE.MeshPhysicalMaterial({ color: 0x1e293b, roughness: 0.06, transparent: true, opacity: 0.42 })
    );
    windshield.position.set(0, 1.44, bodyL * 0.5 - 0.82);
    windshield.rotation.x = -0.36;

    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyL - 1.7), paintMat);
    bodyMesh.position.set(0, 0.4 + bodyH * 0.5, -0.82);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.04, 0.24, 0.18), darkTrimMat);
    bumperF.position.set(0, 0.4, bodyL * 0.5 + 0.02);
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.28, 0.06), darkTrimMat);
    grille.position.set(0, 0.68, bodyL * 0.5 + 0.02);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.04, 0.24, 0.18), darkTrimMat);
    bumperR.position.set(0, 0.4, -bodyL * 0.5 + 0.02);
    chassisGroup.add(cabHood, cabRoof, windshield, bodyMesh, bumperF, grille, bumperR);

    const plateF = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.15, 0.03), plateMat);
    plateF.position.set(0, 0.42, bodyL * 0.5 + 0.12);
    const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.15, 0.03), plateMat);
    plateR.position.set(0, 0.45, -bodyL * 0.5 - 0.08);
    chassisGroup.add(plateF, plateR);

    const dashY = 1.08;
    const { interior, steeringWheel: sw } = createInteriorAssembly(bodyW, dashY, bodyL * 0.5 - 1.05, bodyL * 0.5 - 1.45);
    steeringWheel = sw;
    chassisGroup.add(interior);
    cockpitOffset.set(-bodyW * 0.22, dashY + 0.42, bodyL * 0.5 - 1.52);
    driverSeatOffset.set(-bodyW * 0.22, 0.46, bodyL * 0.5 - 1.32);

    if (isAmb) {
      const redStripeMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.35 });
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.03, 0.26, bodyL - 1.66), redStripeMat);
      stripe.position.set(0, 1.02, -0.82);
      chassisGroup.add(stripe);

      // Side 108 Medical Crosses
      [-bodyW * 0.5 - 0.02, bodyW * 0.5 + 0.02].forEach((sx) => {
        const vBar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.54, 0.16), redStripeMat);
        vBar.position.set(sx, 1.48, -0.82);
        const hBar = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.16, 0.54), redStripeMat);
        hBar.position.set(sx, 1.48, -0.82);
        chassisGroup.add(vBar, hBar);
      });

      const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.38, 0.1, 0.28), darkTrimMat);
      barBase.position.set(0, 2.02, bodyL * 0.5 - 1.25);
      const redPod = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.14, 0.24),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.7 })
      );
      redPod.position.set(-0.36, 2.06, bodyL * 0.5 - 1.25);
      const bluePod = new THREE.Mesh(
        new THREE.BoxGeometry(0.55, 0.14, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.2 })
      );
      bluePod.position.set(0.36, 2.06, bodyL * 0.5 - 1.25);
      chassisGroup.add(barBase, redPod, bluePod);
      policeLights = { red: redPod, blue: bluePod };
    } else {
      const expressBand = new THREE.Mesh(
        new THREE.BoxGeometry(bodyW + 0.03, 0.34, bodyL - 1.66),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.4 })
      );
      expressBand.position.set(0, 1.28, -0.82);
      const roofDeflector = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.25, 0.26, 0.72), paintMat);
      roofDeflector.position.set(0, 1.98, bodyL * 0.5 - 1.55);
      roofDeflector.rotation.x = 0.32;
      chassisGroup.add(expressBand, roofDeflector);
    }

    const wRad = 0.42;
    const wx = bodyW * 0.5 - 0.06;
    [
      [-wx, bodyL * 0.34, true],
      [wx, bodyL * 0.34, true],
      [-wx, -bodyL * 0.31, false],
      [wx, -bodyL * 0.31, false],
    ].forEach(([x, z, isFront]) => {
      const w = createWheel(wRad, 0.26);
      if (isFront) {
        const pv = new THREE.Group();
        pv.position.set(x as number, wRad, z as number);
        pv.add(w);
        group.add(pv);
        frontSteerPivots.push(pv);
      } else {
        w.position.set(x as number, wRad, z as number);
        group.add(w);
      }
      wheels.push(w);
    });

    [-bodyW * 0.34, bodyW * 0.34].forEach((x, idx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.08), headLightMat());
      hl.position.set(x, 0.68, bodyL * 0.5 + 0.02);
      chassisGroup.add(hl);
      headlights.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.18, 0.08), tailLightMat());
      tl.position.set(x, 0.76, -bodyL * 0.5 - 0.02);
      chassisGroup.add(tl);
      taillights.push(tl);

      const indF = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.08), indMat());
      indF.position.set(x * 1.28, 0.68, bodyL * 0.5 + 0.02);
      const indR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.08), indMat());
      indR.position.set(x * 1.28, 0.76, -bodyL * 0.5 - 0.02);
      chassisGroup.add(indF, indR);
      if (idx === 0) leftIndicators.push(indF, indR);
      else rightIndicators.push(indF, indR);
    });
  } else {
    const isSuv = kind === 'police_suv' || kind === 'suv';
    const isPoliceSuv = kind === 'police_suv';
    const isCoupe = kind === 'coupe';
    const isHatch = kind === 'hatchback';
    const bodyW = isSuv ? 2.04 : isCoupe ? 1.98 : isHatch ? 1.82 : 1.88;
    const bodyH = isSuv ? 0.82 : isCoupe ? 0.56 : isHatch ? 0.62 : 0.64;
    const bodyL = isSuv ? 4.55 : isCoupe ? 4.45 : isHatch ? 3.8 : 4.3;
    shadowW = bodyW + 0.6;
    shadowL = bodyL + 0.6;

    // Lower sculpted beltline chassis + tapered hood deck + side sill skirts + wheel arch flares
    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyL - 0.36), paintMat);
    bodyMesh.position.set(0, 0.36 + bodyH * 0.5, -0.08);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    chassisGroup.add(bodyMesh);

    const hoodSlope = new THREE.Mesh(
      new THREE.BoxGeometry(bodyW - 0.08, bodyH * 0.72, 1.18),
      paintMat
    );
    hoodSlope.position.set(0, 0.36 + bodyH * 0.42, bodyL * 0.5 - 0.62);
    hoodSlope.rotation.x = isCoupe ? 0.12 : 0.08;
    hoodSlope.castShadow = true;

    const frontGrille = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.52, 0.26, 0.08), darkTrimMat);
    frontGrille.position.set(0, 0.36 + bodyH * 0.36, bodyL * 0.5 + 0.02);

    const sideBeltLine = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.03, 0.09, bodyL * 0.76), darkTrimMat);
    sideBeltLine.position.set(0, 0.56, -0.05);

    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.04, 0.24, 0.18), darkTrimMat);
    bumperF.position.set(0, 0.4, bodyL * 0.5);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.04, 0.24, 0.18), darkTrimMat);
    bumperR.position.set(0, 0.4, -bodyL * 0.5);
    chassisGroup.add(hoodSlope, frontGrille, sideBeltLine, bumperF, bumperR);

    // Wheel arch fender housings
    const archMat = darkTrimMat;
    [-bodyW * 0.49, bodyW * 0.49].forEach((ax) => {
      [bodyL * 0.33, -bodyL * 0.33].forEach((az) => {
        const arch = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.28, 0.86), archMat);
        arch.position.set(ax, 0.58, az);
        chassisGroup.add(arch);
      });
    });

    // Indian Number Plates
    const plateF = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.03), plateMat);
    plateF.position.set(0, 0.42, bodyL * 0.5 + 0.1);
    const plateR = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.14, 0.03), plateMat);
    plateR.position.set(0, 0.56, -bodyL * 0.5 - 0.1);
    chassisGroup.add(plateF, plateR);

    const cabinL = isSuv ? 2.62 : isCoupe ? 1.98 : isHatch ? 2.15 : 2.22;
    const cabinH = isSuv ? 0.66 : isCoupe ? 0.46 : isHatch ? 0.56 : 0.54;
    const cabinZ = isCoupe ? -0.26 : isHatch ? -0.35 : -0.14;
    const clearCabinGlass = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0,
      transparent: true,
      opacity: 0.4,
    });

    // Angled Front Windshield, Side Windows, Rear Glass, A/B/C Pillars & Roof
    const cabinY = 0.36 + bodyH;
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.26, cabinH + 0.06, 0.08), clearCabinGlass);
    windshield.position.set(0, cabinY + cabinH * 0.46, cabinZ + cabinL * 0.5 - 0.16);
    windshield.rotation.x = isCoupe ? -0.52 : -0.38;

    const rearGlass = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.28, cabinH + 0.04, 0.08), clearCabinGlass);
    rearGlass.position.set(0, cabinY + cabinH * 0.46, cabinZ - cabinL * 0.5 + 0.16);
    rearGlass.rotation.x = isHatch ? 0.22 : 0.44;

    const sideWindows = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.24, cabinH - 0.04, cabinL - 0.36), clearCabinGlass);
    sideWindows.position.set(0, cabinY + cabinH * 0.48, cabinZ);

    // Structural A, B, C Pillars
    [-bodyW * 0.5 + 0.15, bodyW * 0.5 - 0.15].forEach((px) => {
      const aPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, cabinH + 0.08, 0.1), darkTrimMat);
      aPillar.position.set(px, cabinY + cabinH * 0.46, cabinZ + cabinL * 0.5 - 0.16);
      aPillar.rotation.x = isCoupe ? -0.52 : -0.38;
      const bPillar = new THREE.Mesh(new THREE.BoxGeometry(0.08, cabinH, 0.12), darkTrimMat);
      bPillar.position.set(px, cabinY + cabinH * 0.48, cabinZ - 0.05);
      const cPillar = new THREE.Mesh(new THREE.BoxGeometry(0.09, cabinH + 0.06, 0.14), paintMat);
      cPillar.position.set(px, cabinY + cabinH * 0.46, cabinZ - cabinL * 0.5 + 0.18);
      cPillar.rotation.x = isHatch ? 0.22 : 0.44;
      chassisGroup.add(aPillar, bPillar, cPillar);
    });

    const roof = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.26, 0.09, cabinL - 0.34), paintMat);
    roof.position.set(0, cabinY + cabinH - 0.03, cabinZ);
    roof.castShadow = true;
    chassisGroup.add(windshield, rearGlass, sideWindows, roof);

    // Hinged Driver-Side Door (RHD right-side / left-entry animation pivot)
    driverDoorPivot = new THREE.Group();
    driverDoorPivot.position.set(-bodyW * 0.5 - 0.01, 0.36 + bodyH * 0.5, cabinZ + 0.45);
    const doorPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, bodyH * 0.85, 0.95), paintMat);
    doorPanel.position.set(0, 0, -0.45);
    const doorHandle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.04, 0.14), rimMat);
    doorHandle.position.set(-0.02, 0.16, -0.72);
    driverDoorPivot.add(doorPanel, doorHandle);
    chassisGroup.add(driverDoorPivot);

    // Side Mirrors
    [-bodyW * 0.52, bodyW * 0.52].forEach((mx) => {
      const mirror = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.12), darkTrimMat);
      mirror.position.set(mx, 0.36 + bodyH + 0.12, cabinZ + cabinL * 0.35);
      chassisGroup.add(mirror);
    });

    // Detailed Interior Dashboard + RHD Steering Wheel + Seats
    const dashY = 0.36 + bodyH + 0.08;
    const dashZ = cabinZ + cabinL * 0.34;
    const { interior, steeringWheel: sw } = createInteriorAssembly(bodyW, dashY, dashZ, cabinZ - 0.15);
    steeringWheel = sw;
    chassisGroup.add(interior);
    cockpitOffset.set(-bodyW * 0.22, dashY + 0.38, cabinZ - 0.18);
    driverSeatOffset.set(-bodyW * 0.22, 0.38, cabinZ + 0.12);
    passengerSeatOffset.set(bodyW * 0.22, 0.38, cabinZ - 0.52);
    passengerCockpitOffset.set(bodyW * 0.22, dashY + 0.36, cabinZ - 0.48);

    // Windshield wipers
    [-0.38, 0.25].forEach((wx) => {
      const wiper = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.44, 0.03), darkTrimMat);
      wiper.position.set(wx, 0.36 + bodyH + 0.06, cabinZ + cabinL * 0.5 + 0.02);
      wiper.rotation.x = -0.35;
      chassisGroup.add(wiper);
      wipers.push(wiper);
    });

    if (isCoupe) {
      const wing = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.12, 0.07, 0.34), darkTrimMat);
      wing.position.set(0, 0.36 + bodyH + 0.22, -bodyL * 0.5 + 0.26);
      chassisGroup.add(wing);
    }

    if (kind === 'cab') {
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.64, 0.18, 0.26),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.7 })
      );
      sign.position.set(0, 0.36 + bodyH + cabinH + 0.08, 0.1);
      chassisGroup.add(sign);
    }

    if (isPoliceSuv) {
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(bodyW + 0.03, 0.22, bodyL * 0.72),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.35, metalness: 0.4 })
      );
      stripe.position.set(0, 0.8, 0);
      chassisGroup.add(stripe);

      const barBase = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.1, 0.28), darkTrimMat);
      barBase.position.set(0, 0.36 + bodyH + cabinH + 0.04, 0.1);
      const redPod = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.14, 0.24),
        new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 1.6 })
      );
      redPod.position.set(-0.34, 0.36 + bodyH + cabinH + 0.08, 0.1);
      const bluePod = new THREE.Mesh(
        new THREE.BoxGeometry(0.52, 0.14, 0.24),
        new THREE.MeshStandardMaterial({ color: 0x3b82f6, emissive: 0x3b82f6, emissiveIntensity: 0.1 })
      );
      bluePod.position.set(0.34, 0.36 + bodyH + cabinH + 0.08, 0.1);
      chassisGroup.add(barBase, redPod, bluePod);
      policeLights = { red: redPod, blue: bluePod };
    }

    const wRad = isSuv ? 0.42 : 0.36;
    const wx = bodyW * 0.5 - 0.06;
    const wz = bodyL * 0.33;
    [
      [-wx, wz, true],
      [wx, wz, true],
      [-wx, -wz, false],
      [wx, -wz, false],
    ].forEach(([x, z, isFront]) => {
      const w = createWheel(wRad, 0.26);
      if (isFront) {
        const pv = new THREE.Group();
        pv.position.set(x as number, wRad, z as number);
        pv.add(w);
        group.add(pv);
        frontSteerPivots.push(pv);
      } else {
        w.position.set(x as number, wRad, z as number);
        group.add(w);
      }
      wheels.push(w);
    });

    [-bodyW * 0.34, bodyW * 0.34].forEach((x, idx) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headLightMat());
      hl.position.set(x, 0.64, bodyL * 0.5 + 0.01);
      chassisGroup.add(hl);
      headlights.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.08), tailLightMat());
      tl.position.set(x, 0.7, -bodyL * 0.5 - 0.01);
      chassisGroup.add(tl);
      taillights.push(tl);

      const indF = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), indMat());
      indF.position.set(x * 1.28, 0.64, bodyL * 0.5 + 0.01);
      const indR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.08), indMat());
      indR.position.set(x * 1.28, 0.7, -bodyL * 0.5 - 0.01);
      chassisGroup.add(indF, indR);
      if (idx === 0) leftIndicators.push(indF, indR);
      else rightIndicators.push(indF, indR);
    });
  }

  const contactShadow = createShadowPlane(shadowW, shadowL, shadowTex);
  group.add(contactShadow);

  return {
    group,
    chassisGroup,
    bodyMesh,
    wheels,
    frontSteerPivots,
    headlights,
    taillights,
    leftIndicators,
    rightIndicators,
    steeringWheel,
    driverDoorPivot,
    wipers,
    cockpitOffset,
    driverSeatOffset,
    passengerSeatOffset,
    passengerCockpitOffset,
    policeLights,
    riderGroup,
    contactShadow,
  };
}

export function createMetroTrain(lineHex = 0x7e22ce): THREE.Group {
  const train = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.22,
    metalness: 0.72,
    clearcoat: 0.85,
  });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: lineHex,
    roughness: 0.32,
    metalness: 0.42,
  });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.65 });
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.52,
    roughness: 0.12,
  });

  const carOffsets = [-32.4, -16.2, 0, 16.2, 32.4];
  carOffsets.forEach((ox, idx) => {
    const car = new THREE.Group();
    car.position.x = ox;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(14.8, 3.15, 3.1), bodyMat);
    shell.position.y = 1.85;
    const underFrame = new THREE.Mesh(new THREE.BoxGeometry(14.8, 0.55, 2.95), darkMetal);
    underFrame.position.y = 0.55;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(14.85, 0.48, 3.14), stripeMat);
    stripe.position.y = 1.15;
    const windows = new THREE.Mesh(new THREE.BoxGeometry(13.4, 1.05, 3.16), winMat);
    windows.position.y = 2.25;
    car.add(shell, underFrame, stripe, windows);

    // Bogies
    [-4.8, 4.8].forEach((bx) => {
      const bogie = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 2.2), darkMetal);
      bogie.position.set(bx, 0.25, 0);
      car.add(bogie);
    });

    // Tapered Nose Cab & Headlights on front/rear cars of 5-car train
    if (idx === 0 || idx === carOffsets.length - 1) {
      const sign = idx === carOffsets.length - 1 ? 1 : -1;
      const nose = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.55, 2.9), bodyMat);
      nose.position.set(sign * 7.8, 1.75, 0);
      nose.rotation.z = -sign * 0.2;
      const headLight = new THREE.Mesh(
        new THREE.BoxGeometry(0.15, 0.28, 0.7),
        new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfef08a, emissiveIntensity: 1.6 })
      );
      headLight.position.set(sign * 8.55, 1.15, 0);
      car.add(nose, headLight);
    }

    train.add(car);
  });

  // Accordion gangways joining the 5 coaches
  [-24.3, -8.1, 8.1, 24.3].forEach((gx) => {
    const bellows = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.65, 2.4), darkMetal);
    bellows.position.set(gx, 1.85, 0);
    train.add(bellows);
  });

  return train;
}
