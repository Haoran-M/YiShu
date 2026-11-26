import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import worker from '../dist/server/index.js';
import {english,englishText} from '../dist/english.js';
import {conversion} from '../dist/engine.js';

test('Chinese script conversion preserves the proper names Qian and Xian',async()=>{
  const asset=name=>readFile(new URL('../dist/assets/'+name,import.meta.url),'utf8');
  const simplified=conversion(await asset('TSCharacters.txt'),await asset('TSPhrases.txt'),'乾：\t乾：\n乾乾\t乾乾');
  const traditional=conversion(await asset('STCharacters.txt'),'咸\t咸');
  assert.equal(simplified('乾：元亨。終日乾乾。乾肉'),'乾：元亨。终日乾乾。干肉');
  assert.equal(traditional('泽山咸'),'澤山咸');
});

test('all 64 gua have complete English interpretations aligned to the Chinese corpus',async()=>{
  const corpus=JSON.parse(await readFile(new URL('../dist/assets/hexagrams.json',import.meta.url),'utf8'));
  const android=JSON.parse(await readFile(new URL('../../../app/src/main/assets/english.json',import.meta.url),'utf8'));
  assert.deepEqual(android,english);
  assert.equal(english.hexagrams.length,64);
  for(const [i,h] of corpus.entries()){
    const e=english.hexagrams[i];assert.equal(e.number,h.number);assert.equal(e.lines.length,6);
    assert.ok(e.chinese.meaning.length>10);assert.ok(e.chinese.reflection.length>5);
    for(const text of [e.name,e.pinyin,e.meaning,e.image,e.reflection,...e.lines]){assert.ok(text.length>1);assert.ok(!/\p{Script=Han}/u.test(text));}
    for(const text of [h.judgment,h.image,...h.lines,...(h.extra?[h.extra]:[])]) assert.ok(english.classical[text]);
    assert.ok(englishText(h.title).includes(e.name));
  }
});

function database(){
  const db=new DatabaseSync(':memory:');
  return {raw:db,prepare(sql){let params=[];return {bind(...values){params=values;return this;},sql,values:()=>params};},async batch(statements){return statements.map(({sql,values})=>({results:db.prepare(sql).all(...values())}));}};
}
const origin='https://example.org';
test('traffic persists, deduplicates daily sessions, protects reports, validates input and honors privacy',async()=>{
  const DB=database();DB.raw.exec(await readFile(new URL('../drizzle/0000_visit_counts.sql',import.meta.url),'utf8'));
  const env={DB,YISHU_ANALYTICS_KEY:'publisher-test-key'};
  const session='12345678-1234-4234-8234-123456789abc';
  const post=(data,headers={})=>worker.fetch(new Request(origin+'/api/visits',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,...headers},body:JSON.stringify(data)}),env);
  assert.equal((await post({page:'library',session})).status,204);
  assert.equal((await post({page:'plum',session})).status,204);
  assert.equal((await post({page:'library',session:'22345678-1234-4234-8234-123456789abc'})).status,204);
  assert.equal((await post({page:'library',session},{DNT:'1'})).status,204);
  assert.equal((await post({page:'library',session},{'Sec-GPC':'1'})).status,204);
  assert.equal((await post({page:'private question',session})).status,400);
  assert.equal((await post({page:'library',session:'invalid'})).status,400);
  assert.equal((await post({page:'library',session},{Origin:'https://attacker.example'})).status,403);
  assert.equal((await worker.fetch(new Request(origin+'/api/analytics'),env)).status,401);
  assert.equal((await worker.fetch(new Request(origin+'/api/analytics',{headers:{Authorization:'Bearer wrong'}}),env)).status,401);
  const response=await worker.fetch(new Request(origin+'/api/analytics',{headers:{Authorization:'Bearer publisher-test-key'}}),env);
  assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');
  const counts=await response.json();assert.equal(counts.views,3);assert.equal(counts.sessions,2);assert.equal(counts.today,2);assert.equal(counts.pages[0].views,2);
  assert.equal(JSON.stringify(counts).includes(session),false);
  DB.raw.close();
});
