# 자동화 가계부

> 카드만 쓰면 소비가 자동 정리되고, 삶 목표까지 관리되는 생활 예산 코치

카드 결제 알림을 자동으로 수집해 거래 내역으로 변환하고, 월간 예산·목표 달성률까지 관리하는 Android 앱입니다.

---

## 주요 기능

- **자동 수집** — NotificationListenerService로 카드사·간편결제 알림을 백그라운드에서 자동 포착
- **텍스트 파싱** — AI 기반 `parse-text` Edge Function으로 알림 → 거래 데이터 변환
- **CSV 업로드** — 카드사 명세서 CSV 직접 업로드 지원
- **공유하기 수신** — 앱 외부 텍스트 공유 → 자동 파싱
- **주간 검수** — 신뢰도 낮은 거래만 빠르게 확인·승인 (스와이프 UI)
- **대시보드** — 카테고리별 지출 비중, 예산 소진율, 목표 달성률 실시간 표시
- **예산 관리** — 카테고리별 월 예산 생성·편집·삭제
- **목표 관리** — 절약 목표 생성·편집·삭제 (달성률 실시간 추적)
- **자동 flush** — WorkManager로 1시간마다 로컬 큐 자동 전송 (앱 종료 상태에서도 동작)
- **주간 푸시 알림** — 7일마다 검수할 거래 있으면 로컬 푸시 알림 발송

---

## 지원 금융 앱 (알림 자동 수집)

### 카드사

| 카드사 | 패키지명 |
|---|---|
| 국민카드 | `com.kbcard.kbkookmincard` |
| 신한카드 | `com.shinhancard.smart` |
| 삼성카드 | `com.samsung.android.spay` |
| 현대카드 | `com.hyundaicard.app` |

### 간편결제

| 앱 | 패키지명 |
|---|---|
| 카카오페이 (카카오톡) | `com.kakao.talk` |
| 카카오페이 (단독) | `com.kakaopay.app` |
| 토스 | `viva.republica.toss` |
| 네이버페이 (네이버) | `com.nhn.android.search` |
| 네이버페이 (단독) | `com.nhn.android.naverpay` |

> 확장 시 `NotificationListenerService.kt`의 `CARD_APP_PACKAGES`에 패키지명만 추가하면 됩니다.

---

## 기술 스택

| 영역 | 기술 |
|---|---|
| 앱 | React Native 0.85 (Android) |
| 백엔드 | Supabase (PostgreSQL + Edge Functions) |
| 알림 수집 | Android NotificationListenerService (Kotlin) |
| 백그라운드 작업 | WorkManager 2.9 |
| AI 파싱 | Supabase Edge Function + Claude API |
| HTTP | OkHttp 4.12 |

---

## 자동화 파이프라인

```
카드/간편결제 결제
  → 알림 자동 수집 (NotificationListenerService)
  → parse-text Edge Function
  → transactions 저장
  → WorkManager 1시간 flush (앱 꺼져 있어도)
  → 주 1회 검수 푸시 알림
  → 검수 탭에서 빠르게 승인
  → monthly_summary 자동 갱신
  → 대시보드 예산/목표 달성률 반영
```

---

## 프로젝트 구조

```
.
├── src/engine/          # 파싱 엔진 (CSV, 텍스트, dedup)
├── supabase/functions/  # Edge Functions
│   ├── parse-csv              # CSV → 거래 데이터
│   ├── parse-text             # 텍스트/알림 → 거래 데이터
│   ├── classify-transactions  # AI 카테고리 분류
│   └── update-monthly-summary # 월간 집계 갱신
├── mobile/              # React Native 앱
│   ├── src/screens/     # 홈, 검수, 대시보드, 목표 등
│   ├── src/hooks/       # useTransactions, useDashboard, useBudget, useGoal 등
│   └── android/         # Kotlin 네이티브
│       └── java/com/mobile/
│           ├── NotificationListenerService.kt       # 알림 수집
│           ├── NotificationListenerModule.kt        # NativeModule
│           ├── FlushPendingNotificationsWorker.kt   # 1시간 자동 flush
│           ├── WeeklyReviewReminderWorker.kt        # 주간 푸시 알림
│           └── ShareIntentModule.kt                 # 공유 수신
└── __tests__/           # 엔진 테스트
```

---

## 시작하기

### 필수 조건

- Node.js 18+
- Android Studio + Android SDK
- Supabase 프로젝트

### 1. 환경 변수 설정

```bash
cp mobile/.env.example mobile/.env
```

`mobile/.env` 입력:
```
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
```

`mobile/android/local.properties` 생성:
```properties
sdk.dir=/Users/<username>/Library/Android/sdk
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-public-key
```

### 2. 의존성 설치

```bash
npm install
cd mobile && npm install
```

### 3. 앱 실행

```bash
cd mobile
npx react-native run-android
```

### 4. 알림 수집 권한 허가

앱 실행 후 목표 탭 → 홈 배너 또는 직접 설정:
```bash
adb shell am start -a android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
```

---

## 테스트

```bash
# 엔진 단위 테스트
npm test

# 타입 체크
cd mobile && npx tsc --noEmit
```

### ADB 알림 주입 테스트

```bash
# 카드사 알림
adb shell cmd notification post \
  -S bigtext \
  --pkg com.kbcard.kbkookmincard \
  --id 1 \
  "카드 승인" \
  "[국민카드] 05/27 14:30 스타벅스 6,500원 승인"

# 토스 알림
adb shell cmd notification post \
  -S bigtext \
  --pkg viva.republica.toss \
  --id 2 \
  "토스" \
  "스타벅스에서 6,500원 결제됐어요"

# Logcat 확인
adb logcat -s "NotificationListener" "FlushWorker" "WeeklyReminder"
```

---

## 보안 주의사항

- `SUPABASE_ANON_KEY`만 앱에 포함 (공개 키, RLS로 보호)
- `SERVICE_ROLE_KEY`는 Edge Function 서버 전용 — 앱에 절대 포함하지 않음
- `mobile/.env`, `mobile/android/local.properties`는 git에 커밋하지 않음

---

## 라이선스

MIT
