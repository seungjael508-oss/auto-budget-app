// mobile/src/screens/ReceiptConfirmScreen.tsx
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
import { useNavigation, useRoute } from '@react-navigation/native'
import { supabase } from '../lib/supabase'
import { markWeeklyConnection } from '../lib/weeklyConnection'
import { useCategories } from '../hooks/useCategories'
import { OcrResult } from '../hooks/useReceiptOcr'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'
import Screen from '../components/ui/Screen'
import TopBar from '../components/ui/TopBar'
import PrimaryButton from '../components/ui/PrimaryButton'

interface RouteParams {
  ocrResult: OcrResult
}

export default function ReceiptConfirmScreen() {
  const navigation = useNavigation<any>()
  const route = useRoute()
  const { ocrResult } = route.params as RouteParams

  const { categories } = useCategories()

  // OCR 결과를 초기값으로 — 사용자가 모든 필드 수정 가능
  const [merchant, setMerchant] = useState(ocrResult.merchant ?? '')
  const [amount, setAmount] = useState(
    ocrResult.amount ? String(Math.abs(ocrResult.amount)) : ''
  )
  const [transactionAt, setTransactionAt] = useState(
    ocrResult.transaction_at ?? new Date().toISOString().slice(0, 16)
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // confidence < 0.7이면 추출 실패 필드에 빨간 테두리 표시
  const lowConfidence = ocrResult.confidence < 0.7

  async function handleSave() {
    const parsedAmount = parseInt(amount.replace(/,/g, ''), 10)
    if (!parsedAmount || parsedAmount <= 0) {
      Alert.alert('입력 오류', '금액을 확인해 주세요')
      return
    }
    if (!merchant.trim()) {
      Alert.alert('입력 오류', '상호명을 입력해 주세요')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인 필요')

      const { data: tx, error } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: -parsedAmount,
        merchant: merchant.trim(),
        category_id: selectedCategoryId,
        transaction_at: new Date(transactionAt).toISOString(),
        source: 'ocr',
        status: 'reviewed',            // 사용자 확인 후 저장 → 바로 reviewed
        confidence: ocrResult.confidence,
        memo: null,
        dedup_key: `receipt_${user.id}_${Date.now()}`,
      }).select('id').single()
      if (error) throw error

      await Promise.all([
        markWeeklyConnection('ocr'),
        supabase.functions.invoke('update-monthly-summary', {
          body: { userId: user.id, transactionIds: [tx.id] },
        }),
      ])

      Alert.alert('저장 완료', '영수증 거래가 등록되었습니다', [
        { text: '확인', onPress: () => navigation.goBack() },
      ])
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장 실패'
      console.error('[ReceiptConfirmScreen] 저장 오류:', err)
      Alert.alert('오류', msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Screen scroll={false}>
      <TopBar title="영수증 확인" onBack={() => navigation.goBack()} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content}>

          {/* 신뢰도 배지 */}
          <View style={[
            styles.confidenceBadge,
            lowConfidence ? styles.badgeLow : styles.badgeHigh,
          ]}>
            <Text style={styles.confidenceText}>
              OCR 신뢰도 {Math.round(ocrResult.confidence * 100)}%
              {lowConfidence ? ' — 아래 내용을 확인해 주세요' : ' — 내용을 확인해 주세요'}
            </Text>
          </View>

          {/* 상호명 */}
          <Text style={styles.label}>상호명</Text>
          <TextInput
            style={[styles.input, lowConfidence && !ocrResult.merchant && styles.inputError]}
            value={merchant}
            onChangeText={setMerchant}
            placeholder="상호명 입력"
            placeholderTextColor={colors.muted}
          />

          {/* 금액 */}
          <Text style={[styles.label, { marginTop: spacing.md }]}>금액</Text>
          <View style={styles.amountRow}>
            <TextInput
              style={[
                styles.amountInput,
                lowConfidence && !ocrResult.amount && styles.amountInputError,
              ]}
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              placeholder="0"
              placeholderTextColor={colors.muted}
            />
            <Text style={styles.wonLabel}>원</Text>
          </View>

          {/* 날짜·시간 */}
          <Text style={[styles.label, { marginTop: spacing.md }]}>날짜·시간</Text>
          <TextInput
            style={[styles.input, lowConfidence && !ocrResult.transaction_at && styles.inputError]}
            value={transactionAt}
            onChangeText={setTransactionAt}
            placeholder="2026-05-27T14:30"
            placeholderTextColor={colors.muted}
          />

          {/* 카테고리 선택 */}
          <Text style={[styles.label, { marginTop: spacing.lg }]}>카테고리 (선택)</Text>
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
  confidenceBadge: {
    padding: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.lg,
  },
  badgeHigh: { backgroundColor: colors.successLight },
  badgeLow: { backgroundColor: colors.dangerLight },
  confidenceText: { fontSize: fontSize.sm, color: colors.gray700 },
  label: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.medium,
    color: colors.muted,
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: fontSize.md,
    color: colors.gray900,
    minHeight: 48,
  },
  inputError: { borderColor: colors.danger },
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
  amountInputError: { color: colors.danger },
  wonLabel: { fontSize: fontSize.lg, color: colors.muted, marginLeft: spacing.xs },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
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
  categoryName: { fontSize: fontSize.sm, color: colors.gray700 },
  categoryNameSelected: { color: colors.primary, fontWeight: fontWeight.medium },
})
