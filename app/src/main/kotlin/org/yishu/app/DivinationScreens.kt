package org.yishu.app

import android.content.Context
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.SystemClock
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.selection.toggleable
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import org.yishu.domain.CoinLine
import org.yishu.domain.InputIssue
import org.yishu.domain.PlumTrace
import org.yishu.domain.StrokeChoice
import org.yishu.domain.StrokeMode
import org.yishu.domain.Token

internal val PagePadding = PaddingValues(start = 18.dp, top = 17.dp, end = 18.dp, bottom = 24.dp)

@Composable
internal fun PlumScreen(model: YiShuViewModel, preferences: Preferences) {
    val form by model.plum.collectAsStateWithLifecycle()
    val keyboard = LocalSoftwareKeyboardController.current
    var editing by rememberSaveable { mutableStateOf<String?>(null) }
    var questionOpen by rememberSaveable { mutableStateOf(false) }
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PagePadding, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Hero("梅花易数", "用数字、汉字或一句诗起卦。", bits = 0b010001) }
        item {
            Panel {
                Section("起卦输入", "采用自定义梅花易数起卦规则。")
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    FilterChip(!form.dual, onClick = { model.updatePlum { it.copy(dual = false, trace = null) } }, label = { Text(ui("单段输入")) })
                    FilterChip(form.dual, onClick = { model.updatePlum { it.copy(dual = true, trace = null) } }, label = { Text(ui("上下卦分开")) })
                }
                OutlinedTextField(
                    value = form.input, onValueChange = { value -> model.updatePlum { it.copy(input = value, trace = null) } },
                    modifier = Modifier.fillMaxWidth(), enabled = !form.busy,
                    label = { Text(ui(if (form.dual) "上卦输入" else "数字、汉字或混合文字")) },
                    placeholder = { Text(ui("例如 1234 或 春风又绿")) }, maxLines = 5,
                )
                if (form.dual) OutlinedTextField(
                    value = form.secondInput, onValueChange = { value -> model.updatePlum { it.copy(secondInput = value, trace = null) } },
                    modifier = Modifier.fillMaxWidth(), enabled = !form.busy, label = { Text(ui("下卦输入")) }, maxLines = 5,
                )
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    StrokeMode.entries.forEach { mode ->
                        FilterChip(preferences.plum.strokes == mode, enabled = !form.busy, onClick = {
                            model.updatePlum { it.copy(trace = null) }
                            model.updatePreferences { it.copy(plum = it.plum.copy(strokes = mode)) }
                        }, label = { Text(ui(mode.label)) })
                    }
                }
                Text(ui("数字：${preferences.plum.digits.label}  ·  ${preferences.plum.oddSplit.label}"),
                    style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), itemVerticalAlignment = Alignment.CenterVertically) {
                    if (!questionOpen) PlumSubmit(form.busy) { keyboard?.hide(); model.generatePlum() }
                    TextButton(onClick = { questionOpen = !questionOpen }, enabled = !form.busy) {
                        Text(ui(when {
                            questionOpen -> "收起所问事项"
                            form.question.isNotBlank() || form.category != Category.OTHER -> "编辑所问事项"
                            else -> "填写问题（可选）"
                        }))
                    }
                }
            }
        }
        if (questionOpen) {
            item {
                QuestionPanel(form.category, form.question,
                    { category -> model.updatePlum { it.copy(category = category) } },
                    { question -> model.updatePlum { it.copy(question = question) } })
            }
            item { PlumSubmit(form.busy, Modifier.fillMaxWidth()) { keyboard?.hide(); model.generatePlum() } }
        }
        form.trace?.takeIf { it.rules == preferences.plum }?.let { trace ->
            item { InputReport(trace) }
            val editable = (trace.upper + trace.lower).filter { it.stroke != null || it.value == null }.distinctBy(Token::raw)
            items(editable, key = Token::raw) { token ->
                Panel {
                    Text(token.raw, style = MaterialTheme.typography.titleMedium)
                    val stroke = token.stroke
                    Text(if (stroke == null) ui("需核对笔画") else "${stroke.glyph} · ${stroke.count} ${ui("画")} · ${ui(stroke.source)}")
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        token.alternatives.forEach { choice ->
                            FilterChip(token.stroke == choice, onClick = {
                                model.overrideStroke(token.raw, choice)
                            }, label = { Text("${choice.glyph} · ${choice.count} ${ui("画")}") })
                        }
                        TextButton(onClick = { editing = token.raw }) { Text(ui("手动填写")) }
                    }
                }
            }
        }
    }

    editing?.let { glyph ->
        var count by rememberSaveable(glyph) { mutableStateOf("") }
        val parsed = count.toIntOrNull()
        AlertDialog(onDismissRequest = { editing = null }, title = { Text("${ui("手动笔画")} · $glyph") },
            text = {
                OutlinedTextField(count, { count = it }, label = { Text(ui("正整数笔画数")) },
                    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number), singleLine = true)
            },
            confirmButton = {
                TextButton(enabled = parsed != null && parsed > 0, onClick = {
                    val stroke = StrokeChoice(glyph, checkNotNull(parsed), "手动覆盖")
                    editing = null
                    model.overrideStroke(glyph, stroke)
                }) { Text(ui("采用")) }
            }, dismissButton = { TextButton(onClick = { editing = null }) { Text(ui("取消")) } })
    }
}

