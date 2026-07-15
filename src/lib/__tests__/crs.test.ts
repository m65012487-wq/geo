import {
  parseCrs,
  formatCrs,
  crsLabel,
  crsShort,
  hasPlane,
  projectPoint,
  unprojectPoint,
  suggestZone,
  type CrsSpec,
} from '../crs';
import { utmForward } from '../projection';

const D2R = Math.PI / 180;
function metersError(lat: number, a: { lat: number; lon: number }, bLat: number, bLon: number) {
  return Math.hypot((a.lat - bLat) * 111320, (a.lon - bLon) * 111320 * Math.cos(lat * D2R));
}

describe('parseCrs / formatCrs', () => {
  const cases: [string, CrsSpec][] = [
    ['wgs84', { kind: 'wgs84' }],
    ['utm:37N', { kind: 'utm', zone: 37, south: false }],
    ['utm:56S', { kind: 'utm', zone: 56, south: true }],
    ['gk:7', { kind: 'gk', zone: 7 }],
  ];

  test.each(cases)('%s ↔ spec round-trip', (code, spec) => {
    expect(parseCrs(code)).toEqual(spec);
    expect(formatCrs(spec)).toBe(code);
  });

  test('регистронезависимость и legacy «WGS84»', () => {
    expect(parseCrs('WGS84')).toEqual({ kind: 'wgs84' });
    expect(parseCrs('UTM:37n')).toEqual({ kind: 'utm', zone: 37, south: false });
  });

  test('мусор и пустое → WGS84', () => {
    expect(parseCrs('')).toEqual({ kind: 'wgs84' });
    expect(parseCrs(null)).toEqual({ kind: 'wgs84' });
    expect(parseCrs('utm:99')).toEqual({ kind: 'wgs84' }); // зона вне диапазона
    expect(parseCrs('gk:abc')).toEqual({ kind: 'wgs84' });
  });
});

describe('метки и признаки', () => {
  test('crsLabel/crsShort непустые', () => {
    for (const spec of [
      { kind: 'wgs84' } as const,
      { kind: 'utm', zone: 37, south: false } as const,
      { kind: 'gk', zone: 7 } as const,
    ]) {
      expect(crsLabel(spec).length).toBeGreaterThan(0);
      expect(crsShort(spec).length).toBeGreaterThan(0);
    }
  });

  test('hasPlane: только WGS84 без плоскости', () => {
    expect(hasPlane({ kind: 'wgs84' })).toBe(false);
    expect(hasPlane({ kind: 'utm', zone: 37, south: false })).toBe(true);
    expect(hasPlane({ kind: 'gk', zone: 7 })).toBe(true);
  });
});

describe('projectPoint / unprojectPoint', () => {
  test('WGS84 не имеет плоскости → null', () => {
    expect(projectPoint({ kind: 'wgs84' }, 55, 37)).toBeNull();
    expect(unprojectPoint({ kind: 'wgs84' }, 0, 0)).toBeNull();
  });

  test('UTM совпадает с прямым utmForward', () => {
    const spec: CrsSpec = { kind: 'utm', zone: 37, south: false };
    const ne = projectPoint(spec, 55.7558, 37.6173)!;
    const direct = utmForward(55.7558, 37.6173, 37, false);
    expect(ne.n).toBeCloseTo(direct.n, 6);
    expect(ne.e).toBeCloseTo(direct.e, 6);
  });

  test('UTM project→unproject round-trip суб-мм', () => {
    const spec: CrsSpec = { kind: 'utm', zone: 37, south: false };
    const ne = projectPoint(spec, 55.7558, 37.6173)!;
    const g = unprojectPoint(spec, ne.n, ne.e)!;
    expect(metersError(55.75, g, 55.7558, 37.6173)).toBeLessThan(1e-3);
  });

  test('ГК project→unproject round-trip < 1 мм (с датум-сдвигом туда-обратно)', () => {
    const spec: CrsSpec = { kind: 'gk', zone: 7 };
    const ne = projectPoint(spec, 55.75, 37.5)!;
    // Easting с префиксом зоны 7 → больше 7 млн.
    expect(ne.e).toBeGreaterThan(7_000_000);
    const g = unprojectPoint(spec, ne.n, ne.e)!;
    expect(metersError(55.75, g, 55.75, 37.5)).toBeLessThan(1e-3);
  });

  test('UTM и ГК дают заметно разные плоские координаты (разные датумы/зоны)', () => {
    const utm = projectPoint({ kind: 'utm', zone: 37, south: false }, 55.75, 37.5)!;
    const gk = projectPoint({ kind: 'gk', zone: 7 }, 55.75, 37.5)!;
    expect(Math.abs(utm.e - gk.e)).toBeGreaterThan(1000);
  });
});

describe('suggestZone', () => {
  test('по долготе Москвы', () => {
    expect(suggestZone('utm', 37.6)).toBe(37);
    expect(suggestZone('gk', 37.6)).toBe(7);
  });
});
