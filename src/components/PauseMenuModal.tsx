import React, { useState } from 'react';
import { Car, CheckCircle2, Play, Settings, Shirt, Sparkles, Trophy, Wrench, X } from 'lucide-react';
import { MISSIONS, PROTAGONIST_PRESETS, VEHICLE_SPECS } from '../game/bengaluruData';
import { LANGUAGE_LABELS } from '../game/localization';
import { listSaveSlots } from '../game/saveSystem';
import {
  BeardStyleId,
  FacePresetId,
  GameSettings,
  GraphicsQuality,
  HairStyleId,
  HudSnapshot,
  OutfitStyleId,
  PlayerCustomization,
  ProtagonistId,
  SaveSlotSummary,
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
  onSwitchProtagonist: (id: ProtagonistId) => void;
  onOpenStudio: () => void;
  onUpdateCustomization: (c: PlayerCustomization) => void;
  onUpdateVehicleTuning: (t: VehicleTuning) => void;
  onSpawnVehicle: (kind: VehicleKind) => void;
  onRepairVehicle: () => void;
  onUpdateSettings: (s: Partial<GameSettings>) => void;
  onSaveSlot: (slot: number) => void;
  onLoadSlot: (slot: number) => void;
}

const GARAGE_VEHICLES: VehicleKind[] = [
  'coupe',
  'suv',
  'hatchback',
  'bike',
  'scooter',
  'auto',
  'cab',
  'bmtc',
  'truck',
  'ambulance',
  'delivery',
];
const PAINT_SWATCHES = ['#f97316', '#dc2626', '#2563eb', '#16a34a', '#eab308', '#f8fafc', '#18181b', '#7e22ce'];
const JACKET_COLORS = ['#1e293b', '#b45309', '#991b1b', '#065f46', '#1d4ed8', '#d97706'];
const SHIRT_COLORS = ['#f8fafc', '#ea580c', '#0f172a', '#fde047', '#38bdf8', '#f43f5e'];
const PANTS_COLORS = ['#0f172a', '#1e293b', '#172554', '#27272a', '#422006'];
const SHOE_COLORS = ['#111827', '#f8fafc', '#3f2314', '#991b1b'];
const HAIR_COLORS = ['#18181b', '#27272a', '#451a03', '#71717a'];

const PROTAGONIST_IDS: ProtagonistId[] = ['vikram', 'arjun', 'sathish'];

const FACE_OPTIONS: Array<{ id: FacePresetId; label: string }> = [
  { id: 'vikram_exec', label: 'Vikram Executive' },
  { id: 'arjun_classic', label: 'Arjun Classic' },
  { id: 'sathish_street', label: 'Sathish Street' },
  { id: 'karthik_warm', label: 'Karthik Warm' },
  { id: 'rohan_sharp', label: 'Rohan Sharp' },
];

const HAIR_OPTIONS: Array<{ id: HairStyleId; label: string }> = [
  { id: 'short_crop', label: 'Short Crop' },
  { id: 'side_part', label: 'Side Part' },
  { id: 'wavy_long', label: 'Wavy Long' },
  { id: 'swept', label: 'Swept' },
  { id: 'curly', label: 'Curly' },
  { id: 'bun', label: 'Top Bun' },
];

const BEARD_OPTIONS: Array<{ id: BeardStyleId; label: string }> = [
  { id: 'trimmed_beard', label: 'Trimmed Beard' },
  { id: 'stubble', label: 'Stubble' },
  { id: 'moustache', label: 'Moustache' },
  { id: 'full_beard', label: 'Full Beard' },
  { id: 'clean', label: 'Clean Shaven' },
];

const OUTFIT_OPTIONS: Array<{ id: OutfitStyleId; label: string }> = [
  { id: 'suit', label: 'Tailored Suit' },
  { id: 'jacket', label: 'Smart Jacket' },
  { id: 'street_shirt', label: 'Street Shirt' },
  { id: 'kurta', label: 'Cotton Kurta' },
  { id: 'office', label: 'Office Shirt' },
  { id: 'hoodie', label: 'Tech Hoodie' },
];

