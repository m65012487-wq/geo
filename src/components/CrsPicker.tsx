import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { colors, space, font, radius, TOUCH_TARGET } from '../theme/theme';
import type { CrsSpec } from '../lib/crs';

/** Выбор системы координат проекта: тип + зона (+ полушарие для UTM). */
export function CrsPicker({ value, onChange }: { value: CrsSpec; onChange: (v: CrsSpec) => void }) {
  const setKind = (kind: CrsSpec['kind']) => {
    if (kind === value.kind) return;
    if (kind === 'wgs84') onChange({ kind: 'wgs84' });
    else if (kind === 'utm') onChange({ kind: 'utm', zone: 37, south: false });
    else onChange({ kind: 'gk', zone: 7 });
  };

  const zone = value.kind === 'utm' || value.kind === 'gk' ? value.zone : 0;
  const setZone = (z: number) => {
    const clamped = Math.max(1, Math.min(60, z));
    if (value.kind === 'utm') onChange({ ...value, zone: clamped });
    else if (value.kind === 'gk') onChange({ ...value, zone: clamped });
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={styles.seg}>
        <Seg label="WGS84" active={value.kind === 'wgs84'} onPress={() => setKind('wgs84')} />
        <Seg label="UTM" active={value.kind === 'utm'} onPress={() => setKind('utm')} />
        <Seg label="Гаусса-Крюгера" active={value.kind === 'gk'} onPress={() => setKind('gk')} />
      </View>

      {value.kind !== 'wgs84' && (
        <View style={styles.zoneRow}>
          <Text style={styles.zoneLabel}>Зона</Text>
          <Pressable style={styles.stepBtn} onPress={() => setZone(zone - 1)}>
            <Text style={styles.stepTxt}>−</Text>
          </Pressable>
          <Text style={styles.zoneVal}>{zone}</Text>
          <Pressable style={styles.stepBtn} onPress={() => setZone(zone + 1)}>
            <Text style={styles.stepTxt}>+</Text>
          </Pressable>

          {value.kind === 'utm' && (
            <View style={[styles.seg, { flex: 1, marginLeft: space.md }]}>
              <Seg label="N" active={!value.south} onPress={() => onChange({ ...value, south: false })} />
              <Seg label="S" active={value.south} onPress={() => onChange({ ...value, south: true })} />
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function Seg({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.segBtn, active && styles.segActive]}>
      <Text style={[styles.segTxt, active && styles.segTxtActive]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceRaised,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 3,
    gap: 3,
  },
  segBtn: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, paddingHorizontal: 4 },
  segActive: { backgroundColor: colors.accent },
  segTxt: { color: colors.textSecondary, fontSize: font.small, fontWeight: '700' },
  segTxtActive: { color: colors.accentText },
  zoneRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  zoneLabel: { color: colors.textSecondary, fontSize: font.small },
  stepBtn: {
    width: TOUCH_TARGET, height: TOUCH_TARGET, borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.borderStrong,
    alignItems: 'center', justifyContent: 'center',
  },
  stepTxt: { color: colors.textPrimary, fontSize: 24, fontWeight: '700' },
  zoneVal: { color: colors.textPrimary, fontSize: font.title, fontWeight: '800', minWidth: 40, textAlign: 'center', fontVariant: ['tabular-nums'] },
});
