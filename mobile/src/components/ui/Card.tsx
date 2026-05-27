import React from 'react'
import { Pressable, StyleProp, StyleSheet, View, ViewStyle } from 'react-native'
import { colors, radius, spacing } from '../../theme'

interface CardProps {
  children: React.ReactNode
  style?: StyleProp<ViewStyle>
  variant?: 'default' | 'soft' | 'primary'
  onPress?: () => void
}

export default function Card({ children, style, variant = 'default', onPress }: CardProps) {
  const cardStyle = [styles.base, styles[variant], style]

  if (onPress) {
    return (
      <Pressable style={({ pressed }) => [cardStyle, pressed && styles.pressed]} onPress={onPress}>
        {children}
      </Pressable>
    )
  }

  return <View style={cardStyle}>{children}</View>
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.xl,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
  },
  default: {
    backgroundColor: colors.surface,
  },
  soft: {
    backgroundColor: colors.surfaceStrong,
    borderColor: colors.surfaceStrong,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pressed: {
    opacity: 0.84,
  },
})
