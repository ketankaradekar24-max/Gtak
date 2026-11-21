import * as THREE from 'three';
import { getBengaluruTerrainY } from './bengaluruGeo';
import { RoadSegment, WaterZone } from './types';

export interface SampledSpinePoint {
  x: number;
  z: number;
  tx: number;
  tz: number;
  nx: number;
  nz: number;
  arcLen: number;
  u: number;
  terrainY: number;
}

export interface SampledRoadSpine {
  id: string;
  road: RoadSegment;
  points: SampledSpinePoint[];
  totalLength: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  halfWidth: number;
}

export interface JunctionArm {
  roadId: string;
  roadKind: RoadSegment['kind'];
  dirX: number;
  dirZ: number;
  halfW: number;
}

export interface RoadJunction {
  x: number;
  z: number;
  y: number;
  radius: number;
  maxHalfW: number;
  arms: JunctionArm[];
}

export interface CurvedRoadQueryResult {
  road: RoadSegment;
  spine: SampledRoadSpine;
  segIndex: number;
  dist: number;
  t: number;
  u: number;
  closestX: number;
  closestZ: number;
  tangentX: number;
  tangentZ: number;
  normalX: number;
  normalZ: number;
  halfWidth: number;
  terrainY: number;
  isElevated: boolean;
}

const _spineCache = new Map<string, SampledRoadSpine>();
let _silkLoopCache: SampledSpinePoint[] | null = null;
let _silkLoopTotalLen = 0;

function distToSeg2D(
  px: number,
  pz: number,
  ax: number,
  az: number,
  bx: number,
  bz: number
): { dist: number; t: number; cx: number; cz: number } {
  const vx = bx - ax;
  const vz = bz - az;
  const lenSq = vx * vx + vz * vz;
  if (lenSq < 1e-6) {
    return { dist: Math.hypot(px - ax, pz - az), t: 0, cx: ax, cz: az };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (pz - az) * vz) / lenSq));
  const cx = ax + vx * t;
  const cz = az + vz * t;
  return { dist: Math.hypot(px - cx, pz - cz), t, cx, cz };
}

function segmentIntersect2D(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  cx: number,
  cz: number,
  dx: number,
  dz: number
): { x: number; z: number } | null {
  const rX = bx - ax;
  const rZ = bz - az;
  const sX = dx - cx;
  const sZ = dz - cz;
  const denom = rX * sZ - rZ * sX;
  if (Math.abs(denom) < 1e-5) return null;
  const qpx = cx - ax;
  const qpz = cz - az;
  const t = (qpx * sZ - qpz * sX) / denom;
  const u = (qpx * rZ - qpz * rX) / denom;
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return { x: ax + t * rX, z: az + t * rZ };
  }
  return null;
}

/**
 * Generates and caches a Catmull-Rom sampled centerline for any RoadSegment,
 * ensuring 3D road geometry, intersections, nav queries, and traffic lanes share exact coordinates.
 */
export function getSampledRoadSpine(seg: RoadSegment): SampledRoadSpine {
  const first = seg.points[0];
  const last = seg.points[seg.points.length - 1];
  const cacheKey = `${seg.id}_${seg.points.length}_${seg.width}_${first ? Math.round(first.x) : 0}_${
    last ? Math.round(last.z) : 0
  }`;
  const cached = _spineCache.get(cacheKey);
  if (cached) return cached;

  const pts3 = seg.points.map((p) => new THREE.Vector3(p.x, getBengaluruTerrainY(p.x, p.z), p.z));
  const curve = new THREE.CatmullRomCurve3(pts3, false, 'centripetal', 0.25);
  const rawLen = Math.max(1, curve.getLength());
  const sampleCount = Math.max(18, Math.min(260, Math.round(rawLen / 12)));
  const rawSamples = curve.getSpacedPoints(sampleCount);

  const points: SampledSpinePoint[] = [];
  let accLen = 0;
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (let i = 0; i < rawSamples.length; i++) {
    const curr = rawSamples[i];
    if (i > 0) {
      accLen += Math.hypot(curr.x - rawSamples[i - 1].x, curr.z - rawSamples[i - 1].z);
    }
    const prev = rawSamples[Math.max(0, i - 1)];
    const next = rawSamples[Math.min(rawSamples.length - 1, i + 1)];
    const vx = next.x - prev.x;
    const vz = next.z - prev.z;
    const tLen = Math.hypot(vx, vz) || 1;
    const tx = vx / tLen;
    const tz = vz / tLen;
    const nx = -tz;
    const nz = tx;

    if (curr.x < minX) minX = curr.x;
    if (curr.x > maxX) maxX = curr.x;
    if (curr.z < minZ) minZ = curr.z;
    if (curr.z > maxZ) maxZ = curr.z;

    points.push({
      x: curr.x,
      z: curr.z,
      tx,
      tz,
      nx,
      nz,
      arcLen: accLen,
      u: rawSamples.length > 1 ? i / (rawSamples.length - 1) : 0,
      terrainY: getBengaluruTerrainY(curr.x, curr.z),
    });
  }

  const spine: SampledRoadSpine = {
    id: seg.id,
    road: seg,
    points,
    totalLength: Math.max(1, accLen),
    minX,
    maxX,
    minZ,
    maxZ,
    halfWidth: seg.width * 0.5,
  };
  _spineCache.set(cacheKey, spine);
  return spine;
}

