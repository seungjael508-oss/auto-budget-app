import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { colors, fontSize, fontWeight, spacing } from '../../theme'

interface SectionHeaderProps {
  title: string
  meta?: string
  actionLabel?: string
  onActionPress?: () => void
}

export default function SectionHeader({ title, meta, actionLabel, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      {actionLabel && onActionPress ? (
        <Pressable onPress={onActionPress} hitSlop={8}>
          <Text style={styles.action}>{actionLabel}</Text>
        </Pressable>
      ) : meta ? (
        <Text style={styles.meta}>{meta}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  meta: {
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  action: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.primary,
  },
})
