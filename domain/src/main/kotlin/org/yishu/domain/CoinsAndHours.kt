package org.yishu.domain

import java.security.SecureRandom
import java.time.Instant
import java.time.ZoneId
import java.time.ZonedDateTime

enum class CoinLine(val total: Int, val label: String, val yang: Boolean, val moving: Boolean) {
    OLD_YIN(6, "老阴", false, true), YOUNG_YANG(7, "少阳", true, false),
    YOUNG_YIN(8, "少阴", false, false), OLD_YANG(9, "老阳", true, true);

    companion object {
        fun fromTotal(total: Int): CoinLine = entries.first { it.total == total }
    }
}

data class Toss(val line: CoinLine, val heads: List<Boolean>?) {
    init {
        require(heads == null || (heads.size == 3 && 6 + heads.count { it } == line.total))
    }
}

class Coins(private val nextHead: () -> Boolean = SecureRandom()::nextBoolean) {
    fun toss(): Toss {
        val heads = List(3) { nextHead() }
        return Toss(CoinLine.fromTotal(6 + heads.count { it }), heads)
    }

    fun fromTosses(tosses: List<Toss>, hexagrams: Hexagrams): Reading {
        require(tosses.size == 6)
        val bits = tosses.foldIndexed(0) { index, current, toss ->
            if (toss.line.yang) current or (1 shl index) else current
        }
        val moving = tosses.mapIndexedNotNull { index, toss -> if (toss.line.moving) index + 1 else null }
        return hexagrams.reading(bits, moving)
    }
}

enum class EarthlyBranch(val label: String, val firstHour: Int) {
    ZI("子", 23), CHOU("丑", 1), YIN("寅", 3), MAO("卯", 5), CHEN("辰", 7), SI("巳", 9),
    WU("午", 11), WEI("未", 13), SHEN("申", 15), YOU("酉", 17), XU("戌", 19), HAI("亥", 21);

    fun interval(): String {
        val start = firstHour.toString().padStart(2, '0')
        val end = ((firstHour + 1) % 24).toString().padStart(2, '0')
        return "$start:00–$end:59"
    }

    companion object {
        fun atHour(hour: Int): EarthlyBranch = entries[((hour + 1) / 2) % 12]
    }
}

data class HourAssessment(
    val time: ZonedDateTime,
    val current: EarthlyBranch,
    val next: EarthlyBranch,
    val nextStart: ZonedDateTime,
    val ziPeriod: String?,
)

fun assessHour(instant: Instant, zone: ZoneId): HourAssessment {
    val local = instant.atZone(zone)
    val current = EarthlyBranch.atHour(local.hour)
    val rules = zone.rules
    // Resolve both offsets during overlaps and include skipped civil boundaries at the transition.
    val date = local.toLocalDate()
    val boundaries = (0L..2L).flatMap { day ->
        EarthlyBranch.entries.flatMap { branch ->
            val wall = date.plusDays(day).atTime(branch.firstHour, 0)
            val offsets = rules.getValidOffsets(wall)
            if (offsets.isEmpty()) listOfNotNull(rules.getTransition(wall)?.instant)
            else offsets.map(wall::toInstant)
        }
    } + listOfNotNull(rules.nextTransition(instant)?.instant)
    val next = boundaries.asSequence().filter { it > instant }.sorted()
        .map { it.atZone(zone) }.first { EarthlyBranch.atHour(it.hour) != current }
    val zi = when (local.hour) { 23 -> "夜子"; 0 -> "早子"; else -> null }
    return HourAssessment(local, current, EarthlyBranch.atHour(next.hour), next, zi)
}
