import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { colors, space, font } from '../../src/theme/theme';
import { shared } from '../../src/theme/shared';
import { Button } from '../../src/components/ui';
import { NumField, parseNum } from '../../src/components/NumField';
import { divideSegment, inverse, type NE } from '../../src/lib/cogo';

/** Деление отрезка на равные части с ведомостью точек. */
export default function DivideScreen() {
  const [an, setAn] = useState(''); const [ae, setAe] = useState('');
  const [bn, setBn] = useState(''); const [be, setBe] = useState('');
  const [parts, setParts] = useState('4');
  const [rows, setRows] = useState<{ pt: NE; run: number }[] | null>(null);
  const [err, setErr] = useState('');

  const calc = () => {
    const v = [an, ae, bn, be].map(parseNum);
    const nParts = Math.round(parseNum(parts));
    if (v.some(Number.isNaN) || Number.isNaN(nParts)) { setErr('Заполните все поля числами.'); setRows(null); return; }
    if (nParts < 1 || nParts > 100) { setErr('Число частей — от 1 до 100.'); setRows(null); return; }
    setErr('');
    const a: NE = { n: v[0], e: v[1] };
    const b: NE = { n: v[2], e: v[3] };
    const step = inverse(a, b).distance / nParts;
    setRows(divideSegment(a, b, nParts).map((pt, i) => ({ pt, run: step * i })));
  };

  return (
    <ScrollView style={shared.container} contentContainerStyle={shared.pad} keyboardShouldPersistTaps="handled">
      <Text style={shared.muted}>Деление отрезка A→B на равные части. Ведомость — координаты и нарастающее расстояние.</Text>
      <Text style={shared.sectionTitle}>{'\n'}Точка A</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <NumField label="N, м" value={an} onChange={setAn} flex />
        <NumField label="E, м" value={ae} onChange={setAe} flex />
      </View>
      <Text style={shared.sectionTitle}>{'\n'}Точка B</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <NumField label="N, м" value={bn} onChange={setBn} flex />
        <NumField label="E, м" value={be} onChange={setBe} flex />
      </View>
      <NumField label="Число частей" value={parts} onChange={setParts} />
      <Button label="Вычислить" onPress={calc} style={{ marginTop: space.lg }} />
      {!!err && <Text style={[shared.muted, { marginTop: space.md }]}>{err}</Text>}
      {rows && (
        <View style={[shared.resultBox, { gap: 0 }]}>
          <View style={styles.row}>
            <Text style={[styles.h, { width: 34 }]}>№</Text>
            <Text style={[styles.h, { flex: 1 }]}>N</Text>
            <Text style={[styles.h, { flex: 1 }]}>E</Text>
            <Text style={[styles.h, { width: 74, textAlign: 'right' }]}>S, м</Text>
          </View>
          {rows.map((r, i) => (
            <View key={i} style={styles.row}>
              <Text style={[styles.c, { width: 34 }]}>{i}</Text>
              <Text style={[styles.c, { flex: 1 }]}>{r.pt.n.toFixed(3)}</Text>
              <Text style={[styles.c, { flex: 1 }]}>{r.pt.e.toFixed(3)}</Text>
              <Text style={[styles.c, { width: 74, textAlign: 'right' }]}>{r.run.toFixed(3)}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 6 },
  h: { color: colors.textMuted, fontSize: font.caption, fontWeight: '700' },
  c: { color: colors.textPrimary, fontSize: font.small, fontVariant: ['tabular-nums'] },
});
