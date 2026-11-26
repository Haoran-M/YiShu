package org.yishu.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createAndroidComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextInput
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AppTest {
    @get:Rule val rule = createAndroidComposeRule<MainActivity>()

    private fun waitFor(text: String) {
        rule.waitUntil(timeoutMillis = 12_000) { rule.onAllNodes(hasText(text)).fetchSemanticsNodes().isNotEmpty() }
    }

    private fun reach(text: String) {
        rule.onAllNodes(hasScrollAction()).onFirst().performScrollToNode(hasText(text))
    }

    @Test fun languageSwitchSupportsChineseAndPersistsAcrossRecreation() {
        waitFor("Create a reading")
        rule.onNodeWithText("English ▾").performClick()
        rule.onNodeWithText("简体中文").performClick()
        waitFor("起卦输入")
        rule.activityRule.scenario.recreate()
        waitFor("起卦输入")
        rule.onNodeWithText("简体中文 ▾").performClick()
        rule.onNodeWithText("繁體中文").performClick()
        waitFor("起卦輸入")
        rule.onNodeWithText("繁體中文 ▾").performClick()
        rule.onNodeWithText("English").performClick()
        waitFor("Create a reading")
    }

    @Test fun numericalReadingCanBeSavedReopenedAndDeleted() {
        waitFor("Create a reading")
        rule.onNodeWithText("Numbers, English words, or Chinese characters").performTextInput("1234")
        reach("Cast reading")
        rule.onNodeWithText("Cast reading").performClick()
        waitFor("Reading Result")
        rule.onNodeWithText("The Traveler · Lu").assertIsDisplayed()
        rule.onNodeWithText("Stillness · Gen").assertIsDisplayed()
        reach("Save reading")
        rule.onNodeWithText("Save reading").performClick()
        waitFor("Saved")
        reach("View calculation")
        rule.onNodeWithText("View calculation").performClick()
        reach("Upper trigram：3 ÷ 8 remainder 3 → Li (Fire)")
        rule.onNodeWithText("Upper trigram：3 ÷ 8 remainder 3 → Li (Fire)").assertIsDisplayed()
        reach("Return to reading")
        rule.onNodeWithText("Return to reading").performClick()
        rule.onNodeWithText("‹  Back").performClick()
        rule.onNodeWithText("History").performClick()
        reach("The Traveler · Lu → Stillness · Gen")
        rule.onNodeWithText("The Traveler · Lu → Stillness · Gen").assertIsDisplayed()
        reach("View reading")
        rule.onNodeWithText("View reading").performClick()
        waitFor("Reading Result")
        rule.onNodeWithText("‹  Back").performClick()
        reach("Delete")
        rule.onNodeWithText("Delete").performClick()
        rule.onNodeWithText("Confirm deletion").performClick()
        reach("No readings saved yet.")
    }

    @Test fun EnglishWordsProduceTheExpectedReading() {
        waitFor("Create a reading")
        rule.onNodeWithText("Numbers, English words, or Chinese characters").performTextInput("hello")
        reach("Cast reading")
        rule.onNodeWithText("Cast reading").performClick()
        waitFor("Reading Result")
        rule.onNodeWithText("Fellowship · Tong Ren").assertIsDisplayed()
        rule.onNodeWithText("The Household · Jia Ren").assertIsDisplayed()
        reach("Moving lines · 4")
    }

    @Test fun manualTossesAllowUndoAndProduceMultipleMovingLines() {
        waitFor("Create a reading")
        rule.onNodeWithText("Three-Coin Reading").performClick()
        for (power in listOf(6, 7, 8, 9)) {
            reach(power.toString())
            rule.onNodeWithText(power.toString()).performClick()
        }
        reach("Undo last toss")
        rule.onNodeWithText("Undo last toss").performClick()
        for (power in listOf(9, 7, 8)) {
            reach(power.toString())
            rule.onNodeWithText(power.toString()).performClick()
        }
        reach("View original and changed hexagrams")
        rule.onNodeWithText("View original and changed hexagrams").performClick()
        waitFor("Reading Result")
        rule.onNodeWithText("Constraint and Exhaustion · Kun").assertIsDisplayed()
        rule.onNodeWithText("Boundaries and Moderation · Jie").assertIsDisplayed()
        reach("Moving lines · 1、4")
    }

    @Test fun hoursAndClassicalLibraryWorkThroughNavigation() {
        waitFor("Create a reading")
        rule.onNodeWithText("Hours").performClick()
        reach("Choose city or time zone")
        rule.onNodeWithText("Choose city or time zone").performClick()
        rule.onNodeWithText("Search cities or time zones").performTextInput("Tokyo")
        rule.onNodeWithText("Asia/Tokyo").performClick()
        waitFor("Traditional Hours")
        reach("Twelve symbolic hour guardians")
        rule.onNodeWithText("Twelve symbolic hour guardians").assertIsDisplayed()
        reach("Basic twelve-hour system")
        rule.onNodeWithText("Basic twelve-hour system").performClick()
        waitFor("Symbolic auspiciousness is disabled")
        rule.onNodeWithText("Twelve symbolic hour guardians").performClick()
        rule.onNodeWithText("64 Hexagrams").performClick()
        reach("Search English name, pinyin, Chinese name, or number")
        rule.onNodeWithText("Search English name, pinyin, Chinese name, or number").performTextInput("2")
        reach("Receptive Earth · Kun")
        rule.onNodeWithText("Receptive Earth · Kun").performClick()
        waitFor("Judgment")
        reach("The six line statements")
        rule.onNodeWithText("The six line statements").assertIsDisplayed()
    }
}
