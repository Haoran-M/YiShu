# YiShu 1.3.1 · Language switch

The website and Windows app have a visible language selector in the top bar: English, 简体中文, and 繁體中文. Android has the same choices in its EN / 简 / 繁 menu. The choice is saved on the device. Switching language preserves entered questions, saved readings, and VIP activation.

All 64 gua now include concise modern Chinese explanations and reflection prompts. Simplified Chinese shows those explanations with simplified classical text; Traditional Chinese converts the interface, explanations, and classics to traditional characters. English retains the original English explanations and line paraphrases alongside Chinese source text.

Edit Chinese descriptions in `tools/chinese-gua.txt`, then run `node tools/build-english.mjs` to rebuild matching website and Android content. The Android version code is 5 and uses the existing release signer. The public website has no visit-tracking interface.

Browser checks verified switching to Simplified Chinese, retaining the choice after reload, displaying the Chinese gua explanations, and switching to Traditional Chinese. Twelve web/Worker checks passed, including context-sensitive preservation of the proper names 乾 and 咸. Seven Android emulator checks cover the language menu, persistence after activity recreation, existing reading flows, and corpus correctness. Android lint and signed release builds passed.
