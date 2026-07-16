import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { space } from '../../src/theme/theme';
import { shared } from '../../src/theme/shared';
import { Button } from '../../src/components/ui';
import { NumField, parseNum } from '../../src/components/NumField';
import { bearingBearingIntersection, type NE } from '../../src/lib/cogo';

/** Прямая засечка: две опорные точки и два азимута → точка пересечения. */
export default function ResectionBearingScreen() {
  const [n1, setN1] = useState(''); const [e1, setE1] = useState(''); const [a1, setA1] = useState('');
  const [n2, setN2] = useState(''); const [e2, setE2] = useState(''); const [a2, setA2] = useState('');
  const [res, setRes] = useState<NE | null | 'none'>(null);
  const [err, setErr] = useState('');

  const calc = () => {
    const v = [n1, e1, a1, n2, e2, a2].map(parseNum);
    if (v.some(Number.isNaN)) { setErr('Заполните все поля числами.'); setRes(null); return; }
    setErr('');
    const p = bearingBearingIntersection({ n: v[0], e: v[1] }, v[2], { n: v[3], e: v[4] }, v[5]);
    setRes(p ?? 'none');
  };

  return (
    <ScrollView style={shared.container} contentContainerStyle={shared.pad} keyboardShouldPersistTaps="handled">
      <Text style={shared.muted}>
        Определяемая точка по двум направлениям (азимутам, °) с известных точек A и B.
      </Text>
      <Text style={shared.sectionTitle}>{'\n'}Точка A</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <NumField label="N, м" value={n1} onChange={setN1} flex />
        <NumField label="E, м" value={e1} onChange={setE1} flex />
      </View>
      <NumField label="Азимут с A, °" value={a1} onChange={setA1} />
      <Text style={shared.sectionTitle}>{'\n'}Точка B</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <NumField label="N, м" value={n2} onChange={setN2} flex />
        <NumField label="E, м" value={e2} onChange={setE2} flex />
      </View>
      <NumField label="Азимут с B, °" value={a2} onChange={setA2} />
      <Button label="Вычислить" onPress={calc} style={{ marginTop: space.lg }} />
      {!!err && <Text style={[shared.muted, { marginTop: space.md }]}>{err}</Text>}
      {res === 'none' && (
        <Text style={[shared.muted, { marginTop: space.lg }]}>
          Направления параллельны — пересечения нет.
        </Text>
      )}
      {res && res !== 'none' && (
        <View style={shared.resultBox}>
          <Text style={shared.resultLabel}>Определяемая точка</Text>
          <Text style={shared.resultValue}>N {res.n.toFixed(3)}</Text>
          <Text style={shared.resultValue}>E {res.e.toFixed(3)}</Text>
        </View>
      )}
    </ScrollView>
  );
}
