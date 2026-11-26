package org.yishu.domain

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class HoursTest {
    @Test fun `all twelve boundaries change at the exact minute`() {
        val utc = ZoneId.of("UTC")
        val midnight = Instant.parse("2026-11-22T00:00:00Z")
        EarthlyBranch.entries.forEachIndexed { index, branch ->
            val start = midnight.plusSeconds(branch.firstHour * 3600L)
            val earlier = assessHour(start.minusSeconds(1), utc)
            assertEquals(EarthlyBranch.entries[(index + 11) % 12], earlier.current)
            assertEquals(start, earlier.nextStart.toInstant())
            assertEquals(branch, assessHour(start, utc).current)
            assertEquals(branch, assessHour(start.plusSeconds(7199), utc).current)
        }
        assertEquals("23:00–00:59", EarthlyBranch.ZI.interval())
    }

    @Test fun `night and early Zi follow the selected local civil date`() {
        val shanghai = ZoneId.of("Asia/Shanghai")
        val night = assessHour(Instant.parse("2026-11-22T15:00:00Z"), shanghai)
        val early = assessHour(Instant.parse("2026-11-22T16:00:00Z"), shanghai)
        assertEquals("夜子", night.ziPeriod)
        assertEquals("早子", early.ziPeriod)
        assertEquals(night.time.toLocalDate().plusDays(1), early.time.toLocalDate())
        assertEquals("2026-11-22T17:00:00Z", early.nextStart.toInstant().toString())
        assertNull(assessHour(early.time.toInstant(), ZoneId.of("America/New_York")).ziPeriod)
    }

    @Test fun `daylight saving gaps and repeated hours use distinct instants`() {
        val ny = ZoneId.of("America/New_York")
        val spring = assessHour(Instant.parse("2026-03-08T06:59:59Z"), ny)
        assertEquals(EarthlyBranch.CHOU, spring.current)
        assertEquals(EarthlyBranch.YIN, spring.next)
        assertEquals("2026-03-08T07:00:00Z", spring.nextStart.toInstant().toString())

        val first = assessHour(Instant.parse("2026-11-01T05:30:00Z"), ny)
        val second = assessHour(Instant.parse("2026-11-01T06:30:00Z"), ny)
        assertEquals(EarthlyBranch.CHOU, first.current)
        assertEquals(first.current, second.current)
        assertEquals("2026-11-01T08:00:00Z", first.nextStart.toInstant().toString())
        assertEquals(first.nextStart, second.nextStart)
    }

    @Test fun `sexagenary calculations match the Hong Kong Observatory almanac`() {
        val checks = mapOf("2026-04-20" to "甲子", "2026-06-19" to "甲子", "2026-06-20" to "乙丑", "2026-06-21" to "丙寅")
        for ((date, stemBranch) in checks) {
            assertEquals(stemBranch, traditionalHour(LocalDate.parse(date), EarthlyBranch.ZI).dayStemBranch)
        }
    }

    @Test fun `historic volume 32 tables confirm Jiazi and Yichou hours`() {
        val jiazi = LocalDate.of(2026, 6, 19)
        val expectedJiazi = listOf("金匮", "天德", "白虎", "玉堂", "天牢", "玄武", "司命", "勾陈", "青龙", "明堂", "天刑", "朱雀")
        val expectedYichou = listOf("天刑", "朱雀", "金匮", "天德", "白虎", "玉堂", "天牢", "玄武", "司命", "勾陈", "青龙", "明堂")
        for ((date, expected) in listOf(jiazi to expectedJiazi, jiazi.plusDays(1) to expectedYichou)) {
            val deities = EarthlyBranch.entries.map { traditionalHour(date, it).deity }
            assertEquals(expected, deities.map(HourDeity::label))
            assertEquals(6, deities.count(HourDeity::yellowPath))
        }
        assertEquals(listOf("申", "戌", "子", "寅", "辰", "午"), (0L..5L).map { offset ->
            traditionalHour(jiazi.plusDays(offset), EarthlyBranch.ZI).qinglongStartsAt.label
        })
    }

    @Test fun `two parts of Zi resolve against the local date at midnight`() {
        val zone = ZoneId.of("Asia/Shanghai")
        val before = assessHour(Instant.parse("2026-06-19T15:59:59Z"), zone)
        val after = assessHour(Instant.parse("2026-06-19T16:00:00Z"), zone)
        assertEquals(before.current, after.current)
        assertEquals(HourDeity.JINGUI, traditionalHour(before.time.toLocalDate(), before.current).deity)
        assertEquals(HourDeity.TIANXING, traditionalHour(after.time.toLocalDate(), after.current).deity)
    }
}
