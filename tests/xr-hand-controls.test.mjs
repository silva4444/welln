import test from "node:test";
import assert from "node:assert/strict";
import {HandGestureTracker,OneEuroScalar,nextPinchState} from "../js/xr-hand-controls.js";

test("pinça usa limiares diferentes para fechar e abrir, evitando oscilação",()=>{
  assert.equal(nextPinchState(false,.27),true);
  assert.equal(nextPinchState(true,.36),true);
  assert.equal(nextPinchState(true,.45),false);
  assert.equal(nextPinchState(false,.36),false);
});

test("filtro One Euro reduz salto sem congelar a resposta",()=>{
  const filter=new OneEuroScalar({minCutoff:1.7,beta:.18});
  assert.equal(filter.filter(0,0),0);
  const first=filter.filter(1,16);
  const second=filter.filter(1,32);
  assert.ok(first>0&&first<1);
  assert.ok(second>first&&second<1);
});

function trackedHand(){
  const positions={
    wrist:{x:0,y:0,z:0},
    "thumb-tip":{x:.02,y:.08,z:0},
    "index-finger-tip":{x:.03,y:.08,z:0},
    "index-finger-metacarpal":{x:.025,y:.07,z:0},
    "middle-finger-metacarpal":{x:0,y:.1,z:0}
  };
  const source={handedness:"right",hand:new Map(Object.keys(positions).map(name=>[name,name]))};
  const frame={getJointPose(space){const position=positions[space];return position?{transform:{position}}:null;}};
  return{source,frame};
}

test("perda curta de rastreamento preserva a pinça e perda longa solta com segurança",()=>{
  const tracker=new HandGestureTracker({trackingGraceMs:260});
  const {source,frame}=trackedHand();
  const [started]=tracker.update(frame,[source],{},0);
  assert.equal(started.started,true);
  assert.equal(started.pinching,true);

  const [briefLoss]=tracker.update(frame,[],{},180);
  assert.equal(briefLoss.stale,true);
  assert.equal(briefLoss.pinching,true);
  assert.equal(briefLoss.ended,false);

  const [longLoss]=tracker.update(frame,[],{},300);
  assert.equal(longLoss.lost,true);
  assert.equal(longLoss.ended,true);
  assert.equal(longLoss.pinching,false);
});

test("mão ainda listada mas sem poses é tratada como rastreamento perdido",()=>{
  const tracker=new HandGestureTracker({trackingGraceMs:200});
  const {source,frame}=trackedHand();
  tracker.update(frame,[source],{},0);
  const darkFrame={getJointPose(){return null;}};
  const [briefLoss]=tracker.update(darkFrame,[source],{},120);
  assert.equal(briefLoss.stale,true);
  assert.equal(briefLoss.pinching,true);
  const [released]=tracker.update(darkFrame,[source],{},240);
  assert.equal(released.lost,true);
  assert.equal(released.ended,true);
});
