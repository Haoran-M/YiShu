package org.yishu.app

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.os.PersistableBundle
import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.core.net.toUri
import org.json.JSONArray
import org.json.JSONObject
import org.yishu.domain.CoinLine
import org.yishu.domain.DigitMode
import org.yishu.domain.Hexagram
import org.yishu.domain.Hexagrams
import org.yishu.domain.OddSplit
import org.yishu.domain.StrokeMode
import org.yishu.domain.Trigram
import org.yishu.domain.readingLines

@Composable
internal fun ResultScreen(result: Result, saved: Boolean, save: () -> Unit, showCalculation: () -> Unit) {
    val reading = result.reading
    val context = LocalContext.current
    val heading = ui("${reading.original.title} → ${reading.changed.title}")
    val noMoving = ui("无动爻")
    val moving = if (reading.moving.isEmpty()) noMoving else "${ui("动爻")} · ${reading.moving.joinToString("、")}"
    val lines = reading.moving.map { classic(reading.original.lineTexts[it - 1]) }
    val judgment = classic(reading.original.judgment)
    val summaryGua = LocalCorpus.current?.englishGua(reading.original.number)
    val changeGua = LocalCorpus.current?.englishGua(reading.changed.number)
    val summary = if (LocalEnglish.current) summaryGua?.getString("reflection") ?: ui(result.explanation.summary) else ui(summaryGua?.getJSONObject("chinese")?.getString("reflection") ?: result.explanation.summary)
    val change = if (LocalEnglish.current) changeGua?.getString("reflection") ?: ui(result.explanation.change) else ui(changeGua?.getJSONObject("chinese")?.getString("reflection") ?: result.explanation.change)
    val category = ui(result.category.label)
    val reflection = ui(result.explanation.questionPrompt)
    val reference = ui("仅供传统文化参考。")
    val copyText = listOf(heading, moving, judgment, summary, lines.joinToString("\n"), change, "$category · $reflection", reference,
        reading.original.source, reading.changed.source).filter(String::isNotBlank).distinct().joinToString("\n")
    val copied = ui("结果已复制")
    val shareTitle = ui("分享起卦结果")

    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PagePadding, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Hero("起卦结果", "${result.method.label}  ·  $moving") }
        item {
            Panel {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    ReadingFigure("本卦", reading.original, reading.moving, Modifier.weight(1f))
                    ReadingFigure("变卦", reading.changed, reading.moving, Modifier.weight(1f))
                }
                Text(moving, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(onClick = save, enabled = !saved) { Text(ui(if (saved) "已保存" else "保存记录")) }
                    OutlinedButton(onClick = {
                        val clip = ClipData.newPlainText("YiShu", copyText)
                        clip.description.extras = PersistableBundle().apply { putBoolean("android.content.extra.IS_SENSITIVE", true) }
                        (context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager).setPrimaryClip(clip)
                        Toast.makeText(context, copied, Toast.LENGTH_SHORT).show()
                    }) { Text(ui("复制结果")) }
                    TextButton(onClick = {
                        val send = Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, copyText)
                        context.startActivity(Intent.createChooser(send, shareTitle))
                    }) { Text(ui("分享")) }
                }
                OutlinedButton(onClick = showCalculation) { Text(ui("查看计算过程")) }
            }
        }
        item {
            Panel {
                Section("卦象摘要")
                Text(judgment, style = MaterialTheme.typography.bodyLarge, fontFamily = FontFamily.Serif)
                Text(classic(reading.original.image), fontFamily = FontFamily.Serif)
                Text(summary)
            }
        }
        item {
            Panel {
                Section("动爻爻辞", if (reading.moving.isEmpty()) "本次没有动爻。" else "按自下而上的顺序列出全部动爻。")
                lines.forEach { Text(it, fontFamily = FontFamily.Serif, style = MaterialTheme.typography.bodyLarge) }
            }
        }
        item {
            Panel {
                Section("变卦象意")
                if (reading.changed != reading.original) {
                    Text(classic(reading.changed.judgment), style = MaterialTheme.typography.bodyLarge, fontFamily = FontFamily.Serif)
                    Text(classic(reading.changed.image), fontFamily = FontFamily.Serif)
                }
                Text(change)
            }
        }
        item {
            Panel {
                Section("所问事项 · ${result.category.label}")
                if (result.question.isNotBlank()) Text(result.question)
                Text(reflection)
                Text(ui("解读取自卦象与主题模板。同一卦象可有多种解释。仅供传统文化参考。"), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        item {
            Panel {
                Section("经文出处")
                SourceLink("本卦 · 维基文库《周易》", reading.original.source)
                if (reading.changed != reading.original) SourceLink("变卦 · 维基文库《周易》", reading.changed.source)
            }
        }
    }
}

@Composable
private fun ReadingFigure(label: String, hexagram: Hexagram, moving: List<Int>, modifier: Modifier = Modifier) {
    val yang = ui("阳")
    val yin = ui("阴")
    val lines = readingLines(hexagram.bits).joinToString("、") { if (it) yang else yin }
    Surface(modifier, color = MaterialTheme.colorScheme.background, shape = RoundedCornerShape(13.dp)) {
        Column(Modifier.padding(horizontal = 8.dp, vertical = 12.dp), horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("${ui(label)} · ${hexagram.number}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
            Text(ui(hexagram.title), style = MaterialTheme.typography.titleMedium)
            HexagramDrawing(hexagram.bits, moving, Modifier.size(width = 65.dp, height = 55.dp).padding(vertical = 2.dp),
                label = "${ui("自下而上")}：$lines")
            Text("${ui(hexagram.upper.nameZh)}${ui("上")} · ${ui(hexagram.lower.nameZh)}${ui("下")}", style = MaterialTheme.typography.labelMedium)
        }
    }
}

@Composable
internal fun CalculationScreen(result: Result, close: () -> Unit) {
    val calculation = result.calculation
    val headsLabel = ui("正面 3")
    val tailsLabel = ui("反面 2")
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PagePadding, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Hero("计算过程", "${result.method.label}  ·  规则 $ALGORITHM_VERSION")
            TextButton(onClick = close) { Text(ui("返回卦象")) }
        }
        if (result.method == Method.COINS) {
            val tosses = calculation.getJSONArray("tosses")
            items(tosses.length()) { index ->
                val toss = tosses.getJSONObject(index)
                val line = CoinLine.fromTotal(toss.getInt("total"))
                val heads = toss.optJSONArray("heads")
                Panel {
                    Section("第${index + 1}爻 · ${line.label}", "${line.total} 点 · ${if (line.moving) "动爻" else "静爻"}")
                    Text(if (heads == null) ui("手工录入") else (0 until heads.length()).joinToString("  ·  ") { i ->
                        if (heads.getBoolean(i)) headsLabel else tailsLabel
                    })
                }
            }
        } else {
            item {
                Panel {
                    Section("分段与取余")
                    val strokes = StrokeMode.valueOf(calculation.getString("strokeMode"))
                    val digits = DigitMode.valueOf(calculation.getString("digitMode"))
                    val split = OddSplit.valueOf(calculation.getString("oddSplit"))
                    Text(ui("${strokes.label} · ${digits.label} · ${split.label}"))
                    val original = result.reading.original
                    Text(ui("上卦：${shortValue(calculation.getString("upperSum"))} ÷ 8 余 ${calculation.getInt("upperRemainder")} → ${original.upper.nameZh}"))
                    Text(ui("下卦：${shortValue(calculation.getString("lowerSum"))} ÷ 8 余 ${calculation.getInt("lowerRemainder")} → ${original.lower.nameZh}"))
                    Text(ui("两段总和 ÷ 6 余 ${calculation.getInt("movingRemainder")} → 第${result.reading.moving.single()}爻"))
                    val ignored = calculation.getJSONObject("ignored")
                    if (ignored.length() > 0) Text("${ui("未计入")} · ${ignored.keys().asSequence().joinToString("、") { key ->
                        val display = if (key.isBlank()) "U+${key.codePointAt(0).toString(16).uppercase().padStart(4, '0')}" else key
                        "$display × ${ignored.getInt(key)}"
                    }}")
                }
            }
            for ((label, key) in listOf("上卦分段" to "upperTokens", "下卦分段" to "lowerTokens")) {
                val tokens = calculation.getJSONArray(key)
                item { Section(label, "${tokens.length()} 项 · 按输入顺序") }
                items(tokens.length()) { index -> TraceToken(tokens, index) }
            }
        }
    }
}

