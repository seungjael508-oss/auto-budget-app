import React from 'react'
import { RefreshControlProps, SafeAreaView, ScrollView, StyleSheet, View, ViewStyle } from 'react-native'
import { colors, spacing } from '../../theme'

interface ScreenProps {
  children: React.ReactNode
  scroll?: boolean
  style?: ViewStyle | ViewStyle[]
  contentStyle?: ViewStyle | ViewStyle[]
  refreshControl?: React.ReactElement<RefreshControlProps>
}

export default function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  refreshControl,
}: ScreenProps) {
  return (
    <SafeAreaView style={[styles.safe, style]}>
      {scroll ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fixed, contentStyle]}>{children}</View>
      )}
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    paddingBottom: 96,
  },
  fixed: {
    flex: 1,
  },
})
