import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { useTransactions } from '../hooks/useTransactions'
import { Category, Transaction } from '../types'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'
import { formatDateTime, formatKRW } from '../lib/format'
import Card from '../components/ui/Card'
import CategoryTag from '../components/ui/CategoryTag'
import PrimaryButton, { SecondaryButton } from '../components/ui/PrimaryButton'
import ProgressBar from '../components/ui/ProgressBar'
import Screen from '../components/ui/Screen'
import TopBar from '../components/ui/TopBar'

function CategoryModal({
  visible,
  categories,
  onSelect,
  onClose,
}: {
  visible: boolean
  categories: Category[]
  onSelect: (catId: string) => void
  onClose: () => void
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>카테고리 확인</Text>
          <View style={styles.categoryGrid}>
            {categories.map(cat => (
              <Pressable key={cat.id} style={styles.categoryButton} onPress={() => onSelect(cat.id)}>
                <CategoryTag name={cat.name} icon={cat.icon} color={cat.color} />
              </Pressable>
            ))}
          </View>
          <SecondaryButton label="닫기" onPress={onClose} size="md" />
        </View>
      </View>
    </Modal>
  )
}

function ReviewCard({
  transaction,
  category,
  onApprove,
  onChangeCategory,
}: {
  transaction: Transaction
  category?: Category
  onApprove: () => void
  onChangeCategory: () => void
}) {
  const confidencePct = transaction.confidence != null ? Math.round(transaction.confidence * 100) : null

  return (
    <Swipeable
      renderRightActions={() => (
        <Pressable style={styles.swipeApprove} onPress={onApprove}>
          <Text style={styles.swipeText}>승인</Text>
        </Pressable>
      )}
      renderLeftActions={() => (
        <Pressable style={styles.swipeEdit} onPress={onChangeCategory}>
          <Text style={styles.swipeText}>분류</Text>
        </Pressable>
      )}
    >
      <Card style={styles.reviewItem}>
        <View style={styles.rowBetween}>
          <View style={styles.flex}>
            <Text style={styles.merchant}>{transaction.merchant}</Text>
            <Text style={styles.muted}>{formatDateTime(transaction.transaction_at)} · {transaction.source}</Text>
          </View>
          <Text style={styles.amount}>-{formatKRW(Math.abs(transaction.amount))}원</Text>
        </View>
        <View style={styles.reviewMeta}>
          <CategoryTag name={category?.name ?? transaction.ai_category} icon={category?.icon} color={category?.color} />
          <Text style={styles.confidence}>신뢰도 {confidencePct ?? '?'}%</Text>
        </View>
        <View style={styles.reviewActions}>
          <SecondaryButton label="분류 수정" onPress={onChangeCategory} size="md" style={styles.actionButton} />
          <PrimaryButton label="맞아요, 승인" onPress={onApprove} size="md" style={styles.actionButton} />
        </View>
      </Card>
    </Swipeable>
  )
}

