package org.yishu.domain

import java.math.BigInteger
import java.security.SecureRandom
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class DivinationTest {
    private val fixture = Hexagrams(List(64) { bits ->
        val upper = Trigram.entries.single { it.bits == bits shr 3 }
        val lower = Trigram.entries.single { it.bits == bits and 7 }
        Hexagram(bits + 1, "卦", "卦", upper, lower, "卦辞", "大象", List(6) { "爻辞" }, null, "fixture", "fixture")
    })

    private val dictionary = StrokeDictionary { glyph, mode ->
        when (glyph to mode) {
            "龙" to StrokeMode.MODERN -> listOf(StrokeChoice("龙", 5, "fixture"), StrokeChoice("龍", 16, "fixture"))
            "龙" to StrokeMode.KANGXI -> listOf(StrokeChoice("龍", 16, "fixture"))
            "汉" to StrokeMode.KANGXI -> listOf(StrokeChoice("漢", 15, "fixture"), StrokeChoice("漢", 14, "fixture"))
            else -> emptyList()
        }
    }
    private val plum = PlumCalculator(dictionary)

    @Test fun `custom remainder mapping and bottom up lines are stable`() {
        assertEquals("坤乾兑离震巽坎艮", (0..7).joinToString("") { Trigram.fromRemainder(it).nameZh })
        assertEquals(listOf(0, 7, 3, 5, 1, 6, 2, 4), (0..7).map { Trigram.fromRemainder(it).bits })
        val trace = plum.trace("8", "4", PlumRules())
        val result = checkNotNull(trace.reading(fixture))
        assertEquals(Trigram.KUN, result.original.upper)
        assertEquals(Trigram.ZHEN, result.original.lower)
        assertEquals(listOf(6), result.moving)
        assertEquals(0b100001, result.changed.bits)
    }

    @Test fun `unicode decimals and ignored symbols do not alter split`() {
        val trace = plum.trace("１ ٢，𝟛🤔", null, PlumRules())
        assertEquals(listOf("1", "2"), trace.upper.map(Token::normalized))
        assertEquals(listOf("3"), trace.lower.map(Token::normalized))
        assertEquals(mapOf(" " to 1, "，" to 1, "🤔" to 1), trace.ignored)
        val reversed = plum.trace("１２３", null, PlumRules(oddSplit = OddSplit.LOWER))
        assertEquals(listOf("1"), reversed.upper.map(Token::normalized))
        assertEquals(listOf("2", "3"), reversed.lower.map(Token::normalized))
        assertEquals(setOf(InputIssue.UNSUPPORTED_CHARACTERS), plum.trace("1-2", null,
            PlumRules(requireSupportedCharacters = true)).issues)
    }

    @Test fun `empty sections and integer grouping produce explicit issues`() {
        assertEquals(setOf(InputIssue.SINGLE_SHORT), plum.trace("1", null, PlumRules()).issues)
        assertEquals(setOf(InputIssue.UPPER_EMPTY, InputIssue.LOWER_EMPTY), plum.trace("", "😄", PlumRules()).issues)
        assertEquals(setOf(InputIssue.SINGLE_SHORT), plum.trace("123", null, PlumRules(digits = DigitMode.INTEGER)).issues)
        val trace = plum.trace("００５ ６", null, PlumRules(digits = DigitMode.INTEGER))
        assertEquals("005", trace.upper.single().normalized)
        assertEquals(BigInteger.valueOf(5), trace.upperSum)
        assertEquals(BigInteger.valueOf(6), trace.lowerSum)
    }

    @Test fun `whole number inputs retain thousands of digits`() {
        val number = "9".repeat(10_000)
        val trace = plum.trace(number, "0", PlumRules(digits = DigitMode.INTEGER))
        assertEquals(number, trace.upperSum.toString())
        assertEquals(BigInteger.ZERO, trace.lowerSum)
        val reading = checkNotNull(trace.reading(fixture))
        assertEquals(Trigram.GEN, reading.original.upper)
        assertEquals(listOf(3), reading.moving)
    }

    @Test fun `stroke alternatives and overrides are traceable`() {
        val modern = plum.trace("龙7", null, PlumRules())
        assertEquals(5, modern.upper.single().stroke?.count)
        assertEquals(2, modern.upper.single().alternatives.size)
        val old = plum.trace("龙7", null, PlumRules(strokes = StrokeMode.KANGXI))
        val glyph = old.upper.single()
        assertEquals("龍", glyph.normalized)
        assertEquals(16, glyph.stroke?.count)
        val ambiguous = plum.trace("汉7", null, PlumRules(strokes = StrokeMode.KANGXI))
        assertNull(ambiguous.reading(fixture))
        assertEquals(setOf(InputIssue.UNKNOWN_STROKES), ambiguous.issues)
        assertNull(plum.trace("𠀀7", null, PlumRules()).reading(fixture))
        val override = StrokeChoice("𠀀", 9, "manual")
        val confirmed = plum.trace("𠀀7", null, PlumRules(), mapOf("𠀀" to override))
        assertEquals(override, confirmed.upper.single().stroke)
        assertNotNull(confirmed.reading(fixture))
    }

    @Test fun `all line masks flip simultaneously and zero remains unchanged`() {
        val coins = Coins()
        for (movingMask in 0..63) {
            val tosses = List(6) { index -> Toss(if (movingMask and (1 shl index) != 0) CoinLine.OLD_YANG else CoinLine.YOUNG_YANG, null) }
            val reading = coins.fromTosses(tosses, fixture)
            assertEquals(63, reading.original.bits)
            assertEquals(63 xor movingMask, reading.changed.bits)
            assertEquals(Integer.bitCount(movingMask), reading.moving.size)
        }
    }

    @Test fun `each combination of three fair coins yields correct polarity and total`() {
        val frequency = mutableMapOf<Int, Int>()
        for (bits in 0..7) {
            val sides = (0..2).map { index -> bits and (1 shl index) != 0 }
            val iterator = sides.iterator()
            val toss = Coins(iterator::next).toss()
            assertEquals(sides, toss.heads)
            assertEquals(6 + sides.count { it }, toss.line.total)
            assertEquals(toss.line.total % 2 == 1, toss.line.yang)
            assertEquals(toss.line.total in listOf(6, 9), toss.line.moving)
            frequency.merge(toss.line.total, 1, Int::plus)
        }
        assertEquals(mapOf(6 to 1, 7 to 3, 8 to 3, 9 to 1), frequency)
    }

    @Test fun `secure random rolls have the expected distribution`() {
        val coins = Coins(SecureRandom()::nextBoolean)
        val totals = IntArray(4)
        repeat(48_000) { totals[coins.toss().line.total - 6]++ }
        val expected = listOf(6_000, 18_000, 18_000, 6_000)
        expected.forEachIndexed { index, count -> assertTrue(totals[index] in (count - 480)..(count + 480)) }
    }
}
