import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ActivityIndicator, RefreshControl,
  ScrollView, Modal, TextInput, Pressable, Alert, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useDashboard } from '../hooks/useDashboard'
import { useBudget } from '../hooks/useBudget'
import { useGoal } from '../hooks/useGoal'
import { Budget, Category, Goal } from '../types'
import { colors, fontSize, fontWeight, spacing, radius } from '../theme'
import { formatKRW } from '../lib/format'
import Card from '../components/ui/Card'
import SectionHeader from '../components/ui/SectionHeader'
import ProgressBar from '../components/ui/ProgressBar'
import PrimaryButton, { SecondaryButton } from '../components/ui/PrimaryButton'

// ─── 예산 생성/편집 모달 ────────────────────────────────────────────────────────

interface BudgetModalProps {
  visible: boolean
  categories: Category[]
  editing: Budget | null   // null이면 신규 생성, 값 있으면 수정
  onSave: (categoryId: string, amount: number) => Promise<void>
  onClose: () => void
}

function BudgetModal({ visible, categories, editing, onSave, onClose }: BudgetModalProps) {
  const [selectedCatId, setSelectedCatId] = useState<string>(
    editing?.category_id ?? categories[0]?.id ?? '',
  )
  const [amountText, setAmountText] = useState<string>(
    editing ? String(editing.amount) : '',
  )
  const [saving, setSaving] = useState(false)

  // 모달이 열릴 때마다 초기값 재설정
  React.useEffect(() => {
    if (visible) {
      setSelectedCatId(editing?.category_id ?? categories[0]?.id ?? '')
      setAmountText(editing ? String(editing.amount) : '')
    }
  }, [visible, editing, categories])

  const handleSave = async () => {
    const amount = parseInt(amountText.replace(/,/g, ''), 10)
    if (!selectedCatId) {
      Alert.alert('알림', '카테고리를 선택하세요')
      return
    }
    if (!amount || amount <= 0) {
      Alert.alert('알림', '올바른 금액을 입력하세요')
      return
    }
    setSaving(true)
    try {
      await onSave(selectedCatId, amount)
      onClose()
    } catch {
      Alert.alert('오류', '저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  // 숫자 입력 시 천 단위 구분 포맷팅
  const handleAmountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '')
    setAmountText(digits ? Number(digits).toLocaleString() : '')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.modalWrapper}
      >
        <Pressable style={s.modalDim} onPress={onClose} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>
            {editing ? '예산 수정' : '예산 추가'}
          </Text>

          {/* 카테고리 선택 */}
          <Text style={s.fieldLabel}>카테고리</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
            {categories.map(cat => {
              const active = cat.id === selectedCatId
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCatId(cat.id)}
                  style={[s.catChip, active && s.catChipActive]}
                >
                  <Text style={s.catIcon}>{cat.icon}</Text>
                  <Text style={[s.catName, active && s.catNameActive]}>{cat.name}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {/* 금액 입력 */}
          <Text style={s.fieldLabel}>월 예산 금액</Text>
          <View style={s.amountRow}>
            <TextInput
              style={s.amountInput}
              value={amountText}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              placeholder="예: 300,000"
              placeholderTextColor={colors.gray400}
              returnKeyType="done"
            />
            <Text style={s.amountUnit}>원</Text>
          </View>

          {/* 버튼 */}
          <View style={s.modalActions}>
            <SecondaryButton label="취소" onPress={onClose} size="md" style={s.actionBtn} />
            <PrimaryButton
              label="저장"
              onPress={handleSave}
              loading={saving}
              size="md"
              style={s.actionBtn}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── 목표 생성/편집 모달 ────────────────────────────────────────────────────────

interface GoalModalProps {
  visible: boolean
  categories: Category[]
  editing: Goal | null
  onSave: (params: {
    title: string
    categoryId: string | null
    targetAmount: number
    period: 'monthly' | 'weekly'
  }) => Promise<void>
  onClose: () => void
}

function GoalModal({ visible, categories, editing, onSave, onClose }: GoalModalProps) {
  const [title, setTitle] = useState(editing?.title ?? '')
  // null = 전체 지출, '' = 미선택 상태 없이 기본은 전체 지출
  const [selectedCatId, setSelectedCatId] = useState<string | null>(editing?.category_id ?? null)
  const [amountText, setAmountText] = useState(editing ? String(editing.target_amount) : '')
  const [period, setPeriod] = useState<'monthly' | 'weekly'>(editing?.period ?? 'monthly')
  const [saving, setSaving] = useState(false)

  // 모달 열릴 때마다 초기값 재설정
  React.useEffect(() => {
    if (visible) {
      setTitle(editing?.title ?? '')
      setSelectedCatId(editing?.category_id ?? null)
      setAmountText(editing ? String(editing.target_amount) : '')
      setPeriod(editing?.period ?? 'monthly')
    }
  }, [visible, editing])

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('알림', '목표 이름을 입력하세요')
      return
    }
    const amount = parseInt(amountText.replace(/,/g, ''), 10)
    if (!amount || amount <= 0) {
      Alert.alert('알림', '올바른 목표 금액을 입력하세요')
      return
    }
    setSaving(true)
    try {
      await onSave({ title: title.trim(), categoryId: selectedCatId, targetAmount: amount, period })
      onClose()
    } catch {
      Alert.alert('오류', '저장 중 오류가 발생했습니다')
    } finally {
      setSaving(false)
    }
  }

  const handleAmountChange = (text: string) => {
    const digits = text.replace(/[^0-9]/g, '')
    setAmountText(digits ? Number(digits).toLocaleString() : '')
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={s.modalWrapper}
      >
        <Pressable style={s.modalDim} onPress={onClose} />
        <View style={s.modalSheet}>
          <View style={s.modalHandle} />
          <Text style={s.modalTitle}>{editing ? '목표 수정' : '목표 추가'}</Text>

          {/* 목표 이름 */}
          <Text style={s.fieldLabel}>목표 이름</Text>
          <View style={[s.amountRow, { marginBottom: 0 }]}>
            <TextInput
              style={[s.amountInput, { fontSize: fontSize.base }]}
              value={title}
              onChangeText={setTitle}
              placeholder="예: 식비 30만원 이하로"
              placeholderTextColor={colors.gray400}
              returnKeyType="next"
              maxLength={40}
            />
          </View>

          {/* 카테고리 선택 */}
          <Text style={s.fieldLabel}>카테고리 (선택)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.catScroll}>
            {/* 전체 지출 옵션 */}
            <Pressable
              onPress={() => setSelectedCatId(null)}
              style={[s.catChip, selectedCatId === null && s.catChipActive]}
            >
              <Text style={s.catIcon}>📊</Text>
              <Text style={[s.catName, selectedCatId === null && s.catNameActive]}>전체 지출</Text>
            </Pressable>
            {categories.map(cat => {
              const active = cat.id === selectedCatId
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => setSelectedCatId(cat.id)}
                  style={[s.catChip, active && s.catChipActive]}
                >
                  <Text style={s.catIcon}>{cat.icon}</Text>
                  <Text style={[s.catName, active && s.catNameActive]}>{cat.name}</Text>
                </Pressable>
              )
            })}
          </ScrollView>

          {/* 월간 / 주간 토글 */}
          <Text style={s.fieldLabel}>기간</Text>
          <View style={s.periodRow}>
            {(['monthly', 'weekly'] as const).map(p => (
              <Pressable
                key={p}
                style={[s.periodBtn, period === p && s.periodBtnActive]}
                onPress={() => setPeriod(p)}
              >
                <Text style={[s.periodText, period === p && s.periodTextActive]}>
                  {p === 'monthly' ? '월간' : '주간'}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* 목표 금액 */}
          <Text style={s.fieldLabel}>목표 금액</Text>
          <View style={s.amountRow}>
            <TextInput
              style={s.amountInput}
              value={amountText}
              onChangeText={handleAmountChange}
              keyboardType="numeric"
              placeholder="예: 300,000"
              placeholderTextColor={colors.gray400}
              returnKeyType="done"
            />
            <Text style={s.amountUnit}>원 이하</Text>
          </View>

          {/* 버튼 */}
          <View style={s.modalActions}>
            <SecondaryButton label="취소" onPress={onClose} size="md" style={s.actionBtn} />
            <PrimaryButton label="저장" onPress={handleSave} loading={saving} size="md" style={s.actionBtn} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

// ─── 메인 화면 ─────────────────────────────────────────────────────────────────

export default function GoalsScreen() {
  const now = new Date()
  const [year]  = useState(now.getFullYear())
  const [month] = useState(now.getMonth() + 1)

  const { summaries, loading: dashLoading, totalExpense, refresh: refreshDash } = useDashboard(year, month)
  const {
    budgets, categories: budgetCats, loading: budgetLoading,
    createBudget, updateBudget, deleteBudget, refresh: refreshBudgets,
  } = useBudget(year, month)
  const {
    goals, categories: goalCats, loading: goalLoading,
    createGoal, updateGoal, deleteGoal, refresh: refreshGoals,
  } = useGoal(year, month)

  // 예산 모달
  const [budgetModalVisible, setBudgetModalVisible] = useState(false)
  const [editingBudget, setEditingBudget] = useState<Budget | null>(null)

  // 목표 모달
  const [goalModalVisible, setGoalModalVisible] = useState(false)
  const [editingGoal, setEditingGoal] = useState<Goal | null>(null)

  const loading = dashLoading || budgetLoading || goalLoading

  const handleRefresh = () => {
    refreshDash()
    refreshBudgets()
    refreshGoals()
  }

  // ── 예산 핸들러
  const handleSaveBudget = async (categoryId: string, amount: number) => {
    if (editingBudget) {
      await updateBudget(editingBudget.id, amount)
    } else {
      await createBudget(categoryId, amount)
    }
  }

  const handleEditBudget = (budget: Budget) => {
    setEditingBudget(budget)
    setBudgetModalVisible(true)
  }

  const handleDeleteBudget = (budget: Budget) => {
    Alert.alert('예산 삭제', `${budget.categories?.name ?? '이 예산'} 예산을 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteBudget(budget.id) },
    ])
  }

  // ── 목표 핸들러
  const handleSaveGoal = async (params: {
    title: string
    categoryId: string | null
    targetAmount: number
    period: 'monthly' | 'weekly'
  }) => {
    if (editingGoal) {
      await updateGoal(editingGoal.id, params)
    } else {
      await createGoal(params)
    }
  }

  const handleEditGoal = (goal: Goal) => {
    setEditingGoal(goal)
    setGoalModalVisible(true)
  }

  const handleDeleteGoal = (goal: Goal) => {
    Alert.alert('목표 삭제', `"${goal.title}" 목표를 삭제할까요?`, [
      { text: '취소', style: 'cancel' },
      { text: '삭제', style: 'destructive', onPress: () => deleteGoal(goal.id) },
    ])
  }

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    )
  }

  // 목표 진행률 계산 (useGoal 데이터 사용)
  const goalItems = goals.map(goal => {
    const spent = goal.category_id === null
      ? totalExpense
      : Math.abs(summaries.find(sum => sum.category_id === goal.category_id)?.total_amount ?? 0)
    const ratio = goal.target_amount > 0 ? spent / goal.target_amount : 0
    return { ...goal, spent, ratio }
  })

  // 예산 진행률 계산
  const budgetItems = budgets.map(budget => {
    const spent = Math.abs(summaries.find(sum => sum.category_id === budget.category_id)?.total_amount ?? 0)
    const ratio = budget.amount > 0 ? spent / budget.amount : 0
    return { ...budget, spent, ratio }
  })

  // 예산 tone: 90% 이상이면 danger, 75% 이상이면 warning
  const budgetTone = (ratio: number) => {
    if (ratio >= 0.9) return 'danger' as const
    if (ratio >= 0.75) return 'warning' as const
    return 'primary' as const
  }

  return (
    <>
      <ScrollView
        style={s.container}
        contentContainerStyle={s.content}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
      >
        {/* 이달 요약 카드 */}
        <Card style={s.summaryCard}>
          <Text style={s.summaryMonth}>{year}년 {month}월</Text>
          <View style={s.summaryRow}>
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>총 지출</Text>
              <Text style={[s.summaryValue, { color: colors.danger }]}>
                {formatKRW(totalExpense)}원
              </Text>
            </View>
            <View style={s.divider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>진행 목표</Text>
              <Text style={s.summaryValue}>{goalItems.length}개</Text>
            </View>
            <View style={s.divider} />
            <View style={s.summaryItem}>
              <Text style={s.summaryLabel}>설정 예산</Text>
              <Text style={s.summaryValue}>{budgetItems.length}개</Text>
            </View>
          </View>
        </Card>

        {/* 절약 목표 */}
        <SectionHeader title="절약 목표" meta={`${goalItems.length}개`} />
        {goalItems.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.empty}>설정된 목표가 없습니다</Text>
            <Text style={s.emptySub}>아래 🎯 버튼으로 목표를 추가하세요</Text>
          </Card>
        ) : (
          goalItems.map(goal => (
            <Card key={goal.id} style={s.itemCard}>
              <View style={s.itemHeader}>
                <Text style={s.itemIcon}>{goal.categories?.icon ?? '🎯'}</Text>
                <View style={s.itemInfo}>
                  <Text style={s.itemTitle}>{goal.title}</Text>
                  <Text style={s.itemSub}>
                    {goal.categories?.name ?? '전체 지출'} · {goal.period === 'monthly' ? '월간' : '주간'}
                  </Text>
                </View>
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
              <ProgressBar
                ratio={goal.ratio}
                tone={goal.ratio > 1 ? 'danger' : goal.ratio >= 0.8 ? 'warning' : 'success'}
                current={`${formatKRW(goal.spent)}원 지출`}
                total={`목표 ${formatKRW(goal.target_amount)}원`}
              />
              {/* 수정/삭제 */}
              <View style={s.cardActions}>
                <Pressable style={s.editBtn} onPress={() => handleEditGoal(goal)}>
                  <Text style={s.editBtnText}>수정</Text>
                </Pressable>
                <Pressable style={s.deleteBtn} onPress={() => handleDeleteGoal(goal)}>
                  <Text style={s.deleteBtnText}>삭제</Text>
                </Pressable>
              </View>
            </Card>
          ))
        )}

        {/* 예산 현황 */}
        <SectionHeader title="예산 현황" meta={`${budgetItems.length}개`} />
        {budgetItems.length === 0 ? (
          <Card style={s.emptyCard}>
            <Text style={s.empty}>설정된 예산이 없습니다</Text>
            <Text style={s.emptySub}>아래 + 버튼으로 예산을 추가하세요</Text>
          </Card>
        ) : (
          budgetItems.map(budget => (
            <Card key={budget.id} style={s.itemCard}>
              <View style={s.itemHeader}>
                <Text style={s.itemIcon}>{budget.categories?.icon ?? '💰'}</Text>
                <View style={s.itemInfo}>
                  <Text style={s.itemTitle}>{budget.categories?.name ?? '미분류'}</Text>
                  <Text style={s.itemSub}>월 {formatKRW(budget.amount)}원</Text>
                </View>
                {/* 수정/삭제 버튼 */}
                <Pressable style={s.editBtn} onPress={() => handleEditBudget(budget)}>
                  <Text style={s.editBtnText}>수정</Text>
                </Pressable>
                <Pressable style={s.deleteBtn} onPress={() => handleDeleteBudget(budget)}>
                  <Text style={s.deleteBtnText}>삭제</Text>
                </Pressable>
              </View>
              <ProgressBar
                ratio={budget.ratio}
                tone={budgetTone(budget.ratio)}
                current={`${formatKRW(budget.spent)}원 사용`}
                total={`예산 ${formatKRW(budget.amount)}원`}
              />
            </Card>
          ))
        )}

        {/* 하단 여백 (FAB 가림 방지) */}
        <View style={{ height: 88 }} />
      </ScrollView>

      {/* FAB 두 개: 목표(🎯) + 예산(💰) */}
      <View style={s.fabGroup}>
        <Pressable
          style={({ pressed }) => [s.fab, s.fabGoal, pressed && s.fabPressed]}
          onPress={() => {
            setEditingGoal(null)
            setGoalModalVisible(true)
          }}
        >
          <Text style={s.fabIcon}>🎯</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [s.fab, pressed && s.fabPressed]}
          onPress={() => {
            setEditingBudget(null)
            setBudgetModalVisible(true)
          }}
        >
          <Text style={s.fabIcon}>💰</Text>
        </Pressable>
      </View>

      {/* 예산 생성/편집 모달 */}
      <BudgetModal
        visible={budgetModalVisible}
        categories={budgetCats}
        editing={editingBudget}
        onSave={handleSaveBudget}
        onClose={() => {
          setBudgetModalVisible(false)
          setEditingBudget(null)
        }}
      />

      {/* 목표 생성/편집 모달 */}
      <GoalModal
        visible={goalModalVisible}
        categories={goalCats}
        editing={editingGoal}
        onSave={handleSaveGoal}
        onClose={() => {
          setGoalModalVisible(false)
          setEditingGoal(null)
        }}
      />
    </>
  )
}

// ─── 스타일 ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content:   { padding: spacing.lg, gap: spacing.sm },
  center:    { flex: 1, justifyContent: 'center', alignItems: 'center' },

  // 요약 카드
  summaryCard:  { marginBottom: spacing.sm },
  summaryMonth: { fontSize: fontSize.base, fontWeight: fontWeight.bold, color: colors.gray700, marginBottom: spacing.md },
  summaryRow:   { flexDirection: 'row', justifyContent: 'space-around' },
  summaryItem:  { alignItems: 'center', gap: 4 },
  summaryLabel: { fontSize: fontSize.sm, color: colors.gray500 },
  summaryValue: { fontSize: fontSize.lg, fontWeight: fontWeight.bold, color: colors.gray900 },
  divider:      { width: 1, backgroundColor: colors.gray200 },

  // 항목 카드
  itemCard:   { marginBottom: spacing.xs },
  itemHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  itemIcon:   { fontSize: 22 },
  itemInfo:   { flex: 1 },
  itemTitle:  { fontSize: fontSize.base, fontWeight: fontWeight.semibold, color: colors.gray900 },
  itemSub:    { fontSize: fontSize.sm, color: colors.gray500, marginTop: 2 },

  // 배지
  badge:     { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  badgeText: { fontSize: fontSize.xs, fontWeight: fontWeight.semibold },

  // 수정/삭제 버튼
  editBtn:       { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.primaryLight },
  editBtnText:   { fontSize: fontSize.sm, color: colors.primary, fontWeight: fontWeight.semibold },
  deleteBtn:     { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.md, backgroundColor: colors.dangerLight },
  deleteBtnText: { fontSize: fontSize.sm, color: colors.danger, fontWeight: fontWeight.semibold },

  // 빈 상태
  emptyCard: { alignItems: 'center', paddingVertical: spacing.xl },
  empty:     { fontSize: fontSize.base, color: colors.gray500 },
  emptySub:  { fontSize: fontSize.sm, color: colors.gray400, marginTop: 4 },

  // FAB
  fabGroup: {
    position: 'absolute',
    right: spacing.xl,
    bottom: spacing.xl,
    flexDirection: 'column',
    gap: spacing.md,
    alignItems: 'center',
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
  },
  fabGoal: { backgroundColor: colors.accent },
  fabPressed: { opacity: 0.85 },
  fabIcon:    { fontSize: 24 },

  // 카드 내 액션 버튼 행
  cardActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
    justifyContent: 'flex-end',
  },

  // 모달
  modalWrapper: { flex: 1, justifyContent: 'flex-end' },
  modalDim:     { flex: 1, backgroundColor: 'rgba(17,24,39,0.3)' },
  modalSheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    padding: spacing.xl,
    paddingBottom: 36,
    gap: spacing.md,
  },
  modalHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: radius.full,
    backgroundColor: colors.gray300,
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  fieldLabel: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray700,
    marginBottom: -spacing.xs,
  },

  // 카테고리 선택
  catScroll: { flexGrow: 0 },
  catChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginRight: spacing.sm,
    borderRadius: radius.full,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  catChipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  catIcon: { fontSize: 16 },
  catName: { fontSize: fontSize.sm, color: colors.gray700 },
  catNameActive: { color: colors.primary, fontWeight: fontWeight.semibold },

  // 금액 입력
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    backgroundColor: colors.surface,
  },
  amountInput: {
    flex: 1,
    fontSize: fontSize.xl,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
    paddingVertical: spacing.md,
  },
  amountUnit: {
    fontSize: fontSize.base,
    color: colors.muted,
    marginLeft: spacing.xs,
  },

  // 기간 토글
  periodRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  periodBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
  },
  periodBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
  periodText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray700,
  },
  periodTextActive: {
    color: colors.primary,
  },

  // 모달 버튼
  modalActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.xs },
  actionBtn:    { flex: 1 },
})
