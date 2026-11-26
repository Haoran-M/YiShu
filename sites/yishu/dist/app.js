import {branches, calculatePlum, castCoins, categories, civilTime, coinLabels, coinResult,
  conversion, hourInterval, nextHour, resolveReading, strokeDictionary, traditionalHour, trigrams} from "./engine.js";
import {verifyAccessCode} from "./vip-access.js";
import {english,englishText} from "./english.js";
import {trackPage} from "./tracking.js";

const $ = selector => document.querySelector(selector);
const content = $("#content");
const defaults = {stroke:"modern", digits:"digits", odd:"upper", strict:false, zone:"", hour:"deities", script:"english", theme:"system"};
const keys = {settings:"yishu:settings:1", history:"yishu:history:1"};
const vipKey = "yishu:vip:1";
const nativeApp = Boolean(window.chrome?.webview) || location.hostname === "appassets.androidplatform.net";
const redeemEndpoint = "https://yishu-workbench.shortbrine32.chatgpt.site/vip/redeem";
const pages = {
  plum: ["梅花易数", "用数字、汉字或一句诗起卦。", "☵"],
  coins: ["六爻摇卦", "每次投三枚铜钱，从初爻向上记录六次。", "◎"],
  hours: ["十二时辰", "查看当地时辰、下一时辰和黄黑道十二神。", "◷"],
  library: ["六十四卦", "按文王卦序阅读《周易》，也可按上下卦查找。", "▤"],
  vip: ["VIP 工具", "黄历与节气、生辰查询、衍生卦和姓名关系专题。", "◇"],
  history: ["历史记录", "查看、搜索和导出此设备保存的卦例。", "▣"],
  settings: ["资料与设置", "设置文字、笔画标准、时区与起卦规则。", "⚙"],
};
const cities = [["北京时间","Asia/Shanghai"],["香港","Asia/Hong_Kong"],["台北","Asia/Taipei"],
  ["东京","Asia/Tokyo"],["温哥华","America/Vancouver"],["纽约","America/New_York"],["伦敦","Europe/London"],["协调世界时","UTC"]];
const almanacSource = "https://www.hko.gov.hk/en/gts/astron2026/files/2026cal06.pdf";
const hourSource = "https://zh.wikisource.org/wiki/欽定協紀辨方書_(四庫全書本)/卷07";
const state = {page:"plum", plum:{input:"", lower:"", dual:false, question:"", category:"OTHER", expanded:false},
  coins:{question:"", category:"OTHER", expanded:false}, tosses:[], overrides:new Map(), results:{}, trace:null,
  library:{query:"", upper:"", lower:"", number:1}, historyQuery:"", opened:null, shake:false};
