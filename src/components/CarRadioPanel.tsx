import React, { useMemo, useRef } from 'react';
import {
  Disc3,
  Pause,
  Play,
  Repeat,
  Shuffle,
  SkipBack,
  SkipForward,
  Upload,
  Volume2,
  X,
} from 'lucide-react';
import { RADIO_CATALOG, RADIO_CATEGORIES } from '../game/bengaluruData';
import { HudSnapshot, RadioCategoryId } from '../game/types';

interface CarRadioPanelProps {
  hud: HudSnapshot;
  onClose: () => void;
  onTogglePlay: () => void;
  onSetCategory: (cat: RadioCategoryId) => void;
  onSelectTrack: (idx: number) => void;
  onNextTrack: () => void;
  onPrevTrack: () => void;
  onSetVolume: (v: number) => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onUploadCustomTrack: (title: string, objectUrl: string) => void;
}

export const CarRadioPanel: React.FC<CarRadioPanelProps> = ({
  hud,
  onClose,
  onTogglePlay,
  onSetCategory,
  onSelectTrack,
  onNextTrack,
  onPrevTrack,
  onSetVolume,
  onToggleShuffle,
  onCycleRepeat,
  onUploadCustomTrack,
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { radioState } = hud;

  const activeTracks = useMemo(() => {
    if (radioState.category === 'custom_local') {
      return radioState.customTracks.length > 0
        ? radioState.customTracks
        : RADIO_CATALOG.slice(0, 3);
    }
    return RADIO_CATALOG.filter((t) => t.category === radioState.category);
  }, [radioState.category, radioState.customTracks]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      const cleanName = file.name.replace(/\.[^/.]+$/, '');
      onUploadCustomTrack(cleanName, url);
    });
    e.target.value = '';
  };

  return (
    <div className="fixed bottom-4 left-4 z-30 w-[410px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Disc3 className="h-4 w-4 text-amber-400" />
          <span className="font-display text-sm font-bold text-white">
            Namma Bengaluru Infotainment &amp; Radio
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Now Playing Deck */}
      <div className="border-b border-slate-800 bg-slate-900/60 p-3.5">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="truncate font-display text-sm font-bold text-amber-300">
              {radioState.trackTitle}
            </div>
            <div className="truncate text-xs text-slate-400">{radioState.trackArtist}</div>
          </div>
          <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-slate-300">
            {radioState.playing ? 'ON AIR' : 'PAUSED'}
          </span>
        </div>

        {/* Transport Controls */}
        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleShuffle}
              title="Shuffle"
              className={`rounded-md p-2 ${
                radioState.shuffle
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Shuffle className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onPrevTrack}
              title="Previous Track"
              className="rounded-md p-2 text-slate-200 hover:bg-slate-800"
            >
              <SkipBack className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onTogglePlay}
              title={radioState.playing ? 'Pause' : 'Play'}
              className="rounded-full bg-amber-500 p-2 text-slate-950 hover:bg-amber-400"
            >
              {radioState.playing ? (
                <Pause className="h-4 w-4 fill-slate-950" />
              ) : (
                <Play className="h-4 w-4 fill-slate-950" />
              )}
            </button>
            <button
              type="button"
              onClick={onNextTrack}
              title="Next Track"
              className="rounded-md p-2 text-slate-200 hover:bg-slate-800"
            >
              <SkipForward className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onCycleRepeat}
              title={`Repeat: ${radioState.repeat}`}
              className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-[10px] font-semibold ${
                radioState.repeat !== 'off'
                  ? 'bg-sky-500/20 text-sky-300'
                  : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Repeat className="h-3.5 w-3.5" />
              {radioState.repeat.toUpperCase()}
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            <Volume2 className="h-3.5 w-3.5 text-slate-400" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={radioState.volume}
              onChange={(e) => onSetVolume(Number(e.target.value))}
              className="h-1.5 w-20 accent-amber-400"
              aria-label="Radio Volume"
            />
          </div>
        </div>
      </div>

      {/* Category Grid */}
      <div className="border-b border-slate-800 p-3">
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Kannada &amp; Indian Stations
          </span>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold text-sky-300 hover:bg-sky-500/25"
          >
            <Upload className="h-3 w-3" />
            Upload MP3/WAV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/*"
            multiple
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {RADIO_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => onSetCategory(cat.id)}
              className={`rounded-md border px-2 py-1.5 text-left transition-colors ${
                radioState.category === cat.id
                  ? 'border-amber-400 bg-amber-500/15 text-white'
                  : 'border-slate-800 bg-slate-900 text-slate-300 hover:border-slate-600'
              }`}
            >
              <div className="truncate text-[10px] font-semibold">{cat.label}</div>
              <div className="truncate text-[9px] text-amber-400">{cat.kannada}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Track List */}
      <div className="max-h-40 overflow-y-auto p-2 space-y-1">
        {activeTracks.map((tr, idx) => {
          const active = idx === radioState.trackIndex;
          return (
            <button
              key={tr.id}
              type="button"
              onClick={() => onSelectTrack(idx)}
              className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs ${
                active
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'bg-slate-900/70 text-slate-200 hover:bg-slate-800'
              }`}
            >
              <div className="min-w-0 pr-2">
                <div className="truncate">{tr.title}</div>
                <div className={`truncate text-[10px] ${active ? 'text-slate-900' : 'text-slate-400'}`}>
                  {tr.artist} · {tr.mood}
                </div>
              </div>
              <span className="shrink-0 font-mono-hud text-[10px]">{tr.bpm} BPM</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
