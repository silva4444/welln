import test from 'node:test';
import assert from 'node:assert/strict';
import {parseArduino,createRuntime,ANALOG_DEMO} from '../js/esp32-runtime.js';
import {makeExample,simulateLedStates} from '../js/esp32-ar-lab-core.js';

function clock(){let time=0,id=0;const tasks=new Map(),states=[],serial=[],errors=[];const runtime=createRuntime({schedule:(fn,ms)=>{const key=++id;tasks.set(key,{fn,at:time+ms});return key;},cancel:key=>tasks.delete(key),now:()=>time,onState:s=>states.push(s),onSerial:s=>serial.push(s),onError:e=>errors.push(e.message)});return {runtime,states,serial,errors,tasks,advance(ms){const until=time+ms;for(let n=0;n<10000;n++){const next=[...tasks].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>until)break;time=next[1].at;tasks.delete(next[0]);next[1].fn();}time=until;}};}

test('sketch da referência usa o ADC34 para controlar o tempo real do LED2 e escrever no serial',()=>{
 const c=clock();c.runtime.setAnalog(34,3200);c.runtime.start(ANALOG_DEMO);c.advance(30);
 assert.equal(c.runtime.snapshot.outputs[2],1);c.advance(790);assert.equal(c.runtime.snapshot.outputs[2],0);c.advance(850);
 assert.ok(c.serial.includes('ADC 34: 3200'));assert.equal(c.serial.filter(s=>s==='ESP32 virtual iniciado!').length,1);assert.deepEqual(c.errors,[]);
 c.runtime.setAnalog(34,400);c.advance(1800);assert.ok(c.serial.includes('ADC 34: 400'));
});
test('BOOT é entrada GPIO0 ativa em LOW e só muda saída conforme o sketch',()=>{
 const c=clock();c.runtime.start('void setup(){pinMode(0, INPUT_PULLUP);pinMode(2,OUTPUT);} void loop(){digitalWrite(2,!digitalRead(0));delay(100);}');
 c.advance(30);assert.equal(c.runtime.snapshot.outputs[2],0);c.runtime.setBoot(true);c.advance(150);assert.equal(c.runtime.snapshot.outputs[2],1);c.runtime.setBoot(false);c.advance(150);assert.equal(c.runtime.snapshot.outputs[2],0);
});
test('Parar cancela o timer e EN reexecuta setup uma vez',()=>{
 const c=clock();c.runtime.start(ANALOG_DEMO);c.advance(100);c.runtime.reset();assert.equal(c.serial.filter(s=>s==='ESP32 virtual iniciado!').length,2);c.runtime.stop();assert.equal(c.tasks.size,0);const count=c.serial.length;c.advance(10000);assert.equal(c.serial.length,count);assert.deepEqual(c.runtime.snapshot.outputs,{});assert.equal(c.runtime.snapshot.running,false);
});
test('delay dinâmico zero é limitado para não bloquear a interface',()=>{
 const c=clock();c.runtime.setAnalog(34,0);c.runtime.start(ANALOG_DEMO);c.advance(200);assert.equal(c.runtime.snapshot.running,true);assert.equal(c.tasks.size,1);assert.deepEqual(c.errors,[]);
});
test('código não permitido e saídas em pinos de entrada são rejeitados',()=>{
 for(const text of ['void setup(){pinMode(34,OUTPUT);}void loop(){digitalWrite(34,HIGH);delay(500);}','void setup(){}void loop(){fetch("secret");}','void setup(){}void loop(){while(1){} }'])assert.throws(()=>parseArduino(text));
});
test('erros de execução interrompem a simulação e desligam todas as saídas',()=>{
 const c=clock();c.runtime.start('void setup(){pinMode(2,OUTPUT);}void loop(){int n = 0;digitalWrite(2,HIGH);delay(500/n);}');c.advance(30);assert.match(c.errors[0],/Divisão por zero/);assert.equal(c.runtime.snapshot.running,false);assert.deepEqual(c.runtime.snapshot.outputs,{});
});
test('GNDs da placa de 38 pinos compartilham terra e pinos ADC não acendem LED',()=>{
 const circuit=makeExample();circuit.wires[2][1]='ESP32:GND_R2';assert.equal(simulateLedStates(circuit,{2:true}).LED1,true);
 circuit.components[1].pin='GPIO34';circuit.wires[0][0]='ESP32:GPIO34';assert.equal(simulateLedStates(circuit,{34:true}).LED1,false);
});
test('serial com comentários, escapes e operadores mantém o texto literal',()=>{
 const c=clock();c.runtime.start('void setup(){ Serial.begin(115200); }void loop(){ int n = 6*7; Serial.printf("resultado: %d\\n", n); Serial.println("https://exemplo"); delay(500); }');c.advance(40);assert.deepEqual(c.serial.slice(0,2),['resultado: 42','https://exemplo']);
});
