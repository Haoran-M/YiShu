package org.yishu.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.BackHandler
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.SideEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.saveable.rememberSaveableStateHolder
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.view.WindowCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent { YiShuApp() }
    }
}

private val Light = lightColorScheme(
    primary = Color(0xFF225044), onPrimary = Color(0xFFFFFFFF), primaryContainer = Color(0xFFDDEAE0),
    onPrimaryContainer = Color(0xFF173C32), secondary = Color(0xFF795727),
    secondaryContainer = Color(0xFFDDEAE0), onSecondaryContainer = Color(0xFF173C32),
    background = Color(0xFFF6F2E9), onBackground = Color(0xFF202D27),
    surface = Color(0xFFFFFCF5), onSurface = Color(0xFF202D27),
    surfaceVariant = Color(0xFFEAE7DB), onSurfaceVariant = Color(0xFF4C5B52),
    surfaceContainer = Color(0xFFF0EDE3), outline = Color(0xFF738176), outlineVariant = Color(0xFFDCD8C9),
    error = Color(0xFF9C3B28),
)

private val Dark = darkColorScheme(
    primary = Color(0xFFA7D4BE), onPrimary = Color(0xFF153C30), primaryContainer = Color(0xFF254B3F),
    onPrimaryContainer = Color(0xFFDAF2E3), secondary = Color(0xFFE1BB7C),
    secondaryContainer = Color(0xFF385B4D), onSecondaryContainer = Color(0xFFDAF2E3),
    background = Color(0xFF141C18), onBackground = Color(0xFFEDEDE2),
    surface = Color(0xFF1C2721), onSurface = Color(0xFFEDEDE2),
    surfaceVariant = Color(0xFF2C3A33), onSurfaceVariant = Color(0xFFC1CFC4),
    surfaceContainer = Color(0xFF202C25), outline = Color(0xFF95A398), outlineVariant = Color(0xFF46544B),
    error = Color(0xFFFFB4A3),
)

private val Type = Typography(
    headlineLarge = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 36.sp, lineHeight = 44.sp),
    headlineMedium = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 27.sp, lineHeight = 35.sp),
    titleLarge = TextStyle(fontFamily = FontFamily.Serif, fontWeight = FontWeight.SemiBold, fontSize = 22.sp, lineHeight = 30.sp),
    titleMedium = TextStyle(fontWeight = FontWeight.SemiBold, fontSize = 16.sp, lineHeight = 24.sp),
    bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 25.sp),
    bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 22.sp),
    labelMedium = TextStyle(fontWeight = FontWeight.Medium, fontSize = 12.sp, lineHeight = 18.sp),
)

internal val LocalCorpus = staticCompositionLocalOf<Corpus?> { null }
internal val LocalTraditional = staticCompositionLocalOf { false }
internal val LocalEnglish = staticCompositionLocalOf { true }

@Composable
internal fun ui(text: String): String = LocalCorpus.current?.let { if (LocalEnglish.current) it.englishText(text) else it.interfaceText(text, LocalTraditional.current) } ?: text

@Composable
internal fun classic(text: String): String = LocalCorpus.current?.let { if (LocalEnglish.current) it.englishClassic(text) else it.classicText(text, LocalTraditional.current) } ?: text

