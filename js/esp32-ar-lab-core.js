/* Motor educacional para circuitos ESP32 na RA: sem eval e sem executar C++ arbitrário. */
export const SUPPORTED_GPIO = Object.freeze([0, 1, 2, 3, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33]);
export const DEMO = `// ESP32 virtual: LED no GPIO 2, com resistor de 220 ohms e GND
void setup() {
  pinMode(2, OUTPUT);
}

void loop() {
  digitalWrite(2, HIGH);
  delay(500);
  digitalWrite(2, LOW);
  delay(500);
}`;

export function makeExample(pin = 2) {
  if (!SUPPORTED_GPIO.includes(pin)) throw new Error("GPIO não disponível no simulador.");
  return {
    components: [
      { id: "R1", type: "resistor", ohms: 220, x: 1.65, z: -0.75 },
      { id: "LED1", type: "led", pin: `GPIO${pin}`, color: "#ff5252", x: 1.65, z: -0.25 }
    ],
    wires: [
      [ `ESP32:GPIO${pin}`, "R1:A" ],
      [ "R1:B", "LED1:A" ],
      [ "LED1:B", "ESP32:GND" ]
    ],
    code: DEMO.replace(/GPIO 2/g, `GPIO ${pin}`).replace(/\(2,/g, `(${pin},`)
  };
}

export {parseArduino} from "./esp32-runtime.js?v=14.0.0";
import {parseArduino,createRuntime,ANALOG_DEMO} from "./esp32-runtime.js?v=14.0.0";

import {evaluateCircuit} from "./esp32-circuit-logic.js?v=14.0.0";
export function simulateLedStates(circuit, outputs = {}) {
  const normalized={components:circuit.components||[],wires:(circuit.wires||[]).map(w=>Array.isArray(w)?w:[w.a,w.b])};
  const result=evaluateCircuit(normalized);
  const ready=new Set(result.readyLedIds);
  return Object.fromEntries(normalized.components.filter(item=>item.type==='led').map(led=>[led.id,Boolean(!result.faults.length&&ready.has(String(led.id))&&outputs[Number(String(led.pin||'').replace('GPIO',''))])]));
}

if (typeof window !== "undefined") window.CodaARLabCore = {SUPPORTED_GPIO,DEMO,makeExample,parseArduino,simulateLedStates,createRuntime,ANALOG_DEMO};
