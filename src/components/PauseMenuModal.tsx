import React, { useState } from 'react';
import { Car, CheckCircle2, Play, Settings, Shirt, Trophy, Wrench, X } from 'lucide-react';
import { MISSIONS, VEHICLE_SPECS } from '../game/bengaluruData';
import {
  GameSettings,
  HudSnapshot,
  PlayerCustomization,
  TimePreset,
  VehicleKind,
  VehicleTuning,
  WeatherMode,
} from '../game/types';

export type PauseTab = 'missions' | 'garage' | 'wardrobe' | 'settings';

interface PauseMenuModalProps {
  initialTab: PauseTab;
  hud: HudSnapshot;
  customization: PlayerCustomization;
  vehicleTuning: VehicleTuning;
  settings: GameSettings;
  onClose: () => void;
  onStartMission: (id: string) => void;
  onUpdateCustomization: (c: PlayerCustomization) => void;
  onUpdateVehicleTuning: (t: VehicleTuning) => void;
  onSpawnVehicle: (kind: VehicleKind) => void;
  onRepairVehicle: () => void;
  onUpdateSettings: (s: Partial<GameSettings>) => void;
}

const GARAGE_VEHICLES: VehicleKind[] = ['coupe', 'bike', 'auto', 'cab', 'bmtc'];
const PAINT_SWATCHES = ['#f97316', '#dc2626', '#2563eb', '#16a34a', '#eab308', '#f8fafc', '#18181b', '#7e22ce'];
const JACKET_COLORS = ['#b45309', '#1e293b', '#991b1b', '#065f46', '#1d4ed8', '#3f3f46'];
const SHIRT_COLORS = ['#f8fafc', '#0f172a', '#fde047', '#38bdf8', '#f43f5e'];
const PANTS_COLORS = ['#1e293b', '#172554', '#27272a', '#422006'];

