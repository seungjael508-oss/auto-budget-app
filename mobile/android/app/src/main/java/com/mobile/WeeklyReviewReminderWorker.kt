package com.mobile

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.Worker
import androidx.work.WorkerParameters
import okhttp3.OkHttpClient
import okhttp3.Request
import java.util.concurrent.TimeUnit

class WeeklyReviewReminderWorker(
    context: Context,
    params: WorkerParameters,
) : Worker(context, params) {

    companion object {
        const val WORK_NAME = "weekly_review_reminder"
        private const val CHANNEL_ID = "weekly_review"
        private const val NOTIFICATION_ID = 1001

        fun buildRequest() = PeriodicWorkRequestBuilder<WeeklyReviewReminderWorker>(
            7, TimeUnit.DAYS,
        ).setConstraints(
            Constraints.Builder()
                .setRequiredNetworkType(NetworkType.CONNECTED)
                .build(),
        ).build()
    }

    private val httpClient = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    override fun doWork(): Result {
        val prefs = applicationContext.getSharedPreferences(
            NotificationListenerModule.PREFS_NAME, Context.MODE_PRIVATE,
        )

        // 로그인 전이면 알림 없음
        val userId = prefs.getString(NotificationListenerModule.USER_ID_KEY, null)
            ?: return Result.success()
        val accessToken = prefs.getString(NotificationListenerModule.ACCESS_TOKEN_KEY, null)
            ?: return Result.success()

        val pendingCount = fetchPendingCount(userId, accessToken)
        if (pendingCount == null) return Result.retry()   // 네트워크 오류 → 재시도
        if (pendingCount == 0) return Result.success()    // 검수할 거래 없음 → 조용히 종료

        showReviewNotification(pendingCount)
        return Result.success()
    }

    // Supabase REST API로 pending_review 건수 조회
    private fun fetchPendingCount(userId: String, accessToken: String): Int? {
        return try {
            val url = "${BuildConfig.SUPABASE_URL}/rest/v1/transactions" +
                "?status=eq.pending_review&user_id=eq.$userId&select=id"

            val request = Request.Builder()
                .url(url)
                .addHeader("Authorization", "Bearer $accessToken")
                .addHeader("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .addHeader("Prefer", "count=exact")
                .get()
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (!response.isSuccessful) {
                    Log.e("WeeklyReminder", "건수 조회 실패: ${response.code}")
                    return@use null
                }
                // Content-Range: 0-9/42 → 42 파싱
                val contentRange = response.header("Content-Range") ?: return@use 0
                contentRange.substringAfter("/").trim().toIntOrNull() ?: 0
            }
        } catch (e: Exception) {
            Log.e("WeeklyReminder", "건수 조회 실패: ${e.message}")
            null
        }
    }

    private fun showReviewNotification(pendingCount: Int) {
        val manager = applicationContext.getSystemService(Context.NOTIFICATION_SERVICE)
            as NotificationManager

        // Android 8.0+ 채널 생성 (idempotent)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "주간 검수 알림",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply { description = "카드 거래 주간 검수 리마인더" }
            manager.createNotificationChannel(channel)
        }

        // 앱 실행 Intent (탭하면 앱 열림)
        val launchIntent = applicationContext.packageManager
            .getLaunchIntentForPackage(applicationContext.packageName)
            ?.apply { flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP }

        val pendingIntent = PendingIntent.getActivity(
            applicationContext,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val body = if (pendingCount == 1) "1건의 거래를 확인해주세요"
                   else "${pendingCount}건의 거래를 확인해주세요"

        val notification = NotificationCompat.Builder(applicationContext, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("이번 주 검수할 거래가 있어요")
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .setContentIntent(pendingIntent)
            .setAutoCancel(true)
            .build()

        manager.notify(NOTIFICATION_ID, notification)
        Log.d("WeeklyReminder", "주간 검수 알림 발송: ${pendingCount}건")
    }
}
