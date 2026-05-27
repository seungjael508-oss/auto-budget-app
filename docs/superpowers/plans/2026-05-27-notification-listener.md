# NotificationListenerService 구현 플랜

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 카드사 앱 결제 알림을 백그라운드에서 자동 수집해 기존 `parse-text` 파이프라인으로 저장한다.

**Architecture:** Kotlin `NotificationListenerService`가 독립 백그라운드로 실행 — 앱이 꺼져 있어도 알림 수신. 필터링 후 OkHttp로 Supabase `parse-text` Edge Function에 직접 POST. RN `NotificationListenerModule`(NativeModule)이 권한 확인·설정 이동·userId 동기화·로컬 큐 반환을 담당.

**Tech Stack:** Kotlin, OkHttp, Android NotificationListenerService, SharedPreferences, React Native NativeModule, TypeScript

---

## 파일 맵

| 경로 | 작업 |
|---|---|
| `mobile/android/local.properties` | 생성 — Supabase 키 저장 (git ignore) |
| `mobile/android/app/build.gradle` | 수정 — BuildConfig 필드 + OkHttp 의존성 |
| `mobile/android/app/src/main/AndroidManifest.xml` | 수정 — 서비스 등록 |
| `mobile/android/app/src/main/java/com/mobile/NotificationListenerService.kt` | 생성 — 핵심 서비스 |
| `mobile/android/app/src/main/java/com/mobile/NotificationListenerModule.kt` | 생성 — NativeModule |
| `mobile/android/app/src/main/java/com/mobile/NotificationListenerPackage.kt` | 생성 — 패키지 등록 |
| `mobile/android/app/src/main/java/com/mobile/MainApplication.kt` | 수정 — 패키지 추가 |
| `mobile/src/types/native-modules.d.ts` | 생성 — TS 타입 선언 |
| `mobile/src/screens/NotificationPermissionScreen.tsx` | 생성 — 권한 동의 UI |
| `mobile/src/screens/HomeScreen.tsx` | 수정 — 권한 배너 연결 |
| `mobile/src/hooks/useAuth.ts` | 수정 — userId 동기화 |
| `mobile/App.tsx` | 수정 — 로그인 후 로컬 큐 flush |

---

## Task 1: BuildConfig Supabase 키 주입

**Files:**
- Create: `mobile/android/local.properties`
- Modify: `mobile/android/app/build.gradle`

- [ ] **Step 1: local.properties 생성**

`mobile/android/local.properties` 파일을 생성한다 (이미 있으면 아래 줄만 추가):

```properties
# Android SDK 경로 (기기마다 다름 — SDK Manager에서 확인)
sdk.dir=/Users/apple/Library/Android/sdk

# Supabase — mobile/.env의 값과 동일하게 입력
SUPABASE_URL=https://jyqvcavxxzmpkonmkupj.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5cXZjYXZ4eHptcGtvbm1rdXBqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4MTUyMjcsImV4cCI6MjA5NTM5MTIyN30.2Lu0WqyO5a_y5vw6nmSXCQyaO5a2ga1kn1LBanZIeWo
```

- [ ] **Step 2: .gitignore에 local.properties 확인**

루트 `.gitignore`에 `android/local.properties` 가 없으면 추가:

```
mobile/android/local.properties
```

- [ ] **Step 3: build.gradle 수정**

`mobile/android/app/build.gradle` 의 `android { defaultConfig { ... } }` 블록과 `dependencies { }` 블록을 아래와 같이 수정한다.

**`defaultConfig` 블록 위에 추가 (파일 최상단 근처):**
```groovy
def localProps = new Properties()
def localPropsFile = rootProject.file("local.properties")
if (localPropsFile.exists()) {
    localProps.load(new FileInputStream(localPropsFile))
}
```

**`defaultConfig { }` 안에 추가:**
```groovy
buildConfigField "String", "SUPABASE_URL", "\"${localProps.getProperty('SUPABASE_URL', '')}\""
buildConfigField "String", "SUPABASE_ANON_KEY", "\"${localProps.getProperty('SUPABASE_ANON_KEY', '')}\""
```

