import{n as T,l as Q}from"./games-GLfk631x.js";import{g as w}from"./index-BQ5uUdow.js";const L=b=>b.map(n=>[Math.random(),n]).sort((n,u)=>n[0]-u[0]).map(n=>n[1]);function W(b,n,u){const h=n.items,f=L(h).slice(0,n.rounds>0?n.rounds:h.length),M=f.length,q=new Map;for(const e of h)for(const s of e.answers)q.set(T(s),e);const c=document.createElement("div");c.className="fg",c.innerHTML=`
    <div class="gm-hud fg-hud">
      <div class="gm-stats"><span class="fg-score"></span><span class="fg-time">0:00</span></div>
      <div class="fg-stage">
        <div class="fg-flag"></div>
        <div class="fg-choices"></div>
        <form class="fg-type" autocomplete="off"><input class="gm-input" type="text" placeholder="${w(n.placeholder)}" autocapitalize="off" autocorrect="off" spellcheck="false" /><button class="btn btn-primary" type="submit">OK</button></form>
        <div class="gm-feedback" aria-live="polite"></div>
        <button class="btn btn-primary fg-next" type="button" hidden>Weiter</button>
      </div>
      <div class="gm-actions">
        <button class="btn fg-skip" type="button">Überspringen</button>
        <button class="btn fg-giveup" type="button">Aufgeben</button>
        <button class="btn fg-menu" type="button">Menü</button>
      </div>
    </div>`,b.append(c);const i=e=>c.querySelector(e),R=i(".fg-flag"),v=i(".fg-choices"),H=i(".fg-type"),g=i(".gm-input"),A=i(".gm-feedback"),$=i(".fg-next");v.hidden=n.mode!=="choice",H.hidden=n.mode!=="type";let y=0,D=0,p=0,x=0,r=!0,k=0;const N=Date.now(),d=[];let t=null;const G=()=>{const e=Math.floor((Date.now()-N)/1e3);i(".fg-time").textContent=`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`},j=window.setInterval(G,500),C=()=>{i(".fg-score").textContent=`${D} / ${M} · ${y} richtig${p>1?` · 🔥 ${p}`:""}`},S=(e,s="")=>{A.textContent=e,A.className=`gm-feedback ${s}`};function m(){if(clearTimeout(k),t=f.shift()??null,!t)return z();if(r=!1,R.innerHTML=t.prompt,C(),S(""),$.hidden=!0,n.mode==="choice"){const e=h.filter(o=>o!==t&&o.label!==t.label),s=L(e.filter(o=>o.group===t.group)),a=L(e.filter(o=>o.group!==t.group)),l=[];for(const o of[...s,...a])l.length<3&&!l.some(K=>K.label===o.label)&&l.push(o);const E=L([t,...l]);v.innerHTML=E.map(o=>`<button type="button" class="btn fg-opt" data-id="${w(o.id)}">${w(o.label)}</button>`).join("")}else g.value="",g.disabled=!1,g.focus()}function I(e,s){r||!t||(r=!0,D++,e?(y++,p++,x=Math.max(x,p),S(`Richtig: ${t.label}`,"ok")):(p=0,d.push(t),S(`Richtig wäre: ${t.label}`,"bad")),C(),n.mode==="choice"?v.querySelectorAll(".fg-opt").forEach(a=>{a.disabled=!0,a.dataset.id===t.id?a.classList.add("right"):a.dataset.id===s&&a.classList.add("wrong")}):g.disabled=!0,e?k=window.setTimeout(m,700):($.hidden=!1,$.focus()))}v.addEventListener("click",e=>{const s=e.target.closest(".fg-opt");s&&t&&I(s.dataset.id===t.id,s.dataset.id)}),H.addEventListener("submit",e=>{if(e.preventDefault(),r)return m();if(!t)return;const s=T(g.value);if(!s)return;const a=q.get(s);let l=a===t;!l&&!a&&s.length>=6&&(l=t.answers.some(E=>Q(s,T(E))<=1)),I(l)}),$.addEventListener("click",m),i(".fg-skip").addEventListener("click",()=>{r||!t||(f.push(t),m())}),i(".fg-giveup").addEventListener("click",()=>{t&&!r&&d.push(t),d.push(...f),f.length=0,z(!0)}),i(".fg-menu").addEventListener("click",u);function z(e=!1){clearTimeout(k),clearInterval(j);const s=Math.round((Date.now()-N)/1e3);c.innerHTML=`
      <div class="gm-result">
        <h2>${e?"Aufgegeben":"Geschafft!"}</h2>
        <div class="gm-big">${y} / ${M} <span>(${Math.round(y/M*100)} %)</span></div>
        <p>Zeit ${Math.floor(s/60)}:${String(s%60).padStart(2,"0")} · längste Serie ${x}</p>
        ${d.length?`<details open><summary>${d.length} nicht gewusst</summary><p class="gm-missed">${d.map(a=>`<span class="fg-miss">${a.thumb??""}${w(a.label)}</span>`).join(" · ")}</p></details>`:""}
        <div class="gm-actions"><button class="btn btn-primary fg-again" type="button">Nochmal</button><button class="btn fg-menu" type="button">Menü</button></div>
      </div>`,c.querySelector(".fg-again").addEventListener("click",()=>{B(),Object.assign(O,W(b,n,u))}),c.querySelector(".fg-menu").addEventListener("click",u)}function B(){clearTimeout(k),clearInterval(j),c.remove()}const O={destroy:B};return m(),O}export{W as startNameQuiz};
