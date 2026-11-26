package org.yishu.app

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.FilterChip
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
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlinx.coroutines.delay
import org.yishu.domain.DigitMode
import org.yishu.domain.EarthlyBranch
import org.yishu.domain.HourRule
import org.yishu.domain.OddSplit
import org.yishu.domain.StrokeMode
import org.yishu.domain.assessHour
import org.yishu.domain.traditionalHour

private val dayFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd", Locale.ROOT)
private val minuteFormat = DateTimeFormatter.ofPattern("HH:mm", Locale.ROOT)
private val secondFormat = DateTimeFormatter.ofPattern("HH:mm:ss", Locale.ROOT)
private const val RULE_SOURCE = "https://zh.wikisource.org/wiki/欽定協紀辨方書_(四庫全書本)/卷07"
private const val CALENDAR_SOURCE = "https://www.hko.gov.hk/en/gts/astron2026/files/2026cal06.pdf"

@Composable
internal fun HoursScreen(preferences: Preferences, update: ((Preferences) -> Preferences) -> Unit) {
    val instant by produceState(Instant.now()) {
        while (true) {
            value = Instant.now()
            delay(1000 - value.toEpochMilli() % 1000)
        }
    }
    val zone = zoneFor(preferences)
    val hours = remember(instant, zone) { assessHour(instant, zone) }
    val date = hours.time.toLocalDate()
    val dated = preferences.hourRule == HourRule.TWELVE_DEITIES
    val auspice = remember(date, hours.current, dated) { if (dated) traditionalHour(date, hours.current) else null }
    var selectZone by rememberSaveable { mutableStateOf(false) }
    val current = hours.ziPeriod?.let { "${hours.current.label}时 · $it" } ?: "${hours.current.label}时"
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PagePadding, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Hero(current, "${hours.time.format(dayFormat)}   ${hours.time.format(secondFormat)}\n${zone.id}  ·  ${hours.time.offset}", bits = 0b100001) }
        item {
            Panel {
                Section("十二时辰", "下一个：${hours.next.label}时 · ${hours.nextStart.format(minuteFormat)}")
                Text(ui("子时跨越午夜。23:00 起为夜子，00:00 起为早子，公历日期在 00:00 切换。"))
                OutlinedButton(onClick = { selectZone = true }) { Text(ui("选择城市或时区")) }
            }
        }
        item {
            Panel {
                if (auspice == null) {
                    Section("吉凶判定已关闭", "基础时辰规则以所选时区的当地钟表时间计算。")
                } else {
                    Section("${auspice.deity.label} · ${auspice.deity.classification}")
                    Text(ui("${auspice.dayStemBranch}日，青龙从${auspice.qinglongStartsAt.label}时起，顺排十二神。采用所选时区的公历日期，00:00 换日。"))
                    SourceLink("《钦定协纪辨方书》卷七 · 黄黑道", RULE_SOURCE)
                    SourceLink("香港天文台年历 · 干支日基准", CALENDAR_SOURCE)
                }
                Selector("时辰规则", HourRule.entries, preferences.hourRule, HourRule::label) { rule -> update { it.copy(hourRule = rule) } }
                Text(ui("仅供传统文化参考。"), color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
        item { Section("全天时辰") }
        items(EarthlyBranch.entries, key = { it.name }) { branch ->
            val active = branch == hours.current
            Surface(
                color = if (active) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
                shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(horizontal = 15.dp, vertical = 11.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                        Text(ui("${branch.label}时"), style = MaterialTheme.typography.titleMedium)
                        Text(if (active) "${branch.interval()} · ${ui("当前")}" else branch.interval())
                    }
                    if (dated) {
                        val deity = traditionalHour(date, branch).deity
                        val label = "${deity.label} · ${deity.classification}"
                        val display = if (branch == EarthlyBranch.ZI) "早子、夜子各按${date.format(dayFormat)}计算 · $label" else label
                        Text(ui(display), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.secondary)
                    }
                }
            }
        }
    }
    if (selectZone) ZonePicker(preferences.zone, { selectZone = false }) { id ->
        update { it.copy(zone = id) }
        selectZone = false
    }
}

private fun zoneFor(preferences: Preferences): ZoneId = if (preferences.zone.isBlank()) ZoneId.systemDefault() else ZoneId.of(preferences.zone)

