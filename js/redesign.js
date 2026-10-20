"use strict";
(function(){
  const P={home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',book:'<path d="M2 4h7a3 3 0 013 3v13a2 2 0 00-2-2H2z"/><path d="M22 4h-7a3 3 0 00-3 3v13a2 2 0 012-2h8z"/>',code:'<path d="M8 7l-5 5 5 5"/><path d="M16 7l5 5-5 5"/><path d="M14 4l-4 16"/>',users:'<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6"/><path d="M16 4.5a3.5 3.5 0 010 7M18 14c2.5.6 4 2.6 4 6"/>',chat:'<path d="M21 12a8 8 0 01-11.6 7.1L3 21l1.9-5.4A8 8 0 1121 12z"/>',grid:'<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"/>',clip:'<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4h6v3H9zM9 12h6M9 16h4"/>',pen:'<path d="M4 20l4-1 11-11-3-3L5 16z"/>',target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',check:'<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M8 12l3 3 5-6"/>',cube:'<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',building:'<rect x="4" y="3" width="16" height="18"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 21v-4h4v4"/>',cap:'<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 3 3 6 3s6-1.5 6-3v-5"/>',bars:'<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>'};
  const byKey={overview:'grid',classes:'users',students:'user',diary:'clip',questions:'chat',content:'pen',challenges:'target',assessments:'check',lab3d:'cube',database:'db',institution:'building',users:'users',social:'chat',academics:'cap',indicators:'bars',privacy:'shield'};
  document.querySelectorAll('.nav button').forEach(b=>{
    const k=b.dataset.icon||byKey[b.dataset.teacherSection||b.dataset.adminSection];
    const i=b.querySelector('i');if(i&&P[k])i.innerHTML=`<svg viewBox="0 0 24 24" aria-hidden="true">${P[k]}</svg>`;
  });
  const S='<svg viewBox="0 0 24 24" aria-hidden="true">';
  const sr=document.querySelector('.search>span');if(sr)sr.innerHTML=S+'<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>';
  const nb=document.querySelector('#notificationButton');
  if(nb&&nb.firstChild&&nb.firstChild.nodeType===3)nb.firstChild.replaceWith(Object.assign(document.createElement('span'),{innerHTML:S+'<path d="M6 9a6 6 0 0112 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 004 0"/></svg>'}));
  const G={inicio:'inicio','meu-espaco':'inicio',materias:'aprender',curso:'aprender',videos:'aprender',quiz:'aprender',laboratorio:'praticar',esp32:'praticar',turmas:'turmas',agenda:'turmas',comunidade:'comunidade'};
  const MAIN={inicio:'inicio',aprender:'materias',praticar:'laboratorio',turmas:'turmas',comunidade:'comunidade'};
  function sync(){
    const v=document.querySelector('.view.active');if(!v)return;
    const g=G[v.id]||'';document.body.dataset.group=g;
    const cur=v.id==='curso'?'materias':v.id;
    document.querySelectorAll('#subnav button').forEach(b=>b.classList.toggle('active',b.dataset.view===cur));
    document.querySelectorAll('.student-navigation button[data-view]').forEach(b=>{
      const on=g&&b.dataset.view===MAIN[g];b.classList.toggle('active',!!on);
      if(on)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
    document.querySelectorAll('.nav button b[id]').forEach(b=>{b.hidden=!b.textContent.trim()||b.textContent.trim()==='0'});
  }
  const c=document.querySelector('.content');
  if(c)new MutationObserver(sync).observe(c,{subtree:true,attributes:true,attributeFilter:['class']});
  document.querySelectorAll('.nav b[id]').forEach(b=>new MutationObserver(sync).observe(b,{childList:true,characterData:true,subtree:true}));
  sync();
})();
