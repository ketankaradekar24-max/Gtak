import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bus,
  Car,
  Compass,
  Crosshair,
  Footprints,
  Globe,
  MapPin,
  Minus,
  Navigation,
  Plus,
  RotateCcw,
  Search,
  TrainFront,
  TrainTrack,
  Upload,
  X,
} from 'lucide-react';
import {
  COLLECTIBLES,
  DISTRICTS,
  LANDMARK_MARKERS,
  METRO_STATIONS,
  MISSIONS,
  RAIL_BUS_STATIONS,
  WATER_ZONES,
  WORLD_HALF_SIZE,
} from '../game/bengaluruData';
import { validateBengaluruGeography } from '../game/bengaluruGeo';
import {
  DistrictId,
  HudSnapshot,
  NavigationRoute,
  RoadSegment,
  TransportMode,
} from '../game/types';

interface CityMapModalProps {
  hud: HudSnapshot;
  allRoads: RoadSegment[];
  onClose: () => void;
  onSetWaypoint: (x: number, z: number, label: string) => void;
  onClearWaypoint: () => void;
  onFastTravel: (districtId: DistrictId) => void;
  onStartMission: (missionId: string) => void;
  onPlanRoute: (tx: number, tz: number, label: string, mode: TransportMode) => NavigationRoute;
  onStartNavigation: (route: NavigationRoute) => void;
  onTravelRoute: (route: NavigationRoute) => void;
  onCancelNavigation: () => void;
  onImportGeoJson: (rawJson: string) => {
    ok: boolean;
    roadsAdded: number;
    features: number;
    message: string;
  };
}

interface SearchTarget {
  id: string;
  name: string;
  subtitle: string;
  category: 'District' | 'Landmark' | 'Metro' | 'Rail/Bus';
  x: number;
  z: number;
  districtId?: DistrictId;
  underConstruction?: boolean;
}

const REGION_ORDER: Array<'Central' | 'East' | 'South' | 'North' | 'West'> = [
  'Central',
  'East',
  'South',
  'North',
  'West',
];

const TRANSPORT_MODES: Array<{ id: TransportMode; label: string; icon: React.ReactNode }> = [
  { id: 'drive', label: 'Drive', icon: <Car className="h-3.5 w-3.5" /> },
  { id: 'auto', label: 'Auto', icon: <Compass className="h-3.5 w-3.5" /> },
  { id: 'metro', label: 'Metro', icon: <TrainFront className="h-3.5 w-3.5" /> },
  { id: 'bus', label: 'BMTC', icon: <Bus className="h-3.5 w-3.5" /> },
  { id: 'rail', label: 'Rail', icon: <TrainTrack className="h-3.5 w-3.5" /> },
  { id: 'walk', label: 'Walk', icon: <Footprints className="h-3.5 w-3.5" /> },
];

const SAMPLE_OSM_GEOJSON = JSON.stringify(
  {
    type: 'FeatureCollection',
    name: 'Custom Bengaluru OSM Export',
    features: [
      {
        type: 'Feature',
        id: 'custom_airport_link',
        properties: { name: 'Sadahalli–Devanahalli Link Rd', highway: 'primary', lanes: 4 },
        geometry: {
          type: 'LineString',
          coordinates: [
            [77.638, 13.152],
            [77.674, 13.175],
            [77.7066, 13.1986],
          ],
        },
      },
    ],
  },
  null,
  2
);

