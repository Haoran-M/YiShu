export const trigrams = [
  ["坤", "地", "土", 0, "☷", "承接与配合"], ["乾", "天", "金", 7, "☰", "主动与持续"],
  ["兑", "泽", "金", 3, "☱", "交流与协调"], ["离", "火", "火", 5, "☲", "辨明与取舍"],
  ["震", "雷", "木", 1, "☳", "启动与应变"], ["巽", "风", "木", 6, "☴", "循序与渗入"],
  ["坎", "水", "水", 2, "☵", "审慎与辨险"], ["艮", "山", "土", 4, "☶", "节制与审视"],
];
export const categories = {
  OTHER: ["其他", "写出已经确定的条件、尚待核实的信息，以及一个可以调整的下一步。"],
  CAREER: ["事业", "梳理目前的职责、可用资源，以及如何检验下一步的成果。"],
  STUDY: ["学业", "找出最需要练习的一项能力，安排一次可以检验的复盘。"],
  LOVE: ["感情", "区分实际观察和个人推测，想想双方的期待与界限能否说清。"],
  SOCIAL: ["人际", "想清希望对方理解的事，并留出倾听与协商的空间。"],
  FINANCE: ["财务", "梳理已知信息、预算与风险，重大决定以可核实的信息为依据。"],
  HEALTH: ["健康", "记录实际情况，有具体症状时向医疗专业人员咨询。"],
};
export const branches = "子丑寅卯辰巳午未申酉戌亥";
export const deities = ["青龙", "明堂", "天刑", "朱雀", "金匮", "天德", "白虎", "玉堂", "天牢", "玄武", "司命", "勾陈"];
export const coinLabels = {6: "老阴", 7: "少阳", 8: "少阴", 9: "老阳"};
const stems = "甲乙丙丁戊己庚辛壬癸";
const modulo = (n, d) => ((n % d) + d) % d;
const pad = n => String(n).padStart(2, "0");

export function strokeDictionary(text) {
  const entries = new Map();
  for (const line of text.trimEnd().split(/\r?\n/)) {
    const [hex, modern, kangxi, variants = ""] = line.split("\t");
    entries.set(parseInt(hex, 16), {
      modern: modern ? [+modern] : [],
      kangxi: kangxi ? kangxi.split(",").map(Number) : [],
      variants: variants ? variants.split(",").map(value => parseInt(value, 16)) : [],
    });
  }
  return (glyph, mode) => {
    const code = glyph.codePointAt(0);
    return [...new Set([code, ...(entries.get(code)?.variants ?? [])])].flatMap(point => {
      const label = String.fromCodePoint(point);
      return (entries.get(point)?.[mode] ?? []).map(count => ({
        glyph: label, count, source: mode === "kangxi" ? "kangxi-strokecount · Unicode 11.0" : "Unihan 17.0.0 · kTotalStrokes",
      }));
    });
  };
}

export function conversion(...dictionaries) {
  const rules = new Map();
  for (const dictionary of dictionaries) {
    for (const line of dictionary.split(/\r?\n/)) {
      if (!line || line.startsWith("#") || !line.includes("\t")) continue;
      const [key, value] = line.split("\t");
      rules.set(key, value.split(" ")[0]);
    }
  }
  let longest = 1;
  for (const key of rules.keys()) longest = Math.max(longest, key.length);
  return input => {
    let output = "";
    for (let index = 0; index < input.length;) {
      const scalar = String.fromCodePoint(input.codePointAt(index));
      let count = Math.min(longest, input.length - index);
      for (; count >= scalar.length; count--) {
        const match = rules.get(input.slice(index, index + count));
        if (match === undefined) continue;
        output += match;
        index += count;
        break;
      }
      if (count >= scalar.length) continue;
      output += scalar;
      index += scalar.length;
    }
    return output;
  };
}

const decimalValues = new Map();
function digit(character) {
  if (!/\p{Nd}/u.test(character)) return null;
  const code = character.codePointAt(0);
  if (!decimalValues.has(code)) {
    let start = code;
    while (/\p{Nd}/u.test(String.fromCodePoint(start - 1))) start--;
    for (let point = start; point <= 0x10ffff && /\p{Nd}/u.test(String.fromCodePoint(point)); point++) {
      decimalValues.set(point, String((point - start) % 10));
    }
  }
  return decimalValues.get(code);
}

