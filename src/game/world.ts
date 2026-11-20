import * as THREE from 'three';
import {
  COLLECTIBLES,
  LANDMARK_MARKERS,
  ROAD_SEGMENTS,
  WATER_ZONES,
  WORLD_HALF_SIZE,
} from './bengaluruData';
import { createMetroTrain } from './entities';
import { TextureBundle } from './textures';
import { BuildingCollider, WeatherMode } from './types';

export interface TrafficSignalObj {
  x: number;
  z: number;
  nsRed: THREE.Mesh;
  nsGreen: THREE.Mesh;
  ewRed: THREE.Mesh;
  ewGreen: THREE.Mesh;
}

export interface WorldHandles {
  colliders: BuildingCollider[];
  metroTrain: THREE.Group;
  collectibleMeshes: Map<string, THREE.Group>;
  missionBeacon: THREE.Group;
  trafficSignals: TrafficSignalObj[];
  rainPoints: THREE.Points;
  rainPositions: Float32Array;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  roadMaterial: THREE.MeshStandardMaterial;
  streetLampBulbMat: THREE.MeshStandardMaterial;
  windowEmissiveMaterials: THREE.MeshStandardMaterial[];
  waterMeshes: THREE.Mesh[];
  updateAtmosphere: (
    timeHours: number,
    weather: WeatherMode,
    playerX: number,
    playerZ: number,
    elapsed: number,
    dt: number
  ) => void;
}

function addBoxBuilding(
  parent: THREE.Group,
  colliders: BuildingCollider[],
  x: number,
  z: number,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  roofColor = 0x334155
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  mesh.position.set(x, h * 0.5, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);

  // Roof parapet trim for composite silhouette
  const parapet = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, 0.7, d + 0.4),
    new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.75 })
  );
  parapet.position.set(x, h + 0.35, z);
  parent.add(parapet);

  colliders.push({
    minX: x - w * 0.5,
    maxX: x + w * 0.5,
    minZ: z - d * 0.5,
    maxZ: z + d * 0.5,
    height: h,
  });
  return mesh;
}

