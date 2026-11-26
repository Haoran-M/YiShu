package org.yishu.app

import android.content.Context
import android.content.res.AssetManager
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.emptyPreferences
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.room.Dao
import androidx.room.Database
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import java.io.IOException
import java.math.BigInteger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import org.yishu.domain.DigitMode
import org.yishu.domain.Hexagram
import org.yishu.domain.Hexagrams
import org.yishu.domain.HourRule
import org.yishu.domain.OddSplit
import org.yishu.domain.PlumRules
import org.yishu.domain.PlumTrace
import org.yishu.domain.Reading
import org.yishu.domain.StrokeChoice
import org.yishu.domain.StrokeDictionary
import org.yishu.domain.StrokeMode
import org.yishu.domain.Token
import org.yishu.domain.Toss
import org.yishu.domain.Trigram

private const val MODERN_SOURCE = "Unihan 17.0.0 · kTotalStrokes"
private const val KANGXI_SOURCE = "kangxi-strokecount · Unicode 11.0"
internal const val ALGORITHM_VERSION = "1.0.0"

internal class Corpus(private val assets: AssetManager) {
    private val english = JSONObject(assets.open("english.json").bufferedReader().use { it.readText() })
    private val englishUi = english.getJSONObject("ui")
    private val englishClassical = english.getJSONObject("classical")
    private val englishPattern = Regex(englishUi.keys().asSequence().sortedByDescending { it.length }.joinToString("|") { Regex.escape(it) })
    fun englishText(text: String): String = if (englishUi.has(text)) englishUi.getString(text)
        else englishPattern.replace(text) { englishUi.getString(it.value) }
    fun englishClassic(text: String): String = if (englishClassical.has(text)) englishClassical.getString(text) + "\n\n" + text else text
    fun englishGua(number: Int): JSONObject = english.getJSONArray("hexagrams").getJSONObject(number - 1)
    val hexagrams = Hexagrams(assets.open("hexagrams.json").bufferedReader().use { reader ->
        val array = JSONArray(reader.readText())
        List(array.length()) { index ->
            val obj = array.getJSONObject(index)
            Hexagram(
                obj.getInt("number"), obj.getString("name"), obj.getString("title"),
                Trigram.fromRemainder(obj.getInt("upper")), Trigram.fromRemainder(obj.getInt("lower")),
                obj.getString("judgment"), obj.getString("image"),
                obj.getJSONArray("lines").let { lines -> List(lines.length(), lines::getString) },
                obj.optString("extra").takeUnless { obj.isNull("extra") },
                obj.getString("source"), obj.getString("reference"),
            ).also { require(it.bits == obj.getInt("bits")) }
        }
    })

    private data class StrokeRow(val modern: Int?, val kangxi: List<Int>, val variants: List<Int>)

    private val strokes = assets.open("strokes.tsv").bufferedReader().useLines { rows ->
        rows.associate { row ->
            val columns = row.split('\t')
            columns[0].toInt(16) to StrokeRow(
                columns[1].toIntOrNull(), columns[2].split(',').mapNotNull(String::toIntOrNull),
                columns[3].split(',').mapNotNull { it.toIntOrNull(16) },
            )
        }
    }

    val dictionary = StrokeDictionary { glyph, mode ->
        val code = glyph.codePointAt(0)
        val row = strokes[code]
        if (row == null) emptyList() else buildList {
            for (candidate in listOf(code) + row.variants) {
                val count = strokes[candidate] ?: continue
                val label = String(Character.toChars(candidate))
                when (mode) {
                    StrokeMode.MODERN -> count.modern?.let { add(StrokeChoice(label, it, MODERN_SOURCE)) }
                    StrokeMode.KANGXI -> count.kangxi.forEach { add(StrokeChoice(label, it, KANGXI_SOURCE)) }
                }
            }
        }
    }

    private fun conversion(name: String) = assets.open("$name.txt").bufferedReader().useLines { lines ->
        lines.filter { it.isNotBlank() && !it.startsWith('#') }.associate { line ->
            line.substringBefore('\t') to line.substringAfter('\t').substringBefore(' ')
        }
    }

    private val toTraditional = conversion("STCharacters")
    private val toSimplified = conversion("TSCharacters") + conversion("TSPhrases")
    private val longestSimplified = toSimplified.keys.maxOf(String::length)

    fun interfaceText(text: String, traditional: Boolean): String =
        if (traditional) convert(text, toTraditional, 2) else text

    fun classicText(text: String, traditional: Boolean): String =
        if (traditional) text else convert(text, toSimplified, longestSimplified)

