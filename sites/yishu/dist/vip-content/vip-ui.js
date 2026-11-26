import {calculatePlum,categories,civilTime,trigrams} from "../engine.js";
import {calendarFromData,lunarDayLabel,lunarMonthLabel} from "./calendar-engine.js";
import {birthReport,topicRequests,variantRules,variants} from "./extended-engine.js";
import {mountCalendar} from "./calendar-ui.js";

const response=await fetch(new URL("calendar-data.json",import.meta.url),{cache:"no-store"});
if (!response.ok) throw new Error("Missing calendar data");
const calendar=calendarFromData(await response.json());
const tabs=[["calendar","黄历与节气"],["birth","生辰查询"],["variants","卦象衍生"],["topics","姓名与关系"]];
const savedKey="yishu:birth-profiles:1";
const newProfile=()=>({id:null,name:"",date:"",lunarYear:"",lunarMonth:"",lunarDay:"",leap:false,
  mode:"solar",time:"",zone:"",occurrence:"unknown",zodiacBoundary:"spring-festival"});
const newTopic=()=>({mode:"name",input:"",second:"",question:"",dual:false,stroke:"modern",category:"LOVE"});
const model={tab:"calendar",birth:newProfile(),birthResult:null,hex:{number:1,moving:[],tab:"original"},
  topic:newTopic(),topicResult:null,overrides:new Map()};
function profiles() {
  try {
    const value=JSON.parse(localStorage.getItem(savedKey));
    return Array.isArray(value) ? value.filter(entry=>entry && typeof entry.id==="string" && typeof entry.date==="string") : [];
  } catch { return []; }
}
function writeProfiles(next,context) {
  try { localStorage.setItem(savedKey,JSON.stringify(next)); return true; }
  catch { context.flash("无法写入本机档案。"); return false; }
}
function clickedId(control) { return control.dataset.id; }