export function buildBengaluruWorld(
  scene: THREE.Scene,
  textures: TextureBundle
): WorldHandles {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const colliders: BuildingCollider[] = [];
  const windowEmissiveMaterials: THREE.MeshStandardMaterial[] = [];

  // Lighting Rig (Warm Sun + Cool Sky/Ground Hemisphere)
  const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x3f4e3a, 0.75);
  hemiLight.position.set(0, 120, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
  sunLight.position.set(110, 160, 80);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  const d = 140;
  sunLight.shadow.camera.left = -d;
  sunLight.shadow.camera.right = d;
  sunLight.shadow.camera.top = d;
  sunLight.shadow.camera.bottom = -d;
  sunLight.shadow.camera.near = 10;
  sunLight.shadow.camera.far = 420;
  sunLight.shadow.bias = -0.0005;
  sunLight.shadow.normalBias = 0.025;
  scene.add(sunLight);
  scene.add(sunLight.target);

  // Extended Horizon Ground (1800x1800 so outdoor world never ends in an indoor box)
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.grass,
    roughness: 0.92,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  ground.receiveShadow = true;
  worldGroup.add(ground);

  // Urban concrete district pads under dense city sectors
  const urbanPadMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalk,
    roughness: 0.85,
    metalness: 0.04,
  });
  const urbanSectors: Array<[number, number, number, number]> = [
    [40, 20, 220, 240], // MG + Brigade
    [240, -110, 220, 200], // Indiranagar
    [-340, -10, 200, 320], // Majestic + KR Market
    [210, 140, 200, 190], // Koramangala
    [420, -160, 220, 230], // Whitefield
    [240, 410, 250, 210], // Electronic City
  ];
  urbanSectors.forEach(([sx, sz, sw, sd]) => {
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(sw, sd), urbanPadMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(sx, 0.015, sz);
    pad.receiveShadow = true;
    worldGroup.add(pad);
  });

  // Road Network
  const roadMaterial = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.72,
    metalness: 0.08,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  ROAD_SEGMENTS.forEach((seg) => {
    if (seg.elevated) return;
    const dx = seg.x2 - seg.x1;
    const dz = seg.z2 - seg.z1;
    const len = Math.hypot(dx, dz);
    const isHorizontal = Math.abs(dx) > Math.abs(dz);

    const tex = textures.asphalt.clone();
    tex.needsUpdate = true;
    tex.repeat.set(1, Math.max(1, Math.round(len / 24)));
    const mat = roadMaterial.clone();
    mat.map = tex;

    const road = new THREE.Mesh(new THREE.PlaneGeometry(seg.width, len), mat);
    road.rotation.x = -Math.PI / 2;
    if (isHorizontal) {
      road.rotation.z = Math.PI / 2;
    }
    road.position.set((seg.x1 + seg.x2) * 0.5, 0.04, (seg.z1 + seg.z2) * 0.5);
    road.receiveShadow = true;
    worldGroup.add(road);
  });

  // Silk Board - ORR Elevated Flyover (x = -40..340, z = 260)
  const flyoverMat = new THREE.MeshStandardMaterial({
    color: 0x475569,
    roughness: 0.75,
    metalness: 0.1,
  });
  const flyoverDeckMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.65,
    metalness: 0.1,
  });
  // West Ramp (-40 to 30)
  const rampLen = Math.hypot(70, 7.5);
  const rampAngle = Math.atan2(7.5, 70);
  const westRamp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.6, 12), flyoverDeckMat);
  westRamp.position.set(-5, 3.45, 260);
  westRamp.rotation.z = rampAngle;
  westRamp.castShadow = true;
  westRamp.receiveShadow = true;
  worldGroup.add(westRamp);

  // Center Elevated Deck (30 to 270)
  const mainDeck = new THREE.Mesh(new THREE.BoxGeometry(240, 0.9, 12.4), flyoverDeckMat);
  mainDeck.position.set(150, 7.05, 260);
  mainDeck.castShadow = true;
  mainDeck.receiveShadow = true;
  worldGroup.add(mainDeck);

  // East Ramp (270 to 340)
  const eastRamp = new THREE.Mesh(new THREE.BoxGeometry(rampLen, 0.6, 12), flyoverDeckMat);
  eastRamp.position.set(305, 3.45, 260);
  eastRamp.rotation.z = -rampAngle;
  eastRamp.castShadow = true;
  eastRamp.receiveShadow = true;
  worldGroup.add(eastRamp);

  // Flyover Concrete Piers
  for (let px = 45; px <= 265; px += 35) {
    const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.15, 7.0, 12), flyoverMat);
    pier.position.set(px, 3.5, 260);
    pier.castShadow = true;
    worldGroup.add(pier);
  }
  // Flyover Side Guardrails
  [-5.9, 5.9].forEach((oz) => {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(240, 0.8, 0.35), flyoverMat);
    rail.position.set(150, 7.9, 260 + oz);
    worldGroup.add(rail);
  });

  // Namma Metro Elevated Viaduct along MG Road (z = -40, height 10.8m)
  const metroViaductMat = new THREE.MeshStandardMaterial({
    map: textures.metroConcrete,
    roughness: 0.72,
    metalness: 0.08,
  });
  const metroBeam = new THREE.Mesh(new THREE.BoxGeometry(960, 1.4, 7.2), metroViaductMat);
  metroBeam.position.set(0, 10.5, -40);
  metroBeam.castShadow = true;
  worldGroup.add(metroBeam);

  for (let mx = -460; mx <= 460; mx += 44) {
    // Skip exact intersection centers so cars pass freely underneath
    if ([-340, -170, 40, 230, 420].some((ix) => Math.abs(mx - ix) < 15)) continue;
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.1, 10.0, 2.1), flyoverMat);
    pillar.position.set(mx, 5.0, -40);
    pillar.castShadow = true;
    worldGroup.add(pillar);
  }

  // MG Road Metro Station Canopy
  const stationShell = new THREE.Mesh(
    new THREE.BoxGeometry(48, 4.2, 11.5),
    new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.6 })
  );
  stationShell.position.set(40, 13.0, -40);
  worldGroup.add(stationShell);
  const stationRoof = new THREE.Mesh(
    new THREE.BoxGeometry(52, 0.5, 13.5),
    new THREE.MeshStandardMaterial({ color: 0x7e22ce, roughness: 0.3, metalness: 0.5 })
  );
  stationRoof.position.set(40, 15.2, -40);
  worldGroup.add(stationRoof);

  // Namma Metro Purple Line Train
  const metroTrain = createMetroTrain();
  metroTrain.position.set(-200, 11.2, -40);
  worldGroup.add(metroTrain);

  // Iconic Landmark 1: Vidhana Soudha (x = -230, z = -155)
  const vidhanaGroup = new THREE.Group();
  vidhanaGroup.position.set(-230, 0, -155);
  const vidMat = new THREE.MeshStandardMaterial({
    map: textures.vidhanaGranite,
    roughness: 0.78,
    metalness: 0.08,
  });
  const vidSteps = new THREE.Mesh(
    new THREE.BoxGeometry(74, 2.4, 42),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 0.8 })
  );
  vidSteps.position.y = 1.2;
  vidhanaGroup.add(vidSteps);

  const vidBase = new THREE.Mesh(new THREE.BoxGeometry(66, 14, 34), vidMat);
  vidBase.position.y = 9.4;
  vidBase.castShadow = true;
  vidBase.receiveShadow = true;
  vidhanaGroup.add(vidBase);

  const domeMat = new THREE.MeshStandardMaterial({
    color: 0xd97706,
    roughness: 0.42,
    metalness: 0.45,
  });
  const centralDome = new THREE.Mesh(new THREE.SphereGeometry(7.2, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.6), domeMat);
  centralDome.position.y = 16.4;
  vidhanaGroup.add(centralDome);

  const finial = new THREE.Mesh(new THREE.ConeGeometry(0.9, 4.5, 10), domeMat);
  finial.position.y = 25.0;
  vidhanaGroup.add(finial);

  [
    [-26, -12],
    [26, -12],
    [-26, 12],
    [26, 12],
  ].forEach(([dx, dz]) => {
    const cornerDome = new THREE.Mesh(new THREE.SphereGeometry(3.4, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.6), domeMat);
    cornerDome.position.set(dx, 16.4, dz);
    vidhanaGroup.add(cornerDome);
  });
  worldGroup.add(vidhanaGroup);
  colliders.push({ minX: -264, maxX: -196, minZ: -174, maxZ: -136, height: 18 });

  // Iconic Landmark 2: Lalbagh Glass House (x = -145, z = 270)
  const glassHouseGroup = new THREE.Group();
  glassHouseGroup.position.set(-145, 0, 270);
  const ironMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.35, metalness: 0.7 });
  const conservatoryGlass = new THREE.MeshPhysicalMaterial({
    color: 0xbae6fd,
    roughness: 0.12,
    metalness: 0.1,
    clearcoat: 1,
    transparent: true,
    opacity: 0.62,
  });
  const ghBase = new THREE.Mesh(new THREE.BoxGeometry(28, 6, 18), conservatoryGlass);
  ghBase.position.y = 3;
  const ghRoof = new THREE.Mesh(
    new THREE.CylinderGeometry(8.8, 8.8, 28, 16, 1, false, 0, Math.PI),
    conservatoryGlass
  );
  ghRoof.rotation.z = Math.PI / 2;
  ghRoof.position.y = 6;
  const ghRib = new THREE.Mesh(new THREE.BoxGeometry(28.4, 0.7, 18.4), ironMat);
  ghRib.position.y = 6;
  glassHouseGroup.add(ghBase, ghRoof, ghRib);
  worldGroup.add(glassHouseGroup);
  colliders.push({ minX: -159, maxX: -131, minZ: 261, maxZ: 279, height: 14 });

  // Swimmable Lakes (Cubbon Park Lotus Pond & Lalbagh Lake)
  const waterMeshes: THREE.Mesh[] = [];
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x0284c7,
    roughness: 0.12,
    metalness: 0.15,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.84,
  });
  WATER_ZONES.forEach((wz) => {
    const geo = new THREE.CircleGeometry(1, 32);
    geo.rotateX(-Math.PI / 2);
    geo.scale(wz.rx, 1, wz.rz);
    const lake = new THREE.Mesh(geo, waterMat);
    lake.position.set(wz.x, 0.08, wz.z);
    worldGroup.add(lake);
    waterMeshes.push(lake);
  });

  // Procedural City Buildings Across Bengaluru Districts
  const comMat = new THREE.MeshStandardMaterial({ map: textures.commercialFacade, roughness: 0.6, metalness: 0.15 });
  const itMat = new THREE.MeshStandardMaterial({ map: textures.itGlassFacade, roughness: 0.22, metalness: 0.75 });
  const resMat = new THREE.MeshStandardMaterial({ map: textures.residentialFacade, roughness: 0.78, metalness: 0.05 });
  const mktMat = new THREE.MeshStandardMaterial({ map: textures.marketAwning, roughness: 0.85, metalness: 0.02 });
  windowEmissiveMaterials.push(comMat, itMat);

  // MG Road & Brigade Road Commercial Blocks
  const commercialBlocks: Array<[number, number, number, number, number]> = [
    [-25, -75, 26, 22, 22],
    [15, -75, 24, 28, 22],
    [78, -75, 30, 26, 24],
    [118, -75, 22, 18, 22],
    [-12, 25, 24, 20, 26],
    [82, 25, 26, 24, 22],
    [85, 72, 24, 18, 24],
    [-8, 72, 22, 16, 20],
  ];
  commercialBlocks.forEach(([x, z, w, h, d]) => addBoxBuilding(worldGroup, colliders, x, z, w, h, d, comMat));

  // Electronic City & Whitefield IT Tech Parks
  const itTowers: Array<[number, number, number, number, number]> = [
    [380, -135, 32, 42, 28],
    [455, -130, 30, 52, 28],
    [385, -245, 28, 38, 28],
    [465, -245, 34, 48, 30],
    [190, 385, 28, 36, 26],
    [275, 385, 32, 46, 28],
    [280, 475, 36, 40, 28],
    [385, 385, 30, 34, 28],
    [465, 385, 28, 44, 26],
  ];
  itTowers.forEach(([x, z, w, h, d]) => addBoxBuilding(worldGroup, colliders, x, z, w, h, d, itMat, 0x0f172a));

  // Indiranagar & Koramangala Apartments & Villas
  const residentialBlocks: Array<[number, number, number, number, number]> = [
    [195, -150, 22, 11, 20], // Safehouse building
    [275, -155, 24, 16, 22],
    [275, -75, 26, 10, 24], // Garage bay building
    [185, -80, 22, 14, 20],
    [180, 160, 24, 12, 22], // Koramangala mod bay
    [275, 160, 26, 20, 24],
    [175, 75, 24, 16, 20],
    [275, 75, 24, 18, 22],
    [95, 165, 24, 15, 20],
    [-85, -145, 24, 18, 22],
  ];
  residentialBlocks.forEach(([x, z, w, h, d]) => addBoxBuilding(worldGroup, colliders, x, z, w, h, d, resMat, 0x78350f));

  // KR Market Colorful Stalls & Majestic Bus Stand Shelters
  for (let i = 0; i < 6; i++) {
    const sx = -385 + (i % 3) * 28;
    const sz = 75 + Math.floor(i / 3) * 65;
    addBoxBuilding(worldGroup, colliders, sx, sz, 18, 5.5, 14, mktMat, 0xea580c);
  }
  // Majestic Bus Terminal Bays
  for (let b = 0; b < 3; b++) {
    const bx = -380 + b * 24;
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(16, 0.8, 36),
      new THREE.MeshStandardMaterial({ color: 0x2563eb, roughness: 0.45, metalness: 0.4 })
    );
    canopy.position.set(bx, 5.2, -110);
    canopy.castShadow = true;
    worldGroup.add(canopy);
    [-14, 14].forEach((oz) => {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 5.2, 8), flyoverMat);
      post.position.set(bx, 2.6, -110 + oz);
      worldGroup.add(post);
    });
  }

  // Working 3-Color Traffic Signals at Major Intersections
  const trafficSignals: TrafficSignalObj[] = [];
  const signalIntersections: Array<[number, number]> = [
    [40, -40],
    [40, 110],
    [40, 260],
    [230, -40],
    [230, 110],
    [-170, 110],
    [-340, 110],
  ];
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
  signalIntersections.forEach(([ix, iz]) => {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.2, 8), poleMat);
    post.position.set(ix + 11.5, 3.1, iz + 11.5);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.8, 1.1), poleMat);
    box.position.set(ix + 11.5, 6.2, iz + 11.5);
    worldGroup.add(post, box);

    const makeBulb = (col: number, ox: number, oy: number, oz: number) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.2 })
      );
      m.position.set(ix + 11.5 + ox, 6.2 + oy, iz + 11.5 + oz);
      worldGroup.add(m);
      return m;
    };
    trafficSignals.push({
      x: ix,
      z: iz,
      nsRed: makeBulb(0xef4444, 0, 0.45, -0.55),
      nsGreen: makeBulb(0x22c55e, 0, -0.45, -0.55),
      ewRed: makeBulb(0xef4444, -0.55, 0.45, 0),
      ewGreen: makeBulb(0x22c55e, -0.55, -0.45, 0),
    });
  });

  // Instanced Bengaluru Rain Trees (Cubbon Park, Lalbagh, Indiranagar, Perimeter Groves)
  const treeSpots: Array<[number, number]> = [];
  // Cubbon Park grove
  for (let i = 0; i < 55; i++) {
    const tx = -150 + Math.cos(i * 2.1) * (25 + (i % 7) * 11);
    const tz = -5 + Math.sin(i * 1.7) * (22 + (i % 6) * 12);
    if (Math.hypot(tx - -105, tz - 32) > 36) treeSpots.push([tx, tz]);
  }
  // Lalbagh grove
  for (let i = 0; i < 45; i++) {
    const tx = -195 + Math.cos(i * 1.9) * (24 + (i % 6) * 14);
    const tz = 260 + Math.sin(i * 2.3) * (24 + (i % 5) * 14);
    if (Math.hypot(tx - -245, tz - 315) > 54 && Math.hypot(tx - -145, tz - 270) > 26) treeSpots.push([tx, tz]);
  }
  // Avenue trees along Indiranagar & MG Road & Outer Perimeter
  for (let a = -460; a <= 460; a += 38) {
    if (Math.abs(a - 40) > 18 && Math.abs(a - 230) > 18 && Math.abs(a - -170) > 18 && Math.abs(a - -340) > 18) {
      treeSpots.push([a, -53]);
      treeSpots.push([a, -27]);
      treeSpots.push([a, -186]);
    }
    // Natural outer ring foliage perimeter
    treeSpots.push([a, -WORLD_HALF_SIZE + 24]);
    treeSpots.push([a, WORLD_HALF_SIZE - 24]);
    treeSpots.push([-WORLD_HALF_SIZE + 24, a]);
    treeSpots.push([WORLD_HALF_SIZE - 24, a]);
  }

  const trunkGeo = new THREE.CylinderGeometry(0.32, 0.5, 4.2, 8);
  trunkGeo.translate(0, 2.1, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });
  const canopyGeo = new THREE.DodecahedronGeometry(3.2, 1);
  canopyGeo.scale(1.25, 0.78, 1.25);
  canopyGeo.translate(0, 5.4, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.02 });

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeSpots.length);
  canopyInst.castShadow = true;

  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();
  treeSpots.forEach(([tx, tz], idx) => {
    const s = 0.85 + ((idx * 37) % 30) / 100;
    dummy.position.set(tx, 0, tz);
    dummy.rotation.set(0, idx * 0.9, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    canopyInst.setMatrixAt(idx, dummy.matrix);

    const shade = 0.72 + ((idx * 17) % 28) / 100;
    cColor.setRGB(0.16 * shade, 0.48 * shade, 0.18 * shade);
    canopyInst.setColorAt(idx, cColor);
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  worldGroup.add(trunkInst, canopyInst);

  // Instanced Streetlamps along Major Roads
  const lampSpots: Array<[number, number]> = [];
  for (let p = -440; p <= 440; p += 55) {
    lampSpots.push([p, -29]);
    lampSpots.push([p, 121]);
    lampSpots.push([p, 443]);
    lampSpots.push([51, p]);
    lampSpots.push([241, p]);
  }
  const lampPoleGeo = new THREE.CylinderGeometry(0.1, 0.14, 6.8, 6);
  lampPoleGeo.translate(0, 3.4, 0);
  const lampBulbGeo = new THREE.SphereGeometry(0.32, 8, 8);
  lampBulbGeo.translate(0, 6.9, 0);
  const streetLampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.1,
    roughness: 0.2,
  });
  const lampPoles = new THREE.InstancedMesh(lampPoleGeo, poleMat, lampSpots.length);
  const lampBulbs = new THREE.InstancedMesh(lampBulbGeo, streetLampBulbMat, lampSpots.length);
  lampSpots.forEach(([lx, lz], i) => {
    dummy.position.set(lx, 0, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPoles.setMatrixAt(i, dummy.matrix);
    lampBulbs.setMatrixAt(i, dummy.matrix);
  });
  lampPoles.computeBoundingSphere();
  lampBulbs.computeBoundingSphere();
  worldGroup.add(lampPoles, lampBulbs);

  // Landmark Service Rings (Garage, Safehouse, Shop, Petrol)
  LANDMARK_MARKERS.forEach((lm) => {
    if (lm.type === 'landmark') return;
    const color =
      lm.type === 'garage' ? 0x06b6d4 : lm.type === 'safehouse' ? 0x22c55e : lm.type === 'petrol' ? 0xf59e0b : 0xec4899;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.6, 3.2, 28),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(lm.x, 0.08, lm.z);
    worldGroup.add(ring);
  });

  // 12 Heritage Collectibles (Rotating Golden Filter-Kaapi / Heritage Tokens)
  const collectibleMeshes = new Map<string, THREE.Group>();
  const tokenMat = new THREE.MeshPhysicalMaterial({
    color: 0xfacc15,
    emissive: 0xd97706,
    emissiveIntensity: 0.5,
    metalness: 0.9,
    roughness: 0.15,
    clearcoat: 1,
  });
  COLLECTIBLES.forEach((col) => {
    const g = new THREE.Group();
    const disc = new THREE.Mesh(new THREE.OctahedronGeometry(0.7, 0), tokenMat);
    disc.position.y = 1.4;
    const halo = new THREE.Mesh(
      new THREE.RingGeometry(0.95, 1.15, 20),
      new THREE.MeshBasicMaterial({ color: 0xfef08a, side: THREE.DoubleSide, transparent: true, opacity: 0.7 })
    );
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.09;
    g.add(disc, halo);
    g.position.set(col.x, 0, col.z);
    worldGroup.add(g);
    collectibleMeshes.set(col.id, g);
  });

  // Active Mission Waypoint Beacon (Tall translucent cylinder + floor ring)
  const missionBeacon = new THREE.Group();
  const beaconBeam = new THREE.Mesh(
    new THREE.CylinderGeometry(1.6, 1.6, 36, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.25,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beaconBeam.position.y = 18;
  const beaconRing = new THREE.Mesh(
    new THREE.RingGeometry(2.5, 3.4, 28),
    new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide })
  );
  beaconRing.rotation.x = -Math.PI / 2;
  beaconRing.position.y = 0.12;
  missionBeacon.add(beaconBeam, beaconRing);
  missionBeacon.visible = false;
  worldGroup.add(missionBeacon);

  // Monsoon 3D Rain Particle System
  const rainCount = 1600;
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 140;
    rainPositions[i * 3 + 1] = Math.random() * 45;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 140;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({
    color: 0xcbd5e1,
    size: 0.38,
    transparent: true,
    opacity: 0.65,
  });
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rainPoints.visible = false;
  rainPoints.frustumCulled = false;
  scene.add(rainPoints);

  const skyColor = new THREE.Color();
  const daySky = new THREE.Color(0x7cc4fa);
  const sunsetSky = new THREE.Color(0xf97316);
  const nightSky = new THREE.Color(0x0b132b);
  const rainSky = new THREE.Color(0x475569);

  const updateAtmosphere = (
    timeHours: number,
    weather: WeatherMode,
    playerX: number,
    playerZ: number,
    elapsed: number,
    dt: number
  ) => {
    // Sun arc (6:00 sunrise -> 12:00 noon -> 18:30 sunset -> night)
    const isNight = timeHours < 6 || timeHours >= 19;
    const isGolden = (timeHours >= 6 && timeHours < 8.5) || (timeHours >= 16.8 && timeHours < 19);

    if (isNight) {
      skyColor.copy(nightSky);
      sunLight.intensity = 0.35;
      sunLight.color.setHex(0x93c5fd);
      hemiLight.intensity = 0.42;
      streetLampBulbMat.emissiveIntensity = 2.2;
      windowEmissiveMaterials.forEach((m) => (m.emissiveIntensity = 0.65));
    } else if (isGolden) {
      skyColor.copy(sunsetSky).lerp(daySky, 0.35);
      sunLight.intensity = 1.65;
      sunLight.color.setHex(0xfdba74);
      hemiLight.intensity = 0.72;
      streetLampBulbMat.emissiveIntensity = 1.1;
      windowEmissiveMaterials.forEach((m) => (m.emissiveIntensity = 0.35));
    } else {
      skyColor.copy(daySky);
      sunLight.intensity = 1.9;
      sunLight.color.setHex(0xfff5e0);
      hemiLight.intensity = 0.85;
      streetLampBulbMat.emissiveIntensity = 0.05;
      windowEmissiveMaterials.forEach((m) => (m.emissiveIntensity = 0.05));
    }

    if (weather === 'monsoon') {
      skyColor.lerp(rainSky, 0.72);
      sunLight.intensity *= 0.55;
      roadMaterial.roughness = 0.22; // Wet reflective monsoon asphalt!
      roadMaterial.metalness = 0.35;
      rainPoints.visible = true;
      rainPoints.position.set(playerX, 0, playerZ);
      for (let i = 0; i < rainCount; i++) {
        rainPositions[i * 3 + 1] -= dt * 42;
        if (rainPositions[i * 3 + 1] < 0) {
          rainPositions[i * 3 + 1] = 42;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;
    } else if (weather === 'overcast') {
      skyColor.lerp(rainSky, 0.42);
      sunLight.intensity *= 0.75;
      roadMaterial.roughness = 0.62;
      roadMaterial.metalness = 0.1;
      rainPoints.visible = false;
    } else {
      roadMaterial.roughness = 0.72;
      roadMaterial.metalness = 0.08;
      rainPoints.visible = false;
    }

    scene.background = skyColor;
    if (!scene.fog || !(scene.fog instanceof THREE.FogExp2)) {
      scene.fog = new THREE.FogExp2(skyColor.getHex(), weather === 'monsoon' ? 0.0036 : 0.0022);
    } else {
      scene.fog.color.copy(skyColor);
      scene.fog.density = weather === 'monsoon' ? 0.0036 : isNight ? 0.0028 : 0.002;
    }

    // Move shadow frustum centered near player so shadows stay crisp across the entire 1200m city
    const sunAngle = ((timeHours - 6) / 12) * Math.PI;
    const sunY = isNight ? 95 : Math.max(35, Math.sin(sunAngle) * 145);
    const sunX = isNight ? -80 : Math.cos(sunAngle) * 120;
    sunLight.position.set(playerX + sunX, sunY, playerZ + 70);
    sunLight.target.position.set(playerX, 0, playerZ);
    sunLight.target.updateMatrixWorld();

    // Animate Namma Metro Purple Line train back & forth along MG Road viaduct
    const metroCycle = ((elapsed * 26) % 1040) - 520;
    metroTrain.position.x = metroCycle;
    metroTrain.rotation.y = 0;

    // Spin & bob collectibles
    collectibleMeshes.forEach((g) => {
      if (g.visible) {
        g.children[0].rotation.y = elapsed * 2.2;
        g.children[0].position.y = 1.45 + Math.sin(elapsed * 3.1) * 0.25;
      }
    });
  };

  return {
    colliders,
    metroTrain,
    collectibleMeshes,
    missionBeacon,
    trafficSignals,
    rainPoints,
    rainPositions,
    sunLight,
    hemiLight,
    roadMaterial,
    streetLampBulbMat,
    windowEmissiveMaterials,
    waterMeshes,
    updateAtmosphere,
  };
}
