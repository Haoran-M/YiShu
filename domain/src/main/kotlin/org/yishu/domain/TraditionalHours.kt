package org.yishu.domain

import java.time.LocalDate
import java.time.temporal.ChronoUnit

enum class HourRule(val label: String, val id: String) {
    BASIC("基础十二时辰", "civil-hours-v1"),
    TWELVE_DEITIES("黄黑道十二神", "xieji-twelve-deities-civil-midnight-v1"),
}

enum class HourDeity(val label: String, val yellowPath: Boolean) {
    QINGLONG("青龙", true), MINGTANG("明堂", true), TIANXING("天刑", false), ZHUQUE("朱雀", false),
    JINGUI("金匮", true), TIANDE("天德", true), BAIHU("白虎", false), YUTANG("玉堂", true),
    TIANLAO("天牢", false), XUANWU("玄武", false), SIMING("司命", true), GOUCHEN("勾陈", false);

    val classification: String get() = if (yellowPath) "黄道 · 吉" else "黑道 · 凶"
}

data class TraditionalHour(val date: LocalDate, val dayStemBranch: String, val qinglongStartsAt: EarthlyBranch, val deity: HourDeity)

// The anchor is the day stem/branch printed in the HKO June 2026 almanac.
private val jiazi = LocalDate.of(2026, 6, 19)
private const val stems = "甲乙丙丁戊己庚辛壬癸"
private val qinglongStart = listOf(EarthlyBranch.SHEN, EarthlyBranch.XU, EarthlyBranch.ZI, EarthlyBranch.YIN, EarthlyBranch.CHEN, EarthlyBranch.WU)

fun traditionalHour(date: LocalDate, hourBranch: EarthlyBranch): TraditionalHour {
    val dayIndex = Math.floorMod(ChronoUnit.DAYS.between(jiazi, date), 60L).toInt()
    val dayBranch = EarthlyBranch.entries[dayIndex % 12]
    val dayStemBranch = "${stems[dayIndex % 10]}${dayBranch.label}"
    // 《欽定協紀辨方書》卷七，黃黑道，考原，日起時。
    val start = qinglongStart[dayBranch.ordinal % 6]
    val deity = HourDeity.entries[Math.floorMod(hourBranch.ordinal - start.ordinal, 12)]
    return TraditionalHour(date, dayStemBranch, start, deity)
}
