# 영수증 OCR + 직접 입력 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 현금 지출을 영수증 촬영(Claude Vision OCR) 또는 직접 입력으로 등록하는 기능 구현

**Architecture:** HomeScreen FAB → AddTransactionModal(선택) → 촬영 경로는 이미지 업로드 → parse-receipt Edge Function(JWT 인증 + 소유권 검증 + Claude Vision) → ReceiptConfirmScreen(확인 후 저장) / 직접 입력 경로는 ManualEntryScreen(최소 폼 → 저장). 저장은 항상 사용자 확인 이후.

**Tech Stack:** React Native 0.85, react-native-image-picker, Supabase Storage, Supabase Edge Function (Deno), Claude Vision API (claude-haiku-4-5-20251001), @react-navigation/native-stack

---

## 파일 맵

| 파일 | 상태 | 역할 |
|------|------|------|
| `src/engine/types.ts` | 수정 | `TransactionSource`에 `receipt_ocr` 추가 |
| `supabase/functions/parse-receipt/index.ts` | 신규 | JWT 인증 + 소유권 검증 + Claude Vision + 결과 반환 |
| `mobile/src/hooks/useReceiptOcr.ts` | 신규 | 이미지 업로드 + parse-receipt 호출 |
| `mobile/src/hooks/useCategories.ts` | 신규 | 카테고리 목록 로드 (ManualEntry에서 재사용) |
| `mobile/src/components/ui/AddTransactionModal.tsx` | 신규 | 촬영/직접입력 선택 바텀시트 |
| `mobile/src/screens/ReceiptConfirmScreen.tsx` | 신규 | OCR 결과 확인·수정·저장 |
| `mobile/src/screens/ManualEntryScreen.tsx` | 신규 | 직접 입력 폼·저장 |
| `mobile/src/navigation/RootNavigator.tsx` | 수정 | 두 신규 화면을 modal 스택에 추가 |
| `mobile/src/screens/HomeScreen.tsx` | 수정 | FAB 버튼 + AddTransactionModal 연결 |
| `mobile/android/app/src/main/AndroidManifest.xml` | 수정 | CAMERA 권한 추가 |

---

## Task 1: TransactionSource 타입 업데이트

**Files:**
- Modify: `src/engine/types.ts`

- [ ] **Step 1: `ocr` → `receipt_ocr`로 변경**

```typescript
// src/engine/types.ts — TransactionSource 부분만 변경
export type TransactionSource =
  | 'csv'
  | 'share_intent'
  | 'paste'
  | 'notification'
  | 'receipt_ocr'   // 기존 'ocr' → 명확화
  | 'manual'
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/apple/Desktop/자동화가계부
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/engine/types.ts
git commit -m "feat: TransactionSource에 receipt_ocr 추가 (ocr → receipt_ocr)"
```

---

## Task 2: react-native-image-picker 설치 + Android 권한

**Files:**
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: 패키지 설치**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npm install react-native-image-picker@^7.1.2
```

Expected: `node_modules/react-native-image-picker` 생성

- [ ] **Step 2: CAMERA 권한 추가**

`mobile/android/app/src/main/AndroidManifest.xml`의 `<manifest>` 태그 안, 기존 `<uses-permission>` 블록 아래에 추가:

```xml
<uses-permission android:name="android.permission.CAMERA" />
```

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add mobile/android/app/src/main/AndroidManifest.xml mobile/package.json mobile/package-lock.json
git commit -m "feat: react-native-image-picker 설치 + CAMERA 권한 추가"
```

---

## Task 3: parse-receipt Edge Function

**Files:**
- Create: `supabase/functions/parse-receipt/index.ts`

- [ ] **Step 1: 함수 파일 생성**