private fun shortValue(value: String): String = if (value.length <= 160) value else "${value.take(90)}…${value.takeLast(40)}"

@Composable
private fun TraceToken(tokens: JSONArray, index: Int) {
    val token = tokens.getJSONObject(index)
    val raw = shortValue(token.getString("raw"))
    val normalized = shortValue(token.getString("normalized"))
    val value = shortValue(token.getString("value"))
    val source = token.optString("strokeSource")
    Surface(shape = RoundedCornerShape(10.dp), color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
        SelectionContainer {
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(if (raw == normalized) "$raw  =  $value" else "$raw  →  $normalized  =  $value")
                if (source.isNotBlank()) Text(ui(source), style = MaterialTheme.typography.labelMedium)
            }
        }
    }
}

@Composable
internal fun LibraryScreen(hexagrams: Hexagrams, open: (Int) -> Unit) {
    var search by rememberSaveable { mutableStateOf("") }
    var upper by rememberSaveable { mutableStateOf<Int?>(null) }
    var lower by rememberSaveable { mutableStateOf<Int?>(null) }
    var sources by rememberSaveable { mutableStateOf(false) }
    val corpus = LocalCorpus.current
    val matches = remember(search, upper, lower, corpus) {
        val term = search.trim()
        hexagrams.entries.filter { hexagram ->
            (upper == null || upper == hexagram.upper.remainder) && (lower == null || lower == hexagram.lower.remainder) &&
                (hexagram.title.contains(term) || hexagram.name.contains(term) || corpus?.englishText(hexagram.title)?.contains(term, true) == true || corpus?.interfaceText(hexagram.title, true)?.contains(term) == true ||
                    hexagram.number.toString() == term)
        }
    }
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PagePadding, verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Hero("六十四卦", "按文王卦序阅读经文，也可按上下卦查找。", bits = 0b101101) }
        item {
            Panel {
                OutlinedTextField(search, { search = it }, Modifier.fillMaxWidth(), label = { Text(ui("输入卦名或卦序")) }, singleLine = true)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TrigramMenu("上卦", upper) { upper = it }
                    TrigramMenu("下卦", lower) { lower = it }
                    TextButton(onClick = { sources = true }) { Text(ui("资料来源")) }
                }
                if (matches.isEmpty()) Text(ui("没有符合条件的卦。"))
            }
        }
        items(matches, key = { it.number }) { hexagram ->
            Surface(onClick = { open(hexagram.number) }, shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surface) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 14.dp, vertical = 12.dp), verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(14.dp)) {
                    HexagramDrawing(hexagram.bits, emptyList(), Modifier.size(width = 29.dp, height = 30.dp))
                    Column(Modifier.weight(1f)) {
                        Text(ui(hexagram.title), style = MaterialTheme.typography.titleMedium)
                        Text("${ui(hexagram.upper.nameZh)}${ui("上")} · ${ui(hexagram.lower.nameZh)}${ui("下")}", style = MaterialTheme.typography.labelMedium)
                    }
                    Text("${hexagram.number}  ›", color = MaterialTheme.colorScheme.secondary)
                }
            }
        }
    }
    if (sources) SourceDialog { sources = false }
}

