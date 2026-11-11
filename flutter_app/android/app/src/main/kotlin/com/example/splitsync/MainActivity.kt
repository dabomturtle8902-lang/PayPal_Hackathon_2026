package com.example.splitsync

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import io.flutter.embedding.android.FlutterFragmentActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterFragmentActivity() {
    companion object {
        private const val CHANNEL = "splitsync/notifications"
        private const val NOTIF_CHANNEL_ID = "splitsync_receipts"
        private const val REQ_POST_NOTIF = 4102
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, CHANNEL).setMethodCallHandler { call, result ->
            when (call.method) {
                "isPermitted" -> result.success(hasNotificationPermission())
                "requestPermission" -> {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                        ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
                    ) {
                        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQ_POST_NOTIF)
                        result.success(false)
                    } else {
                        result.success(hasNotificationPermission())
                    }
                }
                "notify" -> {
                    val id = (call.argument<Number>("id")?.toInt()) ?: 1001
                    val title = call.argument<String>("title") ?: "SplitSync AI"
                    val body = call.argument<String>("body") ?: ""
                    result.success(dispatchLocalNotification(id, title, body))
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun hasNotificationPermission(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED
        } else {
            true
        }
    }

    private fun dispatchLocalNotification(id: Int, title: String, body: String): Boolean {
        if (!hasNotificationPermission()) return false
        return try {
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                val channel = NotificationChannel(
                    NOTIF_CHANNEL_ID,
                    "Payment Alerts",
                    NotificationManager.IMPORTANCE_HIGH
                ).apply {
                    description = "Staggered demo payment and request settlement notifications"
                }
                manager.createNotificationChannel(channel)
            }
            val notification = NotificationCompat.Builder(this, NOTIF_CHANNEL_ID)
                .setSmallIcon(applicationInfo.icon)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .build()
            manager.notify(id, notification)
            true
        } catch (_: Throwable) {
            false
        }
    }
}