```typescript
// supabase/functions/parse-receipt/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY')!

interface RequestBody {
  storage_path: string  // e.g. "receipts/{user_id}/{uuid}.jpg"
}

interface OcrResult {
  merchant: string | null
  amount: number | null
  transaction_at: string | null
  confidence: number
  raw_text: string
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

// 추출된 항목 수로 confidence 산정
function calcConfidence(result: Omit<OcrResult, 'confidence' | 'raw_text'>): number {
  const filled = [result.merchant, result.amount, result.transaction_at]
    .filter(v => v !== null).length
  if (filled === 3) return 0.9
  if (filled === 2) return 0.6
  return 0.3
}

// Claude Vision으로 영수증 파싱
async function parseReceiptWithClaude(signedUrl: string): Promise<OcrResult> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 256,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: signedUrl },
          },
          {
            type: 'text',
            text: `영수증 이미지에서 다음 3가지를 JSON으로 추출하세요.
추출 불가 항목은 null로 반환하고 다른 항목은 정상 반환합니다.
amount는 음수(지출)로 반환합니다. transaction_at은 ISO 8601 형식입니다.

반드시 아래 JSON만 반환하고 설명 텍스트는 쓰지 마세요:
{"merchant":"상호명","amount":-12000,"transaction_at":"2026-05-27T14:30:00"}`,
          },
        ],
      }],
    }),
  })

  if (!response.ok) {
    throw new Error(`Claude API 오류: ${response.status}`)
  }

  const data = await response.json()
  const raw_text: string = data.content?.[0]?.text ?? ''

  try {
    // JSON 블록만 추출 (Claude가 마크다운 감싸는 경우 대비)
    const jsonMatch = raw_text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('JSON 없음')

    const parsed = JSON.parse(jsonMatch[0])
    const result = {
      merchant: typeof parsed.merchant === 'string' ? parsed.merchant : null,
      amount: typeof parsed.amount === 'number' ? parsed.amount : null,
      transaction_at: typeof parsed.transaction_at === 'string' ? parsed.transaction_at : null,
    }
    return { ...result, confidence: calcConfidence(result), raw_text }
  } catch {
    // 파싱 실패 → 모든 필드 null
    return { merchant: null, amount: null, transaction_at: null, confidence: 0, raw_text }
  }
}

serve(async (req: Request) => {
  // 1. JWT 인증
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return jsonResponse({ error: '인증 필요' }, 401)

  const anonClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: { user }, error: authError } = await anonClient.auth.getUser(
    authHeader.replace('Bearer ', '')
  )
  if (authError || !user) return jsonResponse({ error: '인증 실패' }, 401)

  // 2. 요청 바디 파싱
  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: '잘못된 요청 바디' }, 400)
  }

  const { storage_path } = body
  if (!storage_path) return jsonResponse({ error: 'storage_path 필수' }, 400)

  // 3. 소유권 검증: 경로가 본인 디렉토리로 시작하는지 확인
  const expectedPrefix = `receipts/${user.id}/`
  if (!storage_path.startsWith(expectedPrefix)) {
    return jsonResponse({ error: '접근 권한 없음' }, 403)
  }

  // 4. 서비스 롤로 signed URL 생성 (5분 만료)
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  const { data: signedData, error: signedError } = await adminClient
    .storage
    .from('receipts')
    .createSignedUrl(storage_path.replace('receipts/', ''), 300)

  if (signedError || !signedData?.signedUrl) {
    return jsonResponse({ error: '이미지 접근 불가' }, 400)
  }

  // 5. Claude Vision으로 영수증 파싱
  try {
    const result = await parseReceiptWithClaude(signedData.signedUrl)
    return jsonResponse(result)
  } catch (err) {
    console.error('[parse-receipt] Claude API 오류:', err)
    return jsonResponse({ error: 'OCR 처리 실패' }, 500)
  }
})
```

- [ ] **Step 2: 커밋**

```bash
git add supabase/functions/parse-receipt/index.ts
git commit -m "feat: parse-receipt Edge Function 추가 (JWT + 소유권 검증 + Claude Vision)"
```

---

## Task 4: useReceiptOcr 훅

**Files:**
- Create: `mobile/src/hooks/useReceiptOcr.ts`

- [ ] **Step 1: 훅 생성**

