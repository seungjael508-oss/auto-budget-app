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
