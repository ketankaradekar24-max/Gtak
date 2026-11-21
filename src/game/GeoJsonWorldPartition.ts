import * as THREE from 'three';
import {
  WORLD_SCALE_METERS_PER_UNIT,
  getBengaluruTerrainY,
  latLonToWorld,
} from './bengaluruGeo';
import { queryNearestCurvedRoad } from './roadGeometry';
import {
  DistrictId,
  GeoJsonFeature,
  GeoJsonFeatureCollection,
  GraphicsQuality,
  MetroLineId,
  MetroStationDef,
  MetroStatus,
  NavigationRoute,
  RailBusStationDef,
  RoadPoint,
  RoadSegment,
  TransportMode,
  WaterZone,
  WorldPartitionStats,
} from './types';

export interface ImportedBuildingTransform {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  rotationY: number;
  kind: 'commercial' | 'it' | 'residential' | 'civic';
}

export interface ImportedWorldData {
  roads: RoadSegment[];
  waters: WaterZone[];
  buildings: ImportedBuildingTransform[];
  featureCount: number;
}

/**
 * Imports OpenStreetMap GeoJSON (WGS84 EPSG:4326) into World Partition game-world transforms,
 * computing bearings, road widths, elevated flyover/metro decks, water zones, and footprints.
 */
export class GeoJsonWorldPartitionImporter {
  public parseJsonString(raw: string): GeoJsonFeatureCollection | null {
    try {
      const parsed = JSON.parse(raw) as Partial<GeoJsonFeatureCollection>;
      if (parsed && parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        return parsed as GeoJsonFeatureCollection;
      }
      return null;
    } catch {
      return null;
    }
  }

  public convertCoordToWorld(lon: number, lat: number): RoadPoint & { y: number } {
    const w = latLonToWorld(lat, lon);
    const y = getBengaluruTerrainY(w.x, w.z);
    return { x: w.x, y, z: w.z, lat, lon };
  }

