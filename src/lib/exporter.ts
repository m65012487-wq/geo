import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { Project, SurveyPoint, Feature } from '../db/types';
import { parseCrs, hasPlane, projectPoint, crsShort } from './crs';

function sanitize(name: string): string {
  return name.replace(/[^\wа-яА-ЯёЁ-]+/g, '_').slice(0, 40) || 'project';
}

async function writeAndShare(filename: string, content: string, mime: string): Promise<void> {
  const file = new File(Paths.cache, filename);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  const can = await Sharing.isAvailableAsync();
  if (!can) throw new Error('Отправка файлов недоступна на этом устройстве');
  await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: filename });
}

/**
 * Экспорт точек в CSV. Если у проекта задана плоская СК (UTM/ГК), добавляются
 * колонки Northing/Easting (спроецированные из WGS84 согласно СК проекта).
 */
export async function exportPointsCsv(project: Project, points: SurveyPoint[]): Promise<void> {
  const crs = parseCrs(project.crs);
  const plane = hasPlane(crs);
  const zoneCol = crsShort(crs);

  const header = [
    'Name', 'Code',
    ...(plane ? ['Northing', 'Easting', 'CRS'] : []),
    'Latitude', 'Longitude', 'Elevation', 'HAccuracy', 'Quality', 'Epochs', 'Note', 'Timestamp',
  ].join(',');

  const lines = points.map((p) => {
    const ne = plane ? projectPoint(crs, p.latitude, p.longitude) : null;
    return [
      p.name, p.code,
      ...(plane ? [ne ? ne.n.toFixed(3) : '', ne ? ne.e.toFixed(3) : '', zoneCol] : []),
      p.latitude.toFixed(8), p.longitude.toFixed(8), p.elevation.toFixed(3),
      p.hAccuracy.toFixed(3), p.quality, p.epochs,
      `"${p.note.replace(/"/g, '""')}"`,
      new Date(p.createdAt).toISOString(),
    ].join(',');
  });

  const csv = [header, ...lines].join('\n');
  await writeAndShare(`${sanitize(project.name)}_points.csv`, csv, 'text/csv');
}

/** Экспорт всего проекта в GeoJSON (точки + линии + полигоны). */
export async function exportGeoJson(project: Project, points: SurveyPoint[], features: Feature[]): Promise<void> {
  const fc = {
    type: 'FeatureCollection' as const,
    features: [
      ...points.map((p) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: [p.longitude, p.latitude, p.elevation] },
        properties: {
          name: p.name, code: p.code, quality: p.quality,
          hAccuracy: p.hAccuracy, epochs: p.epochs, note: p.note,
          createdAt: new Date(p.createdAt).toISOString(),
        },
      })),
      ...features
        // Отбрасываем вырожденные объекты: полигон требует ≥3, линия ≥2 вершин.
        .filter((f) => f.vertices.length >= (f.type === 'polygon' ? 3 : 2))
        .map((f) => ({
        type: 'Feature' as const,
        geometry:
          f.type === 'polygon'
            ? {
                type: 'Polygon' as const,
                coordinates: [[...f.vertices, f.vertices[0]].map((v) => [v.lon, v.lat, v.elev])],
              }
            : {
                type: 'LineString' as const,
                coordinates: f.vertices.map((v) => [v.lon, v.lat, v.elev]),
              },
        properties: { name: f.name, code: f.code, createdAt: new Date(f.createdAt).toISOString() },
      })),
    ],
  };
  await writeAndShare(`${sanitize(project.name)}.geojson`, JSON.stringify(fc, null, 1), 'application/geo+json');
}