export const PauseMenuModal: React.FC<PauseMenuModalProps> = ({
  initialTab,
  hud,
  customization,
  vehicleTuning,
  settings,
  onClose,
  onStartMission,
  onUpdateCustomization,
  onUpdateVehicleTuning,
  onSpawnVehicle,
  onRepairVehicle,
  onUpdateSettings,
}) => {
  const [tab, setTab] = useState<PauseTab>(initialTab);
  const [custom, setCustom] = useState<PlayerCustomization>(customization);
  const [tuning, setTuning] = useState<VehicleTuning>(vehicleTuning);

  const tabs: Array<{ id: PauseTab; label: string; icon: React.ReactNode }> = [
    { id: 'missions', label: 'Missions', icon: <Trophy className="h-4 w-4" /> },
    { id: 'garage', label: 'Garage & Rides', icon: <Wrench className="h-4 w-4" /> },
    { id: 'wardrobe', label: 'Wardrobe', icon: <Shirt className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/92 p-6">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Top Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div className="flex items-center gap-2">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors whitespace-nowrap ${
                  tab === t.id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3.5 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <X className="h-4 w-4" />
            Resume Game
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {tab === 'missions' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display text-lg font-bold text-white">
                    Silicon &amp; Monsoon — Storyline &amp; Races
                  </h3>
                  <p className="text-xs text-slate-400">
                    Launch any mission directly or visit yellow markers across Bengaluru.
                  </p>
                </div>
                <span className="font-mono-hud text-sm font-bold text-amber-400">
                  {hud.completedMissions.length} / {MISSIONS.length} Completed
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {MISSIONS.map((m) => {
                  const done = hud.completedMissions.includes(m.id);
                  const active = hud.activeMission?.id === m.id;
                  return (
                    <div
                      key={m.id}
                      className="flex flex-col justify-between rounded-lg border border-slate-800 bg-slate-950/80 p-4"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-display text-sm font-bold text-white">{m.title}</span>
                          {done && <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />}
                        </div>
                        <p className="mt-1.5 text-xs leading-relaxed text-slate-400">{m.briefing}</p>
                      </div>
                      <div className="mt-4 flex items-center justify-between border-t border-slate-800/80 pt-3">
                        <span className="font-mono-hud text-xs font-semibold text-emerald-400">
                          Reward ₹{m.rewardCash.toLocaleString('en-IN')}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            onStartMission(m.id);
                            onClose();
                          }}
                          className="flex items-center gap-1.5 rounded bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-amber-400"
                        >
                          <Play className="h-3.5 w-3.5" />
                          {active ? 'Restart' : 'Start Mission'}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === 'garage' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <h3 className="font-display text-lg font-bold text-white">Bengaluru Garage Fleet</h3>
                <p className="text-xs text-slate-400">
                  Summon stored vehicles directly to your location or repair chassis damage.
                </p>
                <div className="space-y-2">
                  {GARAGE_VEHICLES.map((kind) => {
                    const spec = VEHICLE_SPECS[kind];
                    return (
                      <div
                        key={kind}
                        className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5"
                      >
                        <div>
                          <div className="text-sm font-semibold text-white">{spec.label}</div>
                          <div className="text-[11px] text-slate-400">
                            Top Speed {Math.round(spec.maxSpeed * 4.2)} km/h · Armor {spec.maxHealth}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            onSpawnVehicle(kind);
                            onClose();
                          }}
                          className="flex items-center gap-1.5 rounded bg-cyan-500 px-3 py-1.5 text-xs font-semibold text-slate-950 hover:bg-cyan-400"
                        >
                          <Car className="h-3.5 w-3.5" />
                          Drive
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={onRepairVehicle}
                  className="w-full rounded-lg border border-emerald-500/40 bg-emerald-500/10 py-2.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/20"
                >
                  Repair Current / Nearest Vehicle (Free Service)
                </button>
              </div>

              <div className="space-y-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
                <h3 className="font-display text-base font-bold text-white">Custom Paint &amp; Tuning</h3>

                <div>
                  <label className="text-xs font-medium text-slate-400">Metallic Clearcoat Respray</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {PAINT_SWATCHES.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          const next = { ...tuning, color: hex };
                          setTuning(next);
                          onUpdateVehicleTuning(next);
                        }}
                        className={`h-8 w-8 rounded-md border-2 ${
                          tuning.color === hex ? 'border-white scale-105' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: hex }}
                        aria-label={`Paint ${hex}`}
                      />
                    ))}
                  </div>
                </div>

                {(
                  [
                    ['engineLevel', 'Engine & Turbo Stage'],
                    ['handlingLevel', 'Suspension & Drift Grip'],
                    ['armorLevel', 'Reinforced Chassis'],
                  ] as const
                ).map(([field, label]) => (
                  <div key={field}>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-300">{label}</span>
                      <span className="font-mono-hud text-amber-400">Stage {tuning[field]} / 3</span>
                    </div>
                    <div className="mt-1.5 grid grid-cols-3 gap-2">
                      {[1, 2, 3].map((lvl) => (
                        <button
                          key={lvl}
                          type="button"
                          onClick={() => {
                            const next = { ...tuning, [field]: lvl };
                            setTuning(next);
                            onUpdateVehicleTuning(next);
                          }}
                          className={`rounded py-1.5 text-xs font-semibold ${
                            tuning[field] === lvl
                              ? 'bg-amber-500 text-slate-950'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          Stage {lvl}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'wardrobe' && (
            <div className="mx-auto max-w-xl space-y-5">
              <div>
                <h3 className="font-display text-lg font-bold text-white">Arjun — Character Customization</h3>
                <p className="text-xs text-slate-400">
                  Changes apply immediately to your 3D character model in Bengaluru.
                </p>
              </div>

              <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-5">
                <div>
                  <span className="text-xs font-medium text-slate-300">Jacket Color</span>
                  <div className="mt-2 flex gap-2">
                    {JACKET_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          const next = { ...custom, jacketColor: hex };
                          setCustom(next);
                          onUpdateCustomization(next);
                        }}
                        className={`h-8 w-8 rounded-md border-2 ${
                          custom.jacketColor === hex ? 'border-amber-400' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-slate-300">Inner Shirt</span>
                  <div className="mt-2 flex gap-2">
                    {SHIRT_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          const next = { ...custom, shirtColor: hex };
                          setCustom(next);
                          onUpdateCustomization(next);
                        }}
                        className={`h-8 w-8 rounded-md border-2 ${
                          custom.shirtColor === hex ? 'border-amber-400' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-slate-300">Trousers / Denim</span>
                  <div className="mt-2 flex gap-2">
                    {PANTS_COLORS.map((hex) => (
                      <button
                        key={hex}
                        type="button"
                        onClick={() => {
                          const next = { ...custom, pantsColor: hex };
                          setCustom(next);
                          onUpdateCustomization(next);
                        }}
                        className={`h-8 w-8 rounded-md border-2 ${
                          custom.pantsColor === hex ? 'border-amber-400' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: hex }}
                      />
                    ))}
                  </div>
                </div>

                <div className="flex flex-wrap gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...custom, sunglasses: !custom.sunglasses };
                      setCustom(next);
                      onUpdateCustomization(next);
                    }}
                    className={`rounded-md border px-4 py-2 text-xs font-semibold ${
                      custom.sunglasses
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    Aviator Sunglasses: {custom.sunglasses ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = { ...custom, backpack: !custom.backpack };
                      setCustom(next);
                      onUpdateCustomization(next);
                    }}
                    className={`rounded-md border px-4 py-2 text-xs font-semibold ${
                      custom.backpack
                        ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    Courier Backpack: {custom.backpack ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-5">
                <h3 className="font-display text-base font-bold text-white">Atmosphere &amp; Simulation</h3>

                <div>
                  <span className="text-xs font-medium text-slate-300">Time of Day</span>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {(['auto', 'morning', 'golden', 'night'] as TimePreset[]).map((tp) => (
                      <button
                        key={tp}
                        type="button"
                        onClick={() => onUpdateSettings({ timePreset: tp })}
                        className={`rounded py-1.5 text-xs font-medium capitalize ${
                          settings.timePreset === tp
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {tp}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-slate-300">Bengaluru Weather</span>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {(['clear', 'overcast', 'monsoon'] as WeatherMode[]).map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => onUpdateSettings({ weather: w })}
                        className={`rounded py-1.5 text-xs font-medium capitalize ${
                          settings.weather === w
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {w === 'monsoon' ? 'Monsoon Rain' : w}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-slate-300">Traffic Density</span>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {(['low', 'medium', 'high'] as const).map((td) => (
                      <button
                        key={td}
                        type="button"
                        onClick={() => onUpdateSettings({ trafficDensity: td })}
                        className={`rounded py-1.5 text-xs font-medium capitalize ${
                          settings.trafficDensity === td
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {td}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ sfxOn: !settings.sfxOn })}
                    className={`flex-1 rounded border py-2 text-xs font-semibold ${
                      settings.sfxOn
                        ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    SFX Audio: {settings.sfxOn ? 'ON' : 'OFF'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onUpdateSettings({ radioOn: !settings.radioOn })}
                    className={`flex-1 rounded border py-2 text-xs font-semibold ${
                      settings.radioOn
                        ? 'border-amber-500/50 bg-amber-500/10 text-amber-300'
                        : 'border-slate-700 bg-slate-900 text-slate-400'
                    }`}
                  >
                    Namma FM Radio: {settings.radioOn ? 'ON' : 'OFF'}
                  </button>
                </div>
              </div>

              <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950 p-5 text-xs text-slate-300">
                <h3 className="font-display text-base font-bold text-white">Controls Reference</h3>
                <div className="grid grid-cols-2 gap-y-2 border-t border-slate-800 pt-3">
                  <span className="text-slate-400">Move / Drive</span>
                  <span className="font-mono-hud text-white">W A S D / Arrows</span>
                  <span className="text-slate-400">Sprint / Nitro Boost</span>
                  <span className="font-mono-hud text-white">Left Shift</span>
                  <span className="text-slate-400">Jump / Handbrake</span>
                  <span className="font-mono-hud text-white">Space</span>
                  <span className="text-slate-400">Crouch</span>
                  <span className="font-mono-hud text-white">C</span>
                  <span className="text-slate-400">Enter / Exit Vehicle / Interact</span>
                  <span className="font-mono-hud text-white">F or E</span>
                  <span className="text-slate-400">Vehicle Horn</span>
                  <span className="font-mono-hud text-white">H</span>
                  <span className="text-slate-400">Headlights</span>
                  <span className="font-mono-hud text-white">L</span>
                  <span className="text-slate-400">Camera Orbit</span>
                  <span className="font-mono-hud text-white">Left Mouse Drag</span>
                  <span className="text-slate-400">Equip Tool / Fire EMP</span>
                  <span className="font-mono-hud text-white">1-4 / G or Right Click</span>
                  <span className="text-slate-400">City Map / Pause Menu</span>
                  <span className="font-mono-hud text-white">M / ESC</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
