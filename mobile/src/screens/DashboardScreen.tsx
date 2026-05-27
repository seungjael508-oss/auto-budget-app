import React, { useState } from 'react'
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native'
import { useDashboard } from '../hooks/useDashboard'
import BudgetRow from '../components/BudgetRow'
import GoalRow from '../components/GoalRow'

export default function DashboardScreen() {
  const now = new Date()
  const [year] = useState(now.getFullYear())
  const [month] = useState(now.getMonth() + 1)
  const { summaries, budgets, goals, loading, totalExpense, totalIncome, refresh } = useDashboard(year, month)

  if (loading) {
    return <View style={s.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
  }

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      {/* 이달 요약 */}
      <Text style={s.sectionTitle}>{year}년 {month}월</Text>
      <View style={s.summaryRow}>
        <View style={[s.summaryCard, { backgroundColor: '#FEF2F2' }]}>
          <Text style={s.summaryLabel}>총 지출</Text>
          <Text style={[s.summaryAmount, { color: '#EF4444' }]}>
            -{totalExpense.toLocaleString()}원
          </Text>
        </View>
        <View style={[s.summaryCard, { backgroundColor: '#ECFDF5' }]}>
          <Text style={s.summaryLabel}>총 수입</Text>
          <Text style={[s.summaryAmount, { color: '#10B981' }]}>
            +{totalIncome.toLocaleString()}원
          </Text>
        </View>
      </View>

      {/* 카테고리별 지출 */}
      <Text style={s.sectionTitle}>카테고리별 지출</Text>
      {summaries.filter(item => item.total_amount < 0).length === 0 ? (
        <Text style={s.empty}>이번 달 지출 내역이 없습니다</Text>
      ) : (
        summaries
          .filter(item => item.total_amount < 0)
          .sort((a, b) => a.total_amount - b.total_amount)  // 지출 많은 순
          .map(item => (
            <View key={item.id} style={s.categoryRow}>
              <Text style={s.categoryIcon}>{item.categories?.icon}</Text>
              <View style={s.categoryInfo}>
                <Text style={s.categoryName}>{item.categories?.name ?? '미분류'}</Text>
                <Text style={s.categoryCount}>{item.tx_count}건</Text>
              </View>
              <Text style={s.categoryAmount}>
                {Math.abs(item.total_amount).toLocaleString()}원
              </Text>
            </View>
          ))
      )}

      {/* 예산 소진율 */}
      <Text style={s.sectionTitle}>예산 소진율</Text>
      {budgets.length === 0 ? (
        <Text style={s.empty}>설정된 예산이 없습니다{'\n'}Supabase에서 budgets 테이블에 직접 추가하세요</Text>
      ) : (
        budgets.map(budget => {
          const matched = summaries.find(sum => sum.category_id === budget.category_id)
          return <BudgetRow key={budget.id} budget={budget} summary={matched} />
        })
      )}

      {/* 목표 진행률 */}
      <Text style={s.sectionTitle}>목표 진행률</Text>
      {goals.length === 0 ? (
        <Text style={s.empty}>설정된 목표가 없습니다{'\n'}Supabase에서 goals 테이블에 직접 추가하세요</Text>
      ) : (
        goals.map(goal => (
          <GoalRow key={goal.id} goal={goal} summaries={summaries} />
        ))
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#111', marginTop: 20, marginBottom: 12 },
  summaryRow: { flexDirection: 'row', gap: 12 },
  summaryCard: { flex: 1, borderRadius: 12, padding: 16 },
  summaryLabel: { fontSize: 13, color: '#666', marginBottom: 4 },
  summaryAmount: { fontSize: 20, fontWeight: '700' },
  categoryRow: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff',
    borderRadius: 8, padding: 12, marginBottom: 8, gap: 10,
  },
  categoryIcon: { fontSize: 24 },
  categoryInfo: { flex: 1 },
  categoryName: { fontSize: 14, fontWeight: '500', color: '#111' },
  categoryCount: { fontSize: 12, color: '#9CA3AF' },
  categoryAmount: { fontSize: 15, fontWeight: '600', color: '#EF4444' },
  empty: { color: '#9CA3AF', fontSize: 14, lineHeight: 22, backgroundColor: '#fff', padding: 16, borderRadius: 8 },
})
