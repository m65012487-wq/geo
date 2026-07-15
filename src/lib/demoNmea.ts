/**
 * Демо-RTK-приёмник: генерирует поток NMEA (GGA + GST) по сценарию
 * Single → Float → Fixed с сантиметровыми точностями на этапе Fixed.
 *
 * Строки собираются с корректной контрольной суммой и предназначены для
 * прогона через боевой парсер (nmea.ts) — так интерфейс подключения GNSS
 * дорабатывается без реального железа, а замена на Bluetooth (Фаза 4) не
 * затронет остальной код.
 */

import { nmeaSentence } from './nmea';

export interface DemoConfig {
  /** Опорная позиция, вокруг которой «дрожит» решение. */
  lat: number;
  lon: number;
  alt: number;
}

interface Stage {
  fixCode: number; // код качества GGA
  acc: number; // горизонтальная СКО, м
}

/** Сценарий сходимости: первые эпохи — Single, затем Float, затем Fixed. */
const STAGES: { until: number; stage: Stage }[] = [
  { until: 5, stage: { fixCode: 1, acc: 2.5 } }, // Autonomous
  { until: 10, stage: { fixCode: 5, acc: 0.4 } }, // RTK Float
  { until: Infinity, stage: { fixCode: 4, acc: 0.015 } }, // RTK Fixed (см)
];

/** Этап сценария для данного номера эпохи. */
export function demoStage(step: number): Stage {
  for (const s of STAGES) if (step < s.until) return s.stage;
  return STAGES[STAGES.length - 1].stage;
}

/** Детерминированный псевдослучайный шум в диапазоне [-1, 1] по (step, salt). */
function jitter(step: number, salt: number): number {
  const x = Math.sin(step * 12.9898 + salt * 78.233) * 43758.5453;
  return 2 * (x - Math.floor(x)) - 1;
}

function fmtTime(step: number): string {
  const total = step % 86400;
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  return (
    String(hh).padStart(2, '0') +
    String(mm).padStart(2, '0') +
    String(ss).padStart(2, '0') +
    '.00'
  );
}

/** Десятичные градусы → «ddmm.mmmmm» + полушарие. */
function fmtLat(dec: number): [string, 'N' | 'S'] {
  const hemi = dec >= 0 ? 'N' : 'S';
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return [String(d).padStart(2, '0') + m.toFixed(5).padStart(8, '0'), hemi];
}
function fmtLon(dec: number): [string, 'E' | 'W'] {
  const hemi = dec >= 0 ? 'E' : 'W';
  const a = Math.abs(dec);
  const d = Math.floor(a);
  const m = (a - d) * 60;
  return [String(d).padStart(3, '0') + m.toFixed(5).padStart(8, '0'), hemi];
}

export interface DemoTick {
  sentences: string[];
  fixCode: number;
  lat: number;
  lon: number;
}

/**
 * Формирует пару предложений (GGA + GST) для данной эпохи. Позиция смещена от
 * опорной на шум масштаба текущей точности; чем лучше решение — тем меньше шум.
 */
export function demoTick(step: number, cfg: DemoConfig): DemoTick {
  const { fixCode, acc } = demoStage(step);
  // Метры → градусы: ~1/111320 по широте.
  const dLat = (acc * jitter(step, 1)) / 111320;
  const dLon = (acc * jitter(step, 2)) / (111320 * Math.cos(cfg.lat * Math.PI / 180));
  const lat = cfg.lat + dLat;
  const lon = cfg.lon + dLon;
  const alt = cfg.alt + acc * jitter(step, 3);

  const time = fmtTime(step);
  const [latV, latH] = fmtLat(lat);
  const [lonV, lonH] = fmtLon(lon);
  const sats = fixCode === 4 ? 18 : fixCode === 5 ? 14 : 9;
  const hdop = (acc / 2.5).toFixed(1);

  const gga = nmeaSentence(
    `GPGGA,${time},${latV},${latH},${lonV},${lonH},${fixCode},${sats},${hdop},${alt.toFixed(2)},M,13.2,M,,`
  );
  const sd = (acc / Math.SQRT2).toFixed(3);
  const gst = nmeaSentence(
    `GPGST,${time},${acc.toFixed(3)},${acc.toFixed(3)},${(acc * 0.8).toFixed(3)},0.0,${sd},${sd},${(acc * 1.5).toFixed(3)}`
  );

  return { sentences: [gga, gst], fixCode, lat, lon };
}

/** Источник демо-потока: вызывает onSentence для каждой строки раз в интервал. */
export class DemoNmeaSource {
  private timer: ReturnType<typeof setInterval> | null = null;
  private step = 0;
  constructor(private cfg: DemoConfig, private intervalMs = 1000) {}

  start(onSentence: (s: string) => void): void {
    this.stop();
    this.timer = setInterval(() => {
      for (const s of demoTick(this.step, this.cfg).sentences) onSentence(s);
      this.step++;
    }, this.intervalMs);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  reset(): void {
    this.step = 0;
  }
}