export function mountVip(target,context) {
  const {tx,html,zone,classical,hexLines}=context;
  const button=(label,action,settings={})=>`<button type="button" class="button ${settings.primary?"primary":settings.quiet?"quiet":""}"
    data-vip-action="${action}" ${settings.id ? `data-id="${html(settings.id)}"`:""} ${settings.disabled?"disabled":""}>${tx(label)}</button>`;
  const select=(key,label,items,current)=>`<label>${tx(label)}<select data-vip-field="${key}">
    ${items.map(([value,name])=>`<option value="${html(value)}" ${String(value)===String(current)?"selected":""}>${tx(name)}</option>`).join("")}</select></label>`;
  const input=(key,label,value,type="text",attrs="")=>`<label>${tx(label)}<input type="${type}" data-vip-field="${key}" value="${html(value)}" ${attrs}></label>`;
  const check=(key,label,checked)=>`<label class="check"><input type="checkbox" data-vip-field="${key}" ${checked?"checked":""}>${tx(label)}</label>`;
  const area=(key,label,value)=>`<label>${tx(label)}<textarea data-vip-field="${key}">${html(value)}</textarea></label>`;
  const title=(label,subtitle="")=>`<header class="card-heading"><div><h2>${tx(label)}</h2>${subtitle?`<p>${tx(subtitle)}</p>`:""}</div></header>`;
  const labelList=(items)=>`<dl class="facts">${items.map(([name,value])=>`<div><dt>${tx(name)}</dt><dd>${tx(value)}</dd></div>`).join("")}</dl>`;
  const reference=(entry)=>`<a href="${html(entry.source)}" target="_blank" rel="noopener noreferrer">${tx("《周易》本文出处")}</a>`;
  let calendarTick;
  function render() {
    target.innerHTML=`<div class="segmented vip-tabs" aria-label="${tx("VIP 工具")}">
      ${tabs.map(([id,label])=>`<button type="button" aria-pressed="${model.tab===id}" data-vip-action="tab" data-id="${id}">${tx(label)}</button>`).join("")}</div><div id="vip-feature"></div>`;
    const panel=target.querySelector("#vip-feature");
    calendarTick=null;
    if (model.tab==="calendar") { calendarTick=mountCalendar(panel,context); return; }
    panel.innerHTML=({birth:viewBirth,variants:viewVariants,topics:viewTopics})[model.tab]();
  }
  function viewBirth() {
    const f=model.birth;
    const profileRows=profiles().map(saved=>{
      const label=saved.name||saved.date;
      return `<li class="history-row"><div><strong>${html(label)}</strong><small>${html(saved.date)} · ${html(saved.zone)}</small></div>
        <div class="actions">${button("修改","open-profile",{id:saved.id})}${button("删除","delete-profile",{id:saved.id,quiet:true})}</div></li>`;
    }).join("");
    const selectModes=[["solar","公历"],["lunar","农历"]];
    return `<div class="grid"><section class="card">${title("出生日期与时刻","可直接查询，保存档案为可选操作")}
      <div class="fields">${select("birth.mode","生日历法",selectModes,f.mode)}
      ${f.mode==="solar" ? input("birth.date","出生公历日期",f.date,"date",'min="1901-01-01" max="2100-12-31"') :
        `<div class="settings-grid">${input("birth.lunarYear","农历年",f.lunarYear,"number",'min="1900" max="2100"')}
          ${input("birth.lunarMonth","农历月",f.lunarMonth,"number",'min="1" max="12"')}
          ${input("birth.lunarDay","农历日",f.lunarDay,"number",'min="1" max="30"')}${check("birth.leap","闰月",f.leap)}</div>`}
      <div class="settings-grid">${input("birth.time","出生时刻（可选）",f.time,"time")}
        ${input("birth.zone","出生地时区",f.zone || zone(),"text",'list="birth-zones"')}
      </div>
      <datalist id="birth-zones">${[...new Set(["Asia/Shanghai","Asia/Hong_Kong","Asia/Taipei","Asia/Tokyo","America/Vancouver","America/New_York","Europe/London","UTC",...(Intl.supportedValuesOf?.("timeZone") ?? [])])].map(value=>`<option value="${html(value)}"></option>`).join("")}</datalist>
      ${select("birth.occurrence","夏令时重复时刻",[["unknown","待确认"],["first","第一次"],["second","第二次"]],f.occurrence)}
      ${select("birth.zodiacBoundary","生肖换年规则",[["spring-festival","春节"],["spring-start","立春交节"]],f.zodiacBoundary)}
      ${input("birth.name","档案名称（可选）",f.name,"text",'maxlength="100"')}</div>
      <div class="actions">${button("查询生辰","calculate-birth",{primary:true})}${button(f.id?"保存修改":"保存本机档案","save-profile")}
        ${button("清空当前输入","clear-birth",{quiet:true})}</div>
      <p class="panel-note">${tx("出生日期、时刻和名称仅在本机处理。")}</p></section>
      <div class="stack"><section class="card" id="birth-report">${title("生辰查询结果")}${birthResultView()}</section>
      <section class="card">${title("本机生辰档案")}<ul class="history-list">${profileRows||`<li class="hint">${tx("尚无已保存的档案。")}</li>`}</ul>
        ${profiles().length?button("导出生辰档案 JSON","export-profiles"):""}</section></div></div>`;
  }
  function birthResultView() {
    const result=model.birthResult;
    if (!result) return `<p class="muted">${tx("填写生日后可查看农历、生肖及干支。")}</p>`;
    if (result.error) return `<p role="status" class="feedback">${tx(result.error)}</p>`;
    const {lunar,pillars}=result;
    return labelList([["公历",lunar.date],["农历",lunar.year+"年 "+lunarMonthLabel(lunar.month)+lunarDayLabel(lunar.day)],
      ["生肖",result.zodiac || "需出生时刻"],["节气年柱",pillars?.year || "需出生时刻"],
      ["节气月柱",pillars?.month || "需出生时刻"],["日干支",lunar.dayStem],["出生时辰",result.birthBranch || "未提供出生时刻"]])+
      `<p class="panel-note">${tx("规则 BIRTH-CIVIL-1：年柱立春换年，月柱以十二个节换月，日干支按所选民用时区午夜切换。")}</p>
        ${result.needsTime?`<p class="panel-note">${tx("生日与交节同日。补充出生时刻可确定受影响的年柱或月柱。")}</p>`:""}
        ${result.repeated?`<p class="panel-note">${tx("已按你选择的夏令时重复时刻计算。")}</p>`:""}`;
  }
  function calculateBirth() {
    const f=model.birth;
    const date=f.mode==="solar" ? f.date : calendar.toGregorian(+f.lunarYear,(f.leap?-1:1)*+f.lunarMonth,+f.lunarDay);
    model.birthResult=birthReport(calendar,{...f,date,zone:f.zone||zone()});
    return date && !model.birthResult.error ? date : null;
  }
  function saveProfile() {
    const date=calculateBirth();
    if (!date) { render(); return; }
    const f=model.birth;
    const id=f.id ?? crypto.randomUUID();
    const next={...f,date,zone:f.zone||zone(),id};
    if (writeProfiles([next,...profiles().filter(item=>item.id!==id)],context)) {
      model.birth.id=id;
      context.flash("生辰档案已保存。");
    }
    render();
  }
  function figures(group, selected, moving, interactive) {
    return `<div class="variant-graph">${variantRules.map(rule=>{
      const entry=group[rule.id];
      const graphic=hexLines(entry.bits,rule.id==="original"?moving:[]);
      const inner=`<small>${tx(rule.label)}</small>${graphic}<strong>${tx(entry.title)}</strong>`;
      return interactive?`<button type="button" class="variant-item" aria-pressed="${rule.id===selected}" data-vip-action="variant-tab" data-id="${rule.id}">${inner}</button>`:
        `<div class="variant-item">${inner}</div>`;
    }).join("")}</div>`;
  }
  function variantPage(group,rule,moving) {
    const entry=group[rule.id];
    const info=trigrams[entry.upper][0]+"上 · "+trigrams[entry.lower][0]+"下";
    return `<div class="text-section"><h3>${tx(rule.label+" · "+entry.title)}</h3><p>${tx(info)}</p>
      <p class="classical">${classical(entry.judgment)}</p>${reference(entry)}
      <details><summary>${tx("如何得到此卦")}</summary><p>${tx(rule.detail)}</p>
      ${rule.id==="original"||rule.id==="changed"?`<p>${moving.length?tx("原卦动爻")+" · "+moving.join("、"):tx("本次无动爻")}</p>`:""}
      <small class="hint">${rule.ruleId}</small></details></div>`;
  }
  function viewVariants() {
    const f=model.hex;
    const base=context.corpus[f.number-1];
    const group=variants(context.byBits,base.bits,f.moving);
    const active=variantRules.find(rule=>rule.id===f.tab);
    return `<div class="grid"><section class="card">${title("选择本卦与动爻")}
      <div class="fields">${select("hex.number","本卦",context.corpus.map(entry=>[entry.number,entry.number+" · "+entry.title]),f.number)}
      <fieldset class="line-select"><legend>${tx("原卦动爻（自下而上）")}</legend>
      <div class="actions">${[1,2,3,4,5,6].map(line=>`<label class="check"><input type="checkbox" data-move="${line}" ${f.moving.includes(line)?"checked":""}>${line}</label>`).join("")}</div></fieldset></div>
      ${context.recent()?button("使用最近起卦","use-reading",{primary:true}):""}
      <p class="panel-note">${tx("互卦、错卦和综卦用于观察卦象结构。动爻始终标在原卦爻位。")}</p></section>
      <section class="card">${title("本卦与衍生关系")}${figures(group,f.tab,f.moving,true)}${variantPage(group,active,f.moving)}</section></div>`;
  }
  function viewTopics() {
    const f=model.topic, relation=f.mode==="relation";
    return `<div class="grid"><section class="card">${title("姓名与关系专题","自定义梅花易数规则，TOPIC-PLUM-1")}
      <div class="fields">${select("topic.mode","专题",[["name","姓名（可比较旧名与新名）"],["relation","婚姻与关系"]],f.mode)}
      ${select("topic.stroke","笔画标准",[["modern","现代笔画"],["kangxi","康熙笔画"]],f.stroke)}
      ${relation?check("topic.dual","上下卦使用两个独立输入",f.dual):""}
      ${input("topic.input",relation?(f.dual?"第一输入（上卦）":"单段起卦输入（可选）"):"姓名或旧名",f.input)}
      ${!relation||f.dual?input("topic.second",relation?"第二输入（下卦）":"新名（可选）",f.second):""}
      ${relation?area("topic.question","想了解的关系问题（可选）",f.question):""}
      ${select("topic.category","解释主题",Object.entries(categories).filter(([id])=>["LOVE","CAREER","STUDY","FINANCE","OTHER"].includes(id)).map(([id,[name]])=>[id,name]),f.category)}
      </div><div class="actions">${button("生成专题解读","calculate-topic",{primary:true})}${button("清空当前资料","clear-topic",{quiet:true})}</div>
      <p class="panel-note">${tx(relation && !f.dual ? "可以只填写关系问题起卦。专题输入留在当前页面会话。" : "可以使用化名或任意输入。专题输入留在当前页面会话。")}</p></section>
      <section class="card" id="topic-report">${title("专题解读")}${topicResultView()}</section></div>`;
  }
  function calculateTopic() {
    const f=model.topic;
    const rules={stroke:f.stroke,digits:context.settings.digits,odd:context.settings.odd,strict:context.settings.strict};
    const trace=(input,lowerInput)=>calculatePlum({input,lowerInput,settings:rules,dictionary:context.dictionary,overrides:model.overrides.get(f.stroke)});
    model.topicResult=topicRequests(f).map(({label,input,lowerInput})=>({
      label,trace:trace(input,lowerInput),question:f.question,category:f.category,
    }));
    render();
  }
  function topicResultView() {
    if (!model.topicResult) return `<p class="muted">${tx("输入后可查看分段、笔画、卦辞和专题解读。")}</p>`;
    return model.topicResult.map(({label,trace,question,category})=>{
      const glyphs=[...new Map([...trace.upper,...trace.lower].filter(token=>token.source||token.value===null).map(token=>[token.raw,token])).values()];
      const fields=glyphs.map(token=>{
        const current=token.choices.findIndex(choice=>choice.glyph===token.normalized && BigInt(choice.count)===token.value);
        const point=token.raw.codePointAt(0);
        return `<div class="stroke-entry"><strong>${html(token.raw)}</strong><label>${tx("字形与笔画")}
          <select data-topic-variant="${point}"><option value="">${tx("请选择")}</option>
          ${token.choices.map((choice,index)=>`<option value="${index}" ${index===current?"selected":""}>${html(choice.glyph)} · ${choice.count}</option>`).join("")}</select></label>
          <label>${tx("手动笔画")}<input type="number" min="1" max="9999" data-topic-stroke="${point}" value="${token.source==="手动覆盖"?String(token.value):""}"></label></div>`;
      }).join("");
      const corrections=fields?`<details ${trace.unknown.length?"open":""}><summary>${tx("核对汉字笔画")}</summary><div class="stroke-controls">${fields}</div>
        ${button("应用笔画","apply-topic-strokes",{primary:true})}</details>`:"";
      if (trace.issues.length) return `<div class="text-section"><h3>${tx(label)}</h3><p class="feedback">${tx(trace.issues.join(" "))}</p>${corrections}</div>`;
      const group=variants(context.byBits,trace.bits,trace.moving);
      const entries=(tokens)=>tokens.map(token=>html(token.raw)+(token.raw!==token.normalized?"（"+html(token.normalized)+"）":"")+" = "+html(token.value)+(token.source?" · "+tx(token.source):"")).join("；");
      const meaning=entry=>trigrams[entry.upper][5]+" · "+trigrams[entry.lower][5];
      return `<div class="text-section"><h3>${tx(label)}</h3>${figures(group,"original",trace.moving,false)}
      <h3>${tx("卦辞原文")} · ${tx(group.original.title)}</h3><p class="classical">${classical(group.original.judgment)}</p>
      ${trace.moving.map(line=>`<p class="classical">${classical(group.original.lines[line-1])}</p>`).join("")}${reference(group.original)}
      <h3>${tx("传统象意")}</h3><p>${tx("本卦 "+meaning(group.original)+"；变卦 "+meaning(group.changed)+"。")}</p>
      <p>${tx("互卦 "+meaning(group.mutual)+"；错卦 "+meaning(group.opposite)+"；综卦 "+meaning(group.reversed)+"。")}</p>
      <h3>${tx("应用解读")}</h3>${question?`<p>${html(question)}</p>`:""}<p>${tx(categories[category][1])}</p>
      <p class="hint">${tx("把本卦作为现状线索，动爻作为需要核对之处，变卦作为反思方向。结果仅供传统文化参考。")}</p>
      <details><summary>${tx("笔画与分段步骤")}</summary><p>${tx("上卦合计")} ${trace.upperSum} · ${entries(trace.upper)}</p>
      <p>${tx("下卦合计")} ${trace.lowerSum} · ${entries(trace.lower)}</p><p>${tx("两段合计除以 6 的余数")} · ${trace.movingRemainder}</p></details>${corrections}</div>`;
    }).join("");
  }
  function applyTopicStrokes(button) {
    const panel=button.closest("details");
    const mode=model.topic.stroke;
    const next=new Map(model.overrides.get(mode) ?? []);
    const glyphs=new Map(model.topicResult.flatMap(item=>[...item.trace.upper,...item.trace.lower]).map(token=>[token.raw,token]));
    for (const field of panel.querySelectorAll("[data-topic-stroke]")) {
      const glyph=String.fromCodePoint(+field.dataset.topicStroke);
      const value=field.value.trim();
      const variant=panel.querySelector("[data-topic-variant='"+field.dataset.topicStroke+"']").value;
      if (value) {
        if (!/^\d{1,4}$/.test(value)||+value<1) { context.flash("请输入 1 至 9999 的笔画数。"); return; }
        next.set(glyph,{glyph,count:+value,source:"手动覆盖"});
      } else if (variant!=="") next.set(glyph,glyphs.get(glyph).choices[+variant]);
      else next.delete(glyph);
    }
    model.overrides.set(mode,next);
    calculateTopic();
  }
  target.onclick=event=>{
    const button=event.target.closest("[data-vip-action]");
    if (!button || button.disabled) return;
    const id=clickedId(button);
    switch (button.dataset.vipAction) {
      case "tab": model.tab=id; render(); target.querySelector("[data-vip-action='tab'][data-id='"+id+"']")?.focus({preventScroll:true}); break;
      case "calculate-birth": calculateBirth(); render(); break;
      case "save-profile": saveProfile(); break;
      case "clear-birth": model.birth=newProfile(); model.birthResult=null; render(); break;
      case "open-profile": {
        const saved=profiles().find(entry=>entry.id===id);
        if (saved) { model.birth={...newProfile(),...saved}; calculateBirth(); render(); }
        break;
      }
      case "delete-profile":
        if (confirm(context.localized("删除这条生辰档案？")) && writeProfiles(profiles().filter(entry=>entry.id!==id),context)) {
          if (model.birth.id===id) { model.birth=newProfile(); model.birthResult=null; }
          render();
        }
        break;
      case "export-profiles": context.download("yishu-birth-profiles.json",{schemaVersion:1,profiles:profiles()}); break;
      case "variant-tab": model.hex.tab=id; render(); break;
      case "use-reading": {
        const recent=context.recent();
        if (recent) { model.hex={number:recent.original,moving:[...recent.movingLines],tab:"original"}; render(); }
        break;
      }
      case "calculate-topic": calculateTopic(); break;
      case "clear-topic": model.topic=newTopic(); model.topicResult=null; model.overrides.clear(); render(); break;
      case "apply-topic-strokes": applyTopicStrokes(button); break;
    }
  };
  function updateField(event) {
    const field=event.target.dataset.vipField;
    if (!field) return;
    const [group,name]=field.split(".");
    const value=event.target.type==="checkbox"?event.target.checked:event.target.value;
    model[group][name]=group==="hex"?+value:value;
    if (event.type==="change" && (group==="hex" || ["mode","dual","stroke"].includes(name))) {
      if (group==="topic") model.topicResult=null;
      if (group==="birth") model.birthResult=null;
      render();
      target.querySelector("[data-vip-field='"+field+"']")?.focus({preventScroll:true});
    }
  }
  target.oninput=updateField;
  target.onchange=event=>{
    if (event.target.dataset.move) {
      const line=+event.target.dataset.move;
      model.hex.moving=event.target.checked?[...model.hex.moving,line].sort((a,b)=>a-b):model.hex.moving.filter(value=>value!==line);
      render();
      target.querySelector("[data-move='"+line+"']")?.focus({preventScroll:true});
      return;
    }
    updateField(event);
  };
  render();
  return ()=>calendarTick?.();
}
