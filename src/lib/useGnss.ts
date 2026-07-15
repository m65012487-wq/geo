import { useEffect, useRef, useState, useCallback } from 'react';
import * as Location from 'expo-location';
import type { FixQuality, LivePosition } from '../db/types';
import { kvGet } from '../db/database';
import { DemoNmeaSource } from './demoNmea';
import { parseNmea, gstHorizontalSd } from './nmea';

/**
 * Преобразует горизонтальную точность GPS в класс качества решения.
 * В реальном RTK это приходит от приёмника; здесь — эвристика по точности
 * телефонного GPS, чтобы продемонстрировать индикацию Fix/Float/Single.
 */
function classifyQuality(hAccuracy: number | null): FixQuality {
  if (hAccuracy == null) return 'none';
  if (hAccuracy <= 1.5) return 'fix';     // имитация RTK Fixed
  if (hAccuracy <= 5) return 'float';     // имитация Float
  return 'single';                         // Autonomous
}

export type GnssStatus = 'idle' | 'requesting' | 'denied' | 'active' | 'error';
export type GnssSource = 'phone' | 'demo';

/** Резервная опорная точка для демо, если телефонного фикса нет (центр Москвы). */
const DEMO_FALLBACK = { lat: 55.751244, lon: 37.618423, alt: 150 };

export function useGnss() {
  const [position, setPosition] = useState<LivePosition | null>(null);
  const [status, setStatus] = useState<GnssStatus>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [source, setSource] = useState<GnssSource>('phone');
  const subRef = useRef<Location.LocationSubscription | null>(null);
  const demoRef = useRef<DemoNmeaSource | null>(null);
  const sdRef = useRef<number | null>(null); // последняя СКО из GST

  const stop = useCallback(() => {
    subRef.current?.remove();
    subRef.current = null;
    demoRef.current?.stop();
    demoRef.current = null;
  }, []);

  const start = useCallback(async () => {
    stop();
    const src: GnssSource = (await kvGet('gnssSource')) === 'demo' ? 'demo' : 'phone';
    setSource(src);
    try {
      setStatus('requesting');
      const { status: perm } = await Location.requestForegroundPermissionsAsync();

      if (src === 'phone') {
        if (perm !== 'granted') {
          setStatus('denied');
          setErrorMsg('Доступ к геолокации не предоставлен.');
          return;
        }
        setStatus('active');
        setErrorMsg(null);
        subRef.current = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 },
          (loc) => {
            const h = loc.coords.accuracy ?? null;
            setPosition({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
              elevation: loc.coords.altitude ?? 0,
              hAccuracy: h ?? 0,
              vAccuracy: loc.coords.altitudeAccuracy ?? 0,
              quality: classifyQuality(h),
              satellites: null,
              timestamp: loc.timestamp,
            });
          }
        );
        return;
      }

      // Демо-RTK: приёмник «дрожит» вокруг реальной позиции телефона (если она
      // доступна) или вокруг резервной точки. NMEA прогоняется через боевой парсер.
      let base = DEMO_FALLBACK;
      if (perm === 'granted') {
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          base = { lat: loc.coords.latitude, lon: loc.coords.longitude, alt: loc.coords.altitude ?? 150 };
        } catch {
          // оставляем резервную точку
        }
      }
      setStatus('active');
      setErrorMsg(null);
      const demo = new DemoNmeaSource(base, 1000);
      demoRef.current = demo;
      demo.start((sentence) => {
        const parsed = parseNmea(sentence);
        if (!parsed) return;
        if (parsed.type === 'GST') {
          sdRef.current = gstHorizontalSd(parsed);
          return;
        }
        if (parsed.type === 'GGA' && parsed.latitude != null && parsed.longitude != null) {
          setPosition({
            latitude: parsed.latitude,
            longitude: parsed.longitude,
            elevation: parsed.altitude ?? 0,
            hAccuracy: sdRef.current ?? 0,
            vAccuracy: 0,
            quality: parsed.quality,
            satellites: parsed.satellites,
            timestamp: Date.now(),
          });
        }
      });
    } catch (e) {
      setStatus('error');
      setErrorMsg(e instanceof Error ? e.message : 'Ошибка GNSS');
    }
  }, [stop]);

  useEffect(() => {
    start();
    return () => stop();
  }, [start, stop]);

  return { position, status, errorMsg, source, start, stop };
}
