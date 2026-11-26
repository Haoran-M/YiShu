import {trackPage} from './tracking.js';
const button=document.querySelector('#toggle'),status=document.querySelector('#status');
function update(){try{const off=localStorage.getItem('yishu:tracking-opt-out')==='1';button.textContent=off?'Allow anonymous visit counting':'Turn off anonymous visit counting';status.textContent=off?'Visit counting is off for this browser.':'Anonymous visit counting is allowed, subject to your browser privacy settings.';}catch{button.disabled=true;status.textContent='Browser storage is blocked. Session counting is unavailable.';}}
button.addEventListener('click',()=>{try{const off=localStorage.getItem('yishu:tracking-opt-out')==='1';localStorage.setItem('yishu:tracking-opt-out',off?'0':'1');update();}catch{update();}});update();trackPage('privacy');
