/**
 * COGO-расчёты на плоскости (грид-координаты N/E, метры).
 * Азимуты — от севера (оси N) по часовой стрелке, градусы.
 * Все функции чистые; покрыты юнит-тестами (src/lib/__tests__/cogo.test.ts).
 */

export interface NE {
  n: number;
  e: number;
}

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** ПГЗ (прямая геодезическая задача): точка + азимут + расстояние → новая точка. */
export function forward(p: NE, azimuthDeg: number, distance: number): NE {
  const az = azimuthDeg * D2R;
  return {
    n: p.n + distance * Math.cos(az),
    e: p.e + distance * Math.sin(az),
  };
}

/** ОГЗ (обратная): две точки → расстояние и азимут (0–360). */
export function inverse(a: NE, b: NE): { distance: number; azimuthDeg: number } {
  const dN = b.n - a.n;
  const dE = b.e - a.e;
  const distance = Math.hypot(dN, dE);
  let az = Math.atan2(dE, dN) * R2D;
  if (az < 0) az += 360;
  return { distance, azimuthDeg: az };
}

/** Площадь полигона по формуле Гаусса (shoelace), м². Порядок обхода не важен. */
export function polygonArea(vertices: NE[]): number {
  if (vertices.length < 3) return 0;
  let s = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    s += a.e * b.n - b.e * a.n;
  }
  return Math.abs(s) / 2;
}

/** Периметр полигона (замкнутый контур), м. */
export function polygonPerimeter(vertices: NE[]): number {
  if (vertices.length < 2) return 0;
  let p = 0;
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i];
    const b = vertices[(i + 1) % vertices.length];
    p += Math.hypot(b.n - a.n, b.e - a.e);
  }
  return p;
}

/** Длина полилинии (незамкнутой), м. */
export function polylineLength(vertices: NE[]): number {
  let p = 0;
  for (let i = 1; i < vertices.length; i++) {
    p += Math.hypot(vertices[i].n - vertices[i - 1].n, vertices[i].e - vertices[i - 1].e);
  }
  return p;
}

/** Градусы (десятичные) → ГМС. */
export function degToDms(deg: number): { d: number; m: number; s: number; neg: boolean } {
  const neg = deg < 0;
  let x = Math.abs(deg);
  const d = Math.floor(x);
  x = (x - d) * 60;
  const m = Math.floor(x);
  const s = (x - m) * 60;
  return { d, m, s, neg };
}

/** ГМС → десятичные градусы. */
export function dmsToDeg(d: number, m: number, s: number, neg = false): number {
  const v = Math.abs(d) + m / 60 + s / 3600;
  return neg ? -v : v;
}

/** Форматирует азимут как строку Г°М′С″. */
export function fmtDms(deg: number, secDigits = 1): string {
  const { d, m, s, neg } = degToDms(deg);
  const sign = neg ? '-' : '';
  return `${sign}${d}°${String(m).padStart(2, '0')}′${s.toFixed(secDigits).padStart(4, '0')}″`;
}

/** Среднее и СКО (стандартное отклонение по выборке, n-1). */
export function meanStd(values: number[]): { mean: number; std: number } {
  const n = values.length;
  if (n === 0) return { mean: 0, std: 0 };
  const mean = values.reduce((a, b) => a + b, 0) / n;
  if (n === 1) return { mean, std: 0 };
  const varSum = values.reduce((a, v) => a + (v - mean) ** 2, 0) / (n - 1);
  return { mean, std: Math.sqrt(varSum) };
}

/** Угол в точке B между направлениями B→A и B→C (0–180). */
export function angleAt(a: NE, b: NE, c: NE): number {
  const az1 = inverse(b, a).azimuthDeg;
  const az2 = inverse(b, c).azimuthDeg;
  let diff = Math.abs(az2 - az1);
  if (diff > 180) diff = 360 - diff;
  return diff;
}

// ---------------------------------------------------------------------------
// COGO №2: засечки, проекция на линию, деление, угол поворота
// ---------------------------------------------------------------------------

/**
 * Линейная засечка (пересечение двух окружностей): центры a,b и радиусы ra,rb.
 * Возвращает 0, 1 или 2 решения (оба варианта положения определяемой точки).
 */
export function distanceDistanceIntersection(a: NE, ra: number, b: NE, rb: number): NE[] {
  const dN = b.n - a.n;
  const dE = b.e - a.e;
  const d = Math.hypot(dN, dE);
  if (d === 0) return []; // совпадающие центры
  if (d > ra + rb + 1e-9) return []; // окружности не достают
  if (d < Math.abs(ra - rb) - 1e-9) return []; // одна внутри другой
  const t = (ra * ra - rb * rb + d * d) / (2 * d); // до основания перпендикуляра от a
  const h = Math.sqrt(Math.max(0, ra * ra - t * t));
  const mN = a.n + (t / d) * dN;
  const mE = a.e + (t / d) * dE;
  if (h < 1e-9) return [{ n: mN, e: mE }];
  const oN = -(dE / d) * h;
  const oE = (dN / d) * h;
  return [
    { n: mN + oN, e: mE + oE },
    { n: mN - oN, e: mE - oE },
  ];
}

/**
 * Прямая засечка: пересечение двух направлений из a и b по азимутам (градусы).
 * Возвращает null, если направления параллельны.
 */
export function bearingBearingIntersection(a: NE, azA: number, b: NE, azB: number): NE | null {
  const dA = { n: Math.cos(azA * D2R), e: Math.sin(azA * D2R) };
  const dB = { n: Math.cos(azB * D2R), e: Math.sin(azB * D2R) };
  const cross = dA.e * dB.n - dA.n * dB.e;
  if (Math.abs(cross) < 1e-12) return null;
  const rN = b.n - a.n;
  const rE = b.e - a.e;
  const t = (rE * dB.n - rN * dB.e) / cross;
  return { n: a.n + t * dA.n, e: a.e + t * dA.e };
}

/**
 * Проекция точки p на прямую AB. station — расстояние вдоль AB от A до
 * основания (может быть <0 или >|AB|); offset — знаковое смещение
 * (+ вправо по ходу AB, − влево); foot — точка основания перпендикуляра.
 */
export function pointOnLine(p: NE, a: NE, b: NE): { station: number; offset: number; foot: NE } {
  const dN = b.n - a.n;
  const dE = b.e - a.e;
  const L = Math.hypot(dN, dE);
  if (L === 0) {
    return { station: 0, offset: Math.hypot(p.n - a.n, p.e - a.e), foot: { n: a.n, e: a.e } };
  }
  const uN = dN / L;
  const uE = dE / L;
  const vN = p.n - a.n;
  const vE = p.e - a.e;
  const station = vN * uN + vE * uE;
  const offset = uN * vE - uE * vN; // >0 — справа по ходу AB
  return { station, offset, foot: { n: a.n + station * uN, e: a.e + station * uE } };
}

/** Деление отрезка AB на n равных частей → n+1 точек (включая A и B). */
export function divideSegment(a: NE, b: NE, n: number): NE[] {
  if (n < 1) return [{ n: a.n, e: a.e }];
  const pts: NE[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    pts.push({ n: a.n + (b.n - a.n) * t, e: a.e + (b.e - a.e) * t });
  }
  return pts;
}

/**
 * Угол поворота трассы по входящему и исходящему азимутам (градусы).
 * Результат в диапазоне (−180, 180]: + вправо (по часовой), − влево.
 */
export function deflectionAngle(azIn: number, azOut: number): number {
  let d = (((azOut - azIn) % 360) + 360) % 360;
  if (d > 180) d -= 360;
  return d;
}