**`dependencies { }` 안에 추가:**
```groovy
implementation("com.squareup.okhttp3:okhttp:4.12.0")
```

**`android { }` 블록 안에 추가 (buildFeatures 설정):**
```groovy
buildFeatures {
    buildConfig true
}
```

- [ ] **Step 4: 빌드 확인**

```bash
cd mobile/android && ./gradlew assembleDebug 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 5: 커밋**

```bash
git add .gitignore mobile/android/app/build.gradle
git commit -m "build: BuildConfig Supabase 키 주입 + OkHttp 의존성 추가"
```

---

## Task 2: NotificationListenerService.kt 구현

**Files:**
- Create: `mobile/android/app/src/main/java/com/mobile/NotificationListenerService.kt`

- [ ] **Step 1: 파일 생성**

```kotlin
package com.mobile

import android.app.Notification
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.util.concurrent.TimeUnit

class NotificationListenerService : NotificationListenerService() {

    companion object {
        private const val TAG = "NotificationListener"

        // MVP 지원 카드사 packageName (확장 시 여기만 추가)
        private val CARD_APP_PACKAGES = setOf(
            "com.kbcard.kbkookmincard",   // 국민카드
            "com.shinhancard.smart",       // 신한카드
            "com.samsung.android.spay",    // 삼성카드
            "com.hyundaicard.app",         // 현대카드
        )

        // 거래 알림 판별 키워드
        private val TRANSACTION_KEYWORDS = listOf("원 승인", "결제", "출금", "이용")

        // 10분 윈도우 — 동일 알림 OS 중복 발송 방어
        private const val DEDUP_WINDOW_MS = 10 * 60 * 1000L
        private const val MAX_DEDUP_SIZE = 200
        private const val MAX_QUEUE_SIZE = 20
    }

    private val httpClient: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(15, TimeUnit.SECONDS)
            .build()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        sbn ?: return

        // 1. packageName 화이트리스트 체크
        if (sbn.packageName !in CARD_APP_PACKAGES) return

        // 2. 알림 텍스트 추출 (bigText 우선)
        val extras = sbn.notification?.extras ?: return
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val fullText = bigText.ifBlank { text }
        val combined = "$title $fullText"

        // 3. 거래 키워드 체크
        if (TRANSACTION_KEYWORDS.none { combined.contains(it) }) return

        // 4. 중복 체크
        val dedupKey = buildDedupKey(sbn.packageName, title, fullText)
        if (isDuplicate(dedupKey)) {
            Log.d(TAG, "중복 알림 무시: ${sbn.packageName}")
            return
        }
        saveDedupKey(dedupKey)

        val payload = combined.trim()
        Log.d(TAG, "거래 알림 수신: $payload")

        // 5. userId 확인 → 없으면 로컬 큐에 저장
        val prefs = applicationContext.getSharedPreferences(
            NotificationListenerModule.PREFS_NAME, Context.MODE_PRIVATE
        )
        val userId = prefs.getString(NotificationListenerModule.USER_ID_KEY, null)

        if (userId == null) {
            saveToQueue(prefs, payload)
            Log.d(TAG, "userId 없음 — 로컬 큐 저장")
            return
        }

