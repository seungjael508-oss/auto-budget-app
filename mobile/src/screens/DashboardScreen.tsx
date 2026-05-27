import React, { useMemo, useState } from 'react'
import { ActivityIndicator, RefreshControl, StyleSheet, Text, View } from 'react-native'
import { useDashboard } from '../hooks/useDashboard'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'
import { formatKRW } from '../lib/format'
import Card from '../components/ui/Card'
import ProgressBar from '../components/ui/ProgressBar'
import Screen from '../components/ui/Screen'
import SectionHeader from '../components/ui/SectionHeader'
import TopBar from '../components/ui/TopBar'

export default function DashboardScreen() {
  const now = new Date()
  const [year] = useState(now.getFullYear())
  const [month] = useState(now.getMonth() + 1)
  const { summaries, budgets, goals, loading, totalExpense, totalIncome, refresh } = useDashboard(year, month)

  const monthBudget = useMemo(
    () => budgets.reduce((sum, item) => sum + item.amount, 0) || 1_500_000,
    [budgets],
  )
  const burnRate = Math.min((totalExpense / monthBudget) * 100, 100)
  const expenseSummaries = summaries
    .filter(item => item.total_amount < 0)
    .sort((a, b) => Math.abs(b.total_amount) - Math.abs(a.total_amount))
  const totalBreakdown = expenseSummaries.reduce((sum, item) => sum + Math.abs(item.total_amount), 0)
  const maxAmount = Math.max(...expenseSummaries.map(item => Math.abs(item.total_amount)), 1)

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <>
      <TopBar title="대시보드" subtitle={`${year}년 ${month}월 리포트`} />
      <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}>
        <View style={styles.summaryGrid}>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>이번 달 수입</Text>
            <Text style={[styles.summaryValue, { color: colors.success }]}>+{formatKRW(totalIncome)}</Text>
          </Card>
          <Card style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>이번 달 지출</Text>
            <Text style={styles.summaryValue}>{formatKRW(totalExpense)}</Text>
          </Card>
        </View>

        <Card style={styles.budgetCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>예산 소진율</Text>
            <Text style={styles.rate}>{Math.round(burnRate)}%</Text>
          </View>
          <View style={styles.progressWrap}>
            <ProgressBar value={burnRate} tone={burnRate > 90 ? 'danger' : burnRate > 75 ? 'warning' : 'primary'} thickness={10} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.muted}>{formatKRW(totalExpense)}원 사용</Text>
            <Text style={styles.muted}>예산 {formatKRW(monthBudget)}원</Text>
          </View>
        </Card>

        <SectionHeader title="카테고리 비중" />
        {expenseSummaries.length === 0 ? (
          <Card>
            <Text style={styles.empty}>이번 달 지출 내역이 없습니다.</Text>
          </Card>
        ) : (
          <Card style={styles.breakdownCard}>
            <View style={styles.stackBar}>
              {expenseSummaries.map(item => {
                const amount = Math.abs(item.total_amount)
                return (
                  <View
                    key={item.id}
                    style={[
                      styles.stackSegment,
                      {
                        width: `${(amount / Math.max(totalBreakdown, 1)) * 100}%`,
                        backgroundColor: item.categories?.color ?? colors.gray400,
                      },
                    ]}
                  />
                )
              })}
            </View>
            {expenseSummaries.map(item => {
              const amount = Math.abs(item.total_amount)
              const pct = (amount / Math.max(totalBreakdown, 1)) * 100
              return (
                <View key={item.id} style={styles.breakdownRow}>
                  <View style={styles.breakdownName}>
                    <Text style={styles.categoryIcon}>{item.categories?.icon ?? '•'}</Text>
                    <Text style={styles.categoryName}>{item.categories?.name ?? '미분류'}</Text>
                  </View>
                  <View style={styles.breakdownAmount}>
                    <Text style={styles.percent}>{Math.round(pct)}%</Text>
                    <Text style={styles.amount}>{formatKRW(amount)}원</Text>
                  </View>
                </View>
              )
            })}
          </Card>
        )}

        <SectionHeader title="지출 막대" />
        <Card style={styles.chartCard}>
          {expenseSummaries.slice(0, 6).map(item => {
            const amount = Math.abs(item.total_amount)
            return (
              <View key={item.id} style={styles.barRow}>
                <Text style={styles.barLabel}>{item.categories?.name ?? '미분류'}</Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        width: `${(amount / maxAmount) * 100}%`,
                        backgroundColor: item.categories?.color ?? colors.primary,
                      },
                    ]}
                  />
                </View>
              </View>
            )
          })}
          {expenseSummaries.length === 0 ? <Text style={styles.empty}>표시할 데이터가 없습니다.</Text> : null}
        </Card>

        <SectionHeader title="목표 달성률" />
        {goals.length === 0 ? (
          <Card>
            <Text style={styles.empty}>설정된 목표가 없습니다.</Text>
          </Card>
        ) : (
          goals.map(goal => {
            // 카테고리별 달성 금액: category_id가 있으면 해당 카테고리 지출, 없으면 전체 지출
            const currentAmount = goal.category_id
              ? Math.abs(summaries.find(s => s.category_id === goal.category_id)?.total_amount ?? 0)
              : totalExpense
            const rate = Math.min(Math.round((currentAmount / goal.target_amount) * 100), 100)

            return (
              <Card key={goal.id} style={styles.goalCard}>
                <View style={styles.rowBetween}>
                  <Text style={styles.goalTitle}>{goal.title}</Text>
                  <Text style={styles.goalRate}>{rate}%</Text>
                </View>
                <View style={styles.progressWrap}>
                  <ProgressBar
                    value={rate}
                    tone="accent"
                    current={`${formatKRW(currentAmount)}원`}
                    total={`${formatKRW(goal.target_amount)}원`}
                  />
                </View>
              </Card>
            )
          })
        )}
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.lg,
  },
  summaryLabel: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  summaryValue: {
    marginTop: spacing.xs,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  budgetCard: {
    marginBottom: spacing.sm,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  rate: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  progressWrap: {
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
  muted: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  breakdownCard: {
    gap: spacing.md,
  },
  stackBar: {
    flexDirection: 'row',
    height: 12,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  stackSegment: {
    height: '100%',
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  breakdownName: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  categoryIcon: {
    fontSize: fontSize.base,
  },
  categoryName: {
    fontSize: fontSize.md,
    color: colors.gray900,
  },
  breakdownAmount: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  percent: {
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  amount: {
    minWidth: 86,
    textAlign: 'right',
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  chartCard: {
    gap: spacing.sm,
  },
  barRow: {
    gap: spacing.xs,
  },
  barLabel: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  barTrack: {
    height: 12,
    overflow: 'hidden',
    borderRadius: radius.full,
    backgroundColor: colors.border,
  },
  barFill: {
    height: '100%',
    borderRadius: radius.full,
  },
  goalCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
  },
  goalTitle: {
    flex: 1,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  goalRate: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.accent,
  },
  empty: {
    fontSize: fontSize.md,
    lineHeight: 21,
    color: colors.muted,
  },
})
