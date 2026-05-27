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

  override fun getMainComponentName(): String = "mobile"

  override fun createReactActivityDelegate(): ReactActivityDelegate =
    DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)  // react-native-screens 요구사항
    // 앱이 처음 실행될 때 Share Intent로 열렸다면 처리
    handleShareIntent(intent)
  }

  override fun onNewIntent(intent: Intent?) {
    super.onNewIntent(intent)
    // 앱이 이미 실행 중일 때 새 Share Intent 수신
    setIntent(intent)
    handleShareIntent(intent)
  }

  private fun handleShareIntent(intent: Intent?) {
    if (Intent.ACTION_SEND != intent?.action || "text/plain" != intent.type) return
    val sharedText = intent.getStringExtra(Intent.EXTRA_TEXT) ?: return

    // React Native로 이벤트 전송
    val reactContext: ReactContext? = reactInstanceManager?.currentReactContext
    val params = Arguments.createMap().apply { putString("text", sharedText) }
    reactContext
      ?.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      ?.emit("ShareIntentReceived", params)
  }
}