        // 6. 백그라운드 스레드에서 parse-text 호출 (네트워크 I/O)
        Thread { sendToParseText(prefs, payload, userId) }.start()
    }

    private fun sendToParseText(prefs: android.content.SharedPreferences, text: String, userId: String) {
        val json = JSONObject().apply {
            put("text", text)
            put("userId", userId)
            put("source", "notification")
        }
        val body = json.toString().toRequestBody("application/json".toMediaType())
        val request = Request.Builder()
            .url("${BuildConfig.SUPABASE_URL}/functions/v1/parse-text")
            .addHeader("Authorization", "Bearer ${BuildConfig.SUPABASE_ANON_KEY}")
            .addHeader("apikey", BuildConfig.SUPABASE_ANON_KEY)
            .post(body)
            .build()

        try {
            httpClient.newCall(request).execute().use { response ->
                Log.d(TAG, "parse-text 응답: ${response.code}")
            }
        } catch (e: Exception) {
            // 네트워크 오류 시 로컬 큐에 저장
            saveToQueue(prefs, text)
            Log.e(TAG, "parse-text 호출 실패: ${e.message}")
        }
    }

    // SHA-256(packageName|title|text|10분윈도우)
    private fun buildDedupKey(packageName: String, title: String, text: String): String {
        val window = System.currentTimeMillis() / DEDUP_WINDOW_MS
        val raw = "$packageName|$title|$text|$window"
        val digest = MessageDigest.getInstance("SHA-256")
        return digest.digest(raw.toByteArray()).joinToString("") { "%02x".format(it) }
    }

    private fun isDuplicate(key: String): Boolean {
        val prefs = applicationContext.getSharedPreferences(
            NotificationListenerModule.PREFS_NAME, Context.MODE_PRIVATE
        )
        val arr = JSONArray(prefs.getString(NotificationListenerModule.DEDUP_KEY, "[]") ?: "[]")
        for (i in 0 until arr.length()) {
            if (arr.getString(i) == key) return true
        }
        return false
    }

    private fun saveDedupKey(key: String) {
        val prefs = applicationContext.getSharedPreferences(
            NotificationListenerModule.PREFS_NAME, Context.MODE_PRIVATE
        )
        val existing = prefs.getString(NotificationListenerModule.DEDUP_KEY, "[]") ?: "[]"
        val arr = JSONArray(existing)
        val newArr = JSONArray()
        // MAX_DEDUP_SIZE 초과 시 오래된 것(index 0부터) 제거
        val startIdx = if (arr.length() >= MAX_DEDUP_SIZE) arr.length() - MAX_DEDUP_SIZE + 1 else 0
        for (i in startIdx until arr.length()) newArr.put(arr.getString(i))
        newArr.put(key)
        prefs.edit().putString(NotificationListenerModule.DEDUP_KEY, newArr.toString()).apply()
    }

    private fun saveToQueue(prefs: android.content.SharedPreferences, text: String) {
        val existing = prefs.getString(NotificationListenerModule.QUEUE_KEY, "[]") ?: "[]"
        val arr = JSONArray(existing)
        val newArr = JSONArray()
        // MAX_QUEUE_SIZE 초과 시 오래된 것 제거
        val startIdx = if (arr.length() >= MAX_QUEUE_SIZE) arr.length() - MAX_QUEUE_SIZE + 1 else 0
        for (i in startIdx until arr.length()) newArr.put(arr.getString(i))
        newArr.put(text)
        prefs.edit().putString(NotificationListenerModule.QUEUE_KEY, newArr.toString()).apply()
    }
}
```

- [ ] **Step 2: 커밋**

```bash
git add mobile/android/app/src/main/java/com/mobile/NotificationListenerService.kt
git commit -m "feat: NotificationListenerService 구현 (카드사 4개, dedup, 로컬 큐)"
```

---

## Task 3: AndroidManifest.xml 서비스 등록

**Files:**
- Modify: `mobile/android/app/src/main/AndroidManifest.xml`

- [ ] **Step 1: `</application>` 태그 바로 앞에 서비스 선언 추가**

```xml
<!-- NotificationListenerService: 카드사 알림 자동 수집 -->
<!-- android.permission.BIND_NOTIFICATION_LISTENER_SERVICE — OS가 강제 부여, 사용자가 설정에서 허가 -->
<service
    android:name=".NotificationListenerService"
    android:label="자동화가계부 알림 수집"
    android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
    android:exported="true">
    <intent-filter>
        <action android:name="android.service.notification.NotificationListenerService"/>
    </intent-filter>
