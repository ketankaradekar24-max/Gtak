import React from 'react';
import {
  Activity,
  AlertTriangle,
  Armchair,
  Camera,
  Car,
  CloudFog,
  CloudLightning,
  CloudRain,
  Compass,
  DoorOpen,
  Film,
  Fuel,
  Hand,
  Lightbulb,
  Map as MapIcon,
  MessageSquare,
  Moon,
  Radio,
  Shield,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Star,
  Sun,
  TrainFront,
  UserCheck,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { getUiStrings } from '../game/localization';
import { HudSnapshot, WeaponKind } from '../game/types';
import { MinimapCanvas } from './MinimapCanvas';

interface GameHudProps {
  hud: HudSnapshot;
  debugOpen: boolean;
  onToggleDebug: () => void;
  onOpenMap: () => void;
  onOpenMenu: (tab?: 'missions' | 'garage' | 'wardrobe' | 'settings') => void;
  onSelectWeapon: (w: WeaponKind) => void;
  onToggleRadioPanel: () => void;
  onTogglePhone: () => void;
  onTogglePhotoMode: () => void;
  onTakeSnapshot: () => void;
  onExitInterior: () => void;
  onExitMetro: () => void;
  onBoardMetro: () => void;
  onAlightToPlatform: () => void;
  onUseTvm: () => void;
  onUseSmartCard: () => void;
  onPassSecurity: () => void;
  onScanExitGate: () => void;
  onSitInTrain: () => void;
  onHoldRail: () => void;
  onTalkPassenger: () => void;
  onCycleTrainCamera: () => void;
  onToggleShowcase: () => void;
  onToggleHomeLights: () => void;
  onToggleHomeCurtains: () => void;
  onCycleCamera: () => void;
  onToggleCloseup: () => void;
  onCycleProtagonist: () => void;
  onToggleStudio: () => void;
  onCancelMission: () => void;
  onCancelRoute: () => void;
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

function weatherLabel(w: HudSnapshot['weather']): string {
  switch (w) {
    case 'light_rain':
      return 'Light Rain';
    case 'monsoon':
      return 'Monsoon Rain';
    case 'thunderstorm':
      return 'Thunderstorm';
    case 'fog':
      return 'Morning Fog';
    case 'cloudy':
      return 'Cloudy';
    default:
      return 'Clear';
  }
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  debugOpen,
  onToggleDebug,
  onOpenMap,
  onOpenMenu,
  onSelectWeapon,
  onToggleRadioPanel,
  onTogglePhone,
  onTogglePhotoMode,
  onTakeSnapshot,
  onExitInterior,
  onExitMetro,
  onBoardMetro,
  onAlightToPlatform,
  onUseTvm,
  onUseSmartCard,
  onPassSecurity,
  onScanExitGate,
  onSitInTrain,
  onHoldRail,
  onTalkPassenger,
  onCycleTrainCamera,
  onToggleShowcase,
  onToggleHomeLights,
  onToggleHomeCurtains,
  onCycleCamera,
  onToggleCloseup,
  onCycleProtagonist,
  onToggleStudio,
  onCancelMission,
  onCancelRoute,
}) => {
  const ui = getUiStrings(hud.language);
  const isNight = hud.timeOfDayHours < 6 || hud.timeOfDayHours >= 19;

  if (hud.photoMode) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-20 flex justify-center p-4">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/92 px-4 py-2.5 shadow-2xl">
          <span className="text-xs font-semibold text-amber-400">
            Photo Mode · Drag Mouse to Orbit Camera
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTakeSnapshot();
            }}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400"
          >
            <Camera className="h-3.5 w-3.5" />
            Take Snapshot (PNG)
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onTogglePhotoMode();
            }}
            className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
          >
            <X className="h-3.5 w-3.5" />
            Exit Photo Mode
          </button>
        </div>
      </div>
    );
  }

  if (hud.cityShowcaseActive) {
    return (
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-20 flex justify-center px-4">
        <div className="pointer-events-auto flex flex-wrap items-center gap-4 rounded-xl border border-amber-500/50 bg-slate-950/95 px-5 py-3 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <Film className="h-4 w-4 text-amber-400" />
            <div>
              <div className="font-display text-sm font-bold text-slate-100">
                Live 3D City Showcase · {hud.cityShowcaseLabel || 'Bengaluru'}
              </div>
              <div className="text-[11px] text-slate-400 tabular-nums">
                {formatClock(hud.timeOfDayHours)} · {weatherLabel(hud.weather)} · Real-Time Three.js World
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.currentTarget.blur();
              onToggleShowcase();
            }}
            className="flex items-center gap-1.5 rounded-lg bg-amber-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-amber-400 whitespace-nowrap"
          >
            <X className="h-3.5 w-3.5" />
            Exit Showcase [F8 / Esc]
          </button>
        </div>
      </div>
    );
  }

  const isHomeInterior =
    hud.activeInterior === 'indiranagar_villa' ||
    hud.activeInterior === 'koramangala_house' ||
    hud.activeInterior === 'whitefield_apt';

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-4">
      {/* Top Row */}
      <div className="flex items-start justify-between gap-4">
        <div className="pointer-events-auto flex flex-col gap-2">
          <div className="rounded-lg border border-slate-700/80 bg-slate-950/95 px-3.5 py-2.5">
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-base font-bold tracking-wide text-slate-100">
                {hud.locationAnchorLabel || hud.districtName}
              </span>
              <span className="text-xs text-amber-400">{hud.districtKannada}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-slate-300 tabular-nums">
              <span className="inline-flex items-center gap-1 font-mono-hud font-semibold text-slate-100">
                {isNight ? <Moon className="h-3.5 w-3.5 text-sky-400" /> : <Sun className="h-3.5 w-3.5 text-amber-400" />}
                {hud.timePreset === 'ist_realtime' ? hud.istClockLabel : formatClock(hud.timeOfDayHours)}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{hud.istWeekday}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>{hud.istDateLabel}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-sky-300">{hud.clockModeLabel}</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
              <span>{hud.timezoneLabel}</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="inline-flex items-center gap-1">
                {hud.weather === 'thunderstorm' ? (
                  <CloudLightning className="h-3.5 w-3.5 text-amber-300" />
                ) : hud.weather === 'fog' ? (
                  <CloudFog className="h-3.5 w-3.5 text-slate-300" />
                ) : hud.weather === 'monsoon' || hud.weather === 'light_rain' ? (
                  <CloudRain className="h-3.5 w-3.5 text-sky-400" />
                ) : null}
                {weatherLabel(hud.weather)}
              </span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span>
                {hud.discoveredDistricts.length}/{hud.totalDistricts} {ui.zonesLabel}
              </span>
            </div>
            <div className="mt-1 font-mono-hud text-[10px] text-slate-400 tabular-nums">
              Sunrise {hud.solarTimes.sunrise} · Sunset {hud.solarTimes.sunset} · Solar {hud.solarTimes.elevationDeg.toFixed(1)}°
            </div>
            <div className="mt-0.5 font-mono-hud text-[10px] text-slate-400 tabular-nums">
              GPS {hud.playerLat.toFixed(4)}°N, {hud.playerLon.toFixed(4)}°E · UTM {hud.utmEasting}E {hud.utmNorthing}N
            </div>
          </div>

          {hud.nearStation && (
            <div className="rounded-lg border border-purple-500/40 bg-slate-950/95 px-3 py-1.5 text-xs">
              <div className="font-semibold text-white">{hud.nearStation.name}</div>
              <div className="text-[11px] text-slate-400">
                {hud.nearStation.kind === 'metro'
                  ? `Namma Metro · ${hud.nearStation.line?.toUpperCase()} Line · ${
                      hud.nearStation.status === 'under_construction' ? 'Under Construction' : 'Operational'
                    }`
                  : hud.nearStation.kind === 'rail'
                  ? 'Bengaluru Railway Terminal'
                  : 'BMTC Bus Transit Hub'}
              </div>
            </div>
          )}

          {hud.trafficCongestion.active && hud.metroJourney.phase === 'none' && !hud.activeInterior && (
            <div
              className={`rounded-lg border bg-slate-950/95 px-3 py-1.5 text-xs ${
                hud.trafficCongestion.severity === 'heavy'
                  ? 'border-red-500/60'
                  : hud.trafficCongestion.severity === 'moderate'
                  ? 'border-amber-500/50'
                  : 'border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 font-semibold text-slate-100">
                  <AlertTriangle
                    className={`h-3.5 w-3.5 ${
                      hud.trafficCongestion.severity === 'heavy' ? 'text-red-400' : 'text-amber-400'
                    }`}
                  />
                  {hud.trafficCongestion.zoneName}
                </span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-bold uppercase whitespace-nowrap ${
                    hud.trafficCongestion.severity === 'heavy'
                      ? 'bg-red-500/20 text-red-300'
                      : 'bg-amber-500/20 text-amber-300'
                  }`}
                >
                  {hud.trafficCongestion.severity === 'heavy' ? 'Heavy Jam' : 'Moderate Jam'}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400 tabular-nums">
                {hud.trafficCongestion.reason} · {hud.trafficCongestion.vehicleCount} vehicles
              </div>
            </div>
          )}

          {hud.nammaYatri.status !== 'idle' && (
            <div className="rounded-lg border border-emerald-500/50 bg-slate-950/95 px-3 py-1.5 text-xs">
              <div className="font-semibold text-emerald-400">
                Namma Yatri ({hud.nammaYatri.rideType.toUpperCase()}) · {hud.nammaYatri.plateNumber}
              </div>
              <div className="text-[11px] text-slate-300 tabular-nums">
                {hud.nammaYatri.driverName} → {hud.nammaYatri.destName} · ETA {hud.nammaYatri.etaSec}s
              </div>
              {hud.nammaYatriPassengerMode && (
                <div className="mt-0.5 text-[11px] font-medium text-amber-300">
                  Chauffeur Mode Active · Passenger Rear Seat (Controls Locked)
                </div>
              )}
            </div>
          )}

          {hud.wantedStars > 0 && (
            <div className="rounded-lg border border-red-500/50 bg-slate-950/95 px-3 py-1.5">
              <div className="flex items-center gap-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${s <= hud.wantedStars ? 'fill-red-500 text-red-500' : 'text-slate-700'}`}
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

        {/* Center Mission, Arrest, Metro, Interior, GPS Route & Toasts */}
        <div className="flex max-w-md flex-col items-center gap-2 text-center">
          {hud.arrestStage !== 'none' && hud.arrestStage !== 'pursuit' && (
            <div className="pointer-events-auto rounded-lg border border-red-500/70 bg-slate-950/95 px-4 py-2 text-xs shadow-xl">
              <div className="font-display font-bold text-red-400">
                {hud.arrestStage === 'officers_approaching'
                  ? 'Bengaluru Police Intercepting — Stand Down'
                  : hud.arrestStage === 'cuffing'
                  ? 'Placed Under Arrest — Handcuffs Applied'
                  : hud.arrestStage === 'escorting_to_car'
                  ? 'Police Escort to Patrol SUV'
                  : hud.arrestStage === 'driving_to_station'
                  ? `Police Transport En Route to ${hud.arrestStationName || 'Police Station'}`
                  : `Booked at ${hud.arrestStationName || 'Police Station'}`}
              </div>
              <div className="mt-0.5 text-[11px] text-slate-300 tabular-nums">
                {hud.arrestOfficerCount > 0 ? `${hud.arrestOfficerCount} Officers on Scene · ` : ''}
                Station Bail: ₹{hud.jailBailCost.toLocaleString('en-IN')}
              </div>
            </div>
          )}

          {hud.metroJourney.phase !== 'none' && (
            <div className="pointer-events-auto rounded-lg border border-purple-500/60 bg-slate-950/95 px-4 py-2.5 text-xs">
              <div className="flex items-center justify-center gap-2.5">
                <TrainFront className="h-4 w-4 text-purple-400" />
                <span className="font-display font-bold text-purple-300">
                  {hud.metroJourney.stationName} ({hud.metroJourney.stationKannada})
                </span>
                <button
                  type="button"
                  onClick={(e) => {
                    e.currentTarget.blur();
                    onExitMetro();
                  }}
                  className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800 whitespace-nowrap"
                >
                  Exit Station
                </button>
              </div>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-slate-400 tabular-nums">
                <span className="capitalize">{hud.metroJourney.line} Line</span>
                <span aria-hidden="true">·</span>
                <span>{hud.metroJourney.elevatedStation ? 'Elevated Viaduct' : 'Underground'}</span>
                <span aria-hidden="true">·</span>
                {(hud.metroJourney.phase === 'riding' || hud.metroJourney.phase === 'arrived') ? (
                  <span className="font-semibold text-purple-300">
                    Coach {hud.metroJourney.activeCoachIndex}/{hud.metroJourney.coachCount}
                  </span>
                ) : (
                  <>
                    <span className={hud.metroJourney.securityCleared ? 'text-emerald-300' : 'text-amber-300'}>
                      Security: {hud.metroJourney.securityCleared ? 'Cleared' : 'Required'}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-300">
                      {hud.metroJourney.smartCardOwned
                        ? `Smart Card ₹${hud.metroJourney.smartCardBalance}`
                        : 'No Smart Card'}
                    </span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span>
                  {hud.metroJourney.elevatorMoving
                    ? 'Lift Moving'
                    : `Lift at ${hud.metroJourney.elevatorFloor === 'platform' ? 'Platform' : 'Concourse'}`}
                </span>
                {hud.metroJourney.onEscalator && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-sky-300">
                      Escalator {hud.metroJourney.onEscalator === 'up' ? 'Up' : 'Down'}
                    </span>
                  </>
                )}
              </div>
              <p className="mt-1 text-[11px] text-slate-200">{hud.metroJourney.announcement}</p>
              {hud.metroJourney.interchangeStationName && (
                <p className="mt-0.5 text-[11px] text-sky-300">
                  Interchange via {hud.metroJourney.interchangeStationName}
                </p>
              )}
              {(hud.canUseTvm || hud.canUseSmartCard || hud.canPassSecurity || hud.canScanExitGate) && (
                <div className="mt-2 flex flex-wrap items-center justify-center gap-1.5">
                  {hud.canUseTvm && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onUseTvm();
                      }}
                      className="rounded-md bg-purple-500 px-3 py-1 text-[11px] font-bold text-white hover:bg-purple-400 whitespace-nowrap"
                    >
                      Use TVM Ticket Machine [F]
                    </button>
                  )}
                  {hud.canUseSmartCard && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onUseSmartCard();
                      }}
                      className="rounded-md bg-emerald-500 px-3 py-1 text-[11px] font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap"
                    >
                      Smart Card Kiosk [F]
                    </button>
                  )}
                  {hud.canPassSecurity && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onPassSecurity();
                      }}
                      className="rounded-md bg-amber-500 px-3 py-1 text-[11px] font-bold text-slate-950 hover:bg-amber-400 whitespace-nowrap"
                    >
                      Pass Security Check [F]
                    </button>
                  )}
                  {hud.canScanExitGate && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onScanExitGate();
                      }}
                      className="rounded-md bg-sky-500 px-3 py-1 text-[11px] font-bold text-slate-950 hover:bg-sky-400 whitespace-nowrap"
                    >
                      Scan Exit Fare Gate [F]
                    </button>
                  )}
                </div>
              )}
              {hud.metroJourney.phase === 'platform' && (
                <div className="mt-1.5 flex flex-col items-center gap-1.5">
                  <p className="font-mono-hud text-[11px] text-amber-400 tabular-nums">
                    {hud.metroJourney.boardingTransition
                      ? 'Stepping through Train Doors...'
                      : hud.metroJourney.trainPhase === 'boarding'
                      ? 'Train Boarding — Doors Open · Press [F] or Click Board'
                      : hud.metroJourney.trainPhase === 'doors_closing'
                      ? 'Doors Closing — Stand Clear'
                      : hud.metroJourney.trainPhase === 'approaching'
                      ? `Train Approaching (${Math.ceil(hud.metroJourney.trainWaitSec)}s)`
                      : hud.metroJourney.trainWaitSec > 0.5
                      ? `Next Train in ${Math.ceil(hud.metroJourney.trainWaitSec)}s`
                      : 'Train Departing'}
                  </p>
                  {hud.canBoardMetro && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onBoardMetro();
                      }}
                      className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap"
                    >
                      <TrainFront className="h-3.5 w-3.5" />
                      BOARD METRO [F]
                    </button>
                  )}
                </div>
              )}
              {(hud.metroJourney.phase === 'riding' || hud.metroJourney.phase === 'arrived') && (
                <div className="mt-2 space-y-2">
                  <div className="flex items-center justify-between gap-3 text-[11px] text-slate-300 tabular-nums">
                    <span>To {hud.metroJourney.destinationName || 'Next Station'}</span>
                    <span className="font-mono-hud font-semibold text-emerald-400">
                      {hud.metroJourney.trainSpeedKmh} KM/H · {hud.metroJourney.stopsRemaining} stops left
                    </span>
                  </div>
                  <div className="h-1.5 w-full overflow-hidden rounded bg-slate-800">
                    <div
                      className="h-full bg-purple-400"
                      style={{ width: `${Math.round(hud.metroJourney.rideProgress * 100)}%` }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-1.5 pt-0.5">
                    {hud.canSitInTrain && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onSitInTrain();
                        }}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium whitespace-nowrap ${
                          hud.isSitting
                            ? 'border-amber-400 bg-amber-500 text-slate-950 font-semibold'
                            : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-amber-400'
                        }`}
                      >
                        <Armchair className="h-3 w-3" />
                        {hud.isSitting ? 'Stand Up' : 'Sit'}
                      </button>
                    )}
                    {hud.canHoldRail && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onHoldRail();
                        }}
                        className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[10px] font-medium whitespace-nowrap ${
                          hud.metroJourney.holdingRail
                            ? 'border-sky-400 bg-sky-500 text-slate-950 font-semibold'
                            : 'border-slate-700 bg-slate-900 text-slate-200 hover:border-sky-400'
                        }`}
                      >
                        <Hand className="h-3 w-3" />
                        {hud.metroJourney.holdingRail ? 'Holding Rail' : 'Hold Rail'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onTalkPassenger();
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-200 hover:border-purple-400 whitespace-nowrap"
                    >
                      <MessageSquare className="h-3 w-3 text-purple-300" />
                      Talk Passenger
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.currentTarget.blur();
                        onCycleTrainCamera();
                      }}
                      className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-medium text-slate-200 hover:border-sky-400 whitespace-nowrap"
                    >
                      <Camera className="h-3 w-3 text-sky-300" />
                      Cam: {hud.metroJourney.trainCameraMode} [V]
                    </button>
                    {hud.canExitTrain && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.currentTarget.blur();
                          onAlightToPlatform();
                        }}
                        className="inline-flex items-center gap-1 rounded bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-slate-950 hover:bg-emerald-400 whitespace-nowrap"
                      >
                        <DoorOpen className="h-3 w-3" />
                        EXIT TRAIN [F]
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {hud.activeInterior && (
            <div className="pointer-events-auto flex items-center gap-2 rounded-lg border border-emerald-500/50 bg-slate-950/92 px-3.5 py-1.5 text-xs">
              <span className="font-semibold text-emerald-300 capitalize">
                Inside {hud.activeInterior.replace('_', ' ')}
              </span>
              {isHomeInterior && (
                <>
                  <button
                    type="button"
                    onClick={onToggleHomeLights}
                    className="inline-flex items-center gap-1 rounded border border-slate-700 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-slate-800"
                  >
                    <Lightbulb className="h-3 w-3" />
                    {hud.homeLightsOn ? 'Lights ON' : 'Dim'}
                  </button>
                  <button
                    type="button"
                    onClick={onToggleHomeCurtains}
                    className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-sky-300 hover:bg-slate-800"
                  >
                    {hud.homeCurtainsOpen ? 'Curtains Open' : 'Closed'}
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={onExitInterior}
                className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-slate-700"
              >
                <DoorOpen className="h-3 w-3" /> Exit
              </button>
            </div>
          )}

          {hud.activeRoute && (
            <div className="pointer-events-auto rounded-lg border border-sky-500/60 bg-slate-950/92 px-4 py-2">
              <div className="flex items-center justify-center gap-3">
                <span className="font-display text-xs font-bold text-sky-400">
                  GPS → {hud.activeRoute.destinationName}
                </span>
                <span className="font-mono-hud text-xs text-slate-200">
                  {hud.activeRoute.distanceKm.toFixed(1)} km · ~{hud.activeRoute.etaMinutes}m
                </span>
                <button
                  type="button"
                  onClick={onCancelRoute}
                  className="rounded border border-slate-700 px-2 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800 hover:text-white"
                >
                  Clear
                </button>
              </div>
              <p className="mt-0.5 text-[11px] text-slate-300">{hud.activeRoute.summary}</p>
            </div>
          )}

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

        {/* Top-Right: Vitals & Action Buttons */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <div className="flex flex-wrap items-center justify-end gap-3 rounded-lg border border-slate-700/80 bg-slate-950/90 px-3.5 py-2">
            <div className="text-right">
              <div className="font-mono-hud text-base font-bold text-emerald-400">
                ₹{hud.cash.toLocaleString('en-IN')}
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 w-16 overflow-hidden rounded bg-slate-800" title={`Health ${hud.health}%`}>
                  <div
                    className="h-full bg-emerald-500"
                    style={{ width: `${Math.max(0, Math.min(100, (hud.health / hud.maxHealth) * 100))}%` }}
                  />
                </div>
                <div className="flex items-center gap-1" title={`Armor ${hud.armor}%`}>
                  <Shield className="h-3 w-3 text-sky-400" />
                  <div className="h-2 w-12 overflow-hidden rounded bg-slate-800">
                    <div
                      className="h-full bg-sky-400"
                      style={{ width: `${Math.max(0, Math.min(100, (hud.armor / hud.maxArmor) * 100))}%` }}
                    />
                  </div>
                </div>
                <div className="h-2 w-12 overflow-hidden rounded bg-slate-800" title={`Stamina ${hud.stamina}%`}>
                  <div
                    className="h-full bg-amber-400"
                    style={{ width: `${Math.max(0, Math.min(100, hud.stamina))}%` }}
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-800 pl-3">
              <button
                type="button"
                onClick={onTogglePhone}
                title="Open NammaOS Smartphone (Tab)"
                className="flex h-9 items-center gap-1.5 rounded-md border border-emerald-500/40 bg-slate-900 px-2.5 text-xs font-medium text-emerald-300 hover:border-emerald-400 hover:text-white whitespace-nowrap"
              >
                <Smartphone className="h-3.5 w-3.5" />
                {ui.phoneBtn}
              </button>
              <button
                type="button"
                onClick={onToggleRadioPanel}
                title="Open Radio & Music Player (R)"
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-amber-400 hover:text-white whitespace-nowrap"
              >
                <Radio className={`h-3.5 w-3.5 ${hud.radioOn ? 'text-amber-400' : 'text-slate-500'}`} />
                {ui.radioBtn}
              </button>
              <button
                type="button"
                onClick={onCycleProtagonist}
                title="Switch Protagonist (P)"
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-amber-400 hover:text-white whitespace-nowrap"
              >
                <Users className="h-3.5 w-3.5 text-amber-400" />
                {hud.protagonistName.split(' ')[0]} [P]
              </button>
              <button
                type="button"
                onClick={onToggleStudio}
                title="Character Cinematography Studio (U)"
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-purple-400 hover:text-white whitespace-nowrap"
              >
                <Sparkles className="h-3.5 w-3.5 text-purple-400" />
                {ui.studioBtn}
              </button>
              <button
                type="button"
                onClick={onCycleCamera}
                title="Cycle Camera Mode (V)"
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-sky-400 hover:text-white whitespace-nowrap"
              >
                <Camera className="h-3.5 w-3.5 text-sky-400" />
                {hud.cameraMode === 'cockpit'
                  ? 'Cockpit'
                  : hud.cameraMode === 'closeup'
                  ? 'Face'
                  : hud.cameraMode === 'cinematic'
                  ? 'Cine'
                  : 'Cam'}
              </button>
              <button
                type="button"
                onClick={onOpenMap}
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-amber-400 hover:text-white whitespace-nowrap"
              >
                <MapIcon className="h-3.5 w-3.5 text-amber-400" />
                {ui.mapBtn}
              </button>
              <button
                type="button"
                onClick={() => onOpenMenu('garage')}
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-cyan-400 hover:text-white whitespace-nowrap"
              >
                <Wrench className="h-3.5 w-3.5 text-cyan-400" />
                {ui.garageBtn}
              </button>
              <button
                type="button"
                onClick={() => onOpenMenu('missions')}
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-slate-500 hover:text-white whitespace-nowrap"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                {ui.menuBtn}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleShowcase();
                }}
                title="Live 3D City Showcase Tour (F8)"
                className="flex h-9 items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 text-xs font-medium text-slate-200 hover:border-amber-400 hover:text-white whitespace-nowrap"
              >
                <Film className="h-3.5 w-3.5 text-amber-400" />
                Showcase [F8]
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.currentTarget.blur();
                  onToggleDebug();
                }}
                title="Toggle Diagnostics Overlay (F3)"
                className={`flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium whitespace-nowrap ${
                  debugOpen
                    ? 'border-sky-400 bg-sky-500 text-slate-950 font-semibold'
                    : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-sky-400 hover:text-white'
                }`}
              >
                <Activity className="h-3.5 w-3.5" />
                Debug [F3]
              </button>
            </div>
          </div>

          {!hud.inVehicle ? (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onToggleCloseup}
                title="Inspect Character Face Close-Up (K)"
                className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium whitespace-nowrap ${
                  hud.cameraMode === 'closeup'
                    ? 'border-amber-400 bg-amber-500 text-slate-950 font-semibold'
                    : 'border-slate-800 bg-slate-950/90 text-slate-300 hover:border-slate-600'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" />
                Face Cam [K]
              </button>
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
                {(hud.weapon === 'tactical' || hud.weapon === 'emp') && (
                  <span className="px-2 font-mono-hud text-[11px] font-bold text-amber-400">
                    {hud.ammo}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={onToggleRadioPanel}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/90 px-3 py-1.5 text-xs text-slate-300 hover:border-slate-600"
            >
              <Radio className={`h-3.5 w-3.5 ${hud.radioOn ? 'text-amber-400' : 'text-slate-500'}`} />
              <span className="max-w-[240px] truncate">
                {hud.radioOn ? hud.radioTrack : ui.radioOff}
              </span>
            </button>
          )}

          {debugOpen && (
            <div className="w-80 rounded-lg border border-slate-700 bg-slate-950/95 p-3 text-left font-mono-hud text-[11px] text-slate-200 tabular-nums shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span className="font-semibold text-sky-400">Diagnostics Telemetry</span>
                <span className="text-emerald-400">{hud.fps} FPS</span>
              </div>
              <div className="mt-1.5 space-y-1 text-[10px]">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">World XYZ</span>
                  <span>
                    {hud.debugTelemetry.worldX.toFixed(1)}, {hud.debugTelemetry.worldY.toFixed(1)},{' '}
                    {hud.debugTelemetry.worldZ.toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Resolved Anchor</span>
                  <span className="truncate text-amber-300">
                    {hud.debugTelemetry.resolvedLocation} ({hud.debugTelemetry.anchorX.toFixed(0)},{' '}
                    {hud.debugTelemetry.anchorZ.toFixed(0)})
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Movement State</span>
                  <span>{hud.debugTelemetry.movementState}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Camera</span>
                  <span>
                    {hud.debugTelemetry.cameraMode} · FOV {hud.debugTelemetry.fov}°
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Camera Pos</span>
                  <span>
                    {hud.debugTelemetry.cameraPos[0].toFixed(1)},{' '}
                    {hud.debugTelemetry.cameraPos[1].toFixed(1)},{' '}
                    {hud.debugTelemetry.cameraPos[2].toFixed(1)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Clock Mode</span>
                  <span>
                    {hud.clockModeLabel} · {hud.timezoneLabel}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">World Partition</span>
                  <span>
                    {hud.partitionStats.activeHighCells}H / {hud.partitionStats.activeMediumCells}M /{' '}
                    {hud.partitionStats.culledCells}C ({hud.partitionStats.totalCells})
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Entities</span>
                  <span>
                    {hud.debugTelemetry.activeVehiclesCount} Veh · {hud.debugTelemetry.activeNpcsCount} NPCs ·{' '}
                    {hud.debugTelemetry.policeCount} Pol
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-400">Render Error</span>
                  <span className={hud.debugTelemetry.renderError ? 'text-red-400' : 'text-emerald-400'}>
                    {hud.debugTelemetry.renderError || 'None'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Row */}
      <div className="flex items-end justify-between gap-4">
        <div className="pointer-events-auto">
          <MinimapCanvas hud={hud} onOpenFullMap={onOpenMap} />
        </div>

        <div className="flex max-w-xl flex-col items-center gap-2 text-center">
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

          <div className="rounded border border-slate-800/80 bg-slate-950/80 px-3 py-1 text-[11px] text-slate-400">
            {hud.inVehicle
              ? ui.phoneHint
              : `${ui.phoneHint} · G/RMB Attack · X Kick · Q Block · Z Dodge`}
          </div>
        </div>

        <div className="pointer-events-auto min-w-[205px]">
          {hud.inVehicle ? (
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/92 px-4 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1.5 text-xs text-slate-400">
                <Car className="h-3.5 w-3.5 text-amber-400" />
                <span className="max-w-[160px] truncate">{hud.vehicleLabel}</span>
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
              <div className="mt-1.5 flex items-center gap-2 text-[10px] text-slate-400">
                <Fuel className="h-3 w-3 text-amber-400" />
                <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-800">
                  <div
                    className={`h-full ${hud.vehicleFuel < 20 ? 'bg-red-500' : 'bg-amber-400'}`}
                    style={{ width: `${Math.max(0, Math.min(100, hud.vehicleFuel))}%` }}
                  />
                </div>
                <span className="font-mono-hud">{hud.vehicleFuel}%</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-slate-700/80 bg-slate-950/92 px-3.5 py-2.5 text-right">
              <div className="flex items-center justify-end gap-1.5 text-xs text-slate-300">
                <Compass className="h-3.5 w-3.5 text-amber-400" />
                <span>
                  {hud.isBlocking
                    ? ui.blocking
                    : hud.isSwimming
                    ? ui.swimming
                    : hud.isSitting
                    ? ui.sitting
                    : hud.isCrouching
                    ? ui.crouching
                    : `${ui.onFoot} · ${hud.protagonistName.split(' ')[0]}`}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-slate-400">
                {ui.tokensLabel} {hud.collectedIds.length}/12 · {ui.missionsLabel} {hud.completedMissions.length}/7
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