export function getSilkBoardFlyoverSpine(loopPts: Array<{ x: number; z: number }>): {
  points: SampledSpinePoint[];
  totalLength: number;
} {
  if (_silkLoopCache && _silkLoopCache.length > 0) {
    return { points: _silkLoopCache, totalLength: _silkLoopTotalLen };
  }
  const pts3 = loopPts.map((p) => new THREE.Vector3(p.x, getBengaluruTerrainY(p.x, p.z), p.z));
  const curve = new THREE.CatmullRomCurve3(pts3, false, 'centripetal', 0.25);
  const rawSamples = curve.getSpacedPoints(36);
  const points: SampledSpinePoint[] = [];
  let accLen = 0;

  for (let i = 0; i < rawSamples.length; i++) {
    const curr = rawSamples[i];
    if (i > 0) {
      accLen += Math.hypot(curr.x - rawSamples[i - 1].x, curr.z - rawSamples[i - 1].z);
    }
    const prev = rawSamples[Math.max(0, i - 1)];
    const next = rawSamples[Math.min(rawSamples.length - 1, i + 1)];
    const vx = next.x - prev.x;
    const vz = next.z - prev.z;
    const tLen = Math.hypot(vx, vz) || 1;
    const tx = vx / tLen;
    const tz = vz / tLen;
    points.push({
      x: curr.x,
      z: curr.z,
      tx,
      tz,
      nx: -tz,
      nz: tx,
      arcLen: accLen,
      u: rawSamples.length > 1 ? i / (rawSamples.length - 1) : 0,
      terrainY: getBengaluruTerrainY(curr.x, curr.z),
    });
  }
  _silkLoopCache = points;
  _silkLoopTotalLen = Math.max(1, accLen);
  return { points, totalLength: _silkLoopTotalLen };
}

/**
 * Finds the closest point along the sampled Catmull-Rom road network.
 */
export function queryNearestCurvedRoad(
  x: number,
  z: number,
  roads: RoadSegment[],
  includeFlyovers = false
): CurvedRoadQueryResult | null {
  let best: CurvedRoadQueryResult | null = null;
  let bestDist = Infinity;

  for (let rIdx = 0; rIdx < roads.length; rIdx++) {
    const road = roads[rIdx];
    if (road.kind === 'metro' || road.points.length < 2) continue;
    if (!includeFlyovers && road.elevated) continue;

    const spine = getSampledRoadSpine(road);
    const pad = bestDist < Infinity ? bestDist : 4000;
    if (
      x < spine.minX - spine.halfWidth - pad ||
      x > spine.maxX + spine.halfWidth + pad ||
      z < spine.minZ - spine.halfWidth - pad ||
      z > spine.maxZ + spine.halfWidth + pad
    ) {
      // Only skip if we already have a closer candidate well inside another road's span
      if (best && (x < spine.minX - bestDist || x > spine.maxX + bestDist || z < spine.minZ - bestDist || z > spine.maxZ + bestDist)) {
        continue;
      }
    }

    const pts = spine.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const hit = distToSeg2D(x, z, a.x, a.z, b.x, b.z);
      if (hit.dist < bestDist) {
        bestDist = hit.dist;
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.hypot(dx, dz) || 1;
        const tx = dx / len;
        const tz = dz / len;
        const terrainY = a.terrainY + (b.terrainY - a.terrainY) * hit.t;
        const u = a.u + (b.u - a.u) * hit.t;
        best = {
          road,
          spine,
          segIndex: i,
          dist: hit.dist,
          t: hit.t,
          u,
          closestX: hit.cx,
          closestZ: hit.cz,
          tangentX: tx,
          tangentZ: tz,
          normalX: -tz,
          normalZ: tx,
          halfWidth: spine.halfWidth,
          terrainY,
          isElevated: Boolean(road.elevated),
        };
      }
    }
  }
  return best;
}