function loadStorage(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
let settings = {...defaults, ...loadStorage(keys.settings, {})};
// Existing users receive the new English edition once, while retaining all readings.
if (!settings.languageVersion) { settings.script="english"; settings.languageVersion=2; try { localStorage.setItem(keys.settings,JSON.stringify(settings)); } catch {} }
let history = loadStorage(keys.history, []);
if (!Array.isArray(history)) history = [];
history = history.filter(record => record && typeof record.id === "string" && Number.isInteger(record.original) && Number.isInteger(record.changed));
let corpus, byBits, dictionary, toTraditional, toSimplified;
let lastClockMinute = "", toastTimeout, lastShake = 0;
let vipExpiry = 0, vipTick, vipGeneration = 0;
const androidVip = location.hostname === "appassets.androidplatform.net";
if (androidVip) {
  const options = new URLSearchParams(location.search);
  if (["english","simplified","traditional"].includes(options.get("script"))) settings.script=options.get("script");
  if (["system","light","dark"].includes(options.get("theme"))) settings.theme=options.get("theme");
  if (options.has("zone")) settings.zone=options.get("zone");
  document.body.classList.add("native-vip-only");
}

function html(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[character]);
}
function localized(value) { return settings.script === "english" ? englishText(value) : settings.script === "traditional" && toTraditional ? toTraditional(value) : value; }
function tx(value) { return html(localized(value)); }
function classical(value) { return settings.script === "english" && english.classical[value] ? html(english.classical[value])+"<span class=\"source-chinese\" lang=\"zh-Hant\">"+html(value)+"</span>" : html(settings.script === "traditional" || !toSimplified ? value : toSimplified(value)); }
function button(label, action, variant = "", attrs = "") {
  return `<button type="button" class="button ${variant}" data-action="${action}" ${attrs}>${tx(label)}</button>`;
}
function link(label, url) {
  return `<a href="${html(url)}" target="_blank" rel="noopener noreferrer">${tx(label)}</a>`;
}
function hero(page) {
  const [title, detail] = pages[page];
  return `<section class="hero"><div class="hero-copy"><h1>${tx(title)}</h1><p>${tx(detail)}</p></div></section>`;
}
function header(title, meta = "") {
  return `<header class="card-heading"><h2>${tx(title)}</h2>${meta ? `<p>${tx(meta)}</p>` : ""}</header>`;
}
function zoneName() { return settings.zone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; }
function flash(message) {
  const node = $("#toast");
  node.textContent = localized(message);
  node.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { node.hidden = true; }, 3900);
}
function store(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); return true; }
  catch { flash("浏览器存储不可用。"); return false; }
}
function navItem(id) {
  const [title, , icon] = pages[id];
  return `<a class="nav-item" href="#${id}" ${state.page === id ? 'aria-current="page"' : ""}>
    <span class="nav-icon" aria-hidden="true">${icon}</span>${tx(title)}</a>`;
}
function applyAppearance() {
  const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.lang = settings.script === "english" ? "en" : settings.script === "traditional" ? "zh-Hant" : "zh-Hans";
  $("#language-switch").value=settings.script;
  $("#brand-title").textContent = localized("易数通玄");
  document.title = localized("易数通玄 · " + pages[state.page][0]);
}
function route() {
  const id = location.hash.slice(1);
  if (id === "workspace") return;
  state.page = androidVip ? "vip" : Object.hasOwn(pages, id) ? id : "plum";
  if (state.page !== "coins") state.shake = false;
  render();
  trackPage(state.page);
  window.scrollTo(0,0);
}
function render() {
  applyAppearance();
  $("#breadcrumb").innerHTML = `<span>${tx("易学工具")}</span><span class="slash" aria-hidden="true">/</span><span>${tx(pages[state.page][0])}</span>`;
  $("#navigation").innerHTML = ["plum","coins","hours","library","vip","history","settings"].map(navItem).join("");
  $("#sidebar-footer").innerHTML = `<a href="downloads.html">${tx("下载应用和源码")}</a><span class="muted">${tx("卦例仅保存在此设备")}</span><a href="privacy.html">${tx("隐私与访问统计")}</a>`;
  if (!corpus) return;
  vipGeneration++;
  vipTick = null;
  const views = {plum:viewPlum, coins:viewCoins, hours:viewHours, library:viewLibrary, vip:viewVip, history:viewHistory, settings:viewSettings};
  content.innerHTML = hero(state.page) + views[state.page]();
  lastClockMinute = "";
  clock();
  if (state.page === "vip") loadVip($("#vip-root"),vipGeneration);
}
function options(items, current) {
  return items.map(([key,label]) => `<option value="${html(key)}"${key === current ? " selected" : ""}>${tx(label)}</option>`).join("");
}
function questionForm(kind) {
  const form = state[kind];
  return `<details class="form-question" data-question="${kind}" ${form.expanded ? "open" : ""}>
    <summary>${tx("所问事项（可选）")}</summary>
    <div class="fields"><label>${tx("类别")}<select data-field="${kind}.category">${options(Object.entries(categories).map(([id,[label]]) => [id,label]),form.category)}</select></label>
    <label>${tx("想了解的问题")}<textarea data-field="${kind}.question" rows="2">${html(form.question)}</textarea></label></div></details>`;
}
function hexLines(bits, moving = [], label = null) {
  const rows = [6,5,4,3,2,1].map(line => {
    const yang = (bits & (1 << (line - 1))) !== 0;
    return `<span class="hex-row ${yang ? "yang" : "yin"} ${moving.includes(line) ? "moving" : ""}"><i></i>${yang ? "" : "<i></i>"}</span>`;
  });
  return `<div class="hex-lines" ${label ? `role="img" aria-label="${tx(label)}"` : 'aria-hidden="true"'}>${rows.join("")}</div>`;
}
function diagramLabel(entry, moving) {
  const lines = [1,2,3,4,5,6].map(line => ((entry.bits & (1 << (line - 1))) !== 0 ? "阳" : "阴") + (moving.includes(line) ? "动" : ""));
  return entry.title + "，自下而上：" + lines.join("、");
}
function hexCard(label, entry, moving) {
  return `<div class="hex-card"><p>${tx(label)} · ${entry.number}</p><strong>${tx(entry.title)}</strong>
    ${hexLines(entry.bits,moving,diagramLabel(entry,moving))}<small>${tx(trigrams[entry.upper][0] + "上 · " + trigrams[entry.lower][0] + "下")}</small></div>`;
}
function refs(entry) {
  return `<div class="reference-links">${link("维基文库《周易》本文版本",entry.source)}${link("参考网站的卦序与上下卦",entry.reference)}</div>`;
}
function plumChoices(trace) {
  if (!trace) return "";
  const editable = [...new Map([...trace.upper,...trace.lower].filter(token => token.source || token.value === null).map(token => [token.raw,token])).values()];
  if (!editable.length) return "";
  const controls = editable.map(token => {
    const choices = token.choices.map((choice,index) => [String(index), choice.glyph + " · " + choice.count + " 画"]);
    const current = token.choices.findIndex(choice => choice.glyph === token.normalized && BigInt(choice.count) === token.value);
    const value = token.source === "手动覆盖" ? String(token.value) : "";
    const point = token.raw.codePointAt(0);
    return `<div class="stroke-entry"><strong>${html(token.raw)}</strong><label>${tx("字形与笔画")}<select data-variant="${point}">
      ${options([["","选择字形"], ...choices],current < 0 ? "" : String(current))}</select></label>
      <label>${tx("手动笔画")}<input type="number" min="1" max="9999" inputmode="numeric" data-stroke="${point}" value="${value}"></label></div>`;
  }).join("");
  return `<details class="text-section" ${trace.unknown.length ? "open" : ""}><summary>${tx("核对汉字笔画")}</summary>
    <div class="stroke-controls">${controls}</div><div class="actions">${button("应用笔画并重新起卦","apply-strokes","primary")}</div></details>`;
}
function viewPlum() {
  const form = state.plum;
  const trace = state.trace;
  const input = `<label>${tx(form.dual ? "上卦输入" : "数字、汉字或混合文字")}
    <textarea data-field="plum.input" placeholder="${tx("例如 1234 或 春风又绿")}">${html(form.input)}</textarea></label>`;
  const lower = form.dual ? `<label>${tx("下卦输入")}<textarea data-field="plum.lower">${html(form.lower)}</textarea></label>` : "";
  return `<div class="grid"><section class="card" id="plum-form">
    <header class="card-heading"><h2>${tx("起卦输入")}</h2>${button("试用示例","example","quiet")}</header>
    <div class="segmented" aria-label="${tx("输入方式")}">
      <button type="button" aria-pressed="${!form.dual}" data-action="single">${tx("单段输入")}</button>
      <button type="button" aria-pressed="${form.dual}" data-action="dual">${tx("上下卦分开")}</button>
    </div>
    <div class="fields ${form.dual ? "split" : ""}">${input}${lower}</div>
    <div class="rule-row"><span>${tx(settings.stroke === "kangxi" ? "康熙笔画" : "现代笔画")}</span><span>${tx(settings.digits === "integer" ? "整段整数" : "逐位求和")}</span><a href="#settings">${tx("调整规则")}</a></div>
    ${questionForm("plum")}<div class="actions">${button("开始起卦","cast-plum","primary")}</div>
    <div class="feedback" role="status">${trace?.issues.length ? `<ul>${trace.issues.map(issue=>`<li>${tx(issue)}</li>`).join("")}</ul>` : ""}</div>
    ${plumChoices(trace)}
    <p class="panel-note">${tx("起卦采用自定义八卦余数规则。标点与空格默认忽略。")}</p>
  </section><div id="result-slot">${resultCard(state.results.plum)}</div></div>`;
}
function viewCoins() {
  const shakeAvailable = typeof DeviceMotionEvent !== "undefined" && matchMedia("(pointer: coarse)").matches;
  const progress = state.tosses.length;
  const list = state.tosses.map(({total,heads},index) => `<li class="toss-row"><strong>${tx("第"+(index+1)+"爻")} · ${total} · ${tx(coinLabels[total])}</strong>
    <span>${heads ? heads.map(head => `<span class="coin-face">${tx(head ? "正" : "反")}</span>`).join("") : tx("手工录入")}</span></li>`).reverse().join("");
  return `<div class="grid"><section class="card">${header("投币起卦","正面 3 点，反面 2 点")}
    <div class="coin-status"><progress max="6" value="${progress}" aria-label="${tx("投币进度")}"></progress><strong>${progress} / 6</strong></div>
    <div class="actions manual">${button("投三枚铜钱","toss","primary",progress===6?"disabled":"")}
    ${shakeAvailable ? button(state.shake ? "关闭摇动投币" : "启用摇动投币","shake","") : ""}</div>
    <div class="manual"><span class="hint">${tx("手工录入点数")}</span><div class="actions">
      ${[6,7,8,9].map(total=>button(String(total),"manual","",`data-total="${total}" ${progress===6?"disabled":""}`)).join("")}</div></div>
    <ol class="toss-list" reversed>${list}</ol><div class="actions manual">
      ${button("撤销上一次","undo","quiet",progress?"":"disabled")}${button("重新开始","reset-coins","quiet",progress?"":"disabled")}</div>
    <div class="text-section">${questionForm("coins")}<div class="actions">${button("查看本卦与变卦","cast-coins","primary",progress===6?"":"disabled")}</div></div>
  </section><div>${resultCard(state.results.coins)}</div></div>`;
}
const uniqueId = () => crypto.randomUUID?.() ?? [...crypto.getRandomValues(new Uint8Array(16))].map(n => n.toString(16).padStart(2,"0")).join("");
function makeResult(kind, bits, moving, calculation) {
  const {original, changed} = resolveReading(byBits,bits,moving);
  const form = state[kind];
  const category = form.category in categories ? form.category : "OTHER";
  const themes = entry => "上卦" + trigrams[entry.upper][0] + "象征" + trigrams[entry.upper][5] +
    "，下卦" + trigrams[entry.lower][0] + "象征" + trigrams[entry.lower][5] + "。";
  return {id:uniqueId(), createdAt:Date.now(), method:kind === "plum" ? "PLUM" : "COINS",
    original:original.number, changed:changed.number, movingLines:moving, category, question:form.question,
    algorithmVersion:"1.0.0", calculation, sources:[...new Set([original.source,changed.source])],
    interpretation:{summary:themes(original), change:moving.length ? themes(changed) : "六爻皆静，可从本卦的卦辞与卦象思考目前的处境。",
      prompt:categories[category][1]}};
}
function plumCast() {
  const form = state.plum;
  const trace = state.trace = calculatePlum({input:form.input,lowerInput:form.dual?form.lower:null,
    settings,dictionary,overrides:state.overrides.get(settings.stroke)});
  delete state.results.plum;
  if (!trace.issues.length) {
    const serialize = token => ({raw:token.raw,normalized:token.normalized,value:String(token.value),strokeSource:token.source});
    state.results.plum = makeResult("plum",trace.bits,trace.moving,{input:trace.input,lowerInput:trace.lowerInput,
      upperTokens:trace.upper.map(serialize),lowerTokens:trace.lower.map(serialize),ignored:Object.fromEntries(trace.ignored),
      upperSum:String(trace.upperSum),lowerSum:String(trace.lowerSum),upperRemainder:trace.upperRemainder,
      lowerRemainder:trace.lowerRemainder,movingRemainder:trace.movingRemainder,strokeMode:settings.stroke.toUpperCase(),
      digitMode:settings.digits.toUpperCase(),oddSplit:settings.odd.toUpperCase(),requireSupportedCharacters:settings.strict});
  }
  render();
  (trace.issues.length ? $(".feedback") : $("#result-slot h2"))?.setAttribute("tabindex","-1");
  (trace.issues.length ? $(".feedback") : $("#result-slot h2"))?.focus({preventScroll:innerWidth>1030});
}
function applyStrokes() {
  if (!state.trace) return;
  const next = new Map(state.overrides.get(settings.stroke) ?? []);
  const tokenMap = new Map([...state.trace.upper,...state.trace.lower].map(token=>[token.raw,token]));
  for (const field of document.querySelectorAll("[data-stroke]")) {
    const glyph = String.fromCodePoint(+field.dataset.stroke);
    const manual = field.value.trim();
    const variant = $("[data-variant='"+field.dataset.stroke+"']").value;
    if (manual) {
      if (!/^\d{1,4}$/.test(manual) || +manual < 1) { flash("请输入 1 至 9999 的笔画数。"); field.focus(); return; }
      next.set(glyph,{glyph,count:+manual,source:"手动覆盖"});
    } else if (variant) {
      next.set(glyph,tokenMap.get(glyph).choices[+variant]);
    } else {
      next.delete(glyph);
    }
  }
  state.overrides.set(settings.stroke,next);
  plumCast();
}
function valuePreview(value) {
  const chars = Array.from(String(value ?? ""));
  return chars.length > 180 ? chars.slice(0,120).join("") + "…" + chars.slice(-50).join("") : chars.join("");
}
function formatSkipped(character) {
  return character.trim() ? character : "U+" + character.codePointAt(0).toString(16).toUpperCase().padStart(4,"0");
}
function traceDetails(result) {
  const info = result.calculation;
  if (!info) return "";
  if (result.method === "COINS") return `<details class="text-section"><summary>${tx("查看投币过程")}</summary><ol class="token-list">
    ${info.tosses.map(({total,heads},index) => `<li>${tx("第"+(index+1)+"爻")} · ${total} · ${tx(coinLabels[total])}
      <span>${heads ? heads.map(coin => tx(coin?"正面 3":"反面 2")).join(" · ") : tx("手工录入")}</span></li>`).join("")}</ol></details>`;
  const tokens = list => list.map(({raw,normalized,value,strokeSource}) => `<li>${html(valuePreview(raw))}${raw!==normalized ? " → "+html(valuePreview(normalized)) : ""} = ${html(valuePreview(value))}
    ${strokeSource ? `<span>${tx(strokeSource)}</span>` : ""}</li>`).join("");
  const ignored = Object.entries(info.ignored).map(([glyph,n])=>formatSkipped(glyph)+" × "+n).join("、");
  return `<details class="text-section"><summary>${tx("查看计算过程")}</summary>
    <p>${tx("上卦")} · ${html(valuePreview(info.upperSum))} ÷ 8 · ${tx("余")} ${info.upperRemainder} · ${tx(trigrams[info.upperRemainder][0])}</p>
    <p>${tx("下卦")} · ${html(valuePreview(info.lowerSum))} ÷ 8 · ${tx("余")} ${info.lowerRemainder} · ${tx(trigrams[info.lowerRemainder][0])}</p>
    <p>${tx("两段总和除以 6，余")} ${info.movingRemainder} · ${tx("第"+result.movingLines[0]+"爻")}</p>
    ${ignored ? `<p>${tx("未计入")} · ${html(ignored)}</p>` : ""}
    <div class="text-section"><h3>${tx("上卦分段")}</h3><ol class="token-list">${tokens(info.upperTokens)}</ol>
    <h3>${tx("下卦分段")}</h3><ol class="token-list">${tokens(info.lowerTokens)}</ol></div></details>`;
}
function resultCard(result) {
  if (!result) return `<section class="card">${header("本卦与变卦")}<div class="preview-empty">
    ${hexLines(0b101010)}<p>${tx("起卦后可查看本卦、变卦与动爻。")}</p></div></section>`;
  const original = corpus[result.original-1], changed = corpus[result.changed-1];
  const moving = result.movingLines;
  const saved = history.some(item => item.id === result.id);
  return `<section class="card">${header("本卦与变卦")}
    <div class="hex-group">${hexCard("本卦",original,moving)}${hexCard("变卦",changed,moving)}</div>
    <p class="hint">${moving.length ? tx("动爻")+" · "+moving.join("、") : tx("无动爻")}</p>
    <div class="actions manual">${button(saved?"已保存":"保存记录","save-result","primary",saved?"disabled":"")}
    ${button("复制结果","copy-result")}</div>
    <section class="text-section"><h3>${tx("卦辞与象意")}</h3><p class="classical">${classical(original.judgment)}</p>
      <p class="classical">${classical(original.image)}</p><p>${settings.script==="english"?html(english.hexagrams[original.number-1].reflection):tx(english.hexagrams[original.number-1].chinese.reflection)}</p></section>
    ${moving.length ? `<section class="text-section"><h3>${tx("动爻爻辞")}</h3>${moving.map(line=>`<p class="classical">${classical(original.lines[line-1])}</p>`).join("")}</section>` : ""}
    <section class="text-section"><h3>${tx("变卦象意")}</h3>
      ${original.number !== changed.number ? `<p class="classical">${classical(changed.image)}</p>` : ""}
      <p>${settings.script==="english"?html(english.hexagrams[changed.number-1].reflection):tx(english.hexagrams[changed.number-1].chinese.reflection)}</p></section>
    <section class="text-section"><h3>${tx("所问事项")+" · "+tx(categories[result.category][0])}</h3>
      ${result.question ? `<p>${html(result.question)}</p>` : ""}<p>${tx(result.interpretation.prompt)}</p>
      <p class="hint">${tx("卦象与解读仅供传统文化参考。")}</p></section>
    ${traceDetails(result)}<details class="text-section"><summary>${tx("经典出处")}</summary>${refs(original)}
      ${original.number !== changed.number ? link("变卦《周易》本文版本",changed.source) : ""}</details></section>`;
}