private val cities = linkedMapOf(
    "北京时间" to "Asia/Shanghai", "香港" to "Asia/Hong_Kong", "台北" to "Asia/Taipei", "新加坡" to "Asia/Singapore",
    "东京" to "Asia/Tokyo", "温哥华" to "America/Vancouver", "纽约" to "America/New_York", "伦敦" to "Europe/London",
    "协调世界时" to "UTC",
)

@Composable
private fun ZonePicker(selected: String, dismiss: () -> Unit, change: (String) -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    val traditional = LocalTraditional.current
    val corpus = LocalCorpus.current
    val choices = remember { (cities.values + ZoneId.getAvailableZoneIds().sorted()).distinct() }
    val visible = remember(query, traditional, choices) {
        val term = query.trim()
        choices.filter { id ->
            val aliases = cities.entries.filter { it.value == id }.map { it.key }
            id.replace('_', ' ').contains(term, true) || aliases.any { it.contains(term, true) || corpus?.interfaceText(it, true)?.contains(term, true) == true }
        }
    }
    AlertDialog(onDismissRequest = dismiss, title = { Text(ui("城市与时区")) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(query, { query = it }, singleLine = true, modifier = Modifier.fillMaxWidth(), label = { Text(ui("搜索城市或时区")) })
                LazyColumn(Modifier.heightIn(max = 300.dp)) {
                    item { ZoneOption(ui("跟随设备"), ZoneId.systemDefault().id, selected.isEmpty()) { change("") } }
                    items(visible, key = { it }) { id ->
                        val name = cities.entries.firstOrNull { it.value == id }?.key?.let { ui(it) } ?: id.substringAfterLast('/').replace('_', ' ')
                        ZoneOption(name, id, selected == id) { change(id) }
                    }
                }
            }
        }, confirmButton = { TextButton(onClick = dismiss) { Text(ui("关闭")) } })
}

@Composable
private fun ZoneOption(name: String, id: String, selected: Boolean, choose: () -> Unit) {
    Column(Modifier.fillMaxWidth().clickable(onClick = choose).padding(vertical = 8.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(if (selected) "✓  $name" else name, style = MaterialTheme.typography.titleMedium)
        Text(id, style = MaterialTheme.typography.labelMedium)
    }
}

@Composable
internal fun HistoryScreen(records: List<SavedReading>, preferences: Preferences, model: YiShuViewModel) {
    var search by rememberSaveable { mutableStateOf("") }
    var settings by rememberSaveable { mutableStateOf(false) }
    var selectZone by rememberSaveable { mutableStateOf(false) }
    var deleteId by rememberSaveable { mutableStateOf<String?>(null) }
    var confirmClear by rememberSaveable { mutableStateOf(false) }
    val export = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        uri?.let { model.export(it, records) }
    }
    val corpus = LocalCorpus.current
    val visible = remember(records, search, corpus) {
        val term = search.trim()
        records.filter { entry ->
            entry.question.contains(term, true) || entry.caption.contains(term, true) ||
                Method.valueOf(entry.method).label.contains(term, true) ||
                corpus?.interfaceText(entry.caption, true)?.contains(term, true) == true ||
                corpus?.interfaceText(Method.valueOf(entry.method).label, true)?.contains(term, true) == true
        }
    }
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PagePadding, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Hero("历史与设置", "查看已保存的结果，管理本机记录与偏好。") }
        item {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                FilterChip(!settings, onClick = { settings = false }, label = { Text(ui("历史记录")) })
                FilterChip(settings, onClick = { settings = true }, label = { Text(ui("应用设置")) })
            }
        }
        if (settings) {
            item { PreferencesPanel(preferences, model::updatePreferences, { selectZone = true }) }
            item {
                Panel {
                    Section("隐私与资料")
                    Text(ui("无需账户。起卦、解读和查询在设备上运行，主动保存的记录留在本机。导出时由你选择文件位置。"))
                    Text(ui("经典文本、笔画和字形映射来源见六十四卦。"))
                }
            }
        } else {
            item {
                Panel {
                    OutlinedTextField(search, { search = it }, Modifier.fillMaxWidth(), label = { Text(ui("搜索卦名、问题或起卦方式")) }, singleLine = true)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(enabled = records.isNotEmpty(), onClick = { export.launch("yishu-history.json") }) { Text(ui("导出全部 JSON")) }
                        TextButton(enabled = records.isNotEmpty(), onClick = { confirmClear = true }) { Text(ui("清空记录")) }
                    }
                    if (visible.isEmpty()) Text(ui(if (records.isEmpty()) "还没有保存的记录。" else "没有符合搜索条件的记录。"))
                }
            }
            items(visible, key = { it.id }) { entry ->
                Panel {
                    Text(ui(entry.caption), style = MaterialTheme.typography.titleMedium)
                    val date = Instant.ofEpochMilli(entry.createdAt).atZone(zoneFor(preferences))
                    Text("${ui(Method.valueOf(entry.method).label)} · ${date.format(dayFormat)} ${date.format(minuteFormat)}")
                    if (entry.question.isNotBlank()) Text(entry.question, maxLines = 2)
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = { model.open(entry) }, enabled = corpus != null) { Text(ui("查看记录")) }
                        TextButton(onClick = { deleteId = entry.id }) { Text(ui("删除")) }
                    }
                }
            }
        }
    }
    if (selectZone) ZonePicker(preferences.zone, { selectZone = false }) { id ->
        model.updatePreferences { it.copy(zone = id) }
        selectZone = false
    }
    if (confirmClear) ConfirmDelete("清空全部记录？", { confirmClear = false }) { model.clear(); confirmClear = false }
    deleteId?.let { id ->
        ConfirmDelete("删除这条记录？", { deleteId = null }) {
            records.find { it.id == id }?.let(model::delete)
            deleteId = null
        }
    }
}

