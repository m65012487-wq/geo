import {
  distanceDistanceIntersection,
  bearingBearingIntersection,
  pointOnLine,
  divideSegment,
  deflectionAngle,
  inverse,
  type NE,
} from '../cogo';

const near = (a: number, b: number, eps = 1e-6) => Math.abs(a - b) <= eps;

describe('линейная засечка (окружность-окружность)', () => {
  test('два симметричных решения', () => {
    const a: NE = { n: 0, e: 0 };
    const b: NE = { n: 0, e: 10 };
    const sols = distanceDistanceIntersection(a, Math.sqrt(50), b, Math.sqrt(50));
    expect(sols).toHaveLength(2);
    // Оба на E=5, N=±5.
    for (const s of sols) expect(near(s.e, 5)).toBe(true);
    const ns = sols.map((s) => s.n).sort((x, y) => x - y);
    expect(near(ns[0], -5)).toBe(true);
    expect(near(ns[1], 5)).toBe(true);
  });

  test('касание — одно решение', () => {
    const sols = distanceDistanceIntersection({ n: 0, e: 0 }, 5, { n: 0, e: 10 }, 5);
    expect(sols).toHaveLength(1);
    expect(near(sols[0].e, 5)).toBe(true);
    expect(near(sols[0].n, 0)).toBe(true);
  });

  test('нет пересечения (слишком далеко / вложены / совпали центры)', () => {
    expect(distanceDistanceIntersection({ n: 0, e: 0 }, 1, { n: 0, e: 10 }, 1)).toHaveLength(0);
    expect(distanceDistanceIntersection({ n: 0, e: 0 }, 1, { n: 0, e: 2 }, 10)).toHaveLength(0);
    expect(distanceDistanceIntersection({ n: 0, e: 0 }, 5, { n: 0, e: 0 }, 5)).toHaveLength(0);
  });

  test('решения действительно лежат на заданных радиусах', () => {
    const a: NE = { n: 3, e: -2 };
    const b: NE = { n: 8, e: 6 };
    const ra = 6;
    const rb = 7;
    for (const s of distanceDistanceIntersection(a, ra, b, rb)) {
      expect(near(inverse(a, s).distance, ra, 1e-6)).toBe(true);
      expect(near(inverse(b, s).distance, rb, 1e-6)).toBe(true);
    }
  });
});

describe('прямая засечка (азимут-азимут)', () => {
  test('пересечение двух направлений', () => {
    const a: NE = { n: 0, e: 0 };
    const b: NE = { n: 0, e: 10 };
    // Из A азимут 45° (NE), из B азимут 315° (NW) → встречаются на N=5, E=5.
    const p = bearingBearingIntersection(a, 45, b, 315)!;
    expect(near(p.n, 5, 1e-9)).toBe(true);
    expect(near(p.e, 5, 1e-9)).toBe(true);
  });

  test('обратная сверка: азимуты из a и b на найденную (переднюю) точку совпадают', () => {
    const a: NE = { n: 0, e: 0 };
    const b: NE = { n: 0, e: 20 };
    const azA = 60; // сходятся вперёд
    const azB = 300;
    const p = bearingBearingIntersection(a, azA, b, azB)!;
    expect(near(inverse(a, p).azimuthDeg, azA, 1e-6)).toBe(true);
    expect(near(inverse(b, p).azimuthDeg, azB, 1e-6)).toBe(true);
  });

  test('параллельные направления → null', () => {
    expect(bearingBearingIntersection({ n: 0, e: 0 }, 90, { n: 5, e: 0 }, 90)).toBeNull();
  });
});

describe('проекция точки на линию', () => {
  const a: NE = { n: 0, e: 0 };
  const b: NE = { n: 0, e: 10 }; // AB направлено на восток (азимут 90°)

  test('станция и основание', () => {
    const r = pointOnLine({ n: 3, e: 4 }, a, b);
    expect(near(r.station, 4)).toBe(true); // проекция на восток
    expect(near(r.foot.e, 4)).toBe(true);
    expect(near(r.foot.n, 0)).toBe(true);
  });

  test('знак смещения: справа по ходу AB (+), слева (−)', () => {
    // AB на восток; «справа» по ходу — на юг (N<0).
    expect(pointOnLine({ n: -2, e: 5 }, a, b).offset).toBeGreaterThan(0);
    expect(pointOnLine({ n: 2, e: 5 }, a, b).offset).toBeLessThan(0);
    expect(near(Math.abs(pointOnLine({ n: -2, e: 5 }, a, b).offset), 2)).toBe(true);
  });

  test('станция вне отрезка допускается (отрицательная / больше длины)', () => {
    expect(pointOnLine({ n: 0, e: -3 }, a, b).station).toBeCloseTo(-3, 6);
    expect(pointOnLine({ n: 0, e: 15 }, a, b).station).toBeCloseTo(15, 6);
  });
});

describe('деление отрезка', () => {
  test('на 4 части → 5 точек, равномерно', () => {
    const pts = divideSegment({ n: 0, e: 0 }, { n: 0, e: 8 }, 4);
    expect(pts).toHaveLength(5);
    expect(pts.map((p) => p.e)).toEqual([0, 2, 4, 6, 8]);
  });

  test('включает оба конца', () => {
    const pts = divideSegment({ n: 1, e: 1 }, { n: 5, e: 9 }, 2);
    expect(pts[0]).toEqual({ n: 1, e: 1 });
    expect(pts[pts.length - 1]).toEqual({ n: 5, e: 9 });
    expect(pts[1]).toEqual({ n: 3, e: 5 }); // середина
  });
});

describe('угол поворота (deflection)', () => {
  test('прямо → 0°', () => {
    expect(near(deflectionAngle(90, 90), 0)).toBe(true);
  });

  test('поворот вправо (+) и влево (−)', () => {
    expect(near(deflectionAngle(0, 30), 30)).toBe(true); // вправо
    expect(near(deflectionAngle(0, 330), -30)).toBe(true); // влево
  });

  test('разворот 180° и переход через 0°', () => {
    expect(near(Math.abs(deflectionAngle(0, 180)), 180)).toBe(true);
    expect(near(deflectionAngle(350, 10), 20)).toBe(true);
    expect(near(deflectionAngle(10, 350), -20)).toBe(true);
  });
});
