package vn.nhansp.cosh301.otp

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.dynamicDarkColorScheme
import androidx.compose.material3.dynamicLightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            val dark = isSystemInDarkTheme()
            MaterialTheme(
                colorScheme = if (dark) dynamicDarkColorScheme(this) else dynamicLightColorScheme(this),
            ) {
                Surface(Modifier.fillMaxSize()) { OtpScreen() }
            }
        }
    }
}

@Composable
private fun OtpScreen() {
    val context = LocalContext.current
    val settings = remember { Settings(context) }
    var baseUrl by remember { mutableStateOf(settings.baseUrl) }
    var phone by remember { mutableStateOf(settings.phone) }
    var listening by remember { mutableStateOf(settings.listening) }
    var hint by remember { mutableStateOf<String?>(null) }
    val status by ServiceStatus.text.collectAsState()
    val latest by LatestCode.code.collectAsState()
    var now by remember { mutableStateOf(System.currentTimeMillis()) }

    // The system may stop the service while the app is in the background; reopening the app resumes it.
    LaunchedEffect(Unit) {
        if (settings.listening && normalizePhone(settings.phone) != null) OtpService.start(context)
    }
    LaunchedEffect(latest) {
        while (true) {
            now = System.currentTimeMillis()
            kotlinx.coroutines.delay(1_000)
        }
    }

    fun fillFromSim() {
        val number = readDeviceNumber(context)
        if (number != null) {
            phone = number
            hint = null
        } else {
            hint = "SIM không cung cấp số điện thoại. Hãy nhập số của bạn."
        }
    }

    val phonePermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) {
        fillFromSim()
    }

    fun startService() {
        settings.baseUrl = baseUrl
        settings.phone = normalizePhone(phone) ?: return
        OtpService.start(context)
        listening = true
    }

    val notificationPermission = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) {
        // The service still runs without it, but codes would not be visible.
        startService()
    }

    val normalized = normalizePhone(phone)

    Column(
        Modifier
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text("COSH301 OTP", style = MaterialTheme.typography.headlineMedium)
        Text(
            "Ứng dụng nhận mã đăng nhập COSH301 cho số điện thoại của bạn và hiện mã trong thông báo và trên màn hình này.",
            style = MaterialTheme.typography.bodyMedium,
        )

        OutlinedTextField(
            value = phone,
            onValueChange = {
                phone = it
                hint = null
            },
            label = { Text("Số điện thoại") },
            supportingText = {
                Text(
                    hint ?: when {
                        phone.isBlank() -> "Nhập số điện thoại hoặc lấy từ SIM"
                        normalized != null -> "Sẽ dùng số $normalized"
                        else -> "Số điện thoại chưa hợp lệ"
                    },
                )
            },
            isError = phone.isNotBlank() && normalized == null,
            singleLine = true,
            enabled = !listening,
            modifier = Modifier.fillMaxWidth(),
        )
        OutlinedButton(
            onClick = {
                if (hasPhonePermissions(context)) fillFromSim() else phonePermission.launch(PHONE_PERMISSIONS)
            },
            enabled = !listening,
        ) { Text("Lấy số từ SIM") }

        OutlinedTextField(
            value = baseUrl,
            onValueChange = { baseUrl = it },
            label = { Text("Địa chỉ máy chủ") },
            singleLine = true,
            enabled = !listening,
            modifier = Modifier.fillMaxWidth(),
        )

        if (listening) {
            Button(onClick = {
                OtpService.stop(context)
                listening = false
            }, modifier = Modifier.fillMaxWidth()) { Text("Dừng nhận mã") }
        } else {
            Button(
                onClick = {
                    if (!OtpService.canNotify(context) && Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                        notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS)
                    } else {
                        startService()
                    }
                },
                enabled = normalized != null && baseUrl.isNotBlank(),
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Bắt đầu nhận mã") }
        }

        Text("Trạng thái: $status", style = MaterialTheme.typography.bodyMedium)

        latest?.takeIf { now - it.receivedAt < CODE_TTL_MS }?.let { code -> CodeCard(code) }
        Text(
            "Ứng dụng chỉ đọc số điện thoại trên máy này để biết mã nào thuộc về bạn. " +
                "Số không được dùng cho việc nào khác.",
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun CodeCard(code: LatestCode.Code) {
    val clock = SimpleDateFormat("HH:mm:ss", Locale.forLanguageTag("vi-VN"))
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("Mã đăng nhập mới", style = MaterialTheme.typography.titleSmall)
            Text(
                code.value.chunked(3).joinToString(" "),
                fontSize = 44.sp,
                fontWeight = FontWeight.SemiBold,
                fontFamily = FontFamily.Monospace,
            )
            Text(
                "Nhận lúc ${clock.format(Date(code.receivedAt))}, hết hạn lúc " +
                    "${clock.format(Date(code.receivedAt + CODE_TTL_MS))}. Nhập mã này trên trang web.",
                style = MaterialTheme.typography.bodySmall,
            )
        }
    }
}
