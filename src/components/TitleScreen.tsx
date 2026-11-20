import React from 'react';
import { Compass, MapPin, Play } from 'lucide-react';

interface TitleScreenProps {
  onStart: () => void;
  onStartMission1: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({ onStart, onStartMission1 }) => {
  return (
    <div className="fixed inset-0 z-20 flex items-end bg-gradient-to-t from-slate-950/95 via-slate-950/55 to-slate-950/30 p-8 md:p-12">
      <div className="max-w-2xl space-y-5">
        <div className="text-xs font-semibold uppercase tracking-widest text-amber-400">
          Open-World 3D Action · Bengaluru, India
        </div>
        <h1 className="font-display text-4xl font-extrabold tracking-tight text-white md:text-6xl">
          Namma City: Bengaluru
        </h1>
        <p className="text-sm leading-relaxed text-slate-300 md:text-base">
          Explore 14 iconic districts from Vidhana Soudha and Cubbon Park to MG Road Metro,
          Silk Board Flyover, Indiranagar, Electronic City, and NICE Road. Drive Namma Auto-Rickshaws,
          BMTC Volvo buses, superbikes, and custom coupes through living traffic and monsoon skies.
        </p>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onStart}
            className="flex items-center gap-2 rounded-lg bg-amber-500 px-6 py-3 text-sm font-bold text-slate-950 shadow-lg hover:bg-amber-400 transition-colors"
          >
            <Play className="h-4 w-4 fill-slate-950" />
            Enter Bengaluru Free Roam
          </button>
          <button
            type="button"
            onClick={onStartMission1}
            className="flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-900/90 px-5 py-3 text-sm font-semibold text-white hover:border-amber-400 transition-colors"
          >
            <Compass className="h-4 w-4 text-amber-400" />
            Start Mission 01: MG Road Breakout
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-4 pt-2 text-xs text-slate-400">
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-amber-400" />
            WASD Move &amp; Drive · F Enter Vehicle · H Horn · M City Atlas · ESC Garage &amp; Missions
          </span>
        </div>
      </div>
    </div>
  );
};