function hourOptions(selected) {
  return options([["deities","黄黑道十二神"],["basic","基础十二时辰"]],selected);
}
function zoneField() {
  const available = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : [];
  const common = new Map(cities.map(([name,zone])=>[zone,name]));
  const list = [...new Set([...common.keys(),...available])];
  return `<label>${tx("城市或时区")}<input list="iana-zones" data-setting="zone" value="${html(settings.zone)}" placeholder="${tx("跟随设备时区")}">
    <datalist id="iana-zones">${list.map(zone=>`<option value="${html(zone)}" label="${common.has(zone)?tx(common.get(zone)):html(zone)}"></option>`).join("")}</datalist></label>`;
}
function viewHours() {
  return `<div class="grid"><div class="stack"><section class="card">${header("当前时辰")}<div id="hour-current"></div>
    <div class="text-section">${zoneField()}<label>${tx("时辰规则")}<select data-setting="hour">${hourOptions(settings.hour)}</select></label></div>
    <p class="panel-note">${tx("公历日期在当地 00:00 切换。子时分为 23:00 起的夜子与 00:00 起的早子。")}</p>
    </section><section class="card">${header("黄黑道十二神")}<div id="hour-rationale"></div>
      <div class="reference-links text-section">${link("《钦定协纪辨方书》卷七",hourSource)}${link("香港天文台年历 · 干支日基准",almanacSource)}</div>
      <p class="panel-note">${tx("仅供传统文化参考。")}</p></section>
  </div><section class="card">${header("全天时辰")}<ol class="hours-list" id="hours-list"></ol></section></div>`;
}
function clock() {
  if (state.page === "vip" && vipExpiry && Date.now()>=vipExpiry) {
    vipExpiry=0;
    render();
    return;
  }
  if (state.page === "vip") vipTick?.();
  const zone = zoneName();
  const now = new Date();
  const civil = civilTime(now,zone);
  const name = branches[civil.branch]+"时"+(civil.ziPeriod?" · "+civil.ziPeriod:"");
  $("#clock-label").textContent = localized(branches[civil.branch]+"时")+" · "+civil.time.slice(0,5);
  if (state.page !== "hours" || !$("#hour-current") || lastClockMinute === civil.date+civil.time.slice(0,5)) return;
  lastClockMinute = civil.date+civil.time.slice(0,5);
  const next = nextHour(now,zone);
  $("#hour-current").innerHTML = `<h3 class="hour-name">${tx(name)}</h3><p>${civil.date} · ${civil.time.slice(0,5)} · ${html(zone)}</p>
    <p class="hint">${tx("下一时辰")} · ${tx(branches[next.branch]+"时")} · ${next.time.slice(0,5)}</p>`;
  const byDeities = settings.hour === "deities";
  const current = traditionalHour(civil.date,civil.branch);
  $("#hour-rationale").innerHTML = byDeities
    ? `<h3>${tx(current.deity+" · "+(current.yellow?"黄道 · 吉":"黑道 · 凶"))}</h3>
       <p class="hint">${tx(current.stemBranch+"日，青龙从"+branches[current.from]+"时起，顺排十二神。")}</p>`
    : `<p>${tx("当前采用基础十二时辰。")}</p>`;
  $("#hours-list").innerHTML = Array.from(branches,(branch,index) => {
    const deity = traditionalHour(civil.date,index);
    return `<li class="hour-row ${index===civil.branch?"active":""}"><strong>${tx(branch+"时")}</strong>
      <span>${hourInterval(index)}${byDeities ? `<br>${tx(deity.deity+" · "+(deity.yellow?"吉":"凶"))}` : ""}</span></li>`;
  }).join("");
}
function libraryList() {
  const filters = state.library;
  const query = filters.query.trim().toLowerCase();
  const matches = corpus.filter(entry => (filters.upper==="" || entry.upper===+filters.upper) &&
    (filters.lower==="" || entry.lower===+filters.lower) && (!query || String(entry.number)===query ||
    entry.title.includes(query) || entry.name.includes(query) || toTraditional(entry.title).includes(query) ||
    (english.hexagrams[entry.number-1].name+" "+english.hexagrams[entry.number-1].pinyin).toLowerCase().includes(query)));
  return matches.length ? matches.map(entry=>`<li><button type="button" aria-pressed="${entry.number===filters.number}"
    data-action="open-hex" data-number="${entry.number}">${hexLines(entry.bits)}<strong>${tx(entry.title)}</strong><small>${entry.number}</small></button></li>`).join("")
    : `<li class="hint">${tx("没有符合条件的卦。")}</li>`;
}
function libraryDetail(entry) {
  if (!entry) return "";
  const explanation=settings.script==="english"?english.hexagrams[entry.number-1]:english.hexagrams[entry.number-1].chinese;
  return `<section class="card" id="hex-detail" aria-label="${tx(entry.title)}">
    ${header(entry.title,"文王卦序 · "+entry.number)}
    <p class="hint">${tx(trigrams[entry.upper][0]+"上 · "+trigrams[entry.lower][0]+"下")}</p>
    <section class="text-section"><h3>${tx("理解此卦")}</h3><p>${tx(explanation.meaning)}</p><h3>${tx("反思提示")}</h3><p>${tx(explanation.reflection)}</p><p class="hint">${tx("以下解读是现代释义，保留经文供对照。")}</p></section>
    <div class="text-section"><h3>${tx("卦辞")}</h3><p class="classical">${classical(entry.judgment)}</p></div>
    <div class="text-section"><h3>${tx("大象")}</h3><p class="classical">${classical(entry.image)}</p></div>
    <div class="text-section"><h3>${tx("六爻爻辞")}</h3>${[...entry.lines,...(entry.extra?[entry.extra]:[])].map(line=>`<p class="classical quotation-line">${classical(line)}</p>`).join("")}</div>
    <div class="text-section">${refs(entry)}</div></section>`;
}
function viewLibrary() {
  const {query,upper,lower,number} = state.library;
  const trigramOptions = [["","全部"],...trigrams.map(([name,image],id)=>[String(id),name+" · "+image])];
  return `<div class="grid"><section class="card">${header("全部卦象","文王卦序")}
    <div class="filters"><label>${tx("卦名或卦序")}<input type="search" data-field="library.query" value="${html(query)}"></label>
    <label>${tx("上卦")}<select data-field="library.upper">${options(trigramOptions,upper)}</select></label>
    <label>${tx("下卦")}<select data-field="library.lower">${options(trigramOptions,lower)}</select></label></div>
    <ul class="library-list" id="hex-list">${libraryList()}</ul>
    </section><div id="library-detail">${libraryDetail(corpus[number-1])}</div></div>`;
}
function historyList() {
  const term = state.historyQuery.trim();
  const matches = history.filter(record => {
    const label = [corpus[record.original-1]?.title,corpus[record.changed-1]?.title,record.question,record.method==="COINS"?"六爻摇卦":"梅花易数"].join(" ");
    return label.includes(term) || toTraditional(label).includes(term);
  });
  return matches.length ? matches.map(record => `<li class="history-row"><div>
      <strong>${tx(corpus[record.original-1].title)} → ${tx(corpus[record.changed-1].title)}</strong>
      <small>${tx(record.method==="COINS"?"六爻摇卦":"梅花易数")} · ${html(new Date(record.createdAt).toLocaleString(document.documentElement.lang,{timeZone:zoneName()}))}</small>
      ${record.question ? `<small>${html(valuePreview(record.question))}</small>` : ""}</div>
      <div class="actions">${button("查看","open-record","",`data-id="${html(record.id)}"`)}
      ${button("删除","delete-record","quiet danger",`data-id="${html(record.id)}"`)}</div></li>`).join("")
    : `<li class="hint">${tx(history.length?"没有符合搜索条件的记录。":"还没有保存的记录。")}</li>`;
}
function viewHistory() {
  return `<div class="grid"><section class="card">${header("已保存的卦例")}
    <label>${tx("搜索卦名、问题或起卦方式")}<input type="search" data-field="historyQuery" value="${html(state.historyQuery)}"></label>
    <div class="actions manual">${button("导出全部 JSON","export","",history.length?"":"disabled")}
    ${button("清空记录","clear-history","quiet danger",history.length?"":"disabled")}</div>
    <ul id="history-list" class="history-list">${historyList()}</ul></section>
    <div>${resultCard(history.find(item=>item.id===state.opened))}</div></div>`;
}
function viewSettings() {
  return `<div class="grid"><div class="stack"><section class="card">${header("起卦与显示设置")}<div class="settings-grid">
    <label>${tx("笔画标准")}<select data-setting="stroke">${options([["modern","现代笔画"],["kangxi","康熙笔画"]],settings.stroke)}</select></label>
    <label>${tx("数字解释")}<select data-setting="digits">${options([["digits","逐位求和"],["integer","整段整数"]],settings.digits)}</select></label>
    <label>${tx("单段输入遇到奇数项")}<select data-setting="odd">${options([["upper","前半多一项"],["lower","后半多一项"]],settings.odd)}</select></label>
    <label>${tx("主题")}<select data-setting="theme">${options([["system","跟随系统"],["light","浅色"],["dark","深色"]],settings.theme)}</select></label>
    <label>${tx("文字")}<select data-setting="script"><option value="english"${settings.script==="english"?" selected":""}>English</option><option value="simplified"${settings.script==="simplified"?" selected":""}>简体中文</option>
    <option value="traditional"${settings.script==="traditional"?" selected":""}>繁體中文</option></select></label>
    <label>${tx("时辰规则")}<select data-setting="hour">${hourOptions(settings.hour)}</select></label>
    ${zoneField()}<label class="check"><input type="checkbox" data-setting="strict" ${settings.strict?"checked":""}>${tx("要求移除未参与计算的字符")}</label>
    </div></section><section class="card">${header("梅花起卦规则")}<p>${tx("用两段总和除以 8 的余数确定上下卦。两段总和除以 6 的余数决定动爻，余数为 0 时取第六爻。")}</p>
    <p class="panel-note">${tx(trigrams.map(([name],index)=>index+" "+name).join(" · "))}</p></section></div>
    <section class="card">${header("资料与隐私")}
    <p>${tx("起卦、投币和解读在此设备内运行。主动保存的卦例留在本机，可随时导出或删除。")}</p>
    <div class="reference-links text-section">
    ${link("维基文库《周易》 · 经典文本与版本","https://zh.wikisource.org/wiki/周易")}
    ${link("易安居 · 六十四卦索引","https://www.zhouyi.cc/zhouyi/yijing64/")}
    ${link("Unicode Unihan 17.0 · 现代笔画","https://www.unicode.org/reports/tr38/")}
    ${link("Kangxi Stroke Count · 康熙笔画","https://github.com/breezyreeds/kangxi-strokecount/tree/778d23d0566066ab19906557755b882818ec0a06")}
    ${link("OpenCC 1.1.9 · 简繁字形","https://github.com/BYVoid/OpenCC/tree/ver.1.1.9")}
    ${link("经典文本署名许可证 · CC BY-SA 4.0","assets/cc-by-sa-4.0.txt")}</div></section></div>`;
}

