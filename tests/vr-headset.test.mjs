import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root=join(import.meta.dirname,"..");
const html=readFileSync(join(root,"index.html"),"utf8");
const xr=readFileSync(join(root,"js/esp32-ar.js"),"utf8");

test("modo de óculos oferece VR fechado e RA com passthrough",()=>{
  assert.match(html,/data-xr-experience="vr"/);
  assert.match(html,/data-xr-experience="ar"/);
  assert.match(xr,/isSessionSupported\("immersive-vr"\)/);
  assert.match(xr,/isSessionSupported\("immersive-ar"\)/);
  assert.match(xr,/requestSession\(sessionType,opts\)/);
});

test("VR cria sala, mesa e aceita hand tracking",()=>{
  assert.match(xr,/new T\.PlaneGeometry\(8,8\)/);
  assert.match(xr,/new T\.BoxGeometry\(1\.8,\.08,1\)/);
  assert.match(xr,/optionalFeatures:\["hand-tracking","bounded-floor"\]/);
  assert.match(xr,/state\.placed=true/);
});

test("mãos agarram e movem ESP32 continuamente até soltar a pinça",()=>{
  assert.match(xr,/session\.addEventListener\("selectstart",onSelectStart\)/);
  assert.match(xr,/session\.addEventListener\("selectend",onSelectEnd\)/);
  assert.match(xr,/function updateGrabbed\(frame\)/);
  assert.match(xr,/index-finger-tip/);
  assert.match(xr,/state\.grabbed=\{source,object,distance:grabDistance\}/);
  assert.match(xr,/object\.y=\.78/);
});

test("VR inclui editor Arduino, teclado virtual e execução sem tela externa",()=>{
  assert.match(html,/Laboratório VR independente e interativo/);
  assert.match(xr,/CODA_VR_EDITOR/);
  assert.match(xr,/CODA_VR_KEYBOARD/);
  assert.match(xr,/coda-vr-sketch-v146/);
  assert.match(xr,/core\.createRuntime/);
  assert.match(xr,/runtime\.start\(state\.vrCode\|\|VR_DEMO\)/);
  assert.match(xr,/activateVRAction/);
});

test("abas de turma usam semântica e navegação por teclado",()=>{
  const tabs=readFileSync(join(root,"js/lesson-tabs.js"),"utf8");
  assert.match(tabs,/aria-controls="class-panel-/);
  assert.match(tabs,/card\.setAttribute\("role","tabpanel"\)/);
  assert.match(tabs,/ArrowRight:1,ArrowLeft:-1,ArrowDown:1,ArrowUp:-1/);
});
