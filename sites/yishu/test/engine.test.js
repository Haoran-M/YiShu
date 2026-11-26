import {strict as assert} from "node:assert";
import {createHash,generateKeyPairSync,sign} from "node:crypto";
import {readFile} from "node:fs/promises";
import {test} from "node:test";
import {calculatePlum,civilTime,coinResult,nextHour,resolveReading,strokeDictionary} from "../dist/engine.js";
import {calendarFromData,dateIndex,isoDay} from "../dist/vip-content/calendar-engine.js";
import {birthReport,localInstants,topicRequests,variants} from "../dist/vip-content/extended-engine.js";

const assets=path=>readFile(new URL("../dist/"+path,import.meta.url),"utf8");
const corpus=JSON.parse(await assets("assets/hexagrams.json"));
const bits=new Map(corpus.map(entry=>[entry.bits,entry]));
const calendar=calendarFromData(JSON.parse(await assets("vip-content/calendar-data.json")));
const dictionary=strokeDictionary(await assets("assets/strokes.tsv"));
const settings={stroke:"modern",digits:"digits",odd:"upper",strict:false};

test("base casts agree with the Android goldens",()=>{
  assert.equal(bits.size,64);
  assert.equal(corpus.flatMap(entry=>entry.lines).length,384);
  const plum=calculatePlum({input:"１٢3 𝟜",settings,dictionary});
  assert.equal(plum.issues.length,0);
  assert.equal(plum.upperSum,3n);
  assert.equal(plum.lowerSum,7n);
  assert.deepEqual(plum.moving,[4]);
  const a=resolveReading(bits,plum.bits,plum.moving);
  assert.equal(a.original.number,56);
  assert.equal(a.changed.number,52);
  const coin=coinResult([6,7,8,9,7,8].map(total=>({total})));
  const b=resolveReading(bits,coin.bits,coin.moving);
  assert.deepEqual([b.original.number,b.changed.number,coin.moving],[47,60,[1,4]]);
});
test("stroke standards, manual override and big integers",()=>{
  assert.equal(dictionary("龙","modern")[0].count,5);
  assert.equal(dictionary("龙","kangxi")[0].count,16);
  const input="⺀7";
  assert.equal(calculatePlum({input,settings,dictionary}).unknown.length,1);
  const result=calculatePlum({input,settings,dictionary,overrides:new Map([["⺀",{glyph:"⺀",count:8,source:"手动覆盖"}]])});
  assert.equal(result.upperRemainder,0);
  const huge=calculatePlum({input:"9".repeat(10000),lowerInput:"8",settings:{...settings,digits:"integer"},dictionary});
  assert.equal(String(huge.upperSum).length,10000);
  assert.equal(huge.upperRemainder,7);
});
test("civil branches respect spring-forward, fall-back and midnight",()=>{
  let instant=new Date("2026-03-08T06:59:59Z");
  assert.equal(civilTime(instant,"America/New_York").branch,1);
  assert.equal(nextHour(instant,"America/New_York").time,"03:00:00");
  instant=new Date("2026-11-01T06:30:00Z");
  assert.equal(nextHour(instant,"America/New_York").time,"03:00:00");
  assert.equal(civilTime(new Date("2026-06-19T15:59:59Z"),"Asia/Shanghai").ziPeriod,"夜子");
  assert.equal(civilTime(new Date("2026-06-19T16:00:00Z"),"Asia/Shanghai").ziPeriod,"早子");
});
test("all supported Gregorian dates round-trip through the lunar calendar",()=>{
  for (let day=dateIndex(calendar.start);day<=dateIndex(calendar.end);day++) {
    const iso=isoDay(day);
    const lunar=calendar.fromGregorian(iso);
    assert.equal(calendar.toGregorian(lunar.year,lunar.month,lunar.day),iso);
  }
  assert.equal(calendar.fromGregorian("1900-12-31"),null);
  assert.equal(calendar.fromGregorian("2101-01-01"),null);
  assert.equal(calendar.fromGregorian("2026-02-30"),null);
  assert.deepEqual(calendar.festivals(calendar.fromGregorian("2026-02-17"),"Asia/Hong_Kong"),["春节"]);
  assert.equal(calendar.fromGregorian("2023-03-22").month,-2);
  assert.equal(calendar.fromGregorian("2025-07-25").month,-6);
  assert.equal(calendar.toGregorian(2025,-6,30),null);
});
test("solar longitude crossings agree to two minutes with independent HKO 2026 checks",()=>{
  const expected={0:"01-05 16:23",1:"01-20 09:45",2:"02-04 04:02",3:"02-18 23:52",5:"03-20 22:46",
    7:"04-20 09:39",9:"05-21 08:37",11:"06-21 16:25",13:"07-23 03:13",14:"08-07 19:43",
    15:"08-23 10:19",17:"09-23 08:05",19:"10-23 17:38"};
  const terms=calendar.terms(2026,"Asia/Hong_Kong");
  for (const [index,value] of Object.entries(expected)) {
    const expectedTime=Date.parse("2026-"+value.replace(" ","T")+":00+08:00");
    assert.ok(Math.abs(terms[index].instant-expectedTime)<=120000,terms[index].name);
  }
  for (let year=1901;year<=2100;year++) {
    const entries=calendar.terms(year,"UTC");
    assert.equal(entries.length,24);
    assert.ok(entries.every((entry,index)=>index===0||entry.instant>entries[index-1].instant));
  }
  assert.notEqual(calendar.terms(2026,"Asia/Hong_Kong")[2].date,calendar.terms(2026,"America/Vancouver")[2].date);
  assert.ok(calendar.festivals(calendar.fromGregorian(terms[6].date),"Asia/Hong_Kong").includes("清明"));
  assert.equal(calendar.nextTerm(new Date("2026-12-31T12:00:00Z"),"UTC").name,"小寒");
});
test("birth rules distinguish Li Chun, lunar zodiac, absent time and DST",()=>{
  const zone="Asia/Shanghai";
  const date="2026-02-04";
  const before=birthReport(calendar,{date,time:"03:55",zone,zodiacBoundary:"spring-start"});
  const after=birthReport(calendar,{date,time:"04:10",zone,zodiacBoundary:"spring-start"});
  assert.deepEqual([before.pillars.year,before.pillars.month,before.zodiac],["乙巳","己丑","蛇"]);
  assert.deepEqual([after.pillars.year,after.pillars.month,after.zodiac],["丙午","庚寅","马"]);
  assert.equal(birthReport(calendar,{date,time:"04:10",zone}).zodiac,"蛇");
  const untimed=birthReport(calendar,{date,zone});
  assert.equal(untimed.pillars.year,null);
  assert.equal(untimed.pillars.month,null);
  assert.equal(untimed.birthBranch,null);
  assert.equal(birthReport(calendar,{date:"2026-06-19",zone}).lunar.dayStem,"甲子");
  assert.equal(localInstants("2026-03-08","02:30","America/New_York").length,0);
  const repeat=localInstants("2026-11-01","01:30","America/New_York");
  assert.equal(repeat[1]-repeat[0],3600000);
  assert.ok(birthReport(calendar,{date:"2026-11-01",time:"01:30",zone:"America/New_York",occurrence:"unknown"}).error);
  assert.match(birthReport(calendar,{date:"2026-02-17",time:"23:30",zone}).birthBranch,/夜子/);
});
test("every hexagram and moving mask respects original line positions",()=>{
  for (let pattern=0;pattern<64;pattern++) for (let mask=0;mask<64;mask++) {
    const lines=Array.from({length:6},(_,i)=>Number(Boolean(pattern&(1<<i))));
    const moving=Array.from({length:6},(_,i)=>i+1).filter(line=>mask&(1<<(line-1)));
    const toBits=list=>list.reduce((x,line,i)=>x+line*2**i,0);
    const derived=variants(bits,pattern,moving);
    assert.equal(derived.changed.bits,pattern^mask);
    assert.equal(derived.mutual.bits,toBits([lines[1],lines[2],lines[3],lines[2],lines[3],lines[4]]));
    assert.equal(derived.opposite.bits,toBits(lines.map(line=>1-line)));
    assert.equal(derived.reversed.bits,toBits([...lines].reverse()));
    assert.equal(variants(bits,derived.opposite.bits,[]).opposite.bits,pattern);
    assert.equal(variants(bits,derived.reversed.bits,[]).reversed.bits,pattern);
  }
});
test("relationship questions can cast directly and old and new names are separate casts",()=>{
  const [question]=topicRequests({mode:"relation",dual:false,input:"",question:"春风又绿"});
  assert.equal(question.input,"春风又绿");
  assert.equal(calculatePlum({...question,settings,dictionary}).issues.length,0);
  const pair=topicRequests({mode:"relation",dual:true,input:"8",second:"6",question:"春风又绿"});
  assert.deepEqual([pair[0].input,pair[0].lowerInput],["8","6"]);
  assert.deepEqual(topicRequests({mode:"name",input:"林松",second:"李梅"}).map(entry=>[entry.input,entry.lowerInput]),
    [["林松",null],["李梅",null]]);
});
test("worker serves the public app and gates VIP code/data with valid, expiring signed codes",async()=>{
  const {publicKey,privateKey}=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
  const fixture=(await assets("server/index.js")).replace(/^export const publisherKey = [^\r\n]+/,
    "export const publisherKey = "+JSON.stringify(publicKey.export({format:"jwk"}))+";");
  const worker=(await import("data:text/javascript;base64,"+Buffer.from(fixture).toString("base64"))).default;
  const send=(url,opts,env)=>worker.fetch(new Request("https://test.yishu.invalid"+url,opts),env);
  assert.equal((await send("/")).status,200);
  assert.equal((await send("/vip-content/calendar-data.json")).status,401);
  assert.equal((await send("/vip-content/vip-ui.js")).status,401);
  const issue=expiry=>{
    const now=Math.floor(Date.now()/1000);
    const encoded=Buffer.from(JSON.stringify({aud:"yishu-vip",iat:now-3600,exp:expiry,id:"fixture"})).toString("base64url");
    const data="YS1."+encoded;
    return data+"."+sign("sha256",Buffer.from(data),{key:privateKey,dsaEncoding:"ieee-p1363"}).toString("base64url");
  };
  const now=Math.floor(Date.now()/1000);
  for (const body of ["nonsense",issue(now-1),"x".repeat(769)]) {
    assert.equal((await send("/vip/unlock",{method:"POST",body})).status,401);
  }
  const body=issue(now+100);
  assert.equal((await send("/vip/unlock",{method:"POST",body,headers:{Origin:"https://other.invalid"}})).status,403);
  const unlock=await send("/vip/unlock",{method:"POST",body});
  assert.equal(unlock.status,200);
  const cookie=unlock.headers.get("set-cookie");
  assert.match(cookie,/Secure; HttpOnly; SameSite=Strict/);
  const headers={Cookie:cookie.split(";")[0]};
  assert.equal((await send("/vip/session",{headers})).status,200);
  assert.equal((await send("/vip-content/calendar-data.json",{headers})).status,200);
  assert.equal((await send("/vip-content/vip-ui.js",{headers})).headers.get("cache-control"),"private, no-store");
  assert.match((await send("/vip/lock",{method:"POST"})).headers.get("set-cookie"),/Max-Age=0/);
  const phrase="river-82";
  const env={YISHU_SHARED_CODE_SHA256:createHash("sha256").update(phrase).digest("hex"),YISHU_SHARED_GRANT:body};
  const post=(url,input,headers={})=>send(url,{method:"POST",body:input,headers},env);
  const shared=await post("/vip/unlock",phrase,{Origin:"https://test.yishu.invalid"});
  assert.equal(shared.status,200);
  assert.equal((await shared.json()).grant,undefined);
  assert.equal(shared.headers.get("set-cookie").split(";")[0],cookie.split(";")[0]);
  assert.equal((await post("/vip/unlock",phrase.toUpperCase())).status,401);
  for (const origin of ["https://app.yishu.invalid","https://appassets.androidplatform.net"]) {
    const app=await post("/vip/redeem",phrase,{Origin:origin,"Sec-Fetch-Site":"cross-site"});
    assert.equal(app.status,200);
    assert.equal(app.headers.get("access-control-allow-origin"),origin);
    assert.equal(app.headers.get("set-cookie"),null);
    assert.equal((await app.json()).grant,body);
  }
  assert.equal((await post("/vip/redeem",phrase,{Origin:"https://other.invalid"})).status,403);
  assert.equal((await post("/vip/redeem",body,{Origin:"https://app.yishu.invalid"})).status,401);
  const expired={...env,YISHU_SHARED_GRANT:issue(now-1)};
  assert.equal((await send("/vip/unlock",{method:"POST",body:phrase},expired)).status,503);
  for (let count=0;count<10;count++) {
    assert.equal((await post("/vip/unlock","wrong",{"CF-Connecting-IP":"192.0.2.10"})).status,401);
  }
  assert.equal((await post("/vip/redeem",phrase,{Origin:"https://app.yishu.invalid","CF-Connecting-IP":"192.0.2.10"})).status,429);
  assert.equal((await post("/vip/unlock",phrase,{"CF-Connecting-IP":"192.0.2.11"})).status,200);
});
