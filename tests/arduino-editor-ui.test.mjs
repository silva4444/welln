import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseArduino,createRuntime} from '../js/esp32-runtime.js';

const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const logic=readFileSync(new URL('../js/esp32-firmware.js',import.meta.url),'utf8');

test('aba Programador 3D tem editor textual Arduino com verificacao e acoes de arquivos',()=>{
 for(const id of ['programmerCodeTop','espFirmwarePanel','espFirmwareCode','espCodeLines','espEditorCaret',
  'espVerifyCode','espSaveIno','espOpenIno','espOpenInoFile','espCopyCode','espRestoreCode','espRunCode','espStopCode']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(html,/sketch\.ino/);
 assert.match(html,/Op[cç][aõ]o?/i); // interface inclui opções guiadas
 assert.match(logic,/programmerCodeTop'\)\?\.after/); // o editor abre antes da bancada, não depois
 assert.match(logic,/runtimeCore\.parseArduino/); // verificar usa o mesmo interpretador da execucao
 assert.match(logic,/downloadCode\(/);
 assert.match(logic,/importCode\(/);
});

test('código digitado no novo editor aciona GPIO2, imprime no serial e para sem saídas',()=>{
 const sketch=`void setup() { pinMode(2, OUTPUT); Serial.begin(115200); }
 void loop() { digitalWrite(2, HIGH); Serial.println("Ligado"); delay(250); digitalWrite(2, LOW); delay(250); }`;
 assert.deepEqual(parseArduino(sketch).configuredPins,[2]);
 let elapsed=0,n=0;const pending=new Map(),serial=[];
 const runtime=createRuntime({now:()=>elapsed,schedule:(fn,delay)=>{const id=++n;pending.set(id,{fn,time:elapsed+delay});return id;},cancel:id=>pending.delete(id),onSerial:line=>serial.push(line)});
 const advance=ms=>{const end=elapsed+ms;for(let count=0;count<20;count++){
   const first=[...pending].sort((a,b)=>a[1].time-b[1].time)[0];
   if(!first||first[1].time>end)break;
   pending.delete(first[0]);elapsed=first[1].time;first[1].fn();
 }elapsed=end;};
 runtime.start(sketch);advance(50);
 assert.equal(runtime.snapshot.running,true);
 assert.equal(runtime.snapshot.outputs[2],1);
 advance(260);assert.equal(runtime.snapshot.outputs[2],0);
 assert.ok(serial.includes('Ligado'));
 runtime.stop();assert.equal(runtime.snapshot.running,false);
 assert.deepEqual(runtime.snapshot.outputs,{});
});
