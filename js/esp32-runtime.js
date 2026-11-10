/* Interpretador educativo do sketch: AST limitada, sem eval/new Function, timers canceláveis. */
export const OUTPUT_GPIO=Object.freeze([0,1,2,3,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33]);
export const INPUT_GPIO=Object.freeze([...OUTPUT_GPIO,34,35,36,39]);
export const ANALOG_DEMO=`#include <Arduino.h>
#define LED_PIN 2
#define POT_PIN 34

void setup() {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(POT_PIN, INPUT);
  Serial.println("ESP32 virtual iniciado!");
}

void loop() {
  int potVal = analogRead(POT_PIN);
  digitalWrite(LED_PIN, HIGH);
  delay(potVal / 4);
  digitalWrite(LED_PIN, LOW);
  delay(potVal / 4);
  Serial.printf("ADC 34: %d\\n", potVal);
}`;
const constants={HIGH:1,LOW:0,OUTPUT:1,INPUT:0,INPUT_PULLUP:2,true:1,false:0};
function tokens(source){
  const out=[];let i=0;
  while(i<source.length){
    const tail=source.slice(i);let m;
    if((m=tail.match(/^\s+/))||(m=tail.match(/^\/\/[^\n]*/))||(m=tail.match(/^\/\*[\s\S]*?\*\//))){i+=m[0].length;continue;}
    if(tail[0]==='"'){
      m=tail.match(/^"(?:[^"\\]|\\.)*"/);if(!m)throw new Error('Texto sem aspas de fechamento.');
      let value;try{value=JSON.parse(m[0]);}catch{throw new Error('Escape de texto não suportado. Use \\n ou \\".');}out.push({type:'string',value});i+=m[0].length;continue;
    }
    if((m=tail.match(/^\d+(?:\.\d+)?/))){out.push({type:'number',value:Number(m[0])});i+=m[0].length;continue;}
    if((m=tail.match(/^[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)?/))){out.push({type:'name',value:m[0]});i+=m[0].length;continue;}
    if((m=tail.match(/^(==|!=|<=|>=|&&|\|\||[{}(),;=+\-*/%<>!])/))){out.push({type:'symbol',value:m[0]});i+=m[0].length;continue;}
    throw new Error(`Caractere não suportado: ${tail[0]}`);
  }return out;
}
function valueOf(node,vars,io={}){
  if(node.kind==='literal')return node.value;
  if(node.kind==='name'){if(Object.hasOwn(vars,node.name))return vars[node.name];if(Object.hasOwn(constants,node.name))return constants[node.name];throw new Error(`Valor não reconhecido: ${node.name}`);}
  if(node.kind==='unary'){const v=valueOf(node.value,vars,io);return node.op==='!'?Number(!v):node.op==='-'?-Number(v):Number(v);}
  if(node.kind==='call'){
    const args=node.args.map(a=>valueOf(a,vars,io)),pin=Number(args[0]);
    if(node.name==='millis')return io.millis?.()||0;
    if(!INPUT_GPIO.includes(pin))throw new Error(`GPIO ${pin} não disponível.`);
    if(node.name==='analogRead'){if(![0,2,4,12,13,14,15,25,26,27,32,33,34,35,36,39].includes(pin))throw new Error(`GPIO ${pin} não tem ADC neste modelo.`);return Math.max(0,Math.min(4095,Math.round(io.analogRead?.(pin)||0)));}
    return Number(Boolean(io.digitalRead?.(pin)));
  }
  const a=valueOf(node.left,vars,io);
  if(node.op==='&&'&&!a)return 0;if(node.op==='||'&&a)return 1;
  const b=valueOf(node.right,vars,io);let result;
  switch(node.op){case '+':result=a+b;break;case '-':result=a-b;break;case '*':result=a*b;break;case '/':if(!b)throw new Error('Divisão por zero no sketch.');result=a/b;break;case '%':if(!b)throw new Error('Divisão por zero no sketch.');result=a%b;break;case '==':return Number(a===b);case '!=':return Number(a!==b);case '<':return Number(a<b);case '>':return Number(a>b);case '<=':return Number(a<=b);case '>=':return Number(a>=b);case '&&':return Number(Boolean(a&&b));case '||':return Number(Boolean(a||b));default:throw new Error('Operador não suportado.');}
  if(typeof result==='string'&&result.length>4096)throw new Error('Texto longo demais na simulação.');
  if(typeof result==='number'&&!Number.isFinite(result))throw new Error('Resultado numérico inválido.');return result;
}
export function parseArduino(source){
  if(typeof source!=='string'||!source.trim()||source.length>12000)throw new Error('Código vazio ou longo demais (limite de 12.000 caracteres).');
  const definitions={};
  let text=source.replace(/^\s*#include\s*[<"]Arduino\.h[>"]\s*$/gm,'');
  text=text.replace(/^\s*#define\s+([A-Za-z_]\w*)\s+(\d+)\s*$/gm,(_,name,v)=>{if(Object.hasOwn(definitions,name))throw new Error(`Nome repetido: ${name}`);definitions[name]=Number(v);return '';});
  const list=tokens(text);let pos=0;
  const peek=()=>list[pos]?.value,take=()=>list[pos++],accept=v=>peek()===v?(pos++,true):false,expect=v=>{if(!accept(v))throw new Error(`Esperado “${v}” próximo de “${peek()??'fim do código'}”.`);};
  const precedences={'||':1,'&&':2,'==':3,'!=':3,'<':4,'>':4,'<=':4,'>=':4,'+':5,'-':5,'*':6,'/':6,'%':6};
  function expr(min=0,depth=0){
    if(depth>32)throw new Error('Expressão longa demais.');let node,t=take();if(!t)throw new Error('Expressão incompleta.');
    if(t.type==='number'||t.type==='string')node={kind:'literal',value:t.value};
    else if(t.value==='('){node=expr(0,depth+1);expect(')');}
    else if(['!','-','+'].includes(t.value))node={kind:'unary',op:t.value,value:expr(7,depth+1)};
    else if(t.type==='name'){
      if(accept('(')){
        if(!['analogRead','digitalRead','millis'].includes(t.value))throw new Error(`Função não suportada: ${t.value}`);
        const args=[];if(peek()!==')'){do{args.push(expr(0,depth+1));}while(accept(','));}expect(')');
        if(args.length!==(t.value==='millis'?0:1))throw new Error(`Argumentos inválidos em ${t.value}.`);node={kind:'call',name:t.value,args};
      }else node={kind:'name',name:t.value};
    }else throw new Error(`Expressão não suportada: ${t.value}`);
    while(precedences[peek()]>=min){const op=take().value;node={kind:'binary',op,left:node,right:expr(precedences[op]+1,depth+1)};}return node;
  }
  const initial={...definitions},modes=new Map(),globalNames=new Set(Object.keys(initial));let setup=null,loop=null;
  function statement(phase){
    if(['for','while','if','switch','do'].includes(peek()))throw new Error('Instrução não suportada: use chamadas sequenciais neste simulador.');
    let declared=false,constant=false,type='int';
    if(accept('const'))constant=true;
    if(['int','float','bool','long'].includes(peek())){type=take().value;declared=true;}
    const token=take();if(token?.type!=='name')throw new Error('Instrução não suportada.');const name=token.value;
    if(accept('=')){
      const value=expr();expect(';');return {type:'assign',name,value,declared,constant,valueType:type};
    }
    if(declared||constant)throw new Error('Inicialize a variável com = e um valor.');
    expect('(');const args=[];if(peek()!==')'){do{args.push(expr());}while(accept(','));}expect(')');expect(';');
    const numeric=(n)=>Number(valueOf(args[n],initial));
    if(name==='pinMode'){
      if(args.length!==2)throw new Error('pinMode precisa de pino e modo.');const pin=numeric(0),mode=numeric(1);
      if(!INPUT_GPIO.includes(pin))throw new Error(`GPIO ${pin} não disponível neste simulador.`);
      if(![0,1,2].includes(mode))throw new Error('Modo de pino inválido.');
      if(mode===1&&!OUTPUT_GPIO.includes(pin))throw new Error(`GPIO ${pin} é somente entrada.`);
      if(mode===2&&pin>=34)throw new Error(`GPIO ${pin} não tem pull-up interno.`);
      if(phase!=='setup')throw new Error('Use pinMode no setup().');modes.set(pin,mode);return {type:'mode',pin,mode};
    }
    if(name==='digitalWrite'){
      if(args.length!==2)throw new Error('digitalWrite precisa de pino e valor.');const pin=numeric(0);if(!OUTPUT_GPIO.includes(pin))throw new Error(`GPIO ${pin} não disponível para saída.`);
      let high;try{high=Boolean(valueOf(args[1],initial));}catch{}return {type:'write',pin,value:args[1],...(high===undefined?{}:{high})};
    }
    if(name==='delay'){
      if(args.length!==1)throw new Error('delay precisa de um valor.');let ms;try{ms=numeric(0);}catch{}
      if(ms!==undefined&&(ms<50||ms>10000))throw new Error('Use delay() entre 50 e 10000 ms para simulação.');return {type:'wait',value:args[0],...(ms===undefined?{}:{ms})};
    }
    if(name==='Serial.begin'){if(args.length!==1)throw new Error('Serial.begin precisa do baud.');return {type:'serialBegin',value:args[0]};}
    if(['Serial.print','Serial.println','Serial.printf'].includes(name)){if(!args.length)throw new Error('Informe o texto da saída serial.');return {type:'serial',method:name.split('.')[1],args};}
    throw new Error(`Comando ${name} não suportado. Use pinMode, digitalWrite, analogRead, digitalRead, delay e Serial.`);
  }
  while(pos<list.length){
    if(accept('void')){const name=take()?.value;if(!['setup','loop'].includes(name))throw new Error('Adicione apenas setup() e loop().');expect('(');expect(')');expect('{');const ops=[];
      while(peek()!=='}'){if(peek()===undefined)throw new Error(`Adicione o fechamento de ${name}().`);ops.push(statement(name));if(ops.length>100)throw new Error('Muitos comandos no sketch.');}expect('}');if(name==='setup'){if(setup)throw new Error('setup repetido.');setup=ops;}else{if(loop)throw new Error('loop repetido.');loop=ops;}
    }else{const op=statement('global');if(op.type!=='assign'||!op.declared)throw new Error('Declaração global não suportada.');if(globalNames.has(op.name))throw new Error(`Nome repetido: ${op.name}`);globalNames.add(op.name);initial[op.name]=valueOf(op.value,initial);}
  }
  if(!setup||!loop)throw new Error('Adicione void setup() { ... } e void loop() { ... }.');if(!loop.length)throw new Error('Adicione comandos no loop().');
  for(const op of [...setup,...loop])if(op.type==='write'&&modes.get(op.pin)!==1)throw new Error(`Configure GPIO ${op.pin} com pinMode(${op.pin}, OUTPUT) no setup().`);
  // Mantém a API antiga para o exemplo de LED, acrescentando setup e expressões.
  return {configuredPins:[...modes].filter(([,m])=>m===1).map(([p])=>p),inputPins:[...modes].filter(([,m])=>m!==1).map(([p])=>p),operations:loop,setup,initial,modes:Object.fromEntries(modes)};
}
export function createRuntime({onState=()=>{},onSerial=()=>{},onError=()=>{},schedule=setTimeout,cancel=clearTimeout,now=()=>Date.now()}={}){
  let program=null,vars={},outputs={},analog={34:2048},digital={0:1},timer=null,running=false,index=0,phase='setup',started=0,serialRemainder='',boot=false;
  const snapshot=()=>({outputs:{...outputs},powered:true,boot,running,analog:{...analog}});
  const emit=()=>onState(snapshot());
  const io={analogRead:p=>analog[p]??0,digitalRead:p=>digital[p]??outputs[p]??(program?.modes[p]===2?1:0),millis:()=>now()-started};
  function serial(text,newline){serialRemainder+=text;if(newline)serialRemainder+='\n';const lines=serialRemainder.split('\n');serialRemainder=lines.pop();for(const line of lines)onSerial(line.slice(0,1024));if(serialRemainder.length>1024){onSerial(serialRemainder.slice(0,1024));serialRemainder='';}}
  function step(){
    timer=null;if(!running)return;
    try{for(let count=0;count<64&&running;count++){
      const ops=phase==='setup'?program.setup:program.operations;
      if(index>=ops.length){phase='loop';index=0;if(!ops.length&&phase==='setup')continue;if(count>0){timer=schedule(step,16);return;}}
      const op=(phase==='setup'?program.setup:program.operations)[index++];if(!op)continue;
      if(op.type==='assign'){let value=valueOf(op.value,vars,io);if(op.valueType==='int'||op.valueType==='long')value=Math.trunc(Number(value));vars[op.name]=value;}
      else if(op.type==='write'){outputs[op.pin]=Number(Boolean(valueOf(op.value,vars,io)));emit();}
      else if(op.type==='wait'){const ms=Math.trunc(Number(valueOf(op.value,vars,io)));if(!Number.isFinite(ms)||ms<0||ms>10000)throw new Error('delay calculado deve ficar entre 0 e 10000 ms.');timer=schedule(step,Math.max(16,ms));return;}
      else if(op.type==='serial'){const args=op.args.map(n=>valueOf(n,vars,io));let text=String(args[0]);if(op.method==='printf'){let i=1;text=text.replace(/%(%|d|i|f|s)/g,(_,type)=>type==='%'?'%':type==='d'||type==='i'?String(Math.trunc(Number(args[i++]))):String(args[i++]??''));}serial(text,op.method==='println');}
    }if(running)timer=schedule(step,16);
    }catch(error){stop();onError(error);}
  }
  function stop(){if(timer!==null)cancel(timer);timer=null;running=false;outputs={};serialRemainder='';emit();}
  function start(source){stop();program=typeof source==='string'?parseArduino(source):source;vars={...program.initial};index=0;phase='setup';started=now();running=true;emit();step();return program;}
  return {start,stop,reset(){if(program)start(program);},setAnalog(pin,value){if(!INPUT_GPIO.includes(Number(pin)))throw new Error('GPIO inválido.');analog[pin]=Math.max(0,Math.min(4095,Math.round(Number(value)||0)));emit();},setDigital(pin,value){digital[pin]=Number(Boolean(value));emit();},setBoot(pressed){boot=Boolean(pressed);digital[0]=pressed?0:1;emit();},get snapshot(){return snapshot();},get program(){return program;}};
}
if(typeof window!=='undefined')window.CodaESP32Runtime={OUTPUT_GPIO,INPUT_GPIO,ANALOG_DEMO,parseArduino,createRuntime};
