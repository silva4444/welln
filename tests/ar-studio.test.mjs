import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArduino, DEMO} from '../js/esp32-ar-lab-core.js';

const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const html=read('index.html'),ar=read('js/esp32-ar.js'),lab=read('js/esp32-ar-lab.js'),three=read('js/esp32-3d.js'),css=read('components/esp32-webgl.css');

test('RA do celular destaca bancada, fixação, circuitos e código sem abas escondidas',()=>{
  for(const id of ['mobileARLock','mobileARQuickAdd','mobileARQuickRun','mobileARVerify','mobileARSaveINO','mobileAROpenINO','mobileARINOFile','mobileARShowAllPins'])
    assert.match(html,new RegExp(`id="${id}"`));
  for(const mode of ['view','wires','code'])assert.match(html,new RegExp(`data-mobile-ar-tool="${mode}"`));
  assert.match(css,/\.mobile-ar-quick-actions/);
  assert.match(css,/\[data-tool="code"\]/);
});

test('fixar placa impede movimentos acidentais sem bloquear peças',()=>{
  assert.match(ar,/locked:false/);
  assert.match(ar,/if\(m.locked \|\| m.renderer\?\.pickComponentAt\?\.\(event\)\)return/);
  assert.match(ar,/state\.mobile\.locked=!state\.mobile\.locked/);
  assert.match(ar,/trava|fixa|fixar|posição fixa/i);
  assert.match(three,/pickComponentAt/);
  assert.match(three,/onComponentMove/);
  assert.match(lab,/coda-ar-component-move/);
  assert.match(lab,/item\.x=x;item\.z=z/);
  assert.match(lab,/preferredPins/);
  assert.match(lab,/mobile-ar-fine-adjust/);
});

test('modo tela não é anunciado como âncora espacial verdadeira',()=>{
  assert.match(html,/fixação é na tela, não rastreamento físico/);
  assert.match(ar,/não acompanha a mesa/);
  assert.match(read('RA-MOBILE-COMO-USAR.md'),/não\*\* reconhece uma mesa/);
});

test('editor .ino oferece importação, exportação, verificação e execução do simulador',()=>{
  assert.match(lab,/function saveSketch/);
  assert.match(lab,/function openSketch/);
  assert.match(lab,/function verifySketch/);
  assert.match(lab,/runtime\.start\(code\)/);
  const result=parseArduino(DEMO);
  assert.ok(result.configuredPins.includes(2));
});
