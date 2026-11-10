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

test("abas de turma usam semântica e navegação por teclado",()=>{
  const tabs=readFileSync(join(root,"js/lesson-tabs.js"),"utf8");
  assert.match(tabs,/aria-controls="class-panel-/);
  assert.match(tabs,/card\.setAttribute\("role","tabpanel"\)/);
  assert.match(tabs,/ArrowRight:1,ArrowLeft:-1,ArrowDown:1,ArrowUp:-1/);
});
