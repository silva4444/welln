"use strict";
/* CODA 11.3: menos rolagem. Divide a aula em 4 etapas (abas) e as Turmas em abas.
   Não recria nada: só MOVE os blocos que o renderLesson() já gerou, então todos os
   botões, ids e eventos (atividade, exercício, anotações, concluir, vídeo) continuam iguais. */
(function(){
  const STEPS=[
    {label:"Entender",next:"Continuar: assistir e ler"},
    {label:"Assistir e ler",next:"Continuar: praticar"},
    {label:"Praticar",next:"Continuar: concluir a aula"},
    {label:"Concluir"}
  ];
  const reader=document.getElementById("lessonReader");
  let memory={key:"",tab:0};

  function fold(title,nodes,cls){
    const d=document.createElement("details");d.className="lt-fold "+(cls||"");
    const s=document.createElement("summary");s.textContent=title;d.appendChild(s);
    nodes.forEach(n=>d.appendChild(n));return d;
  }

  function buildLesson(){
    if(!reader||reader.querySelector(".lt-tabs")||!reader.querySelector(".lesson-lead"))return;
    const kids=[...reader.children];
    const head=[],buckets=[[],[],[],[]];let footer=null,b=0;
    kids.forEach(el=>{
      if(el.matches(".lesson-topline,h2,.lesson-lead,.lesson-goals")){head.push(el);return}
      if(el.matches(".lesson-nav")){footer=el;return}
      if(el.matches(".lesson-video-embed"))b=1;
      else if(el.matches(".code-example"))b=2;
      else if(el.matches(".formative-check"))b=3;
      buckets[b].push(el);
    });

    /* Blocos longos viram "dobráveis": continuam ali, só não ocupam a tela inteira */
    const roadmap=buckets[0].find(e=>e.matches(".lesson-roadmap"));
    const system=buckets[0].find(e=>e.matches(".system-example-card"));
    const resources=buckets[1].find(e=>e.matches(".academic-resources"));
    const place=(list,el,title,cls)=>{if(!el)return;const f=fold(title,[el],cls);list[list.indexOf(el)]=f};
    place(buckets[0],roadmap,"Pré-requisitos e objetivos");
    place(buckets[0],system,"Exemplo de sistema e o que a aula pede");
    if(resources){const n=resources.querySelectorAll(".academic-resource-grid a").length;place(buckets[1],resources,`Leitura complementar${n?` (${n} referências)`:""}`)}

    const key=(reader.querySelector(".lesson-breadcrumb")?.textContent||"")+"|"+(reader.querySelector("h2")?.textContent||"");
    if(memory.key!==key)memory={key,tab:0};

    const bar=document.createElement("div");bar.className="lt-tabs";bar.setAttribute("role","tablist");bar.setAttribute("aria-label","Etapas da aula");
    bar.innerHTML=STEPS.map((s,i)=>`<button type="button" role="tab" id="lt-tab-${i}" aria-controls="lt-panel-${i}" data-i="${i}"><b>${i+1}</b><span>${s.label}</span><i class="lt-ok" hidden>✓</i></button>`).join("");

    const panels=buckets.map((list,i)=>{
      const p=document.createElement("div");p.className="lt-panel";p.id="lt-panel-"+i;p.setAttribute("role","tabpanel");p.setAttribute("aria-labelledby","lt-tab-"+i);
      list.forEach(n=>p.appendChild(n));
      if(i===3&&footer)p.appendChild(footer);
      if(STEPS[i].next){const nb=document.createElement("button");nb.type="button";nb.className="lt-next primary";nb.dataset.go=String(i+1);nb.textContent=STEPS[i].next+" →";p.appendChild(nb)}
      return p;
    });

    reader.innerHTML="";
    head.forEach(n=>reader.appendChild(n));
    reader.appendChild(bar);panels.forEach(p=>reader.appendChild(p));

    function show(i,focus){
      memory.tab=i;
      bar.querySelectorAll("button").forEach((btn,n)=>{const on=n===i;btn.setAttribute("aria-selected",on);btn.tabIndex=on?0:-1;btn.classList.toggle("active",on);if(on&&focus)btn.focus()});
      panels.forEach((p,n)=>{p.hidden=n!==i});
      const top=bar.getBoundingClientRect().top;if(top<70){window.scrollTo({top:Math.max(0,window.scrollY+top-80),behavior:"smooth"})}
    }
    bar.addEventListener("click",e=>{const t=e.target.closest("button[data-i]");if(t)show(Number(t.dataset.i))});
    bar.addEventListener("keydown",e=>{
      const k={ArrowRight:1,ArrowLeft:-1}[e.key];if(!k)return;
      e.preventDefault();show((memory.tab+k+STEPS.length)%STEPS.length,true);
    });
    panels.forEach(p=>p.addEventListener("click",e=>{const g=e.target.closest(".lt-next");if(g)show(Number(g.dataset.go))}));
    show(memory.tab);refresh();
  }

  /* Marca ✓ nas etapas já cumpridas (lê o que o próprio renderLesson já mostra) */
  function refresh(){
    if(!reader)return;
    const set=(i,ok)=>{const m=reader.querySelector(`#lt-tab-${i} .lt-ok`);if(m)m.hidden=!ok};
    const st=reader.querySelectorAll(".lesson-unlock-status span");
    set(2,!!st[0]?.classList.contains("done"));
    set(3,!!reader.querySelector(".formative-check.mastered")&&!!st[0]?.classList.contains("done"));
  }

  if(reader){
    const mo=new MutationObserver(m=>{
      if(m.some(r=>r.type==="childList"&&r.target===reader)){mo.disconnect();buildLesson();watch()}
      else refresh();
    });
    const watch=()=>mo.observe(reader,{childList:true,subtree:true,attributes:true,attributeFilter:["class"]});
    watch();buildLesson();
    /* A atividade do laboratório é marcada fora desta tela; ao voltar para a aula, atualiza os ✓ */
    const cv=document.getElementById("curso");if(cv)new MutationObserver(refresh).observe(cv,{attributes:true,attributeFilter:["class"]});
  }

  /* Minhas turmas: 4 cartões empilhados viram 4 abas */
  const grid=document.querySelector("#turmas .student-platform-grid");
  if(grid){
    const cards=[...grid.children].filter(c=>c.classList.contains("platform-card"));
    const names=["Espaços","Atividades","Avisos","Dúvidas"];
    if(cards.length>1){
      const bar=document.createElement("div");bar.className="lt-tabs lt-tabs-flat";bar.setAttribute("role","tablist");
      bar.innerHTML=cards.map((c,i)=>`<button type="button" role="tab" data-i="${i}"><span>${names[i]||c.querySelector("h2")?.textContent||"Aba "+(i+1)}</span></button>`).join("");
      grid.parentNode.insertBefore(bar,grid);grid.classList.add("lt-grid");
      const show=i=>{cards.forEach((c,n)=>c.classList.toggle("lt-on",n===i));bar.querySelectorAll("button").forEach((b,n)=>{b.classList.toggle("active",n===i);b.setAttribute("aria-selected",n===i)})};
      bar.addEventListener("click",e=>{const t=e.target.closest("button[data-i]");if(t)show(Number(t.dataset.i))});
      show(0);
    }
  }
})();
