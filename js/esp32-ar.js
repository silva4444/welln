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
    grabbed: null, xrButtons: [], xrHands: new Map(), xrInputStates: new Map(),
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
    try{runtime.start(state.vrCode||VR_DEMO);state.vrRunning=true;state.vrEditorMessage="● EXECUTANDO NO ESP32 VIRTUAL";}
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

  function vrButton(parent,label,action,x,y,w=.16,h=.065,color="#152b35"){
    const T=window.THREE,button=new T.Mesh(new T.BoxGeometry(w,h,.022),new T.MeshStandardMaterial({color,roughness:.68,metalness:.08}));
    button.position.set(x,y,.025);button.userData.xrAction=action;button.userData.xrInteractive=true;
    const face=new T.Mesh(new T.PlaneGeometry(w*.92,h*.78),labelMaterial(label,{width:384,height:112,bg:color,accent:action==="run"?"#b9ff3b":"#557984",font:40}));face.position.z=.012;button.add(face);parent.add(button);state.xrButtons.push(button);return button;
  }

  function buildVREditor(scene){
    const T=window.THREE,root=new T.Group();root.name="CODA_VR_EDITOR";root.position.set(-.58,1.38,-1.62);root.rotation.y=.10;scene.add(root);
    const panel=new T.Mesh(new T.BoxGeometry(1.05,.78,.035),new T.MeshStandardMaterial({color:0x071218,roughness:.72,metalness:.12}));root.add(panel);
    const screenData=canvasTexture(1024,620),screen=new T.Mesh(new T.PlaneGeometry(.96,.57),new T.MeshBasicMaterial({map:screenData.texture}));screen.position.set(0,.07,.02);root.add(screen);
    state.vrScreen=screenData;
    [["BLINK","template:blink",-.39,-.31,.16],["HIGH","template:high",-.21,-.31,.15],["LOW","template:low",-.045,-.31,.14],["+ LED","add:led",.115,-.31,.15],["+ R","add:resistor",.275,-.31,.14],["▶ RUN","run",.43,-.31,.16]].forEach(([label,action,x,y,w])=>vrButton(root,label,action,x,y,w,.065,action==="run"?"#416b19":"#15303b"));

    const keyboard=new T.Group();keyboard.name="CODA_VR_KEYBOARD";keyboard.position.set(.64,1.13,-1.48);keyboard.rotation.set(-.17,-.12,0);scene.add(keyboard);
    const base=new T.Mesh(new T.BoxGeometry(1.22,.66,.04),new T.MeshStandardMaterial({color:0x09171e,roughness:.75,metalness:.1}));keyboard.add(base);
    const rows=["1234567890","qwertyuiop","asdfghjkl","zxcvbnm","(){};,._=+"];
    rows.forEach((chars,row)=>{const keyW=.098,gap=.011,total=chars.length*(keyW+gap)-gap;[...chars].forEach((char,i)=>vrButton(keyboard,char.toUpperCase(),`key:${char}`,-total/2+keyW/2+i*(keyW+gap),.255-row*.105,keyW,.074,"#132933"));});
    vrButton(keyboard,"SPACE","space",-.35,-.275,.28,.075,"#173642");vrButton(keyboard,"ENTER","enter",-.03,-.275,.24,.075,"#173642");vrButton(keyboard,"⌫", "backspace",.22,-.275,.16,.075,"#43303a");vrButton(keyboard,"STOP", "stop",.42,-.275,.18,.075,"#5a2830");
    state.vrEditorRoot=root;state.vrKeyboardRoot=keyboard;refreshVRScreen();
  }

  function refreshVRScreen(){
    const view=state.vrScreen;if(!view)return;const {ctx,canvas,texture}=view;
    ctx.fillStyle="#061117";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle="#10242d";ctx.fillRect(0,0,canvas.width,76);
    ctx.fillStyle="#e6f4f8";ctx.font="700 34px DM Mono,monospace";ctx.fillText("sketch.ino • EDITOR DENTRO DO VR",32,49);
    ctx.fillStyle=state.vrRunning?"#b9ff3b":"#84a2ad";ctx.textAlign="right";ctx.fillText(state.vrEditorMessage.slice(0,42),canvas.width-30,49);ctx.textAlign="left";
    const lines=(state.vrCode||VR_DEMO).split("\n"),visible=lines.slice(-13);ctx.font="25px DM Mono,monospace";
    visible.forEach((line,index)=>{const y=112+index*34;ctx.fillStyle="#54717c";ctx.fillText(String(lines.length-visible.length+index+1).padStart(2," "),22,y);ctx.fillStyle=/(void|pinMode|digitalWrite|delay|Serial)/.test(line)?"#8ee4ff":"#e8f2f5";ctx.fillText(line.slice(0,65),72,y);});
    ctx.fillStyle="#10242d";ctx.fillRect(0,552,canvas.width,68);ctx.fillStyle="#9eb6be";ctx.font="22px DM Mono,monospace";ctx.fillText(`SERIAL: ${state.vrSerial.at(-1)||"aguardando execução"}`.slice(0,76),28,594);texture.needsUpdate=true;
  }

  function activateVRAction(action){
    if(action==="run")return runVRCode();if(action==="stop")return stopVRCode();
    if(action==="template:blink")state.vrCode=VR_DEMO;else if(action==="template:high")state.vrCode=VR_HIGH;else if(action==="template:low")state.vrCode=VR_LOW;
    else if(action==="add:led")return addComponent("led");else if(action==="add:resistor")return addComponent("resistor");
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
    Object.assign(state,{canvas,gl:renderer.getContext(),xrRenderer:renderer,xrScene:scene,xrCamera:new T.PerspectiveCamera(),xrBoard:board,xrParts:new Map(),xrReticle:reticle,xrRoom:room});
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
  function rayForSource(frame,source){const pose=frame.getPose(source.targetRaySpace,state.refSpace);return pose?rayFromPose(pose):null;}
  function handTip(frame,source){if(!source.hand||!frame.getJointPose)return null;const space=source.hand.get("index-finger-tip"),pose=space&&frame.getJointPose(space,state.refSpace);if(!pose)return null;const p=pose.transform.position;return [p.x,p.y,p.z];}
  function updateGrabbed(frame){
    const grab=state.grabbed;if(!grab)return;const source=[...(state.session?.inputSources||[])].find(item=>item===grab.source);if(!source){state.grabbed=null;return;}
    const tip=handTip(frame,source),ray=rayForSource(frame,source);let p=tip;
    if(!p&&ray)p=[ray.origin[0]+ray.dir[0]*grab.distance,ray.origin[1]+ray.dir[1]*grab.distance,ray.origin[2]+ray.dir[2]*grab.distance];
    if(!p)return;grab.object.x=Math.max(-.78,Math.min(.78,p[0]));grab.object.y=Math.max(.77,Math.min(1.65,p[1]));grab.object.z=Math.max(-1.46,Math.min(-.56,p[2]));grab.object.userPlaced=true;
  }
  function renderFrame(time,frame){
    if(!frame||!state.session)return;
    if(state.hitSource){const hits=frame.getHitTestResults(state.hitSource);state.lastHit=hits[0]?.getPose(state.refSpace)?.transform.matrix||null;}
    updateHands(frame);updateGrabbed(frame);
    const T=window.THREE,model=window.CodaESPModel,board=state.xrBoard,sc=.03*state.scale;
    board.visible=state.placed;board.position.set(state.board.x,state.board.y+.01*state.scale,state.board.z);board.rotation.y=state.rotation;board.scale.setScalar(sc);
    board.userData.setHardware(state.hardware||{});
    const live=new Set(state.components.map(item=>item.id));
    for(const [id,part] of state.xrParts){if(!live.has(id)){state.xrScene.remove(part);model.dispose(part);state.xrParts.delete(id);}}
    for(const item of state.components){
      let part=state.xrParts.get(item.id);if(!part){part=model.createPart({id:item.id,type:item.kind,color:'#ff5b67'});state.xrScene.add(part);state.xrParts.set(item.id,part);}
      part.visible=state.placed;part.position.set(item.x,item.y+.008,item.z);part.scale.setScalar(.03);part.userData.setActive(Boolean(state.hardware?.outputs?.[2])&&item.connected);
    }
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
    const objs=[...(state.mode==="lab"?state.components:[]), ...(state.placed?[state.board]:[])]; let best=null,bestT=1e9;
    for(const o of objs){ const dx=o.x-ray.origin[0],dy=o.y-ray.origin[1],dz=o.z-ray.origin[2]; const t=dx*ray.dir[0]+dy*ray.dir[1]+dz*ray.dir[2]; if(t<0) continue; const px=ray.origin[0]+ray.dir[0]*t,py=ray.origin[1]+ray.dir[1]*t,pz=ray.origin[2]+ray.dir[2]*t; const d=Math.hypot(o.x-px,o.y-py,o.z-pz); const radius=o.kind==="board"?.16:.075; if(d<radius&&t<bestT){best=o;bestT=t;} }
    return best;
  }
  function hitObjectNear(point){
    if(!point)return null;const objects=[...state.components,state.board];let best=null,distance=.16;
    for(const object of objects){const d=Math.hypot(object.x-point[0],object.y-point[1],object.z-point[2]);if(d<distance){best=object;distance=d;}}return best;
  }
  function hitVRButton(ray){
    if(!ray||!state.xrButtons.length)return null;const T=window.THREE,caster=new T.Raycaster(new T.Vector3(...ray.origin),new T.Vector3(...ray.dir).normalize(),0,4);
    return caster.intersectObjects(state.xrButtons,false)[0]?.object||null;
  }
  function onSelectStart(event){
    if(state.experience!=="vr"||state.mode!=="lab")return;
    const frame=event.frame,source=event.inputSource,ray=rayForSource(frame,source),button=hitVRButton(ray);
    if(button){activateVRAction(button.userData.xrAction);button.scale.set(.9,.9,.9);setTimeout(()=>button.scale.set(1,1,1),110);return;}
    const tip=handTip(frame,source),object=hitObjectNear(tip)||hitObject(ray);if(!object)return;
    const grabDistance=tip?.length?0.12:(ray?Math.max(.18,Math.hypot(object.x-ray.origin[0],object.y-ray.origin[1],object.z-ray.origin[2])):.72);
    state.grabbed={source,object,distance:grabDistance};state.selected=object.id;state.vrEditorMessage=`✋ ${object.id} PRESO À MÃO`;refreshVRScreen();updateButtons();
  }
  function onSelectEnd(event){
    if(!state.grabbed||state.grabbed.source!==event.inputSource)return;const object=state.grabbed.object;object.y=.78;state.grabbed=null;state.selected=null;state.vrEditorMessage=`${object.id} POSICIONADO • PRONTO`;refreshVRScreen();updateButtons();
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

  function arrangeComponents(){ if(!state.placed) return; state.components.forEach((o,i)=>{ if(o.userPlaced)return; o.x=state.board.x+0.10+(i%2)*0.055; o.y=state.board.y; o.z=state.board.z-0.03+Math.floor(i/2)*0.06; }); }
  function addComponent(kind){ const id=`${kind==="led"?"LED":"R"}${state.components.filter(x=>x.kind===kind).length+1}`; state.components.push({id,kind,x:state.board.x+0.10,y:state.board.y,z:state.board.z,connected:true,userPlaced:false}); arrangeComponents(); renderComponentList(); state.vrEditorMessage=`${id} ADICIONADO • AGARRE COM A MÃO`;refreshVRScreen();toast(`${kind==="led"?"LED":"Resistor"} adicionado ao laboratório`); }
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
        try{state.vrCode=localStorage.getItem("coda-vr-sketch-v146")||$("#espFirmwareCode")?.value||VR_DEMO;}catch{state.vrCode=VR_DEMO;}
        state.vrEditorMessage="PRONTO • PINÇA PARA AGARRAR OU PROGRAMAR";refreshVRScreen();
      }
      if(state.xrCircuitSnapshot)importPrototype();
      state.refSpace=state.xrRenderer.xr.getReferenceSpace(); state.viewerSpace=await session.requestReferenceSpace("viewer");
      if(state.experience==="ar"){try{ state.hitSource=await session.requestHitTestSource({space:state.viewerSpace}); }catch{ state.hitSource=null; }}else state.hitSource=null;
      session.addEventListener("selectstart",onSelectStart);session.addEventListener("selectend",onSelectEnd);session.addEventListener("select",onSelect);session.addEventListener("end",onEnd);
      status(state.experience==="vr"?"Laboratório VR interativo iniciado":"RA iniciada",state.device==="mobile"?"Aponte para a mesa e toque na tela para posicionar o ESP32.":state.experience==="vr"?"Feche a pinça para agarrar peças. Use o painel Arduino e o teclado virtual para programar sem sair do óculos.":"Olhe para a bancada e faça uma pinça/clique para posicionar o ESP32.","ok"); updateButtons(); state.xrRenderer.setAnimationLoop(renderFrame);
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
  function cleanup(){ state.hitSource?.cancel?.(); state.hitSource=null;state.grabbed=null;state.vrRuntime?.stop?.();state.vrRunning=false; state.session=null; state.refSpace=null; state.viewerSpace=null; state.lastHit=null; state.selected=null; state.xrRenderer?.setAnimationLoop(null); if(state.xrScene)window.CodaESPModel?.dispose(state.xrScene);state.xrRenderer?.dispose();state.xrRenderer=null;state.xrScene=null;state.xrCircuit=null;state.xrButtons=[];state.xrHands.clear();state.vrScreen=null;state.canvas?.remove(); state.canvas=null; state.gl=null; updateButtons(); }
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
    $("#arClearComponents")?.addEventListener("click",()=>{state.components=[];state.selected=null;renderComponentList();updateButtons();});
    $("#arRotateLeft")?.addEventListener("click",()=>state.rotation-=Math.PI/12); $("#arRotateRight")?.addEventListener("click",()=>state.rotation+=Math.PI/12);
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