/**
 * Spatial terrain grading: levels terrain across road beds to eliminate cross-slope clipping,
 * and subtly carves Bengaluru lake basins inside WaterZones so lakes sit inside ground banks.
 */
export function getGradedGroundY(
  x: number,
  z: number,
  surfaceRoads: RoadSegment[],
  waterZones: WaterZone[]
): number {
  let y = getBengaluruTerrainY(x, z);

  // Subtle lake basin depression inside lakes
  for (let wIdx = 0; wIdx < waterZones.length; wIdx++) {
    const w = waterZones[wIdx];
    const nx = (x - w.x) / w.rx;
    const nz = (z - w.z) / w.rz;
    const r2 = nx * nx + nz * nz;
    if (r2 < 1.25) {
      const lakeBase = getBengaluruTerrainY(w.x, w.z) - 0.35;
      const r = Math.sqrt(r2);
      const t = THREE.MathUtils.smoothstep(r, 0.72, 1.12);
      y = lakeBase * (1 - t) + y * t;
    }
  }

  // Smoothly level terrain transverse to nearby surface roads
  let bestDist = Infinity;
  let bestRoadY = y;
  let bestHalfW = 8;

  for (let rIdx = 0; rIdx < surfaceRoads.length; rIdx++) {
    const road = surfaceRoads[rIdx];
    if (road.kind === 'metro' || road.elevated || road.points.length < 2) continue;
    const spine = getSampledRoadSpine(road);
    const margin = spine.halfWidth + 16;
    if (
      x < spine.minX - margin ||
      x > spine.maxX + margin ||
      z < spine.minZ - margin ||
      z > spine.maxZ + margin
    ) {
      continue;
    }

    const pts = spine.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const hit = distToSeg2D(x, z, a.x, a.z, b.x, b.z);
      if (hit.dist < bestHalfW + 14 && hit.dist < bestDist) {
        bestDist = hit.dist;
        bestHalfW = spine.halfWidth;
        bestRoadY = a.terrainY + (b.terrainY - a.terrainY) * hit.t;
      }
    }
  }

  if (bestDist < bestHalfW + 14) {
    const flatLimit = bestHalfW + 3.4;
    if (bestDist <= flatLimit) {
      return bestRoadY;
    }
    const blend = THREE.MathUtils.smoothstep(bestDist, flatLimit, bestHalfW + 14);
    return bestRoadY * (1 - blend) + y * blend;
  }

  return y;
}

/**
 * Checks whether (x, z) lies on or within extraClearance of any curved surface road corridor.
 */
export function isPointOnCurvedRoad(
  x: number,
  z: number,
  roads: RoadSegment[],
  extraClearance = 1.2
): boolean {
  for (let rIdx = 0; rIdx < roads.length; rIdx++) {
    const road = roads[rIdx];
    if (road.kind === 'metro' || road.points.length < 2) continue;
    const spine = getSampledRoadSpine(road);
    const halfW = spine.halfWidth + extraClearance;
    if (
      x < spine.minX - halfW ||
      x > spine.maxX + halfW ||
      z < spine.minZ - halfW ||
      z > spine.maxZ + halfW
    ) {
      continue;
    }
    const pts = spine.points;
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSeg2D(x, z, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z).dist <= halfW) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Computes elevated flyover deck Y using exact Catmull-Rom spines when on a flyover deck,
 * otherwise returns graded ground elevation matching the visual terrain/roadbed.
 */
export function getFlyoverOrRoadSurfaceY(
  x: number,
  z: number,
  roads: RoadSegment[],
  silkBoardLoop: Array<{ x: number; z: number }>,
  waterZones: WaterZone[]
): number {
  const groundY = getGradedGroundY(x, z, roads, waterZones);
  let bestY = groundY;

  const ecityFly = roads.find((r) => r.id === 'flyover_ecity');
  if (ecityFly && ecityFly.points.length >= 2) {
    const spine = getSampledRoadSpine(ecityFly);
    const pts = spine.points;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const hit = distToSeg2D(x, z, a.x, a.z, b.x, b.z);
      if (hit.dist <= 6.0) {
        const u = a.u + (b.u - a.u) * hit.t;
        const ramp = u < 0.14 ? u / 0.14 : u > 0.86 ? (1 - u) / 0.14 : 1;
        const deckCenterTerrainY = a.terrainY + (b.terrainY - a.terrainY) * hit.t;
        bestY = Math.max(bestY, deckCenterTerrainY + ramp * 6.8);
      }
    }
  }

  if (silkBoardLoop.length >= 2) {
    const { points: sbPts } = getSilkBoardFlyoverSpine(silkBoardLoop);
    for (let i = 0; i < sbPts.length - 1; i++) {
      const a = sbPts[i];
      const b = sbPts[i + 1];
      const hit = distToSeg2D(x, z, a.x, a.z, b.x, b.z);
      if (hit.dist <= 5.6) {
        const u = a.u + (b.u - a.u) * hit.t;
        const ramp = u < 0.22 ? u / 0.22 : u > 0.78 ? (1 - u) / 0.22 : 1;
        const deckCenterTerrainY = a.terrainY + (b.terrainY - a.terrainY) * hit.t;
        bestY = Math.max(bestY, deckCenterTerrainY + ramp * 5.6);
      }
    }
  }

  return bestY;
}

