# YiShu 1.1 VIP release

[Public website](https://yishu-workbench.shortbrine32.chatgpt.site/) · [Website source and publisher documentation](../sites/yishu/README.md) · [Release SHA-256](../dist/SHA256SUMS-1.1.0.txt)

VIP includes month and day calendar views, Gregorian and lunar conversion, solar terms and traditional festivals, birth lookup and optional local profiles, hexagram derivation, and name and relationship readings. The rule identifier and basis appear in the related screens. The common lunar table covers 1901–2100. Crossing times are computed from solar longitude in UTC and converted to the chosen time zone for display.

## Verification

| Area | Result |
| --- | --- |
| Web and shared engine | 9 tests passed. Checks include every supported Gregorian-to-lunar round trip, DST gaps and repeats, 24 chronological solar events for each supported year, 13 independent solar time comparisons within two minutes, and all 4,096 original-pattern and moving-line-mask combinations. The question-only relationship path and old/new name comparison were checked. |
| Browser and hosting | Browser smoke confirmed the original `1234` reading and the published publisher-access prompt. Anonymous requests returned 200 for the homepage and 401 for protected VIP assets. The live Worker accepted the publisher-issued code and delivered the current protected version. |
| Android | 14 domain tests and six connected tests passed on the Android 17 emulator. The signed final APK installed in airplane mode, accepted the publisher code offline, retained activation across the app update, and rendered all four VIP tabs. |
| Windows | The portable x64 build compiled. A startup smoke test confirmed the native host initialized its WebView2 runtime. The package includes the same website and VIP assets verified on Android. A full Windows UI walkthrough was outside this smoke test. |
| Package integrity | Both Android APKs and the Windows ZIP match the published checksums. The Android release signature matches the original local QA signer. The Windows executable is unsigned. |

The Windows app uses the installed WebView2 Runtime. The Android VIP interface uses the installed Android System WebView. The apps verify the publisher’s signature locally and keep personal records in their respective local profiles. The public site authenticates the code server-side before returning VIP resources. Birth dates, names, and reading questions are handled locally.

The optional 交卦 definition and broader daily activity recommendations remain subject to source and rule selection. The birth tool displays supported calendar information, year/month/day stems and branches, and the birth-hour branch when a time is supplied.
