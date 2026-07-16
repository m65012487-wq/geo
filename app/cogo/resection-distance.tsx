import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { space } from '../../src/theme/theme';
import { shared } from '../../src/theme/shared';
import { Button } from '../../src/components/ui';
import { NumField, parseNum } from '../../src/components/NumField';
import { distanceDistanceIntersection, type NE } from '../../src/lib/cogo';

/** Линейная засечка: две опорные точки и два расстояния → 0/1/2 решения. */
export default function ResectionDistanceScreen() {
  const [n1, setN1] = useState(''); const [e1, setE1] = useState(''); const [r1, setR1] = useState('');
  const [n2, setN2] = useState(''); const [e2, setE2] = useState(''); const [r2, setR2] = useState('');
  const [res, setRes] = useState<NE[] | null>(null);
  const [err, setErr] = useState('');

  const calc = () => {
    const v = [n1, e1, r1, n2, e2, r2].map(parseNum);
    if (v.some(Number.isNaN)) { setErr('Заполните все поля числами.'); setRes(null); return; }
    if (v[2] <= 0 || v[5] <= 0) { setErr('Расстояния должны быть положительными.'); setRes(null); return; }
    setErr('');
    setRes(distanceDistanceIntersection({ n: v[0], e: v[1] }, v[2], { n: v[3], e: v[4] }, v[5]));
  };

  return (
    <ScrollView style={shared.container} contentContainerStyle={shared.pad} keyboardShouldPersistTaps="handled">
      <Text style={shared.muted}>
        Определяемая точка по двум измеренным расстояниям от известных точек A и B.
        Обычно два решения — выберите по абрису.
      </Text>
      <Text style={shared.sectionTitle}>{'\n'}Точка A</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <NumField label="N, м" value={n1} onChange={setN1} flex />
        <NumField label="E, м" value={e1} onChange={setE1} flex />
      </View>
      <NumField label="Расстояние от A, м" value={r1} onChange={setR1} />
      <Text style={shared.sectionTitle}>{'\n'}Точка B</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <NumField label="N, м" value={n2} onChange={setN2} flex />
        <NumField label="E, м" value={e2} onChange={setE2} flex />
      </View>
      <NumField label="Расстояние от B, м" value={r2} onChange={setR2} />
      <Button label="Вычислить" onPress={calc} style={{ marginTop: space.lg }} />
      {!!err && <Text style={[shared.muted, { marginTop: space.md }]}>{err}</Text>}
      {res && res.length === 0 && (
        <Text style={[shared.muted, { marginTop: space.lg }]}>
          Нет решения: окружности не пересекаются (проверьте расстояния).
        </Text>
      )}
      {res && res.map((p, i) => (
        <View key={i} style={shared.resultBox}>
          <Text style={shared.resultLabel}>Решение {i + 1}{res.length === 2 ? (i === 0 ? ' (слева)' : ' (справа)') : ''}</Text>
          <Text style={shared.resultValue}>N {p.n.toFixed(3)}</Text>
          <Text style={shared.resultValue}>E {p.e.toFixed(3)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}