@Composable
private fun PlumSubmit(busy: Boolean, modifier: Modifier = Modifier, submit: () -> Unit) {
    Button(onClick = submit, enabled = !busy, modifier = modifier) {
        Text(ui(if (busy) "正在计算…" else "开始起卦"), Modifier.padding(vertical = 3.dp))
    }
}

@Composable
private fun InputReport(trace: PlumTrace) {
    Panel {
        Section("输入核对")
        for (issue in trace.issues) {
            val description = when (issue) {
                InputIssue.UPPER_EMPTY -> "上卦需要至少一项有效输入。"
                InputIssue.LOWER_EMPTY -> "下卦需要至少一项有效输入。"
                InputIssue.SINGLE_SHORT -> "单段输入至少需要两项。请增加输入，或选择上下卦分开。"
                InputIssue.UNKNOWN_STROKES -> "请选择可用字形与笔画，填写笔画数，或替换该字。"
                InputIssue.UNSUPPORTED_CHARACTERS -> "当前设置要求移除不参与计算的字符。"
            }
            Text(ui(description), color = MaterialTheme.colorScheme.error)
        }
        if (trace.ignored.isNotEmpty()) {
            Text("${ui("未计入的字符")} · ${trace.ignored.entries.joinToString("、") { (key, count) -> "${visibleCharacter(key)} × $count" }}")
        }
        if (trace.issues.isEmpty()) Text(ui("可在下方核对字形和笔画，修改后会重新计算。"))
    }
}

private fun visibleCharacter(value: String) = if (value.isBlank()) {
    "U+${value.codePointAt(0).toString(16).uppercase().padStart(4, '0')}"
} else "「$value」"

@Composable
private fun QuestionPanel(category: Category, question: String, choose: (Category) -> Unit, edit: (String) -> Unit) {
    var open by remember { mutableStateOf(false) }
    Panel {
        Section("所问事项", "可选。问题仅保存在你主动保存的本机记录里。")
        Box {
            OutlinedButton(onClick = { open = true }) { Text("${ui("类别")} · ${ui(category.label)}  ▾") }
            DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
                Category.entries.forEach { option ->
                    DropdownMenuItem(text = { Text(ui(option.label)) }, onClick = { choose(option); open = false })
                }
            }
        }
        OutlinedTextField(question, edit, Modifier.fillMaxWidth(), label = { Text(ui("想了解的问题")) }, maxLines = 4)
    }
}

