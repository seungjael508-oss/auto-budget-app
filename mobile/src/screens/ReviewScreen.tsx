import React, { useState } from 'react'
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  Modal, ActivityIndicator, Alert,
} from 'react-native'
import { Swipeable } from 'react-native-gesture-handler'
import { useTransactions } from '../hooks/useTransactions'
import { Transaction, Category } from '../types'
import CategoryBadge from '../components/CategoryBadge'

// 카테고리 선택 모달
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
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>카테고리 선택</Text>
          {categories.map(cat => (
            <TouchableOpacity
              key={cat.id}
              style={styles.modalItem}
              onPress={() => onSelect(cat.id)}
            >
              <CategoryBadge name={cat.name} icon={cat.icon} color={cat.color} />
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.modalClose} onPress={onClose}>
            <Text style={styles.modalCloseText}>취소</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

// 스와이프 액션 버튼 (오른쪽 끝에 나타나는 녹색 "승인")
function RightAction({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionApprove} onPress={onPress}>
      <Text style={styles.actionText}>✅{'\n'}승인</Text>
    </TouchableOpacity>
  )
}

// 스와이프 액션 버튼 (왼쪽 끝에 나타나는 주황색 "분류")
function LeftAction({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.actionClassify} onPress={onPress}>
      <Text style={styles.actionText}>✏️{'\n'}분류 수정</Text>
    </TouchableOpacity>
  )
}

// 검수 대기 거래 카드
function ReviewCard({
  transaction,
  categories,
  onApprove,
  onChangeCategory,
}: {
  transaction: Transaction
  categories: Category[]
  onApprove: () => void
  onChangeCategory: () => void
}) {
  const category = categories.find(c => c.id === transaction.category_id)
  const dateStr = new Date(transaction.transaction_at).toLocaleDateString('ko-KR', {
    month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
  const confidencePct = transaction.confidence != null
    ? Math.round(transaction.confidence * 100) + '%'
    : '?'

  return (
    <Swipeable
      renderRightActions={() => <RightAction onPress={onApprove} />}
      renderLeftActions={() => <LeftAction onPress={onChangeCategory} />}
    >
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.merchant}>{transaction.merchant}</Text>
          <Text style={styles.date}>{dateStr}</Text>
          {category && (
            <CategoryBadge name={category.name} icon={category.icon} color={category.color} />
          )}
        </View>
        <View style={styles.cardRight}>
          <Text style={[styles.amount, transaction.amount < 0 ? styles.expense : styles.income]}>
            {transaction.amount < 0 ? '-' : '+'}{Math.abs(transaction.amount).toLocaleString()}원
          </Text>
          <Text style={styles.confidence}>신뢰도 {confidencePct}</Text>
        </View>
      </View>
    </Swipeable>
  )
}

export default function ReviewScreen() {
  const {
    transactions, categories, loading,
    approveTransaction, changeCategory, approveAllHighConfidence, refresh,
  } = useTransactions()

  const [modalVisible, setModalVisible] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [processing, setProcessing] = useState(false)

  // 검수 대기 목록만 표시
  const pendingTxs = transactions.filter(t => t.status === 'pending_review')

  const handleApprove = async (tx: Transaction) => {
    setProcessing(true)
    try {
      await approveTransaction(tx.id)
    } catch (e) {
      Alert.alert('오류', '승인 처리 중 오류가 발생했습니다')
    } finally {
      setProcessing(false)
    }
  }

  const handleOpenCategoryModal = (tx: Transaction) => {
    setSelectedTx(tx)
    setModalVisible(true)
  }

  const handleSelectCategory = async (catId: string) => {
    if (!selectedTx) return
    setModalVisible(false)
    setProcessing(true)
    try {
      await changeCategory(selectedTx.id, selectedTx.merchant, catId)
    } catch (e) {
      Alert.alert('오류', '카테고리 변경 중 오류가 발생했습니다')
    } finally {
      setProcessing(false)
      setSelectedTx(null)
    }
  }

  const handleApproveAll = async () => {
    const count = pendingTxs.filter(t => (t.confidence ?? 0) >= 0.80).length
    if (count === 0) {
      Alert.alert('알림', 'confidence 80% 이상인 거래가 없습니다')
      return
    }
    Alert.alert(
      '전체 승인',
      `confidence 80% 이상 ${count}건을 승인하시겠어요?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '승인', onPress: async () => {
            setProcessing(true)
            try {
              await approveAllHighConfidence()
            } finally {
              setProcessing(false)
            }
          }
        },
      ]
    )
  }

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#3B82F6" /></View>
  }

  if (pendingTxs.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>✅ 검수할 거래가 없습니다</Text>
        <Text style={styles.emptyHint}>모든 거래가 처리되었습니다</Text>
      </View>
    )
  }

  return (
    <View style={styles.container}>
      {/* 상단 배치 승인 버튼 */}
      <View style={styles.header}>
        <Text style={styles.headerText}>검수 대기 {pendingTxs.length}건</Text>
        <TouchableOpacity
          style={styles.batchBtn}
          onPress={handleApproveAll}
          disabled={processing}
        >
          <Text style={styles.batchBtnText}>confidence 80%+ 전체 승인</Text>
        </TouchableOpacity>
      </View>

      {processing && (
        <View style={styles.processingBar}>
          <Text style={styles.processingText}>처리 중...</Text>
        </View>
      )}

      <FlatList
        data={pendingTxs}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <ReviewCard
            transaction={item}
            categories={categories}
            onApprove={() => handleApprove(item)}
            onChangeCategory={() => handleOpenCategoryModal(item)}
          />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        onRefresh={refresh}
        refreshing={loading}
      />

      <CategoryModal
        visible={modalVisible}
        categories={categories.filter(c => c.is_system)}
        onSelect={handleSelectCategory}
        onClose={() => { setModalVisible(false); setSelectedTx(null) }}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f8f8' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyText: { fontSize: 18, color: '#10B981', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9CA3AF' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  headerText: { fontSize: 15, fontWeight: '600', color: '#111' },
  batchBtn: { backgroundColor: '#10B981', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 6 },
  batchBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  processingBar: { backgroundColor: '#FEF3C7', padding: 8, alignItems: 'center' },
  processingText: { color: '#92400E', fontSize: 13 },
  card: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', padding: 16, gap: 12,
  },
  cardLeft: { flex: 1, gap: 4 },
  cardRight: { alignItems: 'flex-end', gap: 4 },
  merchant: { fontSize: 15, fontWeight: '600', color: '#111' },
  date: { fontSize: 12, color: '#9CA3AF' },
  amount: { fontSize: 16, fontWeight: '700' },
  expense: { color: '#EF4444' },
  income: { color: '#10B981' },
  confidence: { fontSize: 11, color: '#9CA3AF' },
  separator: { height: 1, backgroundColor: '#f0f0f0' },
  actionApprove: {
    backgroundColor: '#10B981', justifyContent: 'center', alignItems: 'center',
    width: 72, paddingHorizontal: 8,
  },
  actionClassify: {
    backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center',
    width: 80, paddingHorizontal: 8,
  },
  actionText: { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20 },
  modalTitle: { fontSize: 17, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  modalItem: { paddingVertical: 10, paddingHorizontal: 4 },
  modalClose: { marginTop: 12, padding: 12, alignItems: 'center' },
  modalCloseText: { color: '#9CA3AF', fontSize: 15 },
})
