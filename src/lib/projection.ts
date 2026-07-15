/**
 * Картографические проекции и датум-трансформации.
 *
 * Реализация:
 *  - Поперечная Меркатора через серии Крюгера 3-го порядка (по алгоритму
 *    Karney / Krüger) — round-trip суб-мм. Используется и для UTM (WGS84),
 *    и для Гаусса-Крюгера (Красовский / СК-42).
 *  - 7-параметрический Гельмерт (Бурса-Вольф) WGS84 ↔ СК-42 — обобщённые
 *    параметры, точность ~1–2 м (точные региональные МСК — позже через
 *    калибровку участка).
 *
 * Все углы на входе/выходе — в градусах, координаты — в метрах.
 */

export interface Ellipsoid {
  /** Большая полуось, м. */
  a: number;
  /** Сжатие. */
  f: number;
}

/** WGS84 (GPS, UTM). */
export const WGS84: Ellipsoid = { a: 6378137.0, f: 1 / 298.257223563 };
/** Красовский 1940 (СК-42, Гаусса-Крюгера). */
export const KRASOVSKY: Ellipsoid = { a: 6378245.0, f: 1 / 298.3 };

export interface LatLon {
  lat: number;
  lon: number;
}
export interface NE {
  /** Northing (X в геодезии РФ), м. */
  n: number;
  /** Easting (Y в геодезии РФ), м. */
  e: number;
}

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

// ---------------------------------------------------------------------------
// Геоцентрические (ECEF) ↔ геодезические координаты
// ---------------------------------------------------------------------------

/** Геодезические (φ,λ,h) → геоцентрические X,Y,Z на данном эллипсоиде. */
export function geodeticToEcef(
  latDeg: number,
  lonDeg: number,
  h: number,
  ell: Ellipsoid
): [number, number, number] {
  const e2 = ell.f * (2 - ell.f);
  const lat = latDeg * D2R;
  const lon = lonDeg * D2R;
  const sinLat = Math.sin(lat);
  const N = ell.a / Math.sqrt(1 - e2 * sinLat * sinLat);
  const x = (N + h) * Math.cos(lat) * Math.cos(lon);
  const y = (N + h) * Math.cos(lat) * Math.sin(lon);
  const z = (N * (1 - e2) + h) * sinLat;
  return [x, y, z];
}

/** Геоцентрические X,Y,Z → геодезические (φ,λ,h), итеративно (сходится за <5 шагов). */
export function ecefToGeodetic(
  x: number,
  y: number,
  z: number,
  ell: Ellipsoid
): { lat: number; lon: number; h: number } {
  const e2 = ell.f * (2 - ell.f);
  const lon = Math.atan2(y, x);
  const p = Math.hypot(x, y);
  let lat = Math.atan2(z, p * (1 - e2));
  let N = ell.a;
  let h = 0;
  for (let i = 0; i < 8; i++) {
    const sinLat = Math.sin(lat);
    N = ell.a / Math.sqrt(1 - e2 * sinLat * sinLat);
    h = p / Math.cos(lat) - N;
    lat = Math.atan2(z, p * (1 - (e2 * N) / (N + h)));
  }
  return { lat: lat * R2D, lon: lon * R2D, h };
}

// ---------------------------------------------------------------------------
// 7-параметрический Гельмерт (Бурса-Вольф), position-vector convention
// ---------------------------------------------------------------------------

export interface HelmertParams {
  /** Сдвиги, м. */
  dx: number;
  dy: number;
  dz: number;
  /** Развороты, угловые секунды. */
  rx: number;
  ry: number;
  rz: number;
  /** Масштаб, ppm. */
  s: number;
}

/**
 * Параметры СК-42 → WGS-84 (обобщённые, по ГОСТ Р 51794).
 * Обратное преобразование получается инверсией (см. helmertInverse).
 */
export const SK42_TO_WGS84: HelmertParams = {
  dx: 23.57,
  dy: -140.95,
  dz: -79.8,
  rx: 0.0,
  ry: 0.35,
  rz: 0.79,
  s: -0.22,
};

