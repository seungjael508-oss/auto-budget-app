import React from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native'
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme'

interface ButtonProps {
  label: string
  onPress: () => void
  loading?: boolean
  disabled?: boolean
  variant?: 'primary' | 'danger' | 'secondary' | 'ghost'
  size?: 'md' | 'lg'
  style?: ViewStyle | ViewStyle[]
}

export default function PrimaryButton({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  size = 'lg',
  style,
}: ButtonProps) {
  const isDisabled = disabled || loading
  const textStyle = [
    styles.label,
    variant === 'ghost' || variant === 'secondary' ? styles.darkLabel : styles.lightLabel,
  ]

  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        styles[size],
        styles[variant],
        isDisabled && styles.disabled,
        pressed && !isDisabled && styles.pressed,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.white : colors.primary} />
      ) : (
        <Text style={textStyle}>{label}</Text>
      )}
    </Pressable>
  )
}

export function SecondaryButton(props: Omit<ButtonProps, 'variant'>) {
  return <PrimaryButton {...props} variant="secondary" />
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  md: {
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  lg: {
    minHeight: 54,
    paddingVertical: spacing.md,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
  },
  secondary: {
    backgroundColor: colors.surfaceStrong,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.82,
  },
  label: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.semibold,
  },
  lightLabel: {
    color: colors.white,
  },
  darkLabel: {
    color: colors.gray900,
  },
})
