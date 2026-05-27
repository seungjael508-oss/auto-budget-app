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

        // 지원 금융 앱 packageName (확장 시 여기만 추가)
        private val CARD_APP_PACKAGES = setOf(
            // 카드사
            "com.kbcard.kbkookmincard",   // 국민카드
            "com.shinhancard.smart",       // 신한카드
            "com.samsung.android.spay",    // 삼성카드
            "com.hyundaicard.app",         // 현대카드
            // 간편결제
            "com.kakao.talk",              // 카카오페이 (카카오톡 내)
            "com.kakaopay.app",            // 카카오페이 (단독 앱)
            "viva.republica.toss",         // 토스
            "com.nhn.android.search",      // 네이버페이 (네이버 앱 내)
            "com.nhn.android.naverpay",    // 네이버페이 (단독 앱)
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
