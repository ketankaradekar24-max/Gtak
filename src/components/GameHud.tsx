import React from 'react';
import {
  Car,
  CloudRain,
  Compass,
  Map as MapIcon,
  Moon,
  Radio,
  Shield,
  SlidersHorizontal,
  Star,
  Sun,
  Wrench,
} from 'lucide-react';
import { HudSnapshot, WeaponKind } from '../game/types';
import { MinimapCanvas } from './MinimapCanvas';

interface GameHudProps {
  hud: HudSnapshot;
  onOpenMap: () => void;
  onOpenMenu: (tab?: 'missions' | 'garage' | 'wardrobe' | 'settings') => void;
  onSelectWeapon: (w: WeaponKind) => void;
  onToggleRadio: () => void;
  onCancelMission: () => void;
}

const WEAPONS: Array<{ id: WeaponKind; key: string; label: string }> = [
  { id: 'unarmed', key: '1', label: 'Hands' },
  { id: 'baton', key: '2', label: 'Baton' },
  { id: 'tactical', key: '3', label: 'Pulse' },
  { id: 'emp', key: '4', label: 'EMP' },
];

function formatClock(hours: number): string {
  const h = Math.floor(hours) % 24;
  const m = Math.floor((hours % 1) * 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onOpenMap,
  onOpenMenu,
  onSelectWeapon,
  onToggleRadio,
  onCancelMission,
}) => {
  const isNight = hud.timeOfDayHours < 6 || hud.timeOfDayHours >= 19;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4">
      {/* Top Row: Left District/Wanted | Center Mission/Toast | Right Vitals & Quick Actions */}
      <div className="flex items-start justify-between gap-4">
        {/* Top-Left: District, Time, Weather, Wanted Stars */}
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="rounded-lg border border-slate-700/80 bg-slate-950/90 px-3.5 py-2.5">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-base font-bold tracking-wide text-slate-100">
                {hud.districtName}
              </span>
              <span className="text-xs text-amber-400">{hud.districtKannada}</span>
            </div>
            <div className="mt-1 flex items-center gap-2.5 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1 font-mono-hud text-slate-200">
                {isNight ? <Moon className="h-3.5 w-3.5 text-sky-400" /> : <Sun className="h-3.5 w-3.5 text-amber-400" />}
                {formatClock(hud.timeOfDayHours)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 capitalize">
                {hud.weather === 'monsoon' && <CloudRain className="h-3.5 w-3.5 text-sky-400" />}
                {hud.weather === 'monsoon' ? 'Monsoon Rain' : hud.weather}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-hud">
                {hud.discoveredDistricts.length}/14 Zones
              </span>
            </div>
          </div>

          {hud.wantedStars > 0 && (
            <div className="rounded-lg border border-red-500/50 bg-slate-950/95 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${
                      s <= hud.wantedStars
                        ? 'fill-red-500 text-red-500'
                        : 'text-slate-700'
                    }`}
                  />
                ))}
                <span className="ml-2 text-xs font-semibold text-red-400">
                  {hud.isEvading ? 'Evading Patrols' : 'Police Pursuit'}
                </span>
              </div>
              {hud.isEvading && (
                <div className="mt-1.5 h-1 w-full overflow-hidden rounded bg-slate-800">
                  <div
                    className="h-full bg-sky-400 transition-all"
                    style={{ width: `${Math.round(hud.wantedCooldown * 100)}%` }}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-Center: Active Mission Objective & Toast */}
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          {hud.activeMission && (
            <div className="pointer-events-auto rounded-lg border border-amber-500/60 bg-slate-950/90 px-4 py-2">
              <div className="flex items-center justify-center gap-3">
                <span className="font-display text-sm font-bold text-amber-400">
                  {hud.activeMission.title}
                </span>
                {hud.activeMission.timeRemaining !== null && (
                  <span className="font-mono-hud text-sm font-bold text-red-400">
                    {Math.max(0, Math.ceil(hud.activeMission.timeRemaining))}s
                  </span>
                )}
                <button
                  type="button"
                  onClick={onCancelMission}
                  className="ml-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Abort
                </button>
              </div>
              <p className="mt-0.5 text-xs text-slate-200">{hud.activeMission.objective}</p>
              {hud.activeMission.totalCheckpoints > 1 && (
                <p className="mt-0.5 font-mono-hud text-[11px] text-slate-400">
                  Checkpoint {hud.activeMission.checkpointIndex + 1} / {hud.activeMission.totalCheckpoints}
                </p>
              )}
            </div>
          )}

          {hud.toastMessage && (
            <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-4 py-2 text-xs font-medium text-slate-100 shadow-lg">
              {hud.toastMessage}
            </div>
          )}
        </div>

        {/* Top-Right: Cash, Health/Armor, Weapons & Action Buttons */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex items-center gap-3 rounded-lg border border-slate-700/80 bg-slate-950/90 px-3.5 py-2">
            <div className="text-right">
              <div className="font-mono-hud text-base font-bold text-emerald-400">
                ₹{hud.cash.toLocaleString('en-IN')}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 w-20 overflow-hidden rounded bg-slate-800" title={`Health ${hud.health}%`}>
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100))}%` }}
                  />
                </div>
                <div className="flex items-center gap-1" title={`Armor ${hud.armor}%`}>
                  <Shield className="h-3 w-3 text-sky-400" />
                  <div className="h-2 w-14 overflow-hidden rounded bg-slate-800">
                    <div
                      className="h-full bg-sky-400"
                      style={{ width: `${Math.max(0, Math.min(100, (hud.armor / hud.maxArmor) * 100))}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-3">
              <button
                type="button"
                onClick={onOpenMap}
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-amber-400 hover:text-white whitespace-nowrap"
              >
                <MapIcon className="h-3.5 w-3.5 text-amber-400" />
                Map
              </button>
              <button
                type="button"
                onClick={() => onOpenMenu('garage')}
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-white whitespace-nowrap"
              >
                <Wrench className="h-3.5 w-3.5 text-cyan-400" />
                Garage
              </button>
              <button
                type="button"
                onClick={() => onOpenMenu('missions')}
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white whitespace-nowrap"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Menu
              </button>
            </div>
          </div>

          {/* Weapon / Gear Selector (On Foot) or Radio Banner (In Vehicle) */}
          {!hud.inVehicle ? (
            <div className="flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-950/90 p-1">
              {WEAPONS.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => onSelectWeapon(w.id)}
                  className={`rounded px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap ${
                    hud.weapon === w.id
                      ? 'bg-amber-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-slate-100'
                  }`}
                >
                  [{w.key}] {w.label}
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleRadio}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600"
            >
              <Radio className={`h-3.5 w-3.5 ${hud.radioOn ? 'text-amber-400' : 'text-slate-500'}`} />
              <span className="max-w-[210px] truncate">
                {hud.radioOn ? hud.radioTrack : 'Radio Off [R]'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Bottom Row: Minimap | Center Prompts & Subtitles | Speedometer / Stance */}
      <div className="flex items-end justify-between gap-4">
        {/* Bottom-Left: Live Minimap */}
        <div className="pointer-events-auto">
          <MinimapCanvas hud={hud} onOpenFullMap={onOpenMap} />
        </div>

        {/* Bottom-Center: Context Prompt & NPC Kannada/English/Hindi Subtitle */}
        <div className="flex max-w-lg flex-col items-center gap-2 text-center">
          {hud.nearPrompt && (
            <div className="rounded-md border border-amber-500/50 bg-slate-950/92 px-4 py-1.5 text-xs font-medium text-amber-300">
              {hud.nearPrompt}
            </div>
          )}

          {hud.npcSubtitle && (
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/92 px-4 py-2 text-xs text-slate-100">
              <span className="font-semibold text-amber-400">{hud.npcSubtitle.speaker}</span>
              <span className="mx-1.5 text-slate-500">·</span>
              <span className="text-slate-400">{hud.npcSubtitle.language}:</span>{' '}
              <span>&ldquo;{hud.npcSubtitle.line}&rdquo;</span>
            </div>
          )}

          <div className="text-[11px] text-slate-400 bg-slate-950/80 px-3 py-1 rounded border border-slate-800/80">
            WASD Move/Drive · Shift Sprint/Nitro · Space Jump/Brake · F Enter/Exit · H Horn · M Map · ESC Menu
          </div>
        </div>

        {/* Bottom-Right: Speedometer or On-Foot Status */}
        <div className="pointer-events-auto min-w-[180px]">
          {hud.inVehicle ? (
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/92 px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                <Car className="h-3.5 w-3.5 text-amber-400" />
                <span className="truncate max-w-[150px]">{hud.vehicleLabel}</span>
              </div>
              <div className="mt-1 flex items-baseline justify-end gap-2">
                <span className="font-display text-3xl font-extrabold tabular-nums text-white">
                  {hud.speedKmh}
                </span>
                <span className="font-mono-hud text-xs text-slate-400">KM/H</span>
                <span className="ml-1 rounded bg-slate-800 px-1.5 py-0.5 font-mono-hud text-xs font-bold text-amber-400">
                  {hud.gear === -1 ? 'R' : `G${hud.gear}`}
                </span>
              </div>
              <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] text-slate-400">
                <span>Lights [L]: {hud.headlightsOn ? 'ON' : 'OFF'}</span>
                <span>Chassis {hud.vehicleHealth}%</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/92 px-3.5 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1.5 text-xs text-slate-300">
                <Compass className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  {hud.isSwimming ? 'Swimming' : hud.isCrouching ? 'Crouching' : 'On Foot · Arjun'}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                Tokens {hud.collectedIds.length}/12 · Missions {hud.completedMissions.length}/7
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