  public importGeoJson(geojson: GeoJsonFeatureCollection): ImportedWorldData {
    const roads: RoadSegment[] = [];
    const waters: WaterZone[] = [];
    const buildings: ImportedBuildingTransform[] = [];
    let featureCount = 0;

    geojson.features.forEach((feat, idx) => {
      featureCount++;
      const props = feat.properties || {};
      const fid = String(feat.id || props.id || `osm_feat_${idx}`);
      const name = String(props.name || fid);

      if (feat.geometry.type === 'LineString' || feat.geometry.type === 'MultiLineString') {
        const lines =
          feat.geometry.type === 'LineString'
            ? [feat.geometry.coordinates]
            : feat.geometry.coordinates;

        lines.forEach((coords, subIdx) => {
          if (coords.length < 2) return;
          const points: RoadPoint[] = coords.map(([lon, lat]) => {
            const p = latLonToWorld(lat, lon);
            return { x: p.x, z: p.z, lat, lon };
          });

          const isMetro =
            props.railway === 'subway' ||
            props.railway === 'light_rail' ||
            typeof props.metroLine === 'string';
          const hw = String(props.highway || '');
          const isBridge = props.bridge === 'yes' || Number(props.layer || 0) > 0;

          let kind: RoadSegment['kind'] = 'secondary';
          if (isMetro) kind = 'metro';
          else if (isBridge && (hw === 'motorway' || hw === 'trunk' || fid.includes('flyover'))) {
            kind = 'flyover';
          } else if (hw === 'trunk' || hw === 'motorway') {
            kind = 'highway';
          } else if (hw === 'primary') {
            kind = 'arterial';
          }

          const lanes = Number(props.lanes || 0);
          const explicitW = Number(props.width || 0);
          const width =
            explicitW > 0
              ? explicitW
              : lanes > 0
              ? Math.max(8, lanes * 3.6)
              : kind === 'metro'
              ? 7.2
              : kind === 'highway'
              ? 20
              : kind === 'flyover'
              ? 11
              : kind === 'arterial'
              ? 17
              : 14;

          roads.push({
            id: lines.length > 1 ? `${fid}_${subIdx}` : fid,
            name,
            kind,
            points,
            width,
            elevated: isMetro || isBridge,
            metroLine: props.metroLine as MetroLineId | undefined,
            metroStatus: (props.metroStatus as MetroStatus | undefined) || (isMetro ? 'operational' : undefined),
          });
        });
      } else if (feat.geometry.type === 'Point') {
        const [lon, lat] = feat.geometry.coordinates;
        const p = this.convertCoordToWorld(lon, lat);
        if (props.natural === 'water' || props.water) {
          waters.push({
            id: fid,
            name,
            lat,
            lon,
            x: p.x,
            z: p.z,
            rx: Number(props.rx || 36),
            rz: Number(props.rz || 28),
          });
        } else if (props.building) {
          buildings.push({
            id: fid,
            name,
            x: p.x,
            y: p.y,
            z: p.z,
            width: Number(props.width || 18),
            depth: Number(props.depth || 16),
            height: Number(props.height || Number(props['building:levels'] || 4) * 3.4),
            rotationY: Number(props.bearing || 0),
            kind: props.building === 'commercial' ? 'commercial' : props.building === 'office' ? 'it' : 'residential',
          });
        }
      } else if (feat.geometry.type === 'Polygon' && feat.geometry.coordinates[0]?.length >= 3) {
        const ring = feat.geometry.coordinates[0];
        let minX = Infinity;
        let maxX = -Infinity;
        let minZ = Infinity;
        let maxZ = -Infinity;
        const pts = ring.map(([lon, lat]) => {
          const w = latLonToWorld(lat, lon);
          if (w.x < minX) minX = w.x;
          if (w.x > maxX) maxX = w.x;
          if (w.z < minZ) minZ = w.z;
          if (w.z > maxZ) maxZ = w.z;
          return w;
        });
        const cx = (minX + maxX) * 0.5;
        const cz = (minZ + maxZ) * 0.5;
        const rx = Math.max(8, (maxX - minX) * 0.5);
        const rz = Math.max(8, (maxZ - minZ) * 0.5);
        if (props.natural === 'water' || props.water) {
          const avgLon = ring.reduce((s, c) => s + c[0], 0) / ring.length;
          const avgLat = ring.reduce((s, c) => s + c[1], 0) / ring.length;
          waters.push({ id: fid, name, lat: avgLat, lon: avgLon, x: cx, z: cz, rx, rz });
        } else if (props.building && pts.length >= 2) {
          const dx = pts[1].x - pts[0].x;
          const dz = pts[1].z - pts[0].z;
          buildings.push({
            id: fid,
            name,
            x: cx,
            y: getBengaluruTerrainY(cx, cz),
            z: cz,
            width: Math.min(48, rx * 2),
            depth: Math.min(48, rz * 2),
            height: Number(props.height || Number(props['building:levels'] || 5) * 3.5),
            rotationY: Math.atan2(dx, dz),
            kind: props.building === 'commercial' ? 'commercial' : props.building === 'office' ? 'it' : 'residential',
          });
        }
      }
    });

    return { roads, waters, buildings, featureCount };
  }

  public static extractFeaturesSummary(feat: GeoJsonFeature): string {
    return String(feat.properties?.name || feat.id || feat.geometry.type);
  }
}

interface PartitionCell {
  key: string;
  cx: number;
  cz: number;
  highObjects: THREE.Object3D[];
  mediumObjects: THREE.Object3D[];
}

interface DistrictHlodEntry {
  id: DistrictId;
  x: number;
  z: number;
  highGroup: THREE.Group;
  hlodProxyGroup: THREE.Group;
}

/**
 * Spatial World Partition grid + HLOD streaming manager.
 * Streams detailed district clusters, road props, landmarks, and HLOD proxies based on player distance.
 */
export class WorldPartitionManager {
  public readonly cellSize = 320;
  private cells = new Map<string, PartitionCell>();
  private hlods: DistrictHlodEntry[] = [];
  private importedRoadCount = 0;
  private importedFeatureCount = 0;
  private lastStats: WorldPartitionStats = {
    totalCells: 0,
    activeHighCells: 0,
    activeMediumCells: 0,
    culledCells: 0,
    importedRoadCount: 0,
    importedFeatureCount: 0,
  };

