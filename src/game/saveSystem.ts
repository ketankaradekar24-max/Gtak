import {
  BankTransaction,
  DistrictId,
  GameSettings,
  InteriorId,
  MetroTicket,
  PhoneMessage,
  PlayerCustomization,
  SaveSlotSummary,
  VehicleTuning,
} from './types';

export interface SavePayload {
  version: number;
  slot: number;
  savedAt: string;
  protagonistName: string;
  districtName: string;
  playerX: number;
  playerY: number;
  playerZ: number;
  playerHeading: number;
  health: number;
  maxHealth: number;
  armor: number;
  cash: number;
  bankBalance: number;
  ammo: number;
  timeOfDayHours: number;
  customization: PlayerCustomization;
  vehicleTuning: VehicleTuning;
  settings: GameSettings;
  discoveredDistricts: DistrictId[];
  completedMissions: string[];
  collectedIds: string[];
  ownedProperties: InteriorId[];
  pantryItems: Record<string, number>;
  metroTickets: MetroTicket[];
  transactions: BankTransaction[];
  messages: PhoneMessage[];
}

const SLOT_PREFIX = 'namma_bengaluru_save_slot_';

export function getIndiaStandardTime(): {
  hoursDecimal: number;
  clockLabel: string;
  dateLabel: string;
  weekdayLabel: string;
  timezoneLabel: string;
  dayOfYear: number;
} {
  try {
    const now = new Date();
    const timeParts = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const h = Number(timeParts.find((p) => p.type === 'hour')?.value ?? '10') % 24;
    const m = Number(timeParts.find((p) => p.type === 'minute')?.value ?? '0');
    const s = Number(timeParts.find((p) => p.type === 'second')?.value ?? '0');
    const ms = now.getMilliseconds();

    const dateLabel = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(now);

    const weekdayLabel = new Intl.DateTimeFormat('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'long',
    }).format(now);

    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.max(
      1,
      Math.min(366, Math.floor((now.getTime() - startOfYear.getTime()) / 86400000))
    );

    return {
      hoursDecimal: h + m / 60 + (s + ms / 1000) / 3600,
      clockLabel: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} IST`,
      dateLabel,
      weekdayLabel,
      timezoneLabel: 'Asia/Kolkata (IST)',
      dayOfYear,
    };
  } catch {
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return {
      hoursDecimal: d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600,
      clockLabel: d.toTimeString().slice(0, 8) + ' IST',
      dateLabel: d.toDateString(),
      weekdayLabel: days[d.getDay()],
      timezoneLabel: 'Asia/Kolkata (IST)',
      dayOfYear: 120,
    };
  }
}

/**
 * Calculates accurate solar elevation, sunrise, and sunset for Bengaluru (12.9716°N, 77.5946°E)
 * from local solar time in IST (UTC+5:30).
 */
export function getBengaluruSolarTimes(
  hoursDecimal: number,
  dayOfYear = 120
): { sunrise: string; sunset: string; elevationDeg: number } {
  const latRad = (12.9716 * Math.PI) / 180;
  // Equation of time & declination approximation
  const declRad = (23.44 * Math.PI) / 180 * Math.sin(((2 * Math.PI) / 365) * (dayOfYear - 81));
  const cosHa0 = Math.max(-0.99, Math.min(0.99, -Math.tan(latRad) * Math.tan(declRad)));
  const halfDayHours = (Math.acos(cosHa0) * 180) / Math.PI / 15;
  // Bengaluru longitude correction vs IST 82.5°E meridian: (82.5 - 77.5946) * 4 min = +19.62 min = +0.327 hr
  const solarNoonIst = 12.327;
  const sunriseH = solarNoonIst - halfDayHours;
  const sunsetH = solarNoonIst + halfDayHours;

  const hourAngleRad = ((hoursDecimal - solarNoonIst) * 15 * Math.PI) / 180;
  const sinElev =
    Math.sin(latRad) * Math.sin(declRad) +
    Math.cos(latRad) * Math.cos(declRad) * Math.cos(hourAngleRad);
  const elevationDeg = (Math.asin(Math.max(-1, Math.min(1, sinElev))) * 180) / Math.PI;

  const fmt = (hr: number) => {
    const h = Math.floor(hr) % 24;
    const m = Math.floor((hr % 1) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  };

  return {
    sunrise: fmt(sunriseH),
    sunset: fmt(sunsetH),
    elevationDeg: Math.round(elevationDeg * 10) / 10,
  };
}

export function saveGameToSlot(slot: number, payload: SavePayload): boolean {
  try {
    localStorage.setItem(`${SLOT_PREFIX}${slot}`, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function loadGameFromSlot(slot: number): SavePayload | null {
  try {
    const raw = localStorage.getItem(`${SLOT_PREFIX}${slot}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SavePayload;
    if (!parsed || typeof parsed.playerX !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function listSaveSlots(): Array<SaveSlotSummary | null> {
  return [1, 2, 3].map((slot) => {
    const data = loadGameFromSlot(slot);
    if (!data) return null;
    return {
      slot,
      savedAt: data.savedAt,
      protagonistName: data.protagonistName,
      districtName: data.districtName,
      cash: data.cash,
      completedMissions: data.completedMissions.length,
      ownedProperties: data.ownedProperties.length,
    };
  });
}

export function deleteSaveSlot(slot: number): void {
  try {
    localStorage.removeItem(`${SLOT_PREFIX}${slot}`);
  } catch {
    // ignore storage errors
  }
}
