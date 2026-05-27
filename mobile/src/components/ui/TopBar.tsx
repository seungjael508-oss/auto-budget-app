import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { colors, fontSize, fontWeight, spacing } from '../../theme'

interface TopBarProps {
  title: string
  subtitle?: string
  rightLabel?: string
  onRightPress?: () => void
}

export default function TopBar({ title, subtitle, rightLabel, onRightPress }: TopBarProps) {
  return (
    <SafeAreaView edges={['top']} style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.titleWrap}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {rightLabel && onRightPress ? (
          <Pressable style={({ pressed }) => [styles.action, pressed && styles.pressed]} onPress={onRightPress}>
            <Text style={styles.actionText}>{rightLabel}</Text>
          </Pressable>
        ) : (
          <View style={styles.placeholder} />
        )}
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    backgroundColor: colors.background,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
    backgroundColor: colors.background,
  },
  titleWrap: {
    flex: 1,
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  action: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
  },
  actionText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
  pressed: {
    opacity: 0.75,
  },
  placeholder: {
    width: 1,
  },
})