const WEATHER_OPTIONS: Array<{ id: WeatherMode; label: string }> = [
  { id: 'clear', label: 'Clear' },
  { id: 'cloudy', label: 'Cloudy' },
  { id: 'light_rain', label: 'Light Rain' },
  { id: 'monsoon', label: 'Monsoon' },
  { id: 'thunderstorm', label: 'Thunderstorm' },
  { id: 'fog', label: 'Morning Fog' },
];

export const PauseMenuModal: React.FC<PauseMenuModalProps> = ({
  initialTab,
  hud,
  customization,
  vehicleTuning,
  settings,
  onClose,
  onStartMission,
  onSwitchProtagonist,
  onOpenStudio,
  onUpdateCustomization,
  onUpdateVehicleTuning,
  onSpawnVehicle,
  onRepairVehicle,
  onUpdateSettings,
  onSaveSlot,
  onLoadSlot,
}) => {
  const [tab, setTab] = useState<PauseTab>(initialTab);
  const [custom, setCustom] = useState<PlayerCustomization>(customization);
  const [tuning, setTuning] = useState<VehicleTuning>(vehicleTuning);
  const [saveTick, setSaveTick] = useState(0);
  const saveSlots: Array<SaveSlotSummary | null> = (() => {
    void saveTick;
    return listSaveSlots();
  })();

  const updateCustom = (patch: Partial<PlayerCustomization>) => {
    const next = { ...custom, ...patch };
    setCustom(next);
    onUpdateCustomization(next);
  };

  const handleSelectProtagonist = (pid: ProtagonistId) => {
    onSwitchProtagonist(pid);
    setCustom({ ...PROTAGONIST_PRESETS[pid].customization });
  };

  const tabs: Array<{ id: PauseTab; label: string; icon: React.ReactNode }> = [
    { id: 'missions', label: 'Missions', icon: <Trophy className="h-4 w-4" /> },
    { id: 'garage', label: 'Garage & Rides', icon: <Wrench className="h-4 w-4" /> },
    { id: 'wardrobe', label: 'Protagonists & Wardrobe', icon: <Shirt className="h-4 w-4" /> },
    { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
  ];

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/92 p-6">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 px-6 py-4">
          <div className="flex flex-wrap items-center gap-2">
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
                          tuning.color === hex ? 'scale-105 border-white' : 'border-slate-700'
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
            <div className="space-y-5">
              {/* Three Protagonist Selector Cards */}
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-white">
                      Three Playable Protagonists
                    </h3>
                    <p className="text-xs text-slate-400">
                      Each hero has unique facial anatomy, body build, walk style &amp; Chaos Cloth attire.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenStudio();
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-purple-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-purple-400"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Open Cinematography Studio [U]
                  </button>
                </div>

                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
                  {PROTAGONIST_IDS.map((pid) => {
                    const prof = PROTAGONIST_PRESETS[pid];
                    const active = custom.protagonistId === pid;
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => handleSelectProtagonist(pid)}
                        className={`rounded-lg border p-3 text-left transition-colors ${
                          active
                            ? 'border-amber-400 bg-amber-500/10'
                            : 'border-slate-800 bg-slate-900/70 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-display text-sm font-bold text-white">{prof.name}</span>
                          <span className="text-[11px] font-semibold text-amber-400">Age {prof.age}</span>
                        </div>
                        <div className="text-[11px] font-medium text-sky-400">{prof.archetypeTitle}</div>
                        <p className="mt-1 text-[11px] leading-snug text-slate-400">{prof.bodySummary}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-5">
                  <h3 className="font-display text-base font-bold text-white">Face, Hair &amp; Grooming</h3>

                  <div>
                    <span className="text-xs font-medium text-slate-300">Facial Structure &amp; Skin Tone</span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {FACE_OPTIONS.map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => updateCustom({ facePreset: f.id })}
                          className={`rounded py-1.5 text-xs font-medium ${
                            custom.facePreset === f.id
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-300">Hairstyle</span>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {HAIR_OPTIONS.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => updateCustom({ hairStyle: h.id })}
                          className={`rounded px-3 py-1.5 text-xs font-medium ${
                            custom.hairStyle === h.id
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {h.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      {HAIR_COLORS.map((hex) => (
                        <button
                          key={hex}
                          type="button"
                          onClick={() => updateCustom({ hairColor: hex })}
                          className={`h-6 w-6 rounded-full border-2 ${
                            custom.hairColor === hex ? 'border-amber-400' : 'border-slate-700'
                          }`}
                          style={{ backgroundColor: hex }}
                        />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-medium text-slate-300">Beard &amp; Moustache</span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {BEARD_OPTIONS.map((b) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => updateCustom({ beardStyle: b.id })}
                          className={`rounded py-1.5 text-xs font-medium ${
                            custom.beardStyle === b.id
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {b.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-5">
                  <h3 className="font-display text-base font-bold text-white">Clothing &amp; Accessories</h3>

                  <div>
                    <span className="text-xs font-medium text-slate-300">Outfit Style (Chaos Cloth Enabled)</span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      {OUTFIT_OPTIONS.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => updateCustom({ outfitStyle: o.id })}
                          className={`rounded py-1.5 text-xs font-medium ${
                            custom.outfitStyle === o.id
                              ? 'bg-amber-500 text-slate-950 font-semibold'
                              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                          }`}
                        >
                          {o.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-medium text-slate-300">Outer / Blazer / Jacket</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {JACKET_COLORS.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateCustom({ jacketColor: hex })}
                            className={`h-7 w-7 rounded border-2 ${
                              custom.jacketColor === hex ? 'border-amber-400' : 'border-slate-700'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-300">Shirt / Kurta</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {SHIRT_COLORS.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateCustom({ shirtColor: hex })}
                            className={`h-7 w-7 rounded border-2 ${
                              custom.shirtColor === hex ? 'border-amber-400' : 'border-slate-700'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-300">Denim / Trousers</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {PANTS_COLORS.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateCustom({ pantsColor: hex })}
                            className={`h-7 w-7 rounded border-2 ${
                              custom.pantsColor === hex ? 'border-amber-400' : 'border-slate-700'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-slate-300">Shoes</span>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {SHOE_COLORS.map((hex) => (
                          <button
                            key={hex}
                            type="button"
                            onClick={() => updateCustom({ shoeColor: hex })}
                            className={`h-7 w-7 rounded border-2 ${
                              custom.shoeColor === hex ? 'border-amber-400' : 'border-slate-700'
                            }`}
                            style={{ backgroundColor: hex }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => updateCustom({ sunglasses: !custom.sunglasses })}
                      className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                        custom.sunglasses
                          ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      Sunglasses: {custom.sunglasses ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCustom({ watch: !custom.watch })}
                      className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                        custom.watch
                          ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      Watch: {custom.watch ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCustom({ chain: !custom.chain })}
                      className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                        custom.chain
                          ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      Gold Chain: {custom.chain ? 'ON' : 'OFF'}
                    </button>
                    <button
                      type="button"
                      onClick={() => updateCustom({ backpack: !custom.backpack })}
                      className={`rounded border px-3 py-1.5 text-xs font-semibold ${
                        custom.backpack
                          ? 'border-amber-400 bg-amber-500/15 text-amber-300'
                          : 'border-slate-700 bg-slate-900 text-slate-400'
                      }`}
                    >
                      Backpack: {custom.backpack ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'settings' && (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-5">
                <h3 className="font-display text-base font-bold text-white">Atmosphere, Weather &amp; Graphics</h3>

                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">Time of Day &amp; Live IST Clock</span>
                    <span className="font-mono-hud text-[11px] text-amber-400 tabular-nums">
                      {hud.istWeekday} · {hud.istClockLabel} ({hud.timezoneLabel})
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-5 gap-1.5">
                    {(
                      [
                        { id: 'ist_realtime', label: 'IST Live 1:1' },
                        { id: 'auto', label: 'Game-Time' },
                        { id: 'morning', label: 'Morning' },
                        { id: 'golden', label: 'Golden' },
                        { id: 'night', label: 'Night' },
                      ] as Array<{ id: TimePreset; label: string }>
                    ).map((tp) => (
                      <button
                        key={tp.id}
                        type="button"
                        onClick={() => onUpdateSettings({ timePreset: tp.id })}
                        className={`rounded py-1.5 text-xs font-medium whitespace-nowrap ${
                          settings.timePreset === tp.id
                            ? 'bg-amber-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {tp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-slate-300">Language / ಭಾಷೆ</span>
                  <div className="mt-2 grid grid-cols-5 gap-1.5">
                    {LANGUAGE_LABELS.map((lang) => (
                      <button
                        key={lang.id}
                        type="button"
                        onClick={() => onUpdateSettings({ language: lang.id })}
                        className={`rounded py-1.5 text-xs font-medium ${
                          settings.language === lang.id
                            ? 'bg-emerald-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {lang.native}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-slate-300">Bengaluru Weather</span>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    {WEATHER_OPTIONS.map((w) => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => onUpdateSettings({ weather: w.id })}
                        className={`rounded py-1.5 text-xs font-medium ${
                          settings.weather === w.id
                            ? 'bg-sky-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <span className="text-xs font-medium text-slate-300">Graphics Preset</span>
                  <div className="mt-2 grid grid-cols-4 gap-1.5">
                    {(['low', 'medium', 'high', 'ultra'] as GraphicsQuality[]).map((gq) => (
                      <button
                        key={gq}
                        type="button"
                        onClick={() => onUpdateSettings({ graphicsQuality: gq })}
                        className={`rounded py-1.5 text-xs font-medium capitalize ${
                          settings.graphicsQuality === gq
                            ? 'bg-emerald-500 text-slate-950 font-semibold'
                            : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {gq}
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

                <div className="flex gap-3 pt-1">
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

              <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-5 text-xs text-slate-300">
                <div>
                  <h3 className="font-display text-base font-bold text-white">3-Slot Save &amp; Load</h3>
                  <div className="mt-2 space-y-2">
                    {[1, 2, 3].map((slotNum, idx) => {
                      const info = saveSlots[idx];
                      return (
                        <div
                          key={slotNum}
                          className="flex items-center justify-between gap-2 rounded-md border border-slate-800 bg-slate-900 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <div className="font-semibold text-white">
                              Slot {slotNum}: {info ? `${info.protagonistName} · ${info.districtName}` : 'Empty'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {info ? `₹${info.cash.toLocaleString('en-IN')} · ${info.savedAt}` : 'No saved data'}
                            </div>
                          </div>
                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                onSaveSlot(slotNum);
                                setSaveTick((t) => t + 1);
                              }}
                              className="rounded bg-sky-500 px-2.5 py-1 text-[11px] font-bold text-slate-950 hover:bg-sky-400"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              disabled={!info}
                              onClick={() => {
                                onLoadSlot(slotNum);
                                onClose();
                              }}
                              className="rounded border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                            >
                              Load
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <h3 className="font-display text-base font-bold text-white pt-1">Controls Reference</h3>
                <div className="grid grid-cols-2 gap-y-1.5 border-t border-slate-800 pt-2.5">
                  <span className="text-slate-400">Move / Drive</span>
                  <span className="font-mono-hud text-white">W A S D / Arrows</span>
                  <span className="text-slate-400">Sprint / Nitro Boost</span>
                  <span className="font-mono-hud text-white">Left Shift</span>
                  <span className="text-slate-400">Jump / Handbrake</span>
                  <span className="font-mono-hud text-white">Space</span>
                  <span className="text-slate-400">Punch / Fire · Kick · Block · Dodge</span>
                  <span className="font-mono-hud text-white">G or RMB · X · Q · Z</span>
                  <span className="text-slate-400">Enter Vehicle / Metro / Interior / Darshini</span>
                  <span className="font-mono-hud text-white">F or E</span>
                  <span className="text-slate-400">Smartphone / Radio Player</span>
                  <span className="font-mono-hud text-white">Tab / R</span>
                  <span className="text-slate-400">Switch Hero / Studio</span>
                  <span className="font-mono-hud text-white">P / U</span>
                  <span className="text-slate-400">Camera Mode / Face Close-Up</span>
                  <span className="font-mono-hud text-white">V / K</span>
                  <span className="text-slate-400">City Map / Pause Menu / Diagnostics</span>
                  <span className="font-mono-hud text-white">M / ESC / F3</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
