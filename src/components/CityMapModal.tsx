import React, { useEffect, useRef, useState } from 'react';
import { Crosshair, MapPin, Navigation, X } from 'lucide-react';
import {
  COLLECTIBLES,
  DISTRICTS,
  LANDMARK_MARKERS,
  MISSIONS,
  ROAD_SEGMENTS,
  WATER_ZONES,
  WORLD_HALF_SIZE,
} from '../game/bengaluruData';
import { DistrictId, HudSnapshot } from '../game/types';

interface CityMapModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onSetWaypoint: (x: number, z: number, label: string) => void;
  onClearWaypoint: () => void;
  onFastTravel: (districtId: DistrictId) => void;
  onStartMission: (missionId: string) => void;
}

export const CityMapModal: React.FC<CityMapModalProps> = ({
  hud,
  onClose,
  onSetWaypoint,
  onClearWaypoint,
  onFastTravel,
  onStartMission,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<DistrictId | null>(null);

  const mapSize = 620;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const toPx = (wx: number, wz: number): [number, number] => [
      ((wx + WORLD_HALF_SIZE) / (WORLD_HALF_SIZE * 2)) * mapSize,
      ((wz + WORLD_HALF_SIZE) / (WORLD_HALF_SIZE * 2)) * mapSize,
    ];

    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, mapSize, mapSize);

    // Subtle grid
    ctx.strokeStyle = 'rgba(148,163,184,0.08)';
    ctx.lineWidth = 1;
    for (let g = 0; g <= mapSize; g += 62) {
      ctx.beginPath();
      ctx.moveTo(g, 0);
      ctx.lineTo(g, mapSize);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, g);
      ctx.lineTo(mapSize, g);
      ctx.stroke();
    }

    // Water bodies
    ctx.fillStyle = '#0284c7';
    WATER_ZONES.forEach((w) => {
      const [x, y] = toPx(w.x, w.z);
      const rx = (w.rx / (WORLD_HALF_SIZE * 2)) * mapSize;
      const rz = (w.rz / (WORLD_HALF_SIZE * 2)) * mapSize;
      ctx.beginPath();
      ctx.ellipse(x, y, rx, rz, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // Roads
    ROAD_SEGMENTS.forEach((r) => {
      const [x1, y1] = toPx(r.x1, r.z1);
      const [x2, y2] = toPx(r.x2, r.z2);
      ctx.strokeStyle = r.elevated ? '#f59e0b' : '#334155';
      ctx.lineWidth = r.elevated ? 5 : 7;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    });

    // Metro line indicator along MG Road
    const [mx1, my1] = toPx(-480, -40);
    const [mx2, my2] = toPx(480, -40);
    ctx.strokeStyle = '#9333ea';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(mx1, my1);
    ctx.lineTo(mx2, my2);
    ctx.stroke();
    ctx.setLineDash([]);

    // District labels
    ctx.font = '600 10px "Plus Jakarta Sans", sans-serif';
    ctx.textAlign = 'center';
    DISTRICTS.forEach((d) => {
      const [dx, dy] = toPx(d.x, d.z);
      const discovered = hud.discoveredDistricts.includes(d.id);
      ctx.fillStyle = discovered ? 'rgba(248, 250, 252, 0.9)' : 'rgba(148, 163, 184, 0.55)';
      ctx.fillText(d.name, dx, dy - 8);
    });

    // Collectibles
    COLLECTIBLES.forEach((c) => {
      if (hud.collectedIds.includes(c.id)) return;
      const [cx, cy] = toPx(c.x, c.z);
      ctx.fillStyle = '#facc15';
      ctx.beginPath();
      ctx.arc(cx, cy, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    // Landmarks (Garages, Safehouses, Shops, Petrol)
    LANDMARK_MARKERS.forEach((lm) => {
      const [lx, ly] = toPx(lm.x, lm.z);
      ctx.fillStyle =
        lm.type === 'garage'
          ? '#06b6d4'
          : lm.type === 'safehouse'
          ? '#22c55e'
          : lm.type === 'petrol'
          ? '#f59e0b'
          : lm.type === 'shop'
          ? '#ec4899'
          : '#cbd5e1';
      ctx.fillRect(lx - 4, ly - 4, 8, 8);
    });

    // Mission markers
    MISSIONS.forEach((m) => {
      if (hud.completedMissions.includes(m.id)) return;
      const [mx, my] = toPx(m.startX, m.startZ);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(mx, my, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#090d16';
      ctx.font = 'bold 8px sans-serif';
      ctx.fillText('M', mx, my + 3);
    });

    // Custom GPS Waypoint
    if (hud.waypoint) {
      const [wx, wy] = toPx(hud.waypoint.x, hud.waypoint.z);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(wx, wy, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Player Position
    const [px, py] = toPx(hud.playerX, hud.playerZ);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }, [hud]);

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const u = (e.clientX - rect.left) / rect.width;
    const v = (e.clientY - rect.top) / rect.height;
    const wx = u * WORLD_HALF_SIZE * 2 - WORLD_HALF_SIZE;
    const wz = v * WORLD_HALF_SIZE * 2 - WORLD_HALF_SIZE;
    onSetWaypoint(wx, wz, 'Custom GPS Pin');
  };

  const activeDistrictObj = DISTRICTS.find((d) => d.id === selectedDistrict);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/92 p-6">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="font-display text-xl font-bold text-white">Bengaluru City Atlas</h2>
            <p className="text-xs text-slate-400">
              Click anywhere on the map to set a GPS waypoint · Discovered {hud.discoveredDistricts.length}/14 districts
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hud.waypoint && (
              <button
                type="button"
                onClick={onClearWaypoint}
                className="rounded-md border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800"
              >
                Clear GPS Pin
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
        <div className="grid flex-1 grid-cols-1 gap-6 overflow-y-auto p-6 lg:grid-cols-[620px_1fr]">
          <div className="flex flex-col gap-3">
            <canvas
              ref={canvasRef}
              width={mapSize}
              height={mapSize}
              onClick={handleCanvasClick}
              className="w-full max-w-[620px] cursor-crosshair rounded-lg border border-slate-700 bg-[#090d16]"
            />
            <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-white ring-2 ring-red-500" />
                You
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-amber-500" />
                Mission
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 bg-cyan-500" />
                Garage
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 bg-emerald-500" />
                Safehouse
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-2.5 w-2.5 rounded-full bg-yellow-400" />
                Heritage Token
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="inline-block h-1 w-4 bg-purple-500" />
                Namma Metro
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 overflow-y-auto pr-1">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Districts & Fast Travel
              </h3>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {DISTRICTS.map((d) => {
                  const active = selectedDistrict === d.id;
                  const discovered = hud.discoveredDistricts.includes(d.id);
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setSelectedDistrict(d.id)}
                      className={`rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
                        active
                          ? 'border-amber-400 bg-slate-800 text-white'
                          : 'border-slate-800 bg-slate-950/70 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="font-medium truncate">{d.name}</div>
                      <div className="text-[10px] text-slate-500">
                        {discovered ? 'Discovered' : 'Unexplored'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {activeDistrictObj && (
              <div className="rounded-lg border border-slate-700 bg-slate-950 p-3.5">
                <div className="flex items-baseline justify-between">
                  <span className="font-display font-bold text-white">{activeDistrictObj.name}</span>
                  <span className="text-xs text-amber-400">{activeDistrictObj.kannadaName}</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">{activeDistrictObj.description}</p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      onSetWaypoint(activeDistrictObj.x, activeDistrictObj.z, activeDistrictObj.name);
                      onClose();
                    }}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-700"
                  >
                    <MapPin className="h-3.5 w-3.5 text-sky-400" />
                    Set GPS
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

            <div>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Available Storyline & Race Missions
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
          </div>
        </div>
      </div>
    </div>
  );
};
