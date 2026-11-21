/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { CarRadioPanel } from './components/CarRadioPanel';
import { CharacterStudioOverlay } from './components/CharacterStudioOverlay';
import { CityMapModal } from './components/CityMapModal';
import { GameHud } from './components/GameHud';
import { InteriorUiModal } from './components/InteriorUiModal';
import { PauseMenuModal, PauseTab } from './components/PauseMenuModal';
import { SmartphoneOverlay } from './components/SmartphoneOverlay';
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
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [radioOpen, setRadioOpen] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [debugOpen, setDebugOpen] = useState(false);

  // Mount Three.js engine once inside isolated ref container
  useEffect(() => {
    const mountEl = canvasMountRef.current;
    if (!mountEl) return;

    const engine = new BengaluruEngine(
      mountEl,
      (snapshot) => setHud(snapshot),
      () => setContextLost(true),
      (errMsg) => setRenderError(errMsg)
    );
    engineRef.current = engine;

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  // Sync engine pause state when full-screen modals are open
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    engine.setPaused(mapOpen || pauseTab !== null || Boolean(hud?.interiorAction));
  }, [mapOpen, pauseTab, hud?.interiorAction]);

  // Sync 3D hand-held phone visibility with NammaOS Smartphone overlay
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    const activePhone = Boolean(started && phoneOpen && !mapOpen && pauseTab === null && !hud?.studioActive);
    engine.setPhoneOpen(activePhone);
  }, [started, phoneOpen, mapOpen, pauseTab, hud?.studioActive]);

  // Global keyboard shortcuts for Phone (Tab), Debug (F3), Map (M), Studio (U), Protagonist Cycle (P), and Pause Menu (Escape)
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if (e.code === 'F3') {
        e.preventDefault();
        if (started) setDebugOpen((prev) => !prev);
        return;
      }
      if (e.code === 'F8') {
        e.preventDefault();
        if (started && !mapOpen && pauseTab === null) {
          engineRef.current?.toggleCityShowcase();
        }
        return;
      }
      if (!started) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      const inFormField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';

      if (e.code === 'Tab') {
        e.preventDefault();
        if (!mapOpen && pauseTab === null && !hud?.studioActive) {
          setPhoneOpen((prev) => !prev);
        }
        return;
      }

      if (inFormField && e.code !== 'Escape') return;

      if (e.code === 'KeyM') {
        e.preventDefault();
        setPauseTab(null);
        setPhoneOpen(false);
        setMapOpen((prev) => !prev);
      } else if (e.code === 'KeyU' && !mapOpen && pauseTab === null) {
        e.preventDefault();
        setPhoneOpen(false);
        setRadioOpen(false);
        engineRef.current?.toggleStudioMode();
      } else if (e.code === 'KeyP' && !mapOpen && pauseTab === null) {
        e.preventDefault();
        engineRef.current?.cycleProtagonist();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        if (hud?.interiorAction) {
          if (hud.interiorAction !== 'jail_booking') {
            engineRef.current?.clearInteriorAction();
          }
        } else if (hud?.cityShowcaseActive) {
          engineRef.current?.toggleCityShowcase();
        } else if (mapOpen) {
          setMapOpen(false);
        } else if (pauseTab !== null) {
          setPauseTab(null);
        } else if (phoneOpen) {
          setPhoneOpen(false);
        } else if (radioOpen) {
          setRadioOpen(false);
        } else if (hud?.photoMode) {
          engineRef.current?.togglePhotoMode();
        } else if (hud?.studioActive) {
          engineRef.current?.toggleStudioMode();
        } else {
          setPauseTab('missions');
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, [started, mapOpen, pauseTab, phoneOpen, radioOpen, hud?.studioActive, hud?.interiorAction, hud?.photoMode, hud?.cityShowcaseActive]);

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

  const handleTakeSnapshot = useCallback(() => {
    const dataUrl = engineRef.current?.captureScreenshotDataUrl();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `namma-bengaluru-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

      {renderError && !contextLost && (
        <div className="fixed inset-x-0 top-4 z-50 mx-auto flex max-w-lg items-center justify-between gap-4 rounded-lg border border-red-500/60 bg-slate-950 px-4 py-3 text-xs text-slate-100 shadow-2xl">
          <div className="min-w-0">
            <div className="font-semibold text-red-400">Viewport Render Warning</div>
            <div className="mt-0.5 truncate text-slate-300">{renderError}</div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setRenderError(null)}
              className="rounded border border-slate-700 px-2.5 py-1 text-slate-200 hover:bg-slate-800 whitespace-nowrap"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded bg-amber-500 px-2.5 py-1 font-semibold text-slate-950 hover:bg-amber-400 whitespace-nowrap"
            >
              Reload
            </button>
          </div>
        </div>
      )}

      {!started && (
        <TitleScreen onStart={handleStart} onStartMission1={handleStartMission1} />
      )}

      {started && hud && !hud.studioActive && (
        <GameHud
          hud={hud}
          debugOpen={debugOpen}
          onToggleDebug={() => setDebugOpen((prev) => !prev)}
          onOpenMap={() => {
            setPauseTab(null);
            setPhoneOpen(false);
            setMapOpen(true);
          }}
          onOpenMenu={(tab = 'missions') => {
            setMapOpen(false);
            setPhoneOpen(false);
            setPauseTab(tab);
          }}
          onSelectWeapon={(w) => engineRef.current?.selectWeapon(w)}
          onToggleRadioPanel={() => setRadioOpen((prev) => !prev)}
          onTogglePhone={() => setPhoneOpen((prev) => !prev)}
          onTogglePhotoMode={() => engineRef.current?.togglePhotoMode()}
          onTakeSnapshot={handleTakeSnapshot}
          onExitInterior={() => engineRef.current?.exitInterior()}
          onExitMetro={() => engineRef.current?.exitMetroJourney()}
          onBoardMetro={() => engineRef.current?.boardMetroTrain()}
          onAlightToPlatform={() => engineRef.current?.alightToPlatform()}
          onUseTvm={() => engineRef.current?.openTvmModal()}
          onUseSmartCard={() => engineRef.current?.openSmartCardModal()}
          onPassSecurity={() => engineRef.current?.scanSecurityGate()}
          onScanExitGate={() => engineRef.current?.scanExitGate()}
          onSitInTrain={() => engineRef.current?.sitInTrain()}
          onHoldRail={() => engineRef.current?.toggleHoldRail()}
          onTalkPassenger={() => engineRef.current?.talkToMetroPassenger()}
          onCycleTrainCamera={() => engineRef.current?.cycleTrainCameraMode()}
          onToggleShowcase={() => engineRef.current?.toggleCityShowcase()}
          onToggleHomeLights={() => engineRef.current?.toggleHomeLights()}
          onToggleHomeCurtains={() => engineRef.current?.toggleHomeCurtains()}
          onCycleCamera={() => engineRef.current?.cycleCameraMode()}
          onToggleCloseup={() => engineRef.current?.toggleCloseupCamera()}
          onCycleProtagonist={() => engineRef.current?.cycleProtagonist()}
          onToggleStudio={() => engineRef.current?.toggleStudioMode()}
          onCancelMission={() => engineRef.current?.cancelMission()}
          onCancelRoute={() => engineRef.current?.cancelNavigation()}
        />
      )}

      {started && hud && !hud.studioActive && !mapOpen && pauseTab === null && phoneOpen && (
        <SmartphoneOverlay
          hud={hud}
          onClose={() => setPhoneOpen(false)}
          onBookNammaYatri={(rideType, destName, destX, destZ) =>
            engineRef.current?.bookNammaYatri(rideType, destName, destX, destZ)
          }
          onCancelNammaYatri={() => engineRef.current?.cancelNammaYatri()}
          onBuyMetroTicket={(fromId, toId) => engineRef.current?.buyMetroTicket(fromId, toId)}
          onBuySmartCard={() => engineRef.current?.buySmartCard()}
          onTopUpSmartCard={(amt) => engineRef.current?.topUpSmartCard(amt)}
          onEnterMetroStation={(stationId) => engineRef.current?.enterMetroStation(stationId)}
          onScanQrGate={() => engineRef.current?.scanQrGate()}
          onBoardMetroTrain={() => engineRef.current?.boardMetroTrain()}
          onExitMetroJourney={() => engineRef.current?.exitMetroJourney()}
          onSendMessage={(recipient, text) => engineRef.current?.sendPhoneMessage(recipient, text)}
          onCallContact={(contactName) => engineRef.current?.makeSimulatedCall(contactName)}
          onTransferBankToCash={(amount) => engineRef.current?.transferBankToCash(amount)}
          onBuyProperty={(id) => engineRef.current?.buyProperty(id)}
          onEnterInterior={(id) => engineRef.current?.enterInterior(id)}
          onSetWaypoint={handleSetWaypoint}
          onEatFromPantry={(itemId) => engineRef.current?.eatFromPantry(itemId)}
          onTogglePhotoMode={() => engineRef.current?.togglePhotoMode()}
          onToggleRadioPanel={() => setRadioOpen(true)}
          onSetLanguage={(lang) => engineRef.current?.setLanguage(lang)}
          onSetTimePreset={(preset) => engineRef.current?.updateSettings({ timePreset: preset })}
          onSaveSlot={(slot) => engineRef.current?.saveGameSlot(slot)}
          onLoadSlot={(slot) => engineRef.current?.loadGameSlot(slot)}
        />
      )}

      {started && hud && !hud.studioActive && !mapOpen && pauseTab === null && radioOpen && (
        <CarRadioPanel
          hud={hud}
          onClose={() => setRadioOpen(false)}
          onTogglePlay={() => engineRef.current?.toggleRadio()}
          onSetCategory={(cat) => engineRef.current?.setRadioCategory(cat)}
          onSelectTrack={(idx) => engineRef.current?.selectRadioTrack(idx)}
          onNextTrack={() => engineRef.current?.nextRadioTrack()}
          onPrevTrack={() => engineRef.current?.prevRadioTrack()}
          onSetVolume={(v) => engineRef.current?.setRadioVolume(v)}
          onToggleShuffle={() => engineRef.current?.toggleRadioShuffle()}
          onCycleRepeat={() => engineRef.current?.cycleRadioRepeat()}
          onUploadCustomTrack={(title, objectUrl) =>
            engineRef.current?.uploadCustomRadioTrack(title, objectUrl)
          }
        />
      )}

      {started && hud && hud.interiorAction && (
        <InteriorUiModal
          hud={hud}
          onClose={() => engineRef.current?.clearInteriorAction()}
          onSetTvState={(on, ch) => engineRef.current?.setTvState(on, ch)}
          onAddToBasket={(id, delta) => engineRef.current?.addToBasket(id, delta)}
          onCheckoutBasket={() => engineRef.current?.checkoutGroceryBasket()}
          onEatFromPantry={(id) => engineRef.current?.eatFromPantry(id)}
          onBuyWeapon={(w) => engineRef.current?.buyWeaponFromArmory(w)}
          onBuyMetroTicket={(fromId, toId) => engineRef.current?.buyMetroTicket(fromId, toId)}
          onBuySmartCard={() => engineRef.current?.buySmartCard()}
          onTopUpSmartCard={(amt) => engineRef.current?.topUpSmartCard(amt)}
          onPayJailBail={() => engineRef.current?.payJailBail()}
          onServeJailTime={() => engineRef.current?.serveJailTime()}
        />
      )}

      {started && hud && hud.studioActive && !mapOpen && pauseTab === null && (
        <CharacterStudioOverlay
          hud={hud}
          onSwitchProtagonist={(id) => engineRef.current?.switchProtagonist(id)}
          onSetAngle={(angle) => engineRef.current?.setStudioAngle(angle)}
          onSetPose={(pose) => engineRef.current?.setStudioPose(pose)}
          onSetStudioLighting={(preset) => engineRef.current?.setStudioLighting(preset)}
          onSetYawOffset={(deg) => engineRef.current?.setStudioYawOffset(deg)}
          onOpenWardrobe={() => setPauseTab('wardrobe')}
          onExitStudio={() => engineRef.current?.toggleStudioMode()}
        />
      )}

      {started && hud && mapOpen && engineRef.current && (
        <CityMapModal
          hud={hud}
          allRoads={engineRef.current.getAllRoads()}
          onClose={() => setMapOpen(false)}
          onSetWaypoint={handleSetWaypoint}
          onClearWaypoint={handleClearWaypoint}
          onFastTravel={handleFastTravel}
          onStartMission={handleStartMission}
          onPlanRoute={(tx, tz, label, mode) => engineRef.current!.planRoute(tx, tz, label, mode)}
          onStartNavigation={(route) => engineRef.current?.startNavigation(route)}
          onTravelRoute={(route) => engineRef.current?.travelRoute(route)}
          onCancelNavigation={() => engineRef.current?.cancelNavigation()}
          onImportGeoJson={(raw) => engineRef.current!.importCustomGeoJson(raw)}
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
          onSwitchProtagonist={(id) => engineRef.current?.switchProtagonist(id)}
          onOpenStudio={() => {
            if (!hud.studioActive) engineRef.current?.toggleStudioMode();
          }}
          onUpdateCustomization={(c) => engineRef.current?.applyCustomization(c)}
          onUpdateVehicleTuning={(t) => engineRef.current?.applyVehicleTuning(t)}
          onSpawnVehicle={(k) => engineRef.current?.spawnGarageVehicle(k)}
          onRepairVehicle={() => engineRef.current?.repairNearestVehicle()}
          onUpdateSettings={(s) => engineRef.current?.updateSettings(s)}
          onSaveSlot={(slot) => engineRef.current?.saveGameSlot(slot)}
          onLoadSlot={(slot) => engineRef.current?.loadGameSlot(slot)}
        />
      )}
    </div>
  );
}
