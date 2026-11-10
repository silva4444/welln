import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const context=vm.createContext({console,document:{createElement(){return {width:0,height:0,getContext(){return {scale(){},fillRect(){},fillText(){}};}};}}});
vm.runInContext(await readFile(new URL('../js/vendor/three-r128.min.js',import.meta.url),'utf8'),context);
context.window={THREE:context.THREE};
vm.runInContext(await readFile(new URL('../js/esp32-model.js',import.meta.url),'utf8'),context);
const model=context.window.CodaESPModel;
test('contatos da placa de 38 pinos têm posições distintas e nomes conectáveis',()=>{
 const pins=[...model.left,...model.right];assert.equal(pins.length,38);assert.equal(new Set(pins).size,38);
 assert.equal(new Set(pins.map(pin=>model.pinPoint(pin).toArray().join(','))).size,38);
 assert.equal(model.pinPoint('ESP32:GPIO34').x,-.75);assert.equal(model.pinPoint('GPIO2').x,.75);assert.equal(model.pinPoint('GPIO99'),null);
});
test('o mesmo modelo responde a EN, BOOT e GPIO2 sem criar outra placa',()=>{
 const board=model.createBoard(),buttons=board.userData.buttons;
 const start=buttons.BOOT.position.y;board.userData.setHardware({powered:true,boot:true,outputs:{2:1}});assert.ok(buttons.BOOT.position.y<start);
 const lit=board.children.filter(mesh=>mesh.material?.emissive?.getHex()===0x349aff);assert.equal(lit.length,1);assert.ok(lit[0].material.emissiveIntensity>1);
 board.userData.setHardware({outputs:{2:0}});assert.equal(lit[0].material.emissiveIntensity,0);assert.equal(buttons.BOOT.position.y,start);
 board.userData.setHardware({reset:true});assert.ok(buttons.EN.position.y<start);
});