  public setImportCounts(roads: number, features: number): void {
    this.importedRoadCount = roads;
    this.importedFeatureCount = features;
    this.lastStats.importedRoadCount = roads;
    this.lastStats.importedFeatureCount = features;
  }

  private getCell(x: number, z: number): PartitionCell {
    const gx = Math.floor(x / this.cellSize);
    const gz = Math.floor(z / this.cellSize);
    const key = `${gx}_${gz}`;
    let cell = this.cells.get(key);
    if (!cell) {
      cell = {
        key,
        cx: (gx + 0.5) * this.cellSize,
        cz: (gz + 0.5) * this.cellSize,
        highObjects: [],
        mediumObjects: [],
      };
      this.cells.set(key, cell);
    }
    return cell;
  }

  public registerObject(x: number, z: number, obj: THREE.Object3D, tier: 'high' | 'medium'): void {
    const cell = this.getCell(x, z);
    if (tier === 'high') cell.highObjects.push(obj);
    else cell.mediumObjects.push(obj);
  }

  public registerDistrictHlod(id: DistrictId, x: number, z: number, highGroup: THREE.Group, hlodProxyGroup: THREE.Group): void {
    this.hlods.push({ id, x, z, highGroup, hlodProxyGroup });
  }

  public updateStreaming(playerX: number, playerZ: number, quality: GraphicsQuality): WorldPartitionStats {
    const highRadius = quality === 'low' ? 360 : quality === 'medium' ? 540 : quality === 'high' ? 820 : 1250;
    const medRadius = quality === 'low' ? 900 : quality === 'medium' ? 1400 : quality === 'high' ? 2100 : 3200;

    let activeHighCells = 0;
    let activeMediumCells = 0;
    let culledCells = 0;

    this.cells.forEach((cell) => {
      const dist = Math.hypot(cell.cx - playerX, cell.cz - playerZ);
      const showHigh = dist <= highRadius;
      const showMed = dist <= medRadius;

      if (showHigh) activeHighCells++;
      else if (showMed) activeMediumCells++;
      else culledCells++;

      for (let i = 0; i < cell.highObjects.length; i++) {
        cell.highObjects[i].visible = showHigh;
      }
      for (let i = 0; i < cell.mediumObjects.length; i++) {
        cell.mediumObjects[i].visible = showMed;
      }
    });

    const hlodSwitchDist = quality === 'low' ? 380 : quality === 'medium' ? 580 : 880;
    for (let i = 0; i < this.hlods.length; i++) {
      const h = this.hlods[i];
      const dist = Math.hypot(h.x - playerX, h.z - playerZ);
      const showDetail = dist <= hlodSwitchDist;
      h.highGroup.visible = showDetail;
      h.hlodProxyGroup.visible = !showDetail && dist <= medRadius;
    }

    this.lastStats = {
      totalCells: this.cells.size,
      activeHighCells,
      activeMediumCells,
      culledCells,
      importedRoadCount: this.importedRoadCount,
      importedFeatureCount: this.importedFeatureCount,
    };
    return this.lastStats;
  }

  public getStats(): WorldPartitionStats {
    return this.lastStats;
  }
}

interface GraphNode {
  id: number;
  x: number;
  z: number;
  edges: Array<{ to: number; weight: number; oneWay?: boolean }>;
}

export interface NearestRoadResult {
  road: RoadSegment;
  segIndex: number;
  dist: number;
  t: number;
  closestX: number;
  closestZ: number;
  tangentX: number;
  tangentZ: number;
  normalX: number;
  normalZ: number;
  halfWidth: number;
  isElevated: boolean;
}

/**
 * Road-graph Dijkstra router + Namma Metro operational route planner + AI road corridor queries.
 */
export class RoadNetworkRouter {
  private nodes: GraphNode[] = [];
  private roads: RoadSegment[] = [];

  constructor(roads: RoadSegment[]) {
    this.rebuild(roads);
  }