@Composable
private fun ConfirmDelete(title: String, dismiss: () -> Unit, delete: () -> Unit) {
    AlertDialog(onDismissRequest = dismiss, title = { Text(ui(title)) },
        confirmButton = { TextButton(onClick = delete) { Text(ui("确认删除"), color = MaterialTheme.colorScheme.error) } },
        dismissButton = { TextButton(onClick = dismiss) { Text(ui("取消")) } })
}

@Composable
private fun PreferencesPanel(settings: Preferences, update: ((Preferences) -> Preferences) -> Unit, chooseZone: () -> Unit) {
    Panel {
        Section("起卦偏好")
        Selector("笔画标准", StrokeMode.entries, settings.plum.strokes, StrokeMode::label) { item ->
            update { it.copy(plum = it.plum.copy(strokes = item)) }
        }
        Selector("数字解释", DigitMode.entries, settings.plum.digits, DigitMode::label) { item ->
            update { it.copy(plum = it.plum.copy(digits = item)) }
        }
        Selector("单段输入遇到奇数项", OddSplit.entries, settings.plum.oddSplit, OddSplit::label) { item ->
            update { it.copy(plum = it.plum.copy(oddSplit = item)) }
        }
        ToggleRow("要求移除其他字符", "默认忽略标点、空格、负号和表情，可在计算过程查看。", settings.plum.requireSupportedCharacters) { item ->
            update { it.copy(plum = it.plum.copy(requireSupportedCharacters = item)) }
        }
        Text(ui("上、下卦取各段总和除以 8 的余数：0 坤、1 乾、2 兑、3 离、4 震、5 巽、6 坎、7 艮。总和除以 6 的余数决定动爻，0 取上爻。"))
    }
    Panel {
        Section("显示与时间")
        ToggleRow("English interface", "English explanations with the Chinese classics alongside them.", settings.english) { item ->
            update { it.copy(english = item) }
        }
        Selector("文字", listOf(false, true), settings.traditional, { if (it) "繁體中文" else "简体中文" }) { item ->
            update { it.copy(traditional = item) }
        }
        Selector("主题", Appearance.entries, settings.appearance, Appearance::label) { item -> update { it.copy(appearance = item) } }
        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
        Text("${ui("时区")} · ${settings.zone.ifBlank { ui("跟随设备") }}")
        OutlinedButton(onClick = chooseZone) { Text(ui("选择城市或时区")) }
        Selector("时辰规则", HourRule.entries, settings.hourRule, HourRule::label) { item -> update { it.copy(hourRule = item) } }
    }
}

@Composable
private fun <T> Selector(title: String, items: List<T>, current: T, label: (T) -> String, change: (T) -> Unit) {
    Column {
        Text(ui(title), style = MaterialTheme.typography.titleMedium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items.forEach { item -> FilterChip(item == current, onClick = { change(item) }, label = {
                val caption = label(item)
                Text(if (caption == "繁體中文" || caption == "简体中文") caption else ui(caption))
            }) }
        }
    }
}