@Composable
private fun TrigramMenu(label: String, selected: Int?, change: (Int?) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    Box {
        OutlinedButton(onClick = { expanded = true }) {
            Text("${ui(label)} · ${ui(selected?.let { Trigram.fromRemainder(it).nameZh } ?: "全部")} ▾")
        }
        DropdownMenu(expanded, onDismissRequest = { expanded = false }) {
            DropdownMenuItem(text = { Text(ui("全部")) }, onClick = { expanded = false; change(null) })
            Trigram.entries.forEach { trigram ->
                DropdownMenuItem(text = { Text("${trigram.symbol} ${ui(trigram.nameZh)} · ${ui(trigram.image)}") }, onClick = {
                    expanded = false
                    change(trigram.remainder)
                })
            }
        }
    }
}

@Composable
internal fun HexagramScreen(hexagram: Hexagram) {
    val english = LocalCorpus.current?.englishGua(hexagram.number)
    val explanation = if (LocalEnglish.current) english else english?.getJSONObject("chinese")
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PagePadding, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Hero(hexagram.title, "第 ${hexagram.number} 卦  ·  ${hexagram.upper.nameZh}上 ${hexagram.lower.nameZh}下", hexagram.bits) }
        if (explanation != null) item {
            Panel {
                Section("理解此卦")
                Text(ui(explanation.getString("meaning")))
                Section("反思提示")
                Text(ui(explanation.getString("reflection")))
                Text(ui("以下解读是现代释义，保留经文供对照。"), style = MaterialTheme.typography.bodyMedium)
            }
        }
        item {
            Panel {
                Section("卦辞")
                SelectionContainer { Text(classic(hexagram.judgment), style = MaterialTheme.typography.bodyLarge, fontFamily = FontFamily.Serif) }
                HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                Section("大象")
                SelectionContainer { Text(classic(hexagram.image), style = MaterialTheme.typography.bodyLarge, fontFamily = FontFamily.Serif) }
            }
        }
        item { Section("六爻爻辞", "自初爻向上排列") }
        itemsIndexed(hexagram.lineTexts) { _, line ->
            Panel { SelectionContainer { Text(classic(line), style = MaterialTheme.typography.bodyLarge, fontFamily = FontFamily.Serif) } }
        }
        hexagram.extra?.let { extra -> item { Panel { Text(classic(extra), fontFamily = FontFamily.Serif) } } }
        item {
            Panel {
                Section("出处与索引")
                SourceLink("维基文库《周易》 · 文本版本", hexagram.source)
                SourceLink("易安居 · 卦序与上下卦核对", hexagram.reference)
            }
        }
    }
}

