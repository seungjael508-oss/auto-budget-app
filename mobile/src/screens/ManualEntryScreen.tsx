// mobile/src/screens/ManualEntryScreen.tsx
import React, { useState } from 'react'
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { useCategories } from '../hooks/useCategories'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'
import Screen from '../components/ui/Screen'
import TopBar from '../components/ui/TopBar'
import PrimaryButton from '../components/ui/PrimaryButton'

export default function ManualEntryScreen() {
  const navigation = useNavigation<any>()
  const { categories } = useCategories()
  const [amount, setAmount] = useState('')
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [memo, setMemo] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleSave() {
    const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('입력 오류', '금액을 입력해 주세요')
      return
    }
    if (!selectedCategoryId) {
      Alert.alert('입력 오류', '카테고리를 선택해 주세요')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인 필요')

      const { data: tx, error } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: -parsedAmount,          // 지출은 음수
        merchant: '현금 지출',
        category_id: selectedCategoryId,
        transaction_at: new Date().toISOString(),
        source: 'manual',
        status: 'reviewed',             // 직접 입력은 바로 확정
        confidence: 1.0,
        memo: memo.trim() || null,
        dedup_key: `manual_${user.id}_${Date.now()}`,
      }).select('id').single()
      if (error) throw error

      await supabase.functions.invoke('update-monthly-summary', {
        body: { userId: user.id, transactionIds: [tx.id] },
      })

      Alert.alert('저장 완료', '지출이 등록되었습니다', [
        { text: '확인', onPress: () => navigation.goBack() },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장 실패'
      console.error('[ManualEntryScreen] 저장 오류:', err)
      Alert.alert('오류', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen scroll={false}>
      <TopBar title="직접 입력" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>

          {/* 금액 입력 */}
          <Text style={styles.label}>금액 *</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={styles.amountInput}
              keyboardType="numeric"
              placeholder="0"
              placeholderTextColor={colors.muted}
              value={amount}
              onChangeText={setAmount}
              maxLength={10}
            />
            <Text style={styles.wonLabel}>원</Text>
          </View>

          {/* 카테고리 선택 */}
          <Text style={[styles.label, { marginTop: spacing.lg }]}>카테고리 *</Text>
          <View style={styles.categoryGrid}>
            {categories.map(cat => (
              <Pressable
                key={cat.id}
                style={[
                  styles.categoryChip,
                  selectedCategoryId === cat.id && styles.categoryChipSelected,
                ]}
                onPress={() => setSelectedCategoryId(cat.id)}
              >
                <Text style={styles.categoryIcon}>{cat.icon}</Text>
                <Text style={[
                  styles.categoryName,
                  selectedCategoryId === cat.id && styles.categoryNameSelected,
                ]}>{cat.name}</Text>
              </Pressable>
            ))}
          </View>

          {/* 메모 (선택) */}
          <Text style={[styles.label, { marginTop: spacing.lg }]}>메모 (선택)</Text>
          <TextInput
            style={styles.memoInput}
            placeholder="예: 편의점 간식"
            placeholderTextColor={colors.muted}
            value={memo}
            onChangeText={setMemo}
            maxLength={100}
          />

          <PrimaryButton
            label={saving ? '저장 중...' : '저장'}
            onPress={handleSave}
            disabled={saving}
            style={{ marginTop: spacing.xl }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  )
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
    paddingBottom: spacing.xs,
  },
  amountInput: {
    flex: 1,
    fontSize: 32,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
    paddingVertical: spacing.sm,
  },
  wonLabel: {
    fontSize: fontSize.lg,
    color: colors.muted,
    marginLeft: spacing.xs,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceStrong,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 40,
  },
  categoryChipSelected: {
    backgroundColor: colors.primaryLight,
    borderColor: colors.primary,
  },
  categoryIcon: { fontSize: 16 },
  categoryName: {
    fontSize: fontSize.sm,
    color: colors.gray700,
  },
  categoryNameSelected: {
    color: colors.primary,
    fontWeight: fontWeight.medium,
  },
  memoInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.gray900,
    minHeight: 48,
  },
})
