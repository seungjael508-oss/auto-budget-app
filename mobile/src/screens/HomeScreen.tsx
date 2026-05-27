import React, { useMemo, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { errorCodes, isErrorWithCode, pick, types } from '@react-native-documents/picker'
import { supabase } from '../lib/supabase'
import { useDashboard } from '../hooks/useDashboard'
import { useTransactions } from '../hooks/useTransactions'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'
import { formatKRW } from '../lib/format'
import Card from '../components/ui/Card'
import ProgressBar from '../components/ui/ProgressBar'
import Screen from '../components/ui/Screen'
import SectionHeader from '../components/ui/SectionHeader'
import TopBar from '../components/ui/TopBar'

// 지원하는 은행/카드사 목록
// bank_parsers 테이블에 동일한 bank_code가 등록되어 있어야 한다

const BANKS = [
  { label: '국민은행', code: 'kb' },
  { label: '신한은행', code: 'shinhan' },
  { label: '삼성카드', code: 'samsung' },
  { label: '현대카드', code: 'hyundai' },
]

export default function HomeScreen() {
  const navigation = useNavigation<any>()
  const now = new Date()
  const [selectedBank, setSelectedBank] = useState(BANKS[0].code)
  const [uploading, setUploading] = useState(false)
  const [lastResult, setLastResult] = useState<string | null>(null)
  const { pendingCount, refresh: refreshTransactions } = useTransactions()
  const { totalExpense, budgets, goals } = useDashboard(now.getFullYear(), now.getMonth() + 1)

  const monthBudget = useMemo(
    () => budgets.reduce((sum, item) => sum + item.amount, 0) || 1_500_000,
    [budgets],
  )
  const burnRate = Math.min((totalExpense / monthBudget) * 100, 100)
  const remaining = Math.max(monthBudget - totalExpense, 0)
  const todayLabel = now.toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })

  const uploadCsv = async () => {
    // CSV 파일만 선택하도록 제한
    // types.csv: Android = ['text/csv', 'text/comma-separated-values'], iOS = 'public.comma-separated-values-text'
    let pickerResult
    try {
      pickerResult = await pick({ type: types.csv })
    } catch (e) {
      if (isErrorWithCode(e) && e.code === errorCodes.OPERATION_CANCELED) return
      // CSV 타입 필터가 기기/파일앱에서 안 될 경우 allFiles로 재시도
      try {
        pickerResult = await pick({ type: types.allFiles })
      } catch (e2) {
        if (isErrorWithCode(e2) && e2.code === errorCodes.OPERATION_CANCELED) return
        Alert.alert('오류', '파일 선택에 실패했습니다')
        return
      }
    }

    const file = pickerResult[0]

    // 파일명 null 방어 — picker가 이름을 못 읽는 기기 대응
    const safeFileName = file.name ?? `upload_${Date.now()}.csv`

    setLastResult(null)
    setUploading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('로그인이 필요합니다')

      // 1단계: Supabase Storage에 CSV 파일 업로드
      const response = await fetch(file.uri)
      const blob = await response.blob()
      const storagePath = `${user.id}/${Date.now()}_${safeFileName}`
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(storagePath, blob, { contentType: 'text/csv' })

      if (uploadError) throw uploadError

      // 2단계: raw_data 레코드 생성 (파이프라인 추적용)
      const { data: rawData, error: rawError } = await supabase
        .from('raw_data')
        .insert({
          user_id: user.id,
          source: 'csv',
          file_path: storagePath,
          status: 'pending',
        })
        .select('id')
        .single()

      if (rawError) throw rawError

      // 3단계: parse-csv Edge Function 호출
      // bank_parsers 테이블에서 bankCode로 컬럼 매핑을 가져온다
      const { data: parseResult, error: parseError } = await supabase.functions.invoke('parse-csv', {
        body: {
          rawDataId: rawData.id,
          bankCode: selectedBank,
          userId: user.id,
        },
      })

      if (parseError) throw parseError

      const inserted = (parseResult as { inserted?: number }).inserted ?? 0
      setLastResult(`완료: ${inserted}건 처리됨`)

      // 4단계: 거래 목록 갱신 — 검수 대기 카운트 반영
      await refreshTransactions()
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '업로드 실패'
      console.error('[CSV 업로드] 오류:', e)
      Alert.alert('업로드 실패', message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <>
      <TopBar title="자동화가계부" subtitle="사진만 찍고, 주 1회 확인하면 끝" rightLabel="알림" onRightPress={() => {}} />
      <Screen>
        <View style={styles.greeting}>
          <Text style={styles.date}>{todayLabel}</Text>
          <Text style={styles.headline}>이번 주도 잘 흘러가고 있어요</Text>
          <Text style={styles.subcopy}>검수할 것만 모아둘게요. 일요일에 한 번만 확인하세요.</Text>
        </View>

        <Card style={styles.monthCard}>
          <Text style={styles.cardLabel}>이번 달 지출</Text>
          <View style={styles.amountLine}>
            <Text style={styles.heroAmount}>{formatKRW(totalExpense)}</Text>
            <Text style={styles.won}>원</Text>
          </View>
          <Text style={styles.muted}>예산 {formatKRW(monthBudget)}원 중 {Math.round(burnRate)}% 사용</Text>
          <View style={styles.progressGap}>
            <ProgressBar value={burnRate} tone={burnRate > 90 ? 'danger' : burnRate > 75 ? 'warning' : 'primary'} thickness={10} />
          </View>
          <View style={styles.rowBetween}>
            <Text style={styles.muted}>남은 예산</Text>
            <Text style={styles.successText}>{formatKRW(remaining)}원</Text>
          </View>
        </Card>

        <Card variant="primary" style={styles.reviewCard} onPress={() => navigation.navigate('검수')}>
          <View style={styles.rowBetween}>
            <View>
              <Text style={styles.primaryLabel}>이번 주 검수 대기</Text>
              <Text style={styles.primaryCount}>{pendingCount}건</Text>
              <Text style={styles.primaryHint}>3분이면 끝나요</Text>
            </View>
            <View style={styles.circle}>
              <Text style={styles.circleText}>→</Text>
            </View>
          </View>
        </Card>

        <SectionHeader title="자동 수집" />
        <View style={styles.quickGrid}>
          <Card style={styles.quickCard} onPress={() => Alert.alert('준비 중', 'OCR 촬영은 다음 단계에서 연결합니다')}>
            <Text style={styles.quickIcon}>📷</Text>
            <Text style={styles.quickTitle}>영수증 찍기</Text>
            <Text style={styles.quickDesc}>OCR 자동 분류</Text>
          </Card>
          <Card style={styles.quickCard} onPress={uploadCsv}>
            {uploading ? <ActivityIndicator color={colors.primary} /> : <Text style={styles.quickIcon}>📄</Text>}
            <Text style={styles.quickTitle}>CSV 업로드</Text>
            <Text style={styles.quickDesc}>카드 내역 불러오기</Text>
          </Card>
        </View>

        <Text style={styles.label}>은행/카드사 선택</Text>
        <View style={styles.bankRow}>
          {BANKS.map(bank => (
            <Pressable
              key={bank.code}
              // 업로드 중에는 은행 변경 불가 — 도중에 bankCode가 바뀌면 파싱 오류
              disabled={uploading}
              style={[
                styles.bankChip,
                selectedBank === bank.code && styles.bankChipActive,
                uploading && styles.bankChipDisabled,
              ]}
              onPress={() => setSelectedBank(bank.code)}
            >
              <Text style={[styles.bankText, selectedBank === bank.code && styles.bankTextActive]}>{bank.label}</Text>
            </Pressable>
          ))}
        </View>
        {lastResult ? <Text style={styles.result}>{lastResult}</Text> : null}

        <SectionHeader title="내 목표" actionLabel="전체 보기" onActionPress={() => navigation.navigate('목표')} />
        {goals.slice(0, 2).map(goal => (
          <Card key={goal.id} style={styles.goalCard}>
            <View style={styles.rowBetween}>
              <Text style={styles.goalTitle}>{goal.title}</Text>
              <Text style={styles.goalMeta}>{goal.period === 'weekly' ? '주간' : '월간'}</Text>
            </View>
            <View style={styles.progressGap}>
              <ProgressBar value={0} tone="accent" current={`0원`} total={`${formatKRW(goal.target_amount)}원`} />
            </View>
          </Card>
        ))}
        {goals.length === 0 ? (
          <Card style={styles.goalCard}>
            <Text style={styles.goalTitle}>첫 목표를 만들어보세요</Text>
            <Text style={styles.muted}>올리브영 세트, 여행, 운동 같은 생활 목표가 좋아요.</Text>
          </Card>
        ) : null}
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  greeting: {
    marginBottom: spacing.xl,
  },
  date: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  headline: {
    marginTop: spacing.xs,
    fontSize: 22,
    lineHeight: 29,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  subcopy: {
    marginTop: spacing.xs,
    fontSize: fontSize.md,
    lineHeight: 21,
    color: colors.muted,
  },
  monthCard: {
    marginBottom: spacing.md,
  },
  cardLabel: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  amountLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
    marginTop: spacing.xs,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  won: {
    fontSize: fontSize.md,
    color: colors.muted,
  },
  muted: {
    fontSize: fontSize.sm,
    lineHeight: 20,
    color: colors.muted,
  },
  progressGap: {
    marginTop: spacing.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  successText: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.success,
  },
  reviewCard: {
    marginBottom: spacing.sm,
  },
  primaryLabel: {
    fontSize: fontSize.xs,
    color: '#DDE8FF',
  },
  primaryCount: {
    marginTop: spacing.xs,
    fontSize: 30,
    fontWeight: fontWeight.bold,
    color: colors.white,
  },
  primaryHint: {
    marginTop: 2,
    fontSize: fontSize.sm,
    color: '#DDE8FF',
  },
  circle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  circleText: {
    color: colors.white,
    fontSize: 24,
  },
  quickGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  quickCard: {
    flex: 1,
    minHeight: 124,
    padding: spacing.lg,
  },
  quickIcon: {
    fontSize: 24,
    marginBottom: spacing.sm,
  },
  quickTitle: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
  },
  quickDesc: {
    marginTop: 2,
    fontSize: fontSize.xs,
    color: colors.muted,
  },
  label: {
    marginTop: spacing.lg,
    marginBottom: spacing.sm,
    fontSize: fontSize.sm,
    color: colors.muted,
  },
  bankRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  bankChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceStrong,
  },
  bankChipActive: {
    backgroundColor: colors.primary,
  },
  bankChipDisabled: {
    opacity: 0.4,
  },
  bankText: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.muted,
  },
  bankTextActive: {
    color: colors.white,
  },
  result: {
    marginTop: spacing.sm,
    color: colors.success,
    fontSize: fontSize.sm,
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
  goalMeta: {
    fontSize: fontSize.xs,
    color: colors.muted,
  },
})
