import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFile} from 'node:fs/promises';
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

const origin='https://example.org';
test('visit collection is disabled and dashboard assets are not public',async()=>{
  const DB={prepare(){throw new Error('Collection must not access storage');},batch(){throw new Error('Collection must not access storage');}};
  const response=await worker.fetch(new Request(origin+'/api/visits',{method:'POST',body:JSON.stringify({page:'library',session:'12345678-1234-4234-8234-123456789abc'})}),{DB});
  assert.equal(response.status,204);
  for(const path of ['/analytics.html','/analytics.js']) assert.equal((await worker.fetch(new Request(origin+path))).status,404);
  const app=await (await worker.fetch(new Request(origin+'/app.js'))).text();
  assert.equal(app.includes('trackPage('),false);
  const privacy=await (await worker.fetch(new Request(origin+'/privacy.html'))).text();
  assert.equal(privacy.includes('id="toggle"'),false);
});

test('retired statistics endpoints stay unavailable even with the former key',async()=>{
  const env={YISHU_ANALYTICS_KEY:'publisher-test-key',DB:{prepare(){throw new Error('No report database access');}}};
  for(const headers of [{},{Authorization:'Bearer publisher-test-key'}]) assert.equal((await worker.fetch(new Request(origin+'/api/analytics',{headers}),env)).status,404);
});