export default function ReviewScreen() {
  const {
    transactions,
    categories,
    loading,
    approveTransaction,
    changeCategory,
    approveAllHighConfidence,
    refresh,
  } = useTransactions()
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  const pendingTxs = useMemo(
    () => transactions.filter(item => item.status === 'pending_review'),
    [transactions],
  )
  const highConfidenceCount = pendingTxs.filter(item => (item.confidence ?? 0) >= 0.8).length
  const total = pendingTxs.reduce((sum, item) => sum + Math.abs(item.amount), 0)

  const handleApprove = async (tx: Transaction) => {
    // optimistic UI: useTransactions에서 즉시 제거
    try {
      await approveTransaction(tx.id)
    } catch {
      Alert.alert('오류', '승인 처리 중 오류가 발생했습니다')
    }
  }

  const handleSelectCategory = async (catId: string) => {
    if (!selectedTx) return
    setModalVisible(false)
    setSelectedTx(null)
    try {
      await changeCategory(selectedTx.id, selectedTx.merchant, catId)
    } catch {
      Alert.alert('오류', '카테고리 변경 중 오류가 발생했습니다')
    }
  }

  const handleApproveAll = async () => {
    if (highConfidenceCount === 0) {
      Alert.alert('알림', '신뢰도 80% 이상인 거래가 없습니다')
      return
    }

    Alert.alert('한 번에 승인', `신뢰도 80% 이상 ${highConfidenceCount}건을 승인할까요?`, [
      { text: '취소', style: 'cancel' },
      {
        text: '승인',
        onPress: () => {
          // optimistic UI: useTransactions에서 즉시 일괄 제거
          approveAllHighConfidence()
        },
      },
    ])
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={colors.primary} /></View>
  }

  return (
    <>
      <TopBar title="주간 검수" subtitle="애매한 거래만 빠르게 확인" />
      <Screen refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />} contentStyle={styles.content}>
        <Card variant="soft" style={styles.summaryCard}>
          <View style={styles.rowBetween}>
            <Text style={styles.muted}>검수 대기</Text>
            <Text style={styles.summaryMeta}>{pendingTxs.length}건</Text>
          </View>
          <View style={styles.totalLine}>
            <Text style={styles.totalAmount}>{formatKRW(total)}</Text>
            <Text style={styles.muted}>원 확인 필요</Text>
          </View>
          <View style={styles.progressWrap}>
            <ProgressBar value={pendingTxs.length === 0 ? 100 : 0} tone={pendingTxs.length === 0 ? 'success' : 'primary'} />
          </View>
        </Card>

        {pendingTxs.length > 0 ? (
          <View style={styles.batchWrap}>
            <SecondaryButton
              label={`신뢰도 80%+ ${highConfidenceCount}건 한 번에 승인`}
              onPress={handleApproveAll}
              size="md"
            />
          </View>
        ) : null}

        {pendingTxs.length === 0 ? (
          <Card style={styles.doneCard}>
            <Text style={styles.doneIcon}>완료</Text>
            <Text style={styles.doneTitle}>이번 주 검수 끝!</Text>
            <Text style={styles.muted}>다음 주 일요일에 다시 찾아올게요.</Text>
          </Card>
        ) : (
          pendingTxs.map(tx => {
            const category = categories.find(item => item.id === tx.category_id)
            return (
              <ReviewCard
                key={tx.id}
                transaction={tx}
                category={category}
                onApprove={() => handleApprove(tx)}
                onChangeCategory={() => {
                  setSelectedTx(tx)
                  setModalVisible(true)
                }}
              />
            )
          })
        )}

        <CategoryModal
          visible={modalVisible}
          categories={categories.filter(item => item.is_system)}
          onSelect={handleSelectCategory}
          onClose={() => {
            setModalVisible(false)
            setSelectedTx(null)
          }}
        />
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
  content: {
    gap: spacing.md,
  },
  summaryCard: {
    marginBottom: spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  flex: {
    flex: 1,
  },
  muted: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.muted,
  },
  summaryMeta: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  totalLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.md,
  },
  totalAmount: {
    fontSize: 26,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  progressWrap: {
    marginTop: spacing.md,
  },
  batchWrap: {
    marginBottom: spacing.xs,
  },
  reviewItem: {
    gap: spacing.md,
  },
  merchant: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  amount: {
    fontSize: fontSize.base,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  reviewMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  confidence: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionButton: {
    flex: 1,
  },
  swipeApprove: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.success,
  },
  swipeEdit: {
    width: 88,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: spacing.xs,
    borderRadius: radius.lg,
    backgroundColor: colors.warning,
  },
  swipeText: {
    color: colors.white,
    fontSize: fontSize.sm,
    fontWeight: fontWeight.bold,
  },
  doneCard: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm,
  },
  doneIcon: {
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.success,
  },
  doneTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(17, 24, 39, 0.28)',
  },
  modalBox: {
    padding: spacing.xl,
    gap: spacing.md,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    backgroundColor: colors.surface,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryButton: {
    paddingVertical: spacing.xs,
  },
})
