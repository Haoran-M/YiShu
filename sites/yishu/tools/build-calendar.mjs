import {createRequire} from "node:module";
import {mkdir,readFile,writeFile} from "node:fs/promises";
import {join,resolve} from "node:path";
const require=createRequire(import.meta.url);
const [astroPath,lunarPath]=process.argv.slice(2);
if (!astroPath || !lunarPath) throw new Error("Pass the unpacked Astronomy Engine 2.1.19 and lunar-javascript 1.7.8 directories.");
const {SearchSunLongitude}=require(join(resolve(astroPath),"astronomy.js"));
const {Solar,LunarYear}=require(resolve(lunarPath));
const start="1901-01-01", end="2100-12-31";
const epoch=86400000;
const dateIndex=iso=>Math.round(Date.parse(iso+"T00:00:00Z")/epoch);
const byDate=new Map();
for (let year=1900;year<=2101;year++) {
  for (const month of LunarYear.fromYear(year).getMonths()) {
    const day=dateIndex(Solar.fromJulianDay(month.getFirstJulianDay()).toYmd());
    const row=[day,month.getYear(),month.getMonth(),month.getDayCount()];
    const existing=byDate.get(day);
    if (existing && existing.join()!==row.join()) throw new Error("Lunar month conflict at "+day);
    byDate.set(day,row);
  }
}
const rows=[...byDate.values()].sort((a,b)=>a[0]-b[0]);
const first=rows.findLastIndex(row=>row[0]<=dateIndex(start));
const last=rows.findLastIndex(row=>row[0]<=dateIndex(end));
const months=rows.slice(first,last+1);
for (const [index,row] of months.entries()) {
  const next=months[index+1];
  if (![29,30].includes(row[3]) || next && next[0]!==row[0]+row[3]) throw new Error("Lunar data gap at "+row[0]);
}
const terms={};
for (let year=1900;year<=2101;year++) {
  let search=new Date(Date.UTC(year,0,1));
  const minutes=[];
  for (let index=0;index<24;index++) {
    const event=SearchSunLongitude((285+15*index)%360,search,24);
    if (!event || event.date.getUTCFullYear()!==year) throw new Error("Missing solar term "+year+" #"+index);
    minutes.push(Math.round(+event.date/60000));
    search=new Date(+event.date+4*epoch);
  }
  terms[year]=minutes;
}
const target=new URL("../dist/vip-content/",import.meta.url);
await mkdir(target,{recursive:true});
await writeFile(new URL("calendar-data.json",target),JSON.stringify({start,end,months,terms,sources:{
  lunar:"lunar-javascript 1.7.8 (MIT)",solar:"Astronomy Engine 2.1.19 (MIT)",representation:"Gregorian civil date / UTC minute",
}})+"\n");
await writeFile(new URL("lunar-license.txt",target),await readFile(join(resolve(lunarPath),"LICENSE")));
const astroSource=await readFile(join(resolve(astroPath),"astronomy.js"),"utf8");
const mit=astroSource.match(/\/\*[\s\S]*?MIT License[\s\S]*?\*\//)?.[0];
if (!mit) throw new Error("Astronomy Engine license header missing.");
await writeFile(new URL("astronomy-license.txt",target),mit+"\n");
console.log(JSON.stringify({range:[start,end],months:months.length,terms:Object.keys(terms).length*24,boundaryYears:[1900,2101]}));
