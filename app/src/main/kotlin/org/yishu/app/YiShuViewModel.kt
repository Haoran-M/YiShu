package org.yishu.app

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import java.time.Instant
import java.util.UUID
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import org.yishu.domain.CoinLine
import org.yishu.domain.Coins
import org.yishu.domain.PlumCalculator
import org.yishu.domain.PlumTrace
import org.yishu.domain.Reading
import org.yishu.domain.StrokeChoice
import org.yishu.domain.StrokeMode
import org.yishu.domain.Toss

internal data class PlumForm(
    val input: String = "",
    val secondInput: String = "",
    val dual: Boolean = false,
    val category: Category = Category.OTHER,
    val question: String = "",
    val overrides: Map<StrokeMode, Map<String, StrokeChoice>> = emptyMap(),
    val trace: PlumTrace? = null,
    val busy: Boolean = false,
)

internal data class CoinForm(
    val tosses: List<Toss> = emptyList(),
    val category: Category = Category.OTHER,
    val question: String = "",
)

internal class YiShuViewModel(app: Application) : AndroidViewModel(app) {
    private val database = YiShuDatabase.open(app)
    private val history = database.history()
    private val settings = Settings(app)
    private val coins = Coins()
    private val _corpus = MutableStateFlow<Corpus?>(null)
    private val _error = MutableStateFlow<String?>(null)
    private val _plum = MutableStateFlow(PlumForm())
    private val _coin = MutableStateFlow(CoinForm())
    private val _result = MutableStateFlow<Result?>(null)

    val corpus = _corpus.asStateFlow()
    val error = _error.asStateFlow()
    val plum = _plum.asStateFlow()
    val coin = _coin.asStateFlow()
    val result = _result.asStateFlow()
    val preferences = settings.values.stateIn(viewModelScope, SharingStarted.Eagerly, Preferences())
    val records = history.observe().stateIn(viewModelScope, SharingStarted.Eagerly, emptyList())

    init {
        launchSafely("资料载入失败，请重启应用。") {
            _corpus.value = withContext(Dispatchers.IO) { Corpus(app.assets) }
        }
    }

    fun updatePreferences(transform: (Preferences) -> Preferences) {
        launchSafely("设置保存失败。") { settings.update(transform) }
    }

    fun updatePlum(transform: (PlumForm) -> PlumForm) {
        _plum.update { current -> if (current.busy) current else transform(current) }
    }

    fun overrideStroke(glyph: String, choice: StrokeChoice) {
        val mode = preferences.value.plum.strokes
        updatePlum { form ->
            val overrides = form.overrides[mode].orEmpty() + (glyph to choice)
            form.copy(overrides = form.overrides + (mode to overrides))
        }
        generatePlum()
    }

    fun updateCoin(transform: (CoinForm) -> CoinForm) = _coin.update(transform)

    fun toss() = updateCoin { form ->
        if (form.tosses.size >= 6) form else form.copy(tosses = form.tosses + coins.toss())
    }

    fun addManual(line: CoinLine) = updateCoin { form ->
        if (form.tosses.size >= 6) form else form.copy(tosses = form.tosses + Toss(line, null))
    }

    fun generatePlum() {
        val data = corpus.value ?: return
        val rules = preferences.value.plum
        val snapshot = plum.value
        if (snapshot.busy) return
        _plum.value = snapshot.copy(busy = true)
        launchSafely("计算失败，请检查输入后重试。") {
            try {
                val second = snapshot.secondInput.takeIf { snapshot.dual }
                val pair = withContext(Dispatchers.Default) {
                    val trace = PlumCalculator(data.dictionary).trace(snapshot.input, second, rules, snapshot.overrides[rules.strokes].orEmpty())
                    val result = trace.reading(data.hexagrams)?.let { reading ->
                        makeResult(Method.PLUM, reading, snapshot.category, snapshot.question, trace.json(snapshot.input, second))
                    }
                    trace to result
                }
                _plum.update { it.copy(trace = pair.first) }
                pair.second?.let { _result.value = it }
            } finally {
                _plum.update { it.copy(busy = false) }
            }
        }
    }

    fun generateCoins() {
        val data = corpus.value ?: return
        val snapshot = coin.value
        if (snapshot.tosses.size != 6) return
        val reading = coins.fromTosses(snapshot.tosses, data.hexagrams)
        _result.value = makeResult(Method.COINS, reading, snapshot.category, snapshot.question, snapshot.tosses.json())
    }

    private fun makeResult(method: Method, reading: Reading, category: Category, question: String, calculation: org.json.JSONObject) =
        Result(UUID.randomUUID().toString(), Instant.now().toEpochMilli(), method, reading, category, question,
            interpretation(reading, category, question), calculation)

    fun open(entry: SavedReading) {
        val data = corpus.value ?: return
        _result.value = Result.fromRecord(entry, data.hexagrams)
    }

    fun closeResult() { _result.value = null }

    fun save(result: Result) = launchSafely("记录保存失败。") { history.insert(result.toRecord()) }

    fun delete(entry: SavedReading) = launchSafely("记录删除失败。") { history.delete(entry.id) }

    fun clear() = launchSafely("记录删除失败。") { history.clear() }

    fun export(uri: android.net.Uri, snapshot: List<SavedReading>) = launchSafely("导出失败。") {
        exportHistory(getApplication(), uri, snapshot)
    }

    fun dismissError() { _error.value = null }

    private fun launchSafely(message: String, block: suspend () -> Unit) {
        viewModelScope.launch {
            try {
                block()
            } catch (error: kotlinx.coroutines.CancellationException) {
                throw error
            } catch (error: Exception) {
                android.util.Log.e("YiShu", message, error)
                _error.value = message
            }
        }
    }
}
