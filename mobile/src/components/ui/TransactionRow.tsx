import React from 'react'
import { Pressable, StyleSheet, Text, View } from 'react-native'
import { Transaction, Category } from '../../types'
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme'
import CategoryTag from './CategoryTag'

interface TransactionRowProps {
  transaction: Transaction
  categories: Category[]
  onPress?: () => void
}

export default function TransactionRow({ transaction, categories, onPress }: TransactionRowProps) {
  const category = categories.find(item => item.id === transaction.category_id)
  const isExpense = transaction.amount < 0
  const statusColor =
    transaction.status === 'pending_review'
      ? colors.warning
      : transaction.status === 'reviewed'
        ? colors.success
        : colors.primary

  return (
    <Pressable style={({ pressed }) => [styles.row, pressed && styles.pressed]} onPress={onPress}>
      <View style={[styles.dot, { backgroundColor: statusColor }]} />
      <View style={styles.body}>
        <View style={styles.topLine}>
          <Text style={styles.merchant} numberOfLines={1}>{transaction.merchant}</Text>
          <Text style={[styles.amount, { color: isExpense ? colors.gray900 : colors.success }]}>
            {isExpense ? '-' : '+'}{Math.abs(transaction.amount).toLocaleString()}원
          </Text>
        </View>
        <View style={styles.metaLine}>
          <CategoryTag name={category?.name ?? transaction.ai_category} icon={category?.icon} color={category?.color} />
          <Text style={styles.source}>{transaction.source}</Text>
        </View>
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
  },
  pressed: {
    opacity: 0.75,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 8,
  },
  body: {
    flex: 1,
    gap: spacing.xs,
  },
  topLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  merchant: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
    color: colors.gray900,
  },
  amount: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  metaLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  source: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
})
