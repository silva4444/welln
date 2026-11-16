const DEFAULTS={
  minCutoff:1.7,
  beta:.18,
  derivativeCutoff:1,
  pinchStartRatio:.28,
  pinchReleaseRatio:.44,
  trackingGraceMs:260,
  forgetAfterMs:1800
};

const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const midpoint=(a,b)=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2,z:(a.z+b.z)/2});

class LowPassFilter{
  constructor(){this.initialized=false;this.value=0;}
  filter(value,alpha){
    if(!this.initialized){this.value=value;this.initialized=true;return value;}
    this.value=alpha*value+(1-alpha)*this.value;return this.value;
  }
  reset(){this.initialized=false;this.value=0;}
}

class OneEuroScalar{
  constructor(options={}){
    this.minCutoff=options.minCutoff??DEFAULTS.minCutoff;
    this.beta=options.beta??DEFAULTS.beta;
    this.derivativeCutoff=options.derivativeCutoff??DEFAULTS.derivativeCutoff;
    this.valueFilter=new LowPassFilter();this.derivativeFilter=new LowPassFilter();
    this.lastValue=0;this.lastTime=null;
  }
  alpha(cutoff,dt){const tau=1/(2*Math.PI*Math.max(.001,cutoff));return 1/(1+tau/Math.max(.001,dt));}
  filter(value,timeMs){
    const dt=this.lastTime===null?1/60:clamp((timeMs-this.lastTime)/1000,1/240,.1);
    const derivative=this.lastTime===null?0:(value-this.lastValue)/dt;
    const smoothDerivative=this.derivativeFilter.filter(derivative,this.alpha(this.derivativeCutoff,dt));
    const cutoff=this.minCutoff+this.beta*Math.abs(smoothDerivative);
    const result=this.valueFilter.filter(value,this.alpha(cutoff,dt));
    this.lastValue=value;this.lastTime=timeMs;return result;
  }
}

class OneEuroVector3{
  constructor(options={}){this.x=new OneEuroScalar(options);this.y=new OneEuroScalar(options);this.z=new OneEuroScalar(options);}
  filter(point,timeMs){return{x:this.x.filter(point.x,timeMs),y:this.y.filter(point.y,timeMs),z:this.z.filter(point.z,timeMs)};}
}

function nextPinchState(previous,ratio,options={}){
  const start=options.pinchStartRatio??DEFAULTS.pinchStartRatio;
  const release=Math.max(start+.02,options.pinchReleaseRatio??DEFAULTS.pinchReleaseRatio);
  return previous?ratio<release:ratio<start;
}

class HandGestureTracker{
  constructor(options={}){
    this.options={...DEFAULTS,...options};this.hands=new Map();this.sourceIds=new WeakMap();this.nextSourceId=1;
  }
  idFor(source){
    if(source.handedness&&source.handedness!=="none")return source.handedness;
    if(!this.sourceIds.has(source))this.sourceIds.set(source,`hand-${this.nextSourceId++}`);
    return this.sourceIds.get(source);
  }
  readJoint(frame,source,name){
    const space=source.hand?.get(name),pose=space&&frame.getJointPose?.(space,this.referenceSpace);
    if(!pose)return null;const p=pose.transform.position;return{x:p.x,y:p.y,z:p.z};
  }
  stateFor(id){
    if(!this.hands.has(id))this.hands.set(id,{id,pinching:false,lastSeen:0,lastSample:null,filters:new Map()});
    return this.hands.get(id);
  }
  filtered(hand,name,value,timeMs){
    if(!hand.filters.has(name))hand.filters.set(name,new OneEuroVector3(this.options));
    return hand.filters.get(name).filter(value,timeMs);
  }
  update(frame,inputSources,referenceSpace,timeMs=performance.now()){
    this.referenceSpace=referenceSpace;const samples=[];const seen=new Set();
    for(const source of inputSources||[]){
      if(!source.hand)continue;
      const id=this.idFor(source),hand=this.stateFor(id);
      const raw={
        wrist:this.readJoint(frame,source,"wrist"),
        thumbTip:this.readJoint(frame,source,"thumb-tip"),
        indexTip:this.readJoint(frame,source,"index-finger-tip"),
        indexBase:this.readJoint(frame,source,"index-finger-metacarpal"),
        middleBase:this.readJoint(frame,source,"middle-finger-metacarpal")||this.readJoint(frame,source,"middle-finger-phalanx-proximal")
      };
      if(!raw.wrist||!raw.thumbTip||!raw.indexTip||!(raw.middleBase||raw.indexBase))continue;
      seen.add(id);
      const filtered={};for(const [name,value] of Object.entries(raw))if(value)filtered[name]=this.filtered(hand,name,value,timeMs);
      const palmSize=Math.max(.035,distance(filtered.wrist,filtered.middleBase||filtered.indexBase));
      const pinchRatio=distance(filtered.thumbTip,filtered.indexTip)/palmSize;
      const wasPinching=hand.pinching;hand.pinching=nextPinchState(wasPinching,pinchRatio,this.options);hand.lastSeen=timeMs;
      const sample={id,handedness:source.handedness||"none",source,tracked:true,stale:false,pinching:hand.pinching,started:!wasPinching&&hand.pinching,ended:wasPinching&&!hand.pinching,pinchRatio,indexTip:filtered.indexTip,pinchPoint:midpoint(filtered.thumbTip,filtered.indexTip),wrist:filtered.wrist};
      hand.lastSample=sample;samples.push(sample);
    }
    for(const [id,hand] of this.hands){
      if(seen.has(id)||!hand.lastSample)continue;const missingFor=timeMs-hand.lastSeen;
      if(missingFor<=this.options.trackingGraceMs){samples.push({...hand.lastSample,tracked:false,stale:true,started:false,ended:false});continue;}
      if(hand.pinching){hand.pinching=false;samples.push({...hand.lastSample,tracked:false,stale:true,pinching:false,started:false,ended:true,lost:true});}
      if(missingFor>this.options.forgetAfterMs)this.hands.delete(id);
    }
    return samples;
  }
  reset(){this.hands.clear();this.sourceIds=new WeakMap();this.nextSourceId=1;}
}

const api={DEFAULTS,LowPassFilter,OneEuroScalar,OneEuroVector3,HandGestureTracker,nextPinchState,distance,midpoint};
if(typeof window!=="undefined")window.CodaXRHandControls=api;
export{DEFAULTS,LowPassFilter,OneEuroScalar,OneEuroVector3,HandGestureTracker,nextPinchState,distance,midpoint};
