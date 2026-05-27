package com.mobile

import android.app.Application
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.WorkManager
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
    scheduleBackgroundWorkers()
  }

  private fun scheduleBackgroundWorkers() {
    val workManager = WorkManager.getInstance(this)

    // 1시간마다: 로그인 전 쌓인 알림 큐 자동 flush
    workManager.enqueueUniquePeriodicWork(
      FlushPendingNotificationsWorker.WORK_NAME,
      ExistingPeriodicWorkPolicy.KEEP,   // 이미 예약돼 있으면 재등록 안 함
      FlushPendingNotificationsWorker.buildRequest(),
    )

    // 7일마다: pending_review 거래 있으면 로컬 푸시 알림
    workManager.enqueueUniquePeriodicWork(
      WeeklyReviewReminderWorker.WORK_NAME,
      ExistingPeriodicWorkPolicy.KEEP,
      WeeklyReviewReminderWorker.buildRequest(),
    )
  }
}
