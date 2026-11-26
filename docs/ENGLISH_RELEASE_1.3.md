# YiShu 1.3.0 · English edition

[Use the website](https://yishu-workbench.shortbrine32.chatgpt.site/) · [Download apps](https://yishu-workbench.shortbrine32.chatgpt.site/downloads.html) · [GitHub](https://github.com/Haoran-M/YiShu)

English is the default on the website, Android, and Windows. All 64 gua have an English name and pinyin, an explanation of the judgment, an interpretation of the Image, a practical reflection, and six line paraphrases. The two special all-changing-line statements are also explained. Chinese source texts remain alongside the English. These are original explanatory paraphrases prepared from the bundled Chinese corpus, not quotations from a modern English translation. Historical gendered and political imagery is explained as context rather than presented as a rule for modern relationships. English explanatory content is distributed under CC BY-SA 4.0 together with its attributed Chinese source material.

The editable content lives in `tools/english-gua.txt` and `tools/english-ui.txt`. Run `node tools/build-english.mjs` after editing; it validates 64 entries and six lines per gua, then emits matching Android and website assets. English and pinyin search work alongside Chinese names and numbers. Existing saved readings are preserved. Settings still offer Chinese interfaces.

## Private visit dashboard

Open `/analytics.html` on the public website. The publisher key is stored separately in `%LOCALAPPDATA%\YiShuPublisher\analytics-key.txt`, and as the secret `YISHU_ANALYTICS_KEY` in Sites. It is never included in the public repository or downloads. Enter it into the dashboard; the browser holds it in page memory only and sends it in the Authorization header over HTTPS. Close the tab or choose Clear key to forget it.

The dashboard reports page views by section, daily anonymous sessions, and the last 30 UTC days. A session is a random identifier in browser-tab session storage that renews after 30 minutes of inactivity. It is an estimate of visits, not identified people or cross-device unique visitors. Page navigation increments page views; repeated views in the same daily session do not add sessions. Privacy preferences, blockers, offline use, and bots affect totals. Historical traffic before this release is unavailable.

The counter stores only UTC day, section, random session ID, and first-seen timestamp. It excludes IP addresses, full URLs, referrers, questions, birth details, and names. Session IDs older than the rolling 30-day window are deleted during incoming recorded visits; aggregate page totals are retained. Do Not Track, Global Privacy Control, and the local opt-out on `/privacy.html` prevent counting. Installed apps do not send analytics. VIP access does not grant dashboard access.

The Sites manifest declares D1 binding `DB`. The schema is in `sites/yishu/drizzle/0000_visit_counts.sql`; Sites applies the migration before deployment. Do not expose the dashboard key in frontend code or reuse a VIP passphrase as the dashboard key.

## Builds

The Android package is `org.yishu.app`, version code 4, and uses the same local QA signing certificate as earlier releases. Windows is a portable x64 ZIP using the installed WebView2 Runtime; its executable is unsigned. The apps bundle the public tools and English library for offline use. VIP passphrase activation needs a connection initially, then works until the signed pass expires.

Checksums accompany the GitHub release. See `docs/TEST_REPORT_1.3.md` for verification and remaining limits.