export function calculatePlum({input, lowerInput = null, settings, dictionary, overrides = new Map()}) {
  const ignored = new Map();
  function tokenize(text) {
    const tokens = [];
    let raw = "";
    let decimal = "";
    const flush = () => {
      if (!decimal) return;
      tokens.push({raw, normalized: decimal, value: BigInt(decimal), choices: []});
      raw = "";
      decimal = "";
    };
    for (const character of text) {
      const value = digit(character);
      if (value !== null) {
        raw += character;
        decimal += value;
        if (settings.digits !== "integer") flush();
        continue;
      }
      flush();
      if (/\p{Script=Han}/u.test(character)) {
        const choices = dictionary(character, settings.stroke);
        const exact = choices.filter(choice => choice.glyph === character);
        const picked = overrides.get(character) ?? (exact.length === 1 ? exact[0] : choices.length === 1 ? choices[0] : null);
        tokens.push({raw: character, normalized: picked?.glyph ?? character, value: picked ? BigInt(picked.count) : null, source: picked?.source, choices});
      } else {
        ignored.set(character, (ignored.get(character) ?? 0) + 1);
      }
    }
    flush();
    return tokens;
  }
  const tokens = tokenize(input);
  const count = Math.floor(tokens.length / 2) + (settings.odd === "lower" ? 0 : tokens.length % 2);
  const upper = lowerInput === null ? tokens.slice(0, count) : tokens;
  const lower = lowerInput === null ? tokens.slice(count) : tokenize(lowerInput);
  const issues = [];
  if (!upper.length || !lower.length) {
    issues.push(lowerInput === null ? "单段输入至少需要两项。可补充输入，或分开填写上下卦。" : "请在上卦和下卦各填写至少一项。");
  }
  const unknown = [...new Map([...upper, ...lower].filter(token => token.value === null).map(token => [token.raw, token])).values()];
  if (unknown.length) issues.push("以下汉字需要确认字形或手动填写笔画数。");
  if (settings.strict && ignored.size) issues.push("当前设置要求移除未计入的字符。");
  const trace = {input, lowerInput, upper, lower, issues, unknown, ignored};
  if (issues.length) return trace;
  const sum = list => list.reduce((total, token) => total + token.value, 0n);
  const upperSum = sum(upper);
  const lowerSum = sum(lower);
  const upperRemainder = Number(upperSum % 8n);
  const lowerRemainder = Number(lowerSum % 8n);
  const movingRemainder = Number((upperSum + lowerSum) % 6n);
  return {
    ...trace, upperSum, lowerSum, upperRemainder, lowerRemainder, movingRemainder,
    bits: (trigrams[upperRemainder][3] << 3) | trigrams[lowerRemainder][3], moving: [movingRemainder || 6],
  };
}

export function castCoins() {
  const heads = [...crypto.getRandomValues(new Uint8Array(3))].map(value => Boolean(value & 1));
  return {heads, total: 6 + heads.filter(Boolean).length};
}

export function coinResult(tosses) {
  if (tosses.length !== 6 || tosses.some(toss => !Object.hasOwn(coinLabels, toss.total))) return null;
  const moving = [];
  let bits = 0;
  for (const [index, toss] of tosses.entries()) {
    if (toss.total % 2) bits |= 1 << index;
    if (toss.total === 6 || toss.total === 9) moving.push(index + 1);
  }
  return {bits, moving};
}

export function resolveReading(byBits, bits, moving) {
  const changed = moving.reduce((value, line) => value ^ (1 << (line - 1)), bits);
  return {original: byBits.get(bits), changed: byBits.get(changed)};
}

const dateFormats = new Map();
export function civilTime(instant, zone) {
  if (!dateFormats.has(zone)) dateFormats.set(zone, new Intl.DateTimeFormat("en-GB", {
    timeZone: zone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  }));
  const fields = Object.fromEntries(dateFormats.get(zone).formatToParts(instant).map(part => [part.type, part.value]));
  const {year, month, day, hour, minute, second} = fields;
  const branch = Math.floor((Number(hour) + 1) / 2) % 12;
  return {date: [year, month, day].join("-"), time: [hour, minute, second].join(":"), branch,
    ziPeriod: hour === "23" ? "夜子" : hour === "00" ? "早子" : ""};
}

export function nextHour(instant, zone) {
  const current = civilTime(instant, zone).branch;
  const nextMinute = Math.floor(+instant / 60_000) * 60_000 + 60_000;
  for (let offset = 0; offset < 26 * 60; offset++) {
    const next = civilTime(new Date(nextMinute + offset * 60_000), zone);
    if (next.branch !== current) return next;
  }
  throw new Error("No civil hour boundary found");
}

export function hourInterval(index) {
  const start = modulo(index * 2 - 1, 24);
  return pad(start) + ":00–" + pad((start + 1) % 24) + ":59";
}

export function traditionalHour(date, branch) {
  const anchor = Date.UTC(2026, 5, 19);
  const dayIndex = modulo(Math.round((Date.parse(date + "T00:00:00Z") - anchor) / 86_400_000), 60);
  const from = [8, 10, 0, 2, 4, 6][dayIndex % 6];
  const deity = modulo(branch - from, 12);
  return {stemBranch: stems[dayIndex % 10] + branches[dayIndex % 12], from, deity: deities[deity],
    yellow: [0, 1, 4, 5, 7, 10].includes(deity)};
}
