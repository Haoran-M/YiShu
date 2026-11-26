package org.yishu.domain

import java.math.BigInteger

enum class StrokeMode(val label: String) { MODERN("现代笔画"), KANGXI("康熙笔画") }
enum class DigitMode(val label: String) { DIGITS("逐位求和"), INTEGER("整段整数") }
enum class OddSplit(val label: String) { UPPER("前半多一项"), LOWER("后半多一项") }

data class PlumRules(
    val strokes: StrokeMode = StrokeMode.MODERN,
    val digits: DigitMode = DigitMode.DIGITS,
    val oddSplit: OddSplit = OddSplit.UPPER,
    val requireSupportedCharacters: Boolean = false,
)

data class StrokeChoice(val glyph: String, val count: Int, val source: String)

fun interface StrokeDictionary {
    fun choices(glyph: String, mode: StrokeMode): List<StrokeChoice>
}

data class Token(
    val raw: String,
    val normalized: String,
    val value: BigInteger?,
    val stroke: StrokeChoice? = null,
    val alternatives: List<StrokeChoice> = emptyList(),
)

enum class InputIssue { UPPER_EMPTY, LOWER_EMPTY, SINGLE_SHORT, UNKNOWN_STROKES, UNSUPPORTED_CHARACTERS }

data class PlumTrace(
    val upper: List<Token>,
    val lower: List<Token>,
    val ignored: Map<String, Int>,
    val rules: PlumRules,
    val issues: Set<InputIssue>,
) {
    val upperSum: BigInteger? = sum(upper)
    val lowerSum: BigInteger? = sum(lower)

    fun reading(hexagrams: Hexagrams): Reading? {
        if (issues.isNotEmpty()) return null
        val top = checkNotNull(upperSum)
        val bottom = checkNotNull(lowerSum)
        val upperTrigram = Trigram.fromRemainder(top.mod(EIGHT).toInt())
        val lowerTrigram = Trigram.fromRemainder(bottom.mod(EIGHT).toInt())
        val moving = (top + bottom).mod(SIX).toInt().let { if (it == 0) 6 else it }
        return hexagrams.reading(upperTrigram.bits shl 3 or lowerTrigram.bits, listOf(moving))
    }

    private fun sum(tokens: List<Token>): BigInteger? {
        if (tokens.isEmpty() || tokens.any { it.value == null }) return null
        return tokens.fold(BigInteger.ZERO) { total, token -> total + checkNotNull(token.value) }
    }

    companion object {
        private val EIGHT = BigInteger.valueOf(8)
        private val SIX = BigInteger.valueOf(6)
    }
}

class PlumCalculator(private val dictionary: StrokeDictionary) {
    fun trace(
        input: String,
        secondInput: String?,
        rules: PlumRules,
        overrides: Map<String, StrokeChoice> = emptyMap(),
    ): PlumTrace {
        val ignored = linkedMapOf<String, Int>()
        val first = tokenize(input, rules, overrides, ignored)
        val upper: List<Token>
        val lower: List<Token>
        val issues = mutableSetOf<InputIssue>()
        if (secondInput != null) {
            upper = first
            lower = tokenize(secondInput, rules, overrides, ignored)
            if (upper.isEmpty()) issues.add(InputIssue.UPPER_EMPTY)
            if (lower.isEmpty()) issues.add(InputIssue.LOWER_EMPTY)
        } else {
            val split = first.size / 2 + if (rules.oddSplit == OddSplit.UPPER) first.size % 2 else 0
            upper = first.take(split)
            lower = first.drop(split)
            if (first.size < 2) issues.add(InputIssue.SINGLE_SHORT)
        }
        if ((upper + lower).any { it.value == null }) issues.add(InputIssue.UNKNOWN_STROKES)
        if (rules.requireSupportedCharacters && ignored.isNotEmpty()) issues.add(InputIssue.UNSUPPORTED_CHARACTERS)
        return PlumTrace(upper, lower, ignored, rules, issues)
    }

    private fun tokenize(
        text: String,
        rules: PlumRules,
        overrides: Map<String, StrokeChoice>,
        ignored: MutableMap<String, Int>,
    ): List<Token> = buildList {
        val digits = StringBuilder()
        val rawDigits = StringBuilder()

        fun flushDigits() {
            if (digits.isEmpty()) return
            val normalized = digits.toString()
            add(Token(rawDigits.toString(), normalized, normalized.toBigInteger()))
            digits.clear()
            rawDigits.clear()
        }

        var offset = 0
        while (offset < text.length) {
            val code = text.codePointAt(offset)
            val end = offset + Character.charCount(code)
            val raw = text.substring(offset, end)
            val digit = Character.digit(code, 10)
            offset = end
            if (digit >= 0) {
                rawDigits.append(raw)
                digits.append(digit)
                if (rules.digits == DigitMode.DIGITS) flushDigits()
                continue
            }
            flushDigits()
            if (code in 65..90 || code in 97..122) {
                val upperCode = if (code in 97..122) code - 32 else code
                add(Token(raw, upperCode.toChar().toString(), (upperCode - 64).toBigInteger()))
            } else if (Character.UnicodeScript.of(code) == Character.UnicodeScript.HAN) {
                val choices = dictionary.choices(raw, rules.strokes)
                val chosen = overrides[raw] ?: choices.firstOrNull()?.takeIf {
                    it.glyph == raw && choices.count { option -> option.glyph == raw } == 1
                } ?: choices.singleOrNull()
                add(Token(raw, chosen?.glyph ?: raw, chosen?.count?.toBigInteger(), chosen, choices))
            } else {
                ignored[raw] = (ignored[raw] ?: 0) + 1
            }
        }
        flushDigits()
    }
}