    private fun convert(text: String, dictionary: Map<String, String>, maxLength: Int): String = buildString {
        var index = 0
        while (index < text.length) {
            val scalarLength = Character.charCount(text.codePointAt(index))
            var length = minOf(maxLength, text.length - index)
            var replacement: String? = null
            while (length >= scalarLength) {
                replacement = dictionary[text.substring(index, index + length)]
                if (replacement != null) break
                length--
            }
            append(replacement ?: text.substring(index, index + scalarLength))
            index += maxOf(length, scalarLength)
        }
    }
}

internal enum class Appearance(val label: String) { SYSTEM("跟随系统"), LIGHT("浅色"), DARK("深色") }

internal data class Preferences(
    val plum: PlumRules = PlumRules(),
    val zone: String = "",
    val traditional: Boolean = false,
    val appearance: Appearance = Appearance.SYSTEM,
    val shake: Boolean = false,
    val hourRule: HourRule = HourRule.TWELVE_DEITIES,
    val english: Boolean = true,
)

private val Context.yishuSettings by preferencesDataStore("settings")

internal class Settings(context: Context) {
    private val store = context.yishuSettings
    private val strokes = stringPreferencesKey("strokes")
    private val digits = stringPreferencesKey("digits")
    private val split = stringPreferencesKey("split")
    private val strict = booleanPreferencesKey("strict")
    private val zone = stringPreferencesKey("zone")
    private val traditional = booleanPreferencesKey("traditional")
    private val appearance = stringPreferencesKey("appearance")
    private val shake = booleanPreferencesKey("shake")
    private val hourRule = stringPreferencesKey("hourRule")
    private val english = booleanPreferencesKey("english")

    val values = store.data.catch { if (it is IOException) emit(emptyPreferences()) else throw it }.map(::read)

    private fun read(data: androidx.datastore.preferences.core.Preferences) = Preferences(
        PlumRules(enumOr(data[strokes], StrokeMode.MODERN), enumOr(data[digits], DigitMode.DIGITS),
            enumOr(data[split], OddSplit.UPPER), data[strict] ?: false),
        data[zone].orEmpty(), data[traditional] ?: false,
        enumOr(data[appearance], Appearance.SYSTEM), data[shake] ?: false,
        enumOr(data[hourRule], HourRule.TWELVE_DEITIES),
        data[english] ?: true,
    )

    suspend fun update(transform: (Preferences) -> Preferences) {
        store.edit { data ->
            val updated = transform(read(data))
            data[strokes] = updated.plum.strokes.name
            data[digits] = updated.plum.digits.name
            data[split] = updated.plum.oddSplit.name
            data[strict] = updated.plum.requireSupportedCharacters
            data[zone] = updated.zone
            data[traditional] = updated.traditional
            data[appearance] = updated.appearance.name
            data[shake] = updated.shake
            data[hourRule] = updated.hourRule.name
            data[english] = updated.english
        }
    }
}

private inline fun <reified T : Enum<T>> enumOr(value: String?, default: T): T = enumValues<T>().find { it.name == value } ?: default

@Entity(tableName = "readings")
internal data class SavedReading(
    @PrimaryKey val id: String,
    val createdAt: Long,
    val method: String,
    val question: String,
    val caption: String,
    val payload: String,
)

@Dao
internal interface History {
    @Query("SELECT * FROM readings ORDER BY createdAt DESC, id")
    fun observe(): Flow<List<SavedReading>>

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insert(entry: SavedReading)

    @Query("DELETE FROM readings WHERE id = :id")
    suspend fun delete(id: String)

    @Query("DELETE FROM readings")
    suspend fun clear()
}

@Database(entities = [SavedReading::class], version = 1)
internal abstract class YiShuDatabase : RoomDatabase() {
    abstract fun history(): History

    companion object {
        fun open(context: Context): YiShuDatabase = Room.databaseBuilder(context, YiShuDatabase::class.java, "yishu.db").build()
    }
}

internal enum class Category(val label: String, val prompt: String) {
    CAREER("事业", "梳理当前职责、可以争取的资源，以及下一步如何验证成果。"),
    STUDY("学业", "找出最需要练习的一项能力，给自己安排一次可检验的复盘。"),
    LOVE("感情", "区分实际观察和个人推测，想想双方的期待与界限能否说清。"),
    SOCIAL("人际", "想清希望对方理解的事，并留出倾听与协商的空间。"),
    FINANCE("财务", "梳理已知信息、预算与风险，重大决定应以可核实的信息为依据。"),
    HEALTH("健康", "记录实际情况和可以照顾自己的小事，有具体症状时向医疗专业人员咨询。"),
    OTHER("其他", "写出已经确定的条件、尚待核实的信息，以及一个可以调整的下一步。"),
}

