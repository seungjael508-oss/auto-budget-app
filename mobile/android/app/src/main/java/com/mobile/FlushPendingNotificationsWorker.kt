package com.mobile

import android.content.Context
import android.util.Log
import androidx.work.Constraints
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.Worker
import androidx.work.WorkerParameters
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

class FlushPendingNotificationsWorker(
    context: Context,
    params: WorkerParameters,
) : Worker(context, params) {

    companion object {
        const val WORK_NAME = "flush_pending_notifications"

        fun buildRequest() = PeriodicWorkRequestBuilder<FlushPendingNotificationsWorker>(
            1, TimeUnit.HOURS,
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

        // userId 없으면 로그인 전 — 건너뜀
        val userId = prefs.getString(NotificationListenerModule.USER_ID_KEY, null)
            ?: return Result.success()
        val accessToken = prefs.getString(NotificationListenerModule.ACCESS_TOKEN_KEY, null)
            ?: return Result.success()

        val queueJson = prefs.getString(NotificationListenerModule.QUEUE_KEY, "[]") ?: "[]"
        val queue = JSONArray(queueJson)
        if (queue.length() == 0) return Result.success()

        Log.d("FlushWorker", "큐 flush 시작: ${queue.length()}건")

        var anyFailed = false
        val successIndices = mutableSetOf<Int>()

        for (i in 0 until queue.length()) {
            val text = queue.getString(i)
            if (sendToParseText(text, userId, accessToken)) {
                successIndices.add(i)
            } else {
                anyFailed = true
            }
        }

        // 성공한 항목만 큐에서 제거, 실패한 항목은 유지
        val remaining = JSONArray()
        for (i in 0 until queue.length()) {
            if (i !in successIndices) remaining.put(queue.getString(i))
        }
        prefs.edit().putString(NotificationListenerModule.QUEUE_KEY, remaining.toString()).apply()

        Log.d("FlushWorker", "flush 완료: ${successIndices.size}건 성공, ${remaining.length()}건 잔여")

        // 실패 항목 있으면 retry — WorkManager가 exponential backoff으로 재시도
        return if (anyFailed) Result.retry() else Result.success()
    }

    private fun sendToParseText(text: String, userId: String, accessToken: String): Boolean {
        return try {
            val body = JSONObject().apply {
                put("text", text)
                put("userId", userId)
                put("source", "notification")
            }.toString().toRequestBody("application/json".toMediaType())

            val request = Request.Builder()
                .url("${BuildConfig.SUPABASE_URL}/functions/v1/parse-text")
                .addHeader("Authorization", "Bearer $accessToken")
                .addHeader("apikey", BuildConfig.SUPABASE_ANON_KEY)
                .post(body)
                .build()

            httpClient.newCall(request).execute().use { response ->
                response.isSuccessful.also {
                    if (!it) Log.e("FlushWorker", "parse-text ${response.code}: ${response.message}")
                }
            }
        } catch (e: Exception) {
            Log.e("FlushWorker", "네트워크 오류: ${e.message}")
            false
        }
    }
}
