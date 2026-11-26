const $=s=>document.querySelector(s);
let key='';
const names={plum:'Plum Blossom',coins:'Three coins',hours:'Traditional hours',library:'64 hexagrams',vip:'VIP tools',history:'History',settings:'Settings',downloads:'Downloads',privacy:'Privacy'};
function row(cells){const tr=document.createElement('tr'); for(const value of cells){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}return tr;}
async function refresh(){
  $('#status').textContent='Loading counts…';
  try{
    const response=await fetch('/api/analytics',{headers:{Authorization:'Bearer '+key},cache:'no-store'});
    if(!response.ok) throw new Error(response.status===401?'The dashboard key is incorrect.':response.status===503?'Traffic storage is not available yet.':'Unable to load counts. Try again.');
    const data=await response.json();
    $('#stats').hidden=false;
    $('#views').textContent=data.views;$('#sessions').textContent=data.sessions;$('#today').textContent=data.today;
    const daily=new Map(data.days.map(day=>[day.day,day]));
    const rows=[];
    for(let i=0;i<30;i++){const d=new Date();d.setUTCDate(d.getUTCDate()-i);const date=d.toISOString().slice(0,10),entry=daily.get(date);rows.push(row([date,entry?.sessions??0,entry?.views??0]));}
    $('#days').replaceChildren(...rows);
    $('#pages').replaceChildren(...data.pages.map(page=>row([names[page.page]??page.page,page.views])));
    $('#status').textContent='Updated '+new Date().toLocaleString()+'. Your key stays in memory only.';
  }catch(error){$('#stats').hidden=true;$('#status').textContent=error.message;}
}
$('#login').addEventListener('submit',event=>{event.preventDefault();key=$('#key').value.trim();$('#key').value='';refresh();});
$('#refresh').addEventListener('click',refresh);
$('#logout').addEventListener('click',()=>{key='';$('#key').value='';$('#stats').hidden=true;$('#status').textContent='Key cleared.';});
