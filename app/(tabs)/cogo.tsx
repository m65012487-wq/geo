import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, space, font } from '../../src/theme/theme';
import { shared } from '../../src/theme/shared';
import { Tile } from '../../src/components/Tile';

export default function CogoScreen() {
  const router = useRouter();
  return (
    <ScrollView style={shared.container} contentContainerStyle={shared.pad}>
      <Text style={styles.hint}>
        Геодезические калькуляторы. Работают с плоскими координатами N/E (метры).
      </Text>
      <Text style={styles.group}>Задачи</Text>
      <View style={styles.grid}>
        <Tile label="ПГЗ (прямая)" icon="arrow-forward-circle" onPress={() => router.push('/cogo/pgz')} />
        <Tile label="ОГЗ (обратная)" icon="swap-horizontal" onPress={() => router.push('/cogo/ogz')} />
        <Tile label="Площадь" icon="square-outline" onPress={() => router.push('/cogo/area')} />
        <Tile label="Углы ГМС" icon="pie-chart-outline" onPress={() => router.push('/cogo/angles')} />
        <Tile label="Осреднение" icon="stats-chart" onPress={() => router.push('/cogo/average')} />
      </View>

      <Text style={styles.group}>Засечки и трассы</Text>
      <View style={styles.grid}>
        <Tile label="Линейная засечка" icon="git-compare-outline" onPress={() => router.push('/cogo/resection-distance')} />
        <Tile label="Прямая засечка" icon="navigate-outline" onPress={() => router.push('/cogo/resection-bearing')} />
        <Tile label="Проекция на линию" icon="git-pull-request-outline" onPress={() => router.push('/cogo/offset')} />
        <Tile label="Деление отрезка" icon="apps-outline" onPress={() => router.push('/cogo/divide')} />
        <Tile label="Угол поворота" icon="return-up-forward-outline" onPress={() => router.push('/cogo/deflection')} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.textMuted, fontSize: font.small, marginBottom: space.lg, lineHeight: 19 },
  group: {
    color: colors.textSecondary, fontSize: font.small, fontWeight: '700',
    letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: space.md,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 12 },
});
