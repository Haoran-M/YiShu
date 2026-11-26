# YiShu 1.3.2

English is the default for new users. This update also resets an older Chinese preference once. Afterward, an explicit language selection is saved as before. The website, Windows app, and Android app show a visible `Language / 语言` label next to the selector.

Plum Blossom input accepts ASCII English letters: A=1, B=2, through Z=26. Letter case does not matter. Each letter is one item; English words may be mixed with Unicode decimal digits and Chinese characters. Chinese characters retain their selected modern or Kangxi stroke counts. Whole-number mode groups only runs of digits; letters remain separate. Other characters continue to follow the existing ignore/strict rules.

The existing split and remainder rules are unchanged. Under the defaults, `hello` becomes H=8, E=5, L=12 for the upper sum 25, and L=12, O=15 for the lower sum 27. These select Heaven above Fire, hexagram 13 (Fellowship), with line 4 moving to hexagram 37 (The Household). A single letter requires separate upper and lower inputs, because single-input casting needs at least two items.

The Latin-letter rule is an app-defined extension, not a claimed historical Chinese stroke-count method. New readings use algorithm version 1.1.0; existing saved results retain their recorded calculations. Android version code 6 uses the same signing certificate as earlier releases.

Verification: 13 web/Worker tests, 15 Kotlin domain tests, and eight Android 17 emulator tests passed. Checks include all 26 letters, case equivalence, mixed numeric/Chinese/English input, whole-number grouping, the `hello` reading, and persistent language switching. Browser smoke checks confirmed the visible label and the English-word reading. Signed Android and portable Windows builds succeeded.
