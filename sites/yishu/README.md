# YiShu 1.3 · I Ching in English

This English-first website includes Plum Blossom readings, three-coin readings, traditional hours, all 64 hexagrams explained in English, Chinese classical texts, and local reading history. The base site is public. VIP includes the calendar and solar terms, birth lookup, related hexagrams, and name and relationship readings.

[Open the website](https://yishu-workbench.shortbrine32.chatgpt.site/) · [App downloads](https://github.com/Haoran-M/YiShu/releases/latest)

Edit English content in the repository root's `tools/english-gua.txt` and `tools/english-ui.txt`, then run `node tools/build-english.mjs`. English is the default; Chinese interfaces remain in Settings. The original English explanations and the attributed Chinese corpus are available under CC BY-SA 4.0.

Visit collection is disabled. Public pages contain no tracking links or controls, and the dashboard files are excluded from the deployment. Previously collected counts remain protected by the publisher key at the report API; no new visits are stored.

## Development

Build and test with Node.js 22 or later.

```powershell
node tools/build-worker.mjs
node --test
node tools/serve.mjs 4173
```

`dist/server/index.js` is generated from `worker.js` and the bundled website. It enforces access before serving `/vip-content/`. The hosted publishing workflow pushes the source and deploys that generated Worker. A static host alone cannot enforce the same boundary.

## Publisher codes

Run `node tools/issue-code.mjs --out=<private-path> --days=30` on the publisher’s Windows account to create a new signed code. The issued code is written to the chosen file. The signing key lives in `%LOCALAPPDATA%\YiShuPublisher\signing-key.pem`. Back up that key privately to retain the ability to issue new codes. Hand the access code to a recipient through a channel you choose.

The website checks the signature and expiry server-side and sets an HttpOnly, Secure, SameSite cookie. Calendar dates, names, and questions are processed in the browser and are absent from the unlock request. Portable Windows and Android verify codes locally. Their offline code gate is enforced by the unmodified app. Issued codes are bearer tokens and expire automatically.

The website also accepts the shared passphrase. On Windows and Android, the first use of the passphrase exchanges it over HTTPS for a signed offline pass. Only the phrase is sent in that request. Existing signed codes can still be entered offline.

To configure or rotate the shared phrase, set `YISHU_SHARED_CODE_SHA256` to its lowercase SHA-256 digest and `YISHU_SHARED_GRANT` to a current signed code in the Site's secret environment variables, then deploy a version with the new configuration. Keep both values out of Git. The phrase is case-sensitive. The shared offline pass expires on its signed date, and changing the shared phrase affects new activations. The Worker applies a basic per-instance attempt limit for received client IPs.

## Calendar rules and data

- CN-LUNAR-1 uses lunar-javascript 1.7.8 (MIT). The packaged table supports Gregorian dates from 1901-01-01 through 2100-12-31, including leap months. Two adjoining years of solar events support date-boundary logic.
- SOLAR-LONGITUDE-1 uses Astronomy Engine 2.1.19 (MIT), locating apparent solar ecliptic longitude crossings at 15° intervals. The data stores UTC minutes and displays them in the selected IANA time zone. Thirteen example times in the 2026 Hong Kong Observatory almanac agree within two minutes. Far-future times can shift as astronomical timescales are refined.
- BIRTH-CIVIL-1 uses 立春 for the sexagenary year pillar and the twelve solar 节 for the month pillar. Calendar day stems roll over at local midnight. Zodiac rollover is selectable between 春节 and 立春. The tool asks for a time on a solar date boundary and asks which occurrence to use for a repeated DST time. It rejects skipped wall times.
- Variant rules use the original bottom-up line ordering. 互卦 uses lines 2–4 and 3–5, 错卦 flips all six, 综卦 reverses the order, and 变卦 flips only original moving lines. The 交卦 term is awaiting a rule definition.
- TOPIC-PLUM-1 reuses the custom original plum remainder rules, with a selectable stroke standard. Classical texts, symbolic readings and app prompts appear separately. Personal inputs stay on the user’s device. Birth profiles support optional local saving, editing, deletion and export.

Sources: [lunar-javascript](https://github.com/6tail/lunar-javascript), [Astronomy Engine](https://github.com/cosinekitty/astronomy), [HKO Gregorian–lunar conversion](https://www.hko.gov.hk/sc/gts/time/conversion.htm), [HKO solar terms](https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm), [HKO 2026 almanac](https://www.hko.gov.hk/en/gts/astron2026/files/HKO_almanac_2026.pdf). The HKO materials were used for verification. The bundled calendar and term tables were generated from their respective MIT-licensed libraries.

