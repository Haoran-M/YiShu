import {branches,civilTime} from "../engine.js?v=1.3.2";
import {calendarFromData,dateIndex,isoDay,lunarDayLabel,lunarMonthLabel} from "./calendar-engine.js";

const response=await fetch(new URL("calendar-data.json",import.meta.url),{cache:"no-store"});
if (!response.ok) throw new Error("Calendar data is not available");
const calendar=calendarFromData(await response.json());
const model={selected:"",month:"",query:"",lunar:{year:"",month:"",day:"",leap:false},error:""};
const weekdays="一二三四五六日";

function formatLunar(day) {
  return (day.year+"年 ")+lunarMonthLabel(day.month)+lunarDayLabel(day.day);
}
function datesOf(year,month) {
  const first=dateIndex(year+"-"+month+"-01");
  const length=new Date(Date.UTC(+year,+month,0)).getUTCDate();
  const before=(new Date(first*86400000).getUTCDay()+6)%7;
  return {before,dates:Array.from({length},(_,index)=>isoDay(first+index))};
}
function matches(calendar,query,year,zone,normalize) {
  query=normalize(query.trim()).toLowerCase();
  if (!query) return [];
  const date=calendar.fromGregorian(query);
  if (date) return [{name:date.date,date:date.date}];
  const prefix=/^\d{4}\s+/.test(query) ? query.slice(0,4) : year;
  const term=query.replace(/^\d{4}\s+/,"");
  const matched=[];
  for (let index=dateIndex(prefix+"-01-01"),end=dateIndex(prefix+"-12-31");index<=end;index++) {
    const date=isoDay(index);
    for (const name of calendar.festivals(calendar.fromGregorian(date),zone)) {
      if (normalize(name).toLowerCase().includes(term)) matched.push({name,date});
    }
  }
  for (const item of calendar.terms(prefix,zone)) {
    if (normalize(item.name).toLowerCase().includes(term) && !matched.some(match=>match.name===item.name && match.date===item.date)) matched.push(item);
  }
  return matched.sort((a,b)=>a.date.localeCompare(b.date));
}
function ensureSelection(zone) {
  if (model.selected) return;
  const today=civilTime(new Date(),zone).date;
  select(calendar.fromGregorian(today) ? today : calendar.start);
}
function select(date) {
  const day=calendar.fromGregorian(date);
  if (!day) return false;
  model.selected=date;
  model.month=date.slice(0,7);
  model.lunar={year:String(day.year),month:String(Math.abs(day.month)),day:String(day.day),leap:day.month<0};
  return true;
}
function countdown(ms) {
  if (ms<=0) return "已交节";
  const remaining=Math.ceil(ms/1000);
  return Math.floor(remaining/86400)+" 天 "+String(Math.floor((remaining%86400)/3600)).padStart(2,"0")+" 时 "+
    String(Math.floor((remaining%3600)/60)).padStart(2,"0")+" 分";
}
function orderedTerms(year,zone) { return calendar.terms(year,zone); }