</service>
```

완성된 전체 파일:

```xml
<manifest xmlns:android="http://schemas.android.com/apk/res/android">

    <uses-permission android:name="android.permission.INTERNET" />

    <application
      android:name=".MainApplication"
      android:label="@string/app_name"
      android:icon="@mipmap/ic_launcher"
      android:roundIcon="@mipmap/ic_launcher_round"
      android:allowBackup="false"
      android:theme="@style/AppTheme"
      android:usesCleartextTraffic="${usesCleartextTraffic}"
      android:supportsRtl="true">
      <activity
        android:name=".MainActivity"
        android:label="@string/app_name"
        android:configChanges="keyboard|keyboardHidden|orientation|screenLayout|screenSize|smallestScreenSize|uiMode"
        android:launchMode="singleTask"
        android:windowSoftInputMode="adjustResize"
        android:exported="true">
        <intent-filter>
            <action android:name="android.intent.action.MAIN" />
            <category android:name="android.intent.category.LAUNCHER" />
        </intent-filter>

        <!-- Share Intent: 카드사 SMS 텍스트 공유 수신 -->
        <intent-filter>
            <action android:name="android.intent.action.SEND" />
            <category android:name="android.intent.category.DEFAULT" />
            <data android:mimeType="text/plain" />
        </intent-filter>
      </activity>

      <!-- NotificationListenerService: 카드사 알림 자동 수집 -->
      <service
          android:name=".NotificationListenerService"
          android:label="자동화가계부 알림 수집"
          android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"
          android:exported="true">
          <intent-filter>
              <action android:name="android.service.notification.NotificationListenerService"/>
          </intent-filter>
      </service>
    </application>
</manifest>
```

- [ ] **Step 2: 커밋**

```bash
git add mobile/android/app/src/main/AndroidManifest.xml
git commit -m "feat: AndroidManifest에 NotificationListenerService 등록"
```

---

## Task 4: NotificationListenerModule.kt + NotificationListenerPackage.kt

**Files:**
- Create: `mobile/android/app/src/main/java/com/mobile/NotificationListenerModule.kt`
- Create: `mobile/android/app/src/main/java/com/mobile/NotificationListenerPackage.kt`

- [ ] **Step 1: NotificationListenerModule.kt 생성**

```kotlin
package com.mobile

import android.content.Context
import android.content.Intent
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.*
import org.json.JSONArray

/**
 * JS → Native 브릿지
 * - 권한 확인 / 설정 이동
 * - userId 동기화 (로그인/로그아웃 시 호출)
 * - 로컬 큐 반환 (로그인 후 flush)
 */
class NotificationListenerModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        // NotificationListenerService와 공유하는 SharedPreferences 키
        const val PREFS_NAME = "notification_listener_prefs"
        const val USER_ID_KEY = "user_id"
        const val DEDUP_KEY = "dedup_keys"
        const val QUEUE_KEY = "pending_queue"
    }

    override fun getName(): String = "NotificationListenerModule"

    /**
     * 알림 접근 권한 허가 여부 확인
     * Android 설정에서 앱이 활성화됐는지 체크
     */
    @ReactMethod
    fun isPermissionGranted(promise: Promise) {
        val context = reactApplicationContext
        val enabledPackages = NotificationManagerCompat.getEnabledListenerPackages(context)
        promise.resolve(enabledPackages.contains(context.packageName))
    }

    /**
     * Android 알림 접근 설정 화면으로 이동
     * 사용자가 직접 앱을 활성화해야 한다
     */
    @ReactMethod
    fun openPermissionSettings() {
        val intent = Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        reactApplicationContext.startActivity(intent)
    }

    /**
     * 로그인 후 호출 — 서비스가 parse-text를 호출할 때 사용할 userId 저장
     */
    @ReactMethod
    fun setUserId(userId: String) {
        reactApplicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().putString(USER_ID_KEY, userId).apply()
    }

    /**
     * 로그아웃 후 호출 — 서비스가 알림을 로컬 큐에만 저장하도록 userId 제거
     */
    @ReactMethod
    fun clearUserId() {
        reactApplicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            .edit().remove(USER_ID_KEY).apply()
    }

    /**
     * 로그인 전 수집된 알림 텍스트 배열을 반환하고 큐를 비운다.
     * JS에서 각 항목을 parse-text로 처리한다.
     */
    @ReactMethod
    fun getAndClearPendingNotifications(promise: Promise) {
        val prefs = reactApplicationContext
            .getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val json = prefs.getString(QUEUE_KEY, "[]") ?: "[]"
        val arr = JSONArray(json)

        // 큐 비우기
        prefs.edit().putString(QUEUE_KEY, "[]").apply()

        // WritableArray로 변환하여 JS에 반환
        val result = Arguments.createArray()
        for (i in 0 until arr.length()) {
            result.pushString(arr.getString(i))
        }
        promise.resolve(result)
    }

    // RN New Architecture 요구 — EventEmitter stub
    @ReactMethod
    fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

    @ReactMethod
    fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) {}
}
```

- [ ] **Step 2: NotificationListenerPackage.kt 생성**

```kotlin
package com.mobile

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class NotificationListenerPackage : ReactPackage {
    override fun createNativeModules(context: ReactApplicationContext): List<NativeModule> =
        listOf(NotificationListenerModule(context))

    override fun createViewManagers(context: ReactApplicationContext): List<ViewManager<*, *>> =
        emptyList()
}
```

- [ ] **Step 3: 커밋**

```bash
git add mobile/android/app/src/main/java/com/mobile/NotificationListenerModule.kt \
        mobile/android/app/src/main/java/com/mobile/NotificationListenerPackage.kt
