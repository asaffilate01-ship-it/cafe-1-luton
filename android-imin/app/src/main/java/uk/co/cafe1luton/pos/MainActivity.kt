package uk.co.cafe1luton.pos

import android.Manifest
import android.app.Activity
import android.app.Presentation
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.bluetooth.BluetoothSocket
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.display.DisplayManager
import android.os.Build
import android.os.Bundle
import android.view.Display
import android.view.WindowManager
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import org.json.JSONArray
import org.json.JSONObject
import java.util.UUID
import java.util.concurrent.Executors

private const val TILL_URL = "https://cafe1luton.co.uk/till"
private const val DISPLAY_URL = "https://cafe1luton.co.uk/display?embedded=1"
private val SERIAL_PORT_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var customerPresentation: CustomerPresentation? = null
    private lateinit var evoBridge: EvoTerminalBridge

    private val bluetoothPermissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { grants ->
        if (grants.values.all { it }) evoBridge.emitStatus()
        else evoBridge.emitError("Bluetooth permission is required to connect the EVO terminal")
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        WebView.setWebContentsDebuggingEnabled(false)

        webView = trustedWebView(this)
        evoBridge = EvoTerminalBridge(this, webView)
        webView.addJavascriptInterface(evoBridge, "Cafe1EvoTerminal")
        webView.addJavascriptInterface(IminHardwareBridge(this), "Cafe1Hardware")
        setContentView(webView)
        webView.loadUrl(TILL_URL)

        requestBluetoothPermission()
        showCustomerDisplay()
    }

    override fun onResume() {
        super.onResume()
        showCustomerDisplay()
    }

    override fun onDestroy() {
        customerPresentation?.dismiss()
        evoBridge.disconnect()
        webView.destroy()
        super.onDestroy()
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else moveTaskToBack(true)
    }

    private fun requestBluetoothPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return
        val missing = listOf(Manifest.permission.BLUETOOTH_CONNECT, Manifest.permission.BLUETOOTH_SCAN)
            .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
            .toTypedArray()
        if (missing.isNotEmpty()) bluetoothPermissions.launch(missing)
    }

    private fun showCustomerDisplay() {
        if (customerPresentation?.isShowing == true) return
        val manager = getSystemService(Context.DISPLAY_SERVICE) as DisplayManager
        val display = manager.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION).firstOrNull()
            ?: return
        customerPresentation = CustomerPresentation(this, display).also { it.show() }
    }
}

private fun trustedWebView(context: Context): WebView = WebView(context).apply {
    settings.javaScriptEnabled = true
    settings.domStorageEnabled = true
    settings.databaseEnabled = true
    settings.cacheMode = WebSettings.LOAD_DEFAULT
    settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
    settings.allowFileAccess = false
    settings.allowContentAccess = false
    settings.userAgentString = "${settings.userAgentString} Cafe1LutonImin/1.0"
    webViewClient = object : WebViewClient() {
        override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
            val uri = request.url
            return uri.scheme != "https" || uri.host !in setOf("cafe1luton.co.uk", "www.cafe1luton.co.uk")
        }
    }
}

private class CustomerPresentation(context: Context, display: Display) : Presentation(context, display) {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(trustedWebView(context).apply { loadUrl(DISPLAY_URL) })
    }
}

