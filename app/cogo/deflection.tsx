import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { space } from '../../src/theme/theme';
import { shared } from '../../src/theme/shared';
import { Button } from '../../src/components/ui';
import { NumField, parseNum } from '../../src/components/NumField';
import { deflectionAngle, fmtDms } from '../../src/lib/cogo';

/** Угол поворота трассы по входящему и исходящему азимутам. */
export default function DeflectionScreen() {
  const [azIn, setAzIn] = useState('');
  const [azOut, setAzOut] = useState('');
  const [res, setRes] = useState<number | null>(null);
  const [err, setErr] = useState('');

  const calc = () => {
    const a = parseNum(azIn); const b = parseNum(azOut);
    if (Number.isNaN(a) || Number.isNaN(b)) { setErr('Введите оба азимута.'); setRes(null); return; }
    setErr('');
    setRes(deflectionAngle(a, b));
  };

  return (
    <ScrollView style={shared.container} contentContainerStyle={shared.pad} keyboardShouldPersistTaps="handled">
      <Text style={shared.muted}>
        Угол поворота трассы: разность исходящего и входящего азимутов.
        Положительный — поворот вправо (по часовой), отрицательный — влево.
      </Text>
      <NumField label="Входящий азимут, °" value={azIn} onChange={setAzIn} />
      <NumField label="Исходящий азимут, °" value={azOut} onChange={setAzOut} />
      <Button label="Вычислить" onPress={calc} style={{ marginTop: space.lg }} />
      {!!err && <Text style={[shared.muted, { marginTop: space.md }]}>{err}</Text>}
      {res !== null && (
        <View style={shared.resultBox}>
          <View>
            <Text style={shared.resultLabel}>Угол поворота ({res >= 0 ? 'вправо' : 'влево'})</Text>
            <Text style={shared.resultValue}>{Math.abs(res).toFixed(4)}°</Text>
          </View>
          <View>
            <Text style={shared.resultLabel}>В градусах-минутах-секундах</Text>
            <Text style={shared.resultValue}>{fmtDms(Math.abs(res))}</Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
}