@Composable
private fun YiShuApp(model: YiShuViewModel = viewModel()) {
    val preferences by model.preferences.collectAsStateWithLifecycle()
    val corpus by model.corpus.collectAsStateWithLifecycle()
    val error by model.error.collectAsStateWithLifecycle()
    val result by model.result.collectAsStateWithLifecycle()
    val records by model.records.collectAsStateWithLifecycle()
    val dark = when (preferences.appearance) {
        Appearance.SYSTEM -> isSystemInDarkTheme()
        Appearance.LIGHT -> false
        Appearance.DARK -> true
    }
    val view = LocalView.current
    val context = LocalContext.current
    SideEffect {
        val activity = view.context as? ComponentActivity ?: return@SideEffect
        WindowCompat.getInsetsController(activity.window, view).apply {
            isAppearanceLightStatusBars = !dark
            isAppearanceLightNavigationBars = !dark
        }
    }
    var tab by rememberSaveable { mutableIntStateOf(0) }
    var library by rememberSaveable { mutableStateOf(false) }
    var selected by rememberSaveable { mutableIntStateOf(0) }
    var calculationFor by rememberSaveable { mutableStateOf<String?>(null) }
    val calculation = result != null && calculationFor == result?.id
    val screenState = rememberSaveableStateHolder()
    val canGoBack = library || result != null
    val back: () -> Unit = {
        when {
            selected != 0 -> selected = 0
            library -> library = false
            calculation -> calculationFor = null
            result != null -> model.closeResult()
            else -> Unit
        }
    }
    BackHandler(canGoBack, onBack = back)

    CompositionLocalProvider(LocalCorpus provides corpus, LocalTraditional provides preferences.traditional, LocalEnglish provides preferences.english) {
        MaterialTheme(colorScheme = if (dark) Dark else Light, typography = Type) {
            Scaffold(
                topBar = {
                    Surface(color = MaterialTheme.colorScheme.background) {
                        Column(Modifier.statusBarsPadding()) {
                            Row(
                                Modifier.fillMaxWidth().padding(start = 20.dp, end = 14.dp, top = 5.dp, bottom = 4.dp),
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.SpaceBetween,
                            ) {
                                when {
                                    canGoBack -> TextButton(onClick = back) { Text(ui("‹  返回")) }
                                    else -> Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                                        Surface(shape = RoundedCornerShape(8.dp), color = MaterialTheme.colorScheme.primary) {
                                            Text("易", Modifier.padding(horizontal = 8.dp, vertical = 4.dp), color = MaterialTheme.colorScheme.onPrimary,
                                                style = MaterialTheme.typography.titleMedium)
                                        }
                                        Text(ui("易数通玄"), style = MaterialTheme.typography.titleMedium)
                                    }
                                }
                                if (!library) Row {
                                    TextButton(onClick = { library = true }, enabled = corpus != null) { Text(ui("六十四卦")) }
                                    TextButton(onClick = { VipActivity.open(context, preferences, result) }) { Text("VIP") }
                                }
                            }
                            HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        }
                    }
                },
                bottomBar = {
                    if (!canGoBack) NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
                        listOf("梅花易数", "六爻摇卦", "时辰吉凶", "历史设置").forEachIndexed { index, title ->
                            NavigationBarItem(
                                selected = tab == index, onClick = { tab = index },
                                icon = { NavMark(index) }, label = { Text(ui(title), maxLines = 2) },
                                colors = NavigationBarItemDefaults.colors(indicatorColor = MaterialTheme.colorScheme.primaryContainer),
                            )
                        }
                    }
                },
            ) { insets ->
                Box(Modifier.fillMaxSize().padding(insets), contentAlignment = Alignment.TopCenter) {
                    Box(Modifier.widthIn(max = 630.dp).fillMaxSize()) {
                        val data = corpus
                        when {
                            data != null && library -> if (selected == 0) screenState.SaveableStateProvider("library") {
                                LibraryScreen(data.hexagrams, { selected = it })
                            } else HexagramScreen(data.hexagrams.byNumber(selected))
                            data != null && result != null -> result?.let { current ->
                                if (calculation) CalculationScreen(current) { calculationFor = null }
                                else ResultScreen(current, records.any { it.id == current.id }, { model.save(current) }) { calculationFor = current.id }
                            }
                            data == null && tab < 2 -> if (error == null) CircularProgressIndicator(Modifier.align(Alignment.Center))
                                else Text(ui("资料暂不可用"), Modifier.align(Alignment.Center))
                            else -> screenState.SaveableStateProvider("tab-$tab") {
                                when (tab) {
                                    0 -> PlumScreen(model, preferences)
                                    1 -> CoinScreen(model, preferences)
                                    2 -> HoursScreen(preferences, model::updatePreferences)
                                    else -> HistoryScreen(records, preferences, model)
                                }
                            }
                        }
                    }
                }
            }
            error?.let { message ->
                AlertDialog(onDismissRequest = model::dismissError, text = { Text(ui(message)) },
                    confirmButton = { TextButton(onClick = model::dismissError) { Text(ui("确定")) } })
            }
        }
    }
}

