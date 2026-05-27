# NotificationListenerService 설계서

**날짜:** 2026-05-27  
**범위:** Android NotificationListenerService MVP — 카드사 4개 지원  
**연결 파이프라인:** 기존 `parse-text` Edge Function 재사용

---

## 1. 목적

카드사 앱 결제 알림을 백그라운드에서 자동 수집하여 `parse-text` 파이프라인으로 전달한다.  
사용자가 앱을 열지 않아도 카드 승인 알림이 자동으로 거래 내역에 기록된다.

---

## 2. 아키텍처 개요

```
[카드사 앱 알림 발생]
        │
        ▼
NotificationListenerService.kt
  ├─ packageName 화이트리스트 필터 (4개 카드사)
  ├─ 거래 키워드 확인 ("원 승인", "결제", "출금", "이용")
  ├─ dedup 체크 (SHA-256 key → SharedPreferences)
  └─ OkHttp POST → Supabase parse-text Edge Function
                   → raw_data INSERT + transactions UPSERT

[RN 앱]
  ├─ NotificationPermissionScreen.tsx
  │    └─ 권한 안내 UI → Android 알림 접근 설정 이동
  └─ NotificationListenerModule.kt (NativeModule)
       ├─ isPermissionGranted(): Promise<Boolean>
       └─ openPermissionSettings(): void
```

**Supabase 키 주입 경로:**
```
mobile/.env
  → android/local.properties  (git ignore)
  → app/build.gradle BuildConfig 필드
  → Kotlin BuildConfig.SUPABASE_URL / SUPABASE_ANON_KEY
```

---

## 3. 지원 카드사 (MVP)

| 카드사 | packageName |
|---|---|
| 국민카드 | `com.kbcard.kbkookmincard` |
| 신한카드 | `com.shinhancard.smart` |
| 삼성카드 | `com.samsung.android.spay` |
| 현대카드 | `com.hyundaicard.app` |

추후 확장 시 이 목록에만 추가하면 된다.

---

## 4. 컴포넌트 상세

### 4.1 NotificationListenerService.kt

**위치:** `android/app/src/main/java/com/mobile/`

**동작 흐름:**
1. `onNotificationPosted(sbn)` 호출
2. `sbn.packageName`이 화이트리스트에 없으면 즉시 return
3. `extras`에서 `EXTRA_TITLE`, `EXTRA_TEXT`, `EXTRA_BIG_TEXT` 추출
4. 추출 텍스트에 거래 키워드 포함 여부 확인
5. dedup key 계산 → SharedPreferences 체크
6. 중복 아니면 OkHttp로 `parse-text` 호출
7. 로그인 전이면 로컬 큐에 저장

**거래 키워드:** `"원 승인"`, `"결제"`, `"출금"`, `"이용"`  
하나라도 포함되면 거래 알림으로 판단.

**parse-text 호출 body:**
```json
{
  "text": "<알림 전문>",
  "userId": "<Supabase user.id>",
  "source": "notification"
}
```

### 4.2 NotificationListenerModule.kt (NativeModule)

**위치:** `android/app/src/main/java/com/mobile/`

```kotlin
// 권한 허가 여부 확인
fun isPermissionGranted(promise: Promise)

// Android 알림 접근 설정 화면으로 이동
fun openPermissionSettings()

// 로그인 전 로컬 큐에 쌓인 알림 텍스트를 parse-text로 일괄 처리
fun flushPendingNotifications(promise: Promise)
```

`NotificationManagerCompat.getEnabledListenerPackages(context)`로 현재 앱의 패키지명 포함 여부 확인.

### 4.3 NotificationListenerPackage.kt

`NotificationListenerModule`을 RN에 등록.  
`MainApplication.kt` PackageList에 `add(NotificationListenerPackage())` 추가.

### 4.4 NotificationPermissionScreen.tsx

**위치:** `mobile/src/screens/`

**표시 조건:** 홈 화면에서 권한 미허가 상태일 때 배너 또는 별도 화면  
**구성:**
- 아이콘 + "자동 수집을 켜면 카드 알림이 자동으로 기록됩니다" 설명
- "왜 이 권한이 필요한가요?" 1-2줄 (민감 권한 사용자 신뢰 확보)
- "설정 열기" 버튼 → `openPermissionSettings()`
- `AppState.change` 이벤트로 설정 복귀 시 권한 재체크

