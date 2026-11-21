import React, { useState } from 'react';
import { Camera, ChevronDown, ChevronUp, RotateCw, Sparkles, Sun, User, X } from 'lucide-react';
import { PROTAGONIST_PRESETS } from '../game/bengaluruData';
import {
  HudSnapshot,
  ProtagonistId,
  StudioAngleId,
  StudioLightingPreset,
  StudioPoseId,
} from '../game/types';

interface CharacterStudioOverlayProps {
  hud: HudSnapshot;
  onSwitchProtagonist: (id: ProtagonistId) => void;
  onSetAngle: (angle: StudioAngleId) => void;
  onSetPose: (pose: StudioPoseId) => void;
  onSetStudioLighting: (preset: StudioLightingPreset) => void;
  onSetYawOffset: (deg: number) => void;
  onOpenWardrobe: () => void;
  onExitStudio: () => void;
}

const ANGLES: Array<{ id: StudioAngleId; label: string }> = [
  { id: 'three_quarter', label: '3/4 View' },
  { id: 'front', label: 'Front' },
  { id: 'face_closeup', label: 'Face Close-Up' },
  { id: 'left_profile', label: 'Left Profile' },
  { id: 'right_profile', label: 'Right Profile' },
  { id: 'back', label: 'Back' },
  { id: 'full_body', label: 'Full Body' },
];

const POSES: Array<{ id: StudioPoseId; label: string }> = [
  { id: 'idle', label: 'Idle' },
  { id: 'walk', label: 'Walk' },
  { id: 'run', label: 'Run' },
  { id: 'talk', label: 'Talk' },
  { id: 'laugh', label: 'Laugh' },
  { id: 'anger', label: 'Anger' },
  { id: 'fear', label: 'Fear' },
  { id: 'fight', label: 'Fight' },
];

const LIGHTING_PRESETS: Array<{ id: StudioLightingPreset; label: string }> = [
  { id: 'daylight', label: 'Daylight' },
  { id: 'golden_hour', label: 'Golden Hour' },
  { id: 'softbox', label: 'Softbox' },
  { id: 'night_neon', label: 'Night Neon' },
];

const PROTAGONISTS: ProtagonistId[] = ['vikram', 'arjun', 'sathish'];

export const CharacterStudioOverlay: React.FC<CharacterStudioOverlayProps> = ({
  hud,
  onSwitchProtagonist,
  onSetAngle,
  onSetPose,
  onSetStudioLighting,
  onSetYawOffset,
  onOpenWardrobe,
  onExitStudio,
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const activeProfile = PROTAGONIST_PRESETS[hud.protagonistId];

  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-4">
      {/* Top Bar: Character Bio + Exit */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto max-w-md rounded-lg border border-slate-700/90 bg-slate-950/92 px-4 py-3 shadow-xl">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-amber-400">
            <Sparkles className="h-3.5 w-3.5" />
            Character Cinematography Studio
          </div>
          <div className="mt-1 flex items-baseline gap-2.5">
            <h2 className="font-display text-lg font-bold text-white">{activeProfile.name}</h2>
            <span className="text-xs font-medium text-sky-400">
              {activeProfile.archetypeTitle} · Age {activeProfile.age}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-slate-300">{activeProfile.personality}</p>
          <p className="mt-1 text-[11px] text-slate-400">{activeProfile.bodySummary}</p>
        </div>

        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenWardrobe}
            className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-950/92 px-3.5 py-2 text-xs font-semibold text-slate-200 hover:border-amber-400 hover:text-white"
          >
            <User className="h-3.5 w-3.5 text-amber-400" />
            Customize Wardrobe
          </button>
          <button
            type="button"
            onClick={onExitStudio}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            <X className="h-4 w-4" />
            Exit Studio [U]
          </button>
        </div>
      </div>

      {/* Bottom Dock: Protagonist Switcher, Camera Angles, 360° Turntable, Lighting & Animations */}
      <div className="pointer-events-auto mx-auto w-full max-w-5xl rounded-xl border border-slate-700/90 bg-slate-950/92 shadow-2xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 px-4 py-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <Camera className="h-3.5 w-3.5 text-sky-400" />
            <span>
              Welded SkinnedMesh · SSS Skin &amp; Pore Maps · Chaos Cloth ({hud.weather})
            </span>
          </div>
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            className="flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[11px] text-slate-300 hover:bg-slate-800"
          >
            {collapsed ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Expand Controls
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Minimize
              </>
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="grid grid-cols-1 gap-3 p-3.5 md:grid-cols-4">
            {/* Protagonist Selector */}
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                1. Playable Protagonist [P]
              </div>
              <div className="flex flex-col gap-1.5">
                {PROTAGONISTS.map((pid) => {
                  const prof = PROTAGONIST_PRESETS[pid];
                  const active = hud.protagonistId === pid;
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => onSwitchProtagonist(pid)}
                      className={`rounded-md border px-2.5 py-1.5 text-left transition-colors ${
                        active
                          ? 'border-amber-400 bg-amber-500/15 text-white'
                          : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{prof.name}</span>
                        <span className="text-[10px] text-amber-400">{prof.archetypeTitle}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Camera Angles */}
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                2. Camera Angle Inspection
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ANGLES.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => onSetAngle(a.id)}
                    className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                      hud.studioAngle === a.id
                        ? 'bg-sky-500 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Poses & Expressions */}
            <div>
              <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                3. Animation &amp; Expression
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {POSES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSetPose(p.id)}
                    className={`rounded py-1.5 text-xs font-medium transition-colors ${
                      hud.studioPose === p.id
                        ? 'bg-amber-500 text-slate-950 font-semibold'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 360° Turntable Yaw & Studio Lighting */}
            <div className="space-y-2.5">
              <div>
                <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <span className="inline-flex items-center gap-1">
                    <RotateCw className="h-3 w-3 text-sky-400" />
                    4. 360° Turntable ({hud.studioYawOffset}°)
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetYawOffset(0)}
                    className="text-[10px] text-amber-400 hover:underline"
                  >
                    Reset
                  </button>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={hud.studioYawOffset}
                  onChange={(e) => onSetYawOffset(Number(e.target.value))}
                  className="h-1.5 w-full accent-sky-400"
                />
              </div>

              <div>
                <div className="mb-1.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  <Sun className="h-3 w-3 text-amber-400" />
                  5. Studio Lighting
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {LIGHTING_PRESETS.map((lp) => (
                    <button
                      key={lp.id}
                      type="button"
                      onClick={() => onSetStudioLighting(lp.id)}
                      className={`rounded py-1.5 text-xs font-medium transition-colors ${
                        hud.studioLighting === lp.id
                          ? 'bg-emerald-500 text-slate-950 font-semibold'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      {lp.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
