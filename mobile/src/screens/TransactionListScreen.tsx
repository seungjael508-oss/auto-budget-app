import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useTransactions } from '../hooks/useTransactions'
import { Category, Transaction } from '../types'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'
import { formatDateLabel, formatKRW } from '../lib/format'
import Card from '../components/ui/Card'
import CategoryTag from '../components/ui/CategoryTag'
import { SecondaryButton } from '../components/ui/PrimaryButton'
import Screen from '../components/ui/Screen'
import TopBar from '../components/ui/TopBar'
import TransactionRow from '../components/ui/TransactionRow'

const filters = ['전체', '검수 대기', '완료'] as const
type Filter = typeof filters[number]

function CategorySheet({
  visible,
  transaction,
  categories,
  onSelect,
  onClose,
}: {
  visible: boolean
  transaction: Transaction | null
  categories: Category[]
  onSelect: (catId: string) => void
  onClose: () => void
}) {
  if (!transaction) return null

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={sheetStyles.backdrop} onPress={onClose} />
      <View style={sheetStyles.sheet}>
        <View style={sheetStyles.handle} />
        <Text style={sheetStyles.title}>{transaction.merchant}</Text>
        <Text style={sheetStyles.amount}>
          -{Math.abs(transaction.amount).toLocaleString()}원
        </Text>
        <Text style={sheetStyles.label}>카테고리 변경</Text>
        <View style={sheetStyles.grid}>
          {categories.filter(c => c.is_system).map(cat => (
            <Pressable
              key={cat.id}
              style={[
                sheetStyles.chip,
                transaction.category_id === cat.id && sheetStyles.chipSelected,
              ]}
              onPress={() => onSelect(cat.id)}
            >
              <CategoryTag
                name={cat.name}
                icon={cat.icon}
                color={transaction.category_id === cat.id ? cat.color : undefined}
              />
            </Pressable>
          ))}
        </View>
        <SecondaryButton label="닫기" onPress={onClose} size="md" style={{ marginTop: spacing.md }} />
      </View>
    </Modal>
  )
}

export default function TransactionListScreen() {
  const { transactions, categories, loading, refresh, changeCategory } = useTransactions()
  const [filter, setFilter] = useState<Filter>('전체')
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

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
              <TransactionRow
                transaction={item}
                categories={categories}
                onPress={() => setSelectedTx(item)}
              />
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

      <CategorySheet
        visible={selectedTx !== null}
        transaction={selectedTx}
        categories={categories}
        onSelect={async (catId) => {
          if (!selectedTx) return
          setSelectedTx(null)
          await changeCategory(selectedTx.id, selectedTx.merchant, catId)
        }}
        onClose={() => setSelectedTx(null)}
      />
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

const sheetStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.sm,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  amount: {
    fontSize: fontSize.base,
    color: colors.muted,
    marginTop: 2,
    marginBottom: spacing.lg,
  },
  label: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginBottom: spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
})
