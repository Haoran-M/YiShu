# YiShu 1.0.0 test report

| Check | Result |
| --- | --- |
| Kotlin unit tests | 14 passed. Covered custom remainder mapping, Unicode decimal input, 10,000-digit integers, stroke overrides and ambiguous values, all 64 coin moving-line masks, a 48,000-toss distribution check, civil hour boundaries, daylight saving transitions, and the traditional hour rule. |
| Android 8.0, API 26 | Six instrumentation tests passed with Wi-Fi and mobile data disabled. The signed release installed, launched, and rendered the casting screen. |
| Android 16, API 36 | Six instrumentation tests passed in airplane mode. A simulated accelerometer pulse triggered exactly one three-coin toss. |
| Android 17, API 37 | Six instrumentation tests passed with Wi-Fi and mobile data disabled. The signed release installed, launched, and rendered the casting screen. |
| Android Lint | Zero errors. Seven warnings reported newer AndroidX dependency versions. |
| APK verification | Both APK signatures verified. The release ZIP alignment check passed, and package inspection confirmed minSdk 26, targetSdk 37, and bundled data. |

The Android instrumentation covers one numerical reading end to end, saving and reopening it, deleting it, manually entering and undoing coin tosses, navigating the classical library, selecting a time zone and hour rule, checking the embedded corpus, Room persistence and JSON export, and persistent preferences. Both signing builds were produced from the same source tree. [SHA-256 checksums](../dist/SHA256SUMS.txt)

The Android 17 test device was created with Android SDK Command-line Tools 22.0. The test configuration pins Espresso 3.7.0 for the Android 17 input API. [AndroidX Test release notes](https://developer.android.com/jetpack/androidx/releases/test#espresso_370)

The release certificate is `CN=YiShu Local QA` with SHA-256 fingerprint `bdc3c76f264fe29f9c4c7db0ec0371abeab6827e1662244fa625858e299edd80`. Hardware shake behavior was exercised with a virtual sensor. Physical-device testing remains open.
