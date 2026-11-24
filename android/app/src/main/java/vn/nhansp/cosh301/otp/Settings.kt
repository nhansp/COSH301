package vn.nhansp.cosh301.otp

import android.content.Context
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

const val DEFAULT_BASE_URL = "https://cosh301.nhansp.id.vn"

class Settings(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var baseUrl: String
        get() = prefs.getString("baseUrl", DEFAULT_BASE_URL) ?: DEFAULT_BASE_URL
        set(value) = prefs.edit().putString("baseUrl", value.trim().trimEnd('/')).apply()

    var phone: String
        get() = prefs.getString("phone", "") ?: ""
        set(value) = prefs.edit().putString("phone", value).apply()

    /** Whether the user wants codes delivered; the service resumes after the system restarts it. */
    var listening: Boolean
        get() = prefs.getBoolean("listening", false)
        set(value) = prefs.edit().putBoolean("listening", value).apply()
}

/** What the service is doing, for the screen. */
object ServiceStatus {
    private val _text = MutableStateFlow("Đã dừng")
    val text: StateFlow<String> = _text

    fun set(value: String) {
        _text.value = value
    }
}

/** The newest login code and when it arrived, so the screen can show it next to the notification. */
object LatestCode {
    data class Code(val value: String, val receivedAt: Long)

    private val _code = MutableStateFlow<Code?>(null)
    val code: StateFlow<Code?> = _code

    fun set(value: String) {
        _code.value = Code(value, System.currentTimeMillis())
    }
}
