import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { Budget, MonthlySummary } from '../types'

interface BudgetRowProps {
  budget: Budget
  summary?: MonthlySummary  // 이 카테고리의 이번 달 소비
}

export default function BudgetRow({ budget, summary }: BudgetRowProps) {
  const spent = summary ? Math.abs(summary.total_amount) : 0
  const ratio = Math.min(spent / budget.amount, 1)  // 0~1 (100% 초과 시 1로 클램프)
  const pct = Math.round(ratio * 100)
  const overBudget = spent > budget.amount

  const cat = budget.categories
  return (
    <View style={styles.row}>
      <View style={styles.header}>
        <Text style={styles.label}>
          {cat?.icon} {cat?.name ?? '전체'}
        </Text>
        <Text style={[styles.pct, overBudget && styles.overPct]}>
          {spent.toLocaleString()}원 / {budget.amount.toLocaleString()}원 ({pct}%)
        </Text>
      </View>
      {/* 프로그레스 바 */}
      <View style={styles.track}>
        <View style={[
          styles.fill,
          { width: `${pct}%`, backgroundColor: overBudget ? '#EF4444' : (cat?.color ?? '#3B82F6') },
        ]} />
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { marginBottom: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  label: { fontSize: 14, fontWeight: '500', color: '#111' },
  pct: { fontSize: 12, color: '#666' },
  overPct: { color: '#EF4444', fontWeight: '600' },
  track: { height: 8, backgroundColor: '#F3F4F6', borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
})
