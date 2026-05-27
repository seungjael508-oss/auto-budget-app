package com.mobile

import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * JS에서 cold-start Share Intent 텍스트를 가져갈 수 있도록 노출한다.
 * - cold start: MainActivity.pendingSharedText에 저장 → getInitialSharedText()로 읽기
 * - hot start: MainActivity.onNewIntent → DeviceEventEmitter 직접 발사
 */
class ShareIntentModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String = "ShareIntentModule"

    /**
     * 앱 최초 실행 시 Share Intent로 받은 텍스트를 반환하고 클리어한다.
     * 텍스트가 없으면 null 반환.
     */
    @ReactMethod
    fun getInitialSharedText(promise: Promise) {
        val text = MainActivity.pendingSharedText
        // 한 번 읽으면 초기화 — 재시작 후 재처리 방지
        MainActivity.pendingSharedText = null
        promise.resolve(text)
    }

    // RN New Architecture 요구 — EventEmitter 등록/해제 stub
    @ReactMethod
    fun addListener(@Suppress("UNUSED_PARAMETER") eventName: String) {}

    @ReactMethod
    fun removeListeners(@Suppress("UNUSED_PARAMETER") count: Double) {}
}
