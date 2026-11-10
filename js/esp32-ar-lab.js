(() => {
  "use strict";

  // A interface de RA usa a câmera como fundo e o renderizador ESP32 existente.
  // O código Arduino é interpretado de forma restrita e determinística; não é firmware real.
  const $ = id => document.getElementById(id);
  const core = window.CodaARLabCore;
  const circuitLogic = window.CodaEsp32CircuitLogic;
  if (!core || !circuitLogic) return;

  const STORAGE = "coda_mobile_ar_lab_v1";
  const allowedPins = [...window.CodaESP32Runtime.OUTPUT_GPIO];
  const boardNodes = [...new Set([...window.CodaESPModel.left,...window.CodaESPModel.right])].filter(pin=>!window.CodaESPModel.reserved.has(pin));
  let circuit = { components: [], wires: [] };
  let code = core.DEMO;
  let selected = null;
  let running = false, timer = 0, cursor = 0, instructions = [], outputs = {};
  let panel = "view", boardPinsExpanded = false;
  const preferredPins = new Set(["GND","3V3","VIN","GPIO2","GPIO4","GPIO5","GPIO18","GPIO19","GPIO21","GPIO22","GPIO23","GPIO34"]);
  const runtime=core.createRuntime({onState(snapshot){outputs=snapshot.outputs;running=snapshot.running;window.CodaAR?.state?.mobile?.renderer?.setHardware?.(snapshot);redraw();},onSerial(message){const node=$("mobileARSerial");if(node){const line=document.createElement("div");line.textContent=message;node.append(line);if(node.children.length>60)node.firstChild.remove();node.scrollTop=node.scrollHeight;}},onError(error){feedback(error.message,"mobileARProgramStatus");}});

  function feedback(text, target="mobileARWiringStatus") { if ($(target)) $(target).textContent = text; }
  function save() {
    try { localStorage.setItem(STORAGE, JSON.stringify({ circuit, code })); } catch {}
  }
  function restore() {
    try {
      const saved=JSON.parse(localStorage.getItem(STORAGE)||"null");
      if (saved && Array.isArray(saved.circuit?.components) && Array.isArray(saved.circuit?.wires)) {
        const valid=saved.circuit.components.filter(p=>/^(LED|R|POT|BTN)[1-4]$/.test(String(p.id)) && ["led","resistor","potentiometer","button"].includes(p.type));
        circuit={components:valid.slice(0,16).map(p=>({ ...p, id:String(p.id), pin:p.type==="potentiometer"?"GPIO34":allowedPins.includes(Number(String(p.pin).replace("GPIO",""))) ? p.pin : p.type==="button"?"GPIO4":"GPIO2" })),wires:saved.circuit.wires.filter(w=>Array.isArray(w)&&w.length===2&&w.every(v=>typeof v==="string"&&v.length<50)).slice(0,40)};
        if (typeof saved.code === "string" && saved.code.length<=12000) code=saved.code;
      }
    } catch {}
  }
  function mode(next) {
    panel=next;
    for (const btn of document.querySelectorAll("[data-mobile-ar-tool]")) {
      btn.classList.toggle("active",btn.dataset.mobileArTool===next);
      btn.setAttribute("aria-pressed",String(btn.dataset.mobileArTool===next));
    }
    if ($("mobileARWiresPanel")) $("mobileARWiresPanel").hidden=next!=="wires";
    if ($("mobileARCodePanel")) $("mobileARCodePanel").hidden=next!=="code";
    if ($("mobileARViewHelp")) $("mobileARViewHelp").hidden=next!=="view";
    $("mobileAROverlay")?.setAttribute("data-tool",next);
    // A bancada permanece no mesmo lugar e conserva o estado entre abas.
  }
  function redraw() {
    const ledState=core.simulateLedStates(circuit,outputs);
    window.CodaAR?.state?.mobile?.renderer?.setCircuit?.({ ...circuit, lit: ledState });
    const leds=circuit.components.filter(p=>p.type==="led");
    const lit=leds.filter(p=>ledState[p.id]).length;
    if ($("mobileARLedStatus")) $("mobileARLedStatus").textContent = !leds.length ? "💡 Adicione um LED e ligue os fios" : `💡 ${lit}/${leds.length} LED(s) acesos · ${running ? "▶ simulando" : "■ parado"}`;
    return ledState;
  }
  function chooseTerminal(node) {
    if (!selected) {
      selected=node; feedback(`Primeiro terminal: ${node}. Toque no segundo terminal para conectar.`);
      paintSelection(); return;
    }
    if (selected===node) {
      selected=null; feedback("Seleção cancelada. Escolha um terminal.");paintSelection();return;
    }
    const a=selected; selected=null;
    if (circuit.wires.some(w=>(w[0]===a&&w[1]===node)||(w[0]===node&&w[1]===a))) {
      feedback("Esse fio já está conectado.");paintSelection();return;
    }
    circuit.wires.push([a,node]);
    stopSimulation(false); save(); renderControls(); redraw();
    const result=circuitLogic.evaluateCircuit(circuit);
    feedback(`${a} ↔ ${node}. ${result.message}`);
  }
  function paintSelection() {
    document.querySelectorAll("[data-ar-endpoint]").forEach(button=>{
      const active=button.dataset.arEndpoint===selected;
      button.dataset.selected=String(active);
      button.setAttribute("aria-pressed",String(active));
    });
  }
  function endpointButton(node,label,parent) {
    const btn=document.createElement("button");
    btn.type="button";btn.className="endpoint";btn.textContent=label;
    btn.dataset.arEndpoint=node;btn.addEventListener("click",()=>chooseTerminal(node));
    parent.appendChild(btn);
  }
  function renderControls() {
    const board=$("mobileARBoardTerminals"), parts=$("mobileARPartTerminals"), wires=$("mobileARWireList");
    if (!board || !parts || !wires) return;
    board.replaceChildren();parts.replaceChildren();wires.replaceChildren();
    boardNodes.filter(pin=>boardPinsExpanded||preferredPins.has(pin)).forEach(pin=>endpointButton(`ESP32:${pin}`,pin,board));
    const expandPins=$("mobileARShowAllPins");
    if(expandPins){expandPins.textContent=boardPinsExpanded?"Menos pinos ▲":"Mostrar todos os pinos ▼";expandPins.setAttribute("aria-expanded",String(boardPinsExpanded));}
    for (const part of circuit.components) {
      const item=document.createElement("div");item.className="mobile-ar-part";
      const title=document.createElement("div");title.className="mobile-ar-part-title";
      const name=document.createElement("strong");name.textContent=part.type==="led" ? `💡 ${part.id} (A = ânodo, B = cátodo)`:part.type==="resistor"?`▰ ${part.id} • 220 Ω`:part.type==="potentiometer"?`${part.id} • potenciômetro`:`${part.id} • botão`;
      if(part.type==="potentiometer"){
        const range=document.createElement("input");range.type="range";range.min=0;range.max=4095;range.value=part.value??2048;range.setAttribute("aria-label",`Valor de ${part.id}`);range.oninput=()=>{part.value=Number(range.value);runtime.setAnalog(34,part.value);save();};item.append(range);
      }
      if(part.type==="button"){
        const press=document.createElement("button");press.textContent="Pressionar / soltar";press.onclick=()=>{part.active=!part.active;runtime.setDigital(4,part.active?0:1);press.setAttribute("aria-pressed",String(part.active));save();redraw();};item.append(press);
      }
      title.append(name);
      if (part.type==="led") {
        const pin=document.createElement("select");pin.setAttribute("aria-label",`GPIO de ${part.id}`);
        allowedPins.forEach(n=>{const op=document.createElement("option");op.value=`GPIO${n}`;op.textContent=`GPIO${n}`;pin.append(op)});
        pin.value=part.pin||"GPIO2";
        pin.addEventListener("change",()=>{part.pin=pin.value;stopSimulation(false);save();redraw();feedback(`O ${part.id} está configurado para ${pin.value}. Ligue-o a este GPIO usando um resistor.`)});
        title.append(pin);
      }
      const del=document.createElement("button");del.type="button";del.textContent="Remover";
      del.addEventListener("click",()=>{
        stopSimulation(false);circuit.components=circuit.components.filter(x=>x!==part);
        circuit.wires=circuit.wires.filter(w=>w.every(v=>!v.startsWith(`${part.id}:`)));
        selected=null;save();renderControls();redraw();feedback(`${part.id} removido.`);
      });title.append(del);item.append(title);
      const endpoints=document.createElement("div");endpoints.className="mobile-ar-part-buttons";
      const terminals=part.type==="potentiometer"?["VCC","SIG","GND"]:part.type==="button"?["1","2"]:["A","B"];
      terminals.forEach(pin=>endpointButton(`${part.id}:${pin}`,part.type==="led"?(pin==="A"?"A (+)":"B (−)"):pin,endpoints));
      const fine=document.createElement("details");fine.className="mobile-ar-fine-adjust";
      const summary=document.createElement("summary");summary.textContent="Ajustar posição manualmente";fine.append(summary);
      const axes=document.createElement("div");axes.className="mobile-ar-fine-axes";
      for(const [axis,min,max] of [["x",1.2,3.1],["z",-1.4,1.4]]){
        const label=document.createElement("label");label.textContent=axis==="x"?"Horizontal":"Profundidade";
        const range=document.createElement("input");range.type="range";range.min=min;range.max=max;range.step=.05;range.value=part[axis]??(axis==="x"?1.8:0);range.setAttribute("aria-label",`Posição ${axis.toUpperCase()} de ${part.id}`);range.oninput=()=>{part[axis]=Number(range.value);save();redraw();};
        label.append(range);axes.append(label);
      }
      fine.append(axes);item.append(fine);
      item.append(endpoints);parts.append(item);
    }
    circuit.wires.forEach((wire,index)=>{
      const row=document.createElement("div");
      const label=document.createElement("span");label.textContent=`${index+1}. ${wire[0]} ↔ ${wire[1]}`;
      const del=document.createElement("button");del.type="button";del.textContent="×";del.setAttribute("aria-label",`Excluir fio ${index+1}`);
      del.addEventListener("click",()=>{stopSimulation(false);circuit.wires.splice(index,1);save();renderControls();redraw()});
      row.append(label,del);wires.append(row);
    });
    if (!circuit.wires.length) wires.textContent="Nenhum fio conectado.";
    paintSelection();
  }
  function nextId(type) {
    const prefix=({led:"LED",resistor:"R",potentiometer:"POT",button:"BTN"})[type];
    for(let n=1;n<=4;n++) if(!circuit.components.some(p=>p.id===`${prefix}${n}`)) return `${prefix}${n}`;
    return null;
  }
  function addComponent(type) {
    const id=nextId(type);
    if (!id) { feedback(`Limite de quatro ${type==="led"?"LEDs":"resistores"} por bancada.`);return; }
    stopSimulation(false);
    const offset=Number(id.replace(/\D/g,""))-1;
    const part=type==="led"?
      {id,type,pin:"GPIO2",color:["#ff5252","#ffcc4d","#4cf5ab","#54bcff"][offset],x:1.78,z:-.93+offset*.62}:
      type==="resistor"?{id,type,ohms:220,value:100,x:2.32,z:-.93+offset*.62}:
      {id,type,pin:type==="potentiometer"?"GPIO34":"GPIO4",value:type==="potentiometer"?2048:0,x:2.32,z:-.93+offset*.62};
    circuit.components.push(part);save();renderControls();redraw();feedback(`${id} adicionado. Toque em A/B e nos pinos do ESP32 para montar os fios.`);
  }
  function example() {
    stopSimulation(false);const built=core.makeExample();circuit={components:built.components,wires:built.wires};code=built.code;
    if ($("mobileARCode")) $("mobileARCode").value=code;
    selected=null;save();renderControls();redraw();feedback("Exemplo pronto: GPIO2 → R1 (220 Ω) → LED1 → GND. Abra Programar e toque em Simular.");
  }
  function stopSimulation(show=true) {
    runtime.stop();outputs={};running=false;
    if(show)feedback("Simulação parada. Os LEDs estão desligados.","mobileARProgramStatus");
    redraw();
  }
  function verifySketch(){
    code=$("mobileARCode")?.value||"";
    try{
      if(!code.trim())throw new Error("Escreva um sketch antes de verificar.");
      const result=core.parseArduino(code);
      const check=circuitLogic.evaluateCircuit(circuit);
      feedback(check.faults.length?`⚠ Código interpretado, mas há problema no circuito: ${check.message}`:"✓ Código reconhecido pelo simulador. Você já pode executar.","mobileARProgramStatus");
      return !check.faults.length;
    }catch(error){feedback(`⚠ ${error.message}`,"mobileARProgramStatus");return false;}
  }
  function saveSketch(){
    code=$("mobileARCode")?.value||"";save();
    const url=URL.createObjectURL(new Blob([code],{type:"text/plain;charset=utf-8"}));
    const link=document.createElement("a");link.href=url;link.download="CODA_ESP32_RA.ino";document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    feedback("Sketch salvo como CODA_ESP32_RA.ino.","mobileARProgramStatus");
  }
  async function openSketch(event){
    const file=event.target.files?.[0];if(!file)return;
    if(file.size>12000){feedback("⚠ O arquivo deve ter no máximo 12 KB.","mobileARProgramStatus");event.target.value="";return;}
    try{stopSimulation(false);code=await file.text();$("mobileARCode").value=code;save();feedback(`${file.name} aberto. Confira e execute o código.`,"mobileARProgramStatus");}
    catch{feedback("Não foi possível ler o arquivo .ino.","mobileARProgramStatus");}
    event.target.value="";
  }
  function simulate() {
    stopSimulation(false);code=$("mobileARCode")?.value||"";save();
    try {
      core.parseArduino(code);
      const check=circuitLogic.evaluateCircuit(circuit);
      if(check.faults.length)throw new Error(check.message);
      runtime.setAnalog(34,Number($("mobileARPot")?.value||2048));
      runtime.start(code);
      feedback("Sketch executando: LED integrado no GPIO2, entradas e monitor serial ativos. LEDs externos precisam de resistor e GND.","mobileARProgramStatus");
    }catch(error){feedback(`⚠ ${error.message}`,"mobileARProgramStatus");redraw();}
  }
  function bind() {
    restore();
    if (!circuit.components.length) {const built=core.makeExample();circuit={components:built.components,wires:built.wires};code=built.code;}
    if ($("mobileARCode")) $("mobileARCode").value=code;
    $("mobileARCode")?.addEventListener("input",()=>{code=$("mobileARCode").value;save();});
    document.querySelectorAll("[data-mobile-ar-tool]").forEach(btn=>btn.addEventListener("click",()=>mode(btn.dataset.mobileArTool)));
    $("mobileARAddLED")?.addEventListener("click",()=>addComponent("led"));
    $("mobileARAddPot")?.addEventListener("click",()=>addComponent("potentiometer"));
    $("mobileARAddButton")?.addEventListener("click",()=>addComponent("button"));
    $("mobileARAnalogExample")?.addEventListener("click",()=>{stopSimulation(false);code=core.ANALOG_DEMO;$("mobileARCode").value=code;save();feedback("Potenciômetro no GPIO34 e LED integrado GPIO2. Toque em Simular.","mobileARProgramStatus");});
    $("mobileARPot")?.addEventListener("input",event=>{const value=Number(event.target.value);runtime.setAnalog(34,value);$("mobileARPotValue").textContent=`${value} / 4095`;});
    $("mobileARResetEN")?.addEventListener("click",()=>{if(running)runtime.reset();else runtime.stop();});
    const boot=$("mobileARBoot");if(boot){boot.onpointerdown=event=>{event.preventDefault();boot.setPointerCapture(event.pointerId);runtime.setBoot(true);};boot.onpointerup=boot.onpointercancel=boot.onlostpointercapture=()=>runtime.setBoot(false);boot.onkeydown=event=>{if(event.key===" "||event.key==="Enter"){event.preventDefault();runtime.setBoot(true);}};boot.onkeyup=()=>runtime.setBoot(false);boot.onblur=()=>runtime.setBoot(false);}
    window.addEventListener("coda-hardware-action",event=>{if(event.detail.canvasId!=="mobileARCanvas")return;if(event.detail.action==="EN"){if(running)runtime.reset();}else{runtime.setBoot(true);setTimeout(()=>runtime.setBoot(false),300);}});
    $("mobileARCode")?.addEventListener("input",()=>{if(running)stopSimulation(false);});
    $("mobileARAddResistor")?.addEventListener("click",()=>addComponent("resistor"));
    $("mobileARExample")?.addEventListener("click",example);
    $("mobileARRestoreExample")?.addEventListener("click",()=>{code=core.DEMO;$("mobileARCode").value=code;save();feedback("Código exemplo restaurado.","mobileARProgramStatus");});
    $("mobileARUndoWire")?.addEventListener("click",()=>{stopSimulation(false);circuit.wires.pop();save();renderControls();redraw();});
    $("mobileARClearCircuit")?.addEventListener("click",()=>{stopSimulation(false);circuit={components:[],wires:[]};selected=null;save();renderControls();redraw();});
    $("mobileARPlay")?.addEventListener("click",simulate);
    $("mobileARVerify")?.addEventListener("click",verifySketch);
    $("mobileARQuickRun")?.addEventListener("click",()=>{mode("code");simulate();});
    $("mobileARQuickAdd")?.addEventListener("click",()=>{addComponent("led");mode("wires");});
    $("mobileARShowAllPins")?.addEventListener("click",()=>{boardPinsExpanded=!boardPinsExpanded;renderControls();});
    $("mobileARSaveINO")?.addEventListener("click",saveSketch);
    $("mobileAROpenINO")?.addEventListener("click",()=>$("mobileARINOFile")?.click());
    $("mobileARINOFile")?.addEventListener("change",openSketch);
    window.addEventListener("coda-ar-component-move",event=>{
      const {id,x,z,done}=event.detail||{};
      const item=circuit.components.find(p=>p.id===id);
      if(!item||!Number.isFinite(x)||!Number.isFinite(z))return;
      item.x=x;item.z=z;
      if(done){save();redraw();feedback(`${id} reposicionado. Os fios acompanham a posição.`,"mobileARWiringStatus");}
    });
    $("mobileARStop")?.addEventListener("click",()=>stopSimulation(true));
    window.addEventListener("coda-mobile-ar-open",()=>{mode("view");renderControls();redraw();});
    window.addEventListener("coda-mobile-ar-close",()=>stopSimulation(false));
    document.addEventListener("visibilitychange",()=>{if(document.hidden && running){stopSimulation();}});
    renderControls();mode("view");
  }
  if (document.readyState==="loading") document.addEventListener("DOMContentLoaded",bind,{once:true}); else bind();
  window.CodaARLab={ get circuit(){return circuit},get code(){return code},get running(){return running},makeExample:example,simulate,stop:stopSimulation,runtime };
})();
