package org.yishu.app

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Button
import android.widget.LinearLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import java.io.ByteArrayInputStream

class VipActivity : ComponentActivity() {
    private lateinit var webView: WebView
    private var pendingExport: String? = null
    private val export = registerForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        val text = pendingExport
        pendingExport = null
        if (uri != null && text != null) {
            try {
                checkNotNull(contentResolver.openOutputStream(uri)).bufferedWriter(Charsets.UTF_8).use { it.write(text) }
            } catch (_: Exception) {
                Toast.makeText(this, "导出失败。", Toast.LENGTH_SHORT).show()
            }
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val back = Button(this).apply {
            text = when (intent.getStringExtra("script")) { "english" -> "Return to YiShu"; "traditional" -> "返回易數通玄"; else -> "返回易数通玄" }
            setOnClickListener { finish() }
        }
        webView = WebView(this).apply {
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            addJavascriptInterface(ExportBridge(), "YiShuAndroid")
            webViewClient = object : WebViewClient() {
                override fun shouldInterceptRequest(view: WebView, request: WebResourceRequest): WebResourceResponse? =
                    if (request.url.toString() == REDEEM_URL && request.method in setOf("POST", "OPTIONS")) null
                    else localAsset(request.url)

                override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                    val uri = request.url
                    if (isLocal(uri)) return false
                    if (request.isForMainFrame && request.hasGesture() && uri.scheme == "https") {
                        try {
                            startActivity(Intent(Intent.ACTION_VIEW, uri))
                        } catch (_: ActivityNotFoundException) {
                            Toast.makeText(this@VipActivity, "设备上没有可打开链接的应用。", Toast.LENGTH_SHORT).show()
                        }
                    }
                    return true
                }
            }
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            addView(back, LinearLayout.LayoutParams(-1, -2))
            addView(webView, LinearLayout.LayoutParams(-1, 0, 1f))
        }
        ViewCompat.setOnApplyWindowInsetsListener(layout) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        setContentView(layout)
        val uri = Uri.Builder().scheme("https").authority(HOST).path("/index.html")
        for (key in listOf("script", "theme", "zone", "original", "moving")) {
            intent.getStringExtra(key)?.let { uri.appendQueryParameter(key, it) }
        }
        webView.loadUrl(uri.fragment("vip").build().toString())
    }

    private fun isLocal(uri: Uri): Boolean = uri.scheme == "https" && uri.host == HOST && uri.port == -1

    private fun localAsset(uri: Uri): WebResourceResponse {
        val path = uri.path?.removePrefix("/").orEmpty()
        if (!isLocal(uri) || !path.matches(Regex("[a-zA-Z0-9_./-]+")) || ".." in path) return unavailable()
        val mime = types[path.substringAfterLast('.', "")] ?: return unavailable()
        return try {
            WebResourceResponse(mime, if (mime.startsWith("image/")) null else "UTF-8", assets.open("vip-web/$path"))
        } catch (_: Exception) {
            unavailable()
        }
    }

    private fun unavailable() = WebResourceResponse("text/plain", "UTF-8", 404, "Not found", emptyMap(), ByteArrayInputStream(byteArrayOf()))

    private inner class ExportBridge {
        @JavascriptInterface
        fun saveJson(filename: String, content: String) {
            if (filename != "yishu-birth-profiles.json" || content.length > 2_000_000) return
            runOnUiThread {
                if (pendingExport != null) return@runOnUiThread
                pendingExport = content
                export.launch(filename)
            }
        }
    }

    override fun onDestroy() {
        webView.removeJavascriptInterface("YiShuAndroid")
        webView.stopLoading()
        (webView.parent as? LinearLayout)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }

    companion object {
        private const val HOST = "appassets.androidplatform.net"
        private const val REDEEM_URL = "https://yishu-workbench.shortbrine32.chatgpt.site/vip/redeem"
        private val types = mapOf(
            "html" to "text/html", "js" to "application/javascript", "css" to "text/css",
            "json" to "application/json", "tsv" to "text/plain", "txt" to "text/plain",
            "jpg" to "image/jpeg", "png" to "image/png",
        )

        internal fun open(context: Context, preferences: Preferences, recent: Result?) {
            context.startActivity(Intent(context, VipActivity::class.java).apply {
                putExtra("script", if (preferences.english) "english" else if (preferences.traditional) "traditional" else "simplified")
                putExtra("theme", preferences.appearance.name.lowercase())
                putExtra("zone", preferences.zone)
                recent?.let {
                    putExtra("original", it.reading.original.number.toString())
                    putExtra("moving", it.reading.moving.joinToString(","))
                }
            })
        }
    }
}