git commit -m "feat: NotificationListenerModule NativeModule 구현"
```

---

## Task 5: MainApplication.kt 패키지 등록

**Files:**
- Modify: `mobile/android/app/src/main/java/com/mobile/MainApplication.kt`

- [ ] **Step 1: packages.apply 블록에 추가**

```kotlin
packageList =
  PackageList(this).packages.apply {
    add(ShareIntentPackage())
    add(NotificationListenerPackage())  // 알림 수집 NativeModule
  },
```

완성된 전체 파일:

```kotlin
package com.mobile

import android.app.Application
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(ShareIntentPackage())
          add(NotificationListenerPackage())  // 알림 수집 NativeModule
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    loadReactNative(this)
  }
}
```

- [ ] **Step 2: 빌드 확인**

```bash
cd mobile/android && ./gradlew assembleDebug 2>&1 | tail -20
```

Expected: `BUILD SUCCESSFUL`

- [ ] **Step 3: 커밋**

```bash
git add mobile/android/app/src/main/java/com/mobile/MainApplication.kt
git commit -m "feat: NotificationListenerPackage 등록"
```

---

## Task 6: TypeScript NativeModule 타입 선언

**Files:**
- Create: `mobile/src/types/native-modules.d.ts`

- [ ] **Step 1: 타입 선언 파일 생성**

```typescript
// NativeModules 타입 확장 — Android 전용 NativeModule 선언
// iOS에서는 이 모듈들이 undefined — 호출 전 null 체크 필수
import 'react-native'

