import React, { useMemo, useState } from 'react';
import {
  CreditCard,
  Gavel,
  Minus,
  Plus,
  QrCode,
  Shield,
  ShoppingCart,
  TrainFront,
  Tv,
  Utensils,
  X,
} from 'lucide-react';
import {
  GROCERY_ITEMS,
  METRO_STATIONS,
  TV_CHANNELS,
  WEAPONS_CATALOG,
  computeBmrclMetroFare,
} from '../game/bengaluruData';
import { HudSnapshot, WeaponKind } from '../game/types';

interface InteriorUiModalProps {
  hud: HudSnapshot;
  onClose: () => void;
  onSetTvState: (on: boolean, channel: number) => void;
  onAddToBasket: (itemId: string, delta: number) => void;
  onCheckoutBasket: () => void;
  onEatFromPantry: (itemId: string) => void;
  onBuyWeapon: (weaponId: WeaponKind) => void;
  onBuyMetroTicket: (fromId: string, toId: string) => void;
  onBuySmartCard: () => void;
  onTopUpSmartCard: (amount: number) => void;
  onPayJailBail: () => void;
  onServeJailTime: () => void;
}

export const InteriorUiModal: React.FC<InteriorUiModalProps> = ({
  hud,
  onClose,
  onSetTvState,
  onAddToBasket,
  onCheckoutBasket,
  onEatFromPantry,
  onBuyWeapon,
  onBuyMetroTicket,
  onBuySmartCard,
  onTopUpSmartCard,
  onPayJailBail,
  onServeJailTime,
}) => {
  const [groceryCat, setGroceryCat] = useState<string>('All');
  const [tvmOriginOverride, setTvmOriginOverride] = useState<string | null>(null);
  const [tvmDestOverride, setTvmDestOverride] = useState<string | null>(null);
  const action = hud.interiorAction;

  const operationalStations = useMemo(
    () => METRO_STATIONS.filter((s) => s.status === 'operational'),
    []
  );
  const defaultTvmOriginId =
    operationalStations.find((s) => s.id === hud.metroJourney.stationId)?.id ||
    operationalStations.find((s) => s.id === 'mp_mg_road')?.id ||
    operationalStations[0]?.id ||
    'mp_mg_road';
  const tvmFromId = tvmOriginOverride || defaultTvmOriginId;
  const tvmToId =
    tvmDestOverride && tvmDestOverride !== tvmFromId
      ? tvmDestOverride
      : operationalStations.find((s) => s.id !== tvmFromId)?.id || tvmFromId;
  const tvmStopsEst = useMemo(() => {
    const a = operationalStations.find((s) => s.id === tvmFromId);
    const b = operationalStations.find((s) => s.id === tvmToId);
    if (!a || !b) return 1;
    if (a.line === b.line) return Math.max(1, Math.abs(a.order - b.order));
    return Math.max(2, Math.round(Math.hypot(a.x - b.x, a.z - b.z) / 140));
  }, [operationalStations, tvmFromId, tvmToId]);
  const tvmEstimatedFare = computeBmrclMetroFare(tvmStopsEst, false);

  const basketSummary = useMemo(() => {
    let count = 0;
    let total = 0;
    for (const [id, qty] of Object.entries(hud.groceryBasket)) {
      const g = GROCERY_ITEMS.find((x) => x.id === id);
      if (g && qty > 0) {
        count += qty;
        total += g.price * qty;
      }
    }
    return { count, total };
  }, [hud.groceryBasket]);

  if (!action) return null;

  const categories = ['All', 'Dairy', 'Bakery', 'Grains', 'Produce', 'Snacks', 'Beverages', 'Household'];
  const filteredGroceries =
    groceryCat === 'All'
      ? GROCERY_ITEMS
      : GROCERY_ITEMS.filter((g) => g.category === groceryCat);

  const activeChannel =
    TV_CHANNELS.find((c) => c.channel === hud.tvState.channel) || TV_CHANNELS[0];

  const pantryEntries = Object.entries(hud.pantryItems)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ qty, def: GROCERY_ITEMS.find((g) => g.id === id) }))
    .filter((x): x is { qty: number; def: NonNullable<typeof x.def> } => Boolean(x.def));

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-slate-950/85 p-4">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3.5">
          <div className="flex items-center gap-2">
            {action === 'tv' && <Tv className="h-5 w-5 text-sky-400" />}
            {action === 'mart' && <ShoppingCart className="h-5 w-5 text-emerald-400" />}
            {action === 'armory' && <Shield className="h-5 w-5 text-amber-400" />}
            {action === 'pantry' && <Utensils className="h-5 w-5 text-orange-400" />}
            {action === 'tvm' && <QrCode className="h-5 w-5 text-purple-400" />}
            {action === 'smart_card' && <CreditCard className="h-5 w-5 text-emerald-400" />}
            {action === 'jail_booking' && <Gavel className="h-5 w-5 text-red-400" />}
            <h2 className="font-display text-lg font-bold text-white">
              {action === 'tv'
                ? 'Smart TV Remote (Simulated Broadcast)'
                : action === 'mart'
                ? 'Namma Mart Supermarket Checkout'
                : action === 'armory'
                ? 'Deccan Tactical Armory'
                : action === 'tvm'
                ? 'Namma Metro Ticket Vending Machine (TVM)'
                : action === 'smart_card'
                ? 'BMRCL Namma Metro Smart Card Counter'
                : action === 'jail_booking'
                ? hud.arrestStationName || 'Bengaluru City Police Booking Counter'
                : 'Home Kitchen & Pantry'}
            </h2>
          </div>
          {action !== 'jail_booking' && (
            <button
              type="button"
              onClick={onClose}
              className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-200 hover:bg-slate-800"
            >
              <X className="h-4 w-4" /> Close
            </button>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 text-xs text-slate-200">
          {action === 'tv' && (
            <div className="space-y-4">
              <div
                className="rounded-xl border border-slate-700 bg-slate-950 p-4"
                style={{ borderColor: hud.tvState.on ? activeChannel.color : '#334155' }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-display text-base font-bold text-white">
                    {hud.tvState.on ? `CH ${activeChannel.channel}: ${activeChannel.name}` : 'TV POWER OFF'}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetTvState(!hud.tvState.on, hud.tvState.channel)}
                    className={`rounded-md px-3 py-1.5 text-xs font-bold ${
                      hud.tvState.on
                        ? 'bg-red-500 text-white'
                        : 'bg-emerald-500 text-slate-950'
                    }`}
                  >
                    {hud.tvState.on ? 'Power OFF' : 'Power ON'}
                  </button>
                </div>
                {hud.tvState.on && (
                  <>
                    <div className="mt-1 text-amber-400">{activeChannel.kannadaName}</div>
                    <div className="mt-2 text-sm font-medium text-slate-100">{activeChannel.program}</div>
                    <div className="mt-2 rounded bg-slate-900 px-3 py-2 text-[11px] text-slate-300">
                      {activeChannel.ticker}
                    </div>
                  </>
                )}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {TV_CHANNELS.map((ch) => (
                  <button
                    key={ch.channel}
                    type="button"
                    onClick={() => onSetTvState(true, ch.channel)}
                    className={`rounded-lg border p-3 text-left transition-colors ${
                      hud.tvState.on && hud.tvState.channel === ch.channel
                        ? 'border-sky-400 bg-sky-500/15'
                        : 'border-slate-800 bg-slate-950 hover:border-slate-600'
                    }`}
                  >
                    <div className="font-semibold text-white">
                      CH {ch.channel} · {ch.name}
                    </div>
                    <div className="text-[11px] text-amber-400">{ch.kannadaName}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {action === 'mart' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2.5">
                <div>
                  <span className="text-slate-400">Cash: </span>
                  <span className="font-mono-hud font-bold text-emerald-400">
                    ₹{hud.cash.toLocaleString('en-IN')}
                  </span>
                  <span className="mx-2 text-slate-600">|</span>
                  <span className="text-slate-400">Bank UPI: </span>
                  <span className="font-mono-hud font-bold text-sky-400">
                    ₹{hud.bankBalance.toLocaleString('en-IN')}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono-hud font-semibold text-amber-400">
                    Basket: {basketSummary.count} items (₹{basketSummary.total})
                  </span>
                  <button
                    type="button"
                    disabled={basketSummary.count === 0}
                    onClick={onCheckoutBasket}
                    className="rounded-md bg-emerald-500 px-3.5 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                  >
                    Pay &amp; Checkout
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {categories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setGroceryCat(c)}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${
                      groceryCat === c
                        ? 'bg-amber-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {filteredGroceries.map((item) => {
                  const qty = hud.groceryBasket[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate font-semibold text-white">{item.name}</div>
                        <div className="text-[11px] text-amber-400">{item.kannadaName}</div>
                        <div className="mt-0.5 text-[10px] text-slate-400">
                          ₹{item.price} · Restores +{item.healthRestore} HP
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onAddToBasket(item.id, -1)}
                          className="rounded border border-slate-700 bg-slate-900 p-1 text-slate-200 hover:bg-slate-800"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <span className="w-5 text-center font-mono-hud font-bold text-white">
                          {qty}
                        </span>
                        <button
                          type="button"
                          onClick={() => onAddToBasket(item.id, 1)}
                          className="rounded bg-amber-500 p-1 text-slate-950 hover:bg-amber-400"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {action === 'armory' && (
            <div className="space-y-3">
              <div className="rounded-lg border border-slate-800 bg-slate-950 px-3.5 py-2 text-[11px] text-slate-300">
                Available Funds: ₹{(hud.cash + hud.bankBalance).toLocaleString('en-IN')} · Current Ammo:{' '}
                <span className="font-mono-hud font-bold text-amber-400">{hud.ammo}</span> · Armor:{' '}
                <span className="font-mono-hud font-bold text-sky-400">{hud.armor}%</span>
              </div>
              {WEAPONS_CATALOG.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950 p-3.5"
                >
                  <div>
                    <div className="font-display text-sm font-bold text-white">{w.name}</div>
                    <div className="text-[11px] text-amber-400">{w.kannadaName}</div>
                    <p className="mt-1 text-[11px] text-slate-400">{w.description}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBuyWeapon(w.id)}
                    className="shrink-0 rounded-lg bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 hover:bg-amber-400"
                  >
                    Buy ₹{w.price.toLocaleString('en-IN')}
                  </button>
                </div>
              ))}
            </div>
          )}

          {action === 'pantry' && (
            <div className="space-y-3">
              {pantryEntries.length === 0 ? (
                <p className="rounded-lg border border-slate-800 bg-slate-950 p-4 text-center text-slate-400">
                  Your refrigerator is empty! Visit Namma Mart Supermarket on MG Road to stock up on groceries.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {pantryEntries.map(({ def, qty }) => (
                    <div
                      key={def.id}
                      className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-3"
                    >
                      <div>
                        <div className="font-semibold text-white">
                          {def.name} ×{qty}
                        </div>
                        <div className="text-[11px] text-amber-400">
                          {def.kannadaName} · +{def.healthRestore} HP
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => onEatFromPantry(def.id)}
                        className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                      >
                        Eat / Drink
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {action === 'tvm' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-purple-500/40 bg-slate-950 px-4 py-3">
                <div>
                  <div className="font-display text-sm font-bold text-purple-300">
                    BMRCL Self-Service QR Kiosk
                  </div>
                  <div className="text-[11px] text-slate-400">
                    Select origin &amp; destination to issue an instant QR ticket for the concourse fare gates.
                  </div>
                </div>
                <TrainFront className="h-6 w-6 text-purple-400" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Origin Station</label>
                  <select
                    value={tvmFromId}
                    onChange={(e) => setTvmOriginOverride(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
                  >
                    {operationalStations.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.line.toUpperCase()})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-400">Destination Station</label>
                  <select
                    value={tvmToId}
                    onChange={(e) => setTvmDestOverride(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-purple-400 focus:outline-none"
                  >
                    {operationalStations
                      .filter((s) => s.id !== tvmFromId)
                      .map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.line.toUpperCase()})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-950 p-4">
                <div>
                  <div className="text-[11px] text-slate-400">
                    Estimated Distance: <span className="font-semibold text-white">{tvmStopsEst} stops</span>
                  </div>
                  <div className="mt-0.5 font-mono-hud text-lg font-bold text-emerald-400">
                    QR Ticket Fare: ₹{tvmEstimatedFare}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Cash: ₹{hud.cash.toLocaleString('en-IN')} · Bank: ₹{hud.bankBalance.toLocaleString('en-IN')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onBuyMetroTicket(tvmFromId, tvmToId);
                    onClose();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-purple-500 px-4 py-2.5 text-xs font-bold text-white hover:bg-purple-400"
                >
                  <QrCode className="h-4 w-4" />
                  Issue QR Ticket (₹{tvmEstimatedFare})
                </button>
              </div>
            </div>
          )}

          {action === 'smart_card' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-emerald-500/40 bg-slate-950 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-sm font-bold text-emerald-300">
                      Namma Metro Contactless Smart Card
                    </div>
                    <div className="mt-0.5 text-[11px] text-slate-400">
                      Automatic entry &amp; exit gate tap with 5% BMRCL Smart Card discount on every ride.
                    </div>
                  </div>
                  <span
                    className={`rounded px-2 py-1 text-[11px] font-bold ${
                      hud.metroJourney.smartCardOwned
                        ? 'bg-emerald-500/20 text-emerald-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {hud.metroJourney.smartCardOwned ? 'ACTIVE' : 'NOT ISSUED'}
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-800 pt-3">
                  <div>
                    <div className="text-[11px] text-slate-400">Card Balance</div>
                    <div className="font-mono-hud text-2xl font-extrabold text-white">
                      ₹{hud.metroJourney.smartCardBalance.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right text-[11px] text-slate-400">
                    <div>Cash: ₹{hud.cash.toLocaleString('en-IN')}</div>
                    <div>Bank UPI: ₹{hud.bankBalance.toLocaleString('en-IN')}</div>
                  </div>
                </div>
              </div>

              {!hud.metroJourney.smartCardOwned ? (
                <button
                  type="button"
                  onClick={onBuySmartCard}
                  className="w-full rounded-lg bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400"
                >
                  Issue Namma Metro Smart Card (₹100 — includes ₹100 travel credit)
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300">Instant Top-Up</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[100, 200, 500].map((amt) => (
                      <button
                        key={amt}
                        type="button"
                        onClick={() => onTopUpSmartCard(amt)}
                        className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 py-2.5 font-mono-hud text-xs font-bold text-emerald-300 hover:bg-emerald-500/25"
                      >
                        + ₹{amt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {action === 'jail_booking' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-red-500/50 bg-slate-950 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-display text-base font-bold text-red-400">
                      Booked Into Custody — {hud.arrestStationName || 'Bengaluru Police Station'}
                    </div>
                    <div className="mt-1 text-[11px] text-slate-300">
                      Bengaluru City Police intercepted and escorted you to the station holding counter.
                    </div>
                  </div>
                  <span className="rounded bg-red-500/20 px-2.5 py-1 font-mono-hud text-xs font-bold text-red-300">
                    {hud.wantedStars} ★ Charge
                  </span>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-800 pt-3">
                  <div>
                    <div className="text-[11px] text-slate-400">Station Bail Fee</div>
                    <div className="font-mono-hud text-xl font-extrabold text-amber-400">
                      ₹{hud.jailBailCost.toLocaleString('en-IN')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-slate-400">Your Funds</div>
                    <div className="font-mono-hud text-xs font-semibold text-emerald-400">
                      Cash ₹{hud.cash.toLocaleString('en-IN')} · Bank ₹{hud.bankBalance.toLocaleString('en-IN')}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                <button
                  type="button"
                  disabled={hud.cash + hud.bankBalance < hud.jailBailCost}
                  onClick={onPayJailBail}
                  className="rounded-lg bg-emerald-500 px-4 py-3 text-xs font-bold text-slate-950 hover:bg-emerald-400 disabled:opacity-40"
                >
                  Pay Bail (₹{hud.jailBailCost.toLocaleString('en-IN')}) &amp; Keep Gear
                </button>
                <button
                  type="button"
                  onClick={onServeJailTime}
                  className="rounded-lg border border-amber-500/50 bg-amber-500/15 px-4 py-3 text-xs font-bold text-amber-300 hover:bg-amber-500/25"
                >
                  Serve Sentence (+6h · Clear Wanted &amp; Ammo)
                </button>
              </div>
              <p className="text-[11px] text-slate-400">
                After release, you can explore the Police Station booking hall and walk out the front exit door onto Bengaluru streets.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
