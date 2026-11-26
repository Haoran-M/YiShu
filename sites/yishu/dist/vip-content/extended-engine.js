import {branches,civilTime,resolveReading} from "../engine.js";
import {dateIndex,stemBranch} from "./calendar-engine.js";

const stems="甲乙丙丁戊己庚辛壬癸";
const animals="鼠牛虎兔龙蛇马羊猴鸡狗猪";
const modulo=(value,n)=>((value%n)+n)%n;
export const variantRules = [{
  id:"original",label:"本卦",ruleId:"ORIGINAL-1", detail:"保留起卦时从下往上的六条爻。",
},{
  id:"mutual",label:"互卦",ruleId:"MUTUAL-234-345-1", detail:"由下往上取原卦第 2、3、4 爻为下卦，第 3、4、5 爻为上卦。",
},{
  id:"opposite",label:"错卦",ruleId:"OPPOSITE-1", detail:"六条爻逐条阴阳互换，爻位保持不变。",
},{
  id:"reversed",label:"综卦",ruleId:"REVERSE-1", detail:"原卦六条爻的顺序上下倒置，原第 1 爻成为第 6 爻。",
},{
  id:"changed",label:"变卦",ruleId:"MOVING-XOR-1", detail:"只翻转原卦所选动爻。六爻皆静时，变卦与本卦相同。",
}];

export function topicRequests(form) {
  if (form.mode === "relation") {
    const input = !form.dual && !form.input.trim() ? form.question : form.input;
    return [{label:"关系主题",input,lowerInput:form.dual ? form.second : null}];
  }
  return form.second.trim()
    ? [{label:"姓名或旧名",input:form.input,lowerInput:null},{label:"新名",input:form.second,lowerInput:null}]
    : [{label:"姓名",input:form.input,lowerInput:null}];
}

export function variants(byBits,bits,moving) {
  if (!Number.isInteger(bits) || bits<0 || bits>63 || moving.some(line=>!Number.isInteger(line)||line<1||line>6) ||
      new Set(moving).size!==moving.length) throw new RangeError("Invalid six lines");
  const reversed=[0,1,2,3,4,5].reduce((current,index)=>current|(((bits>>index)&1)<<(5-index)),0);
  const mutual=((bits>>1)&7)|(((bits>>2)&7)<<3);
  const {original,changed}=resolveReading(byBits,bits,moving);
  return {original,mutual:byBits.get(mutual),opposite:byBits.get(bits^63),reversed:byBits.get(reversed),changed};
}

export function localInstants(date,time,zone) {
  if (!Number.isFinite(dateIndex(date)) || !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)) return [];
  const wall=Date.parse(date+"T"+time+":00Z");
  const offsets=new Set();
  for (let hours=-36;hours<=36;hours+=6) {
    const sample=wall+hours*3600000;
    const local=civilTime(new Date(sample),zone);
    offsets.add(Date.parse(local.date+"T"+local.time+"Z")-sample);
  }
  return [...offsets].map(offset=>wall-offset).filter(instant=>{
    const local=civilTime(new Date(instant),zone);
    return local.date===date && local.time.slice(0,5)===time;
  }).sort((a,b)=>a-b);
}

function pillarsAt(at,year,calendar,zone) {
  const terms=[...calendar.terms(year-1,zone),...calendar.terms(year,zone),...calendar.terms(year+1,zone)];
  const jie=terms.filter(event=>event.index%2===0 && event.instant<=at).at(-1);
  const liChun=terms.find(event=>event.index===2 && new Date(event.instant).getUTCFullYear()===year);
  if (!jie || !liChun) return null;
  const stemYear=at<liChun.instant?year-1:year;
  const yearStem=modulo(stemYear-4,10);
  const offset=modulo(jie.index/2-1,12);
  return {yearIndex:stemYear-4,year:stemBranch(stemYear-4),
    month:stems[modulo((yearStem%5)*2+2+offset,10)]+branches[modulo(2+offset,12)],boundary:jie.name};
}

export function birthReport(calendar,{date,time="",zone,occurrence="first",zodiacBoundary="spring-festival"}) {
  const lunar=calendar.fromGregorian(date);
  if (!lunar) return {error:"请选择支持范围内的公历或农历生日。"};
  const year=+date.slice(0,4);
  let hits;
  try { hits=localInstants(date,time||"12:00",zone); }
  catch { return {error:"请选择有效的 IANA 时区。"}; }
  if (time && !hits.length) return {error:"该出生时刻在所选时区不存在。请核对夏令时调整。"};
  if (time && hits.length>1 && !["first","second"].includes(occurrence)) return {error:"请选择重复时刻的第一次或第二次。"};
  const at=occurrence==="second" ? hits.at(-1) : hits[0];
  if (!Number.isFinite(at)) return {error:"该民用日期无法在所选时区定位。"};
  let pillars=pillarsAt(at,year,calendar,zone);
  const dateBoundary=calendar.terms(year,zone).find(event=>event.index%2===0 && event.date===date);
  const needsTime=Boolean(!time && dateBoundary);
  if (needsTime) pillars={...pillars,month:null,...(dateBoundary.index===2?{year:null,yearIndex:null}:{})};
  const civil=time?civilTime(new Date(at),zone):null;
  return {lunar,pillars,needsTime,repeated:hits.length>1,instant:time?at:null,
    zodiac:zodiacBoundary==="spring-start" ? (pillars?.year ? animals[modulo(pillars.yearIndex,12)] : null) : lunar.zodiac,
    birthBranch:civil ? branches[civil.branch]+(civil.ziPeriod?"时 · "+civil.ziPeriod:"时") : null};
}
