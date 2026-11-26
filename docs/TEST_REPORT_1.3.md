# YiShu 1.3.0 verification

- 11 web/Worker tests passed, including all 64 English gua, 384 line notes, special statements, Android/website content parity, SQLite-backed session deduplication, private dashboard authentication, invalid-input rejection, same-origin enforcement, and Do Not Track / Global Privacy Control handling. Existing calendar, reading, VIP access, and derived-hexagram checks still pass.
- 14 Kotlin domain tests passed (unchanged calculation engine).
- All six Android instrumentation tests passed on Android 17 / API 37. Tests used the English interface to cast, save, reopen and delete a reading; enter and undo coin tosses; navigate traditional hours and time zones; browse the English library; verify corpus completeness; and check persistent history and preferences.
- Android debug build and lint passed. Signed release build passed signature and ZIP alignment verification. The signer matches earlier releases: `bdc3c76f264fe29f9c4c7db0ec0371abeab6827e1662244fa625858e299edd80`.
- Windows x64 portable ZIP compiled and includes the English website and content. A full Windows interaction walkthrough was not performed in this release; the shared website was checked in the browser.
- Browser checks confirmed English navigation, the `1234` reading (The Traveler to Stillness, line 4), bilingual classical passages, all 64 library entries, and English search for Before Completion.

No new physical Android-device test was performed. Session counts are estimates and cannot identify individual visitors. Live deployment and downloadable release links are verified separately during publication.
