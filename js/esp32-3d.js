(() => {
  'use strict';
  const T=window.THREE, model=window.CodaESPModel;
  if(!T||!model)return;
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const instances=new Set();
  function createRenderer(canvas,options={}) {
    if(!canvas)return null;
    let renderer;
    try{
      const attributes={alpha:true,antialias:true,powerPreference:'low-power'};
      const context=canvas.getContext('webgl2',attributes)||canvas.getContext('webgl',attributes);
      renderer=context?new T.WebGLRenderer({canvas,context,...attributes}):new window.CodaESPSoftwareRenderer(canvas);
    }catch(error){canvas.dataset.rendererError='canvas';return null;}
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.CodaDeviceMode?.isMobile?.()?1.5:2));
    renderer.outputEncoding=T.sRGBEncoding;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
    renderer.shadowMap.enabled=!options.transparent;renderer.shadowMap.type=T.PCFSoftShadowMap;
    const scene=new T.Scene(), camera=new T.PerspectiveCamera(42,1,.05,100);
    scene.add(new T.HemisphereLight('#e6f3ff','#596675',1.4));
    const key=new T.DirectionalLight('#fff1dc',2.3);key.position.set(-3,7,5);key.castShadow=!options.transparent;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-6;key.shadow.camera.right=6;key.shadow.camera.top=6;key.shadow.camera.bottom=-6;key.shadow.normalBias=.02;scene.add(key);
    const fill=new T.DirectionalLight('#80caff',1.6);fill.position.set(4,3,-5);scene.add(fill);
    const board=model.createBoard();board.position.y=.44;scene.add(board);
    const parts=new T.Group(),wires=new T.Group();scene.add(parts,wires);
    const grid=new T.GridHelper(14,28,'#294653','#172c38');grid.position.y=.002;grid.visible=!options.transparent;scene.add(grid);
    const table=new T.Mesh(new T.PlaneGeometry(16,16),new T.ShadowMaterial({opacity:.25}));table.rotation.x=-Math.PI/2;table.receiveShadow=true;table.visible=!options.transparent;scene.add(table);
    const state={components:[],wires:[],pitch:54,yaw:-23,zoom:1,simulating:false,outputs:null,powered:true,boot:false,auto:false,selected:null};
    let destroyed=false,frame=0,last=0;
    let onRender=()=>{};
    const projectPoint=p=>p.clone().project(camera);
    const componentPosition=item=>new T.Vector3(options.builder?clamp((Number(item.x??50)-50)/12,-3.5,3.5):Number(item.x||0),.44,options.builder?clamp((Number(item.y??50)-50)/12,-2.4,2.4):Number(item.z||0));
    function endpoint(value){
      const [owner,terminal]=String(value||'').split(':');
      if(owner==='ESP32'||owner==='PIN'){const point=model.pinPoint(terminal);return point?board.localToWorld(point):null;}
      const part=parts.children.find(p=>String(p.userData.id)===owner);if(!part)return null;
      const point=part.userData.terminals[terminal==='K'?'B':terminal];return point?part.localToWorld(point.clone()):null;
    }
    function clear(group){model.dispose(group);group.clear();}
    function drawMobileCircuit(circuit){api.update(circuit);}
    function rebuild(){
      clear(parts);clear(wires);
      for(const item of state.components){const part=model.createPart(item);part.userData.id=String(item.id);part.position.copy(componentPosition(item));part.rotation.y=-Number(item.rotation||0)*Math.PI/180;part.scale.setScalar(clamp(Number(item.scale||1),.5,1.8));parts.add(part);}
      scene.updateMatrixWorld(true);
      state.wires.forEach((wire,i)=>{const [a,b]=Array.isArray(wire)?wire:[wire.a,wire.b];const start=endpoint(a),end=endpoint(b);if(start&&end){const mesh=model.wire(wires,start,end,wire.color||(['#f0bf56','#6bd3fa','#eb757b','#9acd82'][i%4]));mesh.userData.wireIndex=i;}});
      refreshHardware();requestRender();
    }
    function refreshHardware(){
      board.userData.setHardware({outputs:state.outputs||{},powered:state.powered,boot:state.boot,reset:state.reset});
      let lit={};
      if(state.outputs&&window.CodaARLabCore){try{lit=window.CodaARLabCore.simulateLedStates(state,state.outputs);}catch{}}
      for(const part of parts.children){const item=state.components.find(v=>String(v.id)===part.userData.id);part.userData.setActive?.(state.powered&&(state.outputs?(Boolean(lit[item?.id])||item?.type!=='led'&&Boolean(state.outputs[Number(String(item?.pin||'').replace('GPIO',''))])):Boolean(item?.active)));}
    }
    function render(time=0){
      frame=0;if(destroyed)return;
      const rect=canvas.getBoundingClientRect();if(rect.width<2||rect.height<2||canvas.hidden)return;
      renderer.setSize(rect.width,rect.height,false);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
      if(state.auto){state.yaw+=Math.min(50,time-last||16)*.008;}last=time;
      const distance=(options.builder?Math.max(9,6.9/camera.aspect):options.transparent?Math.max(7,4.9/camera.aspect):Math.max(6.4,4.4/camera.aspect))/state.zoom;
      const pitch=state.pitch*Math.PI/180,yaw=state.yaw*Math.PI/180,center=new T.Vector3(options.transparent?.72:0,.45,0);
      camera.position.set(center.x+Math.sin(yaw)*Math.cos(pitch)*distance,.45+Math.sin(pitch)*distance,Math.cos(yaw)*Math.cos(pitch)*distance);camera.lookAt(center);camera.updateMatrixWorld();
      renderer.render(scene,camera);onRender(api);
      if(state.auto)frame=requestAnimationFrame(render);
    }
    function requestRender(){if(!destroyed&&!frame)frame=requestAnimationFrame(render);}
    function setView(next={}){if(Number.isFinite(next.pitch))state.pitch=clamp(next.pitch,12,88);if(Number.isFinite(next.yaw))state.yaw=next.yaw;if(Number.isFinite(next.scale))state.zoom=clamp(next.scale,.55,2.3);requestRender();}
    const raycaster=new T.Raycaster();let down=null,draggedPart=null;
    const setPointerRay=event=>{
      const rect=canvas.getBoundingClientRect();
      const point=event.touches?.[0]||event.changedTouches?.[0]||event;
      raycaster.setFromCamera(new T.Vector2((point.clientX-rect.left)/rect.width*2-1,-(point.clientY-rect.top)/rect.height*2+1),camera);
    };
    const pickComponentAt=event=>{
      if(!options.onComponentMove || !state.components.length)return null;
      setPointerRay(event);
      const hit=raycaster.intersectObjects(parts.children,true)[0];
      if(!hit)return null;
      let item=hit.object;
      while(item && item.parent!==parts)item=item.parent;
      return item && item.parent===parts ? item.userData.id : null;
    };
    const press=event=>{
      down={x:event.clientX,y:event.clientY};
      const id=pickComponentAt(event);
      if(id && event.isPrimary!==false){
        draggedPart=id;
        canvas.setPointerCapture?.(event.pointerId);
        event.preventDefault();
      }
    };
    const movePart=event=>{
      if(!draggedPart)return;
      event.preventDefault();
      setPointerRay(event);
      const hit=new T.Vector3();
      const plane=new T.Plane(new T.Vector3(0,1,0),-.44);
      if(raycaster.ray.intersectPlane(plane,hit)){
        const x=clamp(hit.x,.85,3.6),z=clamp(hit.z,-1.8,1.8);
        const part=parts.children.find(p=>p.userData.id===draggedPart);
        if(part){part.position.set(x,.44,z);requestRender();}
        options.onComponentMove?.(draggedPart,x,z,false);
      }
    };
    const finishPart=event=>{
      if(!draggedPart)return;
      const id=draggedPart;draggedPart=null;
      const part=parts.children.find(p=>p.userData.id===id);
      if(part)options.onComponentMove?.(id,part.position.x,part.position.z,true);
      try{canvas.releasePointerCapture?.(event.pointerId);}catch{}
    };
    const click=event=>{if(draggedPart||!down||Math.hypot(event.clientX-down.x,event.clientY-down.y)>5)return;const rect=canvas.getBoundingClientRect();raycaster.setFromCamera(new T.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),camera);const hits=raycaster.intersectObjects([board,...wires.children],true),hit=hits[0]?.object;if(hit?.userData.hardwareButton)window.dispatchEvent(new CustomEvent('coda-hardware-action',{detail:{canvasId:canvas.id,action:hit.userData.hardwareButton}}));else if(Number.isInteger(hit?.userData.wireIndex))canvas.dispatchEvent(new CustomEvent('circuit-wire-selected',{bubbles:true,detail:{canvasId:canvas.id,index:hit.userData.wireIndex}}));};
    canvas.addEventListener('pointerdown',press);canvas.addEventListener('pointermove',movePart);canvas.addEventListener('pointerup',finishPart);canvas.addEventListener('pointercancel',finishPart);canvas.addEventListener('pointerup',click);
    const observer=new ResizeObserver(requestRender);observer.observe(canvas);
    const contextLost=event=>{event.preventDefault();canvas.dataset.rendererError='context';};canvas.addEventListener('webglcontextlost',contextLost);
    const api={canvas,scene,camera,renderer,board,state,parts,wires,endpoint,componentPosition,projectPoint,requestRender,setView,
      set onRender(value){onRender=value;},
      update(snapshot={}){state.components=Array.isArray(snapshot.components)?snapshot.components:[];state.wires=Array.isArray(snapshot.wires)?snapshot.wires:[];state.simulating=Boolean(snapshot.simulating);if(snapshot.lit)state.components=state.components.map(item=>({...item,active:Boolean(snapshot.lit[item.id])}));rebuild();},
      setCircuit(circuit){drawMobileCircuit(circuit||{});},
      pickComponentAt,
      moveComponent(id,x,z){const part=parts.children.find(p=>p.userData.id===id);if(part){part.position.set(x,.44,z);requestRender();}},
      setProject(project){
        const id=typeof project==='string'?project:project?.id;
        if(id==='sensor'){
          api.update({components:[{id:'HC1',type:'sensor',x:1.9,z:-.6},{id:'R1',type:'resistor',ohms:1000,x:1.7,z:.4},{id:'R2',type:'resistor',ohms:2000,x:2.6,z:.4}],wires:[['ESP32:VIN','HC1:VCC'],['HC1:GND','ESP32:GND'],['ESP32:GPIO5','HC1:TRIG'],['HC1:ECHO','R1:A'],['R1:B','ESP32:GPIO18'],['R1:B','R2:A'],['R2:B','ESP32:GND']]});return;
        }
        const pins=id==='traffic'?[18,19,21]:[2],components=[],edges=[];
        pins.forEach((pin,i)=>{components.push({id:`R${i}`,type:'resistor',ohms:220,value:100,x:1.65,z:-.8+i*.65},{id:`LED${i}`,type:'led',pin:`GPIO${pin}`,color:['#f45e67','#f0bd4d','#74d39c'][i],x:2.32,z:-.8+i*.65});edges.push([`ESP32:GPIO${pin}`,`R${i}:A`],[`R${i}:B`,`LED${i}:A`],[`LED${i}:B`,'ESP32:GND']);});api.update({components,wires:edges});
      },
      setHardware(next){Object.assign(state,{outputs:next.outputs||{},powered:next.powered!==false,boot:Boolean(next.boot),reset:Boolean(next.reset)});refreshHardware();requestRender();},
      releaseHardware(){state.outputs=null;refreshHardware();requestRender();},
      toggleGrid(){grid.visible=!grid.visible;table.visible=grid.visible;requestRender();return grid.visible;},
      toggleRotate(){state.auto=!state.auto;requestRender();return state.auto;},
      destroy(){destroyed=true;cancelAnimationFrame(frame);observer.disconnect();canvas.removeEventListener('pointerdown',press);canvas.removeEventListener('pointermove',movePart);canvas.removeEventListener('pointerup',finishPart);canvas.removeEventListener('pointercancel',finishPart);canvas.removeEventListener('pointerup',click);canvas.removeEventListener('webglcontextlost',contextLost);model.dispose(scene);renderer.dispose();instances.delete(api);}
    };
    canvas.dataset.renderer=renderer.isSoftwareRenderer?'software-3d':options.builder?'webgl-circuit-3d':'webgl-3d';canvas.dataset.model='esp32-reference-38';instances.add(api);requestRender();return api;
  }
  let main=null;
  window.CodaESPScene={createRenderer,instances};
  window.CodaESP3D={mount(canvas,options={}){if(main?.canvas===canvas)return main;main?.destroy();main=createRenderer(canvas,options);return main;},get renderer(){return main;},setProject(project){main?.setProject(project);},setView(view){main?.setView(view);},createOverlay(canvas,options={}){return createRenderer(canvas,{transparent:true,...options});}};
})();
