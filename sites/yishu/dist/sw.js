const cacheName = "yishu-workbench-1.3.2-private2";
const paths = ["./index.html","./style.css?v=1.3.2","./app.js?v=1.3.2-private2","./engine.js?v=1.3.2","./english.js?v=1.3.2-private","./tracking.js","./assets/english.json","./assets/mark.png","./assets/landscape.jpg",
  "./assets/hexagrams.json","./assets/strokes.tsv","./assets/STCharacters.txt","./assets/TSCharacters.txt",
  "./assets/TSPhrases.txt","./assets/cc-by-sa-4.0.txt","./assets/opencc-license.txt","./assets/unicode-license.txt",
  "./assets/kangxi-license.txt","./assets/data-manifest.json","./vip-access.js","./vip-public.js"];
const assets = new Set(paths.map(path => new URL(path,self.location).href));
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(cacheName).then(cache=>cache.addAll(paths)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith("yishu-workbench-") && key!==cacheName).map(key=>caches.delete(key))))
    .then(()=>self.clients.claim()));
});
self.addEventListener("fetch",event=>{
  const request=event.request;
  if (request.method!=="GET" || new URL(request.url).origin!==self.location.origin) return;
  const scopePath=new URL(self.registration.scope).pathname;
  const requestPath=new URL(request.url).pathname;
  const cache=()=>caches.open(cacheName);
  if (request.mode==="navigate" && (requestPath===scopePath || requestPath===scopePath+"index.html")) {
    event.respondWith(fetch(request).catch(()=>cache().then(value=>value.match("./index.html"))));
  } else if (assets.has(request.url)) {
    event.respondWith(cache().then(value=>value.match(request)).then(response=>response ?? fetch(request)));
  }
});
