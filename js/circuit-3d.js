/* Terminais acessíveis projetados sobre o MESMO modelo usado no visualizador e na RA. */
(() => {
  'use strict';
  const T=window.THREE, model=window.CodaESPModel, renderers=new WeakMap();
  if(!T||!model||!window.CodaESPScene)return;
  let primary=null;
  function createRenderer(canvas){
    const engine=window.CodaESPScene.createRenderer(canvas,{builder:true});if(!engine)return null;
    const stage=canvas.parentElement,overlay=document.createElement('div');overlay.className='circuit-projected-controls';stage.append(overlay);
    const ray=new T.Raycaster(),plane=new T.Plane(new T.Vector3(0,1,0),-.44);
    let controls=[],moving=false,all=false,drag=null,orbit=null,wireDrag=null;
    const main=new Set(['3V3','GND','GND_R','GPIO2','GPIO4','GPIO18','GPIO21','GPIO34','VIN']);
    const guided=canvas.id==='wiring3DCanvas';
    function screen(point){const p=engine.projectPoint(point),r=canvas.getBoundingClientRect();return {x:(p.x*.5+.5)*r.width,y:(-.5*p.y+.5)*r.height,visible:p.z<1};}
    function ground(event){const r=canvas.getBoundingClientRect();ray.setFromCamera(new T.Vector2((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1),engine.camera);return ray.ray.intersectPlane(plane,new T.Vector3());}
    function changed(item){stage.dispatchEvent(new CustomEvent('circuit-piece-moved',{bubbles:true,detail:{id:item.id,x:item.x,y:item.y,canvasId:canvas.id}}));}
    function buildControls(){
      if(moving)return;overlay.replaceChildren();controls=[];
      const connected=new Set(engine.state.wires.flatMap(w=>Array.isArray(w)?w:[w.a,w.b]));
      const toggle=document.createElement('button');toggle.type='button';toggle.className='pin-visibility-toggle';toggle.textContent=all?'Pinos principais':'Todos os 38 pinos';toggle.setAttribute('aria-expanded',String(all));toggle.onclick=()=>{all=!all;buildControls();};overlay.append(toggle);
      const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.classList.add('pin-label-guides');overlay.append(svg);
      const left=document.createElement('div'),right=document.createElement('div');left.className='reference-pin-bank left';right.className='reference-pin-bank right';overlay.append(left,right);
      const originals=[...stage.querySelectorAll(guided?'[data-terminal]':'[data-prototype-terminal]')];
      for(const original of originals){
        const id=guided?original.dataset.terminal:original.dataset.prototypeTerminal;
        const [owner,terminal]=id.split(':');const button=document.createElement('button');button.type='button';button.title=original.getAttribute('aria-label')||id;button.setAttribute('aria-label',button.title);
        let skipClick=false;
        button.onclick=event=>{event.stopPropagation();if(skipClick){skipClick=false;return;}original.click();buildControls();};
        button.onpointerdown=event=>{if(event.button!==0||button.disabled)return;event.stopPropagation();wireDrag={id,x:event.clientX,y:event.clientY,moved:false};button.setPointerCapture(event.pointerId);};
        button.onpointermove=event=>{if(!wireDrag||wireDrag.id!==id)return;if(Math.hypot(event.clientX-wireDrag.x,event.clientY-wireDrag.y)>5)wireDrag.moved=true;};
        button.onpointerup=event=>{if(!wireDrag||wireDrag.id!==id)return;const moved=wireDrag.moved;wireDrag=null;if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);if(!moved)return;skipClick=true;const target=document.elementFromPoint(event.clientX,event.clientY)?.closest('[data-endpoint]');if(target&&!target.disabled&&target.dataset.endpoint!==id)stage.dispatchEvent(new CustomEvent('circuit-wire-request',{bubbles:true,detail:{a:id,b:target.dataset.endpoint,canvasId:canvas.id}}));};
        button.onpointercancel=()=>wireDrag=null;button.classList.toggle('selected',original.classList.contains('selected'));
        if(owner==='ESP32'||owner==='PIN'){
          if(!all&&!main.has(terminal)&&!connected.has(`ESP32:${terminal}`)&&!connected.has(`PIN:${terminal}`))continue;
          button.className+=' board-pin-label';button.textContent=model.label(terminal);button.dataset.endpoint=id;
          (model.left.includes(terminal)?left:right).append(button);
          const line=document.createElementNS(svg.namespaceURI,'line');line.style.display='none';svg.append(line);
          const control={button,line,id};controls.push(control);
          const highlight=()=>{control.highlight=true;engine.requestRender();},unhighlight=()=>{control.highlight=false;line.style.display='none';};
          button.onpointerenter=highlight;button.onfocus=highlight;button.onpointerleave=unhighlight;button.onblur=unhighlight;
          if(model.reserved.has(terminal)){button.disabled=true;button.title=terminal==='EN'?'Reset da placa: use o botão EN':'Reservado para a memória flash';button.setAttribute('aria-label',`${terminal}: ${button.title}`);}
        }else{
          button.textContent=terminal==='K'?'B (−)':terminal;button.dataset.endpoint=id;overlay.append(button);controls.push({button,id});
        }
      }
      for(const item of engine.state.components){
        const original=[...stage.querySelectorAll(guided?'[data-part]':'[data-prototype-id]')].find(n=>(guided?n.dataset.part:n.dataset.prototypeId)===String(item.id));
        const button=document.createElement('button');button.type='button';button.className='piece-handle';button.textContent=item.label||item.id;button.title=`Arraste ${button.textContent} para mover. Setas também movem a peça.`;overlay.append(button);controls.push({button,item});
        button.onpointerdown=event=>{if(event.button!==0)return;event.preventDefault();event.stopPropagation();drag={item,button,start:ground(event),x:event.clientX,y:event.clientY,moved:false};moving=true;button.setPointerCapture(event.pointerId);};
        button.onpointermove=event=>{if(!drag||drag.button!==button)return;if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)<4&&!drag.moved)return;const point=ground(event);if(!point||!drag.start)return;item.x=Math.max(8,Math.min(92,Number(item.x??50)+(point.x-drag.start.x)*12));item.y=Math.max(20,Math.min(80,Number(item.y??50)+(point.z-drag.start.z)*12));drag.start=point;drag.moved=true;engine.update(engine.state);};
        const finish=event=>{if(!drag||drag.button!==button)return;const moved=drag.moved;drag=null;moving=false;if(button.hasPointerCapture(event.pointerId))button.releasePointerCapture(event.pointerId);if(moved)changed(item);else original?.click();};button.onpointerup=finish;button.onpointercancel=finish;
        button.onkeydown=event=>{const d={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];if(!d)return;event.preventDefault();event.stopPropagation();item.x=Math.max(8,Math.min(92,Number(item.x)+d[0]));item.y=Math.max(20,Math.min(80,Number(item.y)+d[1]));engine.update(engine.state);changed(item);};
      }
      position();
    }
    function position(){
      const rect=canvas.getBoundingClientRect();
      for(const control of controls){
        const p=control.item?engine.componentPosition(control.item).add(new T.Vector3(0,.7,0)):engine.endpoint(control.id);if(!p)continue;const s=screen(p);
        if(control.line){
          const b=control.button.getBoundingClientRect();control.line.setAttribute('x1',String(b.left+b.width/2-rect.left));control.line.setAttribute('y1',String(b.top+b.height/2-rect.top));control.line.setAttribute('x2',String(s.x));control.line.setAttribute('y2',String(s.y));control.line.style.display=control.highlight?'':'none';
        }else{control.button.style.left=`${s.x}px`;control.button.style.top=`${s.y}px`;control.button.hidden=!s.visible;}
      }
    }
    engine.onRender=position;
    const pointerDown=event=>{orbit={x:event.clientX,y:event.clientY};canvas.setPointerCapture(event.pointerId);};
    const pointerMove=event=>{if(!orbit)return;engine.setView({yaw:engine.state.yaw+(event.clientX-orbit.x)*.35,pitch:engine.state.pitch-(event.clientY-orbit.y)*.25});orbit={x:event.clientX,y:event.clientY};};
    const pointerUp=()=>orbit=null;
    const wheel=event=>{event.preventDefault();engine.setView({scale:engine.state.zoom-event.deltaY*.001});};
    canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointermove',pointerMove);canvas.addEventListener('pointerup',pointerUp);canvas.addEventListener('pointercancel',pointerUp);canvas.addEventListener('wheel',wheel,{passive:false});
    return {canvas,engine,get snapshot(){return engine.state;},update(snapshot){if(moving)return;engine.update(snapshot);buildControls();},setView:engine.setView,setHardware:engine.setHardware,releaseHardware:engine.releaseHardware,destroy(){overlay.remove();canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointermove',pointerMove);canvas.removeEventListener('pointerup',pointerUp);canvas.removeEventListener('pointercancel',pointerUp);canvas.removeEventListener('wheel',wheel);engine.destroy();}};
  }
  window.CodaCircuit3D={mount(canvas){if(!canvas)return null;if(!renderers.has(canvas))renderers.set(canvas,createRenderer(canvas));const instance=renderers.get(canvas);if(canvas.id==='circuit3DCanvas')primary=instance;return instance;},update(snapshot){primary?.update(snapshot);},setView(view){primary?.setView(view);},get renderer(){return primary;}};
})();
