const nativeApp=Boolean(window.chrome?.webview)||location.hostname==='appassets.androidplatform.net';
let lastPage='';
export function trackPage(page){
  if(nativeApp||!/^https?:$/.test(location.protocol)||navigator.doNotTrack==='1'||navigator.globalPrivacyControl||page===lastPage) return;
  lastPage=page;
  try {
    if(localStorage.getItem('yishu:tracking-opt-out')==='1') return;
    const now=Date.now();
    let session=JSON.parse(sessionStorage.getItem('yishu:visit-session')||'null');
    if(!session||now-session.last>30*60*1000) session={id:crypto.randomUUID(),last:now};
    session.last=now;
    sessionStorage.setItem('yishu:visit-session',JSON.stringify(session));
    fetch('/api/visits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page,session:session.id}),keepalive:true}).catch(()=>{});
  } catch { /* Storage-blocked browsers are excluded from session counting. */ }
}
