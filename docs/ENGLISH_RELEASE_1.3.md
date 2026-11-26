# YiShu 1.3.0 · English edition

[Use the website](https://yishu-workbench.shortbrine32.chatgpt.site/) · [Download apps](https://yishu-workbench.shortbrine32.chatgpt.site/downloads.html) · [GitHub](https://github.com/Haoran-M/YiShu)

English is the default on the website, Android, and Windows. All 64 gua have an English name and pinyin, an explanation of the judgment, an interpretation of the Image, a practical reflection, and six line paraphrases. The two special all-changing-line statements are also explained. Chinese source texts remain alongside the English. These are original explanatory paraphrases prepared from the bundled Chinese corpus, not quotations from a modern English translation. Historical gendered and political imagery is explained as context rather than presented as a rule for modern relationships. English explanatory content is distributed under CC BY-SA 4.0 together with its attributed Chinese source material.

The editable content lives in `tools/english-gua.txt` and `tools/english-ui.txt`. Run `node tools/build-english.mjs` after editing; it validates 64 entries and six lines per gua, then emits matching Android and website assets. English and pinyin search work alongside Chinese names and numbers. Existing saved readings are preserved. Settings still offer Chinese interfaces.

Visit collection and its public interface have been removed.

## Builds

The Android package is `org.yishu.app`, version code 4, and uses the same local QA signing certificate as earlier releases. Windows is a portable x64 ZIP using the installed WebView2 Runtime; its executable is unsigned. The apps bundle the public tools and English library for offline use. VIP passphrase activation needs a connection initially, then works until the signed pass expires.

Checksums accompany the GitHub release. See `docs/TEST_REPORT_1.3.md` for verification and remaining limits.
