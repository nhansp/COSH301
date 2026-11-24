package vn.nhansp.cosh301.otp

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

private const val CHANNEL_SERVICE = "listening"
private const val CHANNEL_CODE = "codes"
private const val ID_SERVICE = 1
private const val ID_CODE = 2
const val CODE_TTL_MS = 5 * 60 * 1000L
private const val MIN_BACKOFF_MS = 2_000L
private const val MAX_BACKOFF_MS = 30_000L

/**
 * Keeps one event stream open for the saved phone number and shows each login
 * code the backend hands over as a notification.
 */
class OtpService : Service() {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var listener: Job? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val settings = Settings(this)
        val phone = normalizePhone(settings.phone)
        if (intent?.action == ACTION_STOP || phone == null || (intent == null && !settings.listening)) {
            stopListening(settings)
            return START_NOT_STICKY
        }

        createChannels()
        ServiceCompat.startForeground(
            this, ID_SERVICE, listeningNotification(),
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE else 0,
        )
        listener?.cancel()
        listener = scope.launch { listen(OtpApi(settings.baseUrl, phone)) }
        return START_STICKY
    }

    override fun onDestroy() {
        scope.cancel()
        ServiceStatus.set("Đã dừng")
    }

    private fun stopListening(settings: Settings) {
        settings.listening = false
        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    private suspend fun listen(api: OtpApi) {
        var backoff = MIN_BACKOFF_MS
        while (true) {
            try {
                ServiceStatus.set("Đang kết nối...")
                api.stream {
                    // Also claim on connect: a code may have been issued while the stream was down.
                    ServiceStatus.set("Đang chờ mã đăng nhập")
                    backoff = MIN_BACKOFF_MS
                    claimAndNotify(api)
                }
                ServiceStatus.set("Mất kết nối, đang thử lại")
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                ServiceStatus.set("Lỗi kết nối: ${e.message ?: e.javaClass.simpleName}")
            }
            delay(backoff)
            backoff = (backoff * 2).coerceAtMost(MAX_BACKOFF_MS)
        }
    }

    private fun claimAndNotify(api: OtpApi) {
        try {
            api.claim()?.let(::showCode)
        } catch (e: Exception) {
            ServiceStatus.set("Không lấy được mã: ${e.message ?: e.javaClass.simpleName}")
        }
    }

    private fun showCode(code: String) {
        LatestCode.set(code)
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        val notification = Notification.Builder(this, CHANNEL_CODE)
            .setSmallIcon(R.drawable.ic_stat_otp)
            .setContentTitle("Mã đăng nhập COSH301: $code")
            .setContentText("Nhập mã này trên trang web. Mã có hiệu lực 5 phút.")
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setTimeoutAfter(CODE_TTL_MS)
            .setAutoCancel(true)
            .setContentIntent(open)
            .build()
        getSystemService(NotificationManager::class.java).notify(ID_CODE, notification)
    }

    private fun listeningNotification(): Notification {
        val open = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(this, CHANNEL_SERVICE)
            .setSmallIcon(R.drawable.ic_stat_otp)
            .setContentTitle("COSH301 OTP đang chờ mã đăng nhập")
            .setOngoing(true)
            .setContentIntent(open)
            .build()
    }

    private fun createChannels() {
        val manager = getSystemService(NotificationManager::class.java)
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_SERVICE, "Đang lắng nghe", NotificationManager.IMPORTANCE_MIN),
        )
        manager.createNotificationChannel(
            NotificationChannel(CHANNEL_CODE, "Mã đăng nhập", NotificationManager.IMPORTANCE_HIGH),
        )
    }

    companion object {
        private const val ACTION_STOP = "vn.nhansp.cosh301.otp.STOP"

        fun start(context: Context) {
            Settings(context).listening = true
            ContextCompat.startForegroundService(context, Intent(context, OtpService::class.java))
        }

        fun stop(context: Context) {
            context.startService(Intent(context, OtpService::class.java).setAction(ACTION_STOP))
        }

        fun canNotify(context: Context): Boolean =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
                ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
    }
}
