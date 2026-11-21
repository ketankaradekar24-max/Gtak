import React, { useMemo, useState } from 'react';
import {
  Building2,
  Camera,
  Car,
  Check,
  Clock,
  CreditCard,
  Globe,
  Home,
  MapPin,
  MessageSquare,
  Phone,
  PhoneCall,
  QrCode,
  Radio,
  Save,
  Send,
  ShoppingBag,
  Sparkles,
  TrainFront,
  Utensils,
  X,
} from 'lucide-react';
import {
  DISTRICTS,
  GROCERY_ITEMS,
  LANDMARK_MARKERS,
  METRO_STATIONS,
} from '../game/bengaluruData';
import { LANGUAGE_LABELS } from '../game/localization';
import { listSaveSlots } from '../game/saveSystem';
import {
  HudSnapshot,
  InteriorId,
  LanguageId,
  SaveSlotSummary,
  TimePreset,
} from '../game/types';

type PhoneTab = 'home' | 'yatri' | 'metro' | 'chat' | 'homes' | 'pantry';

interface SmartphoneOverlayProps {
  hud: HudSnapshot;
  onClose: () => void;
  onBookNammaYatri: (rideType: 'auto' | 'cab', destName: string, destX: number, destZ: number) => void;
  onCancelNammaYatri: () => void;
  onBuyMetroTicket: (fromId: string, toId: string) => void;
  onBuySmartCard: () => void;
  onTopUpSmartCard: (amount: number) => void;
  onEnterMetroStation: (stationId: string) => void;
  onScanQrGate: () => void;
  onBoardMetroTrain: () => void;
  onExitMetroJourney: () => void;
  onSendMessage: (recipient: string, text: string) => void;
  onCallContact: (contactName: string) => void;
  onTransferBankToCash: (amount: number) => void;
  onBuyProperty: (id: InteriorId) => void;
  onEnterInterior: (id: InteriorId) => void;
  onSetWaypoint: (x: number, z: number, label: string) => void;
  onEatFromPantry: (itemId: string) => void;
  onTogglePhotoMode: () => void;
  onToggleRadioPanel: () => void;
  onSetLanguage: (lang: LanguageId) => void;
  onSetTimePreset: (preset: TimePreset) => void;
  onSaveSlot: (slot: number) => void;
  onLoadSlot: (slot: number) => void;
}

const CONTACTS = [
  { name: 'Auto Anna (Ramesh)', role: 'MG Road Stand' },
  { name: 'Vikram Tech Fixer', role: 'Indiranagar 100ft' },
  { name: 'Namma Metro Helpline', role: 'Purple / Green Line' },
  { name: 'Sri Ganesh Darshini', role: 'Tiffin & Filter Kaapi' },
];

function renderQrCells(seed: string): boolean[] {
  const cells: boolean[] = [];
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 7; c++) {
      const isCorner =
        (r < 2 && c < 2) || (r < 2 && c > 4) || (r > 4 && c < 2);
      if (isCorner) {
        cells.push(true);
      } else {
        h ^= (r * 11 + c * 7) | 0;
        h = Math.imul(h, 16777619);
        cells.push((h & 1) === 1);
      }
    }
  }
  return cells;
}

