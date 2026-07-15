/**
 * Парсер NMEA 0183 для GNSS-приёмников.
 *
 * Поддержаны предложения GGA (позиция/качество/высота), RMC (позиция/скорость/
 * дата) и GST (СКО координат — статистика точности RTK). Проверяется
 * контрольная сумма; любой талкер (GP/GN/GL/GA…) распознаётся.
 *
 * Качество решения из GGA:
 *   0 → none · 1,2 → single (Autonomous/DGPS) · 4 → fix (RTK Fixed) · 5 → float
 */

import type { FixQuality } from '../db/types';

export type NmeaType = 'GGA' | 'RMC' | 'GST';

export interface GgaData {
  type: 'GGA';
  time: string | null;
  latitude: number | null;
  longitude: number | null;
  quality: FixQuality;
  fixCode: number;
  satellites: number | null;
  hdop: number | null;
  altitude: number | null;
  geoidSeparation: number | null;
}

export interface RmcData {
  type: 'RMC';
  time: string | null;
  valid: boolean;
  latitude: number | null;
  longitude: number | null;
  speedKnots: number | null;
  courseDeg: number | null;
  date: string | null;
}

export interface GstData {
  type: 'GST';
  time: string | null;
  rms: number | null;
  /** СКО по широте (север), м. */
  sdLat: number | null;
  /** СКО по долготе (восток), м. */
  sdLon: number | null;
  /** СКО по высоте, м. */
  sdAlt: number | null;
}

export type NmeaData = GgaData | RmcData | GstData;

/** XOR-контрольная сумма тела предложения (без «$» и «*»), два hex-символа. */
export function nmeaChecksum(body: string): string {
  let cs = 0;
  for (let i = 0; i < body.length; i++) cs ^= body.charCodeAt(i);
  return cs.toString(16).toUpperCase().padStart(2, '0');
}

/** Собирает валидное предложение: «$» + тело + «*» + контрольная сумма. */
export function nmeaSentence(body: string): string {
  return `$${body}*${nmeaChecksum(body)}`;
}

/** XOR-контрольная сумма между «$» и «*» совпадает с указанной в строке. */
export function nmeaChecksumValid(sentence: string): boolean {
  const s = sentence.trim();
  const star = s.lastIndexOf('*');
  if (!s.startsWith('$') || star < 0 || star + 3 > s.length) return false;
  let cs = 0;
  for (let i = 1; i < star; i++) cs ^= s.charCodeAt(i);
  const given = s.slice(star + 1, star + 3).toUpperCase();
  return cs.toString(16).toUpperCase().padStart(2, '0') === given;
}

/** ddmm.mmmm + полушарие → десятичные градусы (или null). */
function parseCoord(value: string, hemi: string, degDigits: 2 | 3): number | null {
  if (!value || !hemi) return null;
  const deg = parseInt(value.slice(0, degDigits), 10);
  const min = parseFloat(value.slice(degDigits));
  if (Number.isNaN(deg) || Number.isNaN(min)) return null;
  let dec = deg + min / 60;
  if (hemi === 'S' || hemi === 'W') dec = -dec;
  return dec;
}

const num = (s: string): number | null => {
  if (s === undefined || s === '') return null;
  const v = parseFloat(s);
  return Number.isNaN(v) ? null : v;
};

const int = (s: string): number | null => {
  if (s === undefined || s === '') return null;
  const v = parseInt(s, 10);
  return Number.isNaN(v) ? null : v;
};

/** Код качества GGA → класс решения приложения. */
export function fixCodeToQuality(code: number): FixQuality {
  switch (code) {
    case 4:
      return 'fix';
    case 5:
      return 'float';
    case 1:
    case 2:
      return 'single';
    default:
      return 'none';
  }
}

/** Возвращает тип предложения (GGA/RMC/GST) без учёта талкера, либо null. */
function sentenceType(fields: string[]): NmeaType | null {
  const head = fields[0]?.slice(-3);
  if (head === 'GGA' || head === 'RMC' || head === 'GST') return head;
  return null;
}

/**
 * Разбирает одно предложение NMEA. Возвращает null, если контрольная сумма
 * не сходится или тип предложения не поддержан.
 */
export function parseNmea(sentence: string): NmeaData | null {
  if (!nmeaChecksumValid(sentence)) return null;
  const body = sentence.trim().slice(1, sentence.trim().lastIndexOf('*'));
  const f = body.split(',');
  const type = sentenceType(f);
  if (!type) return null;

  if (type === 'GGA') {
    const fixCode = int(f[6]) ?? 0;
    return {
      type: 'GGA',
      time: f[1] || null,
      latitude: parseCoord(f[2], f[3], 2),
      longitude: parseCoord(f[4], f[5], 3),
      quality: fixCodeToQuality(fixCode),
      fixCode,
      satellites: int(f[7]),
      hdop: num(f[8]),
      altitude: num(f[9]),
      geoidSeparation: num(f[11]),
    };
  }

  if (type === 'RMC') {
    return {
      type: 'RMC',
      time: f[1] || null,
      valid: f[2] === 'A',
      latitude: parseCoord(f[3], f[4], 2),
      longitude: parseCoord(f[5], f[6], 3),
      speedKnots: num(f[7]),
      courseDeg: num(f[8]),
      date: f[9] || null,
    };
  }

  // GST
  return {
    type: 'GST',
    time: f[1] || null,
    rms: num(f[2]),
    sdLat: num(f[6]),
    sdLon: num(f[7]),
    sdAlt: num(f[8]),
  };
}

/** Горизонтальная СКО (радиальная) из GST: √(sdLat² + sdLon²). */
export function gstHorizontalSd(g: GstData): number | null {
  if (g.sdLat == null || g.sdLon == null) return null;
  return Math.hypot(g.sdLat, g.sdLon);
}
