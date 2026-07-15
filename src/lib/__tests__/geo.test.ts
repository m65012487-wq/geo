import {
  haversine,
  bearing,
  toLocalMeters,
  geoLength,
  geoArea,
  geoPerimeter,
} from '../geo';

const near = (a: number, b: number, eps: number) => Math.abs(a - b) <= eps;

describe('haversine', () => {
  test('одна и та же точка → 0 м', () => {
    expect(haversine(55.75, 37.61, 55.75, 37.61)).toBe(0);
  });

  test('1° по широте ≈ 111.2 км (в пределах 0.5 км)', () => {
    const d = haversine(0, 0, 1, 0);
    expect(near(d, 111195, 500)).toBe(true);
  });

  test('симметрична (A→B == B→A)', () => {
    const ab = haversine(55.75, 37.61, 59.93, 30.33);
    const ba = haversine(59.93, 30.33, 55.75, 37.61);
    expect(near(ab, ba, 1e-6)).toBe(true);
  });

  test('Москва–Петербург ≈ 633 км (в пределах 5 км)', () => {
    const d = haversine(55.7558, 37.6173, 59.9343, 30.3351);
    expect(near(d, 633000, 5000)).toBe(true);
  });
});

describe('bearing', () => {
  test('строго на север ≈ 0°', () => {
    expect(near(bearing(0, 0, 1, 0), 0, 1e-6)).toBe(true);
  });

  test('строго на восток ≈ 90°', () => {
    expect(near(bearing(0, 0, 0, 1), 90, 1e-6)).toBe(true);
  });

  test('строго на юг ≈ 180°', () => {
    expect(near(bearing(1, 0, 0, 0), 180, 1e-6)).toBe(true);
  });

  test('результат всегда в диапазоне 0–360', () => {
    const b = bearing(10, 20, 5, 15);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe('toLocalMeters', () => {
  test('опорная точка отображается в начало координат', () => {
    const p = toLocalMeters(55.75, 37.61, 55.75, 37.61);
    expect(near(p.x, 0, 1e-6)).toBe(true);
    expect(near(p.y, 0, 1e-6)).toBe(true);
  });

  test('северо-восток даёт +x (восток) и +y (север)', () => {
    const p = toLocalMeters(55.75, 37.61, 55.76, 37.62);
    expect(p.x).toBeGreaterThan(0);
    expect(p.y).toBeGreaterThan(0);
  });

  test('юго-запад даёт отрицательные x и y', () => {
    const p = toLocalMeters(55.75, 37.61, 55.74, 37.6);
    expect(p.x).toBeLessThan(0);
    expect(p.y).toBeLessThan(0);
  });
});

describe('geoLength / geoArea / geoPerimeter', () => {
  // Квадрат ~ по 0.001° стороной у экватора (≈ 111 м).
  const ring = [
    { lat: 0, lon: 0 },
    { lat: 0, lon: 0.001 },
    { lat: 0.001, lon: 0.001 },
    { lat: 0.001, lon: 0 },
  ];

  test('geoLength ломаной из двух точек = haversine', () => {
    const pts = [{ lat: 0, lon: 0 }, { lat: 0, lon: 0.001 }];
    expect(near(geoLength(pts), haversine(0, 0, 0, 0.001), 1e-6)).toBe(true);
  });

  test('geoArea квадрата ~0.001° ≈ 12360 м² (в пределах 2%)', () => {
    const side = haversine(0, 0, 0, 0.001); // ≈ 111 м
    const expected = side * side;
    expect(near(geoArea(ring), expected, expected * 0.02)).toBe(true);
  });

  test('geoArea < 3 вершин = 0', () => {
    expect(geoArea([{ lat: 0, lon: 0 }, { lat: 0, lon: 1 }])).toBe(0);
  });

  test('geoPerimeter замыкает контур (≈ 4 стороны)', () => {
    const side = haversine(0, 0, 0, 0.001);
    expect(near(geoPerimeter(ring), side * 4, side * 0.04)).toBe(true);
  });
});
