import * as THREE from 'three';
import { PlayerCustomization, VehicleKind } from './types';

export interface PlayerRig {
  group: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  jacketMesh: THREE.Mesh;
  shirtMesh: THREE.Mesh;
  pantsMeshes: THREE.Mesh[];
  sunglasses: THREE.Group;
  backpack: THREE.Mesh;
  contactShadow: THREE.Mesh;
}

export interface VehicleRig {
  group: THREE.Group;
  bodyMesh: THREE.Mesh;
  wheels: THREE.Mesh[];
  frontSteerPivots: THREE.Group[];
  headlights: THREE.Mesh[];
  taillights: THREE.Mesh[];
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
  roughness: 0.08,
  metalness: 0.1,
  clearcoat: 1.0,
  transparent: true,
  opacity: 0.72,
});

function createWheel(radius: number, width: number): THREE.Mesh {
  const wheelGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheel = new THREE.Mesh(wheelGeo, rubberMat);
  wheel.castShadow = true;

  const hubGeo = new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.03, 12);
  hubGeo.rotateZ(Math.PI / 2);
  const hub = new THREE.Mesh(hubGeo, rimMat);
  wheel.add(hub);
  return wheel;
}

function createShadowPlane(w: number, l: number, shadowTex: THREE.Texture): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, l);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: shadowTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.52,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.y = 0.03;
  return m;
}

export function createPlayerRig(
  custom: PlayerCustomization,
  shadowTex: THREE.Texture
): PlayerRig {
  const group = new THREE.Group();

  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb97a57, roughness: 0.65, metalness: 0.02 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.8, metalness: 0.05 });
  const jacketMat = new THREE.MeshStandardMaterial({ color: custom.jacketColor, roughness: 0.52, metalness: 0.12 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: custom.shirtColor, roughness: 0.72, metalness: 0.02 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: custom.pantsColor, roughness: 0.78, metalness: 0.04 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.55, metalness: 0.1 });

  const torso = new THREE.Group();
  torso.position.y = 0.92;
  group.add(torso);

  // Shirt & open jacket silhouette
  const shirtMesh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.54, 0.24), shirtMat);
  shirtMesh.position.y = 0.26;
  shirtMesh.castShadow = true;
  torso.add(shirtMesh);

  const jacketMesh = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.5, 0.26), jacketMat);
  jacketMesh.position.set(0, 0.27, -0.015);
  jacketMesh.castShadow = true;
  torso.add(jacketMesh);

  // Backpack
  const backpack = new THREE.Mesh(
    new THREE.BoxGeometry(0.32, 0.4, 0.16),
    new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.65, metalness: 0.15 })
  );
  backpack.position.set(0, 0.28, -0.2);
  backpack.castShadow = true;
  backpack.visible = custom.backpack;
  torso.add(backpack);

  // Head + Hair + Sunglasses
  const head = new THREE.Group();
  head.position.set(0, 0.62, 0);
  torso.add(head);

  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.155, 16, 14), skinMat);
  headMesh.position.y = 0.12;
  headMesh.castShadow = true;
  head.add(headMesh);

  const hairMesh = new THREE.Mesh(new THREE.SphereGeometry(0.162, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  hairMesh.position.set(0, 0.145, -0.015);
  head.add(hairMesh);

  const sunglasses = new THREE.Group();
  sunglasses.position.set(0, 0.135, 0.135);
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.85 });
  const lensL = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.042, 0.025), frameMat);
  lensL.position.x = -0.05;
  const lensR = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.042, 0.025), frameMat);
  lensR.position.x = 0.05;
  const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.02), frameMat);
  sunglasses.add(lensL, lensR, bridge);
  sunglasses.visible = custom.sunglasses;
  head.add(sunglasses);

  // Arms
  const makeArm = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 0.48, 0);
    const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.42, 0.13), jacketMat);
    sleeve.position.y = -0.19;
    sleeve.castShadow = true;
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.13, 0.1), skinMat);
    hand.position.y = -0.44;
    pivot.add(sleeve, hand);
    torso.add(pivot);
    return pivot;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  // Legs
  const pantsMeshes: THREE.Mesh[] = [];
  const makeLeg = (side: -1 | 1) => {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.12, 0.92, 0);
    const legMesh = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.78, 0.18), pantsMat);
    legMesh.position.y = -0.4;
    legMesh.castShadow = true;
    pantsMeshes.push(legMesh);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.13, 0.26), shoeMat);
    shoe.position.set(0, -0.84, 0.04);
    shoe.castShadow = true;
    pivot.add(legMesh, shoe);
    group.add(pivot);
    return pivot;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  const contactShadow = createShadowPlane(0.95, 0.95, shadowTex);
  group.add(contactShadow);

  return {
    group,
    torso,
    head,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    jacketMesh,
    shirtMesh,
    pantsMeshes,
    sunglasses,
    backpack,
    contactShadow,
  };
}

