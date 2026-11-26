package org.yishu.app

import android.net.Uri
import androidx.room.Room
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import java.io.File
import java.util.UUID
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.runBlocking
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.yishu.domain.HourRule
import org.yishu.domain.StrokeMode

@RunWith(AndroidJUnit4::class)
class PersistenceTest {
    private val context = InstrumentationRegistry.getInstrumentation().targetContext

    @Test fun bundledCorpusContainsCanonicalOrderAndStrokeSources() {
        val data = Corpus(context.assets)
        assertEquals(64, data.hexagrams.entries.size)
        assertEquals(384, data.hexagrams.entries.sumOf { it.lineTexts.size })
        data.hexagrams.entries.forEach { gua ->
            val english = data.englishGua(gua.number)
            assertEquals(6, english.getJSONArray("lines").length())
            assertTrue(english.getString("meaning").isNotBlank())
            assertTrue(data.englishText(gua.title).contains(english.getString("name")))
            assertTrue(data.englishClassic(gua.judgment).contains(gua.judgment))
        }
        assertEquals(64, data.hexagrams.entries.map { it.bits }.distinct().size)
        assertEquals("乾为天", data.hexagrams.byBits(63).title)
        assertEquals("坤为地", data.hexagrams.byBits(0).title)
        assertEquals("水火既济", data.hexagrams.byNumber(63).title)
        assertEquals("火水未济", data.hexagrams.byNumber(64).title)
        assertTrue(data.classicText(data.hexagrams.byNumber(1).judgment, false).startsWith("乾："))
        assertEquals("澤山咸", data.interfaceText("泽山咸", true))
        assertTrue(data.hexagrams.entries.all { it.source.startsWith("https://zh.wikisource.org/wiki/Special:PermanentLink/") })
        assertEquals(listOf(5, 16), data.dictionary.choices("龙", StrokeMode.MODERN).map { it.count })
        assertEquals(listOf("龙", "龍"), data.dictionary.choices("龙", StrokeMode.KANGXI).map { it.glyph })
        assertEquals(listOf(16, 16), data.dictionary.choices("龙", StrokeMode.KANGXI).map { it.count })
    }

    @Test fun historyPersistsDeduplicatesAndExportsJson() = runBlocking {
        val name = "qa-${UUID.randomUUID()}.db"
        val file = File.createTempFile("yishu-qa", ".json", context.cacheDir)
        val entry = SavedReading("test-id", 42, "PLUM", "问题", "卦", """{"id":"test-id","question":"问题"}""")
        fun open() = Room.databaseBuilder(context, YiShuDatabase::class.java, name).build()
        var database = open()
        try {
            database.history().insert(entry)
            database.history().insert(entry)
            database.close()
            database = open()
            val history = database.history()
            val saved = history.observe().first()
            assertEquals(listOf(entry), saved)
            exportHistory(context, Uri.fromFile(file), saved)
            val exported = JSONObject(file.readText())
            assertEquals(1, exported.getInt("schemaVersion"))
            assertEquals("问题", exported.getJSONArray("readings").getJSONObject(0).getString("question"))
            history.delete(entry.id)
            assertTrue(history.observe().first().isEmpty())
        } finally {
            database.close()
            file.delete()
            context.deleteDatabase(name)
        }
    }

    @Test fun settingsPersistAcrossRepositoryInstances() = runBlocking {
        val settings = Settings(context)
        val before = settings.values.first()
        try {
            settings.update { it.copy(zone = "Asia/Tokyo", traditional = true, appearance = Appearance.DARK, hourRule = HourRule.BASIC) }
            val saved = Settings(context).values.first()
            assertEquals("Asia/Tokyo", saved.zone)
            assertTrue(saved.traditional)
            assertEquals(Appearance.DARK, saved.appearance)
            assertEquals(HourRule.BASIC, saved.hourRule)
        } finally {
            settings.update { before }
        }
    }
}
