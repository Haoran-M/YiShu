function sessionCookie(value, maxAge) {
  return cookieName+"="+value+"; Path=/; Max-Age="+maxAge+"; Secure; HttpOnly; SameSite=Strict";
}
function sendJson(body,status=200,headers={}) {
  return new Response(JSON.stringify(body),{status,headers:{"Content-Type":"application/json; charset=utf-8",
    "Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...headers}});
}
function readCookie(request) {
  const header=request.headers.get("Cookie") ?? "";
  return header.split(";").map(part=>part.trim()).find(part=>part.startsWith(cookieName+"="))?.slice(cookieName.length+1) ?? "";
}
async function readCode(request) {
  if (!request.body) return "";
  const reader=request.body.getReader();
  const input=new Uint8Array(768);
  let size=0;
  while (true) {
    const {value,done}=await reader.read();
    if (done) return new TextDecoder().decode(input.subarray(0,size)).trim();
    if (size+value.length>input.length) { await reader.cancel(); return ""; }
    input.set(value,size);
    size+=value.length;
  }
}
function allowMutation(request,url) {
  const origin=request.headers.get("Origin");
  return request.headers.get("Sec-Fetch-Site")!=="cross-site" && (!origin || origin===url.origin);
}
const appOrigins = new Set(["https://app.yishu.invalid", "https://appassets.androidplatform.net"]);
const attemptWindow = 10 * 60_000;
let currentWindow = -1;
const attempts = new Map();

function allowAttempt(request) {
  const window = Math.floor(Date.now() / attemptWindow);
  if (window !== currentWindow) {
    currentWindow = window;
    attempts.clear();
  }
  const client = request.headers.get("CF-Connecting-IP");
  if (!client) return true;
  const count = attempts.get(client) ?? 0;
  if (count >= 10 || (count === 0 && attempts.size >= 4096)) return false;
  attempts.set(client, count + 1);
  return true;
}

async function exchangeSharedCode(code, env) {
  const expected = env.YISHU_SHARED_CODE_SHA256;
  if (!/^[a-f0-9]{64}$/.test(expected ?? "")) return {error:"unavailable", status:503};
  const actual = new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(code)));
  let mismatch = 0;
  for (const [index, byte] of actual.entries()) {
    mismatch |= byte ^ Number.parseInt(expected.slice(index * 2, index * 2 + 2), 16);
  }
  if (mismatch !== 0) return {error:"invalid_code", status:401};
  const codeGrant = env.YISHU_SHARED_GRANT;
  const token = await verifyAccessCode(codeGrant);
  return token ? {codeGrant, token} : {error:"unavailable", status:503};
}

async function traffic(request,env,url) {
  if (url.pathname==="/api/analytics") {
    if(request.method!=="GET") return sendJson({error:"method"},405,{Allow:"GET"});
    const supplied=request.headers.get("Authorization") ?? "";
    const expected=env.YISHU_ANALYTICS_KEY ? "Bearer "+env.YISHU_ANALYTICS_KEY : "";
    // Hash both values before comparing; the publisher key is never embedded in site assets.
    const [a,b]=await Promise.all([supplied,expected].map(value=>crypto.subtle.digest("SHA-256",encoder.encode(value))));
    let mismatch=0; const right=new Uint8Array(b);
    new Uint8Array(a).forEach((value,index)=>{mismatch|=value^right[index];});
    if(!expected||mismatch) return sendJson({error:"unauthorized"},401);
    if(!env.DB) return sendJson({error:"unavailable"},503);
    const since=new Date(Date.now()-29*86400000).toISOString().slice(0,10);
    const today=new Date().toISOString().slice(0,10);
    const results=await env.DB.batch([
      env.DB.prepare("SELECT day, SUM(views) AS views FROM visit_pages WHERE day >= ? GROUP BY day ORDER BY day DESC").bind(since),
      env.DB.prepare("SELECT day, COUNT(*) AS sessions FROM visit_sessions WHERE day >= ? GROUP BY day").bind(since),
      env.DB.prepare("SELECT page, SUM(views) AS views FROM visit_pages WHERE day >= ? GROUP BY page ORDER BY views DESC").bind(since),
    ]);
    const sessions=new Map(results[1].results.map(row=>[row.day,row.sessions]));
    const days=results[0].results.map(row=>({...row,sessions:sessions.get(row.day)??0}));
    return sendJson({views:days.reduce((n,row)=>n+row.views,0),sessions:[...sessions.values()].reduce((a,b)=>a+b,0),today:sessions.get(today)??0,days,pages:results[2].results});
  }
  if(request.method!=="POST") return sendJson({error:"method"},405,{Allow:"POST"});
  // Discard legacy visit requests without reading input or writing to storage.
  return new Response(null,{status:204,headers:{"Cache-Control":"no-store"}});
}

export default {
  async fetch(request, env = {}) {
    const url=new URL(request.url);
    let path=url.pathname;
    if(path==="/analytics.html"||path==="/analytics.js") return sendJson({error:"not_found"},404);
    if(path==="/api/visits"||path==="/api/analytics") {
      try{return await traffic(request,env,url);}catch{return sendJson({error:"unavailable"},503);}
    }
    if (path==="/vip/unlock" || path==="/vip/lock" || path==="/vip/redeem") {
      const redeem = path === "/vip/redeem";
      const origin = request.headers.get("Origin");
      if (redeem ? !appOrigins.has(origin) : !allowMutation(request,url)) return sendJson({error:"origin"},403);
      const cors = redeem ? {"Access-Control-Allow-Origin":origin, "Vary":"Origin"} : {};
      if (redeem && request.method === "OPTIONS") {
        return new Response(null,{status:204,headers:{...cors,"Access-Control-Allow-Methods":"POST","Access-Control-Allow-Headers":"Content-Type"}});
      }
      if (request.method!=="POST") return sendJson({error:"method"},405,{...cors,"Allow":"POST"});
      if (path==="/vip/lock") return sendJson({ok:true},200,{"Set-Cookie":sessionCookie("",0)});
      const code=await readCode(request);
      let codeGrant = code;
      let token = redeem ? null : await verifyAccessCode(code);
      if (!token) {
        if (!code || code.startsWith("YS1.")) return sendJson({error:"invalid_code"},401,cors);
        if (!allowAttempt(request)) return sendJson({error:"rate_limited"},429,{...cors,"Retry-After":"600"});
        // Existing deployments without a shared credential keep their original invalid-code response.
        if (!redeem && !env.YISHU_SHARED_CODE_SHA256) return sendJson({error:"invalid_code"},401);
        const exchange = await exchangeSharedCode(code, env);
        if (!exchange.token) return sendJson({error:exchange.error},exchange.status,cors);
        ({codeGrant, token} = exchange);
      }
      if (redeem) return sendJson({grant:codeGrant, expiresAt:token.exp},200,cors);
      return sendJson({expiresAt:token.exp},200,{"Set-Cookie":sessionCookie(codeGrant,token.exp-Math.floor(Date.now()/1000))});
    }
    if (request.method!=="GET" && request.method!=="HEAD") return sendJson({error:"method"},405,{"Allow":"GET, HEAD"});
    if (path==="/vip/session") {
      const token=await verifyAccessCode(readCookie(request));
      return token ? sendJson({expiresAt:token.exp}) : sendJson({error:"locked"},401);
    }
    const gated=path.startsWith("/vip-content/");
    if (gated && !await verifyAccessCode(readCookie(request))) return sendJson({error:"locked"},401);
    if (path==="/") path="/index.html";
    if (!Object.hasOwn(assets,path)) return sendJson({error:"not_found"},404);
    const [type,base64]=assets[path];
    const headers={"Content-Type":type,"Cache-Control":gated?"private, no-store":"no-cache","X-Content-Type-Options":"nosniff",
      "Referrer-Policy":"no-referrer"};
    if (gated) headers.Vary="Cookie";
    return new Response(request.method==="HEAD"?null:Uint8Array.from(atob(base64),character=>character.charCodeAt(0)),{headers});
  },
};
