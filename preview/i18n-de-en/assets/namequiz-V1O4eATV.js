import{n as q,l as J}from"./games-DFTdHvT_.js";import{g as L,t as a}from"./index-D06yRH_8.js";const M=h=>h.map(n=>[Math.random(),n]).sort((n,g)=>n[0]-g[0]).map(n=>n[1]);function K(h,n,g){const v=n.items,f=M(v).slice(0,n.rounds>0?n.rounds:v.length),x=f.length,C=new Map;for(const e of v)for(const s of e.answers)C.set(q(s),e);const c=document.createElement("div");c.className="fg",c.innerHTML=`
    <div class="gm-hud fg-hud">
      <div class="gm-stats"><span class="fg-score"></span><span class="fg-time">0:00</span></div>
      <div class="fg-stage">
        <div class="fg-flag"></div>
        <div class="fg-choices"></div>
        <form class="fg-type" autocomplete="off"><input class="gm-input" type="text" placeholder="${L(n.placeholder)}" autocapitalize="off" autocorrect="off" spellcheck="false" /><button class="btn btn-primary" type="submit">${a("games.ok")}</button></form>
        <div class="gm-feedback" aria-live="polite"></div>
        <button class="btn btn-primary fg-next" type="button" hidden>${a("games.next")}</button>
      </div>
      <div class="gm-actions">
        <button class="btn fg-skip" type="button">${a("games.skip")}</button>
        <button class="btn fg-giveup" type="button">${a("games.giveUp")}</button>
        <button class="btn fg-menu" type="button">${a("games.menu")}</button>
      </div>
    </div>`,h.append(c);const l=e=>c.querySelector(e),Q=l(".fg-flag"),$=l(".fg-choices"),H=l(".fg-type"),m=l(".gm-input"),D=l(".gm-feedback"),y=l(".fg-next");$.hidden=n.mode!=="choice",H.hidden=n.mode!=="type";let k=0,j=0,p=0,S=0,d=!0,w=0;const B=Date.now(),u=[];let t=null;const F=()=>{const e=Math.floor((Date.now()-B)/1e3);l(".fg-time").textContent=`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`},I=window.setInterval(F,500),N=()=>{l(".fg-score").textContent=`${j} / ${x} · ${a("games.rightCount",{count:k})}${p>1?` · 🔥 ${p}`:""}`},E=(e,s="")=>{D.textContent=e,D.className=`gm-feedback ${s}`};function b(){if(clearTimeout(w),t=f.shift()??null,!t)return A();if(d=!1,Q.innerHTML=t.prompt,N(),E(""),y.hidden=!0,n.mode==="choice"){const e=v.filter(i=>i!==t&&i.label!==t.label),s=M(e.filter(i=>i.group===t.group)),o=M(e.filter(i=>i.group!==t.group)),r=[];for(const i of[...s,...o])r.length<3&&!r.some(G=>G.label===i.label)&&r.push(i);const T=M([t,...r]);$.innerHTML=T.map(i=>`<button type="button" class="btn fg-opt" data-id="${L(i.id)}">${L(i.label)}</button>`).join("")}else m.value="",m.disabled=!1,m.focus()}function z(e,s){d||!t||(d=!0,j++,e?(k++,p++,S=Math.max(S,p),E(a("games.correct",{name:t.label}),"ok")):(p=0,u.push(t),E(a("games.wouldBe",{name:t.label}),"bad")),N(),n.mode==="choice"?$.querySelectorAll(".fg-opt").forEach(o=>{o.disabled=!0,o.dataset.id===t.id?o.classList.add("right"):o.dataset.id===s&&o.classList.add("wrong")}):m.disabled=!0,e?w=window.setTimeout(b,700):(y.hidden=!1,y.focus()))}$.addEventListener("click",e=>{const s=e.target.closest(".fg-opt");s&&t&&z(s.dataset.id===t.id,s.dataset.id)}),H.addEventListener("submit",e=>{if(e.preventDefault(),d)return b();if(!t)return;const s=q(m.value);if(!s)return;const o=C.get(s);let r=o===t;!r&&!o&&s.length>=6&&(r=t.answers.some(T=>J(s,q(T))<=1)),z(r)}),y.addEventListener("click",b),l(".fg-skip").addEventListener("click",()=>{d||!t||(f.push(t),b())}),l(".fg-giveup").addEventListener("click",()=>{t&&!d&&u.push(t),u.push(...f),f.length=0,A(!0)}),l(".fg-menu").addEventListener("click",g);function A(e=!1){clearTimeout(w),clearInterval(I);const s=Math.round((Date.now()-B)/1e3);c.innerHTML=`
      <div class="gm-result">
        <h2>${e?a("games.gaveUp"):a("games.done")}</h2>
        <div class="gm-big">${k} / ${x} <span>(${Math.round(k/x*100)} %)</span></div>
        <p>${a("games.timeShort",{when:`${Math.floor(s/60)}:${String(s%60).padStart(2,"0")}`})} · ${a("games.longestStreak",{n:S})}</p>
        ${u.length?`<details open><summary>${a("games.missedCount",{count:u.length})}</summary><p class="gm-missed">${u.map(o=>`<span class="fg-miss">${o.thumb??""}${L(o.label)}</span>`).join(" · ")}</p></details>`:""}
        <div class="gm-actions"><button class="btn btn-primary fg-again" type="button">${a("games.again")}</button><button class="btn fg-menu" type="button">${a("games.menu")}</button></div>
      </div>`,c.querySelector(".fg-again").addEventListener("click",()=>{U(),Object.assign(O,K(h,n,g))}),c.querySelector(".fg-menu").addEventListener("click",g)}function U(){clearTimeout(w),clearInterval(I),c.remove()}const O={destroy:U};return b(),O}export{K as startNameQuiz};
