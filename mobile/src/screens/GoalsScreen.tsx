import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator,
  RefreshControl, ScrollView,
} from 'react-native'
import { useDashboard } from '../hooks/useDashboard'
import { colors, fontSize, fontWeight, spacing, radius } from '../theme'
import Card from '../components/ui/Card'
import SectionHeader from '../components/ui/SectionHeader'
import ProgressBar from '../components/ui/ProgressBar'

export default function GoalsScreen() {
  const now = new Date()
  const [year]  = useState(now.getFullYear())
  const [month] = useState(now.getMonth() + 1)

  const { goals, summaries, budgets, loading, totalExpense, refresh } = useDashboard(year, month)

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  // 목표 진행률 계산
  const goalItems = goals.map(goal => {
    let spent = 0
    if (goal.category_id === null) {
      // 전체 지출 목표
      spent = totalExpense
    } else {
      const matched = summaries.find(sum => sum.category_id === goal.category_id)
      spent = matched ? Math.abs(matched.total_amount) : 0
    }
    const ratio = goal.target_amount > 0 ? spent / goal.target_amount : 0
    return { ...goal, spent, ratio }
  })

  // 예산 진행률 계산
  const budgetItems = budgets.map(budget => {
    const matched = summaries.find(sum => sum.category_id === budget.category_id)
    const spent = matched ? Math.abs(matched.total_amount) : 0
    const ratio = budget.amount > 0 ? spent / budget.amount : 0
    return { ...budget, spent, ratio }
  })

  return (
    <ScrollView
      style={s.container}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
    >
      {/* 이달 요약 카드 */}
      <Card style={s.summaryCard}>
        <Text style={s.summaryMonth}>{year}년 {month}월</Text>
        <View style={s.summaryRow}>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>총 지출</Text>
            <Text style={[s.summaryValue, { color: colors.danger }]}>
              {totalExpense.toLocaleString()}원
            </Text>
          </View>
          <View style={s.divider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>진행 목표</Text>
            <Text style={s.summaryValue}>{goalItems.length}개</Text>
          </View>
          <View style={s.divider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>달성 중</Text>
            <Text style={[s.summaryValue, { color: colors.success }]}>
              {goalItems.filter(g => g.ratio <= 1).length}개
            </Text>
          </View>
        </View>
      </Card>

      {/* 절약 목표 */}
      <SectionHeader title="절약 목표" meta={`${goalItems.length}개`} />
      {goalItems.length === 0 ? (
        <Card>
          <Text style={s.empty}>설정된 목표가 없습니다</Text>
          <Text style={s.emptySub}>Supabase goals 테이블에서 추가하세요</Text>
        </Card>
      ) : (
        goalItems.map(goal => (
          <Card key={goal.id} style={s.itemCard}>
            <View style={s.itemHeader}>
              <Text style={s.itemIcon}>
                {goal.categories?.icon ?? '🎯'}
              </Text>
              <View style={s.itemInfo}>
                <Text style={s.itemTitle}>{goal.title}</Text>
                <Text style={s.itemSub}>
                  {goal.categories?.name ?? '전체 지출'} · {goal.period === 'monthly' ? '월간' : '주간'}
                </Text>
              </View>
              {/* 달성/초과 배지 */}
              {goal.ratio > 1 ? (
                <View style={[s.badge, { backgroundColor: colors.dangerLight }]}>
                  <Text style={[s.badgeText, { color: colors.danger }]}>초과</Text>
                </View>
              ) : goal.ratio >= 0.8 ? (
                <View style={[s.badge, { backgroundColor: colors.warningLight }]}>
                  <Text style={[s.badgeText, { color: colors.warning }]}>주의</Text>
                </View>
              ) : (
                <View style={[s.badge, { backgroundColor: colors.successLight }]}>
                  <Text style={[s.badgeText, { color: colors.success }]}>달성 중</Text>
                </View>
              )}
            </View>
            <View style={s.progressWrap}>
              <ProgressBar
                label=""
                ratio={goal.ratio}
                current={`${goal.spent.toLocaleString()}원 지출`}
                total={`목표 ${goal.target_amount.toLocaleString()}원`}
              />
            </View>
          </Card>
        ))
      )}

      {/* 예산 현황 */}
      <SectionHeader title="예산 현황" meta={`${budgetItems.length}개`} />
      {budgetItems.length === 0 ? (
        <Card>
          <Text style={s.empty}>설정된 예산이 없습니다</Text>
          <Text style={s.emptySub}>Supabase budgets 테이블에서 추가하세요</Text>
        </Card>
      ) : (
        budgetItems.map(budget => (
          <Card key={budget.id} style={s.itemCard}>
            <View style={s.itemHeader}>
              <Text style={s.itemIcon}>{budget.categories?.icon ?? '💰'}</Text>
              <Text style={s.itemTitle}>{budget.categories?.name ?? '미분류'}</Text>
            </View>
            <View style={s.progressWrap}>
              <ProgressBar
                label=""
                ratio={budget.ratio}
                current={`${budget.spent.toLocaleString()}원`}
                total={`예산 ${budget.amount.toLocaleString()}원`}
              />
            </View>
          </Card>
        ))
      )}
    </ScrollView>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: colors.gray50 },
  content:     { padding: spacing.lg, paddingBottom: 40, gap: spacing.sm },
  center:      { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // 요약 카드
  summaryCard:  { marginBottom: spacing.sm },
  summaryMonth: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.gray700, marginBottom: spacing.md },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem:  { alignItems: 'center', gap: 4 },
  summaryLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.gray900 },
  divider:      { width: 1, backgroundColor: colors.gray200 },

  // 목표/예산 카드
  itemCard:   { marginBottom: spacing.sm },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  itemIcon:   { fontSize: 22 },
  itemInfo:   { flex: 1 },
  itemTitle:  { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.gray900 },
  itemSub:    { fontSize: fontSize.sm, color: colors.gray500 },
  progressWrap: { marginTop: spacing.xs },

  // 배지
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  // 빈 상태
  empty:    { fontSize: fontSize.base, color: colors.gray500, marginBottom: spacing.xs },
  emptySub: { fontSize: fontSize.sm, color: colors.gray400 },
})
