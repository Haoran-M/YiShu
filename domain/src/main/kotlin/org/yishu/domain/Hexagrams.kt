package org.yishu.domain

enum class Trigram(val remainder: Int, val nameZh: String, val image: String, val element: String, val direction: String, val bits: Int, val symbol: String) {
    KUN(0, "坤", "地", "土", "西南", 0b000, "☷"),
    QIAN(1, "乾", "天", "金", "西北", 0b111, "☰"),
    DUI(2, "兑", "泽", "金", "西", 0b011, "☱"),
    LI(3, "离", "火", "火", "南", 0b101, "☲"),
    ZHEN(4, "震", "雷", "木", "东", 0b001, "☳"),
    XUN(5, "巽", "风", "木", "东南", 0b110, "☴"),
    KAN(6, "坎", "水", "水", "北", 0b010, "☵"),
    GEN(7, "艮", "山", "土", "东北", 0b100, "☶");

    companion object {
        fun fromRemainder(value: Int): Trigram = entries[value]
    }
}

data class Hexagram(
    val number: Int,
    val name: String,
    val title: String,
    val upper: Trigram,
    val lower: Trigram,
    val judgment: String,
    val image: String,
    val lineTexts: List<String>,
    val extra: String?,
    val source: String,
    val reference: String,
) {
    val bits: Int get() = upper.bits shl 3 or lower.bits
}

class Hexagrams(val entries: List<Hexagram>) {
    private val byBits = entries.associateBy(Hexagram::bits)

    init {
        require(entries.map(Hexagram::number) == (1..64).toList())
        require(byBits.size == 64)
        require(entries.all { it.lineTexts.size == 6 && it.lineTexts.none(String::isBlank) })
    }

    fun byNumber(number: Int): Hexagram = entries[number - 1]
    fun byBits(bits: Int): Hexagram = byBits.getValue(bits)

    fun reading(bits: Int, moving: List<Int>): Reading {
        require(moving.size == moving.distinct().size && moving.all { it in 1..6 })
        val flipped = moving.fold(bits) { mask, line -> mask xor (1 shl (line - 1)) }
        return Reading(byBits(bits), byBits(flipped), moving.sorted())
    }
}

data class Reading(val original: Hexagram, val changed: Hexagram, val moving: List<Int>)

fun readingLines(bits: Int): List<Boolean> = (0..5).map { bits and (1 shl it) != 0 }
