import React from 'react'
import { View, Text, StyleSheet } from 'react-native'

interface CategoryBadgeProps {
  name: string
  icon: string
  color: string
}

export default function CategoryBadge({ name, icon, color }: CategoryBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: color + '20' }]}>
      <Text style={styles.icon}>{icon}</Text>
      <Text style={[styles.name, { color }]}>{name}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12,
  },
  icon: { fontSize: 12 },
  name: { fontSize: 12, fontWeight: '500' },
})
