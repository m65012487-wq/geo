import {
  parseNmea,
  nmeaChecksum,
  nmeaSentence,
  nmeaChecksumValid,
  fixCodeToQuality,
  gstHorizontalSd,
  type GgaData,
  type RmcData,
  type GstData,
} from '../nmea';
import { demoTick, demoStage, DemoNmeaSource } from '../demoNmea';

describe('контрольная сумма', () => {
  test('эталонная строка GGA проходит проверку', () => {
    const s = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47';
    expect(nmeaChecksumValid(s)).toBe(true);
  });

  test('битая контрольная сумма отбраковывается', () => {
    const s = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*00';
    expect(nmeaChecksumValid(s)).toBe(false);
    expect(parseNmea(s)).toBeNull();
  });

  test('искажение тела строки ломает сумму', () => {
    const s = '$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,999.4,M,46.9,M,,*47';
    expect(nmeaChecksumValid(s)).toBe(false);
  });

  test('nmeaSentence строит строку, которую принимает валидатор', () => {
    const body = 'GPGGA,000000,0000.000,N,00000.000,E,1,05,1.0,10.0,M,0,M,,';
    const s = nmeaSentence(body);
    expect(s.endsWith('*' + nmeaChecksum(body))).toBe(true);
    expect(nmeaChecksumValid(s)).toBe(true);
  });
});

describe('парсинг GGA', () => {
  const gga = parseNmea('$GPGGA,123519,4807.038,N,01131.000,E,1,08,0.9,545.4,M,46.9,M,,*47') as GgaData;

  test('тип и координаты', () => {
    expect(gga.type).toBe('GGA');
    expect(gga.latitude).toBeCloseTo(48.1173, 4);
    expect(gga.longitude).toBeCloseTo(11.516667, 5);
  });

  test('качество, спутники, высота', () => {
    expect(gga.quality).toBe('single');
    expect(gga.fixCode).toBe(1);
    expect(gga.satellites).toBe(8);
    expect(gga.altitude).toBeCloseTo(545.4, 1);
  });

  test('пустые поля позиции → null (нет решения)', () => {
    const g = parseNmea(nmeaSentence('GPGGA,123519,,,,,0,00,,,M,,M,,')) as GgaData;
    expect(g.latitude).toBeNull();
    expect(g.longitude).toBeNull();
    expect(g.quality).toBe('none');
  });
});

describe('полушария и талкеры', () => {
  test('южное/западное полушарие дают отрицательные координаты', () => {
    const g = parseNmea(nmeaSentence('GPGGA,000000,3352.000,S,15112.000,W,1,08,0.9,10.0,M,0,M,,')) as GgaData;
    expect(g.latitude).toBeLessThan(0);
    expect(g.longitude).toBeLessThan(0);
    expect(g.latitude).toBeCloseTo(-(33 + 52 / 60), 5);
  });

  test('талкер GN (мультисистемный) распознаётся', () => {
    const g = parseNmea(nmeaSentence('GNGGA,000000,4807.038,N,01131.000,E,4,18,0.6,100.0,M,0,M,,')) as GgaData;
    expect(g.type).toBe('GGA');
    expect(g.quality).toBe('fix');
  });
});

describe('парсинг RMC и GST', () => {
  test('RMC: статус, координаты, дата', () => {
    const r = parseNmea('$GPRMC,123519,A,4807.038,N,01131.000,E,022.4,084.4,230394,003.1,W*6A') as RmcData;
    expect(r.type).toBe('RMC');
    expect(r.valid).toBe(true);
    expect(r.latitude).toBeCloseTo(48.1173, 4);
    expect(r.date).toBe('230394');
    expect(r.speedKnots).toBeCloseTo(22.4, 1);
  });

  test('GST: СКО координат и радиальная погрешность', () => {
    const g = parseNmea(nmeaSentence('GPGST,123519,1.0,2.0,1.0,45.0,0.03,0.04,0.06')) as GstData;
    expect(g.type).toBe('GST');
    expect(g.sdLat).toBeCloseTo(0.03, 3);
    expect(g.sdLon).toBeCloseTo(0.04, 3);
    expect(gstHorizontalSd(g)).toBeCloseTo(0.05, 3); // √(0.03²+0.04²)
  });
});

describe('fixCodeToQuality', () => {
  test('отображение кодов качества', () => {
    expect(fixCodeToQuality(0)).toBe('none');
    expect(fixCodeToQuality(1)).toBe('single');
    expect(fixCodeToQuality(2)).toBe('single');
    expect(fixCodeToQuality(4)).toBe('fix');
    expect(fixCodeToQuality(5)).toBe('float');
    expect(fixCodeToQuality(9)).toBe('none');
  });
});

describe('демо-RTK-источник', () => {
  const cfg = { lat: 55.75, lon: 37.61, alt: 150 };

  test('строки демо проходят боевой парсер', () => {
    for (const step of [0, 5, 10, 25]) {
      for (const s of demoTick(step, cfg).sentences) {
        expect(parseNmea(s)).not.toBeNull();
      }
    }
  });

  test('сценарий сходимости Single → Float → Fixed', () => {
    expect(demoStage(0).fixCode).toBe(1); // single
    expect(demoStage(4).fixCode).toBe(1);
    expect(demoStage(5).fixCode).toBe(5); // float
    expect(demoStage(9).fixCode).toBe(5);
    expect(demoStage(10).fixCode).toBe(4); // fixed
    expect(demoStage(100).fixCode).toBe(4);
  });

  test('в режиме Fixed позиция в пределах нескольких см от опорной', () => {
    const t = demoTick(30, cfg);
    const g = parseNmea(t.sentences[0]) as GgaData;
    const dN = ((g.latitude as number) - cfg.lat) * 111320;
    const dE = ((g.longitude as number) - cfg.lon) * 111320 * Math.cos(cfg.lat * Math.PI / 180);
    expect(Math.hypot(dN, dE)).toBeLessThan(0.1); // < 10 см
  });

  test('источник эмитит строки по таймеру и останавливается', () => {
    jest.useFakeTimers();
    const got: string[] = [];
    const src = new DemoNmeaSource(cfg, 1000);
    src.start((s) => got.push(s));
    jest.advanceTimersByTime(3000);
    src.stop();
    const after = got.length;
    jest.advanceTimersByTime(3000);
    expect(got.length).toBe(after); // после stop новых строк нет
    expect(after).toBe(6); // 3 тика × 2 строки (GGA+GST)
    jest.useRealTimers();
  });
});
