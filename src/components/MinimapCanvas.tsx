import React, { useEffect, useRef } from 'react';
import { LANDMARK_MARKERS, RAIL_BUS_STATIONS, ROAD_SEGMENTS, WATER_ZONES } from '../game/bengaluruData';
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
    const scale = 0.22;

    ctx.clearRect(0, 0, size, size);

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
      ctx.ellipse(mx, mz, Math.max(2, w.rx * scale), Math.max(2, w.rz * scale), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Ground & Flyover Roads
    for (const r of ROAD_SEGMENTS) {
      if (r.kind === 'metro' || r.points.length < 2) continue;
      ctx.strokeStyle = r.elevated ? '#f59e0b' : r.kind === 'highway' ? '#475569' : '#334155';
      ctx.lineWidth = Math.max(2.0, r.width * scale * 0.55);
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.beginPath();
      r.points.forEach((pt, idx) => {
        const [px, py] = toMap(pt.x, pt.z);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
    }

    // All 5 Namma Metro Corridors
    for (const r of ROAD_SEGMENTS) {
      if (r.kind !== 'metro' || r.points.length < 2) continue;
      const isUnderConst = r.metroStatus === 'under_construction';
      ctx.strokeStyle =
        r.metroLine === 'green'
          ? '#22c55e'
          : r.metroLine === 'yellow'
          ? '#eab308'
          : r.metroLine === 'pink'
          ? 'rgba(236, 72, 153, 0.7)'
          : r.metroLine === 'blue'
          ? 'rgba(56, 189, 248, 0.7)'
          : '#a855f7';
      ctx.lineWidth = isUnderConst ? 1.4 : 1.8;
      ctx.setLineDash(isUnderConst ? [2, 3] : [4, 3]);
      ctx.beginPath();
      r.points.forEach((pt, idx) => {
        const [px, py] = toMap(pt.x, pt.z);
        if (idx === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Rail & Bus Hubs
    for (const rb of RAIL_BUS_STATIONS) {
      const [rx, ry] = toMap(rb.x, rb.z);
      if (rx < -10 || rx > size + 10 || ry < -10 || ry > size + 10) continue;
      ctx.fillStyle = rb.kind === 'rail' ? '#facc15' : '#fb923c';
      ctx.fillRect(rx - 2.5, ry - 2.5, 5, 5);
    }

    // Landmarks
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
          : lm.type === 'darshini'
          ? '#fb923c'
          : lm.type === 'atm'
          ? '#38bdf8'
          : lm.type === 'landmark'
          ? '#f8fafc'
          : '#94a3b8';
      ctx.fillRect(lx - 2.2, ly - 2.2, 4.4, 4.4);
    }

    // Multi-point GPS Navigation Route
    if (hud.activeRoute && hud.activeRoute.pathPoints.length >= 2) {
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.4;
      ctx.setLineDash([4, 2]);
      ctx.beginPath();
      hud.activeRoute.pathPoints.forEach((pt, idx) => {
        const [rx, ry] = toMap(pt.x, pt.z);
        if (idx === 0) ctx.moveTo(rx, ry);
        else ctx.lineTo(rx, ry);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Active GPS target indicator
    const gpsTarget = hud.activeMission
      ? { x: hud.activeMission.targetX, z: hud.activeMission.targetZ, color: '#f59e0b' }
      : hud.waypoint
      ? { x: hud.waypoint.x, z: hud.waypoint.z, color: '#38bdf8' }
      : null;

    if (gpsTarget) {
      const [tx, ty] = toMap(gpsTarget.x, gpsTarget.z);
      if (!hud.activeRoute) {
        ctx.strokeStyle = gpsTarget.color;
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath();
        ctx.moveTo(half, half);
        ctx.lineTo(tx, ty);
        ctx.stroke();
        ctx.setLineDash([]);
      }

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
      title="Open Bengaluru City Atlas (M)"
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
