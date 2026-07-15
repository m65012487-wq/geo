import {
  WGS84,
  KRASOVSKY,
  type Ellipsoid,
  geodeticToEcef,
  ecefToGeodetic,
  tmForward,
  tmInverse,
  utmForward,
  utmInverse,
  utmZoneFromLon,
  gkForward,
  gkInverse,
  gkZoneFromLon,
  sk42ToWgs84,
  wgs84ToSk42,
} from '../projection';

const D2R = Math.PI / 180;

/** Независимая длина дуги меридиана от экватора до φ (Симпсон, 2000 сегментов). */
function meridianArc(latDeg: number, ell: Ellipsoid): number {
  const e2 = ell.f * (2 - ell.f);
  const rho = (phi: number) =>
    (ell.a * (1 - e2)) / Math.pow(1 - e2 * Math.sin(phi) ** 2, 1.5);
  const b = latDeg * D2R;
  const nSeg = 2000;
  const h = b / nSeg;
  let s = rho(0) + rho(b);
  for (let i = 1; i < nSeg; i++) s += (i % 2 ? 4 : 2) * rho(i * h);
  return (s * h) / 3;
}

/** Ошибка позиции в метрах между двумя (φ,λ). */
function metersError(latDeg: number, aLat: number, aLon: number, bLat: number, bLon: number): number {
  const dN = (aLat - bLat) * 111320;
  const dE = (aLon - bLon) * 111320 * Math.cos(latDeg * D2R);
  return Math.hypot(dN, dE);
}

describe('ECEF ↔ геодезические', () => {
  test('round-trip WGS84 суб-мм на разных широтах/высотах', () => {
    for (const [lat, lon, h] of [
      [0, 0, 0],
      [55.75, 37.61, 150],
      [-33.87, 151.21, 20],
      [78.2, -15.6, 1200],
    ]) {
      const [x, y, z] = geodeticToEcef(lat, lon, h, WGS84);
      const g = ecefToGeodetic(x, y, z, WGS84);
      expect(Math.abs(g.lat - lat)).toBeLessThan(1e-9);
      expect(Math.abs(g.lon - lon)).toBeLessThan(1e-9);
      expect(Math.abs(g.h - h)).toBeLessThan(1e-4);
    }
  });
});

describe('Поперечная Меркатора — серии Крюгера', () => {
  const p = { lon0: 39, k0: 1, falseEasting: 0, falseNorthing: 0 };

  test('на осевом меридиане Easting = FE, Northing = длина дуги меридиана', () => {
    for (const lat of [10, 30, 45, 60, 75]) {
      const ne = tmForward(lat, p.lon0, WGS84, p);
      expect(Math.abs(ne.e)).toBeLessThan(1e-6); // ровно на CM
      expect(Math.abs(ne.n - meridianArc(lat, WGS84))).toBeLessThan(1e-3); // суб-мм
    }
  });

  test('дуга меридиана до 45° сходится с эталоном 4 984 944.38 м', () => {
    expect(Math.abs(meridianArc(45, WGS84) - 4984944.378)).toBeLessThan(0.01);
  });

  test('round-trip forward→inverse суб-мм на сетке точек', () => {
    let maxErr = 0;
    for (let lat = -80; lat <= 80; lat += 10) {
      for (let dLon = -3; dLon <= 3; dLon += 0.75) {
        const lon = p.lon0 + dLon;
        const ne = tmForward(lat, lon, WGS84, p);
        const g = tmInverse(ne.n, ne.e, WGS84, p);
        maxErr = Math.max(maxErr, metersError(lat, lat, lon, g.lat, g.lon));
      }
    }
    expect(maxErr).toBeLessThan(1e-3); // суб-мм по всей зоне
  });
});

describe('UTM (WGS84)', () => {
  test('номер зоны по долготе', () => {
    expect(utmZoneFromLon(-177)).toBe(1);
    expect(utmZoneFromLon(0)).toBe(31);
    expect(utmZoneFromLon(3)).toBe(31);
    expect(utmZoneFromLon(39)).toBe(37); // Москва
    expect(utmZoneFromLon(177)).toBe(60);
  });

  test('точка на осевом меридиане зоны 31 (3°E) → E=500000, N≈0 на экваторе', () => {
    const ne = utmForward(0, 3, 31, false);
    expect(Math.abs(ne.e - 500000)).toBeLessThan(1e-6);
    expect(Math.abs(ne.n)).toBeLessThan(1e-6);
  });

  test('северное полушарие: FN=0; южное: FN=10 000 000 у экватора', () => {
    const north = utmForward(0.0001, 3, 31, false);
    const south = utmForward(-0.0001, 3, 31, true);
    expect(north.n).toBeGreaterThan(0);
    expect(south.n).toBeLessThan(10000000);
    expect(south.n).toBeGreaterThan(9999000);
  });

  test('round-trip forward→inverse суб-мм (Москва, зона 37)', () => {
    const ne = utmForward(55.7558, 37.6173, 37, false);
    const g = utmInverse(ne.n, ne.e, 37, false);
    expect(metersError(55.75, 55.7558, 37.6173, g.lat, g.lon)).toBeLessThan(1e-3);
    // Easting в разумных пределах зоны.
    expect(ne.e).toBeGreaterThan(0);
    expect(ne.e).toBeLessThan(1000000);
  });
});

describe('Гаусса-Крюгера (Красовский)', () => {
  test('номер зоны по долготе', () => {
    expect(gkZoneFromLon(3)).toBe(1);
    expect(gkZoneFromLon(39)).toBe(7); // осевой меридиан 39° → зона 7
  });

  test('на осевом меридиане Easting = зона·1e6 + 500000', () => {
    const ne = gkForward(0, 39, 7, true); // CM зоны 7 = 39°
    expect(Math.abs(ne.e - (7 * 1_000_000 + 500000))).toBeLessThan(1e-6);
    expect(Math.abs(ne.n)).toBeLessThan(1e-6);
  });

  test('без префикса зоны Easting = 500000 на CM', () => {
    const ne = gkForward(0, 39, 7, false);
    expect(Math.abs(ne.e - 500000)).toBeLessThan(1e-6);
  });

  test('round-trip forward→inverse суб-мм (с префиксом зоны)', () => {
    const ne = gkForward(55.75, 37.5, 7, true);
    const g = gkInverse(ne.n, ne.e, 7, true);
    expect(metersError(55.75, 55.75, 37.5, g.lat, g.lon)).toBeLessThan(1e-3);
  });
});

describe('Гельмерт WGS84 ↔ СК-42', () => {
  test('round-trip WGS84→СК42→WGS84 < 1 мм', () => {
    for (const [lat, lon] of [
      [55.75, 37.61],
      [43.1, 131.9],
      [68.9, 33.1],
    ]) {
      const sk = wgs84ToSk42(lat, lon);
      const back = sk42ToWgs84(sk.lat, sk.lon);
      expect(metersError(lat, lat, lon, back.lat, back.lon)).toBeLessThan(1e-3);
    }
  });

  test('датум-сдвиг ненулевой, но в пределах ~200 м', () => {
    const sk = wgs84ToSk42(55.75, 37.61);
    const shift = metersError(55.75, 55.75, 37.61, sk.lat, sk.lon);
    expect(shift).toBeGreaterThan(1); // сдвиг реально есть
    expect(shift).toBeLessThan(200); // но обобщённый, порядок метров-десятков метров
  });

  test('эллипсоид Красовского крупнее WGS84 ровно на 108 м по большой полуоси', () => {
    expect(KRASOVSKY.a - WGS84.a).toBeCloseTo(108, 0);
  });
});