```typescript
// mobile/src/hooks/useReceiptOcr.ts
import { useState } from 'react'
import { launchCamera, launchImageLibrary, ImagePickerResponse } from 'react-native-image-picker'
import { supabase } from '../lib/supabase'
import 'react-native-get-random-values'

// OCR 결과 타입 (parse-receipt 응답과 동일)
export interface OcrResult {
  merchant: string | null
  amount: number | null
  transaction_at: string | null
  confidence: number
  raw_text: string
}

export function useReceiptOcr() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 이미지를 Storage에 업로드하고 storage_path 반환
  async function uploadImage(uri: string, userId: string): Promise<string> {
    const uuid = Math.random().toString(36).slice(2) + Date.now()
    const storagePath = `${userId}/${uuid}.jpg`

    const response = await fetch(uri)
    const blob = await response.blob()

    const { error: uploadError } = await supabase
      .storage
      .from('receipts')
      .upload(storagePath, blob, { contentType: 'image/jpeg', upsert: false })

    if (uploadError) throw new Error(`이미지 업로드 실패: ${uploadError.message}`)

    // Edge Function에서 검증할 전체 경로 반환
    return `receipts/${storagePath}`
  }

  // parse-receipt Edge Function 호출
  async function callParseReceipt(storagePath: string): Promise<OcrResult> {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) throw new Error('로그인 필요')

    const { data, error: fnError } = await supabase.functions.invoke('parse-receipt', {
      body: { storage_path: storagePath },
      headers: { Authorization: `Bearer ${session.access_token}` },
    })

    if (fnError) throw new Error(`OCR 처리 실패: ${fnError.message}`)
    return data as OcrResult
  }

  // 카메라 촬영 → 업로드 → OCR
  async function captureAndOcr(): Promise<OcrResult | null> {
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인 필요'); return null }

    return new Promise(resolve => {
      launchCamera(
        { mediaType: 'photo', quality: 0.8, maxWidth: 1920, maxHeight: 1920 },
        async (response: ImagePickerResponse) => {
          if (response.didCancel || !response.assets?.[0]?.uri) {
            resolve(null)
            return
          }
          setLoading(true)
          try {
            const uri = response.assets[0].uri!
            const storagePath = await uploadImage(uri, user.id)
            const result = await callParseReceipt(storagePath)
            resolve(result)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'OCR 실패'
            setError(msg)
            console.error('[useReceiptOcr] 오류:', err)
            resolve(null)
          } finally {
            setLoading(false)
          }
        }
      )
    })
  }

  // 갤러리 선택 → 업로드 → OCR
  async function pickAndOcr(): Promise<OcrResult | null> {
    setError(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('로그인 필요'); return null }

    return new Promise(resolve => {
      launchImageLibrary(
        { mediaType: 'photo', quality: 0.8, maxWidth: 1920, maxHeight: 1920 },
        async (response: ImagePickerResponse) => {
          if (response.didCancel || !response.assets?.[0]?.uri) {
            resolve(null)
            return
          }
          setLoading(true)
          try {
            const uri = response.assets[0].uri!
            const storagePath = await uploadImage(uri, user.id)
            const result = await callParseReceipt(storagePath)
            resolve(result)
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'OCR 실패'
            setError(msg)
            console.error('[useReceiptOcr] 오류:', err)
            resolve(null)
          } finally {
            setLoading(false)
          }
        }
      )
    })
  }

  return { captureAndOcr, pickAndOcr, loading, error }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/hooks/useReceiptOcr.ts
git commit -m "feat: useReceiptOcr 훅 추가 (이미지 업로드 + parse-receipt 호출)"
```

---

## Task 5: useCategories 훅

**Files:**
- Create: `mobile/src/hooks/useCategories.ts`

- [ ] **Step 1: 훅 생성**

```typescript
// mobile/src/hooks/useCategories.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Category } from '../types'

// ManualEntryScreen과 ReceiptConfirmScreen에서 카테고리 선택에 사용
export function useCategories() {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('categories')
        .select('*')
        .order('is_system', { ascending: false })
      setCategories(data ?? [])
      setLoading(false)
    }
    fetch()
  }, [])

  return { categories, loading }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/hooks/useCategories.ts
git commit -m "feat: useCategories 훅 추가 (ManualEntry/ReceiptConfirm 공용)"
```

---

