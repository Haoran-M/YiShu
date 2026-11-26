# YiShu · I Ching Companion

An English-first I Ching companion for the web, Android, and Windows, with all 64 gua explained in plain English alongside the traditional Chinese classics. It includes Plum Blossom number readings, three-coin readings, the twelve traditional hours, and an offline classical library. It stores saved readings and preferences on the device. The app uses Kotlin, Jetpack Compose, Room and DataStore, with the calculation engine in a separate pure Kotlin module.

[Use the website](https://yishu-workbench.shortbrine32.chatgpt.site/) · [Download Android and Windows](https://github.com/Haoran-M/YiShu/releases/latest) · [English edition and private analytics](docs/ENGLISH_RELEASE_1.3.md)

## Website and desktop

YiShu has a public browser edition and a portable Windows x64 app. All three editions include VIP access to the calendar and solar terms, birth lookup, derived hexagrams, and name and relationship readings. Version 1.3 adds English descriptions, line-by-line paraphrases, English and pinyin search, app downloads, and a private website visit dashboard. The installed apps need a connection for the first passphrase activation and then run offline until the saved pass expires. The desktop ZIP includes its site files and opens in a native window using the installed Microsoft Edge WebView2 Runtime.

- Website source, calendar data decisions, and publisher code issuance are in [the website README](sites/yishu/README.md).
- Build the Windows ZIP from the root with `./desktop/build.ps1`. Extract the entire `dist/YiShu-1.3.2-Windows-x64.zip` folder and open `YiShu.exe`.
- The Android launcher shows **VIP** in the top bar. This uses the same bundled VIP tools as the desktop version.

## Install

1. Open `dist/YiShu-1.3.2-release.apk` on an Android 8.0 or newer device. Android may ask you to allow installation from the app used to open the APK.
2. Open **YiShu**. In **Plum Blossom Reading**, enter `1234` and tap **Cast reading**. The result is **The Traveler → Stillness**, with line 4 moving.
3. Use **64 Hexagrams** in the top bar to browse the bundled text by name, number, or trigram combination.

The release APK uses the same local QA signing certificate as 1.0.0. The debug APK has the package ID `org.yishu.app.debug` so it can coexist with the release APK. Android requires the same signing certificate for updates to a package already installed. See `dist/SHA256SUMS-1.3.2.txt` and [the original Android test report](docs/TEST_REPORT.md).

## Build

Import the repository root into Android Studio. Use JDK 17 and install Android SDK Platform 37.0. The wrapper uses Gradle 9.3.1 and Android Gradle Plugin 9.1.1. The current Gradle configuration uses Android SDK Build-Tools 36.0.0. Downloading build tools and dependencies requires a connection. The installed app uses bundled assets.

```powershell
.\gradlew.bat :domain:test :app:assembleDebug :app:lintDebug
.\gradlew.bat :app:connectedDebugAndroidTest
```

On macOS or Linux, use `./gradlew` with the same arguments. Connect a test device or emulator for `connectedDebugAndroidTest`.

To sign a release with a key you control, set `YISHU_SIGNING_FILE`, `YISHU_SIGNING_ALIAS`, `YISHU_SIGNING_PASSWORD` and `YISHU_KEY_PASSWORD` in your build environment. Then run `:app:assembleRelease`. APKs are generated in `app/build/outputs/apk/`. With signing variables absent, Gradle produces an unsigned release APK.

## Source data

The repo includes all 64 hexagrams and their 384 line statements, modern and Kangxi stroke counts, and simplified/traditional variant data. [Source versions, checks and licenses](docs/DATA_SOURCES.md) and [calculation decisions](docs/DECISIONS.md) are recorded with the code.

```powershell
node tools/import-data.mjs
```

The importer uses Node.js 20+, `curl` and either `bsdtar` or `unzip` for the Unihan archive. It reads the pinned Wikisource revisions and validates all 64 entries against the provided reference index, Wikisource trigram captions, and line polarity. The generated assets are included in the project tree, so ordinary builds skip the importer.
