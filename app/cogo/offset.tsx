import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { space } from '../../src/theme/theme';
import { shared } from '../../src/theme/shared';
import { Button } from '../../src/components/ui';
import { NumField, parseNum } from '../../src/components/NumField';
import { pointOnLine } from '../../src/lib/cogo';

/** Проекция точки на линию: станция, смещение (±право/лево), основание. */
export default function OffsetScreen() {
  const [pn, setPn] = useState(''); const [pe, setPe] = useState('');
  const [an, setAn] = useState(''); const [ae, setAe] = useState('');
  const [bn, setBn] = useState(''); const [be, setBe] = useState('');
  const [res, setRes] = useState<{ station: number; offset: number; foot: { n: number; e: number } } | null>(null);
  const [err, setErr] = useState('');

  const calc = () => {
    const v = [pn, pe, an, ae, bn, be].map(parseNum);
    if (v.some(Number.isNaN)) { setErr('Заполните все поля числами.'); setRes(null); return; }
    if (v[2] === v[4] && v[3] === v[5]) { setErr('Точки A и B совпадают — линия не задана.'); setRes(null); return; }
    setErr('');
    setRes(pointOnLine({ n: v[0], e: v[1] }, { n: v[2], e: v[3] }, { n: v[4], e: v[5] }));
  };

  return (
    <ScrollView style={shared.container} contentContainerStyle={shared.pad} keyboardShouldPersistTaps="handled">
      <Text style={shared.muted}>
        Проекция точки P на прямую A→B: станция (вдоль линии от A), смещение
        (+ справа по ходу, − слева) и основание перпендикуляра.
      </Text>
      <Text style={shared.sectionTitle}>{'\n'}Точка P</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <NumField label="N, м" value={pn} onChange={setPn} flex />
        <NumField label="E, м" value={pe} onChange={setPe} flex />
      </View>
      <Text style={shared.sectionTitle}>{'\n'}Начало линии A</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <NumField label="N, м" value={an} onChange={setAn} flex />
        <NumField label="E, м" value={ae} onChange={setAe} flex />
      </View>
      <Text style={shared.sectionTitle}>{'\n'}Конец линии B</Text>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <NumField label="N, м" value={bn} onChange={setBn} flex />
        <NumField label="E, м" value={be} onChange={setBe} flex />
      </View>
      <Button label="Вычислить" onPress={calc} style={{ marginTop: space.lg }} />
      {!!err && <Text style={[shared.muted, { marginTop: space.md }]}>{err}</Text>}
      {res && (
        <View style={shared.resultBox}>
          <View>
            <Text style={shared.resultLabel}>Станция (вдоль A→B)</Text>
            <Text style={shared.resultValue}>{res.station.toFixed(3)} м</Text>
          </View>
          <View>
            <Text style={shared.resultLabel}>Смещение ({res.offset >= 0 ? 'справа' : 'слева'})</Text>
            <Text style={shared.resultValue}>{Math.abs(res.offset).toFixed(3)} м</Text>
          </View>
          <View>
            <Text style={shared.resultLabel}>Основание</Text>
            <Text style={shared.resultValue}>N {res.foot.n.toFixed(3)} · E {res.foot.e.toFixed(3)}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