  public rebuild(roads: RoadSegment[]): void {
    this.nodes = [];
    this.roads = roads;
    const roadPolylines = roads.filter((r) => r.kind !== 'metro' && r.points.length >= 2);

    const findOrCreateNode = (x: number, z: number): number => {
      for (let i = 0; i < this.nodes.length; i++) {
        if (Math.hypot(this.nodes[i].x - x, this.nodes[i].z - z) < 20) {
          return i;
        }
      }
      const id = this.nodes.length;
      this.nodes.push({ id, x, z, edges: [] });
      return id;
    };

    const addEdge = (a: number, b: number, oneWay = false) => {
      if (a === b) return;
      const w = Math.hypot(this.nodes[a].x - this.nodes[b].x, this.nodes[a].z - this.nodes[b].z);
      if (!this.nodes[a].edges.some((e) => e.to === b)) {
        this.nodes[a].edges.push({ to: b, weight: w, oneWay });
      }
      if (!oneWay && !this.nodes[b].edges.some((e) => e.to === a)) {
        this.nodes[b].edges.push({ to: a, weight: w, oneWay: false });
      }
    };

    roadPolylines.forEach((road) => {
      let prevId = -1;
      for (let i = 0; i < road.points.length; i++) {
        const pt = road.points[i];
        const nid = findOrCreateNode(pt.x, pt.z);
        if (prevId >= 0) {
          addEdge(prevId, nid, Boolean(road.oneWay));
        }
        prevId = nid;
      }
    });

    // Connect close arterial intersections (< 55 units) to guarantee full city connectivity
    for (let i = 0; i < this.nodes.length; i++) {
      for (let j = i + 1; j < this.nodes.length; j++) {
        const d = Math.hypot(this.nodes[i].x - this.nodes[j].x, this.nodes[i].z - this.nodes[j].z);
        if (d < 55) addEdge(i, j, false);
      }
    }
  }

  public getRoadSegments(): RoadSegment[] {
    return this.roads;
  }

  public getNearestRoadInfo(x: number, z: number, includeFlyovers = false): NearestRoadResult | null {
    const res = queryNearestCurvedRoad(x, z, this.roads, includeFlyovers);
    if (!res) return null;
    return {
      road: res.road,
      segIndex: res.segIndex,
      dist: res.dist,
      t: res.t,
      closestX: res.closestX,
      closestZ: res.closestZ,
      tangentX: res.tangentX,
      tangentZ: res.tangentZ,
      normalX: res.normalX,
      normalZ: res.normalZ,
      halfWidth: res.halfWidth,
      isElevated: res.isElevated,
    };
  }

  public getConnectedIntersectionTargets(
    x: number,
    z: number,
    heading: number,
    avoidUturn = true
  ): Array<{ x: number; z: number; heading: number }> {
    if (this.nodes.length === 0) return [];
    const nid = this.nearestNode(x, z);
    const node = this.nodes[nid];
    if (Math.hypot(node.x - x, node.z - z) > 42) return [];
    const fx = Math.sin(heading);
    const fz = Math.cos(heading);
    const out: Array<{ x: number; z: number; heading: number }> = [];
    for (const e of node.edges) {
      const target = this.nodes[e.to];
      const dx = target.x - node.x;
      const dz = target.z - node.z;
      const len = Math.hypot(dx, dz);
      if (len < 1) continue;
      const dot = (dx / len) * fx + (dz / len) * fz;
      if (avoidUturn && dot < -0.65 && node.edges.length > 1) continue;
      out.push({ x: target.x, z: target.z, heading: Math.atan2(dx, dz) });
    }
    return out;
  }

