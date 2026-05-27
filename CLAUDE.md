# 자동화가계부 Claude 작업 지시서

## 현재 상태

이 프로젝트는 "가계부 앱"이 아니라 "개인 소비 데이터 자동화 엔진"을 중심으로 만든 Android-first MVP입니다.

완료된 큰 작업:

- Plan 1: 엔진 + 백엔드 구현 완료
  - CSV 파서
  - 텍스트 파서
  - dedup 로직
  - Supabase Edge Functions
  - classify-transactions
  - update-monthly-summary
  - 테스트 픽스처 + 파이프라인 테스트
- Plan 2: Android 앱 UI 구현 완료
  - React Native CLI 앱
  - Supabase 클라이언트
  - 로그인
  - 홈 / 거래목록 / 검수 / 대시보드 / 목표 탭
  - CSV 업로드 UI
  - Share Intent 기초 연결
  - Lovable에서 만든 모바일 UI 디자인을 React Native 컴포넌트로 이식
  - Android safe area 대응 완료

최근 커밋:

- `2508093 feat: apply Lovable UI to mobile app`
- `6b75890 fix: respect safe area in mobile UI`

## 핵심 제품 방향

제품 정의:

> 카드만 쓰면 소비가 자동 정리되고, 삶 목표까지 관리되는 생활 예산 코치.

중요한 UX 원칙:

- 사용자가 매일 입력하는 앱이 되면 실패한다.
- 자동 수집, 자동 정리, 주 1회 검수 구조를 끝까지 유지한다.
- "절약 강요"가 아니라 "원하는 삶을 위해 소비 흐름을 정리"하는 톤을 유지한다.

## 주요 문서

먼저 아래 문서를 읽고 작업한다.

- `docs/superpowers/specs/2026-05-26-자동화가계부-design.md`
- `docs/superpowers/plans/2026-05-26-엔진-백엔드.md`
- `docs/superpowers/plans/2026-05-26-앱-UI.md`

## 프로젝트 구조

```txt
.
├── src/engine
│   ├── csv
│   ├── text
│   ├── dedup.ts
│   └── types.ts
├── supabase
│   └── functions
│       ├── parse-csv
│       ├── parse-text
│       ├── classify-transactions
│       └── update-monthly-summary
├── mobile
│   ├── src/components/ui
│   ├── src/screens
│   ├── src/navigation
│   ├── src/hooks
│   └── android
└── __tests__
```

## 실행 전 필수 설정

`mobile/src/lib/supabase.ts`의 아래 값을 실제 Supabase 프로젝트 값으로 교체해야 한다.

```ts
const SUPABASE_URL = '...'
const SUPABASE_ANON_KEY = '...'
```

주의:

- service role key는 앱에 넣지 않는다.
- anon public key만 앱에 넣는다.
- 실제 키를 커밋하지 않는 방향이 더 안전하다. 가능하면 `.env` 또는 RN config로 분리한다.

## 검증 명령

루트 엔진 테스트:

```bash
npm test
```

모바일 타입 체크:

```bash
cd mobile
npx tsc --noEmit
```

Android 실행:

```bash
cd mobile
npx react-native run-android
```

Metro만 실행:

```bash
cd mobile
npm start -- --reset-cache
```

## 현재 QA 메모

한글 경로에서 Android Gradle 빌드가 불안정할 수 있어 ASCII 경로 복사본으로 QA한 적이 있다.

QA 복사본:

```txt
/Users/apple/Documents/Codex/2026-05-26/new-chat/auto-budget-app
```

원본 프로젝트:

```txt
/Users/apple/Desktop/자동화가계부
```

원본을 수정하고, 빌드 문제가 있으면 복사본으로 동기화해서 Android 실행을 확인한다.

확인된 화면:

- 홈 화면 정상 렌더링
- safe area 겹침 해결
- 거래목록 탭 이동 정상

에뮬레이터는 메모리 압박으로 Metro timeout이 가끔 발생했다. 코드 문제로 단정하지 말고, ADB/Metro 재시작 후 다시 확인한다.

## 다음 작업 순서

### 1. Supabase 환경값 정리

목표:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

를 하드코딩하지 않도록 정리한다.

추천:

- `react-native-config` 또는 RN에서 안전하게 읽을 수 있는 env 방식 도입
- `.env.example` 추가
- 실제 `.env`는 git ignore

완료 조건:

- 앱 코드에 placeholder가 남지 않는다.
- 실제 secret/service role key는 커밋되지 않는다.
- `npx tsc --noEmit` 통과.

### 2. CSV 업로드 실제 플로우 점검

목표:

- 홈의 CSV 업로드 버튼에서 파일 선택
- Supabase Storage 업로드
- `parse-csv` Edge Function 호출
- 거래 목록 갱신

확인할 것:

- `@react-native-documents/picker` 동작
- 업로드 실패 시 사용자 메시지
- bank_code 전달
- 파싱 결과가 `transactions`에 들어가는지

### 3. Share Intent 실제 수신 점검

목표:

- Android 공유하기로 카드 알림 텍스트를 앱에 전달
- `parse-text` 파이프라인으로 저장

확인할 것:

- `AndroidManifest.xml`
- `MainActivity.kt`
- `App.tsx`의 initial/shared text 처리
- 앱이 꺼져 있을 때와 켜져 있을 때 모두 동작하는지

### 4. Plan 3: NotificationListenerService 설계 및 구현

이 앱의 핵심 자동화 기능이다.

목표:

- 금융 앱 알림을 직접 수집
- 카드 승인/결제/출금 알림 텍스트만 필터링
- 기존 `parse-text` 파이프라인으로 연결

구현 방향:

```txt
Android NotificationListenerService
  -> 금융 앱 packageName 필터링
  -> title/text/bigText 추출
  -> 거래 키워드 확인
  -> 중복 raw_data 방지
  -> Supabase raw_data 저장
  -> parse-text 호출
```

주의:

- 사용자 명시 동의 화면 필요.
- Android 설정의 Notification Access로 이동시키는 UI 필요.
- 민감 권한이므로 왜 필요한지 짧고 명확히 설명해야 한다.
- SMS 권한보다 Notification Listener를 우선한다.

### 5. 검수 UX 보강

목표:

- `pending_review` 거래를 빠르게 승인/수정
- 같은 merchant 수정 시 `user_category_hints`에 저장

확인할 것:

- 승인 후 목록에서 즉시 제거
- 카테고리 수정 후 `reviewed`
- monthly_summary 갱신 호출

### 6. 대시보드/목표 실제 데이터 연결

목표:

- `monthly_summary`
- `budgets`
- `goals`

를 실제 Supabase 데이터로 렌더링한다.

확인할 것:

- 이번 달 총 지출
- 카테고리별 비중
- 예산 소진율
- 목표 진행률

## 코드 스타일

- 기존 React Native 컴포넌트 스타일을 유지한다.
- `mobile/src/theme.ts`의 색상, 간격, radius를 우선 사용한다.
- UI는 "가계부 작성 앱"보다 "자동 생활 예산 코치" 느낌을 유지한다.
- 무리한 리팩터링은 하지 않는다.
- 작업 후 타입 체크와 관련 테스트를 실행한다.

## 작업 완료 기준

각 작업은 아래를 만족해야 완료로 본다.

- 구현 코드 존재
- 타입 체크 통과
- 가능한 테스트 통과
- Android 화면 또는 로그로 최소 동작 확인
- git status 확인
- 의미 있는 단위로 커밋