@Composable
internal fun CoinScreen(model: YiShuViewModel, preferences: Preferences) {
    val form by model.coin.collectAsStateWithLifecycle()
    val keyboard = LocalSoftwareKeyboardController.current
    val sensorAvailable = listenForShake(preferences.shake && form.tosses.size < 6, model::toss)
    val heads = ui("正面")
    val tails = ui("反面")
    LazyColumn(Modifier.fillMaxWidth(), contentPadding = PagePadding, verticalArrangement = Arrangement.spacedBy(14.dp)) {
        item { Hero("六爻摇卦", "每次投三枚铜钱，由初爻向上记录六次。", bits = 0b101010) }
        item {
            Panel {
                Section("投币进度 · ${form.tosses.size} / 6", "每枚正面 3 点，反面 2 点。")
                LinearProgressIndicator(progress = { form.tosses.size / 6f }, modifier = Modifier.fillMaxWidth())
                ToggleRow("摇动手机投币", if (sensorAvailable) "摇动触发一轮随机投币" else "此设备没有加速度传感器", preferences.shake,
                    enabled = sensorAvailable, change = { enabled -> model.updatePreferences { it.copy(shake = enabled) } })
                Button(enabled = form.tosses.size < 6, onClick = model::toss, modifier = Modifier.fillMaxWidth()) { Text(ui("投三枚铜钱")) }
                Text(ui("手工录入点数"), style = MaterialTheme.typography.labelMedium)
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    CoinLine.entries.forEach { line ->
                        OutlinedButton(enabled = form.tosses.size < 6, onClick = { model.addManual(line) },
                            contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp)) { Text(line.total.toString()) }
                    }
                }
                if (form.tosses.isNotEmpty()) {
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    form.tosses.asReversed().forEachIndexed { index, toss ->
                        val lineNumber = form.tosses.size - index
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                            LineMark(toss.line.yang, toss.line.moving)
                            Column(Modifier.weight(1f)) {
                                Text("${ui("第")}$lineNumber${ui("爻")} · ${toss.line.total} · ${ui(toss.line.label)}", style = MaterialTheme.typography.titleMedium)
                                Text(toss.heads?.joinToString("  ·  ") { side -> if (side) heads else tails } ?: ui("手工录入"))
                            }
                        }
                    }
                    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TextButton(onClick = { model.updateCoin { it.copy(tosses = it.tosses.dropLast(1)) } }) { Text(ui("撤销上一次")) }
                        TextButton(onClick = { model.updateCoin { it.copy(tosses = emptyList()) } }) { Text(ui("重新开始")) }
                    }
                }
            }
        }
        item {
            QuestionPanel(form.category, form.question,
                { category -> model.updateCoin { it.copy(category = category) } },
                { question -> model.updateCoin { it.copy(question = question) } })
        }
        item {
            Button(enabled = form.tosses.size == 6, onClick = { keyboard?.hide(); model.generateCoins() }, modifier = Modifier.fillMaxWidth()) {
                Text(ui("查看本卦与变卦"), Modifier.padding(vertical = 3.dp))
            }
        }
    }
}

@Composable
private fun LineMark(yang: Boolean, moving: Boolean) {
    val color = if (moving) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    Row(Modifier.size(width = 44.dp, height = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        repeat(if (yang) 1 else 2) { Surface(Modifier.weight(1f).size(height = 4.dp, width = 16.dp), shape = RoundedCornerShape(2.dp), color = color) {} }
    }
}

@Composable
internal fun ToggleRow(title: String, detail: String, selected: Boolean, enabled: Boolean = true, change: (Boolean) -> Unit) {
    Row(Modifier.fillMaxWidth().toggleable(value = selected, enabled = enabled, role = Role.Switch, onValueChange = change),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Column(Modifier.weight(1f)) {
            Text(ui(title), style = MaterialTheme.typography.titleMedium)
            Text(ui(detail), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = selected, onCheckedChange = null, enabled = enabled)
    }
}

@Composable
private fun listenForShake(enabled: Boolean, onToss: () -> Unit): Boolean {
    val context = LocalContext.current
    val lifecycle = LocalLifecycleOwner.current.lifecycle
    val manager = remember(context) { context.getSystemService(Context.SENSOR_SERVICE) as SensorManager }
    val sensor = remember(manager) { manager.getDefaultSensor(Sensor.TYPE_ACCELEROMETER) }
    val toss by rememberUpdatedState(onToss)
    DisposableEffect(enabled, lifecycle, sensor) {
        if (!enabled || sensor == null) return@DisposableEffect onDispose {}
        var last = SystemClock.elapsedRealtime()
        val listener = object : SensorEventListener {
            override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) = Unit
            override fun onSensorChanged(event: SensorEvent) {
                val (x, y, z) = event.values
                val now = SystemClock.elapsedRealtime()
                if (x * x + y * y + z * z > 22f * 22f && now - last >= 900) {
                    last = now
                    toss()
                }
            }
        }
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> manager.registerListener(listener, sensor, SensorManager.SENSOR_DELAY_GAME)
                Lifecycle.Event.ON_PAUSE -> manager.unregisterListener(listener)
                else -> Unit
            }
        }
        lifecycle.addObserver(observer)
        onDispose { lifecycle.removeObserver(observer); manager.unregisterListener(listener) }
    }
    return sensor != null
}