export function applyPlayerCustomization(rig: PlayerRig, custom: PlayerCustomization): void {
  (rig.jacketMesh.material as THREE.MeshStandardMaterial).color.set(custom.jacketColor);
  (rig.shirtMesh.material as THREE.MeshStandardMaterial).color.set(custom.shirtColor);
  rig.pantsMeshes.forEach((m) => (m.material as THREE.MeshStandardMaterial).color.set(custom.pantsColor));
  rig.sunglasses.visible = custom.sunglasses;
  rig.backpack.visible = custom.backpack;
}

export function createVehicleRig(
  kind: VehicleKind,
  colorHex: string,
  shadowTex: THREE.Texture
): VehicleRig {
  const group = new THREE.Group();
  const wheels: THREE.Mesh[] = [];
  const frontSteerPivots: THREE.Group[] = [];
  const headlights: THREE.Mesh[] = [];
  const taillights: THREE.Mesh[] = [];

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: colorHex,
    roughness: 0.22,
    metalness: 0.65,
    clearcoat: 0.95,
    clearcoatRoughness: 0.12,
  });

  const headLightMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfef08a,
      emissiveIntensity: 0.3,
      roughness: 0.1,
    });

  const tailLightMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.35,
      roughness: 0.2,
    });

  let bodyMesh: THREE.Mesh;
  let policeLights: { red: THREE.Mesh; blue: THREE.Mesh } | undefined;
  let riderGroup: THREE.Group | undefined;
  let shadowW = 2.6;
  let shadowL = 4.6;

  if (kind === 'auto') {
    // Iconic Bengaluru Yellow-Top / Green-Black Auto-Rickshaw (3-wheeler)
    shadowW = 2.0;
    shadowL = 3.2;

    const lowerBody = new THREE.Mesh(
      new THREE.BoxGeometry(1.45, 0.72, 2.55),
      new THREE.MeshStandardMaterial({ color: 0x14532d, roughness: 0.42, metalness: 0.3 })
    );
    lowerBody.position.set(0, 0.68, 0);
    lowerBody.castShadow = true;
    group.add(lowerBody);

    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.85, 2.2), paintMat);
    bodyMesh.position.set(0, 1.45, -0.14);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    // Front curved windshield fairing & handlebars
    const frontShield = new THREE.Mesh(new THREE.BoxGeometry(1.26, 0.56, 0.08), glassMat);
    frontShield.position.set(0, 1.38, 1.0);
    frontShield.rotation.x = -0.22;
    group.add(frontShield);

    const mudguard = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.26, 0.65), paintMat);
    mudguard.position.set(0, 0.56, 1.15);
    group.add(mudguard);

    // Rear spare wheel on back
    const spare = createWheel(0.24, 0.14);
    spare.rotation.y = Math.PI / 2;
    spare.position.set(0, 0.72, -1.33);
    group.add(spare);

    // 1 front steered wheel + 2 rear wheels
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

    // Single central headlamp + 2 taillights
    const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12), headLightMat());
    hl.rotation.x = Math.PI / 2;
    hl.position.set(0, 0.85, 1.3);
    group.add(hl);
    headlights.push(hl);

    [-0.54, 0.54].forEach((x) => {
      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.08), tailLightMat());
      tl.position.set(x, 0.68, -1.3);
      group.add(tl);
      taillights.push(tl);
    });
  } else if (kind === 'bmtc') {
    // BMTC Volvo Vajra AC City Bus
    shadowW = 3.2;
    shadowL = 9.4;

    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.55, 2.25, 8.6), paintMat);
    bodyMesh.position.set(0, 1.65, 0);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    const silverBand = new THREE.Mesh(
      new THREE.BoxGeometry(2.59, 0.46, 8.62),
      new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.3, metalness: 0.6 })
    );
    silverBand.position.set(0, 0.92, 0);
    group.add(silverBand);

    // Panoramic tinted windows
    const sideGlass = new THREE.Mesh(new THREE.BoxGeometry(2.58, 0.95, 7.8), glassMat);
    sideGlass.position.set(0, 1.95, 0);
    group.add(sideGlass);

    const frontGlass = new THREE.Mesh(new THREE.BoxGeometry(2.35, 1.15, 0.08), glassMat);
    frontGlass.position.set(0, 1.92, 4.31);
    group.add(frontGlass);

    // LED Route Board (335E)
    const destBoard = new THREE.Mesh(
      new THREE.BoxGeometry(1.75, 0.25, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0xf59e0b, emissiveIntensity: 0.85 })
    );
    destBoard.position.set(0, 2.62, 4.31);
    group.add(destBoard);

    // Roof AC unit
    const acPod = new THREE.Mesh(
      new THREE.BoxGeometry(1.5, 0.32, 3.2),
      new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45, metalness: 0.2 })
    );
    acPod.position.set(0, 2.93, -0.4);
    group.add(acPod);

    // 4 wheels
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

    [-0.95, 0.95].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.16, 0.08), headLightMat());
      hl.position.set(x, 0.82, 4.32);
      group.add(hl);
      headlights.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.22, 0.08), tailLightMat());
      tl.position.set(x, 0.95, -4.32);
      group.add(tl);
      taillights.push(tl);
    });
  } else if (kind === 'bike' || kind === 'police_bike') {
    // Bengaluru Streetfighter / Police Interceptor Motorcycle
    shadowW = 1.1;
    shadowL = 2.4;

    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 1.55), darkTrimMat);
    frame.position.set(0, 0.65, 0);
    frame.castShadow = true;
    group.add(frame);

    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.34, 0.72), paintMat);
    bodyMesh.position.set(0, 0.92, 0.22);
    bodyMesh.castShadow = true;
    group.add(bodyMesh);

    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(0.34, 0.14, 0.68),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 0.8 })
    );
    seat.position.set(0, 0.88, -0.36);
    group.add(seat);

    // Exhaust pipes
    [-0.22, 0.22].forEach((x) => {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.85, 8), rimMat);
      pipe.rotation.x = Math.PI / 2 - 0.12;
      pipe.position.set(x, 0.46, -0.58);
      group.add(pipe);
    });

    // Handlebars & front fork
    const frontPivot = new THREE.Group();
    frontPivot.position.set(0, 0.36, 0.78);
    const fw = createWheel(0.36, 0.14);
    frontPivot.add(fw);

    const fork = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.78, 8), rimMat);
    fork.position.set(0, 0.36, -0.08);
    fork.rotation.x = -0.3;
    frontPivot.add(fork);

    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.76, 0.05, 0.06), darkTrimMat);
    bar.position.set(0, 0.72, -0.18);
    frontPivot.add(bar);

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
    group.add(tl);
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
      group.add(pole, beaconRed, beaconBlue);
      policeLights = { red: beaconRed, blue: beaconBlue };
    }

    // Rider silhouette placeholder when AI/player rides
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
    group.add(riderGroup);
  } else {
    // 'cab', 'coupe', 'police_suv'
    const isSuv = kind === 'police_suv';
    const isCoupe = kind === 'coupe';
    const bodyW = isSuv ? 2.02 : isCoupe ? 1.98 : 1.88;
    const bodyH = isSuv ? 0.85 : isCoupe ? 0.58 : 0.68;
    const bodyL = isSuv ? 4.45 : isCoupe ? 4.4 : 4.25;
    shadowW = bodyW + 0.6;
    shadowL = bodyL + 0.6;

    // Lower chassis
    bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyL), paintMat);
    bodyMesh.position.set(0, 0.36 + bodyH * 0.5, 0);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    group.add(bodyMesh);

    // Front & rear bumpers / grille
    const bumperF = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.04, 0.24, 0.16), darkTrimMat);
    bumperF.position.set(0, 0.42, bodyL * 0.5);
    const bumperR = new THREE.Mesh(new THREE.BoxGeometry(bodyW + 0.04, 0.24, 0.16), darkTrimMat);
    bumperR.position.set(0, 0.42, -bodyL * 0.5);
    group.add(bumperF, bumperR);

    // Cabin roof & glass
    const cabinL = isSuv ? 2.65 : isCoupe ? 2.05 : 2.25;
    const cabinH = isSuv ? 0.68 : isCoupe ? 0.48 : 0.55;
    const cabinZ = isCoupe ? -0.22 : -0.12;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.24, cabinH, cabinL), glassMat);
    cabin.position.set(0, 0.36 + bodyH + cabinH * 0.5 - 0.04, cabinZ);
    group.add(cabin);

    const roof = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.28, 0.08, cabinL - 0.28), paintMat);
    roof.position.set(0, 0.36 + bodyH + cabinH - 0.03, cabinZ);
    roof.castShadow = true;
    group.add(roof);

    if (isCoupe) {
      // Carbon rear wing spoiler
      const wing = new THREE.Mesh(new THREE.BoxGeometry(bodyW - 0.12, 0.07, 0.34), darkTrimMat);
      wing.position.set(0, 0.36 + bodyH + 0.22, -bodyL * 0.5 + 0.26);
      group.add(wing);
    }

    if (kind === 'cab') {
      // Namma Cab yellow-lit roof sign
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(0.64, 0.18, 0.26),
        new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.7 })
      );
      sign.position.set(0, 0.36 + bodyH + cabinH + 0.08, 0.1);
      group.add(sign);
    }

    if (isSuv) {
      // Karnataka Police navy stripe + red/blue lightbar
      const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(bodyW + 0.03, 0.22, bodyL * 0.72),
        new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.35, metalness: 0.4 })
      );
      stripe.position.set(0, 0.8, 0);
      group.add(stripe);

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
      group.add(barBase, redPod, bluePod);
      policeLights = { red: redPod, blue: bluePod };
    }

    // 4 wheels
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

    // Headlights & Taillights
    [-bodyW * 0.34, bodyW * 0.34].forEach((x) => {
      const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.14, 0.08), headLightMat());
      hl.position.set(x, 0.66, bodyL * 0.5 + 0.01);
      group.add(hl);
      headlights.push(hl);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.14, 0.08), tailLightMat());
      tl.position.set(x, 0.72, -bodyL * 0.5 - 0.01);
      group.add(tl);
      taillights.push(tl);
    });
  }

  const contactShadow = createShadowPlane(shadowW, shadowL, shadowTex);
  group.add(contactShadow);

  return {
    group,
    bodyMesh,
    wheels,
    frontSteerPivots,
    headlights,
    taillights,
    policeLights,
    riderGroup,
    contactShadow,
  };
}