/**
 * Prevents vehicles already on an elevated flyover deck from sliding off side edges into mid-air,
 * clamping against concrete Jersey crash parapets along flyover_ecity and SILK_BOARD_FLYOVER_LOOP.
 */
export function constrainToFlyoverGuardrails(
  x: number,
  z: number,
  y: number,
  vehicleHalfWidth: number,
  roads: RoadSegment[],
  silkBoardLoop: Array<{ x: number; z: number }>
): { x: number; z: number; hit: boolean; nx: number; nz: number } {
  const candidates: Array<{ pts: SampledSpinePoint[]; halfW: number; deckHeight: number; rampEnd: number }> = [];

  const ecityFly = roads.find((r) => r.id === 'flyover_ecity');
  if (ecityFly && ecityFly.points.length >= 2) {
    candidates.push({
      pts: getSampledRoadSpine(ecityFly).points,
      halfW: ecityFly.width * 0.5,
      deckHeight: 6.8,
      rampEnd: 0.14,
    });
  }
  if (silkBoardLoop.length >= 2) {
    candidates.push({
      pts: getSilkBoardFlyoverSpine(silkBoardLoop).points,
      halfW: 5.4,
      deckHeight: 5.6,
      rampEnd: 0.22,
    });
  }

  for (const cand of candidates) {
    const pts = cand.pts;
    let bestDist = Infinity;
    let bestCx = x;
    let bestCz = z;
    let bestU = 0;
    let bestBaseY = 0;

    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const hit = distToSeg2D(x, z, a.x, a.z, b.x, b.z);
      if (hit.dist < bestDist) {
        bestDist = hit.dist;
        bestCx = hit.cx;
        bestCz = hit.cz;
        bestU = a.u + (b.u - a.u) * hit.t;
        bestBaseY = a.terrainY + (b.terrainY - a.terrainY) * hit.t;
      }
    }

    const ramp = bestU < cand.rampEnd ? bestU / cand.rampEnd : bestU > 1 - cand.rampEnd ? (1 - bestU) / cand.rampEnd : 1;
    const expectedDeckY = bestBaseY + ramp * cand.deckHeight;

    // Only enforce elevated crash parapet when vehicle is actually up on the elevated bridge span
    if (y > bestBaseY + 1.35 && Math.abs(y - expectedDeckY) < 2.4 && bestU > 0.05 && bestU < 0.95) {
      const maxLateral = Math.max(1.2, cand.halfW - vehicleHalfWidth - 0.35);
      if (bestDist > maxLateral && bestDist < cand.halfW + 3.2) {
        const dx = x - bestCx;
        const dz = z - bestCz;
        const dLen = Math.hypot(dx, dz) || 1;
        const nx = dx / dLen;
        const nz = dz / dLen;
        return {
          x: bestCx + nx * maxLateral,
          z: bestCz + nz * maxLateral,
          hit: true,
          nx: -nx,
          nz: -nz,
        };
      }
    }
  }

  return { x, z, hit: false, nx: 0, nz: 0 };
}

/**
 * Automatically detects all surface road junctions (shared endpoints + true 2D segment crossings)
 * across the Bengaluru road network so intersections receive dedicated aprons, crosswalks, and signals.
 */