export function mountCalendar(target,context) {
  const {tx,html,localized,zone:zoneOf}=context;
  const zone=zoneOf();
  ensureSelection(zone);
  const today=civilTime(new Date(),zone);
  function draw() {
    const [year,month]=model.month.split("-");
    const visible=datesOf(year,month);
    const selected=calendar.fromGregorian(model.selected);
    const events=orderedTerms(model.selected.slice(0,4),zone);
    const termByDate=new Map(events.map(event=>[event.date,event]));
    const festivalNames=calendar.festivals(selected,zone);
    const term=termByDate.get(selected.date);
    const next=calendar.nextTerm(new Date(),zone);
    const monthItems=visible.dates.map(date=>{
      const day=calendar.fromGregorian(date);
      const label=calendar.festivals(day,zone)[0] ?? orderedTerms(year,zone).find(item=>item.date===date)?.name ??
        (day.day===1 ? lunarMonthLabel(day.month) : lunarDayLabel(day.day));
      return `<button type="button" class="cal-day ${date===today.date?"today":""}" data-day="${date}" aria-pressed="${date===model.selected}"
        aria-label="${html(date)} · ${tx(label)}"><strong>${+date.slice(-2)}</strong><span>${tx(label)}</span></button>`;
    }).join("");
    const nextFestival=Array.from({length:65},(_,offset)=>isoDay(dateIndex(today.date)+offset))
      .map(date=>[date,calendar.festivals(calendar.fromGregorian(date),zone)]).find(([,items])=>items.length);
    target.innerHTML=`<div class="grid vip-grid"><div class="stack">
      <section class="card"><header class="card-heading"><div><h2>${tx("黄历月视图")}</h2><p>${tx("每日农历、节气与传统节日")} · ${html(zone)}</p></div>
      <div class="actions"><button type="button" class="button" data-cal="prev" aria-label="${tx("上个月")}" ${model.month==="1901-01"?"disabled":""}>‹</button>
      <button type="button" class="button" data-cal="today">${tx("今天")}</button>
      <button type="button" class="button" data-cal="next" aria-label="${tx("下个月")}" ${model.month==="2100-12"?"disabled":""}>›</button></div></header>
      <label>${tx("公历月份")}<input class="cal-month" type="month" min="1901-01" max="2100-12" data-cal-field="month" value="${model.month}"></label>
      <div class="calendar-week" aria-hidden="true">${(document.documentElement.lang==='en'?['Mon','Tue','Wed','Thu','Fri','Sat','Sun']:[...weekdays]).map(day=>`<span>${day}</span>`).join("")}</div>
      <div class="calendar-week cal-grid">${'<span aria-hidden="true"></span>'.repeat(visible.before)}${monthItems}</div>
      <div class="text-section"><label>${tx("搜索日期、节气或节日")}
      <input type="search" data-cal-field="query" value="${html(model.query)}" placeholder="${tx("例如 2026-02-17、立春或春节")}"></label>
      <ul id="vip-search-results" class="toss-list"></ul></div></section>
      <section class="card"><header class="card-heading"><h2>${tx("公历与农历互查")}</h2></header>
      <div class="settings-grid"><label>${tx("公历日期")}<input type="date" min="${calendar.start}" max="${calendar.end}" data-cal-field="date" value="${selected.date}"></label>
      <label>${tx("农历年")}<input type="number" min="1900" max="2100" data-cal-field="lunar-year" value="${html(model.lunar.year)}"></label>
      <label>${tx("农历月")}<input type="number" min="1" max="12" data-cal-field="lunar-month" value="${html(model.lunar.month)}"></label>
      <label>${tx("农历日")}<input type="number" min="1" max="30" data-cal-field="lunar-day" value="${html(model.lunar.day)}"></label>
      <label class="check"><input type="checkbox" data-cal-field="lunar-leap" ${model.lunar.leap?"checked":""}>${tx("闰月")}</label></div>
      <div class="actions"><button type="button" class="button primary" data-cal="convert">${tx("农历转公历")}</button></div>
      <p class="feedback" role="status">${tx(model.error)}</p>
      <p class="panel-note">${tx("支持公历 1901–2100 年。农历日期按东八区历法表换算，节气按所选时区显示。")}</p></section>
      </div><div class="stack">
      <section class="card"><header class="card-heading"><div><h2>${selected.date}</h2><p>${tx("星期"+"日一二三四五六"[new Date(selected.date+"T00:00:00Z").getUTCDay()])}</p></div></header>
      <p class="classical">${tx(formatLunar(selected))}</p><p>${tx(selected.yearStem+"年 · 属"+selected.zodiac+" · "+selected.dayStem+"日")}</p>
      ${festivalNames.length?`<div class="text-section"><h3>${tx("节日")}</h3><p>${tx(festivalNames.join("、"))}</p></div>`:""}
      ${term?`<div class="text-section"><h3>${tx(term.name)} · ${term.time.slice(0,5)}</h3><p>${tx(term.detail)}</p></div>`:""}
      <div class="text-section"><h3>${tx("今日时辰")}</h3><p>${today.date} · ${tx(branches[today.branch]+"时")}</p></div></section>
      ${next?`<section class="card"><header class="card-heading"><h2>${tx("下一节气")} · ${tx(next.name)}</h2></header>
      <p>${next.date} · ${next.time.slice(0,5)} · ${html(zone)}</p><p class="hint" id="vip-next-term" data-instant="${next.instant}">${tx(countdown(next.instant-Date.now()))}</p>
      <p class="panel-note">${tx(next.detail)}</p>${nextFestival?`<p class="panel-note">${tx("近期节日")} · ${nextFestival[0]} · ${tx(nextFestival[1].join("、"))}</p>`:""}</section>`:""}
      <section class="card"><details><summary>${year} ${tx("年二十四节气")}</summary><ol class="hours-list">
      ${orderedTerms(year,zone).map(item=>`<li class="hour-row"><button type="button" class="button quiet" data-day="${item.date}" aria-label="${tx("查看"+item.name)}">${tx(item.name)}</button>
      <span>${item.date}<br>${item.time.slice(0,5)}</span></li>`).join("")}</ol></details>
      <details class="text-section"><summary>${tx("算法与来源")}</summary>
      <p class="panel-note">${tx("历法规则 CN-LUNAR-1 · 节气规则 SOLAR-LONGITUDE-1。生肖以春节换年。日干支以公历当地午夜换日。")}</p>
      <p class="panel-note">${tx("节气为太阳视黄经每 15° 的交点，存储为 UTC 分钟；节日是文化日期。")}</p>
      <div class="reference-links">
      <a href="https://www.hko.gov.hk/sc/gts/time/conversion.htm" target="_blank" rel="noopener noreferrer">${tx("香港天文台公历农历对照表 · 样例核对")}</a>
      <a href="https://www.hko.gov.hk/en/gts/astronomy/Solar_Term.htm" target="_blank" rel="noopener noreferrer">${tx("香港天文台节气历表 · 样例核对")}</a>
      <a href="https://github.com/6tail/lunar-javascript" target="_blank" rel="noopener noreferrer">lunar-javascript 1.7.8 · MIT</a>
      <a href="https://github.com/cosinekitty/astronomy" target="_blank" rel="noopener noreferrer">Astronomy Engine 2.1.19 · MIT</a>
      </div></details></section></div></div>`;
    drawSearch();
  }
  function drawSearch() {
    const list=target.querySelector("#vip-search-results");
    if (!list) return;
    const found=matches(calendar,model.query,model.month.slice(0,4),zone,value=>localized(context.simplify(value)));
    list.innerHTML=found.length?found.map(item=>`<li><button class="button quiet" type="button" data-day="${item.date}">${html(item.date)} · ${tx(item.name)}</button></li>`).join("")
      : model.query.trim()?`<li class="hint">${tx("没有找到符合的日期、节气或节日。")}</li>`:"";
  }
  target.onclick=event=>{
    const button=event.target.closest("[data-day],[data-cal]");
    if (!button || button.disabled) return;
    model.error="";
    if (button.dataset.day) {
      select(button.dataset.day);
      draw();
      target.querySelector(".cal-day[aria-pressed='true']")?.focus({preventScroll:true});
      return;
    }
    const action=button.dataset.cal;
    if (action==="today") select(civilTime(new Date(),zone).date);
    if (action==="prev"||action==="next") {
      const [year,month]=model.month.split("-").map(Number);
      select(new Date(Date.UTC(year,month-1+(action==="prev"?-1:1),1)).toISOString().slice(0,10));
    }
    if (action==="convert") {
      const lunar=model.lunar;
      const date=calendar.toGregorian(+lunar.year,(lunar.leap?-1:1)*+lunar.month,+lunar.day);
      if (!date || !select(date)) model.error="此农历日期不存在或超出支持范围。请核对闰月和日数。";
    }
    draw();
    target.querySelector("[data-cal='"+action+"']")?.focus({preventScroll:true});
  };
  target.onchange=event=>{
    const field=event.target.dataset.calField;
    if (field==="month" || field==="date") {
      if (!select(field==="month" ? event.target.value+"-01" : event.target.value)) model.error="请选择支持范围内的公历日期。";
      else model.error="";
      draw();
      target.querySelector("[data-cal-field='"+field+"']")?.focus({preventScroll:true});
    }
  };
  target.oninput=event=>{
    const field=event.target.dataset.calField;
    if (field==="query") { model.query=event.target.value; drawSearch(); }
    if (field?.startsWith("lunar-")) model.lunar[field.slice(6)]=event.target.type==="checkbox"?event.target.checked:event.target.value;
  };
  draw();
  function updateCountdown() {
    const node=target.querySelector("#vip-next-term");
    if (!node) return;
    const remaining=+node.dataset.instant-Date.now();
    if (remaining<0) { draw(); return; }
    node.textContent=localized(countdown(remaining));
  }
  return updateCountdown;
}
