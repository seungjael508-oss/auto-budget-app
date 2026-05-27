import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTransactions } from '../hooks/useTransactions'
import { Transaction } from '../types'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'
import { formatDateLabel, formatKRW } from '../lib/format'
import Card from '../components/ui/Card'
import Screen from '../components/ui/Screen'
import TopBar from '../components/ui/TopBar'
import TransactionRow from '../components/ui/TransactionRow'

const filters = ['전체', '검수 대기', '완료'] as const
type Filter = typeof filters[number]

export default function TransactionListScreen() {
  const { transactions, categories, loading, refresh } = useTransactions()
  const [filter, setFilter] = useState<Filter>('전체')

  const filtered = useMemo(() => {
    if (filter === '검수 대기') return transactions.filter(item => item.status === 'pending_review')
    if (filter === '완료') return transactions.filter(item => item.status !== 'pending_review')
    return transactions
  }, [filter, transactions])

  const sections = useMemo(() => {
    const map = new Map<string, Transaction[]>()
    filtered.forEach(item => {
      const key = item.transaction_at.slice(0, 10)
      map.set(key, [...(map.get(key) ?? []), item])
    })

    return Array.from(map.entries()).map(([date, data]) => ({
      title: date,
      total: data.filter(item => item.amount < 0).reduce((sum, item) => sum + Math.abs(item.amount), 0),
      data,
    }))
  }, [filtered])

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <>
      <TopBar title="거래 목록" subtitle="자동 수집된 소비 내역" />
      <Screen scroll={false} contentStyle={styles.screenContent}>
        <View style={styles.filterRow}>
          {filters.map(item => (
            <Pressable
              key={item}
              style={[styles.filterChip, filter === item && styles.filterChipActive]}
              onPress={() => setFilter(item)}
            >
              <Text style={[styles.filterText, filter === item && styles.filterTextActive]}>{item}</Text>
            </Pressable>
          ))}
        </View>

        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
          stickySectionHeadersEnabled={false}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          renderSectionHeader={({ section }) => (
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionDate}>{formatDateLabel(section.title)}</Text>
              <Text style={styles.sectionTotal}>-{formatKRW(section.total)}원</Text>
            </View>
          )}
          renderItem={({ item, index, section }) => (
            <Card style={[
              styles.rowCard,
              index === 0 ? styles.firstRow : undefined,
              index === section.data.length - 1 ? styles.lastRow : undefined,
            ]}>
              <TransactionRow transaction={item} categories={categories} />
            </Card>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>거래 내역이 없습니다</Text>
              <Text style={styles.emptyHint}>홈에서 CSV를 업로드하면 여기에 정리됩니다.</Text>
            </View>
          }
        />
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  screenContent: {
    flex: 1,
    paddingTop: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  filterRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingBottom: spacing.md,
  },
  filterChip: {
    height: 38,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceStrong,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    color: colors.muted,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
  },
  filterTextActive: {
    color: colors.white,
  },
  listContent: {
    paddingBottom: 96,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: spacing.lg,
    marginBottom: spacing.xs,
  },
  sectionDate: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.muted,
  },
  sectionTotal: {
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  rowCard: {
    paddingVertical: 0,
    borderRadius: 0,
    borderBottomWidth: 0,
  },
  firstRow: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
  lastRow: {
    borderBottomLeftRadius: radius.xl,
    borderBottomRightRadius: radius.xl,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 80,
  },
  emptyTitle: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  emptyHint: {
    marginTop: spacing.xs,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
})