private fun Trigram.reflection(): String = when (this) {
    Trigram.KUN -> "承接与配合"
    Trigram.QIAN -> "主动与持续"
    Trigram.DUI -> "交流与协调"
    Trigram.LI -> "辨明与取舍"
    Trigram.ZHEN -> "启动与应变"
    Trigram.XUN -> "循序与渗入"
    Trigram.KAN -> "审慎与辨险"
    Trigram.GEN -> "节制与审视"
}

internal data class Interpretation(val summary: String, val change: String, val questionPrompt: String)

internal fun interpretation(reading: Reading, category: Category, question: String): Interpretation {
    val original = reading.original
    val changed = reading.changed
    val change = if (reading.moving.isEmpty()) "六爻皆静，可从本卦的卦辞和卦象思考目前的处境。"
    else "变卦的上卦象征${changed.upper.reflection()}，下卦象征${changed.lower.reflection()}。可对照两卦的大象，思考哪些条件可能改变。"
    val prompt = if (question.isBlank()) category.prompt else "回到你填写的问题，${category.prompt}"
    return Interpretation("上卦${original.upper.nameZh}象征${original.upper.reflection()}，下卦${original.lower.nameZh}象征${original.lower.reflection()}。", change, prompt)
}

internal enum class Method(val label: String) { PLUM("梅花易数"), COINS("六爻摇卦") }

internal data class Result(
    val id: String,
    val createdAt: Long,
    val method: Method,
    val reading: Reading,
    val category: Category,
    val question: String,
    val explanation: Interpretation,
    val calculation: JSONObject,
) {
    fun toRecord(): SavedReading {
        val doc = JSONObject().put("id", id).put("createdAt", createdAt).put("method", method.name)
            .put("original", reading.original.number).put("changed", reading.changed.number)
            .put("movingLines", JSONArray(reading.moving)).put("category", category.name).put("question", question)
            .put("algorithmVersion", ALGORITHM_VERSION).put("calculation", calculation)
            .put("interpretation", JSONObject().put("summary", explanation.summary).put("change", explanation.change)
                .put("prompt", explanation.questionPrompt))
            .put("sources", JSONArray(listOf(reading.original.source, reading.changed.source).distinct()))
        return SavedReading(id, createdAt, method.name, question, "${reading.original.title} → ${reading.changed.title}", doc.toString())
    }

    companion object {
        fun fromRecord(entry: SavedReading, hexagrams: Hexagrams): Result {
            val data = JSONObject(entry.payload)
            val moving = data.getJSONArray("movingLines").let { List(it.length(), it::getInt) }
            val original = hexagrams.byNumber(data.getInt("original"))
            val changed = hexagrams.byNumber(data.getInt("changed"))
            val explanation = data.getJSONObject("interpretation")
            return Result(entry.id, entry.createdAt, Method.valueOf(entry.method), Reading(original, changed, moving),
                Category.valueOf(data.getString("category")), entry.question,
                Interpretation(explanation.getString("summary"), explanation.getString("change"), explanation.getString("prompt")),
                data.getJSONObject("calculation"))
        }
    }
}

private fun Token.json() = JSONObject().put("raw", raw).put("normalized", normalized).put("value", value?.toString())
    .put("strokeSource", stroke?.source)

internal fun PlumTrace.json(input: String, lowerInput: String?) = JSONObject()
    .put("input", input).put("lowerInput", lowerInput ?: JSONObject.NULL)
    .put("upperTokens", JSONArray(upper.map { it.json() })).put("lowerTokens", JSONArray(lower.map { it.json() }))
    .put("ignored", JSONObject(ignored)).put("upperSum", upperSum.toString()).put("lowerSum", lowerSum.toString())
    .put("strokeMode", rules.strokes.name).put("digitMode", rules.digits.name).put("oddSplit", rules.oddSplit.name)
    .put("requireSupportedCharacters", rules.requireSupportedCharacters)
    .put("upperRemainder", checkNotNull(upperSum).mod(BigInteger.valueOf(8)).toInt())
    .put("lowerRemainder", checkNotNull(lowerSum).mod(BigInteger.valueOf(8)).toInt())
    .put("movingRemainder", (checkNotNull(upperSum) + checkNotNull(lowerSum)).mod(BigInteger.valueOf(6)).toInt())

internal fun List<Toss>.json() = JSONObject().put("tosses", JSONArray(map { toss ->
    JSONObject().put("total", toss.line.total).put("heads", toss.heads?.let(::JSONArray) ?: JSONObject.NULL)
}))

internal suspend fun exportHistory(context: Context, uri: android.net.Uri, entries: List<SavedReading>) = withContext(Dispatchers.IO) {
    val document = JSONObject().put("schemaVersion", 1).put("readings", JSONArray(entries.map { JSONObject(it.payload) }))
    checkNotNull(context.contentResolver.openOutputStream(uri)).bufferedWriter(Charsets.UTF_8).use { writer ->
        writer.write(document.toString(2))
    }
}