export function createMetroTrain(): THREE.Group {
  const train = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0xe2e8f0,
    roughness: 0.25,
    metalness: 0.7,
    clearcoat: 0.8,
  });
  const purpleMat = new THREE.MeshStandardMaterial({
    color: 0x7e22ce,
    roughness: 0.35,
    metalness: 0.4,
  });
  const winMat = new THREE.MeshStandardMaterial({
    color: 0x0f172a,
    emissive: 0xfef3c7,
    emissiveIntensity: 0.35,
    roughness: 0.15,
  });

  // 3 articulated Namma Metro Purple Line cars
  [-15, 0, 15].forEach((ox) => {
    const car = new THREE.Group();
    car.position.x = ox;
    const shell = new THREE.Mesh(new THREE.BoxGeometry(13.5, 3.1, 3.1), bodyMat);
    shell.position.y = 1.6;
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(13.55, 0.5, 3.14), purpleMat);
    stripe.position.y = 1.0;
    const windows = new THREE.Mesh(new THREE.BoxGeometry(12.2, 1.05, 3.16), winMat);
    windows.position.y = 2.05;
    car.add(shell, stripe, windows);
    train.add(car);
  });
  return train;
}

export function createNpcRig(shirtColor: number, pantsColor: number, shadowTex: THREE.Texture): {
  group: THREE.Group;
  leftLeg: THREE.Mesh;
  rightLeg: THREE.Mesh;
  leftArm: THREE.Mesh;
  rightArm: THREE.Mesh;
} {
  const group = new THREE.Group();
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xb07252, roughness: 0.7 });
  const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.75 });
  const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.8 });

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.55, 0.22), shirtMat);
  torso.position.y = 1.18;
  torso.castShadow = true;
  group.add(torso);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 10, 10), skinMat);
  head.position.y = 1.62;
  group.add(head);

  const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.76, 0.16), pantsMat);
  leftLeg.position.set(-0.11, 0.42, 0);
  const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.76, 0.16), pantsMat);
  rightLeg.position.set(0.11, 0.42, 0);
  const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.48, 0.11), shirtMat);
  leftArm.position.set(-0.28, 1.15, 0);
  const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.48, 0.11), shirtMat);
  rightArm.position.set(0.28, 1.15, 0);

  group.add(leftLeg, rightLeg, leftArm, rightArm);
  group.add(createShadowPlane(0.85, 0.85, shadowTex));
  return { group, leftLeg, rightLeg, leftArm, rightArm };
}
