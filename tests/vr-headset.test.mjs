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

test("VR preserva modelo, cor, orientação e escala das peças da bancada PC",()=>{
  assert.match(xr,/model\.createPart\(\{\.\.\.item,type:item\.kind\|\|item\.type\}\)/);
  assert.match(xr,/part\.rotation\.y=-Number\(item\.rotation\|\|0\)\*Math\.PI\/180/);
  assert.match(xr,/part\.scale\.setScalar\(\.065\*Math\.max\(\.5,Math\.min\(1\.8,Number\(item\.scale\|\|1\)\)\)\)/);
});

test("VR oferece rotação, ligação entre terminais e fios visíveis",()=>{
  assert.match(xr,/\"rotate:left\"/);
  assert.match(xr,/\"rotate:right\"/);
  assert.match(xr,/function pickWireTerminal\(ray,tip\)/);
  assert.match(xr,/function connectTerminal\(endpoint\)/);
  assert.match(xr,/new T\.TubeGeometry\(curve,18,\.0028,6,false\)/);
  assert.match(xr,/\"wire:toggle\"/);
  assert.match(xr,/FIACAO ATIVA • TOQUE EM DOIS TERMINAIS/);
  assert.match(xr,/function terminalNearHand\(tip\)/);
  assert.match(xr,/function toggleVRPinPanel\(frame\)/);
  assert.match(xr,/function selectVRPin\(name\)/);
  assert.match(xr,/\[\.\.\.window\.CodaESPModel\.left,\.\.\.window\.CodaESPModel\.right\]/);
  assert.match(xr,/function addVRComponentPinLabels\(part\)/);
  assert.match(xr,/button\.userData\.xrDisabled=reserved/);
});

test("VR fixa a placa e impede que ela seja agarrada até liberar a posição",()=>{
  assert.match(xr,/"board:lock"/);
  assert.match(xr,/function toggleBoardLock\(\)/);
  assert.match(xr,/object===state\.board&&state\.boardLocked/);
  assert.match(html,/toque FIXAR ESP/);
});

test("VR permite trazer mesa e painéis até o usuário e mover os painéis",()=>{
  assert.match(xr,/function bringTableNear\(frame\)/);
  assert.match(xr,/function bringPanelsNear\(frame\)/);
  assert.match(xr,/grab\.kind===\"panel\"/);
  assert.match(xr,/\"bring:table\"/);
  assert.match(xr,/\"bring:keyboard\"/);
  assert.equal((xr.match(/^\s*buildVREditor\(scene\);$/gm)||[]).length,1);
});

test("teclado VR envia teclas, espaço, nova linha e apagar para o editor",()=>{
  assert.match(xr,/else if\(action===\"space\"\)state\.vrCode\+=\" \"/);
  assert.match(xr,/else if\(action===\"enter\"\)state\.vrCode\+=\"\\n\"/);
  assert.match(xr,/else if\(action===\"backspace\"\)state\.vrCode=state\.vrCode\.slice\(0,-1\)/);
  assert.match(xr,/else if\(action\.startsWith\(\"key:\"\)\)state\.vrCode\+=action\.slice\(4\)/);
  assert.match(xr,/action===\"run\"/);
});

test("mãos agarram e movem ESP32 continuamente até soltar a pinça",()=>{
  assert.match(xr,/session\.addEventListener\("selectstart",onSelectStart\)/);
  assert.match(xr,/session\.addEventListener\("selectend",onSelectEnd\)/);
  assert.match(xr,/function updateGrabbed\(frame\)/);
  assert.match(xr,/index-finger-tip/);
  assert.match(xr,/state\.grabbed=\{source,object,distance:grabDistance,offset:/);
  assert.match(xr,/object\.y=\.78/);
});

test("VR inclui editor Arduino, teclado virtual e execução sem tela externa",()=>{
  assert.match(html,/Laboratório VR independente e interativo/);
  assert.match(xr,/CODA_VR_EDITOR/);
  assert.match(xr,/CODA_VR_KEYBOARD/);
  assert.match(xr,/coda-vr-sketch-v146/);
  assert.match(xr,/core\.createRuntime/);
  assert.match(xr,/runtime\.start\(state\.vrCode\)/);
  assert.match(xr,/activateVRAction/);
  assert.match(xr,/function buttonAtFinger\(tip\)/);
  assert.match(xr,/function updateHandTouches\(frame\)/);
  assert.match(xr,/button&&button!==touch\.button\)activateVRAction/);
  assert.match(html,/Toque PROGRAMAR/);
  assert.match(xr,/isSystemKeyboardSupported/);
  assert.match(xr,/keyboard\.visible=false|keyboard\.rotation\.set\([^\n]+keyboard\.visible=false/);
});

test("abas de turma usam semântica e navegação por teclado",()=>{
  const tabs=readFileSync(join(root,"js/lesson-tabs.js"),"utf8");
  assert.match(tabs,/aria-controls="class-panel-/);
  assert.match(tabs,/card\.setAttribute\("role","tabpanel"\)/);
  assert.match(tabs,/ArrowRight:1,ArrowLeft:-1,ArrowDown:1,ArrowUp:-1/);
});