class EvoTerminalBridge(
    private val activity: Activity,
    private val webView: WebView,
) {
    private val executor = Executors.newSingleThreadExecutor()
    private val adapter: BluetoothAdapter? by lazy {
        (activity.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager).adapter
    }
    @Volatile private var socket: BluetoothSocket? = null
    @Volatile private var connectedName: String? = null

    @JavascriptInterface
    fun listBondedDevices(): String {
        if (!hasPermission()) return "[]"
        val names = Regex("EVO|MOVE|3500|INGENICO", RegexOption.IGNORE_CASE)
        val devices = adapter?.bondedDevices.orEmpty()
            .filter { names.containsMatchIn(it.name.orEmpty()) }
            .sortedBy { it.name.orEmpty() }
        return JSONArray(devices.map { JSONObject().put("name", it.name ?: "Payment terminal").put("address", it.address) }).toString()
    }

    @JavascriptInterface
    fun connectDevice(address: String): String {
        if (!hasPermission()) return JSONObject().put("accepted", false).put("error", "Bluetooth permission is missing").toString()
        val device = adapter?.bondedDevices?.firstOrNull { it.address == address }
            ?: return JSONObject().put("accepted", false).put("error", "Pair this terminal in Android settings first").toString()
        executor.execute { connect(device) }
        return JSONObject().put("accepted", true).toString()
    }

    private fun connect(device: BluetoothDevice) {
        try {
            adapter?.cancelDiscovery()
            socket?.close()
            val next = device.createRfcommSocketToServiceRecord(SERIAL_PORT_UUID)
            next.connect()
            socket = next
            connectedName = device.name ?: "EVO Mobile/3500"
            emit(JSONObject().put("connected", true).put("name", connectedName))
        } catch (error: Exception) {
            socket = null
            connectedName = null
            emitError("Bluetooth connected device is not exposing EVO's approved POS service: ${error.message ?: "connection failed"}")
        }
    }

    @JavascriptInterface
    fun status(): String = JSONObject()
        .put("connected", socket?.isConnected == true)
        .put("name", connectedName)
        .toString()

    @JavascriptInterface
    fun beginPayment(amountPence: Int, reference: String): String {
        if (amountPence < 1 || reference.isBlank()) return JSONObject().put("accepted", false).put("error", "Invalid payment request").toString()
        return JSONObject()
            .put("accepted", false)
            .put("error", "EVO semi-integrated payment SDK or Diamond Cloud credentials are required before automatic card authorisation can be enabled")
            .toString()
    }

    @JavascriptInterface
    fun disconnect() {
        try { socket?.close() } catch (_: Exception) { }
        socket = null
        connectedName = null
        emit(JSONObject().put("connected", false))
    }

    fun emitStatus() = emit(JSONObject(status()))
    fun emitError(message: String) = emit(JSONObject().put("connected", false).put("error", message))

    private fun emit(payload: JSONObject) {
        val script = "window.dispatchEvent(new CustomEvent('cafe1:evo-terminal',{detail:${payload}}));"
        activity.runOnUiThread { webView.evaluateJavascript(script, null) }
    }

    private fun hasPermission(): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            activity.checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED
}

class IminHardwareBridge(private val activity: Activity) {
    @JavascriptInterface
    fun printTicket(text: String): String = callPrinter("printText", text)

    @JavascriptInterface
    fun openCashDrawer(): String = callPrinter("openCashBox")

    @JavascriptInterface
    fun status(): String = JSONObject().put("native", true).put("model", Build.MODEL).toString()

    private fun callPrinter(methodName: String, vararg args: Any): String {
        return try {
            val clazz = Class.forName("com.imin.printerlib.IminPrintUtils")
            val getInstance = clazz.methods.first { it.name == "getInstance" && it.parameterTypes.size == 1 }
            val printer = getInstance.invoke(null, activity)
            clazz.methods.firstOrNull { it.name == "initPrinter" && it.parameterTypes.isEmpty() }?.invoke(printer)
            val method = if (methodName == "printText") {
                clazz.methods.firstOrNull { it.name == methodName && it.parameterTypes.size in 1..2 }
            } else {
                clazz.methods.firstOrNull { it.name == methodName && it.parameterTypes.size == args.size }
                    ?: clazz.methods.firstOrNull { it.name.equals("opencashBox", ignoreCase = true) && it.parameterTypes.isEmpty() }
            } ?: throw IllegalStateException("iMin printer method $methodName is unavailable")
            if (methodName == "printText" && method.parameterTypes.size == 2) {
                method.invoke(printer, args.first(), 26)
            } else {
                method.invoke(printer, *args)
            }
            if (methodName == "printText") {
                clazz.methods.firstOrNull { it.name == "printAndFeedPaper" && it.parameterTypes.size == 1 }
                    ?.invoke(printer, 80)
            }
            JSONObject().put("ok", true).toString()
        } catch (error: Exception) {
            JSONObject().put("ok", false).put("error", error.message ?: "iMin hardware call failed").toString()
        }
    }
}
