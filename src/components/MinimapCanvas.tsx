import React, { useEffect, useRef } from 'react';
import { LANDMARK_MARKERS, ROAD_SEGMENTS, WATER_ZONES } from '../game/bengaluruData';
import { HudSnapshot } from '../game/types';

interface MinimapCanvasProps {
  hud: HudSnapshot;
  onOpenFullMap: () => void;
}

export const MinimapCanvas: React.FC<MinimapCanvasProps> = ({ hud, onOpenFullMap }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = 168;
    const half = size / 2;
    const scale = 0.36; // world meters -> minimap px

    ctx.clearRect(0, 0, size, size);

    // Dark slate city base
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, size, size);

    const toMap = (wx: number, wz: number): [number, number] => [
      half + (wx - hud.playerX) * scale,
      half + (wz - hud.playerZ) * scale,
    ];

    // Water bodies
    ctx.fillStyle = '#0369a1';
    for (const w of WATER_ZONES) {
      const [mx, mz] = toMap(w.x, w.z);
      ctx.beginPath();
      ctx.ellipse(mx, mz, w.rx * scale, w.rz * scale, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Roads
    for (const r of ROAD_SEGMENTS) {
      const [x1, y1] = toMap(r.x1, r.z1);
      const [x2, y2] = toMap(r.x2, r.z2);
      ctx.strokeStyle = r.elevated ? '#f59e0b' : '#334155';
      ctx.lineWidth = Math.max(3, r.width * scale * 0.65);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }

    // Landmarks (Garages, Safehouses, Shops)
    for (const lm of LANDMARK_MARKERS) {
      const [lx, ly] = toMap(lm.x, lm.z);
      if (lx < -10 || lx > size + 10 || ly < -10 || ly > size + 10) continue;
      ctx.fillStyle =
        lm.type === 'garage'
          ? '#06b6d4'
          : lm.type === 'safehouse'
          ? '#22c55e'
          : lm.type === 'petrol'
          ? '#f59e0b'
          : '#94a3b8';
      ctx.fillRect(lx - 3, ly - 3, 6, 6);
    }

    // Active GPS route line (mission or custom waypoint)
    const gpsTarget = hud.activeMission
      ? { x: hud.activeMission.targetX, z: hud.activeMission.targetZ, color: '#f59e0b' }
      : hud.waypoint
      ? { x: hud.waypoint.x, z: hud.waypoint.z, color: '#38bdf8' }
      : null;

    if (gpsTarget) {
      const [tx, ty] = toMap(gpsTarget.x, gpsTarget.z);
      ctx.strokeStyle = gpsTarget.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 3]);
      ctx.beginPath();
      ctx.moveTo(half, half);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);

      // Clamp target indicator to minimap edge if offscreen
      const dx = tx - half;
      const dy = ty - half;
      const dist = Math.hypot(dx, dy);
      const clampedDist = Math.min(dist, half - 9);
      const ix = dist > 0 ? half + (dx / dist) * clampedDist : half;
      const iy = dist > 0 ? half + (dy / dist) * clampedDist : half;
      ctx.fillStyle = gpsTarget.color;
      ctx.beginPath();
      ctx.arc(ix, iy, 4.5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Police blips
    ctx.fillStyle = '#ef4444';
    for (const pb of hud.policeBlips) {
      const [px, py] = toMap(pb.x, pb.z);
      ctx.beginPath();
      ctx.arc(px, py, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Player heading arrow
    ctx.save();
    ctx.translate(half, half);
    ctx.rotate(-hud.playerHeading + Math.PI);
    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 2);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }, [hud]);

  return (
    <button
      type="button"
      onClick={onOpenFullMap}
      title="Open Bengaluru City Map (M)"
      className="group relative block overflow-hidden rounded-lg border border-slate-700/90 bg-slate-950/90 shadow-lg focus-visible:outline-2 focus-visible:outline-amber-400"
    >
      <canvas ref={canvasRef} width={168} height={168} className="block" />
      <div className="flex items-center justify-between border-t border-slate-800 bg-slate-950/95 px-2.5 py-1 text-[11px] font-medium text-slate-300">
        <span className="truncate">{hud.districtName}</span>
        <span className="font-mono-hud text-amber-400">MAP [M]</span>
      </div>
    </button>
  );
};