function applyHelmert(
  [x, y, z]: [number, number, number],
  p: HelmertParams
): [number, number, number] {
  const asRad = Math.PI / (180 * 3600);
  const rx = p.rx * asRad;
  const ry = p.ry * asRad;
  const rz = p.rz * asRad;
  const m = 1 + p.s * 1e-6;
  return [
    p.dx + m * (x - rz * y + ry * z),
    p.dy + m * (rz * x + y - rx * z),
    p.dz + m * (-ry * x + rx * y + z),
  ];
}

/** Инвертирует набор параметров (для обратного датум-сдвига). */
export function helmertInverse(p: HelmertParams): HelmertParams {
  return { dx: -p.dx, dy: -p.dy, dz: -p.dz, rx: -p.rx, ry: -p.ry, rz: -p.rz, s: -p.s };
}

/** СК-42 (φ,λ) → WGS-84 (φ,λ). Высота считается 0, если не задана. */
export function sk42ToWgs84(latDeg: number, lonDeg: number, h = 0): LatLon {
  const ecef = geodeticToEcef(latDeg, lonDeg, h, KRASOVSKY);
  const shifted = applyHelmert(ecef, SK42_TO_WGS84);
  const g = ecefToGeodetic(shifted[0], shifted[1], shifted[2], WGS84);
  return { lat: g.lat, lon: g.lon };
}

/** WGS-84 (φ,λ) → СК-42 (φ,λ). */
export function wgs84ToSk42(latDeg: number, lonDeg: number, h = 0): LatLon {
  const ecef = geodeticToEcef(latDeg, lonDeg, h, WGS84);
  const shifted = applyHelmert(ecef, helmertInverse(SK42_TO_WGS84));
  const g = ecefToGeodetic(shifted[0], shifted[1], shifted[2], KRASOVSKY);
  return { lat: g.lat, lon: g.lon };
}

// ---------------------------------------------------------------------------
// Поперечная Меркатора — серии Крюгера 3-го порядка
// ---------------------------------------------------------------------------

export interface TMParams {
  /** Осевой меридиан, градусы. */
  lon0: number;
  /** Масштаб на осевом меридиане. */
  k0: number;
  /** Ложный сдвиг на восток (Easting), м. */
  falseEasting: number;
  /** Ложный сдвиг на север (Northing), м. */
  falseNorthing: number;
}

/** Предвычисленные коэффициенты серий Крюгера для эллипсоида. */
function krugerCoefs(ell: Ellipsoid) {
  const n = ell.f / (2 - ell.f);
  const n2 = n * n;
  const n3 = n2 * n;
  const n4 = n3 * n;
  // Радиус спрямляющей сферы, умноженный на a.
  const A = (ell.a / (1 + n)) * (1 + n2 / 4 + n4 / 64);
  // Прямые коэффициенты (φ,λ → x,y).
  const alpha = [
    n / 2 - (2 * n2) / 3 + (5 * n3) / 16,
    (13 * n2) / 48 - (3 * n3) / 5,
    (61 * n3) / 240,
  ];
  // Обратные коэффициенты (x,y → φ,λ).
  const beta = [
    n / 2 - (2 * n2) / 3 + (37 * n3) / 96,
    n2 / 48 + n3 / 15,
    (17 * n3) / 480,
  ];
  // Восстановление широты из спрямляющей.
  const delta = [
    2 * n - (2 * n2) / 3 - 2 * n3,
    (7 * n2) / 3 - (8 * n3) / 5,
    (56 * n3) / 15,
  ];
  return { n, A, alpha, beta, delta };
}

/** Геодезические (φ,λ) → плоские (N,E) поперечной Меркатора. */
export function tmForward(latDeg: number, lonDeg: number, ell: Ellipsoid, p: TMParams): NE {
  const { n, A, alpha } = krugerCoefs(ell);
  const lat = latDeg * D2R;
  const dLon = (lonDeg - p.lon0) * D2R;

  const twoSqrtN = (2 * Math.sqrt(n)) / (1 + n);
  const t = Math.sinh(Math.atanh(Math.sin(lat)) - twoSqrtN * Math.atanh(twoSqrtN * Math.sin(lat)));

  const xiPrime = Math.atan2(t, Math.cos(dLon));
  const etaPrime = Math.asinh(Math.sin(dLon) / Math.hypot(t, Math.cos(dLon)));

  let xi = xiPrime;
  let eta = etaPrime;
  for (let j = 1; j <= 3; j++) {
    xi += alpha[j - 1] * Math.sin(2 * j * xiPrime) * Math.cosh(2 * j * etaPrime);
    eta += alpha[j - 1] * Math.cos(2 * j * xiPrime) * Math.sinh(2 * j * etaPrime);
  }

  return {
    e: p.falseEasting + p.k0 * A * eta,
    n: p.falseNorthing + p.k0 * A * xi,
  };
}