declare module 'react-native' {
  interface NativeModulesStatic {
    NotificationListenerModule: {
      isPermissionGranted: () => Promise<boolean>
      openPermissionSettings: () => void
      setUserId: (userId: string) => void
      clearUserId: () => void
      getAndClearPendingNotifications: () => Promise<string[]>
    }
  }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd mobile && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/types/native-modules.d.ts
git commit -m "feat: NotificationListenerModule TypeScript 타입 선언"
```

---

## Task 7: useAuth.ts userId 동기화

**Files:**
- Modify: `mobile/src/hooks/useAuth.ts`

로그인 시 `setUserId()`, 로그아웃 시 `clearUserId()` 호출.  
로그인 후 로컬 큐에 쌓인 알림을 flush하는 콜백도 추가.

- [ ] **Step 1: useAuth.ts 수정**

```typescript
import { useEffect, useState, useCallback } from 'react'
import { NativeModules, Platform } from 'react-native'
import { Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

const { NotificationListenerModule } = NativeModules

// 로그인 후 로컬 큐 flush 콜백 타입
type OnPendingNotifications = (texts: string[]) => void

export function useAuth(onPendingNotifications?: OnPendingNotifications) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  const syncUserIdToNative = useCallback((userId: string | null) => {
    // Android 전용 — iOS는 NotificationListenerModule 없음
    if (Platform.OS !== 'android' || !NotificationListenerModule) return

    if (userId) {
      // 로그인: userId 저장 + 로컬 큐 flush
      NotificationListenerModule.setUserId(userId)
      NotificationListenerModule.getAndClearPendingNotifications().then(
        (texts: string[]) => {
          if (texts.length > 0 && onPendingNotifications) {
            onPendingNotifications(texts)
          }
        }
      )
    } else {
      // 로그아웃: userId 제거
      NotificationListenerModule.clearUserId()
    }
  }, [onPendingNotifications])

  useEffect(() => {
    // 앱 시작 시 저장된 세션 복원
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      syncUserIdToNative(session?.user?.id ?? null)
      setLoading(false)
    })

    // 로그인/로그아웃 이벤트 구독
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      syncUserIdToNative(session?.user?.id ?? null)
    })

    return () => subscription.unsubscribe()
  }, [syncUserIdToNative])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
  }

  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }

  return { session, loading, signIn, signUp, signOut }
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd mobile && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/hooks/useAuth.ts
git commit -m "feat: useAuth — 로그인 시 userId Native 동기화 + 로컬 큐 flush"
```

---

## Task 8: RootNavigator.tsx 로컬 큐 flush 연결

**Files:**
- Modify: `mobile/src/navigation/RootNavigator.tsx`

`useAuth`는 `RootNavigator.tsx`에서 호출된다. 여기서 `onPendingNotifications` 콜백을 전달해 로그인 후 쌓인 알림을 처리한다.

- [ ] **Step 1: RootNavigator.tsx 수정**

```typescript
import React, { useCallback } from 'react'
import { ActivityIndicator, View } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import LoginScreen from '../screens/LoginScreen'
import AppTabs from './AppTabs'

const Stack = createNativeStackNavigator()

// 로그인 전 쌓인 알림 큐를 parse-text로 일괄 처리
async function flushNotificationQueue(texts: string[], userId: string) {
  for (const text of texts) {
    try {
      await supabase.functions.invoke('parse-text', {
        body: { text, userId, source: 'notification' },
      })
      console.log('[알림 큐 flush] 처리 완료:', text.slice(0, 30))
    } catch (e) {
      console.error('[알림 큐 flush] 오류:', e)
    }
  }
}

