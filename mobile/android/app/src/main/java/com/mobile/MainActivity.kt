package com.mobile

import android.content.Intent
import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate
import com.facebook.react.modules.core.DeviceEventManagerModule

class MainActivity : ReactActivity() {

    companion object {
        /**
         * Cold-start Share Intent 텍스트 임시 보관소.
         * RN 브리지가 준비되기 전에 받은 텍스트를 여기 저장하고,
         * JS에서 ShareIntentModule.getInitialSharedText()로 읽어간다.
         */
        var pendingSharedText: String? = null
    }

    override fun getMainComponentName(): String = "mobile"

    override fun createReactActivityDelegate(): ReactActivityDelegate =
        DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(null)  // react-native-screens 요구사항
        handleShareIntent(intent, isColdStart = true)
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        setIntent(intent)
        // hot start — 앱이 이미 실행 중이므로 reactContext 존재 가능
        handleShareIntent(intent, isColdStart = false)
    }

    /**
     * Share Intent 처리.
     *
     * - cold start: RN 브리지가 아직 초기화되지 않았으므로 pendingSharedText에 저장.
     *   JS가 마운트 후 ShareIntentModule.getInitialSharedText()로 읽어간다.
     * - hot start: reactContext가 존재하면 DeviceEventEmitter로 즉시 전송.
     *   reactContext가 없으면 pendingSharedText로 fallback.
     */
    private fun handleShareIntent(intent: Intent?, isColdStart: Boolean) {
        if (Intent.ACTION_SEND != intent?.action || "text/plain" != intent.type) return
        val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return

        if (isColdStart) {
            // Cold start: RN 브리지가 없으므로 버퍼에 저장
            pendingSharedText = sharedText
            return
        }

        // Hot start: reactContext가 있으면 즉시 이벤트 발사
        val reactContext: ReactContext? = reactInstanceManager?.currentReactContext
        if (reactContext != null) {
            val params = Arguments.createMap().apply { putString("text", sharedText) }
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                ?.emit("ShareIntentReceived", params)
        } else {
            // reactContext가 아직 없으면 (드문 케이스) 버퍼에 저장
            pendingSharedText = sharedText
        }
    }
}