export const CityMapModal: React.FC<CityMapModalProps> = ({
  hud,
  allRoads,
  onClose,
  onSetWaypoint,
  onClearWaypoint,
  onFastTravel,
  onStartMission,
  onPlanRoute,
  onStartNavigation,
  onTravelRoute,
  onCancelNavigation,
  onImportGeoJson,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);
  const [rightTab, setRightTab] = useState<'atlas' | 'gis'>('atlas');
  const [searchQuery, setSearchQuery] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode>('drive');
  const [selectedTarget, setSelectedTarget] = useState<{ x: number; z: number; label: string } | null>(null);
  const [previewRoute, setPreviewRoute] = useState<NavigationRoute | null>(hud.activeRoute);

  // Interactive map view controls (zoom, pan, rotate)
  const [zoom, setZoom] = useState(1.25);
  const [panX, setPanX] = useState(0);
  const [panZ, setPanZ] = useState(0);
  const [rotationDeg, setRotationDeg] = useState(0);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; moved: number }>({
    active: false,
    startX: 0,
    startY: 0,
    moved: 0,
  });

  // GeoJSON importer state
  const [geoJsonInput, setGeoJsonInput] = useState(SAMPLE_OSM_GEOJSON);
  const [importStatus, setImportStatus] = useState<string | null>(null);

  const geoReport = useMemo(() => validateBengaluruGeography(), []);
  const mapSize = 620;

  // Unified searchable directory (35 Districts + 15 Landmarks + 29 Metro Stations + 8 Rail/Bus Hubs)
  const searchDirectory = useMemo<SearchTarget[]>(() => {
    const items: SearchTarget[] = [];
    DISTRICTS.forEach((d) =>
      items.push({
        id: `d_${d.id}`,
        name: d.name,
        subtitle: `${d.region} Bengaluru · ${d.kannadaName}`,
        category: 'District',
        x: d.x,
        z: d.z,
        districtId: d.id,
      })
    );
    LANDMARK_MARKERS.filter((l) => l.type === 'landmark').forEach((l) =>
      items.push({
        id: `l_${l.id}`,
        name: l.name,
        subtitle: l.description,
        category: 'Landmark',
        x: l.x,
        z: l.z,
        districtId: l.district,
      })
    );
    METRO_STATIONS.forEach((m) =>
      items.push({
        id: `m_${m.id}`,
        name: `${m.name} Metro`,
        subtitle: `${m.line.toUpperCase()} Line · ${
          m.status === 'operational' ? 'Operational' : 'Under Construction'
        }`,
        category: 'Metro',
        x: m.x,
        z: m.z,
        underConstruction: m.status === 'under_construction',
      })
    );
    RAIL_BUS_STATIONS.forEach((r) =>
      items.push({
        id: `r_${r.id}`,
        name: r.name,
        subtitle: `${r.kind === 'rail' ? 'Railway Terminal' : 'BMTC Hub'} · ${r.platforms} Platforms`,
        category: 'Rail/Bus',
        x: r.x,
        z: r.z,
        districtId: r.district,
      })
    );
    return items;
  }, []);

  const filteredSearch = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return searchDirectory
      .filter((item) => item.name.toLowerCase().includes(q) || item.subtitle.toLowerCase().includes(q))
      .slice(0, 12);
  }, [searchDirectory, searchQuery]);

  // Recompute preview route whenever target or transportMode changes
  useEffect(() => {
    if (!selectedTarget) return;
    const route = onPlanRoute(selectedTarget.x, selectedTarget.z, selectedTarget.label, transportMode);
    setPreviewRoute(route);
  }, [selectedTarget, transportMode, onPlanRoute]);

  const selectDestination = (tx: number, tz: number, label: string, districtId?: DistrictId) => {
    setSelectedTarget({ x: tx, z: tz, label });
    if (districtId) setSelectedDistrict(districtId);
    setPanX(tx);
    setPanZ(tz);
    if (zoom < 1.8) setZoom(2.1);
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const half = mapSize * 0.5;
    const baseScale = mapSize / (WORLD_HALF_SIZE * 2);
    const pxPerUnit = baseScale * zoom;
    const rad = (rotationDeg * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);

    const toPx = (wx: number, wz: number): [number, number] => {
      const dx = (wx - panX) * pxPerUnit;
      const dz = (wz - panZ) * pxPerUnit;
      return [half + dx * cosR - dz * sinR, half + dx * sinR + dz * cosR];
    };

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, mapSize, mapSize);

    // Subtle coordinate grid in world space
    ctx.strokeStyle = 'rgba(148,163,184,0.07)';
    ctx.lineWidth = 1;
    for (let g = -2400; g <= 2400; g += 400) {
      const [x1, y1] = toPx(g, -2400);
      const [x2, y2] = toPx(g, 2400);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
      const [x3, y3] = toPx(-2400, g);
      const [x4, y4] = toPx(2400, g);
      ctx.beginPath();
      ctx.moveTo(x3, y3);
      ctx.lineTo(x4, y4);
      ctx.stroke();
    }

    // Water bodies (6 real Bengaluru lakes)
    ctx.fillStyle = '#0284c7';
    WATER_ZONES.forEach((w) => {
      const [x, y] = toPx(w.x, w.z);
      const rx = Math.max(3, w.rx * pxPerUnit);
      const rz = Math.max(3, w.rz * pxPerUnit);
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rz, rad, 0, Math.PI * 2);
      ctx.fill();
    });

    // Real Bengaluru Road Polylines (Highways, Arterials, Secondary, Flyovers, Custom GeoJSON)
    allRoads.forEach((r) => {
      if (r.kind === 'metro' || r.points.length < 2) return;
      ctx.strokeStyle = r.elevated
        ? '#f59e0b'
        : r.kind === 'highway'
        ? '#64748b'
        : r.kind === 'arterial'
        ? '#475569'
        : '#334155';
      ctx.lineWidth = Math.max(1.8, (r.kind === 'highway' ? 3.5 : 2.2) * Math.sqrt(zoom));
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      r.points.forEach((pt, idx) => {
        const [px, py] = toPx(pt.x, pt.z);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    });

    // All 5 Namma Metro Corridors (Purple/Green/Yellow Operational, Pink/Blue Under Construction)
    allRoads.forEach((r) => {
      if (r.kind !== 'metro' || r.points.length < 2) return;
      const isUnderConst = r.metroStatus === 'under_construction';
      ctx.strokeStyle =
        r.metroLine === 'green'
          ? '#22c55e'
          : r.metroLine === 'yellow'
          ? '#eab308'
          : r.metroLine === 'pink'
          ? 'rgba(236, 72, 153, 0.72)'
          : r.metroLine === 'blue'
          ? 'rgba(56, 189, 248, 0.72)'
          : '#a855f7';
      ctx.lineWidth = isUnderConst ? 1.8 : 2.5;
      ctx.setLineDash(isUnderConst ? [3, 5] : [7, 4]);
      ctx.beginPath();
      r.points.forEach((pt, idx) => {
        const [px, py] = toPx(pt.x, pt.z);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    });

    // 29 Namma Metro Stations
    METRO_STATIONS.forEach((ms) => {
      const [sx, sy] = toPx(ms.x, ms.z);
      if (sx < -20 || sx > mapSize + 20 || sy < -20 || sy > mapSize + 20) return;
      ctx.fillStyle =
        ms.line === 'green'
          ? '#22c55e'
          : ms.line === 'yellow'
          ? '#eab308'
          : ms.line === 'pink'
          ? '#ec4899'
          : ms.line === 'blue'
          ? '#38bdf8'
          : '#a855f7';
      ctx.beginPath();
      ctx.arc(sx, sy, ms.status === 'operational' ? 3.4 : 2.5, 0, Math.PI * 2);
      ctx.fill();
      if (ms.status === 'under_construction') {
        ctx.strokeStyle = '#fb923c';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    // 8 Rail & BMTC Bus Hubs
    RAIL_BUS_STATIONS.forEach((rb) => {
      const [rx, ry] = toPx(rb.x, rb.z);
      ctx.fillStyle = rb.kind === 'rail' ? '#facc15' : '#fb923c';
      ctx.fillRect(rx - 3.5, ry - 3.5, 7, 7);
    });

    // 15 Famous Landmarks + Utilities
    LANDMARK_MARKERS.forEach((lm) => {
      const [lx, ly] = toPx(lm.x, lm.z);
      if (lm.type === 'landmark') {
        ctx.fillStyle = '#f8fafc';
        ctx.beginPath();
        ctx.moveTo(lx, ly - 5);
        ctx.lineTo(lx + 4, ly + 3);
        ctx.lineTo(lx - 4, ly + 3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillStyle =
          lm.type === 'garage'
            ? '#06b6d4'
            : lm.type === 'safehouse'
            ? '#22c55e'
            : lm.type === 'interior'
            ? '#a855f7'
            : lm.type === 'petrol'
            ? '#f59e0b'
            : '#94a3b8';
        ctx.fillRect(lx - 2.5, ly - 2.5, 5, 5);
      }
    });

    // 35 District pins & labels
    ctx.font = '600 9.5px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    DISTRICTS.forEach((d) => {
      const [dx, dy] = toPx(d.x, d.z);
      if (dx < -40 || dx > mapSize + 40 || dy < -20 || dy > mapSize + 20) return;
      const discovered = hud.discoveredDistricts.includes(d.id);
      const isSelected = selectedDistrict === d.id;
      ctx.fillStyle = isSelected
        ? '#fbbf24'
        : discovered
        ? 'rgba(248, 250, 252, 0.92)'
        : 'rgba(148, 163, 184, 0.65)';
      ctx.fillText(d.name, dx, dy - 7);
      ctx.beginPath();
      ctx.arc(dx, dy, isSelected ? 4 : 2.2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Collectibles
    COLLECTIBLES.forEach((c) => {
      if (hud.collectedIds.includes(c.id)) return;
      const [cx, cy] = toPx(c.x, c.z);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(cx, cy, 2.3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Mission markers
    MISSIONS.forEach((m) => {
      if (hud.completedMissions.includes(m.id)) return;
      const [mx, my] = toPx(m.startX, m.startZ);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(mx, my, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090d16';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('M', mx, my + 3);
    });

    // Active / Preview Route Polyline
    const routeToDraw = previewRoute || hud.activeRoute;
    if (routeToDraw && routeToDraw.pathPoints.length >= 2) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 3.2;
      ctx.setLineDash([7, 4]);
      ctx.beginPath();
      routeToDraw.pathPoints.forEach((pt, idx) => {
        const [rx, ry] = toPx(pt.x, pt.z);
        if (idx === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      });
      ctx.stroke();
      ctx.setLineDash([]);

      const [tx, ty] = toPx(routeToDraw.targetX, routeToDraw.targetZ);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(tx, ty, 8, 0, Math.PI * 2);
      ctx.stroke();
    } else if (hud.waypoint) {
      const [wx, wy] = toPx(hud.waypoint.x, hud.waypoint.z);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, 8, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player Position + Heading
    const [px, py] = toPx(hud.playerX, hud.playerZ);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Compass North indicator (top-left of canvas)
    ctx.save();
    ctx.translate(28, 28);
    ctx.rotate(rad);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(0, -11);
    ctx.lineTo(4, -2);
    ctx.lineTo(-4, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 9px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('N', 0, 9);
    ctx.restore();
  }, [hud, allRoads, selectedDistrict, zoom, panX, panZ, rotationDeg, previewRoute]);

  const screenToWorld = (clientX: number, clientY: number, rect: DOMRect): [number, number] => {
    const sx = ((clientX - rect.left) / rect.width) * mapSize - mapSize * 0.5;
    const sy = ((clientY - rect.top) / rect.height) * mapSize - mapSize * 0.5;
    const baseScale = mapSize / (WORLD_HALF_SIZE * 2);
    const pxPerUnit = baseScale * zoom;
    const rad = (-rotationDeg * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    const wx = panX + (sx * cosR - sy * sinR) / pxPerUnit;
    const wz = panZ + (sx * sinR + sy * cosR) / pxPerUnit;
    return [wx, wz];
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, moved: 0 };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragRef.current.active) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    dragRef.current.startX = e.clientX;
    dragRef.current.startY = e.clientY;
    dragRef.current.moved += Math.hypot(dx, dy);

    const baseScale = mapSize / (WORLD_HALF_SIZE * 2);
    const pxPerUnit = baseScale * zoom;
    const rad = (-rotationDeg * Math.PI) / 180;
    const cosR = Math.cos(rad);
    const sinR = Math.sin(rad);
    setPanX((p) => p - (dx * cosR - dy * sinR) / pxPerUnit);
    setPanZ((p) => p - (dx * sinR + dy * cosR) / pxPerUnit);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const moved = dragRef.current.moved;
    dragRef.current.active = false;
    if (moved < 6) {
      const rect = e.currentTarget.getBoundingClientRect();
      const [wx, wz] = screenToWorld(e.clientX, e.clientY, rect);
      setSelectedTarget({ x: wx, z: wz, label: 'Custom GPS Pin' });
      onSetWaypoint(wx, wz, 'Custom GPS Pin');
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    setZoom((z) => Math.max(0.75, Math.min(7, Number((z * factor).toFixed(2)))));
  };

  const handleImportGeoJsonClick = () => {
    const res = onImportGeoJson(geoJsonInput);
    setImportStatus(res.message);
  };

  const activeDistrictObj = DISTRICTS.find((d) => d.id === selectedDistrict);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/92 p-4 md:p-6">
      <div className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 px-6 py-3.5">
          <div>
            <h2 className="font-display text-xl font-bold text-white">
              Bengaluru City Atlas · 35 Districts, 15 Landmarks &amp; 5 Metro Lines
            </h2>
            <p className="text-xs text-slate-400">
              GPS: <span className="font-mono-hud text-amber-300">{hud.playerLat.toFixed(5)}° N, {hud.playerLon.toFixed(5)}° E</span>
              {' · '}UTM 43N: <span className="font-mono-hud text-slate-300">{hud.utmEasting}E {hud.utmNorthing}N</span>
              {' · '}Discovered {hud.discoveredDistricts.length}/{hud.totalDistricts} zones
            </p>
          </div>
          <div className="flex items-center gap-2">
            {(hud.waypoint || hud.activeRoute) && (
              <button
                type="button"
                onClick={() => {
                  onClearWaypoint();
                  onCancelNavigation();
                  setPreviewRoute(null);
                  setSelectedTarget(null);
                }}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Clear GPS
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1.5 rounded-md bg-amber-500 px-3.5 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
            >
              <X className="h-4 w-4" />
              Resume [M]
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="grid flex-1 grid-cols-1 gap-5 overflow-y-auto p-5 lg:grid-cols-[620px_1fr]">
          {/* Interactive Map Canvas + Controls */}
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(7, Number((z * 1.25).toFixed(2))))}
                  className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-200 hover:bg-slate-800"
                  title="Zoom In"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.75, Number((z / 1.25).toFixed(2))))}
                  className="rounded border border-slate-700 bg-slate-900 p-1.5 text-slate-200 hover:bg-slate-800"
                  title="Zoom Out"
                >
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <span className="ml-1 font-mono-hud text-[11px] text-slate-300">{zoom.toFixed(1)}x</span>
                <button
                  type="button"
                  onClick={() => {
                    setZoom(1.25);
                    setPanX(0);
                    setPanZ(0);
                    setRotationDeg(0);
                  }}
                  className="ml-2 flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset View
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Rotate {rotationDeg}°</span>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={rotationDeg}
                  onChange={(e) => setRotationDeg(Number(e.target.value))}
                  className="h-1.5 w-28 accent-amber-400"
                />
              </div>
            </div>

            <canvas
              ref={canvasRef}
              width={mapSize}
              height={mapSize}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onWheel={handleWheel}
              className="w-full max-w-[620px] cursor-grab rounded-lg border border-slate-700 bg-[#090d16] active:cursor-grabbing"
            />

            <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-white ring-2 ring-red-500" />
                You
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1 w-3.5 bg-purple-500" />
                Purple
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1 w-3.5 bg-green-500" />
                Green
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1 w-3.5 bg-yellow-500" />
                Yellow
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1 w-3.5 bg-pink-500/75" />
                Pink (Const.)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1 w-3.5 bg-sky-400/75" />
                Blue (Const.)
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 bg-yellow-400" />
                Rail/Bus
              </span>
              <span className="inline-flex items-center gap-1">
                <span className="inline-block h-1 w-3.5 bg-sky-400" />
                Active Route
              </span>
            </div>
          </div>

          {/* Right Panel: Search, Transit Routing, 35 Districts, GIS & GeoJSON */}
          <div className="flex flex-col gap-3.5 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-slate-800 bg-slate-950 p-1">
              <button
                type="button"
                onClick={() => setRightTab('atlas')}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  rightTab === 'atlas'
                    ? 'bg-amber-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Compass className="h-3.5 w-3.5" />
                Travel &amp; 35 Districts
              </button>
              <button
                type="button"
                onClick={() => setRightTab('gis')}
                className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-semibold transition-colors ${
                  rightTab === 'gis'
                    ? 'bg-sky-500 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                GeoJSON &amp; Partition GIS
              </button>
            </div>

            {rightTab === 'atlas' ? (
              <>
                {/* Search Bar */}
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search 35 districts, Vidhana Soudha, Metro, KIA Airport..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2 pl-8 pr-3 text-xs text-slate-100 placeholder:text-slate-500 focus:border-amber-400 focus:outline-none"
                  />
                  {filteredSearch.length > 0 && (
                    <div className="mt-1.5 max-h-44 overflow-y-auto rounded-lg border border-slate-700 bg-slate-950 divide-y divide-slate-800">
                      {filteredSearch.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => {
                            selectDestination(item.x, item.z, item.name, item.districtId);
                            setSearchQuery('');
                          }}
                          className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-900"
                        >
                          <div>
                            <div className="text-xs font-semibold text-white">{item.name}</div>
                            <div className="text-[10px] text-slate-400">{item.subtitle}</div>
                          </div>
                          <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
                            {item.category}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Transport Mode Selector */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                  <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Transport Mode
                  </div>
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-6">
                    {TRANSPORT_MODES.map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setTransportMode(m.id)}
                        className={`flex flex-col items-center justify-center gap-1 rounded-md py-1.5 text-[11px] font-semibold transition-colors ${
                          transportMode === m.id
                            ? 'bg-sky-500 text-slate-950'
                            : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        {m.icon}
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Route Planner Card */}
                {previewRoute && (
                  <div className="rounded-lg border border-sky-500/45 bg-slate-950 p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display text-sm font-bold text-white">
                        {previewRoute.destinationName}
                      </span>
                      <span className="font-mono-hud text-xs font-bold text-sky-400">
                        {previewRoute.distanceKm.toFixed(2)} km · {previewRoute.etaMinutes} min
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-300">{previewRoute.summary}</p>
                    {previewRoute.stationStops && previewRoute.stationStops.length > 0 && (
                      <p className="mt-1 text-[11px] text-slate-400">
                        Stops: {previewRoute.stationStops.join(' → ')}
                      </p>
                    )}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onStartNavigation(previewRoute);
                          onClose();
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400"
                      >
                        <MapPin className="h-3.5 w-3.5" />
                        Start GPS Navigation
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onTravelRoute(previewRoute);
                          onClose();
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Travel Now
                      </button>
                    </div>
                  </div>
                )}

                {activeDistrictObj && !previewRoute && (
                  <div className="rounded-lg border border-amber-500/40 bg-slate-950 p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-display font-bold text-white">{activeDistrictObj.name}</span>
                      <span className="text-xs text-amber-400">{activeDistrictObj.kannadaName}</span>
                    </div>
                    <div className="mt-0.5 font-mono-hud text-[11px] text-slate-400">
                      {activeDistrictObj.region} Bengaluru · {activeDistrictObj.lat.toFixed(4)}° N,{' '}
                      {activeDistrictObj.lon.toFixed(4)}° E
                    </div>
                    <p className="mt-1.5 text-xs text-slate-300">{activeDistrictObj.description}</p>
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          selectDestination(activeDistrictObj.x, activeDistrictObj.z, activeDistrictObj.name, activeDistrictObj.id)
                        }
                        className="flex flex-1 items-center justify-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                      >
                        <MapPin className="h-3.5 w-3.5 text-sky-400" />
                        Plan Route
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onFastTravel(activeDistrictObj.id);
                          onClose();
                        }}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Fast Travel
                      </button>
                    </div>
                  </div>
                )}

                {/* All 5 Regions (35 Districts) */}
                {REGION_ORDER.map((region) => {
                  const items = DISTRICTS.filter((d) => d.region === region);
                  return (
                    <div key={region}>
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                        {region} Bengaluru ({items.length})
                      </h3>
                      <div className="mt-1.5 grid grid-cols-2 gap-1.5">
                        {items.map((d) => {
                          const active = selectedDistrict === d.id;
                          const discovered = hud.discoveredDistricts.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => selectDestination(d.x, d.z, d.name, d.id)}
                              className={`rounded-md border px-2.5 py-1.5 text-left text-xs transition-colors ${
                                active
                                  ? 'border-amber-400 bg-slate-800 text-white'
                                  : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-600'
                              }`}
                            >
                              <div className="truncate font-medium">{d.name}</div>
                              <div className="text-[10px] text-slate-500">
                                {discovered ? 'Discovered' : `${d.lat.toFixed(2)}°N ${d.lon.toFixed(2)}°E`}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                <div>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Storyline &amp; Race Missions
                  </h3>
                  <div className="mt-2 flex flex-col gap-2">
                    {MISSIONS.map((m) => {
                      const done = hud.completedMissions.includes(m.id);
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/70 px-3 py-2"
                        >
                          <div className="min-w-0 pr-2">
                            <div className="truncate text-xs font-semibold text-slate-100">{m.title}</div>
                            <div className="text-[11px] text-slate-400">
                              Reward ₹{m.rewardCash.toLocaleString('en-IN')} · {done ? 'Completed' : 'Ready'}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              onStartMission(m.id);
                              onClose();
                            }}
                            className="shrink-0 flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-xs font-medium text-amber-400 hover:bg-amber-500 hover:text-slate-950"
                          >
                            <Crosshair className="h-3 w-3" />
                            Launch
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                {/* World Partition Streaming Live Diagnostics */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-xs">
                  <div className="font-display text-sm font-bold text-white">
                    World Partition &amp; HLOD Streaming
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
                    <span className="text-slate-400">Spatial Partition Cells</span>
                    <span className="font-mono-hud text-slate-200">{hud.partitionStats.totalCells} cells (320u grid)</span>
                    <span className="text-slate-400">High Detail / HLOD / Culled</span>
                    <span className="font-mono-hud text-emerald-400">
                      {hud.partitionStats.activeHighCells} / {hud.partitionStats.activeMediumCells} / {hud.partitionStats.culledCells}
                    </span>
                    <span className="text-slate-400">GeoJSON Road Corridors</span>
                    <span className="font-mono-hud text-amber-300">
                      {hud.partitionStats.importedRoadCount} roads ({hud.partitionStats.importedFeatureCount} features)
                    </span>
                  </div>
                </div>

                {/* Live OSM GeoJSON Importer */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-display text-sm font-bold text-white">
                      OSM GeoJSON Importer (WGS84 → 3D)
                    </span>
                    <span className="font-mono-hud text-[10px] text-sky-400">EPSG:4326</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-400">
                    Paste any OpenStreetMap GeoJSON FeatureCollection for Bengaluru to convert coordinates into
                    World Partition roads and Dijkstra graph edges.
                  </p>
                  <textarea
                    value={geoJsonInput}
                    onChange={(e) => setGeoJsonInput(e.target.value)}
                    rows={5}
                    className="mt-2 w-full rounded border border-slate-700 bg-slate-900 p-2 font-mono-hud text-[10px] text-slate-200 focus:border-sky-400 focus:outline-none"
                  />
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={handleImportGeoJsonClick}
                      className="flex items-center gap-1.5 rounded bg-sky-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-sky-400"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      Import GeoJSON to World Partition
                    </button>
                    {importStatus && <span className="text-[11px] text-emerald-400">{importStatus}</span>}
                  </div>
                </div>

                {/* WGS84 Validation Table */}
                <div className="rounded-lg border border-slate-800 bg-slate-950 p-3.5 text-xs">
                  <div className="font-display text-sm font-bold text-white">
                    WGS84 → UTM Zone 43N Verification ({geoReport.entries.length} Zones)
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
                    <span className="text-slate-400">Origin Datum</span>
                    <span className="font-mono-hud text-amber-300">
                      {geoReport.originLat}° N, {geoReport.originLon}° E
                    </span>
                    <span className="text-slate-400">Mean Scale Error</span>
                    <span className="font-mono-hud text-emerald-400">{geoReport.meanScaleErrorPct}%</span>
                    <span className="text-slate-400">Connected Graph</span>
                    <span className="font-mono-hud text-slate-200">
                      {geoReport.connectedRoadCount} corridors · {geoReport.junctionCount} nodes
                    </span>
                  </div>
                </div>

                <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
                  <div className="max-h-[240px] overflow-y-auto">
                    <table className="w-full text-left text-[11px]">
                      <thead className="sticky top-0 bg-slate-900 text-slate-400">
                        <tr>
                          <th className="px-2.5 py-1.5">Zone</th>
                          <th className="px-2 py-1.5 text-right">Real km</th>
                          <th className="px-2 py-1.5 text-right">Proj km</th>
                          <th className="px-2.5 py-1.5 text-right">Bearing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/70">
                        {geoReport.entries.map((row) => (
                          <tr
                            key={row.id}
                            onClick={() => {
                              const d = DISTRICTS.find((x) => x.id === row.id);
                              if (d) selectDestination(d.x, d.z, d.name, d.id);
                            }}
                            className="cursor-pointer hover:bg-slate-900/90"
                          >
                            <td className="px-2.5 py-1.5 font-medium text-slate-200">{row.name}</td>
                            <td className="px-2 py-1.5 text-right font-mono-hud text-slate-300">
                              {row.realDistKm.toFixed(2)}
                            </td>
                            <td className="px-2 py-1.5 text-right font-mono-hud text-emerald-400">
                              {row.projectedDistKm.toFixed(2)}
                            </td>
                            <td className="px-2.5 py-1.5 text-right font-mono-hud text-slate-400">
                              {row.bearingDeg}°
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
