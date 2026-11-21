import * as THREE from 'three';
import { WorldPartitionManager } from './GeoJsonWorldPartition';
import {
  COLLECTIBLES,
  DISTRICTS,
  LANDMARK_MARKERS,
  ROAD_SEGMENTS,
  SILK_BOARD_FLYOVER_LOOP,
  WATER_ZONES,
  WORLD_HALF_SIZE,
  getDistrictCenter,
  getGradedTerrainY,
  isPointInWater,
  isPointOnRoad,
} from './bengaluruData';
import { createMetroTrain } from './entities';
import { buildBengaluruLandmarksAndStations } from './landmarks';
import {
  RoadJunction,
  detectSurfaceRoadJunctions,
  getSampledRoadSpine,
  getSilkBoardFlyoverSpine,
  queryNearestCurvedRoad,
} from './roadGeometry';
import { TextureBundle } from './textures';
import { BuildingCollider, MetroLineId, RoadSegment, WeatherMode } from './types';

export interface TrafficSignalObj {
  x: number;
  z: number;
  nsRed: THREE.Mesh;
  nsYellow: THREE.Mesh;
  nsGreen: THREE.Mesh;
  ewRed: THREE.Mesh;
  ewYellow: THREE.Mesh;
  ewGreen: THREE.Mesh;
}

export interface WorldHandles {
  colliders: BuildingCollider[];
  partition: WorldPartitionManager;
  metroTrainPurple: THREE.Group;
  metroTrainGreen: THREE.Group;
  metroTrainYellow: THREE.Group;
  collectibleMeshes: Map<string, THREE.Group>;
  missionBeacon: THREE.Group;
  navigationLine: THREE.Line;
  trafficSignals: TrafficSignalObj[];
  rainPoints: THREE.Points;
  rainPositions: Float32Array;
  dustPoints: THREE.Points;
  puddles: THREE.Mesh[];
  puddleMat: THREE.MeshPhysicalMaterial;
  sunLight: THREE.DirectionalLight;
  hemiLight: THREE.HemisphereLight;
  roadMaterial: THREE.MeshStandardMaterial;
  streetLampBulbMat: THREE.MeshStandardMaterial;
  windowEmissiveMaterials: THREE.MeshStandardMaterial[];
  waterMeshes: THREE.Mesh[];
  rebuildCustomRoads: (extraRoads: RoadSegment[]) => void;
  updateAtmosphere: (
    timeHours: number,
    weather: WeatherMode,
    playerX: number,
    playerZ: number,
    elapsed: number,
    dt: number,
    onThunder?: () => void,
    inPocket?: boolean
  ) => void;
}

const _foundationMat = new THREE.MeshStandardMaterial({ color: 0x3f4752, roughness: 0.88, metalness: 0.08 });
const _apronMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 0.85, metalness: 0.04 });

function addDetailedBuilding(
  parent: THREE.Group,
  colliders: BuildingCollider[],
  x: number,
  z: number,
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  roofColor = 0x334155,
  style: 'commercial' | 'it_tower' | 'residential' | 'market' = 'commercial',
  accentColor = 0xd97706,
  rotationY = 0
): THREE.Group {
  const cos = Math.cos(rotationY);
  const sin = Math.sin(rotationY);
  const hw = w * 0.5;
  const hd = d * 0.5;
  const cornerSamples = [
    getGradedTerrainY(x, z),
    getGradedTerrainY(x + hw * cos - hd * sin, z + hw * sin + hd * cos),
    getGradedTerrainY(x - hw * cos - hd * sin, z - hw * sin + hd * cos),
    getGradedTerrainY(x + hw * cos + hd * sin, z + hw * sin - hd * cos),
    getGradedTerrainY(x - hw * cos + hd * sin, z - hw * sin - hd * cos),
  ];
  const minCornerY = Math.min(...cornerSamples);
  const maxCornerY = Math.max(...cornerSamples);
  const groundY = maxCornerY;

  const bGroup = new THREE.Group();
  bGroup.position.set(x, groundY, z);
  bGroup.rotation.y = rotationY;

  // Solid granite foundation plinth extending underground so no building corner ever floats on slopes
  const skirtH = Math.max(0.95, maxCornerY - minCornerY + 1.0);
  const foundationSkirt = new THREE.Mesh(
    new THREE.BoxGeometry(w + 0.4, skirtH, d + 0.4),
    _foundationMat
  );
  foundationSkirt.position.y = -skirtH * 0.5 + 0.06;
  foundationSkirt.receiveShadow = true;
  bGroup.add(foundationSkirt);

  // Paved sidewalk entry apron in front (+Z local)
  const entryApron = new THREE.Mesh(
    new THREE.BoxGeometry(Math.min(w, 8.5), 0.24, 2.4),
    _apronMat
  );
  entryApron.position.set(0, 0.02, hd + 1.1);
  entryApron.receiveShadow = true;
  bGroup.add(entryApron);

  const trimMat = new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.65, metalness: 0.18 });
  const canopyMat = new THREE.MeshStandardMaterial({ color: accentColor, roughness: 0.55 });
  const tankMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.5, metalness: 0.3 });

  if (style === 'it_tower') {
    const podiumH = Math.min(8, h * 0.24);
    const podium = new THREE.Mesh(new THREE.BoxGeometry(w, podiumH, d), trimMat);
    podium.position.y = podiumH * 0.5;
    podium.castShadow = true;
    podium.receiveShadow = true;

    const midH = (h - podiumH) * 0.68;
    const midTower = new THREE.Mesh(new THREE.BoxGeometry(w * 0.88, midH, d * 0.86), mat);
    midTower.position.y = podiumH + midH * 0.5;
    midTower.castShadow = true;
    midTower.receiveShadow = true;

    const topH = (h - podiumH) * 0.32;
    const topCrown = new THREE.Mesh(new THREE.BoxGeometry(w * 0.72, topH, d * 0.72), mat);
    topCrown.position.y = podiumH + midH + topH * 0.5;
    topCrown.castShadow = true;

    const roofFrame = new THREE.Mesh(new THREE.BoxGeometry(w * 0.76, 0.8, d * 0.76), trimMat);
    roofFrame.position.y = h + 0.4;
    const hvac = new THREE.Mesh(new THREE.BoxGeometry(w * 0.32, 1.8, d * 0.28), tankMat);
    hvac.position.set(-w * 0.14, h + 1.5, 0);
    const helipad = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.18, w * 0.18, 0.2, 16), canopyMat);
    helipad.position.set(w * 0.16, h + 0.85, 0);
    bGroup.add(podium, midTower, topCrown, roofFrame, hvac, helipad);
  } else if (style === 'market') {
    const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    base.position.y = h * 0.5;
    base.castShadow = true;
    base.receiveShadow = true;
    const awning = new THREE.Mesh(new THREE.BoxGeometry(w + 1.6, 0.32, d + 1.6), canopyMat);
    awning.position.y = h + 0.16;
    bGroup.add(base, awning);
  } else {
    const plinthH = Math.min(4.2, h * 0.28);
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(w, plinthH, d), trimMat);
    plinth.position.y = plinthH * 0.5;
    plinth.castShadow = true;
    plinth.receiveShadow = true;

    const overhang = new THREE.Mesh(new THREE.BoxGeometry(w + 1.1, 0.28, d + 1.1), canopyMat);
    overhang.position.y = plinthH + 0.12;

    const upperH = Math.max(2.5, h - plinthH);
    const upper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.94, upperH, d * 0.94), mat);
    upper.position.y = plinthH + upperH * 0.5;
    upper.castShadow = true;
    upper.receiveShadow = true;

    const parapet = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, 0.72, d * 0.98), trimMat);
    parapet.position.y = h + 0.36;

    const balcony = new THREE.Mesh(new THREE.BoxGeometry(w * 0.45, 0.45, 1.35), trimMat);
    balcony.position.set(0, plinthH + upperH * 0.48, d * 0.49);

    const waterTank = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 1.9, 10), tankMat);
    waterTank.position.set(w * 0.22, h + 1.3, -d * 0.18);

    bGroup.add(plinth, overhang, upper, parapet, balcony, waterTank);
  }

  parent.add(bGroup);

  const aabbHalfW = Math.abs(hw * cos) + Math.abs(hd * sin);
  const aabbHalfD = Math.abs(hw * sin) + Math.abs(hd * cos);
  colliders.push({
    minX: x - aabbHalfW,
    maxX: x + aabbHalfW,
    minZ: z - aabbHalfD,
    maxZ: z + aabbHalfD,
    height: groundY + h,
    cx: x,
    cz: z,
    halfW: hw,
    halfD: hd,
    rotationY,
  });
  return bGroup;
}

