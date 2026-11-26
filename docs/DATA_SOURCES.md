# Datasets and verification

The shipped data manifest records file hashes, coverage, and counts. The per-hexagram revision list pins the text transcriptions. [Data manifest](data-manifest.json) · [Wikisource revisions](hexagram-revisions.json)

## 《周易》

64 records in King Wen order, each with one hexagram statement, one Great Image, and six bottom-up line statements. 乾 and 坤 also include their extra 用九 and 用六. The ancient source text is in the public domain. The bundled transcription and punctuation, including the app’s extraction and simplified display, are attributed to the linked Wikisource contributors under CC BY-SA 4.0. The importer retains the lead reading and removes editorial footnotes, alternate-reading popups, HTML, and images. Traditional display uses the extracted transcription. Simplified display applies OpenCC conversion. [Chinese Wikisource 《周易》](https://zh.wikisource.org/wiki/周易) · [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)

The supplied 易安居 index gives the King Wen number and short display name, upper and lower trigram pair, and a reference link for each hexagram. The importer checks every entry against the Wikisource hexagram figure number, trigram caption and line labels. The bundle contains the classical material and lookup facts. The interpretations in the app use its own templates. [易安居六十四卦参考索引](https://www.zhouyi.cc/zhouyi/yijing64/)

Each JSON row contains `number`, `name`, `title`, `upper`, `lower`, `bits`, `judgment`, `image`, `lines`, `extra`, `source`, `revision`, and `reference`. The source URL leads to the exact transcription revision. Review covers complete structure, line polarity, unique patterns and agreement between the two indexes. Scholarly review of the reading variants remains open. [Bundled hexagrams](../app/src/main/assets/hexagrams.json)

## Character stroke counts and script variants

| Dataset | App fields | License |
| --- | --- | --- |
| Unicode Unihan 17.0.0 | 102,998 `kTotalStrokes` entries. `kTraditionalVariant` and `kSimplifiedVariant` supply explicit alternatives for 12,972 code points. | Unicode License v3 |
| Kawai Lo’s `kangxi-strokecount`, pinned to `778d23d0566066ab19906557755b882818ec0a06` | 63,696 covered code points. Legacy table derived from Unicode 11.0-era data. | MIT |
| OpenCC 1.1.9 | `STCharacters`, `TSCharacters`, and `TSPhrases` for Chinese display. The app preserves raw user input. | Apache 2.0 |

Each TSV row contains the Unicode code point in hexadecimal, the modern count, comma-separated Kangxi counts, and comma-separated variant code points. Empty fields are missing values. The Unihan count is a broad modern reference and can differ from regional stroke standards. Kangxi entries follow the pinned source’s convention and have a different coverage range. The calculation trace shows the source and resolved form, and a manual count can be used where a character’s convention needs review. Source licenses are bundled in the APK. [Unihan documentation](https://www.unicode.org/reports/tr38/) · [Unihan 17.0.0 distribution](https://www.unicode.org/Public/17.0.0/ucd/Unihan.zip) · [Kangxi table](https://github.com/breezyreeds/kangxi-strokecount/tree/778d23d0566066ab19906557755b882818ec0a06) · [OpenCC 1.1.9](https://github.com/BYVoid/OpenCC/tree/ver.1.1.9) · [Bundled stroke table](../app/src/main/assets/strokes.tsv)

## Traditional hours

The traditional rule is derived from Volume 7 and cross-checked against the complete 甲子 and 乙丑 rows in Volume 32. The Gregorian date-to-cycle calculation is anchored to the Hong Kong Observatory’s 2026 June calendar and checked against dates in both April and June. Civil boundary, time-zone and daylight-saving behavior are tested independently. [Volume 7](https://zh.wikisource.org/wiki/欽定協紀辨方書_(四庫全書本)/卷07) · [Volume 32](https://zh.wikisource.org/wiki/欽定協紀辨方書_(四庫全書本)/卷32) · [HKO June 2026](https://www.hko.gov.hk/en/gts/astron2026/files/2026cal06.pdf) · [HKO 2026 almanac](https://www.hko.gov.hk/tc/gts/astron2026/files/HKO_almanac_2026.pdf)
