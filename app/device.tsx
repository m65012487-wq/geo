import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { colors, space, font, radius } from '../src/theme/theme';
import { shared } from '../src/theme/shared';
import { Card, QualityBadge } from '../src/components/ui';
import { kvGet, kvSet } from '../src/db/database';
import { useGnss, type GnssSource } from '../src/lib/useGnss';
import { fmtCoord, fmtMeters } from '../src/lib/geo';

interface SourceDef {
  id: GnssSource | 'bluetooth';
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
}

const SOURCES: SourceDef[] = [
  { id: 'phone', title: 'GPS телефона', subtitle: 'Встроенный приёмник, точность 3–15 м', icon: 'phone-portrait-outline' },
  { id: 'demo', title: 'Демо RTK', subtitle: 'Сценарий Single → Float → Fixed, см-точность', icon: 'flask-outline' },
  { id: 'bluetooth', title: 'Bluetooth-приёмник', subtitle: 'Внешний GNSS по NMEA — Фаза 4', icon: 'bluetooth-outline', disabled: true },
];

export default function DeviceScreen() {
  const [selected, setSelected] = useState<GnssSource>('phone');
  const { position, status, errorMsg, source, start } = useGnss();

  useFocusEffect(useCallback(() => {
    kvGet('gnssSource').then((v) => setSelected(v === 'demo' ? 'demo' : 'phone'));
  }, []));

  const choose = async (id: GnssSource) => {
    setSelected(id);
    await kvSet('gnssSource', id);
    await start(); // переинициализировать поток под новый источник
  };

  return (
    <ScrollView style={shared.container} contentContainerStyle={shared.pad}>
      <Text style={styles.groupTitle}>Источник координат</Text>
      {SOURCES.map((s) => {
        const active = !s.disabled && selected === s.id;
        return (
          <Pressable key={s.id} disabled={s.disabled} onPress={() => choose(s.id as GnssSource)}>
            <Card style={StyleSheet.flatten([
              styles.sourceCard,
              active && styles.sourceActive,
              s.disabled && styles.sourceDisabled,
            ])}>
              <Ionicons name={s.icon} size={26} color={active ? colors.accent : colors.textMuted} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.sourceTitle, s.disabled && { color: colors.textMuted }]}>{s.title}</Text>
                <Text style={styles.sourceSub}>{s.subtitle}</Text>
              </View>
              {active && <Ionicons name="checkmark-circle" size={22} color={colors.accent} />}
              {s.disabled && <Text style={styles.soonBadge}>СКОРО</Text>}
            </Card>
          </Pressable>
        );
      })}

      <Text style={[styles.groupTitle, { marginTop: space.xl }]}>Состояние</Text>
      <Card>
        <View style={styles.stateHeader}>
          <Text style={styles.stateSource}>
            {source === 'demo' ? 'Демо RTK' : 'GPS телефона'}
          </Text>
          <QualityBadge quality={position?.quality ?? 'none'} />
        </View>
        {status === 'denied' ? (
          <Text style={{ color: colors.warning, fontSize: font.body }}>
            Нет доступа к геолокации. Разрешите в настройках телефона.
          </Text>
        ) : position ? (
          <View style={styles.coordGrid}>
            <Cell label="Широта" value={fmtCoord(position.latitude)} />
            <Cell label="Долгота" value={fmtCoord(position.longitude)} />
            <Cell label="Высота" value={fmtMeters(position.elevation, 2)} />
            <Cell label="Точность H" value={fmtMeters(position.hAccuracy, 3)} />
            <Cell label="Спутники" value={position.satellites != null ? String(position.satellites) : '—'} />
          </View>
        ) : (
          <Text style={{ color: colors.textSecondary, paddingVertical: space.md }}>
            {errorMsg ?? 'Определение позиции…'}
          </Text>
        )}
      </Card>

      <Text style={styles.hint}>
        Демо-режим прогоняет сгенерированный поток NMEA (GGA + GST) через тот же
        парсер, что и реальный приёмник, — интерфейс RTK работает без железа.
      </Text>
    </ScrollView>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.cell}>
      <Text style={styles.cellLabel}>{label}</Text>
      <Text style={styles.cellValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    color: colors.textSecondary, fontSize: font.small, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: space.md,
  },
  sourceCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.md },
  sourceActive: { borderColor: colors.accentDim },
  sourceDisabled: { opacity: 0.55 },
  sourceTitle: { color: colors.textPrimary, fontSize: font.bodyLg, fontWeight: '700' },
  sourceSub: { color: colors.textMuted, fontSize: font.small, marginTop: 2 },
  soonBadge: {
    color: colors.textMuted, fontSize: 10, fontWeight: '800', letterSpacing: 0.5,
    borderWidth: 1, borderColor: colors.border, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, overflow: 'hidden',
  },
  stateHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  stateSource: { color: colors.textPrimary, fontSize: font.body, fontWeight: '700' },
  coordGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '50%', paddingVertical: space.sm },
  cellLabel: { color: colors.textMuted, fontSize: font.caption },
  cellValue: { color: colors.textPrimary, fontSize: font.bodyLg, fontWeight: '600', fontVariant: ['tabular-nums'] },
  hint: { color: colors.textMuted, fontSize: font.caption, lineHeight: 17, marginTop: space.lg },
});