function buildStripGeometry(
  leftPts: Array<[number, number, number]>,
  rightPts: Array<[number, number, number]>,
  uLeft: number,
  uRight: number,
  arcLens: number[],
  vScale: number,
  flipWinding = false
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (let i = 0; i < leftPts.length; i++) {
    positions.push(leftPts[i][0], leftPts[i][1], leftPts[i][2]);
    positions.push(rightPts[i][0], rightPts[i][1], rightPts[i][2]);
    const v = arcLens[i] / vScale;
    uvs.push(uLeft, v, uRight, v);
    if (i < leftPts.length - 1) {
      const b = i * 2;
      if (flipWinding) {
        indices.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
      } else {
        indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

function isInsideSurfaceJunction(x: number, z: number, junctions: RoadJunction[], extraPad = 0): boolean {
  for (let i = 0; i < junctions.length; i++) {
    const j = junctions[i];
    if (Math.hypot(x - j.x, z - j.z) <= j.radius + extraPad) return true;
  }
  return false;
}

function buildCurvedRoadCorridor(
  seg: RoadSegment,
  baseMat: THREE.Material,
  junctions: RoadJunction[],
  sidewalkMat: THREE.Material,
  curbMat: THREE.Material,
  medianMat: THREE.Material,
  parapetMat: THREE.Material
): THREE.Group {
  const group = new THREE.Group();
  const spine = getSampledRoadSpine(seg);
  const sampled = spine.points;
  const halfW = seg.width * 0.5;
  const isMetro = seg.kind === 'metro';
  const isFlyover = Boolean(seg.elevated && seg.kind === 'flyover');
  const isSurface = !isMetro && !seg.elevated;

  const deckPriorityOffset =
    seg.kind === 'highway' ? 0.072 : seg.kind === 'arterial' ? 0.064 : seg.kind === 'secondary' ? 0.056 : 0.085;

  const leftDeck: Array<[number, number, number]> = [];
  const rightDeck: Array<[number, number, number]> = [];
  const arcLens: number[] = [];

  for (let i = 0; i < sampled.length; i++) {
    const pt = sampled[i];
    let elev = pt.terrainY + deckPriorityOffset;
    if (isFlyover) {
      const ramp = pt.u < 0.14 ? pt.u / 0.14 : pt.u > 0.86 ? (1 - pt.u) / 0.14 : 1;
      elev = pt.terrainY + 0.085 + ramp * 6.8;
    } else if (isMetro) {
      elev = pt.terrainY + (seg.metroStatus === 'under_construction' ? 8.2 : 10.2);
    }
    leftDeck.push([pt.x + pt.nx * halfW, elev, pt.z + pt.nz * halfW]);
    rightDeck.push([pt.x - pt.nx * halfW, elev, pt.z - pt.nz * halfW]);
    arcLens.push(pt.arcLen);
  }

  const deckGeo = buildStripGeometry(leftDeck, rightDeck, 0, 1, arcLens, 22);
  const deckMesh = new THREE.Mesh(deckGeo, baseMat);
  deckMesh.receiveShadow = true;
  if (seg.elevated) deckMesh.castShadow = true;
  group.add(deckMesh);

  // Surface roads get raised granite curbs, tiled sidewalks, and terrain-sealing outer skirts (suppressed at junctions)
  if (isSurface) {
    const curbW = 0.4;
    const swW = seg.kind === 'highway' ? 2.6 : seg.kind === 'arterial' ? 2.4 : 2.0;

    let runPts: Array<{
      x: number;
      z: number;
      nx: number;
      nz: number;
      elev: number;
      arcLen: number;
    }> = [];

    const flushSideRun = () => {
      if (runPts.length < 2) {
        runPts = [];
        return;
      }
      const rArc = runPts.map((p) => p.arcLen);
      for (const side of [1, -1] as const) {
        const curbIn: Array<[number, number, number]> = [];
        const curbOut: Array<[number, number, number]> = [];
        const swIn: Array<[number, number, number]> = [];
        const swOut: Array<[number, number, number]> = [];
        const skirtOut: Array<[number, number, number]> = [];

        for (const p of runPts) {
          const sx = p.nx * side;
          const sz = p.nz * side;
          curbIn.push([p.x + sx * halfW, p.elev + 0.12, p.z + sz * halfW]);
          curbOut.push([p.x + sx * (halfW + curbW), p.elev + 0.12, p.z + sz * (halfW + curbW)]);
          swIn.push([p.x + sx * (halfW + curbW), p.elev + 0.1, p.z + sz * (halfW + curbW)]);
          swOut.push([p.x + sx * (halfW + swW), p.elev + 0.1, p.z + sz * (halfW + swW)]);
          skirtOut.push([p.x + sx * (halfW + swW + 1.15), p.elev - 0.65, p.z + sz * (halfW + swW + 1.15)]);
        }

        const flip = side < 0;
        const curbMesh = new THREE.Mesh(buildStripGeometry(curbIn, curbOut, 0, 0.25, rArc, 8, flip), curbMat);
        curbMesh.receiveShadow = true;
        const swMesh = new THREE.Mesh(buildStripGeometry(swIn, swOut, 0, 1, rArc, 6, flip), sidewalkMat);
        swMesh.receiveShadow = true;
        const skirtMesh = new THREE.Mesh(buildStripGeometry(swOut, skirtOut, 0, 0.5, rArc, 8, flip), curbMat);
        group.add(curbMesh, swMesh, skirtMesh);
      }

      // Divided highways also get a central raised concrete median (gapped cleanly at junctions)
      if (seg.kind === 'highway' && seg.width >= 19) {
        const medL: Array<[number, number, number]> = [];
        const medR: Array<[number, number, number]> = [];
        for (const p of runPts) {
          medL.push([p.x + p.nx * 0.42, p.elev + 0.19, p.z + p.nz * 0.42]);
          medR.push([p.x - p.nx * 0.42, p.elev + 0.19, p.z - p.nz * 0.42]);
        }
        const medMesh = new THREE.Mesh(buildStripGeometry(medL, medR, 0, 1, rArc, 10), medianMat);
        medMesh.receiveShadow = true;
        group.add(medMesh);
      }

      runPts = [];
    };

    for (let i = 0; i < sampled.length; i++) {
      const pt = sampled[i];
      if (isInsideSurfaceJunction(pt.x, pt.z, junctions, 0.6)) {
        flushSideRun();
      } else {
        runPts.push({
          x: pt.x,
          z: pt.z,
          nx: pt.nx,
          nz: pt.nz,
          elev: pt.terrainY + deckPriorityOffset,
          arcLen: pt.arcLen,
        });
      }
    }
    flushSideRun();
  }

  // Elevated flyover gets solid concrete box-girder underside thickness + Jersey crash parapets
  if (isFlyover) {
    for (const side of [1, -1] as const) {
      const railIn: Array<[number, number, number]> = [];
      const railOut: Array<[number, number, number]> = [];
      const wallBot: Array<[number, number, number]> = [];
      for (let i = 0; i < sampled.length; i++) {
        const pt = sampled[i];
        const ramp = pt.u < 0.14 ? pt.u / 0.14 : pt.u > 0.86 ? (1 - pt.u) / 0.14 : 1;
        const elev = pt.terrainY + 0.085 + ramp * 6.8;
        const railH = ramp > 0.05 ? 0.88 : 0.2;
        const sx = pt.nx * side;
        const sz = pt.nz * side;
        railIn.push([pt.x + sx * (halfW - 0.1), elev + railH, pt.z + sz * (halfW - 0.1)]);
        railOut.push([pt.x + sx * (halfW + 0.35), elev + railH, pt.z + sz * (halfW + 0.35)]);
        wallBot.push([pt.x + sx * (halfW + 0.35), elev - 1.15, pt.z + sz * (halfW + 0.35)]);
      }
      const flip = side < 0;
      const topRail = new THREE.Mesh(buildStripGeometry(railIn, railOut, 0, 1, arcLens, 10, flip), parapetMat);
      const outerWall = new THREE.Mesh(buildStripGeometry(railOut, wallBot, 0, 1, arcLens, 10, flip), parapetMat);
      topRail.castShadow = true;
      group.add(topRail, outerWall);
    }
  }

  return group;
}

function metroColorHex(line?: MetroLineId): number {
  switch (line) {
    case 'green':
      return 0x15803d;
    case 'yellow':
      return 0xca8a04;
    case 'pink':
      return 0xdb2777;
    case 'blue':
      return 0x2563eb;
    default:
      return 0x7e22ce;
  }
}

export function buildBengaluruWorld(
  scene: THREE.Scene,
  textures: TextureBundle
): WorldHandles {
  const worldGroup = new THREE.Group();
  scene.add(worldGroup);

  const partition = new WorldPartitionManager();
  partition.setImportCounts(ROAD_SEGMENTS.length, ROAD_SEGMENTS.length + WATER_ZONES.length);

  const colliders: BuildingCollider[] = [];
  const windowEmissiveMaterials: THREE.MeshStandardMaterial[] = [];

  // Lighting Rig (Deccan Sun + Sky/Ground Hemisphere)
  const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x3f4e3a, 0.78);
  hemiLight.position.set(0, 140, 0);
  scene.add(hemiLight);

  const sunLight = new THREE.DirectionalLight(0xfff1d6, 1.85);
  sunLight.position.set(110, 160, 80);
  sunLight.castShadow = true;
  sunLight.shadow.mapSize.width = 2048;
  sunLight.shadow.mapSize.height = 2048;
  const d = 150;
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

  // Graded Bengaluru Terrain Heightfield (224x224 = 24m grid + road corridor leveling + urban/park ground zoning)
  const terrainGeo = new THREE.PlaneGeometry(5400, 5400, 224, 224);
  terrainGeo.rotateX(-Math.PI / 2);
  const tPos = terrainGeo.attributes.position;
  const tColors = new Float32Array(tPos.count * 3);

  const cubCenter = getDistrictCenter('cubbon_park');
  const banCenter = getDistrictCenter('bannerghatta');
  const parkCol = new THREE.Color(0x3a6b35);
  const lakeBankCol = new THREE.Color(0x4b7043);
  const urbanEarthCol = new THREE.Color(0x63615b);
  const cbdPlazaCol = new THREE.Color(0x555961);
  const outskirtGreenCol = new THREE.Color(0x4b6b3e);
  const tmpCol = new THREE.Color();

  for (let i = 0; i < tPos.count; i++) {
    const x = tPos.getX(i);
    const z = tPos.getZ(i);
    tPos.setY(i, getGradedTerrainY(x, z));

    // Urban vs Park/Greenbelt zoning color
    const dCub = Math.hypot(x - cubCenter.x, z - cubCenter.z);
    const dLal = Math.hypot(x - -85, z - 185);
    const dBan = Math.hypot(x - banCenter.x, z - banCenter.z);
    const inPark = dCub < 115 || dLal < 120 || dBan < 210;

    let nearWater = false;
    for (let wIdx = 0; wIdx < WATER_ZONES.length; wIdx++) {
      const wz = WATER_ZONES[wIdx];
      const nr = Math.hypot((x - wz.x) / (wz.rx * 1.35), (z - wz.z) / (wz.rz * 1.35));
      if (nr < 1.0) {
        nearWater = true;
        break;
      }
    }

    let inUrbanDistrict = false;
    for (let dIdx = 0; dIdx < DISTRICTS.length; dIdx++) {
      const dist = DISTRICTS[dIdx];
      if (dist.id === 'cubbon_park' || dist.id === 'bannerghatta') continue;
      if (Math.hypot(x - dist.x, z - dist.z) < dist.radius * 1.35) {
        inUrbanDistrict = true;
        break;
      }
    }
    const nearRoadCorridor = !inPark && isPointOnRoad(x, z, 28);

    if (inPark) {
      tmpCol.copy(parkCol);
    } else if (nearWater) {
      tmpCol.copy(lakeBankCol);
    } else if (inUrbanDistrict) {
      tmpCol.copy(cbdPlazaCol);
    } else if (nearRoadCorridor) {
      tmpCol.copy(urbanEarthCol);
    } else {
      tmpCol.copy(outskirtGreenCol);
    }

    // Subtle organic spatial modulation
    const tintMod = 0.94 + Math.sin(x * 0.017 + z * 0.013) * 0.06;
    tColors[i * 3] = tmpCol.r * tintMod;
    tColors[i * 3 + 1] = tmpCol.g * tintMod;
    tColors[i * 3 + 2] = tmpCol.b * tintMod;
  }
  terrainGeo.setAttribute('color', new THREE.BufferAttribute(tColors, 3));
  terrainGeo.computeVertexNormals();
  const groundMat = new THREE.MeshStandardMaterial({
    map: textures.terrainDetail,
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.02,
  });
  const ground = new THREE.Mesh(terrainGeo, groundMat);
  ground.receiveShadow = true;
  worldGroup.add(ground);

  // Grounded urban district plinth pads (skirted below graded terrain, top cleanly underneath +0.056 roads)
  const urbanPadMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalk,
    roughness: 0.85,
    metalness: 0.04,
  });
  DISTRICTS.forEach((dist) => {
    if (dist.id === 'cubbon_park' || dist.id === 'jayanagar' || dist.id === 'bannerghatta') return;
    const padSize = Math.min(180, dist.radius * 1.35);
    const padY = getGradedTerrainY(dist.x, dist.z);
    const pad = new THREE.Mesh(new THREE.BoxGeometry(padSize, 0.72, padSize), urbanPadMat);
    pad.position.set(dist.x, padY - 0.345, dist.z);
    pad.receiveShadow = true;
    worldGroup.add(pad);
    partition.registerObject(dist.x, dist.z, pad, 'medium');
  });

  // Real Georeferenced GeoJSON Curved Road & 5-Line Namma Metro Network + Junction Aprons
  const surfaceJunctions = detectSurfaceRoadJunctions(ROAD_SEGMENTS);

  const roadMaterial = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.72,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const highwayRoadMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltHighway,
    roughness: 0.72,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const secondaryRoadMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltSecondary,
    roughness: 0.74,
    metalness: 0.06,
    side: THREE.DoubleSide,
  });
  const junctionRoadMat = new THREE.MeshStandardMaterial({
    map: textures.asphaltJunction,
    roughness: 0.72,
    metalness: 0.08,
  });
  const sidewalkSurfaceMat = new THREE.MeshStandardMaterial({
    map: textures.sidewalk,
    roughness: 0.86,
    metalness: 0.03,
  });
  const curbConcreteMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.82,
    metalness: 0.05,
  });
  const medianConcreteMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.76,
    metalness: 0.06,
  });
  const concreteViaductMat = new THREE.MeshStandardMaterial({
    color: 0x94a3b8,
    roughness: 0.76,
    metalness: 0.08,
    side: THREE.DoubleSide,
  });
  const flyoverMat = new THREE.MeshStandardMaterial({
    color: 0x64748b,
    roughness: 0.78,
    metalness: 0.08,
  });
  const railSteelMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.25, metalness: 0.88 });

  const renderRoadList = (list: RoadSegment[], targetGroup: THREE.Group) => {
    list.forEach((seg) => {
      if (seg.points.length < 2) return;
      if (seg.kind === 'metro') {
        const isUnderConst = seg.metroStatus === 'under_construction';
        const colHex = metroColorHex(seg.metroLine);
        const lineTrimMat = new THREE.MeshStandardMaterial({
          color: colHex,
          roughness: 0.42,
          metalness: 0.18,
          transparent: isUnderConst,
          opacity: isUnderConst ? 0.55 : 1,
        });

        const deckMat = isUnderConst
          ? new THREE.MeshStandardMaterial({
              color: 0x64748b,
              roughness: 0.78,
              transparent: true,
              opacity: 0.72,
              side: THREE.DoubleSide,
            })
          : concreteViaductMat;
        targetGroup.add(
          buildCurvedRoadCorridor(
            seg,
            deckMat,
            surfaceJunctions,
            sidewalkSurfaceMat,
            curbConcreteMat,
            medianConcreteMat,
            flyoverMat
          )
        );

        const curve = new THREE.CatmullRomCurve3(
          seg.points.map((p) => new THREE.Vector3(p.x, getGradedTerrainY(p.x, p.z), p.z))
        );
        const elevH = isUnderConst ? 8.2 : 10.2;
        const count = Math.max(8, Math.floor(curve.getLength() / 62));
        for (let i = 0; i <= count; i++) {
          const u = i / count;
          const pt = curve.getPointAt(u);
          const tan = curve.getTangentAt(u);
          const yaw = Math.atan2(tan.x, tan.z);

          const pierGroup = new THREE.Group();
          pierGroup.position.set(pt.x, pt.y, pt.z);
          pierGroup.rotation.y = yaw;
          const colMesh = new THREE.Mesh(
            new THREE.CylinderGeometry(0.95, 1.15, elevH, 10),
            isUnderConst ? new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.7 }) : flyoverMat
          );
          colMesh.position.y = elevH * 0.5;
          const capMesh = new THREE.Mesh(new THREE.BoxGeometry(seg.width + 0.8, 0.9, 2.2), concreteViaductMat);
          capMesh.position.y = elevH - 0.35;
          const trimMesh = new THREE.Mesh(new THREE.BoxGeometry(seg.width + 0.92, 0.36, 2.26), lineTrimMat);
          trimMesh.position.y = elevH + 0.15;
          pierGroup.add(colMesh, capMesh, trimMesh);
          targetGroup.add(pierGroup);
          partition.registerObject(pt.x, pt.z, pierGroup, 'medium');
        }

        if (!isUnderConst) {
          const railPtsL: THREE.Vector3[] = [];
          const railPtsR: THREE.Vector3[] = [];
          const steps = Math.max(24, Math.floor(curve.getLength() / 16));
          for (let s = 0; s <= steps; s++) {
            const u = s / steps;
            const pt = curve.getPointAt(u);
            const tan = curve.getTangentAt(u);
            const nx = -tan.z;
            const nz = tan.x;
            const nLen = Math.hypot(nx, nz) || 1;
            railPtsL.push(new THREE.Vector3(pt.x + (nx / nLen) * 1.1, pt.y + elevH + 0.16, pt.z + (nz / nLen) * 1.1));
            railPtsR.push(new THREE.Vector3(pt.x - (nx / nLen) * 1.1, pt.y + elevH + 0.16, pt.z - (nz / nLen) * 1.1));
          }
          const railLineMat = new THREE.LineBasicMaterial({ color: 0xe2e8f0 });
          targetGroup.add(
            new THREE.Line(new THREE.BufferGeometry().setFromPoints(railPtsL), railLineMat),
            new THREE.Line(new THREE.BufferGeometry().setFromPoints(railPtsR), railLineMat)
          );
          void railSteelMat;
        }
      } else {
        const chosenMat =
          seg.kind === 'highway'
            ? highwayRoadMat
            : seg.kind === 'secondary'
            ? secondaryRoadMat
            : roadMaterial;
        targetGroup.add(
          buildCurvedRoadCorridor(
            seg,
            chosenMat,
            surfaceJunctions,
            sidewalkSurfaceMat,
            curbConcreteMat,
            medianConcreteMat,
            flyoverMat
          )
        );
        if (seg.elevated && seg.kind === 'flyover') {
          const spine = getSampledRoadSpine(seg);
          const step = Math.max(1, Math.floor(spine.points.length / 16));
          for (let i = step; i < spine.points.length - step; i += step) {
            const pt = spine.points[i];
            const ramp = pt.u < 0.14 ? pt.u / 0.14 : pt.u > 0.86 ? (1 - pt.u) / 0.14 : 1;
            const h = Math.max(0.5, ramp * 6.8);
            const pier = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.15, h, 10), flyoverMat);
            pier.position.set(pt.x, pt.terrainY + h * 0.5, pt.z);
            const cap = new THREE.Mesh(new THREE.BoxGeometry(seg.width * 0.92, 0.7, 2.0), concreteViaductMat);
            cap.position.set(pt.x, pt.terrainY + h - 0.35, pt.z);
            cap.rotation.y = Math.atan2(pt.tx, pt.tz);
            targetGroup.add(pier, cap);
            partition.registerObject(pt.x, pt.z, pier, 'medium');
          }
        }
      }
    });
  };

  renderRoadList(ROAD_SEGMENTS, worldGroup);

  // Clean Intersection Aprons + Road-Aligned Crosswalks & Stop Lines across all detected junctions
  const stopLineMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.6 });
  const zebraMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.65 });
  const islandMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 });

  surfaceJunctions.forEach((j) => {
    const jY = getGradedTerrainY(j.x, j.z);
    // Solid cylindrical intersection apron sitting cleanly above all incoming road decks (y = jY + 0.080)
    const apron = new THREE.Mesh(
      new THREE.CylinderGeometry(j.radius, j.radius + 0.7, 0.32, 20),
      junctionRoadMat
    );
    apron.position.set(j.x, jY + 0.08 - 0.16, j.z);
    apron.receiveShadow = true;
    worldGroup.add(apron);

    // Painted central yellow junction ring for large multi-arm hubs
    if (j.arms.length >= 4) {
      const centerRing = new THREE.Mesh(
        new THREE.RingGeometry(2.6, 3.1, 20),
        new THREE.MeshBasicMaterial({ color: 0xfacc15, side: THREE.DoubleSide })
      );
      centerRing.rotation.x = -Math.PI / 2;
      centerRing.position.set(j.x, jY + 0.092, j.z);
      worldGroup.add(centerRing);
      const centerDot = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.16, 12), islandMat);
      centerDot.position.set(j.x, jY + 0.08, j.z);
      worldGroup.add(centerDot);
    }

    // Road-aligned zebra crosswalks & stop lines on every incoming junction arm
    j.arms.forEach((arm) => {
      const yaw = Math.atan2(arm.dirX, arm.dirZ);
      const nx = -arm.dirZ;
      const nz = arm.dirX;
      const crossDist = j.radius + 0.6;
      const cx = j.x + arm.dirX * crossDist;
      const cz = j.z + arm.dirZ * crossDist;
      const cY = getGradedTerrainY(cx, cz) + 0.092;

      // Stop bar aligned perpendicular to arm direction
      const stopW = Math.min(arm.halfW * 0.85, 7.5);
      const stopBar = new THREE.Mesh(new THREE.PlaneGeometry(stopW, 0.55), stopLineMat);
      stopBar.rotation.order = 'YXZ';
      stopBar.rotation.y = yaw;
      stopBar.rotation.x = -Math.PI / 2;
      stopBar.position.set(
        j.x + arm.dirX * (crossDist + 2.7) + nx * (arm.halfW * 0.42),
        cY,
        j.z + arm.dirZ * (crossDist + 2.7) + nz * (arm.halfW * 0.42)
      );
      worldGroup.add(stopBar);

      // Zebra crosswalk stripes spanning incoming road width
      const stripeCount = Math.max(3, Math.floor(arm.halfW / 1.8));
      for (let s = -stripeCount; s <= stripeCount; s++) {
        const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 3.2), zebraMat);
        stripe.rotation.order = 'YXZ';
        stripe.rotation.y = yaw;
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(cx + nx * (s * 1.65), cY, cz + nz * (s * 1.65));
        worldGroup.add(stripe);
      }
    });
  });

  // Silk Board Multi-Level ORR Elevated Flyover Ramp + Box-Girder Deck + Jersey Crash Parapets + Blue Gantry
  (() => {
    const sbGroup = new THREE.Group();
    const { points: sampled } = getSilkBoardFlyoverSpine(SILK_BOARD_FLYOVER_LOOP);
    const halfW = 5.4;
    const deckL: Array<[number, number, number]> = [];
    const deckR: Array<[number, number, number]> = [];
    const arcLens: number[] = [];
    const railLIn: Array<[number, number, number]> = [];
    const railLOut: Array<[number, number, number]> = [];
    const railLBot: Array<[number, number, number]> = [];
    const railRIn: Array<[number, number, number]> = [];
    const railROut: Array<[number, number, number]> = [];
    const railRBot: Array<[number, number, number]> = [];

    for (let i = 0; i < sampled.length; i++) {
      const curr = sampled[i];
      const ramp = curr.u < 0.22 ? curr.u / 0.22 : curr.u > 0.78 ? (1 - curr.u) / 0.22 : 1;
      const elev = curr.terrainY + 0.08 + ramp * 5.6;
      const railH = ramp > 0.05 ? 0.85 : 0.2;

      deckL.push([curr.x + curr.nx * halfW, elev, curr.z + curr.nz * halfW]);
      deckR.push([curr.x - curr.nx * halfW, elev, curr.z - curr.nz * halfW]);
      arcLens.push(curr.arcLen);

      railLIn.push([curr.x + curr.nx * (halfW - 0.1), elev + railH, curr.z + curr.nz * (halfW - 0.1)]);
      railLOut.push([curr.x + curr.nx * (halfW + 0.34), elev + railH, curr.z + curr.nz * (halfW + 0.34)]);
      railLBot.push([curr.x + curr.nx * (halfW + 0.34), elev - 1.05, curr.z + curr.nz * (halfW + 0.34)]);

      railRIn.push([curr.x - curr.nx * (halfW - 0.1), elev + railH, curr.z - curr.nz * (halfW - 0.1)]);
      railROut.push([curr.x - curr.nx * (halfW + 0.34), elev + railH, curr.z - curr.nz * (halfW + 0.34)]);
      railRBot.push([curr.x - curr.nx * (halfW + 0.34), elev - 1.05, curr.z - curr.nz * (halfW + 0.34)]);

      if (i > 1 && i < sampled.length - 2 && i % 4 === 0) {
        const pierH = Math.max(0.6, ramp * 5.6);
        const pCol = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.95, pierH, 10), flyoverMat);
        pCol.position.set(curr.x, elev - pierH * 0.5, curr.z);
        const pCap = new THREE.Mesh(new THREE.BoxGeometry(halfW * 1.9, 0.65, 1.8), concreteViaductMat);
        pCap.position.set(curr.x, elev - 0.35, curr.z);
        pCap.rotation.y = Math.atan2(curr.tx, curr.tz);
        sbGroup.add(pCol, pCap);
      }
    }

    const deck = new THREE.Mesh(buildStripGeometry(deckL, deckR, 0, 1, arcLens, 20), roadMaterial);
    deck.castShadow = true;
    deck.receiveShadow = true;
    const pRailL = new THREE.Mesh(buildStripGeometry(railLIn, railLOut, 0, 1, arcLens, 10, false), flyoverMat);
    const pWallL = new THREE.Mesh(buildStripGeometry(railLOut, railLBot, 0, 1, arcLens, 10, false), flyoverMat);
    const pRailR = new THREE.Mesh(buildStripGeometry(railRIn, railROut, 0, 1, arcLens, 10, true), flyoverMat);
    const pWallR = new THREE.Mesh(buildStripGeometry(railROut, railRBot, 0, 1, arcLens, 10, true), flyoverMat);
    sbGroup.add(deck, pRailL, pWallL, pRailR, pWallR);

    const sb = getDistrictCenter('silk_board');
    const sbY = getGradedTerrainY(sb.x, sb.z);
    const gantryPostL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 9.5, 8), flyoverMat);
    gantryPostL.position.set(sb.x - 16, sbY + 4.75, sb.z - 12);
    const gantryPostR = gantryPostL.clone();
    gantryPostR.position.set(sb.x - 2, sbY + 4.75, sb.z - 18);
    const gantryBeam = new THREE.Mesh(new THREE.BoxGeometry(16, 0.42, 0.42), flyoverMat);
    gantryBeam.position.set(sb.x - 9, sbY + 9.2, sb.z - 15);
    gantryBeam.rotation.y = -0.38;
    const gantryBoard = new THREE.Mesh(
      new THREE.BoxGeometry(11.5, 2.8, 0.24),
      new THREE.MeshStandardMaterial({ map: textures.silkBoardGantry, roughness: 0.32 })
    );
    gantryBoard.position.set(sb.x - 9, sbY + 8.4, sb.z - 14.8);
    gantryBoard.rotation.y = -0.38;
    sbGroup.add(gantryPostL, gantryPostR, gantryBeam, gantryBoard);

    worldGroup.add(sbGroup);
    partition.registerObject(sb.x, sb.z, sbGroup, 'medium');
  })();

  const customRoadsGroup = new THREE.Group();
  worldGroup.add(customRoadsGroup);
  const rebuildCustomRoads = (extraRoads: RoadSegment[]) => {
    while (customRoadsGroup.children.length > 0) {
      customRoadsGroup.remove(customRoadsGroup.children[0]);
    }
    renderRoadList(extraRoads, customRoadsGroup);
  };

  // Reflective Rain Puddles on Central & South Roads
  const puddleMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e293b,
    roughness: 0.04,
    metalness: 0.15,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
  });
  const puddles: THREE.Mesh[] = [];
  const mg = getDistrictCenter('mg_road');
  const ind = getDistrictCenter('indiranagar');
  const kor = getDistrictCenter('koramangala');
  const sb = getDistrictCenter('silk_board');
  const krm = getDistrictCenter('kr_market');
  [
    [mg.x + 8, mg.z + 4, 4.4],
    [mg.x - 16, mg.z + 2, 3.8],
    [ind.x - 10, ind.z + 5, 4.6],
    [kor.x + 6, kor.z - 8, 4.8],
    [sb.x - 8, sb.z + 6, 5.2],
    [krm.x + 12, krm.z - 6, 4.1],
  ].forEach(([px, pz, pr]) => {
    const pGeo = new THREE.CircleGeometry(pr, 16);
    pGeo.rotateX(-Math.PI / 2);
    const pMesh = new THREE.Mesh(pGeo, puddleMat);
    pMesh.position.set(px, getGradedTerrainY(px, pz) + 0.09, pz);
    worldGroup.add(pMesh);
    puddles.push(pMesh);
  });

  // Animated Operational 5-Car Metro Trains (Purple, Green & Yellow)
  const metroTrainPurple = createMetroTrain(0x7e22ce);
  const metroTrainGreen = createMetroTrain(0x16a34a);
  const metroTrainYellow = createMetroTrain(0xeab308);
  worldGroup.add(metroTrainPurple, metroTrainGreen, metroTrainYellow);

  // Build All 15 Famous Landmarks + 29 Metro Stations + 8 Rail/Bus Hubs
  buildBengaluruLandmarksAndStations(worldGroup, colliders, textures, partition);

  // Real Bengaluru Lakes (6 Lakes inside sculpted basins + stone retaining banks)
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
    const lakeY = getGradedTerrainY(wz.x, wz.z) + 0.16;
    const geo = new THREE.CircleGeometry(1, 32);
    geo.rotateX(-Math.PI / 2);
    geo.scale(wz.rx, 1, wz.rz);
    const lake = new THREE.Mesh(geo, waterMat);
    lake.position.set(wz.x, lakeY, wz.z);
    worldGroup.add(lake);
    waterMeshes.push(lake);
  });

  // District Architecture with Road-Clearance Validation, Nearest-Road Alignment & World Partition HLOD
  const comMat = new THREE.MeshStandardMaterial({ map: textures.commercialFacade, roughness: 0.6, metalness: 0.15 });
  const itMat = new THREE.MeshStandardMaterial({ map: textures.itGlassFacade, roughness: 0.22, metalness: 0.75 });
  const resMat = new THREE.MeshStandardMaterial({ map: textures.residentialFacade, roughness: 0.78, metalness: 0.05 });
  const mktMat = new THREE.MeshStandardMaterial({ map: textures.marketAwning, roughness: 0.85, metalness: 0.02 });
  const hlodMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9 });
  windowEmissiveMaterials.push(comMat, itMat);

  const isFootprintClear = (bx: number, bz: number, halfDiag: number): boolean => {
    if (isPointOnRoad(bx, bz, halfDiag + 3.6)) return false;
    if (isPointInWater(bx, bz)) return false;
    for (let i = 0; i < colliders.length; i++) {
      const c = colliders[i];
      if (
        bx + halfDiag + 1.8 > c.minX &&
        bx - halfDiag - 1.8 < c.maxX &&
        bz + halfDiag + 1.8 > c.minZ &&
        bz - halfDiag - 1.8 < c.maxZ
      ) {
        return false;
      }
    }
    for (let i = 0; i < LANDMARK_MARKERS.length; i++) {
      const lm = LANDMARK_MARKERS[i];
      if (
        (lm.type === 'metro' || lm.type === 'rail' || lm.type === 'bus_hub' || lm.type === 'landmark' || lm.type === 'interior') &&
        Math.hypot(bx - lm.x, bz - lm.z) < halfDiag + 6.5
      ) {
        return false;
      }
    }
    return true;
  };

  const resolveClearBuildingSpot = (
    targetX: number,
    targetZ: number,
    w: number,
    d: number,
    districtX: number,
    districtZ: number
  ): { x: number; z: number; yaw: number } => {
    const halfDiag = Math.hypot(w, d) * 0.5;
    let bx = targetX;
    let bz = targetZ;

    if (!isFootprintClear(bx, bz, halfDiag)) {
      let found = false;
      // First try pushing orthogonally away from nearest road
      const near = queryNearestCurvedRoad(bx, bz, ROAD_SEGMENTS, false);
      if (near) {
        const sideSign = (bx - near.closestX) * near.normalX + (bz - near.closestZ) * near.normalZ >= 0 ? 1 : -1;
        for (const extra of [4.2, 8.5, 14.0, 20.0]) {
          const cx = near.closestX + near.normalX * sideSign * (near.halfWidth + halfDiag + extra);
          const cz = near.closestZ + near.normalZ * sideSign * (near.halfWidth + halfDiag + extra);
          if (isFootprintClear(cx, cz, halfDiag)) {
            bx = cx;
            bz = cz;
            found = true;
            break;
          }
        }
      }
      // Spiral search around district plot if still blocked (e.g. near junction)
      if (!found) {
        outer: for (let r = 8; r <= 76; r += 8) {
          for (let a = 0; a < 16; a++) {
            const ang = (a / 16) * Math.PI * 2;
            const cx = targetX + Math.cos(ang) * r;
            const cz = targetZ + Math.sin(ang) * r;
            if (Math.hypot(cx - districtX, cz - districtZ) < 105 && isFootprintClear(cx, cz, halfDiag)) {
              bx = cx;
              bz = cz;
              break outer;
            }
          }
        }
      }
    }

    const nearFinal = queryNearestCurvedRoad(bx, bz, ROAD_SEGMENTS, false);
    let yaw = 0;
    if (nearFinal) {
      const toRoadX = nearFinal.closestX - bx;
      const toRoadZ = nearFinal.closestZ - bz;
      yaw = Math.atan2(toRoadX, toRoadZ);
    }
    return { x: bx, z: bz, yaw };
  };

  const buildDistrictCluster = (
    dId: typeof DISTRICTS[number]['id'],
    layout: Array<[number, number, number, number, number]>,
    mat: THREE.Material,
    roofHex = 0x334155,
    style: 'commercial' | 'it_tower' | 'residential' | 'market' = 'commercial',
    accentHex = 0xd97706
  ) => {
    const c = getDistrictCenter(dId);
    const highGroup = new THREE.Group();
    const hlodGroup = new THREE.Group();
    const baseY = getGradedTerrainY(c.x, c.z);

    layout.forEach(([ox, oz, w, h, d], idx) => {
      const spot = resolveClearBuildingSpot(c.x + ox, c.z + oz, w, d, c.x, c.z);
      addDetailedBuilding(
        highGroup,
        colliders,
        spot.x,
        spot.z,
        w,
        h,
        d,
        mat,
        roofHex,
        style,
        idx % 2 === 0 ? accentHex : 0x0284c7,
        spot.yaw
      );
    });

    const proxy = new THREE.Mesh(new THREE.BoxGeometry(58, 22, 54), hlodMat);
    proxy.position.set(c.x, baseY + 11, c.z);
    hlodGroup.add(proxy);
    hlodGroup.visible = false;

    worldGroup.add(highGroup, hlodGroup);
    partition.registerDistrictHlod(dId, c.x, c.z, highGroup, hlodGroup);
  };

  (['mg_road', 'brigade_road', 'commercial_street', 'shivajinagar', 'majestic'] as const).forEach((dId) =>
    buildDistrictCluster(
      dId,
      [
        [-26, -24, 18, 22, 16],
        [26, -24, 20, 26, 16],
        [-28, 24, 18, 18, 16],
        [28, 24, 20, 20, 18],
      ],
      comMat,
      0x334155,
      'commercial',
      0xf59e0b
    )
  );

  (['whitefield', 'electronic_city', 'manyata_tech_park', 'orr', 'marathahalli', 'bellandur'] as const).forEach((dId) =>
    buildDistrictCluster(
      dId,
      [
        [-34, -32, 26, 42, 22],
        [34, -30, 28, 50, 24],
        [-32, 34, 24, 36, 22],
        [36, 36, 26, 44, 24],
      ],
      itMat,
      0x0f172a,
      'it_tower',
      0x38bdf8
    )
  );

  ([
    'indiranagar',
    'koramangala',
    'jayanagar',
    'jp_nagar',
    'btm_layout',
    'basavanagudi',
    'banashankari',
    'rajajinagar',
    'vijayanagar',
    'malleshwaram',
    'chandra_layout',
    'hal',
    'kr_puram',
    'hebbal',
    'yelahanka',
    'jakkur',
    'yeshwanthpur',
  ] as const).forEach((dId) =>
    buildDistrictCluster(
      dId,
      [
        [-28, -26, 18, 12, 16],
        [28, -24, 20, 16, 18],
        [-26, 28, 18, 14, 16],
        [28, 28, 20, 18, 18],
      ],
      resMat,
      0x78350f,
      'residential',
      0xb45309
    )
  );

  // KR Market Stalls
  buildDistrictCluster(
    'kr_market',
    [
      [-22, -20, 14, 5.5, 12],
      [22, -20, 14, 5.5, 12],
      [-24, 22, 14, 5.5, 12],
      [24, 22, 14, 5.5, 12],
    ],
    mktMat,
    0xea580c,
    'market',
    0xf97316
  );

  // Authentic Bengaluru Street Props: Darshinis, ATMs, Park Benches, Construction Zones, Power Poles
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.82 });
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.4, metalness: 0.8 });
  const binMat = new THREE.MeshStandardMaterial({ color: 0x16a34a, roughness: 0.55 });

  const nudgeOffRoad = (px: number, pz: number, clearance = 2.0, maxPush = 18): { x: number; z: number; yaw: number } => {
    const near = queryNearestCurvedRoad(px, pz, ROAD_SEGMENTS, false);
    if (!near) return { x: px, z: pz, yaw: 0 };
    const roadYaw = Math.atan2(near.closestX - px, near.closestZ - pz);
    if (near.dist >= near.halfWidth + clearance) return { x: px, z: pz, yaw: roadYaw };
    const side = (px - near.closestX) * near.normalX + (pz - near.closestZ) * near.normalZ >= 0 ? 1 : -1;
    const pushDist = Math.min(near.dist + maxPush, near.halfWidth + clearance);
    const nx = near.closestX + near.normalX * side * pushDist;
    const nz = near.closestZ + near.normalZ * side * pushDist;
    return { x: nx, z: nz, yaw: Math.atan2(near.closestX - nx, near.closestZ - nz) };
  };

  LANDMARK_MARKERS.forEach((lm) => {
    const pos = nudgeOffRoad(lm.x, lm.z, 2.2, 5.2);
    const ly = getGradedTerrainY(pos.x, pos.z);
    if (lm.type === 'darshini') {
      const stall = new THREE.Group();
      stall.position.set(pos.x, ly, pos.z);
      stall.rotation.y = pos.yaw;
      const counter = new THREE.Mesh(new THREE.BoxGeometry(5.2, 1.15, 2.4), woodMat);
      counter.position.y = 0.58;
      const roof = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.3, 3.2), new THREE.MeshStandardMaterial({ color: 0xb91c1c }));
      roof.position.y = 3.2;
      const sign = new THREE.Mesh(
        new THREE.BoxGeometry(4.8, 1.4, 0.15),
        new THREE.MeshStandardMaterial({ map: textures.darshiniSign, emissive: 0x78350f, emissiveIntensity: 0.3 })
      );
      sign.position.set(0, 2.5, 1.55);
      [-2.3, 2.3].forEach((px) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 3.2, 6), poleMat);
        post.position.set(px, 1.6, 1.2);
        stall.add(post);
      });
      stall.add(counter, roof, sign);
      worldGroup.add(stall);
      partition.registerObject(pos.x, pos.z, stall, 'high');
    } else if (lm.type === 'atm') {
      const kiosk = new THREE.Group();
      kiosk.position.set(pos.x, ly, pos.z);
      kiosk.rotation.y = pos.yaw;
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.9, 2.2), new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.35 }));
      box.position.y = 1.45;
      const screen = new THREE.Mesh(
        new THREE.BoxGeometry(0.9, 0.7, 0.08),
        new THREE.MeshStandardMaterial({ color: 0x0f172a, emissive: 0x38bdf8, emissiveIntensity: 0.9 })
      );
      screen.position.set(0, 1.55, 1.11);
      kiosk.add(box, screen);
      worldGroup.add(kiosk);
      partition.registerObject(pos.x, pos.z, kiosk, 'high');
    } else if (lm.type === 'bench') {
      const bench = new THREE.Group();
      bench.position.set(pos.x, ly, pos.z);
      bench.rotation.y = pos.yaw;
      const seat = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.14, 0.65), woodMat);
      seat.position.y = 0.5;
      const back = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.5, 0.12), woodMat);
      back.position.set(0, 0.85, -0.28);
      bench.add(seat, back);
      worldGroup.add(bench);
      partition.registerObject(pos.x, pos.z, bench, 'high');
    }
  });

  // Roadside Bins & Silk Board Construction Barriers (snapped to sidewalks)
  [
    [mg.x + 14, mg.z + 10],
    [ind.x - 14, ind.z + 12],
    [kor.x + 10, kor.z - 12],
    [krm.x + 8, krm.z + 10],
  ].forEach(([bx, bz]) => {
    const pos = nudgeOffRoad(bx, bz, 1.4, 16);
    const bin = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.28, 0.95, 10), binMat);
    bin.position.set(pos.x, getGradedTerrainY(pos.x, pos.z) + 0.48, pos.z);
    worldGroup.add(bin);
    partition.registerObject(pos.x, pos.z, bin, 'high');
  });

  const barrierMat = new THREE.MeshStandardMaterial({ color: 0xf97316, roughness: 0.6 });
  for (let c = 0; c < 4; c++) {
    const pos = nudgeOffRoad(sb.x - 12 + c * 4.5, sb.z + 14, 1.2, 14);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.95, 0.45), barrierMat);
    bar.position.set(pos.x, getGradedTerrainY(pos.x, pos.z) + 0.48, pos.z);
    bar.rotation.y = pos.yaw;
    worldGroup.add(bar);
    partition.registerObject(pos.x, pos.z, bar, 'high');
  }

  // Overhead Electric Poles & Power Cables along Indiranagar sidewalk edge
  const wireMat = new THREE.LineBasicMaterial({ color: 0x1e293b });
  const poleCoords = [0, 1, 2, 3, 4].map((i) => nudgeOffRoad(ind.x - 60 + i * 32, ind.z - 22, 1.8, 16));
  poleCoords.forEach((p, i) => {
    const py = getGradedTerrainY(p.x, p.z);
    const ePole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.16, 8.2, 8), poleMat);
    ePole.position.set(p.x, py + 4.1, p.z);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.12, 0.12), poleMat);
    arm.position.set(p.x, py + 7.9, p.z);
    worldGroup.add(ePole, arm);
    partition.registerObject(p.x, p.z, ePole, 'high');
    if (i < poleCoords.length - 1) {
      const next = poleCoords[i + 1];
      const ny = getGradedTerrainY(next.x, next.z);
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(p.x, py + 7.8, p.z),
        new THREE.Vector3((p.x + next.x) * 0.5, (py + ny) * 0.5 + 6.8, (p.z + next.z) * 0.5),
        new THREE.Vector3(next.x, ny + 7.8, next.z),
      ]);
      const wire = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(10)), wireMat);
      worldGroup.add(wire);
      partition.registerObject(p.x, p.z, wire, 'high');
    }
  });

  // Traffic Signals & Police Podiums placed safely at Junction Corners outside road asphalt
  const trafficSignals: TrafficSignalObj[] = [];
  const signalDistricts: Array<typeof DISTRICTS[number]['id']> = [
    'mg_road',
    'brigade_road',
    'indiranagar',
    'koramangala',
    'silk_board',
    'kr_market',
    'majestic',
    'hebbal',
  ];
  const podiumBlueMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.45 });
  const podiumWhiteMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.45 });

  signalDistricts.forEach((dId) => {
    const c = getDistrictCenter(dId);
    // Snap to closest surface junction if nearby so signal aligns with intersection geometry
    let jx = c.x;
    let jz = c.z;
    let cornerDist = 13.5;
    let bestJ: RoadJunction | null = null;
    let bestJDist = Infinity;
    for (const j of surfaceJunctions) {
      const dj = Math.hypot(j.x - c.x, j.z - c.z);
      if (dj < 95 && dj < bestJDist) {
        bestJDist = dj;
        bestJ = j;
      }
    }
    if (bestJ) {
      jx = bestJ.x;
      jz = bestJ.z;
      cornerDist = bestJ.maxHalfW + 1.8;
    }

    const postSpot = nudgeOffRoad(jx + cornerDist * 0.72, jz + cornerDist * 0.72, 1.5, 14);
    const iy = getGradedTerrainY(postSpot.x, postSpot.z);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 6.4, 8), poleMat);
    post.position.set(postSpot.x, iy + 3.2, postSpot.z);
    const box = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.3, 1.2), poleMat);
    box.position.set(postSpot.x, iy + 6.3, postSpot.z);
    worldGroup.add(post, box);

    const makeBulb = (col: number, ox: number, oy: number, oz: number) => {
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.24, 8, 8),
        new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.15 })
      );
      m.position.set(postSpot.x + ox, iy + 6.3 + oy, postSpot.z + oz);
      worldGroup.add(m);
      return m;
    };
    trafficSignals.push({
      x: jx,
      z: jz,
      nsRed: makeBulb(0xef4444, 0, 0.62, -0.6),
      nsYellow: makeBulb(0xf59e0b, 0, 0, -0.6),
      nsGreen: makeBulb(0x22c55e, 0, -0.62, -0.6),
      ewRed: makeBulb(0xef4444, -0.6, 0.62, 0),
      ewYellow: makeBulb(0xf59e0b, -0.6, 0, 0),
      ewGreen: makeBulb(0x22c55e, -0.6, -0.62, 0),
    });

    // Bengaluru Traffic Police Junction Podium on opposite safe sidewalk corner
    const podSpot = nudgeOffRoad(jx - cornerDist * 0.72, jz - cornerDist * 0.72, 1.8, 14);
    const py = getGradedTerrainY(podSpot.x, podSpot.z);
    const podiumBase = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.25, 0.42, 12), podiumBlueMat);
    podiumBase.position.set(podSpot.x, py + 0.21, podSpot.z);
    const podiumTrim = new THREE.Mesh(new THREE.CylinderGeometry(1.14, 1.14, 0.14, 12), podiumWhiteMat);
    podiumTrim.position.set(podSpot.x, py + 0.36, podSpot.z);
    const podiumCanopyPole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.7, 6), poleMat);
    podiumCanopyPole.position.set(podSpot.x, py + 1.55, podSpot.z);
    const podiumUmbrella = new THREE.Mesh(new THREE.ConeGeometry(1.35, 0.45, 10), podiumBlueMat);
    podiumUmbrella.position.set(podSpot.x, py + 2.95, podSpot.z);
    worldGroup.add(podiumBase, podiumTrim, podiumCanopyPole, podiumUmbrella);
  });

  // Kannada Directional Road Gantry Signs aligned perpendicular to true curved roads
  const gantryMat = new THREE.MeshStandardMaterial({ map: textures.kannadaRoadSign, roughness: 0.35 });
  const gantryDistricts: Array<typeof DISTRICTS[number]['id']> = [
    'mg_road',
    'indiranagar',
    'koramangala',
    'silk_board',
    'hebbal',
    'majestic',
  ];
  gantryDistricts.forEach((dId) => {
    const c = getDistrictCenter(dId);
    const near = queryNearestCurvedRoad(c.x, c.z, ROAD_SEGMENTS, false);
    const gx = near ? near.closestX + near.tangentX * 24 : c.x + 15;
    const gz = near ? near.closestZ + near.tangentZ * 24 : c.z - 16;
    const span = near ? near.halfWidth * 2 + 2.2 : 14.4;
    const yaw = near ? Math.atan2(near.tangentX, near.tangentZ) : 0;
    const iy = getGradedTerrainY(gx, gz);
    const gantry = new THREE.Group();
    const postL = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7.2, 8), poleMat);
    postL.position.set(-span * 0.5, 3.6, 0);
    const postR = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.22, 7.2, 8), poleMat);
    postR.position.set(span * 0.5, 3.6, 0);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(span + 0.8, 0.35, 0.35), poleMat);
    beam.position.set(0, 7.0, 0);
    const board = new THREE.Mesh(new THREE.BoxGeometry(Math.min(10.5, span * 0.65), 2.2, 0.22), gantryMat);
    board.position.set(0, 6.2, 0.2);
    gantry.add(postL, postR, beam, board);
    gantry.position.set(gx, iy, gz);
    gantry.rotation.y = yaw;
    worldGroup.add(gantry);
    partition.registerObject(gx, gz, gantry, 'medium');
  });

  // Multi-Tier Branched Bengaluru Rain Trees & Gulmohar Blossoms (STRICT Road/Building/Water Clearance)
  const rawTreeSpots: Array<[number, number]> = [];
  const cub = getDistrictCenter('cubbon_park');
  const jay = getDistrictCenter('jayanagar');
  for (let i = 0; i < 72; i++) {
    rawTreeSpots.push([cub.x + Math.cos(i * 2.1) * (14 + (i % 7) * 9), cub.z + Math.sin(i * 1.7) * (14 + (i % 6) * 9)]);
  }
  for (let i = 0; i < 60; i++) {
    rawTreeSpots.push([jay.x + Math.cos(i * 1.9) * (18 + (i % 6) * 11), jay.z - 90 + Math.sin(i * 2.3) * (18 + (i % 5) * 11)]);
  }
  DISTRICTS.forEach((dist, idx) => {
    for (let t = 0; t < 6; t++) {
      const ang = (t / 6) * Math.PI * 2 + idx;
      rawTreeSpots.push([dist.x + Math.cos(ang) * 44, dist.z + Math.sin(ang) * 44]);
    }
  });

  const treeSpots = rawTreeSpots.filter(([tx, tz]) => {
    if (isPointOnRoad(tx, tz, 6.5)) return false;
    if (isPointInWater(tx, tz)) return false;
    for (const c of colliders) {
      if (tx >= c.minX - 2.5 && tx <= c.maxX + 2.5 && tz >= c.minZ - 2.5 && tz <= c.maxZ + 2.5) {
        return false;
      }
    }
    for (const lm of LANDMARK_MARKERS) {
      if (Math.hypot(tx - lm.x, tz - lm.z) < 14) return false;
    }
    return true;
  });

  const trunkGeo = new THREE.CylinderGeometry(0.28, 0.52, 4.4, 8);
  trunkGeo.translate(0, 2.2, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9 });

  const canopyGeo = new THREE.DodecahedronGeometry(3.2, 1);
  canopyGeo.scale(1.32, 0.72, 1.32);
  canopyGeo.translate(0, 5.5, 0);
  const canopyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, metalness: 0.02 });

  const crownUpperGeo = new THREE.DodecahedronGeometry(2.1, 1);
  crownUpperGeo.scale(1.15, 0.78, 1.15);
  crownUpperGeo.translate(0.55, 6.95, -0.35);

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeSpots.length);
  const canopyInst = new THREE.InstancedMesh(canopyGeo, canopyMat, treeSpots.length);
  const crownUpperInst = new THREE.InstancedMesh(crownUpperGeo, canopyMat, treeSpots.length);
  canopyInst.castShadow = true;

  const dummy = new THREE.Object3D();
  const cColor = new THREE.Color();
  treeSpots.forEach(([tx, tz], idx) => {
    const s = 0.85 + ((idx * 37) % 30) / 100;
    const ty = getGradedTerrainY(tx, tz);
    dummy.position.set(tx, ty, tz);
    dummy.rotation.set(0, idx * 0.9, 0);
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(idx, dummy.matrix);
    canopyInst.setMatrixAt(idx, dummy.matrix);
    crownUpperInst.setMatrixAt(idx, dummy.matrix);

    const isBlossom = idx % 7 === 0;
    const shade = 0.76 + ((idx * 17) % 24) / 100;
    if (isBlossom) {
      cColor.setRGB(0.86 * shade, 0.34 * shade, 0.16 * shade);
      crownUpperInst.setColorAt(idx, cColor);
      cColor.setRGB(0.18 * shade, 0.48 * shade, 0.19 * shade);
      canopyInst.setColorAt(idx, cColor);
    } else {
      cColor.setRGB(0.16 * shade, 0.48 * shade, 0.18 * shade);
      canopyInst.setColorAt(idx, cColor);
      cColor.setRGB(0.2 * shade, 0.55 * shade, 0.22 * shade);
      crownUpperInst.setColorAt(idx, cColor);
    }
  });
  trunkInst.instanceMatrix.needsUpdate = true;
  canopyInst.instanceMatrix.needsUpdate = true;
  crownUpperInst.instanceMatrix.needsUpdate = true;
  if (canopyInst.instanceColor) canopyInst.instanceColor.needsUpdate = true;
  if (crownUpperInst.instanceColor) crownUpperInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  canopyInst.computeBoundingSphere();
  crownUpperInst.computeBoundingSphere();
  worldGroup.add(trunkInst, canopyInst, crownUpperInst);

  // Streetlamps aligned accurately along curved road curb/sidewalk edges
  const lampSpots: Array<[number, number, number]> = [];
  ROAD_SEGMENTS.forEach((seg) => {
    if (seg.kind === 'metro' || seg.elevated) return;
    const spine = getSampledRoadSpine(seg);
    const step = Math.max(2, Math.round(52 / Math.max(10, spine.totalLength / spine.points.length)));
    for (let i = 1; i < spine.points.length - 1; i += step) {
      const pt = spine.points[i];
      if (isInsideSurfaceJunction(pt.x, pt.z, surfaceJunctions, 2.5)) continue;
      const side = (i / step) % 2 === 0 ? 1 : -1;
      const lx = pt.x + pt.nx * side * (spine.halfWidth + 0.95);
      const lz = pt.z + pt.nz * side * (spine.halfWidth + 0.95);
      if (!isPointOnRoad(lx, lz, 0.3) && !isPointInWater(lx, lz)) {
        lampSpots.push([lx, lz, pt.terrainY]);
      }
    }
  });
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
  lampSpots.forEach(([lx, lz, ly], i) => {
    dummy.position.set(lx, ly, lz);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPoles.setMatrixAt(i, dummy.matrix);
    lampBulbs.setMatrixAt(i, dummy.matrix);
  });
  lampPoles.computeBoundingSphere();
  lampBulbs.computeBoundingSphere();
  worldGroup.add(lampPoles, lampBulbs);

  // Service Rings
  LANDMARK_MARKERS.forEach((lm) => {
    if (lm.type === 'landmark' || lm.type === 'metro' || lm.type === 'bus_hub' || lm.type === 'rail') return;
    const color =
      lm.type === 'garage'
        ? 0x06b6d4
        : lm.type === 'safehouse'
        ? 0x22c55e
        : lm.type === 'petrol'
        ? 0xf59e0b
        : lm.type === 'darshini'
        ? 0xf97316
        : lm.type === 'atm'
        ? 0x38bdf8
        : lm.type === 'bench'
        ? 0xa3e635
        : lm.type === 'interior'
        ? 0xa855f7
        : 0xec4899;
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(2.2, 2.7, 24),
      new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: 0.85 })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(lm.x, getGradedTerrainY(lm.x, lm.z) + 0.12, lm.z);
    worldGroup.add(ring);
  });

  // Collectibles
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
    g.position.set(col.x, getGradedTerrainY(col.x, col.z), col.z);
    worldGroup.add(g);
    collectibleMeshes.set(col.id, g);
  });

  // Mission Beacon
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

  // 3D Active GPS Route Line in World Space
  const navGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const navigationLine = new THREE.Line(
    navGeo,
    new THREE.LineBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 })
  );
  navigationLine.visible = false;
  navigationLine.frustumCulled = false;
  worldGroup.add(navigationLine);

  // Rain Particle System
  const rainCount = 1800;
  const rainPositions = new Float32Array(rainCount * 3);
  for (let i = 0; i < rainCount; i++) {
    rainPositions[i * 3] = (Math.random() - 0.5) * 140;
    rainPositions[i * 3 + 1] = Math.random() * 45;
    rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 140;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPositions, 3));
  const rainMat = new THREE.PointsMaterial({ color: 0xcbd5e1, size: 0.36, transparent: true, opacity: 0.65 });
  const rainPoints = new THREE.Points(rainGeo, rainMat);
  rainPoints.visible = false;
  rainPoints.frustumCulled = false;
  scene.add(rainPoints);

  // Sunlight Dust Motes
  const dustCount = 260;
  const dustPositions = new Float32Array(dustCount * 3);
  for (let i = 0; i < dustCount; i++) {
    dustPositions[i * 3] = (Math.random() - 0.5) * 70;
    dustPositions[i * 3 + 1] = 0.5 + Math.random() * 8;
    dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 70;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
  const dustPoints = new THREE.Points(
    dustGeo,
    new THREE.PointsMaterial({ color: 0xfef3c7, size: 0.14, transparent: true, opacity: 0.38 })
  );
  dustPoints.frustumCulled = false;
  scene.add(dustPoints);

  // Precompute Operational Metro Curves (Purple, Green, Yellow)
  const makeMetroCurve = (id: string) => {
    const seg = ROAD_SEGMENTS.find((r) => r.id === id);
    if (!seg || seg.points.length < 2) {
      return new THREE.CatmullRomCurve3([new THREE.Vector3(0, 11, 0), new THREE.Vector3(20, 11, 0)]);
    }
    return new THREE.CatmullRomCurve3(
      seg.points.map((p) => new THREE.Vector3(p.x, getGradedTerrainY(p.x, p.z) + 11.0, p.z))
    );
  };
  const purpleCurve = makeMetroCurve('metro_purple');
  const greenCurve = makeMetroCurve('metro_green');
  const yellowCurve = makeMetroCurve('metro_yellow');

  const skyColor = new THREE.Color();
  const daySky = new THREE.Color(0x7cc4fa);
  const sunsetSky = new THREE.Color(0xf97316);
  const nightSky = new THREE.Color(0x0b132b);
  const rainSky = new THREE.Color(0x475569);
  const fogSky = new THREE.Color(0xcbd5e1);
  const _mPos = new THREE.Vector3();
  const _mTan = new THREE.Vector3();

  let nextLightningAt = 6;
  let lightningFlash = 0;

  const pocketBg = new THREE.Color(0x0b1220);

  const syncRoadSurfaceFinish = (roughness: number, metalness: number) => {
    roadMaterial.roughness = roughness;
    roadMaterial.metalness = metalness;
    highwayRoadMat.roughness = roughness;
    highwayRoadMat.metalness = metalness;
    secondaryRoadMat.roughness = roughness;
    secondaryRoadMat.metalness = metalness;
    junctionRoadMat.roughness = roughness;
    junctionRoadMat.metalness = metalness;
  };

  const updateAtmosphere = (
    timeHours: number,
    weather: WeatherMode,
    playerX: number,
    playerZ: number,
    elapsed: number,
    dt: number,
    onThunder?: () => void,
    inPocket = false
  ) => {
    const isNight = timeHours < 6 || timeHours >= 19;
    const isGolden = (timeHours >= 6 && timeHours < 8.5) || (timeHours >= 16.8 && timeHours < 19);

    if (isNight) {
      skyColor.copy(nightSky);
      sunLight.intensity = 0.35;
      sunLight.color.setHex(0x93c5fd);
      hemiLight.intensity = 0.42;
      streetLampBulbMat.emissiveIntensity = 2.2;
      windowEmissiveMaterials.forEach((m) => (m.emissiveIntensity = 0.65));
      dustPoints.visible = false;
    } else if (isGolden) {
      skyColor.copy(sunsetSky).lerp(daySky, 0.35);
      sunLight.intensity = 1.65;
      sunLight.color.setHex(0xfdba74);
      hemiLight.intensity = 0.72;
      streetLampBulbMat.emissiveIntensity = 1.1;
      windowEmissiveMaterials.forEach((m) => (m.emissiveIntensity = 0.35));
      dustPoints.visible = weather === 'clear' && !inPocket;
    } else {
      skyColor.copy(daySky);
      sunLight.intensity = 1.9;
      sunLight.color.setHex(0xfff5e0);
      hemiLight.intensity = 0.85;
      streetLampBulbMat.emissiveIntensity = 0.05;
      windowEmissiveMaterials.forEach((m) => (m.emissiveIntensity = 0.05));
      dustPoints.visible = weather === 'clear' && !inPocket;
    }

    const isRaining = weather === 'light_rain' || weather === 'monsoon' || weather === 'thunderstorm';
    if (isRaining && !inPocket) {
      const darkFactor = weather === 'light_rain' ? 0.45 : weather === 'monsoon' ? 0.72 : 0.85;
      skyColor.lerp(rainSky, darkFactor);
      sunLight.intensity *= weather === 'light_rain' ? 0.72 : 0.48;
      syncRoadSurfaceFinish(0.18, 0.38);
      puddleMat.opacity = weather === 'light_rain' ? 0.45 : 0.78;
      rainPoints.visible = true;
      rainPoints.position.set(playerX, 0, playerZ);
      const dropSpeed = weather === 'light_rain' ? 28 : 45;
      const windX = weather === 'thunderstorm' ? 9 : 2;
      for (let i = 0; i < rainCount; i++) {
        rainPositions[i * 3] += dt * windX;
        rainPositions[i * 3 + 1] -= dt * dropSpeed;
        if (rainPositions[i * 3 + 1] < 0) {
          rainPositions[i * 3] = (Math.random() - 0.5) * 140;
          rainPositions[i * 3 + 1] = 42;
        }
      }
      rainGeo.attributes.position.needsUpdate = true;

      if (weather === 'thunderstorm') {
        if (elapsed > nextLightningAt) {
          lightningFlash = 1.0;
          nextLightningAt = elapsed + 6 + Math.random() * 8;
          onThunder?.();
        }
        if (lightningFlash > 0) {
          lightningFlash = Math.max(0, lightningFlash - dt * 4.5);
          sunLight.intensity += lightningFlash * 2.8;
          skyColor.lerp(fogSky, lightningFlash * 0.5);
        }
      }
    } else if (weather === 'cloudy' && !inPocket) {
      skyColor.lerp(rainSky, 0.42);
      sunLight.intensity *= 0.75;
      syncRoadSurfaceFinish(0.65, 0.1);
      puddleMat.opacity = 0;
      rainPoints.visible = false;
    } else if (weather === 'fog' && !inPocket) {
      skyColor.lerp(fogSky, 0.78);
      sunLight.intensity *= 0.65;
      syncRoadSurfaceFinish(0.55, 0.12);
      puddleMat.opacity = 0.18;
      rainPoints.visible = false;
    } else {
      syncRoadSurfaceFinish(0.72, 0.08);
      puddleMat.opacity = 0;
      rainPoints.visible = false;
    }

    if (dustPoints.visible) {
      dustPoints.position.set(playerX, 0, playerZ);
      dustPoints.rotation.y = elapsed * 0.04;
    }

    canopyInst.rotation.z = Math.sin(elapsed * 1.1) * (isRaining ? 0.012 : 0.004);

    if (inPocket) {
      scene.background = pocketBg;
      scene.fog = null;
      hemiLight.intensity = 1.05;
    } else {
      scene.background = skyColor;
      const fogDensity =
        weather === 'fog'
          ? 0.0065
          : weather === 'thunderstorm'
          ? 0.0038
          : weather === 'monsoon'
          ? 0.0028
          : isNight
          ? 0.0022
          : 0.0012;
      if (!scene.fog || !(scene.fog instanceof THREE.FogExp2)) {
        scene.fog = new THREE.FogExp2(skyColor.getHex(), fogDensity);
      } else {
        scene.fog.color.copy(skyColor);
        scene.fog.density = fogDensity;
      }
    }

    // Bengaluru solar elevation from local solar noon (~12:20 IST)
    const sunAngle = ((timeHours - 6.25) / 12.15) * Math.PI;
    const sunY = isNight ? 95 : Math.max(32, Math.sin(sunAngle) * 150);
    const sunX = isNight ? -80 : Math.cos(sunAngle) * 125;
    sunLight.position.set(playerX + sunX, sunY, playerZ + 70);
    sunLight.target.position.set(playerX, getGradedTerrainY(playerX, playerZ), playerZ);
    sunLight.target.updateMatrixWorld();

    // Animate Operational Namma Metro Trains (Purple, Green & Yellow)
    const uP = (elapsed * 0.024) % 1;
    purpleCurve.getPointAt(uP, _mPos);
    purpleCurve.getTangentAt(uP, _mTan);
    metroTrainPurple.position.copy(_mPos);
    metroTrainPurple.rotation.y = Math.atan2(_mTan.x, _mTan.z) - Math.PI * 0.5;

    const uG = (elapsed * 0.028 + 0.35) % 1;
    greenCurve.getPointAt(uG, _mPos);
    greenCurve.getTangentAt(uG, _mTan);
    metroTrainGreen.position.copy(_mPos);
    metroTrainGreen.rotation.y = Math.atan2(_mTan.x, _mTan.z) - Math.PI * 0.5;

    const uY = (elapsed * 0.032 + 0.7) % 1;
    yellowCurve.getPointAt(uY, _mPos);
    yellowCurve.getTangentAt(uY, _mTan);
    metroTrainYellow.position.copy(_mPos);
    metroTrainYellow.rotation.y = Math.atan2(_mTan.x, _mTan.z) - Math.PI * 0.5;

    collectibleMeshes.forEach((g) => {
      if (g.visible) {
        g.children[0].rotation.y = elapsed * 2.2;
        g.children[0].position.y = 1.45 + Math.sin(elapsed * 3.1) * 0.25;
      }
    });
  };

  void WORLD_HALF_SIZE;

  return {
    colliders,
    partition,
    metroTrainPurple,
    metroTrainGreen,
    metroTrainYellow,
    collectibleMeshes,
    missionBeacon,
    navigationLine,
    trafficSignals,
    rainPoints,
    rainPositions,
    dustPoints,
    puddles,
    puddleMat,
    sunLight,
    hemiLight,
    roadMaterial,
    streetLampBulbMat,
    windowEmissiveMaterials,
    waterMeshes,
    rebuildCustomRoads,
    updateAtmosphere,
  };
}
