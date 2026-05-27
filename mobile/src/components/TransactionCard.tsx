import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Transaction, Category } from '../types'
import CategoryBadge from './CategoryBadge'

interface TransactionCardProps {
  transaction: Transaction
  categories: Category[]
}

export default function TransactionCard({ transaction, categories }: TransactionCardProps) {
  const category = categories.find(c => c.id === transaction.category_id)
  const isExpense = transaction.amount < 0
  const dateStr = new Date(transaction.transaction_at).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric',
  })

  return (
    <View style={styles.card}>
      <View style={styles.left}>
        <Text style={styles.merchant}>{transaction.merchant}</Text>
        <View style={styles.row}>
          {category && (
            <CategoryBadge name={category.name} icon={category.icon} color={category.color} />
          )}
          <Text style={styles.date}>{dateStr}</Text>
        </View>
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, isExpense ? styles.expense : styles.income]}>
          {isExpense ? '-' : '+'}{Math.abs(transaction.amount).toLocaleString()}원
        </Text>
        {transaction.status === 'pending_review' && (
          <Text style={styles.pending}>검수 대기</Text>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 12, paddingHorizontal: 16,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  left: { flex: 1, gap: 4 },
  right: { alignItems: 'flex-end', gap: 2 },
  merchant: { fontSize: 15, fontWeight: '500', color: '#111' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  date: { fontSize: 12, color: '#9CA3AF' },
  amount: { fontSize: 16, fontWeight: '600' },
  expense: { color: '#EF4444' },
  income: { color: '#10B981' },
  pending: { fontSize: 11, color: '#F59E0B' },
})