@Composable
private fun NavMark(index: Int) {
    val color = MaterialTheme.colorScheme.onSurface
    Canvas(Modifier.size(23.dp)) {
        val w = size.width
        val stroke = 1.8.dp.toPx()
        fun line(x1: Float, y1: Float, x2: Float, y2: Float) =
            drawLine(color, Offset(w * x1, w * y1), Offset(w * x2, w * y2), stroke, StrokeCap.Round)
        when (index) {
            0 -> {
                listOf(0.23f, 0.77f).forEach { y -> line(0.14f, y, 0.86f, y) }
                line(.14f, .50f, .38f, .50f)
                line(.62f, .50f, .86f, .50f)
            }
            1 -> {
                drawCircle(color, radius = w * .36f, style = Stroke(stroke))
                drawRect(color, Offset(w * .39f, w * .39f), androidx.compose.ui.geometry.Size(w * .22f, w * .22f), style = Stroke(stroke))
            }
            2 -> {
                drawCircle(color, radius = w * .37f, style = Stroke(stroke))
                line(.50f, .28f, .50f, .50f)
                line(.50f, .50f, .66f, .60f)
            }
            else -> {
                line(.29f, .18f, .72f, .18f)
                line(.29f, .18f, .29f, .82f)
                line(.72f, .18f, .72f, .82f)
                line(.29f, .82f, .50f, .66f)
                line(.50f, .66f, .72f, .82f)
            }
        }
    }
}

@Composable
internal fun Panel(content: @Composable ColumnScope.() -> Unit) {
    Surface(
        Modifier.fillMaxWidth(), shape = RoundedCornerShape(18.dp), color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    ) {
        Column(Modifier.padding(17.dp), verticalArrangement = Arrangement.spacedBy(12.dp), content = content)
    }
}

@Composable
internal fun Section(title: String, detail: String? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(ui(title), style = MaterialTheme.typography.titleLarge)
        if (detail != null) Text(ui(detail), color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
internal fun Hero(title: String, detail: String, bits: Int? = null) {
    Surface(Modifier.fillMaxWidth(), shape = RoundedCornerShape(22.dp), color = Color(0xFF20483D)) {
        Box {
            Canvas(Modifier.align(Alignment.CenterEnd).size(120.dp)) {
                val center = Offset(size.width * .70f, size.height * .50f)
                for (fraction in listOf(.38f, .48f, .61f)) {
                    drawCircle(Color(0x38DFBF84), size.width * fraction, center, style = Stroke(1.dp.toPx()))
                }
            }
            Row(Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 19.dp), verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(ui(title), color = Color(0xFFFFF5DD), style = MaterialTheme.typography.headlineMedium)
                    Text(ui(detail), color = Color(0xFFE0E7D5), style = MaterialTheme.typography.bodyMedium)
                }
                if (bits != null) HexagramDrawing(bits, emptyList(), Modifier.size(width = 56.dp, height = 65.dp), Color(0xFFE3C486))
            }
        }
    }
}

@Composable
internal fun HexagramDrawing(bits: Int, moving: List<Int>, modifier: Modifier, ink: Color = MaterialTheme.colorScheme.primary, label: String? = null) {
    val movingInk = MaterialTheme.colorScheme.error
    val semantics = if (label == null) modifier else modifier.semantics { contentDescription = label }
    Canvas(semantics) {
        val height = size.height / 6
        val width = size.width
        val thickness = minOf(height * .38f, 5.dp.toPx())
        for (line in 1..6) {
            val y = (6.5f - line) * height
            val color = if (line in moving) movingInk else ink
            if (bits and (1 shl (line - 1)) != 0) {
                drawLine(color, Offset(thickness, y), Offset(width - thickness, y), thickness, StrokeCap.Round)
            } else {
                drawLine(color, Offset(thickness, y), Offset(width * .40f, y), thickness, StrokeCap.Round)
                drawLine(color, Offset(width * .60f, y), Offset(width - thickness, y), thickness, StrokeCap.Round)
            }
        }
    }
}
