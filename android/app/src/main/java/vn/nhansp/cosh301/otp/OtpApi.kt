package vn.nhansp.cosh301.otp

import java.net.HttpURLConnection
import java.net.URL
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.launch
import org.json.JSONObject

/** Client for the backend's /api/otp-app endpoints. */
class OtpApi(private val baseUrl: String, private val phone: String) {

    /**
     * Asks for the code waiting for this phone number. Returns null when there
     * is none; the backend answers the same for every number.
     */
    fun claim(): String? {
        val conn = open("/api/otp-app/claim", readTimeoutMs = 15_000)
        try {
            return when (val status = conn.responseCode) {
                HttpURLConnection.HTTP_OK -> JSONObject(conn.inputStream.bufferedReader().readText()).getString("code")
                HttpURLConnection.HTTP_NO_CONTENT -> null
                else -> throw ApiException(status)
            }
        } finally {
            conn.disconnect()
        }
    }

    /**
     * Reads the event stream until it closes, calling [onEvent] on a worker
     * thread with each event name ("connected", "pending"). The backend sends a
     * heartbeat every 15 s, so a silent connection is treated as dead.
     */
    suspend fun stream(onEvent: (String) -> Unit) = coroutineScope {
        val conn = open("/api/otp-app/stream", readTimeoutMs = 45_000)
        val reader = launch { read(conn, onEvent) }
        try {
            reader.join()
        } finally {
            // Closing the socket is the only way to interrupt a blocking read.
            conn.disconnect()
        }
    }

    private fun read(conn: HttpURLConnection, onEvent: (String) -> Unit) {
        if (conn.responseCode != HttpURLConnection.HTTP_OK) throw ApiException(conn.responseCode)
        var event = ""
        conn.inputStream.bufferedReader().useLines { lines ->
            for (line in lines) {
                when {
                    line.startsWith("event:") -> event = line.removePrefix("event:").trim()
                    line.isEmpty() && event.isNotEmpty() -> {
                        onEvent(event)
                        event = ""
                    }
                }
            }
        }
    }

    private fun open(path: String, readTimeoutMs: Int): HttpURLConnection {
        val conn = URL(baseUrl + path).openConnection() as HttpURLConnection
        conn.requestMethod = "POST"
        conn.connectTimeout = 10_000
        conn.readTimeout = readTimeoutMs
        conn.doOutput = true
        conn.setRequestProperty("Content-Type", "application/json")
        conn.outputStream.use { it.write(JSONObject().put("phone", phone).toString().toByteArray()) }
        return conn
    }
}

class ApiException(val status: Int) : Exception("HTTP $status")
