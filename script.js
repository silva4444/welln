"use strict";

(function loadCodaModules(){
  const baseModules=[
    "js/utils.js","js/state.js","js/analytics.js","js/workspace-sync.js","js/render/courses.js","js/render/dashboard.js","js/login.js","js/pdf-reports.js","js/lessons.js","js/laboratory.js","js/esp32.js","js/esp32-circuit-logic.js","js/esp32-ar-lab-core.js"
  ];
  const threeDModules=["js/vendor/three-r128.min.js","js/esp32-model.js","js/esp32-software.js","js/esp32-3d.js","js/circuit-3d.js"];
  const tailModules=["js/lesson-videos.js","js/esp32-ar.js","js/esp32-ar-lab.js","js/esp32-firmware.js","js/tutor.js","js/institution.js","js/core.js"];
  const esModules=new Set(["js/state.js","js/analytics.js","js/workspace-sync.js","js/render/courses.js","js/render/dashboard.js","js/esp32-circuit-logic.js","js/esp32-ar-lab-core.js"]);
  const load=src=>src==="js/utils.js"&&window.CodaUtils?Promise.resolve():new Promise((resolve,reject)=>{const node=document.createElement("script");if(esModules.has(src))node.type="module";node.src=`${src}?v=14.6.0`;node.onload=resolve;node.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));document.body.appendChild(node)});
  (async()=>{
    await (window.CodaDeviceMode?.ready || Promise.resolve("desktop"));
    const modules=[...baseModules,...threeDModules,...tailModules];
    for(const src of modules)await load(src);
  })().catch(error=>{console.error(error);const toast=document.getElementById("toast");if(toast){toast.textContent="Não foi possível iniciar todos os módulos da Coda.";toast.classList.add("show")}});
})();
