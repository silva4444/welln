/* Modelo compartilhado, derivado do esp32_3d_web_simulator.html enviado pelo usuário.
 * A geometria 18 x 36, blindagem, USB, antena, CP2102, AMS1117 e os 38 pinos
 * são usados na bancada, no programador, na câmera e no WebXR.
 */
(() => {
  'use strict';
  const T = window.THREE;
  if (!T) return;
  const left = ['3V3','EN','GPIO36','GPIO39','GPIO34','GPIO35','GPIO32','GPIO33','GPIO25','GPIO26','GPIO27','GPIO14','GPIO12','GND','GPIO13','D2','D3','CMD','VIN'];
  const right = ['GND_R','GPIO23','GPIO22','GPIO1','GPIO3','GPIO21','GND_R2','GPIO19','GPIO18','GPIO5','GPIO17','GPIO16','GPIO4','GPIO0','GPIO2','GPIO15','D1','D0','CLK'];
  const reserved = new Set(['D0','D1','D2','D3','CMD','CLK','EN']);
  const pinPoint = name => {
    name = String(name).replace(/^(ESP32|PIN):/, '');
    const a = left.indexOf(name), b = right.indexOf(name);
    return a < 0 && b < 0 ? null : new T.Vector3(a >= 0 ? -.75 : .75, .12, -1.52 + (a >= 0 ? a : b) * .17);
  };
  const label = name => ({GND_R:'GND',GND_R2:'GND',GPIO36:'GPIO36 · VP',GPIO39:'GPIO39 · VN',GPIO1:'TX · GPIO1',GPIO3:'RX · GPIO3',VIN:'VIN / 5V'})[name] || name;
  function material(color, metalness=0, roughness=.6) { return new T.MeshStandardMaterial({color,metalness,roughness}); }
  function box(group,x,y,z,w,h,d,mat) {
    const mesh = new T.Mesh(new T.BoxGeometry(w,h,d),mat);
    mesh.position.set(x,y,z); mesh.castShadow=true; mesh.receiveShadow=true; group.add(mesh); return mesh;
  }
  function cylinder(group,x,y,z,r,h,mat,segments=16) {
    const mesh=new T.Mesh(new T.CylinderGeometry(r,r,h,segments),mat);
    mesh.position.set(x,y,z);mesh.castShadow=true;group.add(mesh);return mesh;
  }
  function textPlane(group,text,x,y,z,width,height,color='#e2e8ed',background=null) {
    const canvas=document.createElement('canvas');canvas.width=width<.5?256:512;canvas.height=canvas.width/2;
    const ctx=canvas.getContext('2d');ctx.scale(canvas.width/1024,canvas.height/512);
    if(background){ctx.fillStyle=background;ctx.fillRect(0,0,1024,512);}
    ctx.fillStyle=color;ctx.textAlign='center';ctx.textBaseline='middle';
    const lines=text.split('\n');ctx.font=`600 ${lines.length>2?70:100}px Arial`;
    lines.forEach((line,i)=>ctx.fillText(line,512,256+(i-(lines.length-1)/2)*112,950));
    const texture=new T.CanvasTexture(canvas);texture.anisotropy=4;
    const mesh=new T.Mesh(new T.PlaneGeometry(width,height),new T.MeshBasicMaterial({map:texture,transparent:!background,depthWrite:false,side:T.DoubleSide}));
    mesh.rotation.x=-Math.PI/2;mesh.position.set(x,y,z);group.add(mesh);return mesh;
  }
  function createBoard() {
    const group=new T.Group();group.name='CODA ESP32 WROOM · reference model';
    const pcb=material('#161a1d',.12,.42), gold=material('#d7b368',.75,.27), silver=material('#cbd5df',.75,.25), black=material('#16191c',.08,.55);
    const shieldMat=material('#bbc4ce',.75,.32);
    const shape=new T.Shape(),w=.9,l=1.8,r=.08;
    shape.moveTo(-w+r,-l);shape.lineTo(w-r,-l);shape.quadraticCurveTo(w,-l,w,-l+r);shape.lineTo(w,l-r);shape.quadraticCurveTo(w,l,w-r,l);shape.lineTo(-w+r,l);shape.quadraticCurveTo(-w,l,-w,l-r);shape.lineTo(-w,-l+r);shape.quadraticCurveTo(-w,-l,-w+r,-l);
    for(const x of [-.59,.59])for(const z of [-1.66,1.66]){const hole=new T.Path();hole.absarc(x,z,.048,0,Math.PI*2,true);shape.holes.push(hole);}
    const geometry=new T.ExtrudeGeometry(shape,{depth:.08,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.008,bevelThickness:.008});geometry.rotateX(-Math.PI/2);
    const base=new T.Mesh(geometry,pcb);base.castShadow=true;base.receiveShadow=true;group.add(base);
    for(const x of [-.59,.59])for(const z of [-1.66,1.66]){
      const ring=new T.Mesh(new T.RingGeometry(.048,.071,20),gold);ring.rotation.x=-Math.PI/2;ring.position.set(x,.09,z);group.add(ring);
    }
    box(group,0,.108,-.68,1.2,.035,1.95,material('#242b24',.15,.7));
    box(group,0,.191,-.5,1.15,.16,1.15,shieldMat);
    textPlane(group,'ESPRESSIF\nESP-WROOM-32\nWi-Fi + Bluetooth',0,.275,-.5,1.0,.85,'#414a53','#bcc5ce');
    box(group,0,.137,-1.4,1.0,.025,.4,black);
    // Antena impressa em meandro, com as ligações alternadas da referência.
    for(let i=0;i<7;i++){
      const x=-.36+i*.12;box(group,x,.153,-1.4,.035,.012,.29,gold);
      if(i<6)box(group,x+.06,.153,-1.4+(i%2?.127:-.127),.12,.012,.035,gold);
    }
    box(group,0,.19,1.6,.55,.22,.6,silver);
    box(group,0,.19,1.905,.45,.12,.017,black);
    box(group,0,.162,1.916,.3,.026,.022,material('#827350',.5,.4));
    for(let i=0;i<5;i++)box(group,-.12+i*.06,.18,1.922,.022,.025,.02,gold);
    box(group,0,.117,.8,.3,.065,.3,black);
    textPlane(group,'CP2102',0,.153,.8,.28,.14,'#939ba3');
    for(let i=0;i<6;i++){
      const k=-.125+i*.05;box(group,k,.113,.986,.025,.028,.07,silver);box(group,k,.113,.614,.025,.028,.07,silver);
      box(group,-.186,.113,.8+k,.07,.028,.025,silver);box(group,.186,.113,.8+k,.07,.028,.025,silver);
    }
    box(group,-.4,.14,1,.4,.1,.25,black);box(group,-.4,.198,1,.18,.012,.22,silver);
    for(let i=0;i<3;i++)box(group,-.52+i*.12,.12,1.18,.055,.04,.12,silver);
    const buttons={};
    for(const [name,x] of [['EN',-.6],['BOOT',.6]]){
      box(group,x,.145,1.45,.25,.12,.25,silver);
      const cap=cylinder(group,x,.235,1.45,.08,.06,black);cap.userData.hardwareButton=name;buttons[name]=cap;
      textPlane(group,name,x,.092,1.2,.28,.14);
    }
    const powerMat=material('#8e2529'), ledMat=material('#143d67');powerMat.emissive=new T.Color('#ff343a');ledMat.emissive=new T.Color('#349aff');
    const power=box(group,-.4,.12,1.3,.08,.04,.12,powerMat),led=box(group,.4,.12,1.3,.08,.04,.12,ledMat);
    box(group,-.75,-.06,0,.12,.18,3.3,black);box(group,.75,-.06,0,.12,.18,3.3,black);
    for(const [side,names] of [[-1,left],[1,right]])names.forEach((name,i)=>{
      const p=pinPoint(name);box(group,p.x,-.06,p.z,.04,.58,.04,gold);
      cylinder(group,p.x,.09,p.z,.055,.012,silver,12);
      const short=name.replace('GPIO','').replace(/GND_R2?/,'GND');
      textPlane(group,short,side*.568,.095,p.z,.24,.1,'#d1dadd');
    });
    // Distribuição determinística: a placa é idêntica em todas as telas.
    for(let i=0;i<18;i++){
      const x=(i%3-1)*.29,z=.18+Math.floor(i/3)*.18;
      if(Math.abs(x)<.15&&z>.5&&z<1)continue;
      const smd=box(group,x,.115,z,.06,.03,.04,i%3===0?material('#b99b67'):black);
      box(group,x-.033,.115,z,.012,.03,.04,silver);box(group,x+.033,.115,z,.012,.03,.04,silver);
      smd.rotation.y=i%2*Math.PI/2;
    }
    textPlane(group,'ESP32 DEVKIT · 38 PIN',0,.092,.12,.93,.15,'#b6c5cd');
    const setHardware=(state={})=>{
      powerMat.emissiveIntensity=state.powered===false?0:.85;
      const high=Boolean(state.outputs?.[2]);ledMat.emissiveIntensity=state.powered===false?0:high?2:0;
      ledMat.color.set(high?'#2798f5':'#12273a');
      buttons.BOOT.position.y=state.boot?.21:.235;buttons.EN.position.y=state.reset?.21:.235;
    };
    setHardware();group.userData.setHardware=setHardware;group.userData.buttons=buttons;
    return group;
  }
  function wire(group,a,b,color='#e2bc58',radius=.018) {
    const start=a.clone(),end=b.clone(),lift=Math.max(a.y,b.y)+.23;
    const curve=new T.CubicBezierCurve3(start,new T.Vector3(a.x,lift,a.z),new T.Vector3(b.x,lift,b.z),end);
    const mesh=new T.Mesh(new T.TubeGeometry(curve,16,radius,6,false),material(color,.15,.38));group.add(mesh);return mesh;
  }
  function createPart(item={}) {
    const group=new T.Group(),metal=material('#b4c3ce',.7,.3),body=material(item.color||'#ea6667',.04,.4),dark=material('#253645');
    const type=String(item.type||item.kind||'led').split(' ')[0];
    const lead=(a,b)=>{const delta=b.clone().sub(a);const mesh=new T.Mesh(new T.CylinderGeometry(.018,.018,delta.length(),8),metal);mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());group.add(mesh);};
    const terms= type==='sensor'?['VCC','TRIG','ECHO','GND']:type==='rgb'?['R','G','B','GND']:type==='button'?['1','2']:type==='display'?['VCC','GND','SDA','SCL']:['battery','capacitor','motor'].includes(type)?['+','-']:['temperature','potentiometer','servo','relay'].includes(type)?['VCC','SIG','GND']:type==='buzzer'?['SIG','GND']:['A','B'];
    const terminals={};terms.forEach((name,i)=>{const p=new T.Vector3((i-(terms.length-1)/2)*.35,.08,0);terminals[name]=p;lead(p,new T.Vector3(p.x,.18,.02));});
    let indicator;
    if(type==='led'||type==='rgb'){
      cylinder(group,0,.25,0,.16,.2,body);const dome=new T.Mesh(new T.SphereGeometry(.16,16,10,0,Math.PI*2,0,Math.PI/2),body);dome.position.y=.35;group.add(dome);
      cylinder(group,0,.16,0,.19,.045,body);body.emissive=new T.Color(item.color||'#ff5252');indicator=body;
    }else if(type==='resistor'){
      const mesh=cylinder(group,0,.2,0,.09,.43,material('#d6b17c'));mesh.rotation.z=Math.PI/2;
      ['#b82020','#b82020','#4d3023','#d3af59'].forEach((color,i)=>{const ring=cylinder(group,-.14+i*.09,.2,0,.093,.033,material(color));ring.rotation.z=Math.PI/2;});
    }else if(type==='potentiometer'){
      cylinder(group,0,.2,0,.24,.23,material('#2981a8'));cylinder(group,0,.4,0,.11,.22,metal);box(group,0,.515,0,.025,.01,.17,dark);
    }else if(type==='button'){
      box(group,0,.19,0,.5,.18,.45,dark);box(group,0,.295,0,.44,.03,.4,metal);indicator=body;cylinder(group,0,.35,0,.13,.12,body);
    }else if(type==='sensor'){
      box(group,0,.16,0,.82,.08,.45,material('#256b92'));for(const x of [-.23,.23]){cylinder(group,x,.31,0,.18,.22,metal);cylinder(group,x,.426,0,.14,.014,dark);}
    }else if(type==='motor'||type==='buzzer'||type==='capacitor'){
      cylinder(group,0,.3,0,.23,.45,type==='motor'?metal:dark);cylinder(group,0,.56,0,.065,.12,metal);
    }else{box(group,0,.25,0,.65,.3,.43,body);box(group,0,.408,0,.48,.018,.3,dark);}
    group.userData.terminals=terminals;
    group.userData.setActive=active=>{if(indicator){indicator.emissive=new T.Color(item.color||'#ff5252');indicator.emissiveIntensity=active?1.5:0;}};
    group.userData.setActive(Boolean(item.active));return group;
  }
  function dispose(root){const geometries=new Set(),materials=new Set(),textures=new Set();root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const mat of [node.material].flat().filter(Boolean)){materials.add(mat);if(mat.map)textures.add(mat.map);}});geometries.forEach(v=>v.dispose());materials.forEach(v=>v.dispose());textures.forEach(v=>v.dispose());}
  window.CodaESPModel={left,right,reserved,pinPoint,label,createBoard,createPart,wire,dispose,box,material,textPlane};
})();