@Composable
private fun SourceDialog(close: () -> Unit) {
    AlertDialog(onDismissRequest = close, title = { Text(ui("资料来源")) }, text = {
        LazyColumn(Modifier.heightIn(max = 420.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            item { Text(ui("经文为古典原文。转录和标点注明维基文库出处，按 CC BY-SA 4.0 署名。")) }
            item { SourceLink("维基文库《周易》", "https://zh.wikisource.org/wiki/周易") }
            item { SourceLink("CC BY-SA 4.0", "https://creativecommons.org/licenses/by-sa/4.0/") }
            item { SourceLink("易安居 · 六十四卦索引", "https://www.zhouyi.cc/zhouyi/yijing64/") }
            item { SourceLink("现代笔画与字形 · Unihan 17.0.0", "https://www.unicode.org/reports/tr38/") }
            item { SourceLink("康熙笔画 · kangxi-strokecount", "https://github.com/breezyreeds/kangxi-strokecount") }
            item { SourceLink("简繁显示转换 · OpenCC 1.1.9", "https://github.com/BYVoid/OpenCC/tree/ver.1.1.9") }
        }
    }, confirmButton = { TextButton(onClick = close) { Text(ui("关闭")) } })
}

@Composable
internal fun SourceLink(label: String, url: String) {
    val context = LocalContext.current
    val unavailable = ui("设备上没有可打开链接的应用。")
    TextButton(onClick = {
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, url.toUri()))
        } catch (_: android.content.ActivityNotFoundException) {
            Toast.makeText(context, unavailable, Toast.LENGTH_SHORT).show()
        }
    }) { Text("${ui(label)}  ↗") }
}
