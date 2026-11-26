# Calculation decisions

## 梅花易数 · Algorithm 1.0.0

| Remainder | Trigram | Lines, bottom to top |
| --- | --- | --- |
| 0 | 坤 | 000 |
| 1 | 乾 | 111 |
| 2 | 兑 | 110 |
| 3 | 离 | 101 |
| 4 | 震 | 100 |
| 5 | 巽 | 011 |
| 6 | 坎 | 010 |
| 7 | 艮 | 001 |

`1` represents yang. Internally, bit 0 is the bottom line and bit 5 is the top. The lower trigram occupies bits 0–2 and the upper trigram occupies bits 3–5. King Wen numbers index presentation and classical texts. The bit pattern indexes calculations.

The default tokenizes Unicode decimal digits individually and normalizes them to ASCII. Integer mode treats a contiguous sequence of digits as one token. Punctuation and other unsupported characters end a run and are listed in the trace. Strict input mode requires removing them. Han glyphs use the selected dictionary even when they can be read as Chinese numerals. For a single input, split the eligible token sequence into two halves, with the extra token assigned to the first half by default. Two independent inputs bypass the split. The upper and lower sums are reduced modulo 8. The combined sum is reduced modulo 6 and remainder zero selects line six. `BigInteger` holds input values and totals.

Stroke counts prefer the entered glyph when that glyph has a unique exact count in the selected dictionary. A unique alternative is accepted and shown with its original and resolved forms. An ambiguous or missing count requires user action. Overrides are scoped to the selected stroke mode and the current session. Saved results include the evaluated glyph, resolved glyph, count and source. Dictionary alternatives can be reviewed on the input screen after returning from a result.

## 六爻 · Algorithm 1.0.0

Heads contribute 3 and tails 2. Six independent tosses each contain three independently sampled fair coins. The first toss is the bottom line. Totals 6, 7, 8 and 9 denote moving yin, static yang, static yin and moving yang. All moving lines are flipped together. A reading with zero moving lines retains its original pattern. Manual totals retain their entry method. Android acceleration is only a trigger and uses a 900 ms interval between accepted triggers.

## Traditional hours

`civil-hours-v1` applies 12 two-hour branches to the selected IANA zone. It distinguishes 夜子 at 23:00–23:59 and 早子 at 00:00–00:59. The next branch is computed on the timeline using the zone’s actual offsets and transitions.

`xieji-twelve-deities-civil-midnight-v1` uses the selected zone’s local Gregorian date. An application convention changes the sexagenary day at 00:00. The first and last civil-hour segments of a given date therefore share its 子时 classification. The anchor is 2026-06-19 甲子 from the Hong Kong Observatory. Count calendar days relative to that date modulo 60. The rule places 青龙 at 申, 戌, 子, 寅, 辰 or 午 for day branches 子/午, 丑/未, 寅/申, 卯/酉, 辰/戌 or 巳/亥 respectively. The other deities follow in branch order. The app applies the twelve-deity classification from Volume 7. Cross-check the 甲子 and 乙丑 rows in Volume 32, which also lists other daily considerations outside this rule. The app uses 天德 and 玄武 as the display labels. [Rule and calendar references](DATA_SOURCES.md#traditional-hours)

## Interpretation and storage

Interpretation v1 combines the trigrams’ symbolic themes with the original hexagram, the text of every moving line, the changed hexagram, and one of seven question-category prompts. Free text is retained and shown verbatim if provided. The selected category controls the generated wording. Interpretations are cultural reflection material.

Room stores an ID, UTC creation timestamp, method, question, caption, and JSON payload. The payload includes the hexagram numbers, moving lines, method inputs, calculation trace, interpretation, source URLs, and calculation version. Export wraps the retained payloads with `schemaVersion: 1`. DataStore stores display, stroke, time zone, hour, and divination preferences. The app manifest declares neither Internet nor location permission. Records are excluded from Android backup and device transfer.