export default function RootNavigator() {
  // 로그인 직후 로컬 큐에 쌓인 알림을 parse-text로 전송
  const handlePendingNotifications = useCallback(async (texts: string[]) => {
    if (texts.length === 0) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    console.log(`[알림 큐] 로그인 후 ${texts.length}건 처리`)
    await flushNotificationQueue(texts, user.id)
  }, [])

  const { session, loading } = useAuth(handlePendingNotifications)

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#3B82F6" />
      </View>
    )
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {session
          ? <Stack.Screen name="App" component={AppTabs} />
          : <Stack.Screen name="Login" component={LoginScreen} />
        }
      </Stack.Navigator>
    </NavigationContainer>
  )
}
```

- [ ] **Step 2: 타입 체크**

```bash
cd mobile && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/navigation/RootNavigator.tsx
git commit -m "feat: RootNavigator — 로그인 후 알림 로컬 큐 flush 연결"
```

---

## Task 9: NotificationPermissionScreen.tsx 구현

**Files:**
- Create: `mobile/src/screens/NotificationPermissionScreen.tsx`

- [ ] **Step 1: 화면 컴포넌트 생성**

```typescript
import React, { useCallback, useEffect, useState } from 'react'
import {
  AppState,
  NativeModules,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Screen from '../components/ui/Screen'
import TopBar from '../components/ui/TopBar'
import Card from '../components/ui/Card'
import { colors, fontSize, fontWeight, radius, spacing } from '../theme'

const { NotificationListenerModule } = NativeModules

export default function NotificationPermissionScreen() {
  const [granted, setGranted] = useState<boolean | null>(null)

  const checkPermission = useCallback(async () => {
    if (Platform.OS !== 'android' || !NotificationListenerModule) return
    const isGranted: boolean = await NotificationListenerModule.isPermissionGranted()
    setGranted(isGranted)
  }, [])

  useEffect(() => {
    checkPermission()

    // 설정에서 돌아올 때 권한 재체크
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') checkPermission()
    })
    return () => sub.remove()
  }, [checkPermission])

  const handleOpenSettings = () => {
    NotificationListenerModule?.openPermissionSettings()
  }

  if (granted === null) return null  // 권한 확인 전 빈 화면

  return (
    <>
      <TopBar title="자동 수집 설정" />
      <Screen>
        <Card style={styles.card}>
          <Text style={styles.icon}>🔔</Text>
          <Text style={styles.title}>카드 알림 자동 수집</Text>
          <Text style={styles.desc}>
            카드사 앱 결제 알림을 받으면 자동으로 거래가 기록됩니다.{'\n'}
            별도 입력 없이 소비가 정리됩니다.
          </Text>

          <View style={styles.reasonBox}>
            <Text style={styles.reasonTitle}>이 권한이 필요한 이유</Text>
            <Text style={styles.reasonDesc}>
              앱이 꺼져 있어도 카드 승인 알림을 받아야 자동 수집이 됩니다.
              알림 내용은 본인의 거래 기록 저장에만 사용되며, 외부로 전송되지 않습니다.
            </Text>
          </View>

          {granted ? (
            <View style={styles.grantedBadge}>
              <Text style={styles.grantedText}>✅ 알림 접근 허가됨</Text>
            </View>
          ) : (
            <Pressable style={styles.button} onPress={handleOpenSettings}>
              <Text style={styles.buttonText}>Android 설정에서 허가하기</Text>
            </Pressable>
          )}
        </Card>

        {!granted && (
          <Text style={styles.guide}>
            설정 → 특별한 앱 접근권한 → 알림 접근 → 자동화가계부 활성화
          </Text>
        )}
      </Screen>
    </>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: fontWeight.bold,
    color: colors.gray900,
    textAlign: 'center',
  },
  desc: {
    fontSize: fontSize.md,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 22,
  },
  reasonBox: {
    width: '100%',
    backgroundColor: colors.surfaceStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  reasonTitle: {
    fontSize: fontSize.sm,
    fontWeight: fontWeight.semibold,
    color: colors.gray900,
  },
  reasonDesc: {
    fontSize: fontSize.sm,
    color: colors.muted,
    lineHeight: 20,
  },
  button: {
    width: '100%',
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonText: {
    color: colors.white,
    fontSize: fontSize.md,
    fontWeight: fontWeight.bold,
  },
  grantedBadge: {
    backgroundColor: '#E6F4EA',
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  grantedText: {
    color: colors.success,
    fontSize: fontSize.md,
    fontWeight: fontWeight.semibold,
  },
  guide: {
    marginTop: spacing.lg,
    fontSize: fontSize.sm,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
})
```

- [ ] **Step 2: 타입 체크**

```bash
cd mobile && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Step 3: 커밋**

```bash
git add mobile/src/screens/NotificationPermissionScreen.tsx
git commit -m "feat: NotificationPermissionScreen 구현"
```

---

## Task 10: HomeScreen.tsx 권한 배너 연결

**Files:**
- Modify: `mobile/src/screens/HomeScreen.tsx`

홈 화면 상단에 권한 미허가 시 배너를 표시한다.

- [ ] **Step 1: import 추가**

`HomeScreen.tsx` 상단에 추가:

```typescript
import { AppState, NativeModules, Platform } from 'react-native'
```

(기존 `react-native` import에 `AppState`, `NativeModules`, `Platform` 추가)

- [ ] **Step 2: 권한 상태 훅 추가**

`HomeScreen()` 함수 안, 기존 state 선언들 아래에 추가:

```typescript
// 알림 접근 권한 상태 — Android 전용
const [notifPermGranted, setNotifPermGranted] = useState<boolean>(true)

useEffect(() => {
  if (Platform.OS !== 'android' || !NativeModules.NotificationListenerModule) return

  const check = async () => {
    const granted: boolean = await NativeModules.NotificationListenerModule.isPermissionGranted()
    setNotifPermGranted(granted)
  }
  check()

  // 설정에서 돌아올 때 재체크
  const sub = AppState.addEventListener('change', state => {
    if (state === 'active') check()
  })
  return () => sub.remove()
}, [])
```

- [ ] **Step 3: 배너 UI 추가**

`<Screen>` 태그 바로 아래, `<View style={styles.greeting}>` 위에 추가:

```typescript
{!notifPermGranted && Platform.OS === 'android' && (
  <Pressable
    style={styles.permBanner}
    onPress={() => NativeModules.NotificationListenerModule?.openPermissionSettings()}
  >
    <Text style={styles.permBannerText}>
      🔔 카드 알림 자동 수집을 켜면 소비가 자동으로 기록됩니다
    </Text>
    <Text style={styles.permBannerAction}>설정 열기 →</Text>
  </Pressable>
)}
```

- [ ] **Step 4: 스타일 추가**

`StyleSheet.create({ ... })` 안에 추가:

```typescript
permBanner: {
  backgroundColor: '#FFF8E1',
  borderRadius: radius.md,
  padding: spacing.md,
  marginBottom: spacing.md,
  gap: spacing.xs,
},
permBannerText: {
  fontSize: fontSize.sm,
  color: colors.gray900,
  lineHeight: 20,
},
permBannerAction: {
  fontSize: fontSize.sm,
  fontWeight: fontWeight.semibold,
  color: colors.primary,
},
```

- [ ] **Step 5: 타입 체크**

```bash
cd mobile && npx tsc --noEmit 2>&1; echo "exit: $?"
```

Expected: `exit: 0`

- [ ] **Step 6: 커밋**

```bash
git add mobile/src/screens/HomeScreen.tsx
git commit -m "feat: HomeScreen 알림 권한 배너 추가"
```

---

## Task 11: ADB 동작 검증

- [ ] **Step 1: 앱 빌드 + 설치**

```bash
cd mobile && npx react-native run-android
```

- [ ] **Step 2: 권한 허가**

Android 설정에서 수동으로 허가:
```bash
# 설정 화면 바로 열기
adb shell am start -a android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS
```
→ 앱 목록에서 "자동화가계부" 토글 활성화

또는 앱에서 홈 화면 배너 → "설정 열기" 탭

- [ ] **Step 3: Logcat 필터 준비**

별도 터미널에서:
```bash
adb logcat -s "NotificationListener" -v time
```

- [ ] **Step 4: ADB 테스트 알림 주입**

```bash
adb shell cmd notification post \
  -S bigtext \
  --pkg com.kbcard.kbkookmincard \
  --id 1 \
  "카드 승인" \
  "[국민카드] 05/27 14:30 스타벅스 6,500원 승인"
```

Expected Logcat:
```
NotificationListener: 거래 알림 수신: 카드 승인 [국민카드] 05/27 14:30 스타벅스 6,500원 승인
NotificationListener: parse-text 응답: 200
```

- [ ] **Step 5: Supabase 데이터 확인**

Supabase Dashboard → Table Editor → `transactions` 테이블에서  
`merchant = '스타벅스'`, `amount = -6500`, `source = 'notification'` 행 확인

- [ ] **Step 6: 중복 방지 테스트**

같은 명령 다시 실행:
```bash
adb shell cmd notification post \
  -S bigtext \
  --pkg com.kbcard.kbkookmincard \
  --id 1 \
  "카드 승인" \
  "[국민카드] 05/27 14:30 스타벅스 6,500원 승인"
```

Expected Logcat:
```
NotificationListener: 중복 알림 무시: com.kbcard.kbkookmincard
```

- [ ] **Step 7: 최종 커밋**

```bash
git add -A
git commit -m "feat: Plan 3 NotificationListenerService 구현 완료

- NotificationListenerService.kt: 카드사 4개, dedup, 로컬 큐, OkHttp 직접 호출
- NotificationListenerModule.kt: isPermissionGranted, setUserId, getAndClearPendingNotifications
- AndroidManifest.xml: 서비스 등록
- BuildConfig: local.properties에서 Supabase 키 주입
- NotificationPermissionScreen.tsx: 권한 안내 + AppState 재체크
- HomeScreen.tsx: 권한 미허가 배너
- useAuth.ts: 로그인 시 userId 동기화 + 로컬 큐 flush"
```