export function detectSurfaceRoadJunctions(roads: RoadSegment[]): RoadJunction[] {
  const surfaceRoads = roads.filter((r) => r.kind !== 'metro' && !r.elevated && r.points.length >= 2);
  const spines = surfaceRoads.map((r) => getSampledRoadSpine(r));

  interface RawCluster {
    sumX: number;
    sumZ: number;
    count: number;
  }
  const clusters: RawCluster[] = [];

  const pushCandidate = (x: number, z: number) => {
    for (const c of clusters) {
      const cx = c.sumX / c.count;
      const cz = c.sumZ / c.count;
      if (Math.hypot(x - cx, z - cz) < 26) {
        c.sumX += x;
        c.sumZ += z;
        c.count += 1;
        return;
      }
    }
    clusters.push({ sumX: x, sumZ: z, count: 1 });
  };

  // 1. Check raw geo control nodes where multiple roads converge
  const nodeHits: Array<{ x: number; z: number; roadIds: Set<string> }> = [];
  for (const r of surfaceRoads) {
    for (const pt of r.points) {
      let matched = false;
      for (const nh of nodeHits) {
        if (Math.hypot(nh.x - pt.x, nh.z - pt.z) < 22) {
          nh.roadIds.add(r.id);
          matched = true;
          break;
        }
      }
      if (!matched) {
        nodeHits.push({ x: pt.x, z: pt.z, roadIds: new Set([r.id]) });
      }
    }
  }
  for (const nh of nodeHits) {
    if (nh.roadIds.size >= 2) {
      pushCandidate(nh.x, nh.z);
    }
  }

  // 2. Check true 2D crossings between sampled curved spines of distinct roads
  for (let i = 0; i < spines.length; i++) {
    const sA = spines[i];
    for (let j = i + 1; j < spines.length; j++) {
      const sB = spines[j];
      if (
        sA.maxX < sB.minX - 24 ||
        sA.minX > sB.maxX + 24 ||
        sA.maxZ < sB.minZ - 24 ||
        sA.minZ > sB.maxZ + 24
      ) {
        continue;
      }
      for (let a = 0; a < sA.points.length - 1; a++) {
        const p1 = sA.points[a];
        const p2 = sA.points[a + 1];
        for (let b = 0; b < sB.points.length - 1; b++) {
          const p3 = sB.points[b];
          const p4 = sB.points[b + 1];
          const hit = segmentIntersect2D(p1.x, p1.z, p2.x, p2.z, p3.x, p3.z, p4.x, p4.z);
          if (hit) {
            pushCandidate(hit.x, hit.z);
          }
        }
      }
    }
  }

  // Build refined junction arms for every cluster where >= 3 directional road arms meet
  const junctions: RoadJunction[] = [];
  for (const cl of clusters) {
    const jx = cl.sumX / cl.count;
    const jz = cl.sumZ / cl.count;
    let maxHalfW = 7.5;
    const rawArms: JunctionArm[] = [];

    for (const spine of spines) {
      const pts = spine.points;
      let bestDist = Infinity;
      let bestIdx = 0;
      let bestT = 0;
      for (let i = 0; i < pts.length - 1; i++) {
        const hit = distToSeg2D(jx, jz, pts[i].x, pts[i].z, pts[i + 1].x, pts[i + 1].z);
        if (hit.dist < bestDist) {
          bestDist = hit.dist;
          bestIdx = i;
          bestT = hit.t;
        }
      }
      if (bestDist <= spine.halfWidth + 14) {
        maxHalfW = Math.max(maxHalfW, spine.halfWidth);
        const uAlong = pts[bestIdx].u + (pts[bestIdx + 1].u - pts[bestIdx].u) * bestT;
        const tx = pts[bestIdx].tx;
        const tz = pts[bestIdx].tz;
        // Arm pointing backward along road (unless right at start)
        if (uAlong > 0.04) {
          rawArms.push({ roadId: spine.id, roadKind: spine.road.kind, dirX: -tx, dirZ: -tz, halfW: spine.halfWidth });
        }
        // Arm pointing forward along road (unless right at end)
        if (uAlong < 0.96) {
          rawArms.push({ roadId: spine.id, roadKind: spine.road.kind, dirX: tx, dirZ: tz, halfW: spine.halfWidth });
        }
      }
    }

    // Deduplicate collinear/overlapping arms within ~20 degrees
    const arms: JunctionArm[] = [];
    for (const arm of rawArms) {
      const dup = arms.some((existing) => existing.dirX * arm.dirX + existing.dirZ * arm.dirZ > 0.94);
      if (!dup) arms.push(arm);
    }

    if (arms.length >= 3) {
      const y = getBengaluruTerrainY(jx, jz);
      const radius = maxHalfW + 4.8;
      junctions.push({ x: jx, z: jz, y, radius, maxHalfW, arms });
    }
  }

  return junctions;
}