export const SmartphoneOverlay: React.FC<SmartphoneOverlayProps> = ({
  hud,
  onClose,
  onBookNammaYatri,
  onCancelNammaYatri,
  onBuyMetroTicket,
  onBuySmartCard,
  onTopUpSmartCard,
  onEnterMetroStation,
  onScanQrGate,
  onBoardMetroTrain,
  onExitMetroJourney,
  onSendMessage,
  onCallContact,
  onTransferBankToCash,
  onBuyProperty,
  onEnterInterior,
  onSetWaypoint,
  onEatFromPantry,
  onTogglePhotoMode,
  onToggleRadioPanel,
  onSetLanguage,
  onSetTimePreset,
  onSaveSlot,
  onLoadSlot,
}) => {
  const [tab, setTab] = useState<PhoneTab>('home');
  const [rideType, setRideType] = useState<'auto' | 'cab'>('auto');
  const [yatriDestId, setYatriDestId] = useState<string>('indiranagar');
  const [chatRecipient, setChatRecipient] = useState<string>(CONTACTS[0].name);
  const [chatDraft, setChatDraft] = useState<string>('');
  const [activeCall, setActiveCall] = useState<string | null>(null);
  const [saveRefresh, setSaveRefresh] = useState(0);

  const operationalStations = useMemo(
    () => METRO_STATIONS.filter((s) => s.status === 'operational'),
    []
  );
  const [fromStationId, setFromStationId] = useState<string>(
    hud.nearStation?.kind === 'metro' && hud.nearStation.status === 'operational'
      ? hud.nearStation.id
      : operationalStations[0]?.id || 'mg_road_m'
  );
  const [toStationId, setToStationId] = useState<string>(
    operationalStations.find((s) => s.id !== fromStationId)?.id || operationalStations[1]?.id || 'indiranagar_m'
  );

  const slots = useMemo<Array<SaveSlotSummary | null>>(() => {
    void saveRefresh;
    return listSaveSlots();
  }, [saveRefresh]);

  const properties = useMemo(
    () => LANDMARK_MARKERS.filter((l) => l.type === 'interior' && l.interiorId && l.price !== undefined),
    []
  );
  const shopsAndServices = useMemo(
    () => LANDMARK_MARKERS.filter((l) => l.type === 'interior' && l.price === undefined),
    []
  );

  const pantryEntries = useMemo(
    () =>
      Object.entries(hud.pantryItems)
        .filter(([, qty]) => qty > 0)
        .map(([id, qty]) => ({
          qty,
          def: GROCERY_ITEMS.find((g) => g.id === id),
        }))
        .filter((e): e is { qty: number; def: NonNullable<typeof e.def> } => Boolean(e.def)),
    [hud.pantryItems]
  );

  const selectedYatriDistrict = DISTRICTS.find((d) => d.id === yatriDestId) || DISTRICTS[0];

  return (
    <div className="fixed bottom-4 right-4 z-30 flex h-[600px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[28px] border-4 border-slate-700 bg-slate-950 shadow-2xl">
      {/* Phone Status Bar */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900 px-4 py-2 text-[11px] text-slate-300">
        <span className="font-mono-hud font-semibold text-amber-400">
          {hud.istClockLabel.slice(0, 5)} IST
        </span>
        <span className="text-[10px] font-medium text-slate-400">
          NammaOS · Simulated
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-slate-800 p-1 text-slate-300 hover:bg-slate-700 hover:text-white"
          title="Close Phone (Tab)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Main Phone Viewport */}
      <div className="flex-1 overflow-y-auto p-3.5 text-xs text-slate-200">
        {tab === 'home' && (
          <div className="space-y-3.5">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-baseline justify-between">
                <span className="font-display text-lg font-bold text-white tabular-nums">
                  {hud.istClockLabel}
                </span>
                <span className="text-[10px] text-amber-400">
                  {hud.istWeekday} · {hud.istDateLabel}
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  {hud.locationAnchorLabel || hud.districtName} ({hud.districtKannada})
                </span>
                <span className="capitalize">{hud.weather.replace('_', ' ')}</span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[10px] text-slate-400 tabular-nums">
                <span>{hud.timezoneLabel}</span>
                <span>
                  Sunrise {hud.solarTimes.sunrise} · Sunset {hud.solarTimes.sunset}
                </span>
              </div>
              <div className="mt-2.5 grid grid-cols-2 gap-2 border-t border-slate-800 pt-2 text-[11px]">
                <div>
                  <span className="text-slate-400">Cash:</span>{' '}
                  <span className="font-mono-hud font-semibold text-emerald-400">
                    ₹{hud.cash.toLocaleString('en-IN')}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400">Bank:</span>{' '}
                  <span className="font-mono-hud font-semibold text-sky-400">
                    ₹{hud.bankBalance.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setTab('yatri')}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 hover:border-amber-400"
              >
                <Car className="h-5 w-5 text-amber-400" />
                <span className="text-[11px] font-semibold">Namma Yatri</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('metro')}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 hover:border-purple-400"
              >
                <TrainFront className="h-5 w-5 text-purple-400" />
                <span className="text-[11px] font-semibold">Metro QR</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('chat')}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 hover:border-emerald-400"
              >
                <MessageSquare className="h-5 w-5 text-emerald-400" />
                <span className="text-[11px] font-semibold">Calls &amp; Chat</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('homes')}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 hover:border-sky-400"
              >
                <Building2 className="h-5 w-5 text-sky-400" />
                <span className="text-[11px] font-semibold">Homes &amp; Bank</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('pantry')}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 hover:border-orange-400"
              >
                <ShoppingBag className="h-5 w-5 text-orange-400" />
                <span className="text-[11px] font-semibold">Pantry &amp; Save</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  onTogglePhotoMode();
                  onClose();
                }}
                className="flex flex-col items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-900 p-3 hover:border-pink-400"
              >
                <Camera className="h-5 w-5 text-pink-400" />
                <span className="text-[11px] font-semibold">Photo Mode</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onToggleRadioPanel}
              className="flex w-full items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-3 py-2.5 hover:border-amber-400"
            >
              <div className="flex items-center gap-2">
                <Radio className={`h-4 w-4 ${hud.radioOn ? 'text-amber-400' : 'text-slate-500'}`} />
                <div className="text-left">
                  <div className="text-[11px] font-semibold text-white">Namma FM &amp; Music</div>
                  <div className="max-w-[200px] truncate text-[10px] text-slate-400">
                    {hud.radioOn ? hud.radioTrack : 'Tap to open Car & Pocket Radio'}
                  </div>
                </div>
              </div>
              <span className="text-[10px] font-semibold text-amber-400">Open</span>
            </button>

            {/* Quick Language & Real-Time IST Clock Toggle */}
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                  <Globe className="h-3.5 w-3.5 text-sky-400" />
                  Language / ಭಾಷೆ
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onSetTimePreset(hud.timePreset === 'ist_realtime' ? 'auto' : 'ist_realtime')
                  }
                  className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                    hud.timePreset === 'ist_realtime'
                      ? 'bg-emerald-500 text-slate-950'
                      : 'bg-slate-800 text-slate-300'
                  }`}
                >
                  <Clock className="h-3 w-3" />
                  {hud.timePreset === 'ist_realtime' ? 'IST Live (1:1)' : 'Game-Time'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                {LANGUAGE_LABELS.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => onSetLanguage(l.id)}
                    className={`rounded px-2 py-1 text-[10px] font-semibold ${
                      hud.language === l.id
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {l.native}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'yatri' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-white">
                Namma Yatri Dispatch (Simulated)
              </h3>
              <span className="text-[10px] text-emerald-400">KA-01 Metered</span>
            </div>

            {hud.nammaYatri.status !== 'idle' ? (
              <div className="rounded-xl border border-amber-500/50 bg-slate-900 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-amber-400 uppercase text-[11px]">
                    {hud.nammaYatri.status.replace('_', ' ')}
                  </span>
                  <span className="font-mono-hud text-xs text-white">
                    ETA {hud.nammaYatri.etaSec}s
                  </span>
                </div>
                <div className="text-xs font-semibold text-white">
                  {hud.nammaYatri.driverName} · {hud.nammaYatri.plateNumber}
                </div>
                <div className="text-[11px] text-slate-400">
                  Destination: {hud.nammaYatri.destName} ({hud.nammaYatri.distanceKm} km · ₹{hud.nammaYatri.fare})
                </div>
                {hud.nammaYatri.status === 'waiting_pickup' && (
                  <div className="rounded bg-emerald-500/15 px-2.5 py-1.5 text-[11px] font-medium text-emerald-300">
                    Vehicle waiting outside! Walk close &amp; press [F] to board.
                  </div>
                )}
                <button
                  type="button"
                  onClick={onCancelNammaYatri}
                  className="w-full rounded-lg border border-red-500/40 bg-red-500/10 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20"
                >
                  Cancel Ride
                </button>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRideType('auto')}
                    className={`rounded-lg border py-2 text-xs font-semibold ${
                      rideType === 'auto'
                        ? 'border-amber-400 bg-amber-500 text-slate-950'
                        : 'border-slate-700 bg-slate-950 text-slate-300'
                    }`}
                  >
                    Auto Rickshaw
                  </button>
                  <button
                    type="button"
                    onClick={() => setRideType('cab')}
                    className={`rounded-lg border py-2 text-xs font-semibold ${
                      rideType === 'cab'
                        ? 'border-sky-400 bg-sky-500 text-slate-950'
                        : 'border-slate-700 bg-slate-950 text-slate-300'
                    }`}
                  >
                    City Mini Cab
                  </button>
                </div>

                <div>
                  <label className="text-[11px] font-medium text-slate-400">
                    Drop-off Zone (35 Bengaluru Locations)
                  </label>
                  <select
                    value={yatriDestId}
                    onChange={(e) => setYatriDestId(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-2.5 py-2 text-xs text-white focus:border-amber-400 focus:outline-none"
                  >
                    {DISTRICTS.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.kannadaName})
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    onBookNammaYatri(
                      rideType,
                      selectedYatriDistrict.name,
                      selectedYatriDistrict.x,
                      selectedYatriDistrict.z
                    );
                  }}
                  className="w-full rounded-lg bg-emerald-500 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Dispatch Live 3D {rideType === 'auto' ? 'Auto' : 'Cab'}
                </button>
                <p className="text-[10px] text-slate-400">
                  Simulated in-game pickup: a 3D driver spawns nearby, drives to you, and chauffeurs you to {selectedYatriDistrict.name}.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === 'metro' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-white">
                Namma Metro QR (Simulated)
              </h3>
              <span className="text-[10px] text-purple-400">BMRCL Virtual</span>
            </div>

            {hud.metroJourney.phase !== 'none' && (
              <div className="rounded-xl border border-purple-500/50 bg-slate-900 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-purple-300">
                    {hud.metroJourney.stationName}
                  </span>
                  <span className="rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] uppercase text-purple-300">
                    {hud.metroJourney.phase}
                    {(hud.metroJourney.phase === 'riding' || hud.metroJourney.phase === 'arrived') &&
                      ` · Coach ${hud.metroJourney.activeCoachIndex}/${hud.metroJourney.coachCount}`}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5 text-[10px]">
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      hud.metroJourney.securityCleared
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    Security: {hud.metroJourney.securityCleared ? 'Cleared' : 'Pending'}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 font-semibold ${
                      hud.metroJourney.gateUnlocked
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    Fare Gate: {hud.metroJourney.gateUnlocked ? 'Open' : 'Locked'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-300">{hud.metroJourney.announcement}</p>
                <div className="flex flex-wrap gap-1.5">
                  {hud.metroJourney.phase === 'concourse' && (
                    <button
                      type="button"
                      onClick={onScanQrGate}
                      className="rounded bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950"
                    >
                      Scan QR / Card Gate
                    </button>
                  )}
                  {hud.metroJourney.phase === 'platform' && (
                    <button
                      type="button"
                      onClick={onBoardMetroTrain}
                      className="rounded bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950"
                    >
                      Board Metro Train
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onExitMetroJourney}
                    className="rounded border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300"
                  >
                    Exit Station
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-emerald-500/40 bg-slate-900 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-300">
                  <CreditCard className="h-3.5 w-3.5" />
                  BMRCL Smart Card (5% Off)
                </span>
                <span className="font-mono-hud text-xs font-bold text-white">
                  {hud.metroJourney.smartCardOwned
                    ? `₹${hud.metroJourney.smartCardBalance}`
                    : 'Not Issued'}
                </span>
              </div>
              {!hud.metroJourney.smartCardOwned ? (
                <button
                  type="button"
                  onClick={onBuySmartCard}
                  className="w-full rounded-lg bg-emerald-500 py-1.5 text-[11px] font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Issue Smart Card (₹100 Credit)
                </button>
              ) : (
                <div className="grid grid-cols-3 gap-1.5">
                  {[100, 200, 500].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => onTopUpSmartCard(amt)}
                      className="rounded bg-slate-800 py-1 text-[10px] font-semibold text-emerald-300 hover:bg-slate-700"
                    >
                      + ₹{amt}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 space-y-2">
              <div>
                <label className="text-[10px] text-slate-400">From Operational Station</label>
                <select
                  value={fromStationId}
                  onChange={(e) => setFromStationId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                >
                  {operationalStations.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.line.toUpperCase()})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-400">To Destination Station</label>
                <select
                  value={toStationId}
                  onChange={(e) => setToStationId(e.target.value)}
                  className="mt-0.5 w-full rounded border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-white"
                >
                  {operationalStations
                    .filter((s) => s.id !== fromStationId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.line.toUpperCase()})
                      </option>
                    ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onBuyMetroTicket(fromStationId, toStationId)}
                  className="flex-1 rounded-lg bg-purple-500 py-2 text-xs font-bold text-white hover:bg-purple-400"
                >
                  Buy QR Ticket
                </button>
                {hud.metroJourney.phase === 'none' && (
                  <button
                    type="button"
                    onClick={() => {
                      onEnterMetroStation(fromStationId);
                      onClose();
                    }}
                    className="rounded-lg border border-purple-500/40 bg-purple-500/15 px-3 py-2 text-xs font-semibold text-purple-200 hover:bg-purple-500/25"
                  >
                    Walk In
                  </button>
                )}
              </div>
            </div>

            {hud.metroTickets.length > 0 && (
              <div className="space-y-2">
                {hud.metroTickets.slice(0, 2).map((t) => {
                  const cells = renderQrCells(t.qrCode);
                  return (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-2.5"
                    >
                      <div className="grid h-14 w-14 shrink-0 grid-cols-7 gap-0.5 rounded bg-white p-1">
                        {cells.map((filled, idx) => (
                          <div
                            key={idx}
                            className={filled ? 'bg-slate-950' : 'bg-white'}
                          />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <span className="truncate font-semibold text-white">
                            {t.fromName} → {t.toName}
                          </span>
                        </div>
                        <div className="font-mono-hud text-[10px] text-amber-400">
                          <QrCode className="mr-1 inline h-3 w-3" />
                          {t.qrCode} · ₹{t.fare}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {t.used ? 'Scanned / Used' : 'Active QR · Ready for Gate'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'chat' && (
          <div className="space-y-3">
            <h3 className="font-display text-sm font-bold text-white">
              Simulated Calls &amp; Kannada Chat
            </h3>

            {activeCall && (
              <div className="flex items-center justify-between rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2">
                <div>
                  <div className="text-xs font-bold text-emerald-300">
                    On Call (Simulated): {activeCall}
                  </div>
                  <div className="text-[10px] text-slate-300">Speaking Kannada / English...</div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveCall(null)}
                  className="rounded bg-red-500 px-2.5 py-1 text-[10px] font-bold text-white"
                >
                  End
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              {CONTACTS.map((c) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    setActiveCall(c.name);
                    setChatRecipient(c.name);
                    onCallContact(c.name);
                  }}
                  className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 p-2 text-left hover:border-emerald-400"
                >
                  <PhoneCall className="h-3.5 w-3.5 shrink-0 text-emerald-400" />
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-white">{c.name}</div>
                    <div className="truncate text-[10px] text-slate-400">{c.role}</div>
                  </div>
                </button>
              ))}
            </div>

            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-800 bg-slate-900 p-2.5">
              {hud.messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-lg p-2 text-[11px] ${
                    m.fromPlayer
                      ? 'ml-6 bg-amber-500/20 text-amber-100'
                      : 'mr-4 bg-slate-800 text-slate-200'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-400">
                    <span className="font-semibold text-amber-400">{m.sender}</span>
                    <span>{m.time}</span>
                  </div>
                  {m.kannadaText && <div className="mt-0.5 text-slate-100">{m.kannadaText}</div>}
                  <div className="mt-0.5 text-slate-300">{m.text}</div>
                </div>
              ))}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatDraft.trim()) return;
                onSendMessage(chatRecipient, chatDraft);
                setChatDraft('');
              }}
              className="flex gap-1.5"
            >
              <input
                type="text"
                value={chatDraft}
                onChange={(e) => setChatDraft(e.target.value)}
                placeholder={`Message ${chatRecipient.split(' ')[0]}...`}
                className="flex-1 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-lg bg-amber-500 px-3 py-1.5 text-slate-950 hover:bg-amber-400"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>
        )}

        {tab === 'homes' && (
          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 font-semibold text-white">
                  <CreditCard className="h-4 w-4 text-sky-400" />
                  Namma Bank UPI
                </span>
                <span className="font-mono-hud text-sm font-bold text-sky-400">
                  ₹{hud.bankBalance.toLocaleString('en-IN')}
                </span>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => onTransferBankToCash(1000)}
                  className="flex-1 rounded bg-slate-800 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Withdraw ₹1,000
                </button>
                <button
                  type="button"
                  onClick={() => onTransferBankToCash(5000)}
                  className="flex-1 rounded bg-slate-800 py-1.5 text-[11px] font-semibold text-slate-200 hover:bg-slate-700"
                >
                  Withdraw ₹5,000
                </button>
              </div>
              {hud.transactions.length > 0 && (
                <div className="mt-2 max-h-24 space-y-1 overflow-y-auto border-t border-slate-800 pt-2 text-[10px]">
                  {hud.transactions.slice(0, 4).map((tx) => (
                    <div key={tx.id} className="flex justify-between text-slate-400">
                      <span className="truncate pr-2">{tx.label}</span>
                      <span className={tx.amount >= 0 ? 'text-emerald-400' : 'text-red-400'}>
                        {tx.amount >= 0 ? '+' : ''}₹{tx.amount.toLocaleString('en-IN')}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Bengaluru Residences (3D Interiors)
              </div>
              {properties.map((p) => {
                const owned = p.interiorId ? hud.ownedProperties.includes(p.interiorId) : false;
                return (
                  <div
                    key={p.id}
                    className="rounded-xl border border-slate-800 bg-slate-900 p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-white">{p.name}</span>
                      {owned ? (
                        <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-400">
                          <Check className="h-3 w-3" /> Owned
                        </span>
                      ) : (
                        <span className="font-mono-hud text-[11px] text-amber-400">
                          ₹{p.price?.toLocaleString('en-IN')}
                        </span>
                      )}
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          onSetWaypoint(p.x, p.z, p.name);
                          onClose();
                        }}
                        className="flex items-center gap-1 rounded bg-slate-800 px-2.5 py-1 text-[10px] font-semibold text-sky-300 hover:bg-slate-700"
                      >
                        <MapPin className="h-3 w-3" /> GPS
                      </button>
                      {owned && p.interiorId ? (
                        <button
                          type="button"
                          onClick={() => {
                            onEnterInterior(p.interiorId!);
                            onClose();
                          }}
                          className="flex-1 rounded bg-emerald-500 py-1 text-[10px] font-bold text-slate-950 hover:bg-emerald-400"
                        >
                          Enter 3D Home
                        </button>
                      ) : (
                        p.interiorId && (
                          <button
                            type="button"
                            onClick={() => onBuyProperty(p.interiorId!)}
                            className="flex-1 rounded bg-amber-500 py-1 text-[10px] font-bold text-slate-950 hover:bg-amber-400"
                          >
                            Buy Deed
                          </button>
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="space-y-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                City Stores &amp; Gym GPS
              </div>
              {shopsAndServices.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5"
                >
                  <span className="text-[11px] font-medium text-slate-200">{s.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      onSetWaypoint(s.x, s.z, s.name);
                      onClose();
                    }}
                    className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-semibold text-amber-400 hover:bg-slate-700"
                  >
                    Route
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'pantry' && (
          <div className="space-y-3">
            <div>
              <h3 className="font-display text-sm font-bold text-white flex items-center gap-1.5">
                <Utensils className="h-4 w-4 text-orange-400" />
                Home Pantry (Namma Mart Stock)
              </h3>
              {pantryEntries.length === 0 ? (
                <p className="mt-1.5 rounded-lg border border-slate-800 bg-slate-900 p-2.5 text-[11px] text-slate-400">
                  Pantry empty. Visit Namma Mart Supermarket on MG Road to buy milk, rice, bread &amp; snacks!
                </p>
              ) : (
                <div className="mt-2 space-y-1.5">
                  {pantryEntries.map(({ def, qty }) => (
                    <div
                      key={def.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-2"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate text-[11px] font-semibold text-white">
                          {def.name} <span className="text-amber-400">×{qty}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {def.kannadaName} · +{def.healthRestore} HP
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEatFromPantry(def.id)}
                        className="shrink-0 rounded bg-emerald-500 px-2.5 py-1 text-[10px] font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        Eat
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="border-t border-slate-800 pt-2.5 space-y-2">
              <div className="flex items-center gap-1.5 font-display text-sm font-bold text-white">
                <Save className="h-4 w-4 text-sky-400" />
                3-Slot Progress Save
              </div>
              {[1, 2, 3].map((slotNum, i) => {
                const info = slots[i];
                return (
                  <div
                    key={slotNum}
                    className="rounded-lg border border-slate-800 bg-slate-900 p-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-white">Slot {slotNum}</span>
                      <span className="text-[10px] text-slate-400">
                        {info ? info.districtName : 'Empty'}
                      </span>
                    </div>
                    {info && (
                      <div className="mt-0.5 text-[10px] text-slate-400">
                        {info.protagonistName} · ₹{info.cash.toLocaleString('en-IN')} · {info.savedAt}
                      </div>
                    )}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onSaveSlot(slotNum);
                          setSaveRefresh((n) => n + 1);
                        }}
                        className="flex-1 rounded bg-sky-500 py-1 text-[10px] font-bold text-slate-950 hover:bg-sky-400"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        disabled={!info}
                        onClick={() => onLoadSlot(slotNum)}
                        className="flex-1 rounded border border-slate-700 bg-slate-950 py-1 text-[10px] font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-40"
                      >
                        Load
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Navigation Bar */}
      <div className="grid grid-cols-5 border-t border-slate-800 bg-slate-900 px-1 py-1.5 text-[10px]">
        <button
          type="button"
          onClick={() => setTab('home')}
          className={`flex flex-col items-center gap-0.5 py-1 ${
            tab === 'home' ? 'text-amber-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Home className="h-4 w-4" />
          Home
        </button>
        <button
          type="button"
          onClick={() => setTab('yatri')}
          className={`flex flex-col items-center gap-0.5 py-1 ${
            tab === 'yatri' ? 'text-amber-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Car className="h-4 w-4" />
          Yatri
        </button>
        <button
          type="button"
          onClick={() => setTab('metro')}
          className={`flex flex-col items-center gap-0.5 py-1 ${
            tab === 'metro' ? 'text-purple-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <TrainFront className="h-4 w-4" />
          Metro
        </button>
        <button
          type="button"
          onClick={() => setTab('chat')}
          className={`flex flex-col items-center gap-0.5 py-1 ${
            tab === 'chat' ? 'text-emerald-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Phone className="h-4 w-4" />
          Call
        </button>
        <button
          type="button"
          onClick={() => setTab('homes')}
          className={`flex flex-col items-center gap-0.5 py-1 ${
            tab === 'homes' || tab === 'pantry' ? 'text-sky-400 font-semibold' : 'text-slate-400'
          }`}
        >
          <Sparkles className="h-4 w-4" />
          Life
        </button>
      </div>
    </div>
  );
};
