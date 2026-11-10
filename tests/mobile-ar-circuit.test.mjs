import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {DEMO,makeExample,parseArduino,simulateLedStates} from '../js/esp32-ar-lab-core.js';
import {evaluateCircuit} from '../js/esp32-circuit-logic.js';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const controller = await readFile(new URL('../js/esp32-ar-lab.js', import.meta.url), 'utf8');
const renderer = await readFile(new URL('../js/esp32-3d.js', import.meta.url), 'utf8');
const loader = await readFile(new URL('../script.js', import.meta.url), 'utf8');

test('sketch de LED compila no subconjunto educativo',()=>{
  const program = parseArduino(DEMO);
  assert.deepEqual(program.configuredPins,[2]);
  assert.deepEqual(program.operations.map(v=>v.type),['write','wait','write','wait']);
  assert.deepEqual(program.operations.filter(v=>v.type==='write').map(v=>v.high),[true,false]);
});
test('programa do usuário só ativa pinos de saída configurados e recusa C++ arbitrário',()=>{
  assert.throws(()=>parseArduino('void setup(){} void loop(){digitalWrite(2,HIGH);delay(500);}') , /Configure GPIO 2/);
  assert.throws(()=>parseArduino('void setup(){pinMode(2,OUTPUT);} void loop(){for(;;)digitalWrite(2,HIGH);}') , /não suportada|Adicione/);
  assert.throws(()=>parseArduino('void setup(){pinMode(2,OUTPUT);} void loop(){delay(0);digitalWrite(2,HIGH);}') , /delay/);
  assert.throws(()=>parseArduino('void setup(){pinMode(2,OUTPUT);} void loop(){eval(2);}') , /não suportado/);
});
test('circuito exemplo com GPIO, resistor e LED responde a HIGH/LOW',()=>{
  const ex=makeExample();
  assert.equal(evaluateCircuit(ex).canRun,true);
  assert.deepEqual(simulateLedStates(ex,{2:true}),{LED1:true});
  assert.deepEqual(simulateLedStates(ex,{2:false}),{LED1:false});
});
test('LED sem resistor, sem GND ou invertido não acende',()=>{
  const original=makeExample();
  for(const wires of [
    [['ESP32:GPIO2','LED1:A'], ['LED1:B','ESP32:GND']],
    original.wires.slice(0,-1),
    [['ESP32:GPIO2','R1:A'],['R1:B','LED1:B'],['LED1:A','ESP32:GND']]
  ]) {
    assert.equal(simulateLedStates({...original,wires},{2:true}).LED1,false);
  }
});
test('projetos multi GPIO/const int e ciclo seguro',()=>{
  const ex=makeExample(4);
  assert.match(ex.code,/digitalWrite\(4, HIGH\)/);
  assert.equal(evaluateCircuit(ex).canRun,true);
  assert.deepEqual(simulateLedStates(ex,{4:true}),{LED1:true});
  const program = parseArduino('const int led = 4; void setup(){ pinMode(led,OUTPUT); } void loop(){ digitalWrite(led,HIGH);delay(150);digitalWrite(led,LOW);delay(150); }');
  assert.deepEqual(program.configuredPins,[4]);
});
test('RA possui seletor de terminais, editor e malhas 3D que respondem à simulação',()=>{
  for(const id of ['mobileARBoardTerminals','mobileARPartTerminals','mobileARWireList','mobileARCode','mobileARPlay','mobileARStop','mobileARExample']) assert.ok(html.includes(`id="${id}"`),id);
  assert.match(controller,/coda-mobile-ar-open/);
  assert.match(controller,/evaluateCircuit\(circuit\)/);
  assert.match(renderer,/function drawMobileCircuit\(/);
  assert.match(renderer,/setCircuit\(circuit\)/);
  assert.match(loader,/esp32-ar-lab-core\.js/);
  assert.match(loader,/esp32-ar-lab\.js/);
});