**TypeScript NativeModule 타입:**
```ts
declare module 'react-native' {
  interface NativeModulesStatic {
    NotificationListenerModule: {
      isPermissionGranted: () => Promise<boolean>
      openPermissionSettings: () => void
    }
  }
}
```

### 4.5 AndroidManifest.xml 추가

```xml
<service
  android:name=".NotificationListenerService"
  android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
  android:exported="true">
  <intent-filter>
    <action android:name="android.service.notification.NotificationListenerService"/>
  </intent-filter>
</service>
```

### 4.6 BuildConfig Supabase 키 주입

**`android/local.properties` 추가 (git ignore):**
```properties
SUPABASE_URL=https://jyqvcavxxzmpkonmkupj.supabase.co
SUPABASE_ANON_KEY=eyJ...  # mobile/.env의 SUPABASE_ANON_KEY 값과 동일하게 입력
```
> `mobile/.env`와 `android/local.properties`는 별개 파일이다 — 자동 동기화 없음.  
> 값을 변경할 때는 두 파일 모두 수정해야 한다.

**`android/app/build.gradle` 추가:**
```groovy
def localProps = new Properties()
localProps.load(new FileInputStream(rootProject.file("local.properties")))

android {
  defaultConfig {
    buildConfigField "String", "SUPABASE_URL", "\"${localProps['SUPABASE_URL']}\""
    buildConfigField "String", "SUPABASE_ANON_KEY", "\"${localProps['SUPABASE_ANON_KEY']}\""
  }
}
```

---

## 5. 중복 방지 (dedup)

```
key = SHA-256(packageName + title + text + floor(epochMs / 600_000))
```

- 10분 윈도우: 같은 알림이 OS에서 2-3회 발송되는 경우 방어
- SharedPreferences `notification_dedup_keys` 에 저장
- 최대 200개 유지 (초과 시 가장 오래된 것부터 제거)
- 앱 재설치 시 초기화됨 (DB dedup_key가 최종 방어선)

---

## 6. 로그인 전 처리 (로컬 큐)

- 서비스 시작 시 Supabase 세션 없으면 알림 텍스트를 SharedPreferences 큐에 저장
- 앱이 열릴 때 `NotificationListenerModule.flushPendingNotifications()` 호출
- 큐의 텍스트를 `parse-text`로 일괄 처리 후 큐 비움
- MVP에서는 최대 20개까지만 보관 (초과 시 오래된 것 버림)

---

## 7. 에러 처리

| 상황 | 처리 |
|---|---|
| 네트워크 없음 | 로컬 큐 저장 → 다음 알림 시 재시도 |
| parse-text 5xx | 로그만 기록, 재시도 없음 (MVP) |
| userId 없음 | 로컬 큐 저장 → 로그인 후 flush |
| 권한 없음 | OS가 서비스 자체를 실행하지 않음 |
| 키워드 미매칭 | 조용히 무시 (로그 없음) |

---

## 8. 테스트 방법

### ADB 테스트 알림 주입
```bash
adb shell cmd notification post \
  -S bigtext \
  --pkg com.kbcard.kbkookmincard \
  --id 1 \
  "카드 승인" \
  "[국민카드] 05/27 14:30 스타벅스 6,500원 승인"
```

### Logcat 필터
```bash
adb logcat -s "NotificationListener"
```

### 권한 확인
```bash
adb shell cmd notification list-listeners
```

### 실기기 검증
1. Android 설정 → 앱 → 특별한 앱 접근권한 → 알림 접근에서 앱 활성화
2. 국민카드 앱에서 소액 결제 또는 테스트 알림 발송
3. Supabase Dashboard → transactions 테이블에서 행 확인

---

## 9. 구현 순서

1. `android/local.properties` + `build.gradle` BuildConfig 설정
2. `NotificationListenerService.kt` 구현
3. `AndroidManifest.xml` 서비스 등록
4. `NotificationListenerModule.kt` + `NotificationListenerPackage.kt` 구현
5. `MainApplication.kt` 패키지 등록
6. `NotificationPermissionScreen.tsx` 구현
7. `HomeScreen.tsx`에 권한 배너 연결
8. ADB로 동작 검증

---

## 10. 범위 외 (이번 구현에서 제외)

- iOS 지원 (Android 전용)
- SMS 권한 기반 수집 (Notification Listener 우선)
- 간편결제 앱 (카카오페이, 토스, 네이버페이) — Phase 2
- 알림 히스토리 화면
- 자동 flush 스케줄러 (WorkManager) — Phase 2