## Task 6: AddTransactionModal 컴포넌트

**Files:**
- Create: `mobile/src/components/ui/AddTransactionModal.tsx`

- [ ] **Step 1: 바텀시트 컴포넌트 생성**

```typescript
// mobile/src/components/ui/AddTransactionModal.tsx
import React from 'react'
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { colors, fontSize, fontWeight, radius, spacing } from '../../theme'

interface Props {
  visible: boolean
  onCamera: () => void      // 영수증 촬영 선택
  onGallery: () => void     // 갤러리 선택
  onManual: () => void      // 직접 입력 선택
  onClose: () => void
}

export default function AddTransactionModal({
  visible, onCamera, onGallery, onManual, onClose,
}: Props) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      {/* 배경 탭 → 닫기 */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>지출 추가</Text>

        <Pressable style={styles.option} onPress={onCamera}>
          <Text style={styles.optionIcon}>📷</Text>
          <View>
            <Text style={styles.optionLabel}>영수증 촬영</Text>
            <Text style={styles.optionDesc}>카메라로 찍으면 자동 입력</Text>
          </View>
        </Pressable>

        <Pressable style={styles.option} onPress={onGallery}>
          <Text style={styles.optionIcon}>🖼️</Text>
          <View>
            <Text style={styles.optionLabel}>갤러리에서 선택</Text>
            <Text style={styles.optionDesc}>저장된 영수증 사진 사용</Text>
          </View>
        </Pressable>

        <Pressable style={styles.option} onPress={onManual}>
          <Text style={styles.optionIcon}>✏️</Text>
          <View>
            <Text style={styles.optionLabel}>직접 입력</Text>
            <Text style={styles.optionDesc}>영수증 없는 현금 지출</Text>
          </View>
        </Pressable>

        <Pressable style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelText}>취소</Text>
        </Pressable>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xl,
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
    marginBottom: spacing.md,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    minHeight: 56,  // 시니어 UX: 터치 타겟 최소 48px
  },
  optionIcon: {
    fontSize: 24,
    width: 36,
    textAlign: 'center',
  },
  optionLabel: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.gray900,
  },
  optionDesc: {
    fontSize: fontSize.sm,
    color: colors.muted,
    marginTop: 2,
  },
  cancelBtn: {
    marginTop: spacing.md,
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: 48,
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: fontSize.md,
    color: colors.muted,
  },
})
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/components/ui/AddTransactionModal.tsx
git commit -m "feat: AddTransactionModal 바텀시트 (촬영/갤러리/직접입력)"
```

---

## Task 7: ManualEntryScreen

**Files:**
- Create: `mobile/src/screens/ManualEntryScreen.tsx`

- [ ] **Step 1: 화면 생성**

```typescript
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

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: -parsedAmount,           // 지출은 음수
        merchant: '현금 지출',
        category_id: selectedCategoryId,
        transaction_at: new Date().toISOString(),
        source: 'manual',
        status: 'reviewed',              // 직접 입력은 바로 확정
        confidence: 1.0,
        memo: memo.trim() || null,
        dedup_key: `manual_${user.id}_${Date.now()}`,
      })
      if (error) throw error

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
    <Screen>
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
    padding: spacing.lg,
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
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/screens/ManualEntryScreen.tsx
git commit -m "feat: ManualEntryScreen 추가 (현금 직접 입력)"
```

---

## Task 8: ReceiptConfirmScreen

**Files:**
- Create: `mobile/src/screens/ReceiptConfirmScreen.tsx`

- [ ] **Step 1: 화면 생성**

```typescript
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

  // OCR 결과를 초기값으로 — 사용자가 수정 가능
  const [merchant, setMerchant] = useState(ocrResult.merchant ?? '')
  const [amount, setAmount] = useState(
    ocrResult.amount ? String(Math.abs(ocrResult.amount)) : ''
  )
  const [transactionAt, setTransactionAt] = useState(
    ocrResult.transaction_at ?? new Date().toISOString().slice(0, 16)
  )
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  // confidence < 0.7 이면 해당 필드를 빨간색으로 강조
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

      const { error } = await supabase.from('transactions').insert({
        user_id: user.id,
        amount: -parsedAmount,
        merchant: merchant.trim(),
        category_id: selectedCategoryId,
        transaction_at: new Date(transactionAt).toISOString(),
        source: 'receipt_ocr',
        status: 'reviewed',           // 확인 후 저장 → 바로 reviewed
        confidence: ocrResult.confidence,
        memo: null,
        dedup_key: `receipt_${user.id}_${Date.now()}`,
      })
      if (error) throw error

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
    <Screen>
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
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
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
```

