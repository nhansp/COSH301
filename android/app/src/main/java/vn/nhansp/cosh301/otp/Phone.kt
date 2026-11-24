package vn.nhansp.cosh301.otp

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.telephony.SubscriptionManager
import android.telephony.TelephonyManager
import androidx.core.content.ContextCompat

val PHONE_PERMISSIONS = arrayOf(
    Manifest.permission.READ_PHONE_NUMBERS,
    Manifest.permission.READ_PHONE_STATE,
)

private val nationalPhone = Regex("^(?:0084|84|0)([0-9]{8,10})$")
private val plausiblePhone = Regex("^\\+?[0-9]{9,15}$")

/**
 * Canonical form shared with the backend (NormalizeDestination): "+84..." for
 * Vietnamese numbers. Returns null when the input is not a phone number.
 */
fun normalizePhone(input: String): String? {
    val digits = input.filter { it.isDigit() || it == '+' }
    val canonical = nationalPhone.matchEntire(digits)?.let { "+84" + it.groupValues[1] } ?: digits
    return canonical.takeIf { plausiblePhone.matches(it) }
}

fun hasPhonePermissions(context: Context): Boolean = PHONE_PERMISSIONS.all {
    ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
}

/** The number the SIM reports about itself, or null when it does not expose one. */
@SuppressLint("MissingPermission", "HardwareIds")
fun readDeviceNumber(context: Context): String? {
    if (!hasPhonePermissions(context)) return null
    val candidates = mutableListOf<String>()
    runCatching {
        val subs = context.getSystemService(SubscriptionManager::class.java)
        for (info in subs.activeSubscriptionInfoList.orEmpty()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                candidates += subs.getPhoneNumber(info.subscriptionId)
            }
            @Suppress("DEPRECATION")
            candidates += info.number.orEmpty()
        }
    }
    runCatching {
        candidates += context.getSystemService(TelephonyManager::class.java).line1Number.orEmpty()
    }
    return candidates.firstNotNullOfOrNull { normalizePhone(it) }
}
