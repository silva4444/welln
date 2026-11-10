(() => {
  "use strict";

  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const state = {
    supported: false, checked: false, session: null, gl: null, canvas: null,
    refSpace: null, viewerSpace: null, hitSource: null, lastHit: null,
    mode: "view", experience: "vr", support: {vr:false,ar:false}, placed: false, selected: null, scale: 1, rotation: 0,
    board: { id:"ESP32", kind:"board", x:0, y:0, z:-0.65 },
    components: [], program: null, cube: null, frameHandle: null, device: "headset",
    grabbed: null, xrButtons: [], xrPinButtons: [], xrHands: new Map(), xrInputStates: new Map(), xrTouchStates:new Map(),xrActionTimes:new Map(),
    wiringMode:false, pendingTerminal:null, xrConnections:[], xrWires:null, xrWiresDirty:true, xrTable:null,
    boardLocked:false, vrPinPanel:null, vrPinPanelOpen:false, vrLockButton:null, vrLitKey:null,
    vrCode: "", vrRuntime: null, vrRunning: false, vrScreen: null, vrSerial: [], vrEditorMessage: "PRONTO PARA PROGRAMAR",
    mobile: { stream:null, fallback:false, placed:false, locked:false, x:50, y:58, scale:1, rotation:0, dragging:false, dragDx:0, dragDy:0, pinchDistance:0, renderer:null }
  };

  const VERT = `attribute vec3 aPosition; uniform mat4 uProjection; uniform mat4 uView; uniform mat4 uModel; void main(){ gl_Position=uProjection*uView*uModel*vec4(aPosition,1.0); }`;
  const FRAG = `precision mediump float; uniform vec4 uColor; void main(){ gl_FragColor=uColor; }`;

  function toast(message){ window.CodaCore?.showToast?.(message); }
  function setStatus(title, text, type=""){
    const box=$("#arStatus"); if(!box) return;
    box.className=`ar-status ${type}`.trim();
    box.innerHTML=`<span>${type==="ok"?"✓":type==="warn"?"!":"◎"}</span><div><strong>${title}</strong><small>${text}</small></div>`;
  }

  function setMobileStatus(title, text, type=""){
    const box=$("#mobileARStatus"); if(!box) return;
    box.className=`ar-status ${type}`.trim();
    box.innerHTML=`<span>${type==="ok"?"✓":type==="warn"?"!":"◎"}</span><div><strong>${title}</strong><small>${text}</small></div>`;
  }

  const VR_DEMO=`void setup() {
  pinMode(2, OUTPUT);
  Serial.begin(115200);
}

void loop() {
  digitalWrite(2, HIGH);
  Serial.println("LED ligado");
  delay(500);
  digitalWrite(2, LOW);
  Serial.println("LED desligado");
  delay(500);
}`;
  const VR_HIGH=`void setup() {
  pinMode(2, OUTPUT);
}
void loop() {
  digitalWrite(2, HIGH);
  delay(1000);
}`;
  const VR_LOW=`void setup() {
  pinMode(2, OUTPUT);
}
void loop() {
  digitalWrite(2, LOW);
  delay(1000);
}`;

  function ensureVRRuntime(){
    if(state.vrRuntime)return state.vrRuntime;
    const core=window.CodaESP32Runtime;
    if(!core?.createRuntime)return null;
    state.vrRuntime=core.createRuntime({
      onState(snapshot){state.hardware=snapshot;state.vrRunning=Boolean(snapshot.running);refreshVRScreen();},
      onSerial(line){state.vrSerial.push(String(line).slice(0,80));state.vrSerial=state.vrSerial.slice(-4);refreshVRScreen();},
      onError(error){state.vrRunning=false;state.vrEditorMessage=`ERRO: ${error.message}`;refreshVRScreen();}
    });
    return state.vrRuntime;
  }

  function saveVRCode(){
    try{localStorage.setItem("coda-vr-sketch-v146",state.vrCode);}catch{}
    const editor=$("#espFirmwareCode");if(editor)editor.value=state.vrCode;
    refreshVRScreen();
  }

  function runVRCode(){
    const runtime=ensureVRRuntime();
    if(!runtime){state.vrEditorMessage="SIMULADOR NÃO CARREGADO";refreshVRScreen();return;}
    if(!state.vrCode.trim()){state.vrEditorMessage="DIGITE UM CÓDIGO ANTES DE EXECUTAR";refreshVRScreen();return;}
    try{runtime.start(state.vrCode);state.vrRunning=true;state.vrEditorMessage="● EXECUTANDO NO ESP32 VIRTUAL";}
    catch(error){state.vrRunning=false;state.vrEditorMessage=`ERRO: ${error.message}`;}
    refreshVRScreen();
  }

  function stopVRCode(){state.vrRuntime?.stop();state.vrRunning=false;state.vrEditorMessage="■ EXECUÇÃO INTERROMPIDA";refreshVRScreen();}

  function canvasTexture(width,height){
    const canvas=document.createElement("canvas");canvas.width=width;canvas.height=height;
    const texture=new window.THREE.CanvasTexture(canvas);texture.minFilter=window.THREE.LinearFilter;texture.magFilter=window.THREE.LinearFilter;
    return {canvas,ctx:canvas.getContext("2d"),texture};
  }

  function labelMaterial(text,{width=512,height=128,bg="#132832",fg="#eaf7fa",accent="#b9ff3b",font=46}={}){
    const view=canvasTexture(width,height),ctx=view.ctx;ctx.fillStyle=bg;ctx.fillRect(0,0,width,height);ctx.strokeStyle=accent;ctx.lineWidth=5;ctx.strokeRect(3,3,width-6,height-6);
    ctx.fillStyle=fg;ctx.font=`800 ${font}px Manrope,Arial`;ctx.textAlign="center";ctx.textBaseline="middle";ctx.fillText(text,width/2,height/2);
    return new window.THREE.MeshBasicMaterial({map:view.texture,transparent:false});
  }

  function vrButton(parent,label,action,x,y,w=.16,h=.065,color="#152b35",registry=state.xrButtons){
    const T=window.THREE,button=new T.Mesh(new T.BoxGeometry(w,h,.022),new T.MeshStandardMaterial({color,roughness:.68,metalness:.08}));
    button.position.set(x,y,.025);button.userData.xrAction=action;button.userData.xrInteractive=true;
    const face=new T.Mesh(new T.PlaneGeometry(w*.92,h*.78),labelMaterial(label,{width:384,height:112,bg:color,accent:action==="run"?"#b9ff3b":"#557984",font:40}));face.position.z=.012;button.add(face);parent.add(button);registry.push(button);return button;
  }

  function buildVREditor(scene){
    const T=window.THREE,root=new T.Group();root.name="CODA_VR_EDITOR";root.position.set(-.56,1.40,-.88);root.rotation.y=.10;scene.add(root);
    const panel=new T.Mesh(new T.BoxGeometry(1.62,1.50,.035),new T.MeshStandardMaterial({color:0x071218,roughness:.72,metalness:.12}));root.add(panel);
    const screenData=canvasTexture(1280,620),screen=new T.Mesh(new T.PlaneGeometry(1.5,.70),new T.MeshBasicMaterial({map:screenData.texture}));screen.position.set(0,.14,.02);root.add(screen);
    state.vrScreen=screenData;
    [["BLINK","template:blink",-.60,-.32,.18],["HIGH","template:high",-.40,-.32,.16],["LOW","template:low",-.22,-.32,.15],["+ LED","add:led",-.04,-.32,.17],["+ R","add:resistor",.16,-.32,.17],["▶ RUN","run",.39,-.32,.19],["■ STOP","stop",.60,-.32,.18]].forEach(([label,action,x,y,w])=>vrButton(root,label,action,x,y,w,.065,action==="run"?"#416b19":"#15303b"));
    [["↶ GIRAR","rotate:left",-.65,-.45,.18],["↷ GIRAR","rotate:right",-.44,-.45,.18],["FIAÇÃO","wire:toggle",-.22,-.45,.21],["APAGAR FIOS","wire:clear",.03,-.45,.23],["TRAZER MESA","bring:table",.33,-.45,.27],["PAINÉIS PERTO","bring:keyboard",.62,-.45,.30]].forEach(([label,action,x,y,w])=>vrButton(root,label,action,x,y,w,.062,action==="wire:toggle"?"#284c3a":"#15303b"));
    state.vrLockButton=vrButton(root,"FIXAR ESP","board:lock",-.30,-.58,.30,.064,"#31523a");
    vrButton(root,"PINO ESP","pin:panel",.15,-.58,.28,.064,"#34526a");
    vrButton(root,"LIMPAR CÓDIGO","template:clear",.55,-.58,.28,.064,"#453943");
    [["DESFAZER FIO","wire:undo",-.55,-.70,.30],["+ BOTÃO","add:button",-.15,-.70,.25],["+ SENSOR","add:sensor",.23,-.70,.27]].forEach(([label,action,x,y,w])=>vrButton(root,label,action,x,y,w,.064,"#263d49"));

    const keyboard=new T.Group();keyboard.name="CODA_VR_KEYBOARD";keyboard.position.set(.60,1.12,-.78);keyboard.rotation.set(-.17,-.12,0);scene.add(keyboard);
    const base=new T.Mesh(new T.BoxGeometry(1.22,.66,.04),new T.MeshStandardMaterial({color:0x09171e,roughness:.75,metalness:.1}));keyboard.add(base);
    const rows=["1234567890","qwertyuiop","asdfghjkl","zxcvbnm","\"'!+-*/%:#[]"];
    rows.forEach((chars,row)=>{const keyW=chars.length>10?.079:.098,gap=.011,total=chars.length*(keyW+gap)-gap;[...chars].forEach((char,i)=>vrButton(keyboard,char.toUpperCase(),`key:${char}`,-total/2+keyW/2+i*(keyW+gap),.255-row*.105,keyW,.074,"#132933"));});
    vrButton(keyboard,"SPACE","space",-.35,-.275,.28,.075,"#173642");vrButton(keyboard,"ENTER","enter",-.03,-.275,.24,.075,"#173642");vrButton(keyboard,"⌫", "backspace",.22,-.275,.16,.075,"#43303a");vrButton(keyboard,"▶ RUN", "run",.42,-.275,.18,.075,"#416b19");
    const pinPanel=new T.Group();pinPanel.name="CODA_VR_PIN_PICKER";pinPanel.position.set(.72,1.42,-.92);pinPanel.rotation.y=-.12;pinPanel.visible=false;scene.add(pinPanel);
    const pinBack=new T.Mesh(new T.BoxGeometry(1.28,1.12,.035),new T.MeshStandardMaterial({color:0x071218,roughness:.72,metalness:.12}));pinPanel.add(pinBack);
    const pinHeader=new T.Mesh(new T.PlaneGeometry(.94,.15),labelMaterial("PINOS DO ESP32",{width:900,height:120,bg:"#10242d",accent:"#b9ff3b",font:54}));pinHeader.position.set(-.13,.46,.022);pinPanel.add(pinHeader);
    vrButton(pinPanel,"FECHAR","pin:close",.49,.46,.20,.065,"#56363a",state.xrPinButtons);
    const pinNames=[...window.CodaESPModel.left,...window.CodaESPModel.right];
    pinNames.forEach((name,index)=>{const col=index%4,row=Math.floor(index/4),x=-.445+col*.30,y=.32-row*.085,reserved=window.CodaESPModel.reserved.has(name),label=reserved?`${window.CodaESPModel.label(name)} · FLASH`:window.CodaESPModel.label(name),button=vrButton(pinPanel,label,reserved?"pin:locked":`pin:select:${name}`,x,y,.27,.067,reserved?"#313840":"#17313d",state.xrPinButtons);button.userData.xrDisabled=reserved;});
    state.vrEditorRoot=root;state.vrKeyboardRoot=keyboard;state.vrPinPanel=pinPanel;refreshVRScreen();
  }

  function refreshVRScreen(){
    const view=state.vrScreen;if(!view)return;const {ctx,canvas,texture}=view;
    ctx.fillStyle="#061117";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#10242d";ctx.fillRect(0,0,canvas.width,76);
    ctx.fillStyle="#e6f4f8";ctx.font="700 34px DM Mono,monospace";ctx.fillText("sketch.ino • EDITOR VR",32,49);
    ctx.fillStyle=state.vrRunning?"#b9ff3b":"#84a2ad";ctx.textAlign="right";ctx.fillText(state.vrRunning?"● EXECUTANDO":"● PRONTO",canvas.width-32,49);ctx.textAlign="left";
    const lines=state.vrCode.split("\n"),visible=lines.slice(-12);ctx.font="29px DM Mono,monospace";
    visible.forEach((line,index)=>{const y=110+index*36;ctx.fillStyle="#54717c";ctx.fillText(String(lines.length-visible.length+index+1).padStart(2," "),22,y);ctx.fillStyle=/(void|pinMode|digitalWrite|delay|Serial)/.test(line)?"#8ee4ff":"#e8f2f5";ctx.fillText(line.slice(0,65),72,y,1160);});
    ctx.fillStyle="#10242d";ctx.fillRect(0,540,canvas.width,80);ctx.fillStyle="#b9ff3b";ctx.font="23px DM Mono,monospace";ctx.fillText(state.vrEditorMessage,28,568,1220);
    ctx.fillStyle="#9eb6be";ctx.font="22px DM Mono,monospace";ctx.fillText(`SERIAL: ${state.vrSerial.at(-1)||"aguardando execução"}`.slice(0,76),28,602,1220);texture.needsUpdate=true;
  }

  function activateVRAction(action,frame){
    const now=performance.now(),last=state.xrActionTimes.get(action)||0,delay=["pin:panel","pin:close","wire:toggle","board:lock"].includes(action)?350:65;if(now-last<delay)return;state.xrActionTimes.set(action,now);
    if(action==="run")return runVRCode();if(action==="stop")return stopVRCode();
    if(action==="rotate:left"||action==="rotate:right"){
      state.rotation+=action==="rotate:left"?-Math.PI/12:Math.PI/12;
      if(state.xrBoard)state.xrBoard.rotation.y=state.rotation;
      refreshXRWires();state.vrEditorMessage="ESP32 GIRADO • 15°";refreshVRScreen();return;
    }
    if(action==="wire:toggle")return toggleWiring();
    if(action==="wire:clear"){state.xrConnections=[];state.pendingTerminal=null;state.wiringMode=false;state.vrLitKey=null;refreshXRWires();state.vrEditorMessage="FIOS REMOVIDOS";refreshVRScreen();return;}
    if(action==="wire:undo"){state.xrConnections.pop();state.pendingTerminal=null;state.wiringMode=false;state.vrLitKey=null;refreshXRWires();state.vrEditorMessage="ÚLTIMA LIGAÇÃO DESFEITA";refreshVRScreen();return;}
    if(action==="bring:table")return bringTableNear(frame);
    if(action==="bring:keyboard")return bringPanelsNear(frame);
    if(action==="board:lock")return toggleBoardLock();
    if(action==="pin:panel")return toggleVRPinPanel(frame);
    if(action==="pin:close")return closeVRPinPanel();
    if(action.startsWith("pin:select:"))return selectVRPin(action.slice("pin:select:".length));
    if(action==="template:blink")state.vrCode=VR_DEMO;else if(action==="template:high")state.vrCode=VR_HIGH;else if(action==="template:low")state.vrCode=VR_LOW;else if(action==="template:clear")state.vrCode="";
    else if(action==="add:led")return addComponent("led");else if(action==="add:resistor")return addComponent("resistor");
    else if(action==="add:button")return addComponent("button");else if(action==="add:sensor")return addComponent("sensor");
    else if(action==="space")state.vrCode+=" ";else if(action==="enter")state.vrCode+="\n";else if(action==="backspace")state.vrCode=state.vrCode.slice(0,-1);else if(action.startsWith("key:"))state.vrCode+=action.slice(4);
    state.vrEditorMessage="CÓDIGO ALTERADO • TOQUE EM RUN";saveVRCode();
  }

  async function checkSupport(){
    state.checked=true;
    if(!window.isSecureContext){ state.supported=false; setStatus("HTTPS necessário","Abra o CODA por HTTPS no óculos para liberar WebXR.","warn"); updateButtons(); return false; }
    if(!navigator.xr){ state.supported=false; setStatus("WebXR não encontrado","Neste dispositivo você ainda pode usar a visualização 3D normal.","warn"); updateButtons(); return false; }
    try {
      const [vr,ar]=await Promise.all([
        navigator.xr.isSessionSupported("immersive-vr").catch(()=>false),
        navigator.xr.isSessionSupported("immersive-ar").catch(()=>false)
      ]);
      state.support={vr,ar};state.supported=Boolean(state.support[state.experience]);
    } catch { state.support={vr:false,ar:false};state.supported=false; }
    const label=state.experience==="vr"?"ambiente virtual":"realidade aumentada";
    setStatus(state.supported?`${label[0].toUpperCase()+label.slice(1)} disponível`:`${label[0].toUpperCase()+label.slice(1)} não disponível`,state.supported?"Óculos detectado. Entre no ambiente quando estiver pronto.":`Este navegador não oferece ${state.experience==="vr"?"WebXR immersive-vr":"WebXR immersive-ar"}.`,state.supported?"ok":"warn");
    updateButtons(); return state.supported;
  }

  function updateButtons(){
    const enter=$("#enterAR"); if(enter) enter.disabled=!state.supported || !!state.session;
    const exit=$("#exitAR"); if(exit) exit.disabled=!state.session;
    const mode=$("#arModeLabel"); if(mode) mode.textContent=state.mode==="lab"?"Laboratório interativo":"Somente visualização";
    const sel=$("#arSelectedLabel"); if(sel) sel.textContent=state.selected ? `Selecionado: ${state.selected}` : "Nenhum objeto selecionado";
  }

  // WebXR utiliza o mesmo construtor detalhado dos outros três ambientes.
  function initGL(){
    const T=window.THREE,model=window.CodaESPModel;
    const canvas=document.createElement("canvas");canvas.id="xrCanvas";
    const renderer=new T.WebGLRenderer({canvas,alpha:true,antialias:true});
    renderer.outputEncoding=T.sRGBEncoding;renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType("local-floor");
    const scene=new T.Scene();scene.add(new T.HemisphereLight(0xe5f2ff,0x26333d,1.8));
    const light=new T.DirectionalLight(0xffffff,2);light.position.set(1,3,2);scene.add(light);
    const board=model.createBoard();scene.add(board);
    const reticle=new T.Mesh(new T.RingGeometry(.025,.029,32),new T.MeshBasicMaterial({color:0xb5ed9e,side:T.DoubleSide}));reticle.rotation.x=-Math.PI/2;reticle.visible=false;scene.add(reticle);
    const room=new T.Group();
    const floor=new T.Mesh(new T.PlaneGeometry(8,8),new T.MeshStandardMaterial({color:0x172630,roughness:.9}));floor.rotation.x=-Math.PI/2;room.add(floor);
    const table=new T.Mesh(new T.BoxGeometry(1.8,.08,1),new T.MeshStandardMaterial({color:0x33434a,roughness:.72}));table.position.set(0,.72,-1);room.add(table);
    const back=new T.Mesh(new T.PlaneGeometry(8,3),new T.MeshStandardMaterial({color:0x0c1820,roughness:1}));back.position.set(0,1.5,-3);room.add(back);
    const title=new T.Mesh(new T.PlaneGeometry(2.35,.34),labelMaterial("CODA • LABORATÓRIO ESP32 VR",{width:1024,height:150,bg:"#0c1820",accent:"#b9ff3b",font:54}));title.position.set(0,2.28,-2.94);room.add(title);
    scene.add(room);
    const wires=new T.Group();wires.name="CODA_VR_WIRES";scene.add(wires);
    Object.assign(state,{canvas,gl:renderer.getContext(),xrRenderer:renderer,xrScene:scene,xrCamera:new T.PerspectiveCamera(),xrBoard:board,xrParts:new Map(),xrReticle:reticle,xrRoom:room,xrTable:table,xrWires:wires});
    buildVREditor(scene);
  }
  const HAND_JOINTS=["wrist","thumb-metacarpal","thumb-phalanx-distal","thumb-tip","index-finger-metacarpal","index-finger-phalanx-proximal","index-finger-phalanx-distal","index-finger-tip","middle-finger-phalanx-proximal","middle-finger-tip","ring-finger-tip","pinky-finger-tip"];
  function handMarkers(handedness){
    if(state.xrHands.has(handedness))return state.xrHands.get(handedness);
    const T=window.THREE,group=new T.Group();group.name=`MAO_${handedness}`;
    const material=new T.MeshStandardMaterial({color:handedness==="left"?0x77dfff:0xb9ff3b,emissive:handedness==="left"?0x123f50:0x29460d,transparent:true,opacity:.82});
    const joints=HAND_JOINTS.map(()=>{const marker=new T.Mesh(new T.SphereGeometry(.012,12,8),material);marker.visible=false;group.add(marker);return marker;});
    state.xrScene.add(group);const result={group,joints};state.xrHands.set(handedness,result);return result;
  }
  function updateHands(frame){
    const seen=new Set();for(const source of state.session?.inputSources||[]){if(!source.hand)continue;const side=source.handedness||"none";seen.add(side);const markers=handMarkers(side);
      HAND_JOINTS.forEach((name,index)=>{const space=source.hand.get(name),pose=space&&frame.getJointPose?.(space,state.refSpace),marker=markers.joints[index];marker.visible=Boolean(pose);if(pose){const p=pose.transform.position;marker.position.set(p.x,p.y,p.z);marker.scale.setScalar(Math.max(.65,Number(pose.radius||.011)/.011));}});
    }for(const [side,markers] of state.xrHands)markers.group.visible=seen.has(side);
  }
  function rayForSource(frame,source){const pose=source.targetRaySpace&&frame.getPose?.(source.targetRaySpace,state.refSpace);return pose?rayFromPose(pose):null;}
  function handTip(frame,source){if(!source.hand||!frame.getJointPose)return null;const space=source.hand.get("index-finger-tip"),pose=space&&frame.getJointPose(space,state.refSpace);if(!pose)return null;const p=pose.transform.position;return [p.x,p.y,p.z];}
  function buttonAtFinger(tip){
    if(!tip||!state.xrScene)return null;const T=window.THREE,point=new T.Vector3(...tip);state.xrScene.updateMatrixWorld(true);
    for(const button of interactiveVRButtons()){const local=button.worldToLocal(point.clone()),{width=.12,height=.07}=button.geometry.parameters||{};
      if(Math.abs(local.x)<=width/2+.006&&Math.abs(local.y)<=height/2+.006&&local.z>=.003&&local.z<=.04)return button;
    }
    return null;
  }
  function updateHandTouches(frame){
    const activeHands=new Set();for(const source of state.session?.inputSources||[]){if(!source.hand)continue;
      const side=source.handedness||"none",touch=state.xrTouchStates.get(side)||{button:null,wireEndpoint:null},tip=handTip(frame,source);
      activeHands.add(side);
      if(!tip){if(performance.now()-(touch.lastSeen||0)>180){touch.button=null;touch.wireEndpoint=null;}state.xrTouchStates.set(side,touch);continue;}
      touch.lastSeen=performance.now();
      const button=buttonAtFinger(tip);
      if(button&&button!==touch.button)activateVRAction(button.userData.xrAction,frame);
      touch.button=button;
      if(state.wiringMode){
        const endpoint=terminalNearHand(tip);
        touch.candidateCount=endpoint===touch.candidate?(touch.candidateCount||0)+1:1;touch.candidate=endpoint;
        if(endpoint&&endpoint!==touch.wireEndpoint&&touch.candidateCount>=3){connectTerminal(endpoint);touch.wireEndpoint=endpoint;}
        if(!endpoint)touch.wireEndpoint=null;
      }else{touch.wireEndpoint=null;touch.candidate=null;touch.candidateCount=0;}
      state.xrTouchStates.set(side,touch);
    }for(const [side,touch] of state.xrTouchStates)if(!activeHands.has(side)&&performance.now()-(touch.lastSeen||0)>180){touch.button=null;touch.wireEndpoint=null;state.xrTouchStates.set(side,touch);}
  }
  function updateGrabbed(frame){
    const grab=state.grabbed;if(!grab)return;const source=[...(state.session?.inputSources||[])].find(item=>item===grab.source);if(!source){state.grabbed=null;return;}
    const tip=handTip(frame,source),ray=rayForSource(frame,source);let p=tip;
    if(!p&&ray)p=[ray.origin[0]+ray.dir[0]*grab.distance,ray.origin[1]+ray.dir[1]*grab.distance,ray.origin[2]+ray.dir[2]*grab.distance];
    if(!p)return;
    if(grab.kind==="panel"){
      grab.object.position.set(Math.max(-1.35,Math.min(1.35,p[0]+grab.offset.x)),Math.max(.72,Math.min(2.05,p[1]+grab.offset.y)),Math.max(-1.8,Math.min(.25,p[2]+grab.offset.z)));
      return;
    }
    if(grab.object===state.board&&state.boardLocked)return;
    grab.object.x=Math.max(-.75,Math.min(.75,p[0]+grab.offset.x));grab.object.y=.78;grab.object.z=Math.max(-1.42,Math.min(-.58,p[2]+grab.offset.z));grab.object.userPlaced=true;
    if(state.xrConnections.length&&performance.now()-(state.lastWireRefresh||0)>90){state.xrWiresDirty=true;state.lastWireRefresh=performance.now();}
  }
  function renderFrame(time,frame){
    if(!frame||!state.session)return;
    if(state.hitSource){const hits=frame.getHitTestResults(state.hitSource);state.lastHit=hits[0]?.getPose(state.refSpace)?.transform.matrix||null;}
    updateHands(frame);updateGrabbed(frame);
    const T=window.THREE,model=window.CodaESPModel,board=state.xrBoard,sc=.065*state.scale;
    board.visible=state.placed;board.position.set(state.board.x,state.board.y+.01*state.scale,state.board.z);board.rotation.y=state.rotation;board.scale.setScalar(sc);
    const hardwareKey=JSON.stringify(state.hardware||{});if(hardwareKey!==state.vrHardwareKey){board.userData.setHardware(state.hardware||{});state.vrHardwareKey=hardwareKey;}
    const live=new Set(state.components.map(item=>item.id));
    for(const [id,part] of state.xrParts){if(!live.has(id)){state.xrScene.remove(part);model.dispose(part);state.xrParts.delete(id);}}
    for(const item of state.components){
      let part=state.xrParts.get(item.id);if(!part){
        // Reutiliza a mesma peça e os mesmos dados visuais da bancada do PC.
        part=model.createPart({...item,type:item.kind||item.type});
        part.userData.id=String(item.id);
        addVRComponentPinLabels(part);
        state.xrScene.add(part);state.xrParts.set(item.id,part);
      }
      part.visible=state.placed;
      part.position.set(item.x,item.y+.008,item.z);
      part.rotation.y=-Number(item.rotation||0)*Math.PI/180;
      part.scale.setScalar(.065*Math.max(.5,Math.min(1.8,Number(item.scale||1))));
    }
    state.xrScene.updateMatrixWorld(true);
    updateHandTouches(frame);
    if(state.xrWiresDirty)refreshXRWires();
    if(state.hardware?.outputs){
      const circuit={components:state.components.map(item=>({...item,type:item.kind||item.type})),wires:state.xrConnections};
      const key=JSON.stringify([state.hardware.outputs,state.xrConnections,circuit.components.map(item=>[item.id,item.pin,item.kind])]);
      if(key!==state.vrLitKey){state.vrLitKey=key;let lit={};try{lit=window.CodaARLabCore?.simulateLedStates?.(circuit,state.hardware.outputs)||{};}catch{}
        for(const part of state.xrParts.values())part.userData.setActive(Boolean(lit[part.userData.id]));}
    }else if(state.vrLitKey!==null){state.vrLitKey=null;for(const part of state.xrParts.values())part.userData.setActive(false);}
    const reticle=state.xrReticle;reticle.visible=state.experience==="ar"&&Boolean(state.lastHit);if(state.lastHit)reticle.position.set(state.lastHit[12],state.lastHit[13]+.001,state.lastHit[14]);
    if(state.xrCircuit){
      const group=state.xrCircuit;group.visible=state.placed;group.position.copy(board.position);group.rotation.y=board.rotation.y;group.scale.copy(board.scale);
      const snapshot=state.xrCircuitSnapshot;const lit=window.CodaARLabCore.simulateLedStates(snapshot,state.hardware?.outputs||{});
      group.children.forEach(part=>part.userData.setActive?.(Boolean(lit[part.userData.id])));
    }
    state.xrRenderer.render(state.xrScene,state.xrCamera);
  }
  function importPrototype(){
    const snapshot=window.CodaCircuit3D.renderer?.snapshot;
    if(!snapshot?.components?.length){toast("Adicione e conecte componentes no Programador 3D primeiro.");return;}
    state.xrCircuitSnapshot=structuredClone({components:snapshot.components,wires:snapshot.wires});
    if(state.xrCircuit){state.xrScene?.remove(state.xrCircuit);window.CodaESPModel.dispose(state.xrCircuit);}
    const T=window.THREE,model=window.CodaESPModel,group=new T.Group();state.xrCircuit=group;
    for(const item of snapshot.components){const part=model.createPart(item);part.userData.id=String(item.id);part.position.set((item.x-50)/12,0,(item.y-50)/12);part.rotation.y=-Number(item.rotation||0)*Math.PI/180;part.scale.setScalar(Number(item.scale||1));group.add(part);}
    group.updateMatrixWorld(true);
    const endpoint=value=>{const [id,pin]=String(value).split(':');if(id==='ESP32')return model.pinPoint(pin);const part=group.children.find(item=>item.userData.id===id);const p=part?.userData.terminals?.[pin];return p?part.localToWorld(p.clone()):null;};
    snapshot.wires.forEach((wire,i)=>{const [a,b]=Array.isArray(wire)?wire:[wire.a,wire.b],p=endpoint(a),q=endpoint(b);if(p&&q)model.wire(group,p,q,wire.color||['#ffc45b','#6bd1ee','#ed7c83'][i%3]);});
    state.xrScene?.add(group);toast("Circuito do Programador 3D preparado para a RA.");
  }

  function rayFromPose(pose){ const m=pose.transform.matrix; return { origin:[m[12],m[13],m[14]], dir:[-m[8],-m[9],-m[10]] }; }
  function hitObject(ray){
    if(!ray)return null;
    const objs=[...(state.mode==="lab"?state.components:[]), ...(state.placed?[state.board]:[])]; let best=null,bestT=1e9;
    for(const o of objs){ const dx=o.x-ray.origin[0],dy=o.y-ray.origin[1],dz=o.z-ray.origin[2]; const t=dx*ray.dir[0]+dy*ray.dir[1]+dz*ray.dir[2]; if(t<0) continue; const px=ray.origin[0]+ray.dir[0]*t,py=ray.origin[1]+ray.dir[1]*t,pz=ray.origin[2]+ray.dir[2]*t; const d=Math.hypot(o.x-px,o.y-py,o.z-pz); const radius=o.kind==="board"?.16:.075; if(d<radius&&t<bestT){best=o;bestT=t;} }
    return best;
  }
  function hitObjectNear(point){
    if(!point)return null;const objects=[...state.components,state.board];let best=null,distance=.16;
    for(const object of objects){const d=Math.hypot(object.x-point[0],object.y-point[1],object.z-point[2]);if(d<distance){best=object;distance=d;}}return best;
  }
  function hitVRButton(ray,tip){
    const T=window.THREE,buttons=interactiveVRButtons();if(!buttons.length)return null;
    state.xrScene?.updateMatrixWorld(true);
    if(ray){const caster=new T.Raycaster(new T.Vector3(...ray.origin),new T.Vector3(...ray.dir).normalize(),0,4);const hit=caster.intersectObjects(buttons,false)[0]?.object;if(hit)return hit;}
    if(tip){const p=new T.Vector3(...tip);let best=null,distance=.075;state.xrScene.updateMatrixWorld(true);for(const button of buttons){const d=button.getWorldPosition(new T.Vector3()).distanceTo(p);if(d<distance){best=button;distance=d;}}return best;}
    return null;
  }
  function interactiveVRButtons(){return [...state.xrButtons,...state.xrPinButtons].filter(button=>{if(button.userData.xrDisabled||button.parent===state.vrPinPanel&&performance.now()<(state.pinPanelReadyAt||0))return false;for(let node=button;node;node=node.parent)if(!node.visible)return false;return true;});}
  function terminalFromHit(hit){
    const T=window.THREE,model=window.CodaESPModel,board=state.xrBoard;
    let node=hit.object;while(node&&node!==board&&!state.xrParts.has(String(node.userData?.id||"")))node=node.parent;
    if(node===board){
      const local=board.worldToLocal(hit.point.clone());let best=null,distance=.22;
      for(const name of [...model.left,...model.right]){const point=model.pinPoint(name),d=point.distanceTo(local);if(d<distance){best=name;distance=d;}}
      return best?`ESP32:${best}`:null;
    }
    const part=node&&state.xrParts.get(String(node.userData?.id||""));if(!part)return null;
    const local=part.worldToLocal(hit.point.clone());let best=null,distance=.42;
    for(const [name,point] of Object.entries(part.userData.terminals||{})){const d=point.distanceTo(local);if(d<distance){best=name;distance=d;}}
    return best?`${part.userData.id}:${best}`:null;
  }
  function terminalNearHand(tip){
    if(!tip)return null;const T=window.THREE,model=window.CodaESPModel,point=new T.Vector3(...tip);let best=null,distance=.028;
    state.xrScene.updateMatrixWorld(true);
    for(const name of [...model.left,...model.right]){const p=state.xrBoard.localToWorld(model.pinPoint(name).clone()),d=p.distanceTo(point);if(d<distance){best=`ESP32:${name}`;distance=d;}}
    for(const part of state.xrParts.values())for(const [name,local] of Object.entries(part.userData.terminals||{})){const d=part.localToWorld(local.clone()).distanceTo(point);if(d<distance){best=`${part.userData.id}:${name}`;distance=d;}}
    return best;
  }
  function addVRComponentPinLabels(part){
    const T=window.THREE;for(const [name,p] of Object.entries(part.userData.terminals||{})){
      const tag=new T.Mesh(new T.PlaneGeometry(.32,.105),labelMaterial(name,{width:256,height:96,bg:"#102933",accent:"#ffc45b",font:50}));
      tag.position.set(p.x,p.y+.22,p.z+.045);tag.renderOrder=3;part.add(tag);
    }
  }
  function pickWireTerminal(ray,tip){
    const T=window.THREE;if(tip){const near=terminalNearHand(tip);if(near)return near;}
    if(!ray)return null;const caster=new T.Raycaster(new T.Vector3(...ray.origin),new T.Vector3(...ray.dir).normalize(),0,2);
    const hits=caster.intersectObject(state.xrBoard,true);for(const part of state.xrParts.values())hits.push(...caster.intersectObject(part,true));
    hits.sort((a,b)=>a.distance-b.distance);for(const hit of hits){const endpoint=terminalFromHit(hit);if(endpoint)return endpoint;}
    return null;
  }
  function endpointWorld(value){
    const [owner,terminal]=String(value||"").split(":");
    if(owner==="ESP32"){const local=window.CodaESPModel.pinPoint(terminal);return local?state.xrBoard.localToWorld(local.clone()):null;}
    const part=state.xrParts.get(owner),local=part?.userData.terminals?.[terminal];return local?part.localToWorld(local.clone()):null;
  }
  function refreshXRWires(){
    const group=state.xrWires;if(!group||!state.xrScene)return;const T=window.THREE,model=window.CodaESPModel;
    for(const child of [...group.children]){group.remove(child);model.dispose(child);}
    state.xrScene.updateMatrixWorld(true);
    state.xrConnections.forEach(([a,b],index)=>{
      const start=endpointWorld(a),end=endpointWorld(b);if(!start||!end)return;
      const lift=Math.max(start.y,end.y)+.035,curve=new T.CubicBezierCurve3(start,new T.Vector3(start.x,lift,start.z),new T.Vector3(end.x,lift,end.z),end);
      const mesh=new T.Mesh(new T.TubeGeometry(curve,18,.0028,6,false),new T.MeshStandardMaterial({color:["#ffc45b","#6bd1ee","#ed7c83","#9acd82"][index%4],metalness:.12,roughness:.38}));mesh.castShadow=true;group.add(mesh);
    });
    state.xrWiresDirty=false;
  }
  function toggleWiring(){state.wiringMode=!state.wiringMode;state.pendingTerminal=null;state.vrEditorMessage=state.wiringMode?"FIACAO ATIVA • TOQUE EM DOIS TERMINAIS":"FIACAO PAUSADA";refreshVRScreen();}
  function toggleBoardLock(){
    state.boardLocked=!state.boardLocked;
    const label=state.boardLocked?"LIBERAR ESP":"FIXAR ESP",face=state.vrLockButton?.children?.[0];
    if(face){const old=face.material;face.material=labelMaterial(label,{width:384,height:112,bg:state.boardLocked?"#5a381e":"#31523a",accent:"#ffc45b",font:40});old?.map?.dispose?.();old?.dispose?.();state.vrLockButton.material.color.set(state.boardLocked?"#75502c":"#31523a");}
    state.vrEditorMessage=state.boardLocked?"ESP32 FIXO NA BANCADA • TOQUE LIBERAR PARA MOVER":"ESP32 LIBERADO • ARRASTE PARA POSICIONAR";refreshVRScreen();
  }
  function toggleVRPinPanel(frame){
    state.vrPinPanelOpen=!state.vrPinPanelOpen;if(state.vrPinPanel)state.vrPinPanel.visible=state.vrPinPanelOpen;
    if(state.vrKeyboardRoot)state.vrKeyboardRoot.visible=!state.vrPinPanelOpen;
    state.pinPanelReadyAt=performance.now()+320;
    if(state.vrPinPanelOpen)bringPinPanelNear(frame);
    state.vrEditorMessage=state.vrPinPanelOpen?"PINOS ABERTOS • ESCOLHA UM OU TOQUE FECHAR":"PINOS FECHADOS • TECLADO DISPONÍVEL";refreshVRScreen();
  }
  function closeVRPinPanel(){state.vrPinPanelOpen=false;if(state.vrPinPanel)state.vrPinPanel.visible=false;if(state.vrKeyboardRoot)state.vrKeyboardRoot.visible=true;state.vrEditorMessage="PINOS FECHADOS • TECLADO DISPONÍVEL";refreshVRScreen();}
  function bringPinPanelNear(frame){
    const pose=frame?.getViewerPose?.(state.refSpace),m=pose?.transform?.matrix;if(!m||!state.vrPinPanel)return;
    const fx=-m[8],fz=-m[10],len=Math.hypot(fx,fz)||1,rx=m[0],rz=m[2];state.vrPinPanel.position.set(m[12]+fx/len*.82+rx*.42,m[13]-.04,m[14]+fz/len*.82+rz*.42);state.vrPinPanel.rotation.set(0,Math.atan2(-fx/len,-fz/len),0);
  }
  function selectVRPin(name){
    if(!window.CodaESPModel.pinPoint(name)||window.CodaESPModel.reserved.has(name)){state.vrEditorMessage=`PINO INDISPONÍVEL: ${name}`;refreshVRScreen();return;}
    if(!state.wiringMode){state.wiringMode=true;state.pendingTerminal=null;}
    for(const button of state.xrPinButtons)if(button.userData.xrAction?.startsWith("pin:select:"))button.material.color.set(button.userData.xrAction===`pin:select:${name}`?"#4a7231":"#17313d");
    connectTerminal(`ESP32:${name}`);
    if(state.wiringMode)state.vrEditorMessage=`ESP32 ${window.CodaESPModel.label(name)} SELECIONADO • TOQUE NO PIN NOMEADO DO COMPONENTE`;
    refreshVRScreen();
  }
  function connectTerminal(endpoint){
    if(!endpoint)return false;
    if(!state.pendingTerminal){state.pendingTerminal=endpoint;state.vrEditorMessage=`TERMINAL: ${endpoint} • ESCOLHA O SEGUNDO`;refreshVRScreen();return true;}
    if(state.pendingTerminal===endpoint){state.pendingTerminal=null;state.vrEditorMessage="ESCOLHA DOIS TERMINAIS DIFERENTES";refreshVRScreen();return true;}
    const first=state.pendingTerminal;
    if(state.xrConnections.some(([a,b])=>a===first&&b===endpoint||a===endpoint&&b===first)){
      state.pendingTerminal=null;state.wiringMode=false;state.vrEditorMessage="ESTES TERMINAIS JÁ ESTÃO LIGADOS";refreshVRScreen();return false;
    }
    state.xrConnections.push([first,endpoint]);
    state.pendingTerminal=null;state.wiringMode=false;state.xrWiresDirty=true;refreshXRWires();
    inferVRLedPins();
    state.vrEditorMessage=`FIO LIGADO • ${endpoint}`;refreshVRScreen();return true;
  }
  function inferVRLedPins(){
    const core=window.CodaARLabCore;if(!core?.simulateLedStates)return;
    const pins=[0,1,2,3,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33],outputs=Object.fromEntries(pins.map(pin=>[pin,true]));
    for(const led of state.components.filter(item=>item.kind==="led"))for(const pin of pins){
      const components=state.components.map(item=>({...item,type:item.kind||item.type,...(item.id===led.id?{pin:`GPIO${pin}`}:{})}));
      const lit=core.simulateLedStates({components,wires:state.xrConnections},outputs);
      if(lit[led.id]){led.pin=`GPIO${pin}`;break;}
    }
  }
  function findPanelHit(ray){
    if(!ray)return null;const T=window.THREE,roots=[state.vrEditorRoot,state.vrKeyboardRoot,state.vrPinPanel].filter(root=>root?.visible),caster=new T.Raycaster(new T.Vector3(...ray.origin),new T.Vector3(...ray.dir).normalize(),0,3),hit=caster.intersectObjects(roots,true)[0];if(!hit)return null;
    let root=hit.object;while(root&&root!==state.vrEditorRoot&&root!==state.vrKeyboardRoot&&root!==state.vrPinPanel)root=root.parent;
    return root?{root,point:hit.point}:null;
  }
  function findPanelNear(tip){
    if(!tip)return null;const T=window.THREE,point=new T.Vector3(...tip);
    for(const root of [state.vrEditorRoot,state.vrKeyboardRoot,state.vrPinPanel]){
      if(!root?.visible)continue;const local=root.worldToLocal(point.clone());
      const width=root===state.vrEditorRoot?1.62:root===state.vrKeyboardRoot?1.22:1.28;
      const height=root===state.vrEditorRoot ? 1.50 : root===state.vrKeyboardRoot ? .66 : 1.12;
      if(Math.abs(local.x)<width/2&&Math.abs(local.y)<height/2&&local.z>-.03&&local.z<.10)return {root,point};
    }return null;
  }
  function bringTableNear(frame){
    const pose=frame?.getViewerPose?.(state.refSpace),matrix=pose?.transform?.matrix;if(!matrix||!state.xrTable)return;
    const forwardX=-matrix[8],forwardZ=-matrix[10],length=Math.hypot(forwardX,forwardZ)||1,px=matrix[12],pz=matrix[14],targetX=px+forwardX/length*.82,targetZ=pz+forwardZ/length*.82;
    const dx=targetX-state.xrTable.position.x,dz=targetZ-state.xrTable.position.z;state.xrTable.position.x=targetX;state.xrTable.position.z=targetZ;
    state.board.x+=dx;state.board.z+=dz;for(const component of state.components){component.x+=dx;component.z+=dz;}
    state.xrWiresDirty=true;state.vrEditorMessage="MESA TRAZIDA PARA PERTO DE VOCE";refreshVRScreen();
  }
  function bringPanelsNear(frame){
    const pose=frame?.getViewerPose?.(state.refSpace),matrix=pose?.transform?.matrix;if(!matrix)return;
    const fx=-matrix[8],fz=-matrix[10],length=Math.hypot(fx,fz)||1,forwardX=fx/length,forwardZ=fz/length,rightX=matrix[0],rightZ=matrix[2],px=matrix[12],py=matrix[13],pz=matrix[14],yaw=Math.atan2(-forwardX,-forwardZ);
    if(state.vrEditorRoot){state.vrEditorRoot.position.set(px+forwardX*.78-rightX*.42,py-.04,pz+forwardZ*.78-rightZ*.42);state.vrEditorRoot.rotation.set(0,yaw,0);}
    if(state.vrKeyboardRoot){state.vrKeyboardRoot.position.set(px+forwardX*.62+rightX*.43,py-.34,pz+forwardZ*.62+rightZ*.43);state.vrKeyboardRoot.rotation.set(-.12,yaw,0);}
    if(state.vrPinPanelOpen)bringPinPanelNear(frame);
  }
  function onSelectStart(event){
    if(state.experience!=="vr"||state.mode!=="lab")return;
    const frame=event.frame,source=event.inputSource,ray=rayForSource(frame,source),tip=handTip(frame,source),button=source.hand?buttonAtFinger(tip):hitVRButton(ray,null);
    if(button){activateVRAction(button.userData.xrAction,frame);button.scale.set(.9,.9,.9);setTimeout(()=>button.scale.set(1,1,1),110);return;}
    if(state.wiringMode){
      const endpoint=pickWireTerminal(source.hand?null:ray,tip),side=source.handedness||"none",touch=state.xrTouchStates.get(side)||{button:null,wireEndpoint:null};
      if(endpoint&&touch.wireEndpoint!==endpoint){connectTerminal(endpoint);if(source.hand){touch.wireEndpoint=endpoint;state.xrTouchStates.set(side,touch);}}
      else if(!endpoint&&source.hand){touch.wireEndpoint=null;state.xrTouchStates.set(side,touch);}
      else if(!endpoint){state.vrEditorMessage="TOQUE EM UM PIN OU TERMINAL";refreshVRScreen();}
      return;
    }
    const panel=source.hand?findPanelNear(tip):findPanelHit(ray);
    if(panel){const point=tip?new window.THREE.Vector3(...tip):panel.point,distance=ray?new window.THREE.Vector3(...ray.origin).distanceTo(panel.point):.65;state.grabbed={source,object:panel.root,kind:"panel",distance,offset:panel.root.position.clone().sub(point)};state.vrEditorMessage="PAINEL PRESO • MOVA E SOLTE A PINCA";refreshVRScreen();return;}
    const object=hitObjectNear(tip)||hitObject(ray);if(!object)return;
    if(object===state.board&&state.boardLocked){state.vrEditorMessage="ESP32 FIXO • TOQUE EM LIBERAR ESP PARA MOVER";refreshVRScreen();return;}
    const grabDistance=tip?.length?0.12:(ray?Math.max(.18,Math.hypot(object.x-ray.origin[0],object.y-ray.origin[1],object.z-ray.origin[2])):.72);
    const p=tip||(ray?[ray.origin[0]+ray.dir[0]*grabDistance,ray.origin[1]+ray.dir[1]*grabDistance,ray.origin[2]+ray.dir[2]*grabDistance]:[object.x,object.y,object.z]);
    state.grabbed={source,object,distance:grabDistance,offset:{x:object.x-p[0],z:object.z-p[2]}};state.selected=object.id;state.vrEditorMessage=`✋ ${object.id} PRESO À MÃO`;refreshVRScreen();updateButtons();
  }
  function onSelectEnd(event){
    if(!state.grabbed||state.grabbed.source!==event.inputSource)return;const grab=state.grabbed,object=grab.object;
    if(grab.kind!=="panel")object.y=.78;
    state.grabbed=null;state.selected=null;state.xrWiresDirty=true;
    state.vrEditorMessage=grab.kind==="panel"?"PAINEL POSICIONADO • TOQUE PARA USAR":`${object.id} POSICIONADO • PRONTO`;refreshVRScreen();updateButtons();
  }

  function placeAtHit(obj){ if(!state.lastHit) return false; obj.x=state.lastHit[12]; obj.y=state.lastHit[13]; obj.z=state.lastHit[14]; return true; }
  function placeAlongRay(obj,ray,distance=.85){obj.x=ray.origin[0]+ray.dir[0]*distance;obj.y=ray.origin[1]+ray.dir[1]*distance;obj.z=ray.origin[2]+ray.dir[2]*distance;obj.userPlaced=true;return true;}
  function onSelect(event){
    if(state.experience==="vr")return;
    const frame=event.frame, source=event.inputSource; const rayPose=frame.getPose(source.targetRaySpace,state.refSpace); const hit=rayPose?hitObject(rayFromPose(rayPose)):null;
    const ray=rayPose?rayFromPose(rayPose):null;
    if(!state.placed){ if(placeAtHit(state.board)){ state.placed=true; arrangeComponents(); setStatus("ESP32 posicionado","A placa ficou ancorada nesta sessão. Aponte/pinçe para interagir.","ok"); } return; }
    if(state.mode==="view"){ if(placeAtHit(state.board)) toast("ESP32 reposicionado na bancada"); return; }
    if(hit){ state.selected=hit.id; setStatus("Objeto selecionado",`${hit.id}. Aponte para outro ponto da bancada e pinçe/aperte novamente para mover.`,"ok"); updateButtons(); return; }
    if(state.selected){ const obj=state.selected==="ESP32"?state.board:state.components.find(x=>x.id===state.selected); const moved=obj&&(state.experience==="ar"?placeAtHit(obj):(ray&&placeAlongRay(obj,ray))); if(moved){ toast(`${obj.id} movido`); state.selected=null; updateButtons(); } }
  }

  function arrangeComponents(){ if(!state.placed) return; state.components.forEach((o,i)=>{ if(o.userPlaced)return; const vr=state.experience==="vr";o.x=state.board.x+(vr ? .27 : .10)+(i%2)*(vr ? .18 : .055);o.y=state.board.y;o.z=state.board.z+(vr ? 0 : -.03)+Math.floor(i/2)*(vr ? .14 : .06); }); }
  function addComponent(kind){ const names={led:"LED",resistor:"R",button:"BTN",sensor:"HC"},id=`${names[kind]||"P"}${state.components.filter(x=>x.kind===kind).length+1}`; state.components.push({id,kind,pin:kind==="led"?"GPIO2":undefined,x:state.board.x+0.27,y:state.board.y,z:state.board.z,connected:false,userPlaced:false}); arrangeComponents();state.xrWiresDirty=true;state.vrLitKey=null; renderComponentList(); state.vrEditorMessage=`${id} ADICIONADO • AGARRE COM A MÃO`;refreshVRScreen();toast(`${kind} adicionado ao laboratório`); }
  function renderComponentList(){ const el=$("#arComponentList"); if(el) el.innerHTML=state.components.length?state.components.map(x=>`<span>${x.kind==="led"?"💡":"▰"} ${x.id}</span>`).join(""):"<small>Nenhum componente adicionado.</small>"; }

  async function enterAR(options={}){
    if(state.session) return true;
    state.device=options.device||"headset";
    state.experience=options.experience||$("[data-xr-experience].active")?.dataset.xrExperience||state.experience||"vr";
    const status=state.device==="mobile"?setMobileStatus:setStatus;
    state.mode=state.experience==="vr"?"lab":(options.mode||$("[data-ar-mode].active")?.dataset.arMode||"view"); state.selected=null; state.placed=false;
    $$('[data-ar-mode]').forEach(btn=>btn.classList.toggle("active",btn.dataset.arMode===state.mode));
    const tools=$("#arLabTools"); if(tools) tools.hidden=state.mode!=="lab";

    // A chamada de requestSession precisa acontecer diretamente a partir do clique
    // do usuário. Por isso não aguardamos checkSupport() antes de solicitar a RA.
    if(!window.isSecureContext){
      state.supported=false; state.checked=true;
      status("HTTPS necessário",state.device==="mobile"?"Abra o CODA por HTTPS para liberar a câmera/RA do celular.":"Abra o CODA por HTTPS no óculos para iniciar a realidade aumentada.","warn");
      updateButtons(); return false;
    }
    if(!navigator.xr){
      state.supported=false; state.checked=true;
      status("WebXR não encontrado",state.device==="mobile"?"O navegador não oferece WebXR. O CODA pode usar o modo câmera como alternativa.":"Abra esta página no navegador do óculos compatível com WebXR.","warn");
      updateButtons(); return false;
    }

    try{
      status(state.experience==="vr"?"Abrindo ambiente virtual":"Abrindo realidade aumentada",state.device==="mobile"?"Autorize a câmera/RA. Depois aponte o celular para a mesa.":state.experience==="vr"?"Coloque o óculos e autorize a sessão WebXR.":"Autorize o passthrough se o óculos pedir. Depois olhe para a bancada.");
      if(!state.gl) initGL();
      const sessionType=state.experience==="vr"?"immersive-vr":"immersive-ar";
      const opts=state.experience==="vr"
        ?{requiredFeatures:["local-floor"],optionalFeatures:["hand-tracking","bounded-floor"]}
        :{requiredFeatures:["local-floor"],optionalFeatures:["hit-test","hand-tracking","dom-overlay"],domOverlay:{root:$("#espARPanel")}};
      // IMPORTANTE: requestSession é chamado antes de qualquer await para preservar
      // a ativação transitória gerada pelo clique no botão 🥽.
      const sessionPromise=navigator.xr.requestSession(sessionType,opts);
      const session=await sessionPromise; state.session=session; state.supported=true; state.checked=true;
      await state.xrRenderer.xr.setSession(session);
      state.xrScene.background=state.experience==="vr"?new window.THREE.Color(0x071018):null;
      if(state.xrRoom)state.xrRoom.visible=state.experience==="vr";
      if(state.experience==="vr"){
        state.placed=true;Object.assign(state.board,{x:0,y:.78,z:-1});
        if(!state.components.length){addComponent("led");addComponent("resistor");}
        arrangeComponents();
        try{state.vrCode=localStorage.getItem("coda-vr-sketch-v146")??$("#espFirmwareCode")?.value??VR_DEMO;}catch{state.vrCode=VR_DEMO;}
        state.boardLocked=false;state.vrEditorMessage="PRONTO • ARRASTE A PLACA E TOQUE FIXAR ESP";refreshVRScreen();
      }
      if(state.xrCircuitSnapshot)importPrototype();
      state.refSpace=state.xrRenderer.xr.getReferenceSpace(); state.viewerSpace=await session.requestReferenceSpace("viewer");
      if(state.experience==="ar"){try{ state.hitSource=await session.requestHitTestSource({space:state.viewerSpace}); }catch{ state.hitSource=null; }}else state.hitSource=null;
      session.addEventListener("selectstart",onSelectStart);session.addEventListener("selectend",onSelectEnd);session.addEventListener("select",onSelect);session.addEventListener("end",onEnd);
      status(state.experience==="vr"?"Laboratório VR interativo iniciado":"RA iniciada",state.device==="mobile"?"Aponte para a mesa e toque na tela para posicionar o ESP32.":state.experience==="vr"?"Arraste a placa e toque FIXAR ESP. Use PINO ESP para escolher o GPIO; toque num terminal nomeado do componente para ligar o fio."
        +" Toque as letras com o indicador e use RUN para executar.":"Olhe para a bancada e faça uma pinça/clique para posicionar o ESP32.","ok"); updateButtons(); state.xrRenderer.setAnimationLoop(renderFrame);
      return true;
    }catch(error){
      console.error(error);
      state.checked=true; state.supported=false;
      const denied=error?.name==="NotAllowedError";
      status(denied?"Permissão necessária":"Não foi possível iniciar o WebXR",denied?(state.device==="mobile"?"Autorize a câmera/RA no navegador e tente novamente.":"Autorize o WebXR no navegador do óculos e tente novamente."):(error?.message||"O navegador recusou a sessão WebXR."),"warn");
      try{await state.session?.end();}catch{}
      cleanup(); return false;
    }
  }
  async function exitAR(){ try{ await state.session?.end(); }catch{} }
  function cleanup(){ state.hitSource?.cancel?.(); state.hitSource=null;state.grabbed=null;state.xrTouchStates.clear();state.xrActionTimes.clear();state.wiringMode=false;state.pendingTerminal=null;state.boardLocked=false;state.vrPinPanelOpen=false;state.vrRuntime?.stop?.();state.vrRuntime=null;state.vrRunning=false;state.hardware=null;state.vrHardwareKey=null;state.vrLitKey=null;state.lastWireRefresh=0; state.session=null; state.refSpace=null; state.viewerSpace=null; state.lastHit=null; state.selected=null; state.xrRenderer?.setAnimationLoop(null); if(state.xrScene)window.CodaESPModel?.dispose(state.xrScene);state.xrRenderer?.dispose();state.xrRenderer=null;state.xrScene=null;state.xrCircuit=null;state.xrWires=null;state.xrTable=null;state.xrButtons=[];state.xrPinButtons=[];state.xrHands.clear();state.vrScreen=null;state.vrEditorRoot=null;state.vrKeyboardRoot=null;state.vrPinPanel=null;state.vrLockButton=null;state.canvas?.remove(); state.canvas=null; state.gl=null; updateButtons(); }
  function onEnd(){ cleanup(); setStatus("Sessão encerrada","Você pode entrar novamente quando quiser.",state.supported?"ok":"warn"); }

  function clampMobile(value,min,max){return Math.max(min,Math.min(max,value));}
  function syncMobileLock(){
    const m=state.mobile,button=$("#mobileARLock"),help=$("#mobileARViewHelp"),hint=$("#mobileAROverlayHint");
    if(button){button.disabled=!m.placed;button.setAttribute("aria-pressed",String(m.locked));button.textContent=m.locked?"🔒 Posição fixa":"🔓 Fixar posição";button.classList.toggle("is-locked",m.locked);}
    if(help)help.textContent=!m.placed?"Toque na imagem da mesa para posicionar o ESP32.":m.locked?"Placa fixa nesta imagem. Arraste LEDs e componentes diretamente no modelo 3D; use Conexões para ligar fios.":"Arraste a placa para o local desejado e toque em Fixar posição. Componentes também podem ser arrastados no 3D.";
    if(hint)hint.textContent=!m.placed?"Toque na imagem para colocar o ESP32":m.locked?"Posição fixa na tela • placa e componentes virtuais":"Arraste para mover • fixe quando terminar";
  }
  function updateMobileBoard(){
    const board=$("#mobileARCanvas"); if(!board) return;
    const m=state.mobile;
    board.style.left=`${m.x}%`; board.style.top=`${m.y}%`;
    board.style.transform=`translate(-50%,-50%) scale(${m.scale})`;
    m.renderer?.setView?.({pitch:56,yaw:m.rotation,scale:1});
    syncMobileLock();
  }

  function resetMobileBoard(){
    Object.assign(state.mobile,{placed:false,locked:false,x:50,y:58,scale:1,rotation:0,dragging:false,pinchDistance:0});
    const board=$("#mobileARCanvas"), reticle=$("#mobileARReticle"), hint=$("#mobileAROverlayHint");
    if(board) board.hidden=true;
    if(reticle) reticle.hidden=false;
    if(hint) hint.textContent="Toque na mesa para colocar o ESP32";
    updateMobileBoard();
  }

  function mobilePoint(event){
    const t=event.touches?.[0]||event.changedTouches?.[0]||event;
    const stage=$("#mobileARStage"), r=stage?.getBoundingClientRect();
    if(!r) return null;
    return {x:Math.max(0,Math.min(100,(t.clientX-r.left)/r.width*100)),y:Math.max(0,Math.min(100,(t.clientY-r.top)/r.height*100)),clientX:t.clientX,clientY:t.clientY};
  }

  function placeMobileFallback(event){
    const p=mobilePoint(event); if(!p) return;
    const m=state.mobile, board=$("#mobileARCanvas"), reticle=$("#mobileARReticle"), hint=$("#mobileAROverlayHint");
    if(!m.placed){
      m.placed=true; m.x=p.x; m.y=p.y;
      if(board) board.hidden=false; if(reticle) reticle.hidden=true;
      syncMobileLock();
      updateMobileBoard();
    }
  }

  function touchDistance(event){
    if(!event.touches || event.touches.length<2)return 0;
    return Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);
  }
  function startMobileDrag(event){
    const m=state.mobile;
    if(!m.placed)return;
    if(event.touches?.length>=2){m.dragging=false;m.pinchDistance=touchDistance(event);return;}
    if(m.locked || m.renderer?.pickComponentAt?.(event))return;
    event.preventDefault();
    const p=mobilePoint(event); if(!p)return;
    m.dragging=true;
    m.dragDx=p.x-m.x;m.dragDy=p.y-m.y;
  }
  function moveMobileDrag(event){
    const m=state.mobile;
    if(event.touches?.length>=2){
      const dist=touchDistance(event);
      if(m.pinchDistance&&dist){event.preventDefault();m.scale=clampMobile(m.scale*dist/m.pinchDistance,.55,2.2);m.pinchDistance=dist;updateMobileBoard();}
      m.dragging=false;return;
    }
    if(!m.dragging||m.locked)return;
    event.preventDefault();
    const p=mobilePoint(event);if(!p)return;
    m.x=clampMobile(p.x-m.dragDx,12,88);m.y=clampMobile(p.y-m.dragDy,16,85);updateMobileBoard();
  }
  function stopMobileDrag(){state.mobile.dragging=false;state.mobile.pinchDistance=0;}

  async function openCameraFallback(){
    // Não inicia uma segunda câmera se o usuário tocar duas vezes.
    if(state.mobile.fallback && state.mobile.stream?.active) return true;
    if(state.mobile.opening) return false;
    if(!window.isSecureContext){
      setMobileStatus("HTTPS necessário","Abra o CODA pelo endereço HTTPS do site para permitir o uso da câmera.","warn");
      return false;
    }
    if(!navigator.mediaDevices?.getUserMedia){
      setMobileStatus("Câmera indisponível","Abra no Chrome (Android) ou Safari (iPhone), pelo link HTTPS, e permita a câmera nas configurações do site.","warn");
      return false;
    }
    const button=$("#openMobileAR");
    state.mobile.opening=true;
    if(button) button.disabled=true;
    setMobileStatus("Solicitando a câmera","Autorize a câmera traseira quando o navegador perguntar.");
    let stream=null;
    try{
      // Resolução moderada mantém a câmera responsiva em aparelhos mais simples.
      try{
        stream=await navigator.mediaDevices.getUserMedia({
          video:{facingMode:{ideal:"environment"},width:{ideal:960},height:{ideal:720},frameRate:{ideal:24,max:30}},audio:false
        });
      }catch(error){
        if(error?.name!=="OverconstrainedError" && error?.name!=="NotFoundError") throw error;
        // Alguns navegadores não reconhecem os limites de resolução ou facingMode.
        stream=await navigator.mediaDevices.getUserMedia({video:true,audio:false});
      }
      const overlay=$("#mobileAROverlay"), video=$("#mobileARVideo"), canvas=$("#mobileARCanvas");
      if(!overlay || !video) throw new Error("A interface da câmera não foi encontrada. Atualize a página e tente novamente.");
      video.muted=true;
      video.autoplay=true;
      video.playsInline=true;
      video.setAttribute("playsinline","");
      video.srcObject=stream;
      overlay.hidden=false;
      overlay.setAttribute("aria-hidden","false");
      document.documentElement.classList.add("mobile-ar-open");
      // Não ocultar falha de reprodução: sem play() a câmera parece uma tela preta.
      await video.play();
      if(!video.videoWidth){
        await new Promise((resolve,reject)=>{
          const timeout=setTimeout(()=>{ cleanup(); reject(new Error("A câmera abriu, mas não enviou imagem. Feche outros aplicativos que estejam usando a câmera e tente novamente.")); },5500);
          const cleanup=()=>{ clearTimeout(timeout); video.removeEventListener("loadedmetadata",onReady); };
          const onReady=()=>{ cleanup(); resolve(); };
          video.addEventListener("loadedmetadata",onReady,{once:true});
          if(video.videoWidth) onReady();
        });
      }
      state.mobile.stream=stream;
      state.mobile.fallback=true;
      if(canvas){
        state.mobile.renderer?.destroy?.();
        state.mobile.renderer=window.CodaESP3D?.createOverlay?.(canvas,{
          onComponentMove(id,x,z,done){window.dispatchEvent(new CustomEvent("coda-ar-component-move",{detail:{id,x,z,done}}));}
        })||null;
        state.mobile.renderer?.setProject?.("blink");
      }
      resetMobileBoard();
      window.dispatchEvent(new CustomEvent("coda-mobile-ar-open"));
      setMobileStatus("Câmera funcionando","Modo sobreposição disponível: toque na imagem, posicione e fixe a placa. A posição não acompanha a mesa se você mover o celular.","ok");
      return true;
    }catch(error){
      stream?.getTracks?.().forEach(track=>track.stop());
      state.mobile.stream=null;
      state.mobile.fallback=false;
      const video=$("#mobileARVideo"),overlay=$("#mobileAROverlay");
      if(video){ video.pause(); video.srcObject=null; }
      if(overlay){ overlay.hidden=true; overlay.setAttribute("aria-hidden","true"); }
      document.documentElement.classList.remove("mobile-ar-open");
      const denied=error?.name==="NotAllowedError"||error?.name==="SecurityError"||error?.name==="PermissionDeniedError";
      const busy=error?.name==="NotReadableError"||error?.name==="TrackStartError";
      setMobileStatus(denied?"Acesso à câmera bloqueado":busy?"Câmera em uso":"Não foi possível exibir a câmera",
        denied?"No navegador, toque no cadeado/ícone do site e permita Câmera. Depois tente novamente.":
        busy?"Feche outros aplicativos que usam a câmera e tente de novo.":
        (error?.message||"Confira a permissão da câmera e tente novamente."),"warn");
      console.warn("CODA RA mobile:",error);
      return false;
    }finally{
      state.mobile.opening=false;
      if(button) button.disabled=false;
    }
  }

  function closeMobileAR(){
    window.dispatchEvent(new CustomEvent("coda-mobile-ar-close"));
    if(state.session && state.device==="mobile"){ state.session.end().catch(()=>{}); }
    state.mobile.stream?.getTracks?.().forEach(track=>track.stop());
    state.mobile.stream=null; state.mobile.fallback=false;
    state.mobile.renderer?.destroy?.(); state.mobile.renderer=null;
    const video=$("#mobileARVideo"), overlay=$("#mobileAROverlay");
    if(video) video.srcObject=null;
    if(overlay){ overlay.hidden=true; overlay.setAttribute("aria-hidden","true"); }
    document.documentElement.classList.remove("mobile-ar-open");
    resetMobileBoard();
  }

  async function enterMobileAR(){
    // A ação "RA no celular" abre a câmera diretamente. Evita que a tentativa
    // WebXR (frequentemente indisponível em iOS/Android) impeça a câmera comum.
    // O botão "RA com óculos" continua usando WebXR immersive-ar normalmente.
    return openCameraFallback();
  }

  function activateMobile(){
    if(!window.isSecureContext){ setMobileStatus("HTTPS necessário","Para usar a câmera no celular, abra o CODA por HTTPS.","warn"); return; }
    setMobileStatus("Câmera disponível","Toque em “RA no celular” ou “Abrir câmera em RA” e autorize a câmera. A placa 3D aparece sobre a imagem depois que você tocar na mesa.","ok");
  }

  function bind(){
    $$('[data-ar-mode]').forEach(btn=>btn.addEventListener("click",()=>{ $$('[data-ar-mode]').forEach(x=>x.classList.toggle("active",x===btn)); state.mode=btn.dataset.arMode; $("#arLabTools").hidden=state.mode!=="lab"; updateButtons(); }));
    $$('[data-xr-experience]').forEach(btn=>btn.addEventListener("click",()=>{state.experience=btn.dataset.xrExperience;$$('[data-xr-experience]').forEach(x=>{const active=x===btn;x.classList.toggle("active",active);x.setAttribute("aria-checked",String(active))});if(state.experience==="vr"){state.mode="lab";$$('[data-ar-mode]').forEach(x=>x.classList.toggle("active",x.dataset.arMode==="lab"));$("#arLabTools").hidden=false;}state.checked=false;checkSupport();}));
    $("#enterAR")?.addEventListener("click",enterAR); $("#exitAR")?.addEventListener("click",exitAR);
    $("#openMobileAR")?.addEventListener("click",enterMobileAR);
    $("#closeMobileAR")?.addEventListener("click",closeMobileAR);
    $("#mobileARStage")?.addEventListener("click",placeMobileFallback);
    $("#mobileARCanvas")?.addEventListener("pointerdown",startMobileDrag);
    window.addEventListener("pointermove",moveMobileDrag,{passive:false}); window.addEventListener("pointerup",stopMobileDrag);
    $("#mobileARCanvas")?.addEventListener("touchstart",startMobileDrag,{passive:false});
    window.addEventListener("touchmove",moveMobileDrag,{passive:false}); window.addEventListener("touchend",stopMobileDrag);
    $("#mobileARSmaller")?.addEventListener("click",()=>{state.mobile.scale=Math.max(.55,state.mobile.scale-.1);updateMobileBoard();});
    $("#mobileARLarger")?.addEventListener("click",()=>{state.mobile.scale=Math.min(2.2,state.mobile.scale+.1);updateMobileBoard();});
    $("#mobileARRotateLeft")?.addEventListener("click",()=>{state.mobile.rotation-=12;updateMobileBoard();});
    $("#mobileARRotateRight")?.addEventListener("click",()=>{state.mobile.rotation+=12;updateMobileBoard();});
    $("#mobileARReset")?.addEventListener("click",resetMobileBoard);
    $("#mobileARLock")?.addEventListener("click",()=>{
      if(!state.mobile.placed)return;
      state.mobile.locked=!state.mobile.locked;
      state.mobile.dragging=false;
      syncMobileLock();
      toast(state.mobile.locked?"Placa fixa nesta imagem da câmera":"Placa desbloqueada. Arraste para mover.");
    });
    syncMobileLock();
    $("#checkAR")?.addEventListener("click",checkSupport);
    $("#arImportCircuit")?.addEventListener("click",importPrototype);
    $("#arAddLed")?.addEventListener("click",()=>addComponent("led")); $("#arAddResistor")?.addEventListener("click",()=>addComponent("resistor"));
    $("#arClearComponents")?.addEventListener("click",()=>{state.components=[];state.xrConnections=[];state.xrWiresDirty=true;state.selected=null;renderComponentList();updateButtons();});
    $("#arRotateLeft")?.addEventListener("click",()=>{state.rotation-=Math.PI/12;state.xrWiresDirty=true;}); $("#arRotateRight")?.addEventListener("click",()=>{state.rotation+=Math.PI/12;state.xrWiresDirty=true;});
    $("#arScaleDown")?.addEventListener("click",()=>state.scale=Math.max(.55,state.scale-.1)); $("#arScaleUp")?.addEventListener("click",()=>state.scale=Math.min(2,state.scale+.1));
    renderComponentList(); updateButtons();
    // Detecção passiva para atualizar o texto, sem ser requisito para o clique único.
    setTimeout(()=>{ if(!state.session) checkSupport(); },250);
  }
  function activate(){ if(!state.checked) checkSupport(); }
  // Os módulos são inseridos dinamicamente após o carregamento da página.
  // Se DOMContentLoaded já passou, ligar os botões imediatamente.
  if(document.readyState === "loading") document.addEventListener("DOMContentLoaded",bind,{once:true});
  else bind();
  window.CodaAR={checkSupport,enterAR,exitAR,activate,enterMobileAR,closeMobileAR,activateMobile,state,setHardware(snapshot){state.hardware=snapshot;},importPrototype};
})();