- [ ] **Step 2: 타입 체크**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/screens/ReceiptConfirmScreen.tsx
git commit -m "feat: ReceiptConfirmScreen 추가 (OCR 결과 확인·수정·저장)"
```

---

## Task 9: Navigator에 신규 화면 등록 + HomeScreen FAB

**Files:**
- Modify: `mobile/src/navigation/RootNavigator.tsx`
- Modify: `mobile/src/screens/HomeScreen.tsx`

- [ ] **Step 1: RootNavigator에 modal 화면 추가**

`mobile/src/navigation/RootNavigator.tsx`에서 import 추가:

```typescript
import ReceiptConfirmScreen from '../screens/ReceiptConfirmScreen'
import ManualEntryScreen from '../screens/ManualEntryScreen'
```

Stack.Navigator 안에 아래 두 화면 추가 (기존 `App` / `Login` 스크린 아래):

```typescript
<Stack.Screen
  name="ReceiptConfirm"
  component={ReceiptConfirmScreen}
  options={{ presentation: 'modal', headerShown: false }}
/>
<Stack.Screen
  name="ManualEntry"
  component={ManualEntryScreen}
  options={{ presentation: 'modal', headerShown: false }}
/>
```

- [ ] **Step 2: HomeScreen에 FAB + 모달 로직 추가**

`mobile/src/screens/HomeScreen.tsx`에 import 추가:

```typescript
import AddTransactionModal from '../components/ui/AddTransactionModal'
import { useReceiptOcr } from '../hooks/useReceiptOcr'
```

컴포넌트 안에 상태 및 핸들러 추가:

```typescript
const [showAddModal, setShowAddModal] = useState(false)
const { captureAndOcr, pickAndOcr, loading: ocrLoading } = useReceiptOcr()

async function handleCamera() {
  setShowAddModal(false)
  const result = await captureAndOcr()
  if (result) navigation.navigate('ReceiptConfirm', { ocrResult: result })
}

async function handleGallery() {
  setShowAddModal(false)
  const result = await pickAndOcr()
  if (result) navigation.navigate('ReceiptConfirm', { ocrResult: result })
}

function handleManual() {
  setShowAddModal(false)
  navigation.navigate('ManualEntry')
}
```

Screen 컴포넌트의 최하단(닫는 태그 바로 위)에 FAB와 모달 추가:

```typescript
{/* 지출 추가 FAB */}
<Pressable
  style={styles.fab}
  onPress={() => setShowAddModal(true)}
  disabled={ocrLoading}
>
  <Text style={styles.fabText}>{ocrLoading ? '⏳' : '+'}</Text>
</Pressable>

<AddTransactionModal
  visible={showAddModal}
  onCamera={handleCamera}
  onGallery={handleGallery}
  onManual={handleManual}
  onClose={() => setShowAddModal(false)}
/>
```

StyleSheet에 FAB 스타일 추가:

```typescript
fab: {
  position: 'absolute',
  bottom: spacing.xl,
  right: spacing.lg,
  width: 56,
  height: 56,
  borderRadius: 28,
  backgroundColor: colors.primary,
  justifyContent: 'center',
  alignItems: 'center',
  elevation: 4,
  shadowColor: colors.black,
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.25,
  shadowRadius: 4,
},
fabText: {
  fontSize: 28,
  color: colors.white,
  lineHeight: 32,
},
```

- [ ] **Step 3: 타입 체크**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add mobile/src/navigation/RootNavigator.tsx mobile/src/screens/HomeScreen.tsx
git commit -m "feat: HomeScreen FAB + 신규 화면 네비게이터 등록"
```