function viewVip() {
  return '<div id="vip-root"><section class="card"><p role="status">'+tx("正在检查访问权限…")+'</p></section></div>';
}
function vipLocked(target, message = "") {
  target.innerHTML = '<section class="card vip-lock">'+header("输入 VIP 口令或访问码")+
    '<p>'+tx("请联系发布者获取访问码。")+'</p>'+
    (nativeApp ? '<p class="hint">'+tx("首次使用共享口令需要联网，激活后可离线使用。")+'</p>' : '')+
    '<form id="vip-unlock" class="vip-form">'+
    '<label for="vip-code">'+tx("口令或访问码")+'</label><input id="vip-code" type="password" required autocomplete="off" maxlength="768" spellcheck="false">'+
    '<button type="submit" class="button primary">'+tx("解锁 VIP 功能")+'</button>'+
    '<p class="feedback" role="status">'+tx(message)+'</p></form></section>';
  target.querySelector("form").onsubmit = async event => {
    event.preventDefault();
    const form=event.currentTarget;
    const input=form.querySelector("input");
    const submit=form.querySelector("button");
    const feedback=form.querySelector(".feedback");
    submit.disabled=true;
    feedback.textContent="";
    const code=input.value.trim();
    try {
      if (nativeApp) {
        let pass = code;
        if (!await verifyAccessCode(pass)) {
          if (pass.startsWith("YS1.")) throw new Error("invalid_code");
          const response = await submitVipCode(redeemEndpoint, code);
          pass = (await response.json()).grant;
          if (!await verifyAccessCode(pass)) throw new Error("server_unavailable");
        }
        localStorage.setItem(vipKey,pass);
      } else {
        await submitVipCode("/vip/unlock", code);
      }
      input.value="";
      if (target.isConnected) loadVip(target,vipGeneration);
    } catch (error) {
      const messages = {
        invalid_code:"口令或访问码无效或已过期。请联系发布者。",
        rate_limited:"尝试次数过多。请稍后再试。",
      };
      feedback.textContent=localized(messages[error.message] ?? "暂时无法解锁。请检查连接或设备存储后重试。");
      submit.disabled=false;
    }
  };
}
async function submitVipCode(endpoint, code) {
  const response = await fetch(endpoint,{
    method:"POST", headers:{"Content-Type":"text/plain"}, body:code, cache:"no-store", redirect:"error",
    signal:AbortSignal.timeout(15_000),
  });
  if (response.status===401) throw new Error("invalid_code");
  if (response.status===429) throw new Error("rate_limited");
  if (!response.ok) throw new Error("server_unavailable");
  return response;
}
async function loadVip(target,generation) {
  try {
    let expiry=0;
    if (nativeApp) {
      const token=await verifyAccessCode(localStorage.getItem(vipKey));
      expiry=token?.exp ?? 0;
    } else {
      const session=await fetch("/vip/session",{cache:"no-store"});
      if (session.ok) expiry=(await session.json()).expiresAt ?? 0;
    }
    if (!target?.isConnected || generation!==vipGeneration) return;
    vipExpiry=expiry*1000;
    if (vipExpiry<=Date.now()) { vipExpiry=0; vipLocked(target); return; }
    const {mountVip}=await import("./vip-content/vip-ui.js");
    if (!target.isConnected || generation!==vipGeneration) return;
    target.innerHTML='<div class="vip-toolbar"><p>'+tx("VIP 已解锁")+' · '+tx("有效至")+' '+html(civilTime(new Date(vipExpiry),zoneName()).date)+'</p>'+
      '<button type="button" class="button quiet" data-vip-lock>'+tx("锁定 VIP")+'</button></div><div data-vip-calendar></div>';
    vipTick=mountVip(target.querySelector("[data-vip-calendar]"),{tx,html,localized,zone:zoneName,simplify:toSimplified,
      classical,hexLines,corpus,byBits,dictionary,settings,flash,download:downloadData,recent:()=>
        [...Object.values(state.results),...history].filter(Boolean).sort((a,b)=>b.createdAt-a.createdAt)[0] ?? androidReading()});
    target.querySelector("[data-vip-lock]").onclick=async () => {
      try {
        if (nativeApp) localStorage.removeItem(vipKey);
        else if (!(await fetch("/vip/lock",{method:"POST",cache:"no-store"})).ok) throw new Error("lock_failed");
        vipExpiry=0;
        render();
      } catch { flash("暂时无法清除访问权限。"); }
    };
  } catch {
    if (target?.isConnected && generation===vipGeneration) {
      vipExpiry=0;
      vipLocked(target,"暂时无法载入 VIP 资料。");
    }
  }
}
function currentResult() {
  return state.page === "history" ? history.find(item=>item.id===state.opened) : state.results[state.page];
}
function updateHistory(next) {
  if (!store(keys.history,next)) return false;
  history = next;
  render();
  return true;
}
function randomToss() {
  if (state.tosses.length >= 6) return;
  state.tosses.push(castCoins());
  delete state.results.coins;
  render();
}
async function copyReading(result) {
  if (!result) return;
  const original = corpus[result.original-1], changed = corpus[result.changed-1];
  const classic = value => settings.script==="english" && english.classical[value] ? english.classical[value]+"\n"+value : settings.script==="traditional" ? value : toSimplified(value);
  const text = [localized(original.title+" → "+changed.title),classic(original.judgment),
    ...result.movingLines.map(line=>classic(original.lines[line-1])),settings.script==="english"?english.hexagrams[original.number-1].reflection:localized(result.interpretation.summary),
    settings.script==="english"?english.hexagrams[changed.number-1].reflection:localized(result.interpretation.change),localized(categories[result.category][0]+" · "+result.interpretation.prompt),...result.sources].join("\n");
  try { await navigator.clipboard.writeText(text); flash("结果已复制。"); }
  catch { flash("复制失败。你可以手动选取结果文字。"); }
}
function androidReading() {
  if (!androidVip) return null;
  const args=new URLSearchParams(location.search);
  const original=+args.get("original");
  const movingLines=(args.get("moving") ?? "").split(",").filter(Boolean).map(Number);
  return original>=1 && original<=64 && movingLines.every(line=>Number.isInteger(line) && line>=1 && line<=6) &&
    new Set(movingLines).size===movingLines.length ? {original,movingLines} : null;
}
function downloadData(filename,data) {
  const json=JSON.stringify(data,null,2);
  if (androidVip && window.YiShuAndroid) { window.YiShuAndroid.saveJson(filename,json); return; }
  const blob = new Blob([json],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(()=>URL.revokeObjectURL(url),3000);
}
function downloadHistory() { downloadData("yishu-history.json",{schemaVersion:1,readings:history}); }
function clearPlum() {
  state.trace=null;
  delete state.results.plum;
}
const actions = {
  example() { state.plum.input="1234"; state.plum.dual=false; clearPlum(); render(); $("[data-field='plum.input']").focus(); },
  single() { state.plum.dual=false; clearPlum(); render(); $("[data-field='plum.input']").focus(); },
  dual() { state.plum.dual=true; clearPlum(); render(); $("[data-field='plum.input']").focus(); },
  "cast-plum":plumCast,
  "apply-strokes":applyStrokes,
  toss:randomToss,
  manual(button) {
    if (state.tosses.length>=6 || !Object.hasOwn(coinLabels,+button.dataset.total)) return;
    state.tosses.push({total:+button.dataset.total,heads:null}); delete state.results.coins; render();
  },
  undo() { state.tosses.pop(); delete state.results.coins; render(); },
  "reset-coins"() { state.tosses=[]; delete state.results.coins; render(); },
  "cast-coins"() {
    const reading=coinResult(state.tosses);
    if (!reading) return;
    state.results.coins=makeResult("coins",reading.bits,reading.moving,{tosses:state.tosses.slice()}); render();
  },
  async shake() {
    if (state.shake) { state.shake=false; render(); return; }
    try {
      if (typeof DeviceMotionEvent.requestPermission === "function" && await DeviceMotionEvent.requestPermission() !== "granted") {
        flash("需要允许设备运动权限。"); return;
      }
      state.shake=true; lastShake=Date.now(); render();
    } catch { flash("设备运动权限不可用。"); }
  },
  "save-result"() {
    const result=currentResult();
    if (result && !history.some(item=>item.id===result.id) && updateHistory([result,...history])) flash("记录已保存。");
  },
  "copy-result"() { copyReading(currentResult()); },
  export:downloadHistory,
  "open-hex"(button) {
    state.library.number=+button.dataset.number;
    for (const row of document.querySelectorAll("[data-action='open-hex']")) row.setAttribute("aria-pressed",String(row===button));
    $("#library-detail").innerHTML=libraryDetail(corpus[state.library.number-1]);
    if (innerWidth<=1030) $("#hex-detail").scrollIntoView({block:"start"});
  },
  "open-record"(button) { state.opened=button.dataset.id; render(); },
  "delete-record"(button) {
    if (confirm(localized("删除这条记录？"))) {
      updateHistory(history.filter(item=>item.id!==button.dataset.id));
    }
  },
  "clear-history"() { if (confirm(localized("清空所有本机记录？"))) updateHistory([]); },
};
document.addEventListener("click",event=>{
  const node=event.target.closest("[data-action]");
  if (node && !node.disabled && Object.hasOwn(actions,node.dataset.action)) actions[node.dataset.action](node);
});
function onField(event) {
  const {target} = event;
  const field = target.dataset.field;
  if (!field) return;
  if (field === "historyQuery") {
    state.historyQuery=target.value;
    $("#history-list").innerHTML=historyList();
    return;
  }
  const [object,key] = field.split(".");
  state[object][key]=target.value;
  if (object === "library") $("#hex-list").innerHTML=libraryList();
  if (object === "plum" && ["input","lower"].includes(key) && state.trace) {
    clearPlum();
    $(".feedback").innerHTML="";
    $("#plum-form .stroke-controls")?.closest("details")?.remove();
    $("#result-slot").innerHTML=resultCard(null);
  }
}
document.addEventListener("input",onField);
document.addEventListener("change",event=>{
  const {target}=event;
  const key=target.dataset.setting;
  if (!key) { if (target.matches("select")) onField(event); return; }
  const value=target.type==="checkbox" ? target.checked : target.value.trim();
  if (key==="zone" && value) {
    try { civilTime(new Date(),value); }
    catch { target.value=settings.zone; flash("请选择有效的时区。"); return; }
  }
  const next={...settings,[key]:value};
  if (store(keys.settings,next)) {
    settings=next;
    if (["stroke","digits","odd","strict"].includes(key)) clearPlum();
    render();
    $("[data-setting='"+key+"']")?.focus({preventScroll:true});
  }
});
document.addEventListener("toggle",event=>{
  const key=event.target.dataset?.question;
  if (key) state[key].expanded=event.target.open;
},true);
window.addEventListener("hashchange",route);
window.addEventListener("devicemotion",event=>{
  if (state.page !== "coins" || !state.shake || state.tosses.length>=6) return;
  const a = event.accelerationIncludingGravity;
  const now=Date.now();
  if (a && a.x*a.x+a.y*a.y+a.z*a.z>22*22 && now-lastShake>=900) { lastShake=now; randomToss(); }
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change",applyAppearance);
async function asset(name,format="text") {
  const response=await fetch("./assets/"+name);
  if (!response.ok) throw new Error("Missing "+name);
  return response[format]();
}
try {
  if (settings.zone) {
    try { civilTime(new Date(),settings.zone); }
    catch { settings.zone=""; }
  }
  const [sources,strokes,st,ts,phrases]=await Promise.all([
    asset("hexagrams.json","json"),asset("strokes.tsv"),asset("STCharacters.txt"),asset("TSCharacters.txt"),asset("TSPhrases.txt"),
  ]);
  corpus=sources;
  byBits=new Map(corpus.map(entry=>[entry.bits,entry]));
  if (corpus.length!==64 || byBits.size!==64) throw new Error("Incomplete corpus");
  history=history.filter(entry=>corpus[entry.original-1] && corpus[entry.changed-1] && Array.isArray(entry.movingLines) &&
    Object.hasOwn(categories,entry.category) && entry.interpretation && entry.calculation);
  dictionary=strokeDictionary(strokes);
  toTraditional=conversion(st,"咸\t咸");
  toSimplified=conversion(ts,phrases,"乾：\t乾：\n乾乾\t乾乾");
  route();
  setInterval(clock,1000);
  if ("serviceWorker" in navigator && !nativeApp) {
    navigator.serviceWorker.register("./sw.js").catch(()=>{});
  }
} catch (error) {
  console.error(error);
  content.innerHTML=`<section class="card"><h1>Data unavailable</h1><p>Please reload YiShu.</p></section>`;
}

