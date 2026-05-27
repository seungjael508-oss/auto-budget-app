import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme'

interface ProgressBarProps {
  value?: number
  ratio?: number
  tone?: 'primary' | 'accent' | 'success' | 'warning' | 'danger'
  thickness?: number
  label?: string
  current?: string
  total?: string
}

export default function ProgressBar({
  value,
  ratio,
  tone = 'primary',
  thickness = 8,
  label,
  current,
  total,
}: ProgressBarProps) {
  const percent = value ?? ((ratio ?? 0) * 100)
  const clamped = Math.min(Math.max(percent, 0), 100)
  const fillColor = {
    primary: colors.primary,
    accent: colors.accent,
    success: colors.success,
    warning: colors.warning,
    danger: colors.danger,
  }[tone]

  return (
    <View style={styles.container}>
      {(label || current || total) && (
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label || current}</Text>
          <Text style={[styles.percent, { color: fillColor }]}>{Math.round(clamped)}%</Text>
        </View>
      )}
      <View style={[styles.track, { height: thickness }]}>
        <View style={[styles.fill, { width: `${clamped}%`, backgroundColor: fillColor }]} />
      </View>
      {(current || total) && (
        <View style={styles.subRow}>
          <Text style={styles.sub}>{current}</Text>
          <Text style={styles.sub}>{total}</Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    flex: 1,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  percent: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  track: {
    backgroundColor: colors.border,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: radius.full,
  },
  subRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sub: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
})