---

## Task 10: Supabase Storage 버킷 생성 (수동)

- [ ] **Step 1: Supabase Dashboard에서 버킷 생성**

1. Supabase Dashboard → Storage → New Bucket
2. Bucket name: `receipts`
3. Public: **OFF** (비공개)
4. 생성

- [ ] **Step 2: RLS 정책 추가**

SQL Editor에서 실행:

```sql
-- receipts 버킷: 본인 경로만 업로드 허용
create policy "본인 영수증만 업로드"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- receipts 버킷: 본인 경로만 읽기 허용
create policy "본인 영수증만 읽기"
on storage.objects for select
to authenticated
using (
  bucket_id = 'receipts'
  and (storage.foldername(name))[1] = auth.uid()::text
);
```

- [ ] **Step 3: 동작 확인**

앱에서 영수증 촬영 → Storage `receipts/{userId}/xxx.jpg` 업로드되는지 확인

---

## Task 11: 전체 동작 확인

- [ ] **Step 1: 빌드 및 실행**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npx react-native run-android
```

- [ ] **Step 2: 촬영 경로 확인**

1. HomeScreen 우하단 FAB 노출 확인
2. FAB 탭 → AddTransactionModal 노출
3. "영수증 촬영" 선택 → 카메라 실행
4. 촬영 → OCR 처리 중 로딩
5. ReceiptConfirmScreen에 결과 노출
6. 신뢰도 배지 색상 확인 (< 0.7 → 빨간색)
7. 저장 → 거래목록에 `receipt_ocr` 거래 추가 확인

- [ ] **Step 3: 직접 입력 경로 확인**

1. FAB → "직접 입력"
2. ManualEntryScreen에서 금액·카테고리 입력
3. 저장 → 거래목록에 `manual` 거래 추가 확인

- [ ] **Step 4: 최종 타입 체크**

```bash
cd /Users/apple/Desktop/자동화가계부/mobile
npx tsc --noEmit
```

Expected: 에러 없음

- [ ] **Step 5: 최종 커밋**

```bash
git add -A
git commit -m "feat: 영수증 OCR + 직접 입력 전체 구현 완료"
```

---

## Lovable 화면 스펙 요약

> Lovable에서 최종 UX/UI 제작 시 참고할 화면별 스펙

### 1. AddTransactionModal (바텀시트)

```
┌──────────────────────────┐
│         ━━━               │  ← handle
│  지출 추가                 │
│ ─────────────────────── │
│ 📷  영수증 촬영            │
│     카메라로 찍으면 자동 입력 │
│ ─────────────────────── │
│ 🖼️  갤러리에서 선택         │
│     저장된 영수증 사진 사용   │
│ ─────────────────────── │
│ ✏️  직접 입력              │
│     영수증 없는 현금 지출     │
│ ─────────────────────── │
│         취소               │
└──────────────────────────┘
```

### 2. ReceiptConfirmScreen

```
← 영수증 확인

┌──────────────────────────┐
│ OCR 신뢰도 90% — 내용 확인  │  ← 초록 배지 (< 70% 빨간)
└──────────────────────────┘

상호명
[스타벅스                  ]

금액
[4,500                   ] 원

날짜·시간
[2026-05-27T14:30        ]

카테고리 (선택)
[☕ 카페] [🍽️ 식비] [🛒 마트] ...

         [  저장  ]
```

- confidence < 0.7: 추출 실패 필드 빨간 테두리
- 모든 필드 수정 가능
- 저장 후 뒤로 이동

### 3. ManualEntryScreen

```
← 직접 입력

금액 *
[15000                   ] 원

카테고리 *
[☕ 카페] [🍽️ 식비] [🛒 마트] ...

메모 (선택)
[편의점 간식               ]

         [  저장  ]
```

- 금액·카테고리 필수, 메모 선택
- 저장 즉시 `reviewed` 상태로 등록

### 4. HomeScreen FAB

```
┌────────────────────────┐
│         ...홈 콘텐츠...  │
│                        │
│                  [+]   │  ← 우하단 FAB (56×56, primary color)
└────────────────────────┘
```
