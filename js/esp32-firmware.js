/* Editor único do Programador 3D: simulação educativa e execução USB com MicroPython. */
(() => {
  'use strict';
  const core=window.CodaARLabCore,runtimeCore=window.CodaESP32Runtime;
  if(!core||!runtimeCore)return;
  const $=id=>document.getElementById(id);
  let scope='model',target='simulator',active=null,plotTimer=0,samples=[],serialLines=0,bootTimer=0,physicalRunning=false;
  const codes={},physicalCodes={};
  try{Object.assign(codes,JSON.parse(localStorage.getItem('coda-esp32-firmware-v14')||'{}'));}catch{}
  try{Object.assign(physicalCodes,JSON.parse(localStorage.getItem('coda-esp32-physical-v14')||'{}'));}catch{}
  function virtualDefault(){return scope==='model'||scope==='ar'?runtimeCore.ANALOG_DEMO:core.DEMO;}
  function physicalDefault(){return window.CodaCore?.getGenerated3DCode?.()||`from machine import Pin\nfrom time import sleep\n\nled = Pin(2, Pin.OUT)\nwhile True:\n    led.value(not led.value())\n    sleep(0.5)`;}
  function updateEditorInfo(){
    const editor=$('espFirmwareCode');if(!editor)return;
    const source=editor.value;const line=source.slice(0,editor.selectionStart).split('\n');
    $('espEditorCaret').textContent=`LIN ${line.length}, COL ${line[line.length-1].length+1} • ${source.split('\n').length} linhas`;
    $('espCodeLines').textContent=Array.from({length:Math.max(1,source.split('\n').length)},(_,i)=>i+1).join('\n');
    $('espCodeLines').scrollTop=editor.scrollTop;
  }
  function editorSaved(message='Salvo automaticamente no navegador'){$('espEditorSaved').textContent=message;}
  function downloadCode(){
    save();const physical=target==='physical';const fileName=physical?'main.py':'sketch.ino';
    const blob=new Blob([$('espFirmwareCode').value],{type:'text/plain;charset=utf-8'});
    const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=fileName;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
    editorSaved(`${fileName} baixado`);status(`Arquivo ${fileName} salvo no seu dispositivo.`);
  }
  function verifyCode(){
    if(target==='physical'){status('Para código MicroPython, o simulador não faz verificação. Execute no ESP32 físico compatível.',true);return;}
    try{runtimeCore.parseArduino($('espFirmwareCode').value);status('✓ Código Arduino verificado. Pronto para executar no ESP32 virtual.');editorSaved('Código verificado e salvo');}
    catch(error){status(`Erro no código: ${error.message}`,true);editorSaved('Corrija o código e verifique novamente');}
  }
  async function importCode(event){
    const file=event.target.files?.[0];event.target.value='';if(!file)return;
    if(file.size>12000){status('O arquivo deve ter no máximo 12.000 caracteres para a simulação.',true);return;}
    if(!/\.(ino|cpp|txt|py)$/i.test(file.name)){status('Selecione um arquivo .ino, .cpp ou .txt.',true);return;}
    try{const content=await file.text();stop();$('espFirmwareCode').value=content;save();updateEditorInfo();editorSaved(`${file.name} importado e salvo`);status(`Código de ${file.name} carregado. Verifique e execute para testar.`);}
    catch{status('Não foi possível ler o arquivo selecionado.',true);}
  }
  function save(){
    if(!$('espFirmwareCode'))return;
    try{
      if(target==='physical'){physicalCodes[scope]=$('espFirmwareCode').value;localStorage.setItem('coda-esp32-physical-v14',JSON.stringify(physicalCodes));}
      else{codes[scope]=$('espFirmwareCode').value;localStorage.setItem('coda-esp32-firmware-v14',JSON.stringify(codes));}
    }catch{}
    editorSaved();
  }
  const isRunning=()=>runtime.snapshot.running;
  function view(){if(scope==='program')return window.CodaCircuit3D.mount($('circuit3DCanvas'));if(scope==='wiring')return window.CodaCircuit3D.mount($('wiring3DCanvas'));return window.CodaESP3D.renderer;}
  function status(message,error=false){const node=$('espFirmwareStatus');if(node){node.textContent=message;node.dataset.error=String(error);}}
  function serial(message){const node=$('espSerialOutput');if(!node)return;const line=document.createElement('div');line.textContent=message||' ';node.append(line);if(node.children.length>120)node.firstElementChild.remove();node.scrollTop=node.scrollHeight;serialLines++;$('espSerialCount').textContent=`${serialLines} linhas`;}
  function serialText(text){String(text).replace(/\r/g,'').split('\n').forEach((line,index,all)=>{if(line||index<all.length-1)serial(line);});}
  function plot(){const raw=Number($('simAnalog').value);samples.push(raw);samples=samples.slice(-64);const points=samples.map((n,i)=>`${i*100/63},${38-n/4095*34}`).join(' ');$('espADCLine')?.setAttribute('points',points);$('espADCPlot')?.setAttribute('aria-label',`Gráfico ADC GPIO${$('simGpio').value.replace('GPIO','')}: ${raw} de 4095`);}
  const runtime=runtimeCore.createRuntime({
    onState(snapshot){
      active?.setHardware?.(snapshot);
      if(scope==='ar')window.CodaAR?.setHardware?.(snapshot);
      const high=Boolean(snapshot.outputs[2]);if($('espBuiltinLED')){$('espBuiltinLED').textContent=high?'● GPIO2 · HIGH':'○ GPIO2 · LOW';$('espBuiltinLED').classList.toggle('on',high);}
      if($('espRunCode')&&target==='simulator'){$('espRunCode').disabled=snapshot.running;$('espStopCode').disabled=!snapshot.running;$('espHardwareState').textContent=snapshot.running?'● Executando sketch':'○ Placa pronta';}
    },onSerial:serial,onError:error=>{clearInterval(plotTimer);status(error.message,true);}
  });
  function stop(){clearInterval(plotTimer);plotTimer=0;runtime.stop();active?.releaseHardware?.();window.CodaAR?.setHardware?.(runtime.snapshot);}
  function setAnalog(){const pin=Number($('simGpio').value.replace('GPIO','')),value=Number($('simAnalog').value);runtime.setAnalog(pin,value);$('simAnalogValue').textContent=`${value} / 4095`;$('simVoltage').textContent=`${(value*3.3/4095).toFixed(2)} V`;plot();}
  function syncInputs(){
    const circuit=view()?.snapshot;if(!circuit)return;
    const ready=new Set(window.CodaEsp32CircuitLogic.evaluateCircuit(circuit).activeConnectedIds);
    for(const item of circuit.components){if(!ready.has(String(item.id)))continue;const pin=Number(String(item.pin||'GPIO4').replace('GPIO',''));if(item.type==='button')runtime.setDigital(pin,!item.active);if(item.type==='potentiometer')runtime.setAnalog(pin,item.value);}
  }
  function runSimulator(){
    stop();save();window.CodaCore?.stopPrototypeSimulation?.();active=view();
    try{const circuit=active?.snapshot||active?.state;if(circuit?.wires?.length){const check=window.CodaEsp32CircuitLogic.evaluateCircuit(circuit);if(check.faults.length)throw new Error(check.message);}
      setAnalog();syncInputs();runtime.start($('espFirmwareCode').value);status('Código executando no simulador 3D. Altere o código e execute novamente para atualizar.');plotTimer=setInterval(plot,250);
    }catch(error){status(error.message,true);}
  }
  async function runPhysical(){
    save();stop();const code=$('espFirmwareCode').value;
    if(!code.trim()||code.includes('# Circuito não liberado:')){status('Complete as ligações do circuito ou carregue um exemplo de código antes de executar.',true);return;}
    physicalRunning=true;$('espRunCode').disabled=true;$('espStopCode').disabled=false;status('Selecione a porta USB do ESP32. O código será executado após a conexão.');
    try{const result=await window.CodaCore?.runPhysicalEspCode?.(code);physicalRunning=Boolean(result?.success);status(result?.success?'Código enviado e executando no ESP32 físico. A saída aparece no monitor serial.':'A conexão foi cancelada ou não pôde ser aberta.',!result?.success);}
    catch(error){physicalRunning=false;status(`Não foi possível executar na placa: ${error.message}`,true);}
    finally{$('espRunCode').disabled=false;$('espStopCode').disabled=!physicalRunning;}
  }
  function run(){return target==='physical'?runPhysical():runSimulator();}
  async function stopCurrent(){
    if(target==='physical'){try{await window.CodaCore?.stopPhysicalEsp?.();physicalRunning=false;status('Execução interrompida no ESP32 físico.');}catch(error){status(error.message,true);}}
    else{stop();status('Simulação parada.');}
    $('espStopCode').disabled=true;$('espRunCode').disabled=false;
  }
  function reset(){if(target==='physical'){status('Use Executar para enviar novamente o programa à placa.');return;}if(isRunning()){runtime.reset();serial('[EN] Sketch reiniciado.');status('Reset EN: setup() executado novamente.');}else{runtime.stop();serial('[EN] Reset. Placa pronta para simular.');}active?.setHardware?.({...runtime.snapshot,reset:true});setTimeout(()=>active?.setHardware?.(runtime.snapshot),140);}
  function boot(pressed){runtime.setBoot(pressed);$('espBoot').setAttribute('aria-pressed',String(pressed));}
  function updateTargetUI(loadCode=true){
    const physical=target==='physical';
    if(loadCode)$('espFirmwareCode').value=physical?(physicalCodes[scope]||physicalDefault()):(codes[scope]||virtualDefault());
    $('espFirmwareFilename').textContent=physical?'main.py':'sketch.ino';$('espFirmwareLanguage').textContent=physical?'MicroPython':'Arduino / C++ educativo';
    $('espRunCode').textContent=physical?'Conectar e executar no ESP32':'▶ Executar no 3D';$('espStopCode').disabled=physical?!physicalRunning:!isRunning();
    $('espFirmwareDescription').textContent=physical?'Conecte uma placa com MicroPython por USB. O mesmo botão abre a porta e executa o programa.':'O simulador interpreta o sketch e atualiza a placa e os componentes conectados.';
    $('espFirmwareHelp').innerHTML=physical?'Requisitos: Chrome ou Edge no computador, cabo USB de dados e <code>MicroPython</code> instalado no ESP32. O código é enviado pelo Web Serial e executado na placa.':'Use <code>pinMode</code>, <code>digitalWrite</code>, <code>digitalRead</code>, <code>analogRead</code>, <code>delay</code>, <code>millis</code>, variáveis, contas e <code>Serial.begin / print / println / printf</code>. Para um LED externo, conecte GPIO → resistor → LED → GND.';
    updateEditorInfo();editorSaved();
    status(physical?'Edite o código MicroPython e use um único botão para conectar e executar.':'Digite Arduino/C++, clique em Verificar e depois Executar no 3D.');
  }
  function modeChanged(){const next=window.CodaCore?.getESPMode?.()||'model';if(next===scope)return;save();stop();scope=next;active=view();$('espFirmwareScope').textContent=({model:'Modelo 3D',wiring:'Modo fios',program:'Programador 3D',ar:'RA com óculos',mobilear:'RA no celular'})[scope]||scope;$('espFirmwarePanel').hidden=scope==='mobilear';updateTargetUI(true);}
  function exampleCode(value){
    if(target==='physical')return value==='adc'?`from machine import ADC, Pin\nfrom time import sleep\n\nled = Pin(2, Pin.OUT)\npot = ADC(Pin(34))\nwhile True:\n    valor = pot.read()\n    led.value(1)\n    sleep(valor / 8190)\n    led.value(0)\n    sleep(valor / 8190)\n    print('ADC 34:', valor)`:value==='boot'?`from machine import Pin\nfrom time import sleep\n\nboot = Pin(0, Pin.IN, Pin.PULL_UP)\nled = Pin(2, Pin.OUT)\nwhile True:\n    led.value(not boot.value())\n    print(boot.value())\n    sleep(0.1)`: `from machine import Pin\nfrom time import sleep\n\nled = Pin(2, Pin.OUT)\nwhile True:\n    led.value(not led.value())\n    sleep(0.5)`;
    return value==='adc'?runtimeCore.ANALOG_DEMO:value==='boot'?`void setup() {\n  pinMode(0, INPUT_PULLUP);\n  pinMode(2, OUTPUT);\n  Serial.begin(115200);\n}\nvoid loop() {\n  int estado = digitalRead(0);\n  digitalWrite(2, !estado);\n  Serial.println(estado);\n  delay(100);\n}`:core.DEMO;
  }
  function normalizedPrompt(value){return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
  function promptGpios(text){return [...text.matchAll(/(?:gpio|pino)\s*(\d{1,2})/g)].map(match=>Number(match[1])).filter(pin=>runtimeCore.INPUT_GPIO.includes(pin));}
  function promptDelay(text){
    const match=text.match(/(\d+(?:[.,]\d+)?)\s*(milissegundos?|ms|segundos?|seg|s)\b/);if(!match)return 500;
    const value=Number(match[1].replace(',','.'));return Math.max(50,Math.min(10000,Math.round(/^(s|seg|segundo)/.test(match[2])?value*1000:value)));
  }
  function promptCode(request,physical){
    const text=normalizedPrompt(request),gpios=promptGpios(text),delayMs=promptDelay(text),comment=String(request).replace(/[\r\n]+/g,' ').replace(/\*\//g,'').slice(0,120);
    if(/\b(wifi|wi-fi|bluetooth|web|internet|display|oled|servo|motor)\b/.test(text))return {error:'Esse pedido ainda não é executado pelo modelo 3D. Tente LED, botão, potenciômetro/ADC ou monitor serial.'};
    const analog=/potenciomet|analog|adc|sensor/.test(text),button=/botao|button|boot/.test(text),turnOff=/apagar|desligar/.test(text),turnOn=/acender|ligar/.test(text)&&!turnOff,blink=/piscar|blink|alternar/.test(text)||(!analog&&!button&&!turnOn&&!turnOff);
    const inputPin=gpios[0]??(button?0:34),outputPin=gpios[button||analog?1:0]??2;
    if(physical){
      if(analog)return {code:`# Gerado pelo pedido: ${comment}\nfrom machine import ADC, Pin\nfrom time import sleep\n\nsensor = ADC(Pin(${inputPin}))\nwhile True:\n    valor = sensor.read()\n    print('GPIO${inputPin}:', valor)\n    sleep(${Math.max(.05,delayMs/1000).toFixed(2)})`};
      if(button)return {code:`# Gerado pelo pedido: ${comment}\nfrom machine import Pin\nfrom time import sleep\n\nbotao = Pin(${inputPin}, Pin.IN, Pin.PULL_UP)\nled = Pin(${outputPin}, Pin.OUT)\nwhile True:\n    estado = botao.value()\n    led.value(not estado)\n    print('Botao:', estado)\n    sleep(0.10)`};
      if(turnOn||turnOff)return {code:`# Gerado pelo pedido: ${comment}\nfrom machine import Pin\nfrom time import sleep\n\nled = Pin(${outputPin}, Pin.OUT)\nwhile True:\n    led.value(${turnOff?0:1})\n    print('GPIO${outputPin}: ${turnOff?'LOW':'HIGH'}')\n    sleep(1)`};
      return {code:`# Gerado pelo pedido: ${comment}\nfrom machine import Pin\nfrom time import sleep\n\nled = Pin(${outputPin}, Pin.OUT)\nwhile True:\n    led.value(1)\n    print('GPIO${outputPin}: HIGH')\n    sleep(${(delayMs/1000).toFixed(2)})\n    led.value(0)\n    print('GPIO${outputPin}: LOW')\n    sleep(${(delayMs/1000).toFixed(2)})`};
    }
    if(analog)return {code:`// Gerado pelo pedido: ${comment}\n#define SENSOR_PIN ${inputPin}\n\nvoid setup() {\n  pinMode(SENSOR_PIN, INPUT);\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  int valor = analogRead(SENSOR_PIN);\n  Serial.println(valor);\n  delay(${delayMs});\n}`};
    if(button)return {code:`// Gerado pelo pedido: ${comment}\n#define BUTTON_PIN ${inputPin}\n#define LED_PIN ${outputPin}\n\nvoid setup() {\n  pinMode(BUTTON_PIN, INPUT_PULLUP);\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  int estado = digitalRead(BUTTON_PIN);\n  digitalWrite(LED_PIN, !estado);\n  Serial.println(estado);\n  delay(100);\n}`};
    if(turnOn||turnOff)return {code:`// Gerado pelo pedido: ${comment}\n#define LED_PIN ${outputPin}\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, ${turnOff?'LOW':'HIGH'});\n  Serial.println("GPIO${outputPin}: ${turnOff?'LOW':'HIGH'}");\n  delay(1000);\n}`};
    if(blink)return {code:`// Gerado pelo pedido: ${comment}\n#define LED_PIN ${outputPin}\n\nvoid setup() {\n  pinMode(LED_PIN, OUTPUT);\n  Serial.begin(115200);\n}\n\nvoid loop() {\n  digitalWrite(LED_PIN, HIGH);\n  Serial.println("GPIO${outputPin}: HIGH");\n  delay(${delayMs});\n  digitalWrite(LED_PIN, LOW);\n  Serial.println("GPIO${outputPin}: LOW");\n  delay(${delayMs});\n}`};
    return {error:'Descreva uma ação como piscar ou acender um LED, ler um botão ou ler um potenciômetro.'};
  }
  function generateFromPrompt(){
    const input=$('espProgramPrompt'),message=$('espProgramPromptStatus'),request=input.value.trim();if(!request){message.textContent='Escreva primeiro o que o ESP32 deve fazer.';message.dataset.error='true';input.focus();return;}
    const wantsPhysical=/fisic|placa real|usb|micropython/.test(normalizedPrompt(request));
    if(wantsPhysical&&target!=='physical'){$('espExecutionTarget').value='physical';$('espExecutionTarget').dispatchEvent(new Event('change',{bubbles:true}));}
    const result=promptCode(request,wantsPhysical||target==='physical');
    if(result.error){message.textContent=result.error;message.dataset.error='true';return;}
    stop();$('espFirmwareCode').value=result.code;save();message.textContent=`Código gerado para ${target==='physical'?'o ESP32 físico':'o modelo 3D'}. Revise e clique em ${target==='physical'?'Conectar e executar no ESP32':'Executar no 3D'}.`;message.dataset.error='false';status('Código criado a partir do seu pedido. Ele ainda não está rodando: use o botão Executar.');$('espFirmwareCode').focus();
  }
  function bind(){
    if(!$('espFirmwareCode'))return;
    // Editor de código fica visível antes da bancada, não escondido depois dela.
    $('programmerCodeTop')?.after($('espFirmwarePanel'));
    scope=window.CodaCore?.getESPMode?.()||'model';target=$('espExecutionTarget')?.value||'simulator';active=view();updateTargetUI(true);
    $('espRunCode').onclick=()=>{void run();};$('espStopCode').onclick=()=>{void stopCurrent();};$('espReset').onclick=reset;
    $('espVerifyCode').onclick=verifyCode;
    $('espSaveIno').onclick=downloadCode;
    $('espOpenIno').onclick=()=>$('espOpenInoFile').click();
    $('espOpenInoFile').onchange=event=>{void importCode(event);};
    $('espCopyCode').onclick=async()=>{try{await navigator.clipboard.writeText($('espFirmwareCode').value);editorSaved('Código copiado');}catch{status('Não foi possível copiar. Selecione o código e copie manualmente.',true);}};
    $('espRestoreCode').onclick=()=>{if(!confirm('Substituir o código atual pelo exemplo inicial?'))return;stop();$('espFirmwareCode').value=exampleCode('blink');save();updateEditorInfo();status('Exemplo Arduino restaurado. Clique em Executar para testar.');};
    $('programmerSeeBench').onclick=()=>{$('prototypeStage')?.scrollIntoView({behavior:'smooth',block:'start'});};
    $('espProgramPromptForm').onsubmit=event=>{event.preventDefault();generateFromPrompt();};
    $('espExecutionTarget').onchange=event=>{save();stop();target=event.target.value;updateTargetUI(true);};
    $('espBoot').onpointerdown=event=>{event.preventDefault();boot(true);event.currentTarget.setPointerCapture(event.pointerId);};
    $('espBoot').onpointerup=()=>boot(false);$('espBoot').onpointercancel=()=>boot(false);$('espBoot').onlostpointercapture=()=>boot(false);
    $('espBoot').onkeydown=event=>{if(event.key===' '||event.key==='Enter'){event.preventDefault();boot(true);}};$('espBoot').onkeyup=event=>{if(event.key===' '||event.key==='Enter')boot(false);};$('espBoot').onblur=()=>boot(false);
    const editor=$('espFirmwareCode');
    editor.addEventListener('input',()=>{if(target==='simulator'&&isRunning()){stop();status('Código alterado. Execute novamente para usar a nova versão.');}save();updateEditorInfo();});
    editor.addEventListener('scroll',()=>{$('espCodeLines').scrollTop=editor.scrollTop;});
    editor.addEventListener('click',updateEditorInfo);editor.addEventListener('keyup',updateEditorInfo);
    editor.addEventListener('keydown',event=>{
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='enter'){event.preventDefault();void run();return;}
      if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='s'){event.preventDefault();downloadCode();return;}
      if(event.key==='Tab'&&!event.ctrlKey&&!event.metaKey){
        event.preventDefault();const start=editor.selectionStart,end=editor.selectionEnd;
        if(event.shiftKey&&start===end){const lineStart=editor.value.lastIndexOf('\n',start-1)+1;const prefix=editor.value.slice(lineStart).match(/^( {1,2}|\t)/)?.[0];if(prefix){editor.setRangeText('',lineStart,lineStart+prefix.length,'end');editor.setSelectionRange(Math.max(lineStart,start-prefix.length),Math.max(lineStart,start-prefix.length));}}
        else{editor.setRangeText('  ',start,end,'end');}
        editor.dispatchEvent(new Event('input',{bubbles:true}));
      }
    });
    $('espCodeExample').onchange=event=>{if(!event.target.value)return;stop();$('espFirmwareCode').value=exampleCode(event.target.value);save();updateEditorInfo();event.target.value='';status('Exemplo carregado. Agora execute para ver o resultado.');};
    $('espClearSerial').onclick=()=>{$('espSerialOutput').replaceChildren();serialLines=0;$('espSerialCount').textContent='0 linhas';};
    document.addEventListener('coda:esp-serial',event=>serialText(event.detail?.text||''));
    document.addEventListener('input',event=>{if(event.target.id==='interact3DRange')syncInputs();});document.addEventListener('click',event=>{if(event.target.id==='interact3DButton')syncInputs();});
    $('simAnalog').addEventListener('input',setAnalog);$('simGpio').addEventListener('change',setAnalog);$('simDigital').addEventListener('click',()=>{active=view();const pin=Number($('simGpio').value.replace('GPIO',''));runtime.setDigital(pin,$('simDigital').classList.contains('active'));});
    document.querySelectorAll('[data-esp-mode]').forEach(button=>button.addEventListener('click',()=>queueMicrotask(modeChanged)));
    $('espSceneTop').onclick=()=>window.CodaESP3D.setView({pitch:86,yaw:0,scale:1});$('espSceneGrid').onclick=event=>event.currentTarget.setAttribute('aria-pressed',String(window.CodaESP3D.renderer?.toggleGrid()));$('espSceneRotate').onclick=event=>event.currentTarget.setAttribute('aria-pressed',String(window.CodaESP3D.renderer?.toggleRotate()));$('espSceneHome').onclick=()=>{document.querySelector('[data-rotate="reset"]')?.click();};
    window.addEventListener('coda-hardware-action',event=>{if(event.detail.canvasId==='mobileARCanvas'||target==='physical')return;if(event.detail.action==='EN')reset();else{boot(true);clearTimeout(bootTimer);bootTimer=setTimeout(()=>boot(false),300);}});
    document.addEventListener('visibilitychange',()=>{if(document.hidden&&target==='simulator'){stop();boot(false);}});document.addEventListener('click',()=>{if(target==='simulator'&&isRunning()&&!$('esp32').classList.contains('active')){stop();status('Simulação pausada ao sair do laboratório.');}});document.addEventListener('coda:esp32',()=>{modeChanged();if(target==='simulator'&&isRunning())active?.setHardware?.(runtime.snapshot);});
    setAnalog();
  }
  window.CodaFirmware={run,stop,runtime,get scope(){return scope;},get target(){return target;}};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});else bind();
})();