/** Плоские (N,E) поперечной Меркатора → геодезические (φ,λ). */
export function tmInverse(n_: number, e_: number, ell: Ellipsoid, p: TMParams): LatLon {
  const { A, beta, delta } = krugerCoefs(ell);
  const xi = (n_ - p.falseNorthing) / (p.k0 * A);
  const eta = (e_ - p.falseEasting) / (p.k0 * A);

  let xiPrime = xi;
  let etaPrime = eta;
  for (let j = 1; j <= 3; j++) {
    xiPrime -= beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaPrime -= beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }

  const chi = Math.asin(Math.sin(xiPrime) / Math.cosh(etaPrime));
  let lat = chi;
  for (let j = 1; j <= 3; j++) {
    lat += delta[j - 1] * Math.sin(2 * j * chi);
  }

  const lon = p.lon0 * D2R + Math.atan2(Math.sinh(etaPrime), Math.cos(xiPrime));
  return { lat: lat * R2D, lon: lon * R2D };
}

// ---------------------------------------------------------------------------
// UTM (WGS84)
// ---------------------------------------------------------------------------

/** Номер 6-градусной зоны UTM по долготе. */
export function utmZoneFromLon(lonDeg: number): number {
  return Math.floor((lonDeg + 180) / 6) + 1;
}

/** Осевой меридиан зоны UTM/GK (6-градусные зоны). */
function utmCentralMeridian(zone: number): number {
  return zone * 6 - 183;
}

export function utmForward(latDeg: number, lonDeg: number, zone: number, south: boolean): NE {
  return tmForward(latDeg, lonDeg, WGS84, {
    lon0: utmCentralMeridian(zone),
    k0: 0.9996,
    falseEasting: 500000,
    falseNorthing: south ? 10000000 : 0,
  });
}

export function utmInverse(n_: number, e_: number, zone: number, south: boolean): LatLon {
  return tmInverse(n_, e_, WGS84, {
    lon0: utmCentralMeridian(zone),
    k0: 0.9996,
    falseEasting: 500000,
    falseNorthing: south ? 10000000 : 0,
  });
}

// ---------------------------------------------------------------------------
// Гаусса-Крюгера (Красовский / СК-42)
// ---------------------------------------------------------------------------

/** Осевой меридиан 6-градусной зоны Гаусса-Крюгера. */
export function gkCentralMeridian(zone: number): number {
  return zone * 6 - 3;
}

/** Номер зоны Гаусса-Крюгера по долготе. */
export function gkZoneFromLon(lonDeg: number): number {
  return Math.floor(lonDeg / 6) + 1;
}

/**
 * Гаусса-Крюгера, вход — координаты СК-42 (φ,λ). Ложный восток = 500000,
 * с префиксом номера зоны (стандарт РФ), если zonePrefix=true.
 */
export function gkForward(latDeg: number, lonDeg: number, zone: number, zonePrefix = true): NE {
  const ne = tmForward(latDeg, lonDeg, KRASOVSKY, {
    lon0: gkCentralMeridian(zone),
    k0: 1.0,
    falseEasting: 500000,
    falseNorthing: 0,
  });
  if (zonePrefix) ne.e += zone * 1_000_000;
  return ne;
}

export function gkInverse(n_: number, e_: number, zone: number, zonePrefix = true): LatLon {
  const e = zonePrefix ? e_ - zone * 1_000_000 : e_;
  return tmInverse(n_, e, KRASOVSKY, {
    lon0: gkCentralMeridian(zone),
    k0: 1.0,
    falseEasting: 500000,
    falseNorthing: 0,
  });
}