  private nearestNode(x: number, z: number): number {
    let best = 0;
    let bestD = Infinity;
    for (let i = 0; i < this.nodes.length; i++) {
      const d = Math.hypot(this.nodes[i].x - x, this.nodes[i].z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  public planRoute(
    sx: number,
    sz: number,
    tx: number,
    tz: number,
    destinationName: string,
    mode: TransportMode,
    metroStations: MetroStationDef[],
    railBusStations: RailBusStationDef[]
  ): NavigationRoute {
    if (mode === 'metro') {
      const operational = metroStations.filter((s) => s.status === 'operational');
      if (operational.length >= 2) {
        const startSt = operational.reduce((a, b) =>
          Math.hypot(a.x - sx, a.z - sz) < Math.hypot(b.x - sx, b.z - sz) ? a : b
        );
        const endSt = operational.reduce((a, b) =>
          Math.hypot(a.x - tx, a.z - tz) < Math.hypot(b.x - tx, b.z - tz) ? a : b
        );
        const metroRoute = this.findMetroPath(startSt, endSt, operational);
        const pts: Array<{ x: number; z: number }> = [
          { x: sx, z: sz },
          ...metroRoute.map((st) => ({ x: st.x, z: st.z })),
          { x: tx, z: tz },
        ];
        const distUnits = this.polylineUnits(pts);
        const distKm = Math.round(((distUnits * WORLD_SCALE_METERS_PER_UNIT) / 1000) * 100) / 100;
        const etaMinutes = Math.max(2, Math.round((distKm / 34) * 60 + metroRoute.length * 1.1));
        return {
          mode,
          destinationName,
          targetX: tx,
          targetZ: tz,
          distanceKm: distKm,
          etaMinutes,
          pathPoints: pts,
          stationStops: metroRoute.map((s) => `${s.name} (${s.line.toUpperCase()})`),
          summary: `Namma Metro via ${metroRoute.length} operational stations (${startSt.name} → ${endSt.name})`,
        };
      }
    }

    if (mode === 'rail' || mode === 'bus') {
      const pool = railBusStations.filter((s) => s.kind === mode);
      if (pool.length >= 2) {
        const startHub = pool.reduce((a, b) =>
          Math.hypot(a.x - sx, a.z - sz) < Math.hypot(b.x - sx, b.z - sz) ? a : b
        );
        const endHub = pool.reduce((a, b) =>
          Math.hypot(a.x - tx, a.z - tz) < Math.hypot(b.x - tx, b.z - tz) ? a : b
        );
        const roadLeg = this.findRoadDijkstra(startHub.x, startHub.z, endHub.x, endHub.z);
        const pts = [{ x: sx, z: sz }, ...roadLeg, { x: tx, z: tz }];
        const distUnits = this.polylineUnits(pts);
        const distKm = Math.round(((distUnits * WORLD_SCALE_METERS_PER_UNIT) / 1000) * 100) / 100;
        const speedKmh = mode === 'rail' ? 46 : 24;
        const etaMinutes = Math.max(3, Math.round((distKm / speedKmh) * 60 + 4));
        return {
          mode,
          destinationName,
          targetX: tx,
          targetZ: tz,
          distanceKm: distKm,
          etaMinutes,
          pathPoints: pts,
          stationStops: startHub.id === endHub.id ? [startHub.name] : [startHub.name, endHub.name],
          summary: `${mode === 'rail' ? 'Bengaluru Suburban Rail' : 'BMTC Express'} (${startHub.name} → ${endHub.name})`,
        };
      }
    }

    // Road Dijkstra for Walk / Drive / Auto
    const roadPts = this.findRoadDijkstra(sx, sz, tx, tz);
    const pts = [{ x: sx, z: sz }, ...roadPts, { x: tx, z: tz }];
    const distUnits = this.polylineUnits(pts);
    const distKm = Math.round(((distUnits * WORLD_SCALE_METERS_PER_UNIT) / 1000) * 100) / 100;
    const speedKmh = mode === 'walk' ? 5 : mode === 'auto' ? 28 : 42;
    const etaMinutes = Math.max(1, Math.round((distKm / speedKmh) * 60));

    return {
      mode,
      destinationName,
      targetX: tx,
      targetZ: tz,
      distanceKm: distKm,
      etaMinutes,
      pathPoints: pts,
      summary: `${mode === 'walk' ? 'Walking' : mode === 'auto' ? 'Namma Auto' : 'Road GPS'} · ${distKm.toFixed(1)} km`,
    };
  }

  private findRoadDijkstra(sx: number, sz: number, tx: number, tz: number): Array<{ x: number; z: number }> {
    if (this.nodes.length === 0) return [{ x: sx, z: sz }, { x: tx, z: tz }];
    const startId = this.nearestNode(sx, sz);
    const endId = this.nearestNode(tx, tz);
    if (startId === endId) return [{ x: this.nodes[startId].x, z: this.nodes[startId].z }];

    const n = this.nodes.length;
    const dist = new Float64Array(n).fill(Infinity);
    const prev = new Int32Array(n).fill(-1);
    const visited = new Uint8Array(n);
    dist[startId] = 0;

    for (let iter = 0; iter < n; iter++) {
      let u = -1;
      let best = Infinity;
      for (let i = 0; i < n; i++) {
        if (!visited[i] && dist[i] < best) {
          best = dist[i];
          u = i;
        }
      }
      if (u === -1 || u === endId) break;
      visited[u] = 1;
      const edges = this.nodes[u].edges;
      for (let k = 0; k < edges.length; k++) {
        const e = edges[k];
        const alt = dist[u] + e.weight;
        if (alt < dist[e.to]) {
          dist[e.to] = alt;
          prev[e.to] = u;
        }
      }
    }

    const path: Array<{ x: number; z: number }> = [];
    let cur = endId;
    while (cur !== -1) {
      path.push({ x: this.nodes[cur].x, z: this.nodes[cur].z });
      if (cur === startId) break;
      cur = prev[cur];
    }
    path.reverse();
    return path;
  }

  private findMetroPath(
    start: MetroStationDef,
    end: MetroStationDef,
    stations: MetroStationDef[]
  ): MetroStationDef[] {
    if (start.id === end.id) return [start];
    const adj = new Map<string, string[]>();
    stations.forEach((s) => adj.set(s.id, []));

    // Adjacent stations on same line
    (['purple', 'green', 'yellow'] as MetroLineId[]).forEach((line) => {
      const lineSt = stations.filter((s) => s.line === line).sort((a, b) => a.order - b.order);
      for (let i = 0; i < lineSt.length - 1; i++) {
        adj.get(lineSt[i].id)!.push(lineSt[i + 1].id);
        adj.get(lineSt[i + 1].id)!.push(lineSt[i].id);
      }
    });

    // Interchanges within 16 world units (e.g., Majestic Purple<->Green, RV Road Green<->Yellow)
    for (let i = 0; i < stations.length; i++) {
      for (let j = i + 1; j < stations.length; j++) {
        if (Math.hypot(stations[i].x - stations[j].x, stations[i].z - stations[j].z) < 16) {
          adj.get(stations[i].id)!.push(stations[j].id);
          adj.get(stations[j].id)!.push(stations[i].id);
        }
      }
    }

    // BFS shortest station hops
    const queue: string[] = [start.id];
    const parent = new Map<string, string | null>([[start.id, null]]);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      if (cur === end.id) break;
      for (const nxt of adj.get(cur) || []) {
        if (!parent.has(nxt)) {
          parent.set(nxt, cur);
          queue.push(nxt);
        }
      }
    }

    const res: MetroStationDef[] = [];
    let c: string | null = end.id;
    while (c) {
      const st = stations.find((s) => s.id === c);
      if (st) res.push(st);
      c = parent.get(c) ?? null;
    }
    res.reverse();
    return res.length > 0 ? res : [start, end];
  }

  public findRoadWaypoints(
    sx: number,
    sz: number,
    tx: number,
    tz: number,
    _respectOneWay = true
  ): Array<{ x: number; z: number }> {
    const roadPts = this.findRoadDijkstra(sx, sz, tx, tz);
    return [...roadPts, { x: tx, z: tz }];
  }

  public findMetroRouteStations(
    fromId: string,
    toId: string,
    stations: MetroStationDef[]
  ): MetroStationDef[] {
    const operational = stations.filter((s) => s.status === 'operational');
    const start = operational.find((s) => s.id === fromId);
    const end = operational.find((s) => s.id === toId);
    if (!start || !end) return [];
    return this.findMetroPath(start, end, operational);
  }

  private polylineUnits(pts: Array<{ x: number; z: number }>): number {
    let total = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      total += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].z - pts[i].z);
    }
    return total;
  }
}
