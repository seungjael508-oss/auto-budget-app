import React from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { categoryColors, colors, fontSize, fontWeight, radius, spacing } from '../../theme'

interface CategoryTagProps {
  name?: string | null
  icon?: string | null
  color?: string | null
}

export default function CategoryTag({ name, icon, color }: CategoryTagProps) {
  const label = name || '미분류'
  const tone = color || categoryColors[label] || colors.gray400

  return (
    <View style={[styles.container, { backgroundColor: `${tone}18` }]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, { color: tone }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.full,
  },
  icon: {
    fontSize: fontSize.xs,
  },
  label: {
    fontSize: fontSize.xs,
    fontWeight: fontWeight.semibold,
  },
})
