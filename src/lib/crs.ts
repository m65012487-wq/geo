/**
 * Системы координат проекта.
 *
 * Коды (хранятся в поле projects.crs):
 *   wgs84       — географические широта/долгота (плоских N/E нет)
 *   utm:37N     — UTM, зона 37, северное полушарие (WGS84)
 *   gk:7        — Гаусса-Крюгера, зона 7 (Красовский / СК-42)
 *
 * GPS выдаёт координаты в WGS84. Для UTM проекция прямая; для Гаусса-Крюгера
 * сначала выполняется датум-сдвиг WGS84 → СК-42, затем проекция.
 */

import {
  type NE,
  type LatLon,
  utmForward,
  utmInverse,
  utmZoneFromLon,
  gkForward,
  gkInverse,
  gkZoneFromLon,
  wgs84ToSk42,
  sk42ToWgs84,
} from './projection';

export type CrsSpec =
  | { kind: 'wgs84' }
  | { kind: 'utm'; zone: number; south: boolean }
  | { kind: 'gk'; zone: number };

/** Разбирает код СК. Неизвестный/пустой код → WGS84. */
export function parseCrs(code: string | null | undefined): CrsSpec {
  const c = (code ?? '').trim().toLowerCase();
  if (c.startsWith('utm:')) {
    const m = /^utm:(\d{1,2})([ns])?$/.exec(c);
    if (m) {
      const zone = parseInt(m[1], 10);
      if (zone >= 1 && zone <= 60) return { kind: 'utm', zone, south: m[2] === 's' };
    }
  }
  if (c.startsWith('gk:')) {
    const m = /^gk:(\d{1,2})$/.exec(c);
    if (m) {
      const zone = parseInt(m[1], 10);
      if (zone >= 1 && zone <= 60) return { kind: 'gk', zone };
    }
  }
  return { kind: 'wgs84' };
}

/** Каноничный код СК. */
export function formatCrs(spec: CrsSpec): string {
  switch (spec.kind) {
    case 'utm':
      return `utm:${spec.zone}${spec.south ? 'S' : 'N'}`;
    case 'gk':
      return `gk:${spec.zone}`;
    default:
      return 'wgs84';
  }
}

/** Человекочитаемое название СК. */
export function crsLabel(spec: CrsSpec): string {
  switch (spec.kind) {
    case 'utm':
      return `UTM зона ${spec.zone}${spec.south ? 'S' : 'N'} (WGS84)`;
    case 'gk':
      return `Гаусса-Крюгера зона ${spec.zone} (СК-42)`;
    default:
      return 'WGS84 (широта/долгота)';
  }
}

/** Короткая метка для колонок таблиц/экспорта. */
export function crsShort(spec: CrsSpec): string {
  switch (spec.kind) {
    case 'utm':
      return `UTM ${spec.zone}${spec.south ? 'S' : 'N'}`;
    case 'gk':
      return `ГК ${spec.zone}`;
    default:
      return 'WGS84';
  }
}

/** Есть ли у СК плоские координаты N/E. */
export function hasPlane(spec: CrsSpec): boolean {
  return spec.kind !== 'wgs84';
}

/**
 * Проекция координат WGS84 (φ,λ от GPS) в плоские N/E данной СК.
 * Для WGS84 возвращает null (плоскость не определена).
 */
export function projectPoint(spec: CrsSpec, latWgs: number, lonWgs: number): NE | null {
  switch (spec.kind) {
    case 'utm':
      return utmForward(latWgs, lonWgs, spec.zone, spec.south);
    case 'gk': {
      const sk = wgs84ToSk42(latWgs, lonWgs);
      return gkForward(sk.lat, sk.lon, spec.zone, true);
    }
    default:
      return null;
  }
}

/** Обратно: плоские N/E данной СК → WGS84 (φ,λ). */
export function unprojectPoint(spec: CrsSpec, n: number, e: number): LatLon | null {
  switch (spec.kind) {
    case 'utm':
      return utmInverse(n, e, spec.zone, spec.south);
    case 'gk': {
      const sk = gkInverse(n, e, spec.zone, true);
      return sk42ToWgs84(sk.lat, sk.lon);
    }
    default:
      return null;
  }
}

/** Рекомендуемая зона по долготе WGS84 для выбранного типа СК. */
export function suggestZone(kind: 'utm' | 'gk', lonWgs: number): number {
  return kind === 'utm' ? utmZoneFromLon(lonWgs) : gkZoneFromLon(lonWgs);
}
