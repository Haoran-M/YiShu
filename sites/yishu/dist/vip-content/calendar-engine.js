import {civilTime, traditionalHour} from "../engine.js?v=1.3.2";

export const dayMs=86400000;
export const solarTerms=[
  ["小寒","隆冬渐深，北半球多数地区进入寒冷时段。"],["大寒","冬季最后一个节气。"],["立春","传统节气序列以此标记春季开始。"],
  ["雨水","以雨水渐多、冬寒渐退命名。"],["惊蛰","以春雷与蛰伏生物苏醒命名。"],["春分","太阳视黄经为零度，昼夜时长大致相近。"],
  ["清明","既是节气，也是扫墓、踏青的传统节日。"],["谷雨","名称取雨水滋养谷物之意。"],["立夏","传统节气序列以此标记夏季开始。"],
  ["小满","以部分谷物籽粒逐渐饱满命名。"],["芒种","与播种和收获有芒作物的传统农事相联系。"],["夏至","北半球白昼接近全年最长。"],
  ["小暑","以夏季暑气渐盛命名。"],["大暑","传统上描述盛夏炎热时段。"],["立秋","传统节气序列以此标记秋季开始。"],
  ["处暑","名称有暑气将退之意。"],["白露","以夜间水汽易凝结成露命名。"],["秋分","太阳视黄经为一百八十度，昼夜时长大致相近。"],
  ["寒露","名称反映露水出现时天气渐凉。"],["霜降","以秋深、渐可见霜命名。"],["立冬","传统节气序列以此标记冬季开始。"],
  ["小雪","以气温下降、部分地区初雪命名。"],["大雪","传统上描述冬季寒意加深的时段。"],["冬至","北半球白昼接近全年最短，也有团聚与饮食习俗。"],
];
export const lunarFestivals=[
  [1,1,"春节"],[1,15,"元宵节"],[5,5,"端午节"],[7,7,"七夕"],[8,15,"中秋节"],[9,9,"重阳节"],
];
const stems="甲乙丙丁戊己庚辛壬癸", branches="子丑寅卯辰巳午未申酉戌亥", animals="鼠牛虎兔龙蛇马羊猴鸡狗猪";
const modulo=(value,denominator)=>((value%denominator)+denominator)%denominator;
export const stemBranch = index => stems[modulo(index,10)]+branches[modulo(index,12)];
const monthNames=["正","二","三","四","五","六","七","八","九","十","冬","腊"];
const dates="一二三四五六七八九";
export function lunarDayLabel(day) {
  if (day===10) return "初十";
  if (day===20) return "二十";
  if (day===30) return "三十";
  return (day<10?"初":day<20?"十":"廿")+dates[day%10-1];
}
export function lunarMonthLabel(month) {
  return (month<0?"闰":"")+monthNames[Math.abs(month)-1]+"月";
}
export function isoDay(day) { return new Date(day*dayMs).toISOString().slice(0,10); }
export function dateIndex(iso) {
  if (typeof iso!=="string" || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return NaN;
  const at=Date.parse(iso+"T00:00:00Z");
  return Number.isFinite(at) && new Date(at).toISOString().slice(0,10)===iso ? at/dayMs : NaN;
}
export function calendarFromData(data) {
  const min=dateIndex(data.start), max=dateIndex(data.end);
  const indexes=new Map(data.months.map(row=>[row[1]+":"+row[2],row]));
  function fromGregorian(date) {
    const time=dateIndex(date);
    if (!Number.isFinite(time) || time<min || time>max) return null;
    let low=0, high=data.months.length;
    while (low+1<high) {
      const midpoint=(low+high)>>>1;
      if (data.months[midpoint][0]<=time) low=midpoint; else high=midpoint;
    }
    const [start,year,month,length]=data.months[low];
    return {date,year,month,day:time-start+1,length,zodiac:animals[modulo(year-4,12)],
      yearStem:stemBranch(year-4),dayStem:traditionalHour(date,0).stemBranch};
  }
  function toGregorian(year,month,day) {
    if (![year,month,day].every(Number.isInteger) || day<1) return null;
    const row=indexes.get(year+":"+month);
    if (!row || day>row[3]) return null;
    const time=row[0]+day-1;
    return time>=min && time<=max ? isoDay(time) : null;
  }
  const zonedCache=new Map();
  function terms(year,zone) {
    const key=year+":"+zone;
    if (!zonedCache.has(key)) {
      const entries=(data.terms[year] ?? []).map((minutes,index)=>{
        const instant=minutes*60000;
        return {index,name:solarTerms[index][0],detail:solarTerms[index][1],instant,...civilTime(new Date(instant),zone)};
      });
      zonedCache.set(key,entries);
    }
    return zonedCache.get(key);
  }
  function festivals(day,zone) {
    if (!day) return [];
    const found=[];
    if (day.date.endsWith("-01-01")) found.push("元旦");
    if (day.month>0) for (const [month,date,name] of lunarFestivals) {
      if (month===day.month && date===day.day) found.push(name);
    }
    if (day.month===12 && day.day===day.length && fromGregorian(isoDay(dateIndex(day.date)+1))?.month===1) found.push("除夕");
    for (const term of terms(day.date.slice(0,4),zone)) {
      if (term.date===day.date && [6,23].includes(term.index)) found.push(term.name);
    }
    return found;
  }
  function nextTerm(instant,zone) {
    const year=new Date(instant).getUTCFullYear();
    return [...terms(year,zone),...terms(year+1,zone)].find(term=>term.instant>+instant) ?? null;
  }
  return {start:data.start,end:data.end,fromGregorian,toGregorian,terms,festivals,nextTerm};
}
