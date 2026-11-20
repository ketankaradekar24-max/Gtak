/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CityMapModal } from './components/CityMapModal';
import { GameHud } from './components/GameHud';
import { PauseMenuModal, PauseTab } from './components/PauseMenuModal';
import { TitleScreen } from './components/TitleScreen';
import { BengaluruEngine } from './game/BengaluruEngine';
import { DistrictId, HudSnapshot } from './game/types';

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<BengaluruEngine | null>(null);

  const [hud, setHud] = useState<HudSnapshot | null>(null);
  const [started, setStarted] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [pauseTab, setPauseTab] = useState<PauseTab | null>(null);
  const [contextLost, setContextLost] = useState(false);

  // Mount Three.js engine once inside isolated ref container
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new BengaluruEngine(
      mountEl,
      (snapshot) => setHud(snapshot),
      () => setContextLost(true)
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync engine pause state when modals are open
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setPaused(mapOpen || pauseTab !== null);
  }, [mapOpen, pauseTab]);

  // Global keyboard shortcuts for Map (M) and Pause Menu (Escape)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (!started) return;
      if (e.code === 'KeyM') {
        e.preventDefault();
        setPauseTab(null);
        setMapOpen((prev) => !prev);
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (mapOpen) {
          setMapOpen(false);
        } else {
          setPauseTab((prev) => (prev ? null : 'missions'));
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [started, mapOpen]);

  const handleStart = useCallback(() => {
    setStarted(true);
    engineRef.current?.startGame();
  }, []);

  const handleStartMission1 = useCallback(() => {
    setStarted(true);
    engineRef.current?.startGame();
    engineRef.current?.startMission('m1_mg_escape');
  }, []);

  const handleSetWaypoint = useCallback((x: number, z: number, label: string) => {
    engineRef.current?.setCustomWaypoint(x, z, label);
  }, []);

  const handleClearWaypoint = useCallback(() => {
    engineRef.current?.clearWaypoint();
  }, []);

  const handleFastTravel = useCallback((districtId: DistrictId) => {
    engineRef.current?.teleportToDistrict(districtId);
  }, []);

  const handleStartMission = useCallback((missionId: string) => {
    engineRef.current?.startMission(missionId);
  }, []);

  return (
    <div
      className="relative h-screen w-screen overflow-hidden bg-[#0b0e14]"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Dedicated WebGL Mount Container */}
      <div ref={canvasMountRef} className="absolute inset-0 h-full w-full" />

      {contextLost && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 p-8 text-center">
          <h2 className="font-display text-2xl font-bold text-white">Graphics Context Interrupted</h2>
          <p className="mt-2 max-w-md text-sm text-slate-400">
            WebGL rendering was suspended by the browser. Reload the page to restore Bengaluru 3D.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-amber-500 px-5 py-2.5 text-sm font-semibold text-slate-950"
          >
            Reload Game
          </button>
        </div>
      )}

      {!started && (
        <TitleScreen onStart={handleStart} onStartMission1={handleStartMission1} />
      )}

      {started && hud && (
        <GameHud
          hud={hud}
          onOpenMap={() => {
            setPauseTab(null);
            setMapOpen(true);
          }}
          onOpenMenu={(tab = 'missions') => {
            setMapOpen(false);
            setPauseTab(tab);
          }}
          onSelectWeapon={(w) => engineRef.current?.selectWeapon(w)}
          onToggleRadio={() => engineRef.current?.toggleRadio()}
          onCancelMission={() => engineRef.current?.cancelMission()}
        />
      )}

      {started && hud && mapOpen && (
        <CityMapModal
          hud={hud}
          onClose={() => setMapOpen(false)}
          onSetWaypoint={handleSetWaypoint}
          onClearWaypoint={handleClearWaypoint}
          onFastTravel={handleFastTravel}
          onStartMission={handleStartMission}
        />
      )}

      {started && hud && pauseTab !== null && engineRef.current && (
        <PauseMenuModal
          initialTab={pauseTab}
          hud={hud}
          customization={engineRef.current.getCustomization()}
          vehicleTuning={engineRef.current.getVehicleTuning()}
          settings={engineRef.current.getSettings()}
          onClose={() => setPauseTab(null)}
          onStartMission={handleStartMission}
          onUpdateCustomization={(c) => engineRef.current?.applyCustomization(c)}
          onUpdateVehicleTuning={(t) => engineRef.current?.applyVehicleTuning(t)}
          onSpawnVehicle={(k) => engineRef.current?.spawnGarageVehicle(k)}
          onRepairVehicle={() => engineRef.current?.repairNearestVehicle()}
          onUpdateSettings={(s) => engineRef.current?.updateSettings(s)}
        />
      )}
    </div>
  );
}
