import React from 'react';
import { Pressable, Text, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { colors, space, radius, font } from '../theme/theme';

interface TileProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress?: () => void;
  disabled?: boolean;
  badge?: string;
  /** Метка «скоро» (напр. «Ф4») — плитка становится неактивной и приглушённой. */
  soon?: string;
}

/** Крупная плитка меню в стиле LandStar — 3 в ряд, под перчатки. */
export function Tile({ label, icon, onPress, disabled, badge, soon }: TileProps) {
  const off = disabled || !!soon;
  return (
    <Pressable
      onPress={() => {
        if (off || !onPress) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [styles.tile, { opacity: off ? 0.4 : pressed ? 0.8 : 1 }]}
    >
      <View style={styles.iconWrap}>
        <Ionicons name={icon} size={30} color={soon ? colors.textMuted : colors.accent} />
        {badge != null && (
          <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>
        )}
        {soon != null && (
          <View style={styles.soon}><Text style={styles.soonText}>{soon}</Text></View>
        )}
      </View>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: '31%',
    alignItems: 'center',
    marginBottom: space.xl,
  },
  iconWrap: {
    width: 72, height: 72,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  badge: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: colors.accent, borderRadius: radius.pill,
    minWidth: 22, height: 22, paddingHorizontal: 5,
    alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: colors.accentText, fontSize: 11, fontWeight: '800' },
  soon: {
    position: 'absolute', top: -6, right: -6,
    backgroundColor: colors.surfaceRaised, borderRadius: radius.pill,
    borderWidth: 1, borderColor: colors.borderStrong,
    minWidth: 22, height: 20, paddingHorizontal: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  soonText: { color: colors.textSecondary, fontSize: 10, fontWeight: '800', letterSpacing: 0.3 },
  label: {
    color: colors.textPrimary, fontSize: font.small,
    textAlign: 'center', marginTop: space.sm, lineHeight: 17,
  },
});
