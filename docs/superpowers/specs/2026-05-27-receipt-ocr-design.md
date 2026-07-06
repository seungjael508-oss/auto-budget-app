# 영수증 OCR + 직접 입력 — 설계 문서

**작성일:** 2026-05-27  
**상태:** 확정  
**목적:** 현금 지출을 영수증 촬영 또는 직접 입력으로 등록하는 기능

---

## 1. 배경

카드·간편결제는 알림으로 자동 수집되지만, 현금 지출은 자동 수집이 불가능하다.  
영수증 촬영(OCR)과 직접 입력 두 경로로 현금 지출을 최소 마찰로 등록한다.

**핵심 UX 원칙:**
- 매일 입력하는 앱이 되면 실패한다 → 촬영 1회로 끝내는 구조
- OCR 오탐은 반드시 사용자가 확인 후 저장 (자동 저장 금지)

---

## 2. 전체 흐름

```
[HomeScreen — 우하단 FAB "+ 지출 추가"]
    │
    ├─ 영수증 촬영
    │   ├─ 카메라 실행 (react-native-image-picker)
    │   ├─ 이미지 → Supabase Storage 업로드
    │   ├─ parse-receipt Edge Function 호출 { storage_path }
    │   │     └─ JWT 세션에서 user_id 추출 (IDOR 방지)
    │   │     └─ Claude Vision → 상호명·금액·날짜 추출
    │   │     └─ { merchant, amount, transaction_at, confidence, raw_text } 반환
    │   ├─ ReceiptConfirmScreen — 결과 확인·수정
    │   └─ 저장 API 호출 → transactions (source: 'receipt_ocr')
    │
    └─ 직접 입력
        ├─ ManualEntryScreen — 금액(필수)·카테고리(필수)·메모(선택)
        └─ 저장 API 호출 → transactions (source: 'manual')
```

---

## 3. Edge Function: `parse-receipt`

### 입력 (Request Body)
```ts
{
  storage_path: string   // Supabase Storage 내 경로 (e.g. "receipts/uuid.jpg")
}
```

> ⚠️ `user_id`는 body로 받지 않는다.  
> IDOR 방지: `Authorization` 헤더 JWT → `supabase.auth.getUser()` → `user.id` 사용
>
> ⚠️ public URL 대신 `storage_path`를 받는다.  
> Edge Function 내부에서 서비스 롤 클라이언트로 signed URL(5분 만료)을 생성해  
> Claude Vision에 전달한다. 이미지가 외부에 영구 노출되지 않는다.

### 출력 (Response)
```ts
{
  merchant: string | null        // 상호명
  amount: number | null          // 합계 금액 (음수, 지출 기준)
  transaction_at: string | null  // ISO 8601 — 영수증 날짜·시간
  confidence: number             // 0.00 ~ 1.00 (낮으면 확인 화면에서 강조)
  raw_text: string               // Claude가 읽은 원문 (디버깅용)
}
```

### 처리 흐름
```
Authorization 헤더 검증
  → supabase.auth.getUser() → user.id

경로 소유권 검증
  → storage_path가 "receipts/{user.id}/" 로 시작하는지 확인
  → 불일치 시 403 반환 (다른 사용자 이미지 접근 차단)

Signed URL 생성
  → 서비스 롤 클라이언트로 storage_path의 signed URL 생성 (만료: 5분)

  → Claude Vision API 호출
      프롬프트: "영수증에서 상호명, 합계 금액, 날짜를 JSON으로 추출하세요.
                 추출 불가 항목은 null 반환."
  → 결과 파싱 + confidence 산정
  → { merchant, amount, transaction_at, confidence, raw_text } 반환
```

### 클라이언트 업로드 경로 규칙
```
receipts/{user_id}/{uuid}.jpg
```
Edge Function이 `storage_path.startsWith('receipts/' + user.id + '/')` 로 검증.

### confidence 기준
| 조건 | confidence |
|------|------------|
| 3개 항목 모두 추출 | 0.9 |
| 2개 추출 | 0.6 |
| 1개 이하 | 0.3 |

confidence < 0.7 → ReceiptConfirmScreen에서 미확인 필드 빨간색 강조

### 에러 처리
| 상황 | 처리 |
|------|------|
| 인증 없음 | 401 반환 |
| 경로 소유권 불일치 | 403 반환 |
| 이미지 접근 불가 (signed URL 생성 실패) | 400 반환 |
| Claude API 실패 | 500 반환 + 에러 로그 |
| OCR 결과 없음 | 200 반환, 모든 필드 null, confidence 0 |

---

## 4. DB 변경

### `TransactionSource` 타입 수정
```ts
// src/engine/types.ts
export type TransactionSource =
  | 'csv'
  | 'share_intent'
  | 'paste'
  | 'notification'
  | 'receipt_ocr'   // 기존 'ocr' → 'receipt_ocr'로 명확화
  | 'manual'
```

> DB `transactions.source` 컬럼 CHECK constraint도 동일하게 업데이트 필요.

---

## 5. 신규 파일 목록

### Edge Function
| 경로 | 역할 |
|------|------|
| `supabase/functions/parse-receipt/index.ts` | 영수증 OCR Edge Function |

### 모바일
| 경로 | 역할 |
|------|------|
| `mobile/src/screens/ReceiptConfirmScreen.tsx` | OCR 결과 확인·수정 화면 |
| `mobile/src/screens/ManualEntryScreen.tsx` | 직접 입력 폼 화면 |
| `mobile/src/components/ui/AddTransactionModal.tsx` | 촬영/직접입력 선택 바텀시트 |
| `mobile/src/hooks/useReceiptOcr.ts` | 이미지 업로드 + parse-receipt 호출 훅 |

### 기존 파일 수정
| 경로 | 변경 내용 |
|------|---------|
| `mobile/src/screens/HomeScreen.tsx` | FAB 버튼 추가 |
| `src/engine/types.ts` | `TransactionSource`에 `receipt_ocr` 추가 |

---

## 6. 저장하지 않는 것 (MVP 범위 밖)

- 현금 잔액 추적
- 영수증 이미지 영구 보관 (Storage에서 파싱 후 삭제 가능)
- 품목별 라인 아이템 파싱
- 영수증 없는 자동 카테고리 학습

---

## 7. 완료 기준

- [ ] `parse-receipt` Edge Function — JWT 인증 + Claude Vision 호출 동작
- [ ] 이미지 업로드 → OCR 결과 반환 확인
- [ ] `ReceiptConfirmScreen` — 결과 표시·수정·저장
- [ ] `ManualEntryScreen` — 최소 입력 폼 동작
- [ ] `AddTransactionModal` — 촬영/직접입력 선택 바텀시트
- [ ] `HomeScreen` FAB 노출
- [ ] `TransactionSource`에 `receipt_ocr` 반영
- [ ] `npx tsc --noEmit` 통과
