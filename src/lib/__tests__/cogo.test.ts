import {
  forward,
  inverse,
  polygonArea,
  polygonPerimeter,
  polylineLength,
  degToDms,
  dmsToDeg,
  fmtDms,
  meanStd,
  angleAt,
  type NE,
} from '../cogo';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

describe('forward (ПГЗ) / inverse (ОГЗ)', () => {
  test('forward: азимут 0° идёт на север (+N)', () => {
    const p = forward({ n: 0, e: 0 }, 0, 100);
    expect(near(p.n, 100)).toBe(true);
    expect(near(p.e, 0)).toBe(true);
  });

  test('forward: азимут 90° идёт на восток (+E)', () => {
    const p = forward({ n: 0, e: 0 }, 90, 100);
    expect(near(p.n, 0)).toBe(true);
    expect(near(p.e, 100)).toBe(true);
  });

  test('forward: азимут 180° идёт на юг (-N)', () => {
    const p = forward({ n: 10, e: 5 }, 180, 4);
    expect(near(p.n, 6)).toBe(true);
    expect(near(p.e, 5)).toBe(true);
  });

  test('inverse: горизонтальная пара даёт азимут 90° и точную длину', () => {
    const r = inverse({ n: 0, e: 0 }, { n: 0, e: 50 });
    expect(near(r.distance, 50)).toBe(true);
    expect(near(r.azimuthDeg, 90)).toBe(true);
  });

  test('inverse: приводит азимут в диапазон 0–360 (юго-запад ≈ 225°)', () => {
    const r = inverse({ n: 0, e: 0 }, { n: -10, e: -10 });
    expect(near(r.azimuthDeg, 225)).toBe(true);
    expect(near(r.distance, Math.hypot(10, 10))).toBe(true);
  });

  test('forward → inverse — round-trip восстанавливает азимут и длину', () => {
    const start: NE = { n: 123.456, e: -78.9 };
    const az = 37.25;
    const dist = 456.78;
    const end = forward(start, az, dist);
    const back = inverse(start, end);
    expect(near(back.distance, dist, 1e-6)).toBe(true);
    expect(near(back.azimuthDeg, az, 1e-6)).toBe(true);
  });
});

describe('площадь и длины', () => {
  const square: NE[] = [
    { n: 0, e: 0 },
    { n: 0, e: 10 },
    { n: 10, e: 10 },
    { n: 10, e: 0 },
  ];

  test('polygonArea квадрата 10×10 = 100 м²', () => {
    expect(near(polygonArea(square), 100)).toBe(true);
  });

  test('polygonArea не зависит от направления обхода', () => {
    expect(near(polygonArea([...square].reverse()), 100)).toBe(true);
  });

  test('polygonArea < 3 вершин = 0', () => {
    expect(polygonArea([{ n: 0, e: 0 }, { n: 1, e: 1 }])).toBe(0);
  });

  test('прямоугольный треугольник 3-4-5', () => {
    const tri: NE[] = [{ n: 0, e: 0 }, { n: 0, e: 3 }, { n: 4, e: 0 }];
    expect(near(polygonArea(tri), 6)).toBe(true);
  });

  test('polygonPerimeter квадрата = 40 м', () => {
    expect(near(polygonPerimeter(square), 40)).toBe(true);
  });

  test('polylineLength (незамкнутая), два сегмента', () => {
    const line: NE[] = [{ n: 0, e: 0 }, { n: 0, e: 3 }, { n: 4, e: 3 }];
    expect(near(polylineLength(line), 7)).toBe(true);
  });

  test('polylineLength одной точки = 0', () => {
    expect(polylineLength([{ n: 5, e: 5 }])).toBe(0);
  });
});

describe('градусы ↔ ГМС', () => {
  test('degToDms 30.5° → 30°30′00″', () => {
    const r = degToDms(30.5);
    expect(r.d).toBe(30);
    expect(r.m).toBe(30);
    expect(near(r.s, 0, 1e-9)).toBe(true);
    expect(r.neg).toBe(false);
  });

  test('degToDms отрицательного угла помечает neg', () => {
    const r = degToDms(-1.5);
    expect(r.neg).toBe(true);
    expect(r.d).toBe(1);
    expect(r.m).toBe(30);
  });

  test('dmsToDeg — обратная к degToDms', () => {
    const deg = 47.123456;
    const { d, m, s } = degToDms(deg);
    expect(near(dmsToDeg(d, m, s), deg, 1e-9)).toBe(true);
  });

  test('dmsToDeg с флагом neg даёт отрицательное значение', () => {
    expect(near(dmsToDeg(1, 30, 0, true), -1.5)).toBe(true);
  });

  test('fmtDms форматирует с ведущими нулями', () => {
    expect(fmtDms(5.084722, 1)).toBe('5°05′05.0″');
  });
});

describe('meanStd', () => {
  test('пустой массив → {0, 0}', () => {
    expect(meanStd([])).toEqual({ mean: 0, std: 0 });
  });

  test('одно значение → std 0', () => {
    expect(meanStd([42])).toEqual({ mean: 42, std: 0 });
  });

  test('среднее и выборочное СКО (n-1)', () => {
    const { mean, std } = meanStd([2, 4, 6]);
    expect(near(mean, 4)).toBe(true);
    expect(near(std, 2)).toBe(true); // sqrt(((−2)²+0+2²)/2) = 2
  });
});

describe('angleAt', () => {
  test('прямой угол = 90°', () => {
    const a: NE = { n: 1, e: 0 };
    const b: NE = { n: 0, e: 0 };
    const c: NE = { n: 0, e: 1 };
    expect(near(angleAt(a, b, c), 90)).toBe(true);
  });

  test('развёрнутый угол = 180°', () => {
    const a: NE = { n: 1, e: 0 };
    const b: NE = { n: 0, e: 0 };
    const c: NE = { n: -1, e: 0 };
    expect(near(angleAt(a, b, c), 180)).toBe(true);
  });

  test('всегда в диапазоне 0–180', () => {
    const a: NE = { n: 1, e: 1 };
    const b: NE = { n: 0, e: 0 };
    const c: NE = { n: 1, e: -1 };
    const ang = angleAt(a, b, c);
    expect(ang).toBeGreaterThanOrEqual(0);
    expect(ang).toBeLessThanOrEqual(180);
  });
});
