import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

test("códigos públicos solicitam acesso; somente administrador autenticado aprova", () => {
  const scenario = `
    import { createCodaServer } from './server.mjs';
    const server = createCodaServer();
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const send = async (path, body, cookie) => {
      const response = await fetch(origin + path, { method: 'POST', headers: {'content-type':'application/json', origin, ...(cookie?{cookie}:{})}, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
    };
    const patch = async (path, body, cookie) => {
      const response = await fetch(origin + path, { method: 'PATCH', headers: {'content-type':'application/json', origin, cookie}, body: JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const login = (email,password,role,code) => send('/api/auth/login', {email,password,role,adminCode:code,teacherCode:code});
    try {
      const wrong = await login('novo@example.com','MinhaSenha2026','Admin','errado');
      const pending = await login('novo@example.com','MinhaSenha2026','Admin','ADMIN-CODA');
      const before = await fetch(origin + '/api/auth/me');
      const takeover = await login('dono@example.com','SenhaAlterada2026','Admin','ADMIN-CODA');
      const owner = await login('dono@example.com','SenhaInicialForte2026','Admin','ADMIN-CODA');
      const dashboard = await fetch(origin + '/api/admin/dashboard',{headers:{cookie:owner.cookie}});
      const data = await dashboard.json();
      const request = data.accessRequests.find(item=>item.email==='novo@example.com');
      const forbidden = await patch('/api/admin/access-requests/'+request.id,{decision:'approved'},'');
      const approved = await patch('/api/admin/access-requests/'+request.id,{decision:'approved'},owner.cookie);
      const active = await login('novo@example.com','MinhaSenha2026','Admin','ADMIN-CODA');
      const teacherPending = await login('prof2@example.com','SenhaProf2026','Professor','PROF-CODA');
      console.log(JSON.stringify({wrong:wrong.status,pending:pending.status,pendingFlag:pending.body.pending,anonymous:(await before.json()).user,takeover:takeover.status,owner:owner.status,requestRole:request.role,forbidden:forbidden.status,approved:approved.status,active:active.status,activeRole:active.body.user?.role,teacherPending:teacherPending.status}));
    } finally { await new Promise(resolve => server.close(resolve)); }
  `;
  const env = { ...process.env, NODE_ENV: "production", CODA_DATABASE: ":memory:",
    CODA_TEACHER_EMAIL: "professor@example.com", CODA_TEACHER_PASSWORD: "SenhaProfessorForte2026",
    CODA_ADMIN_EMAIL: "dono@example.com", CODA_ADMIN_PASSWORD: "SenhaInicialForte2026" };
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", scenario],
    { cwd: new URL("../", import.meta.url), env, encoding: "utf8", timeout: 30_000 });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()), {
    wrong:403,pending:202,pendingFlag:true,anonymous:null,takeover:401,owner:200,requestRole:'Admin',forbidden:401,approved:200,active:200,activeRole:'Admin',teacherPending:202
  });
});

test("administrador adicional é provisionado sem substituir o administrador original",()=>{
  const scenario=`
    import {createCodaServer} from './server.mjs';
    const server=createCodaServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    const login=async(email,password)=>{const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email,password,role:'Admin',adminCode:'ADMIN-CODA'})});return {status:response.status,body:await response.json()}};
    try{const original=await login('dono@example.com','SenhaInicialForte2026');const added=await login('gabriel@coda.com','SenhaTemporariaForte2026');const denied=await login('gabriel@coda.com','SenhaErrada2026');console.log(JSON.stringify({original:original.status,added:added.status,role:added.body.user?.role,denied:denied.status}))}finally{await new Promise(resolve=>server.close(resolve))}
  `;
  const env={...process.env,NODE_ENV:'production',CODA_DATABASE:':memory:',CODA_TEACHER_EMAIL:'professor@example.com',CODA_TEACHER_PASSWORD:'SenhaProfessorForte2026',CODA_ADMIN_EMAIL:'dono@example.com',CODA_ADMIN_PASSWORD:'SenhaInicialForte2026',CODA_ADDITIONAL_ADMIN_EMAIL:'gabriel@coda.com',CODA_ADDITIONAL_ADMIN_PASSWORD:'SenhaTemporariaForte2026'};
  const result=spawnSync(process.execPath,['--input-type=module','-e',scenario],{cwd:new URL('../',import.meta.url),env,encoding:'utf8',timeout:20_000});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()),{original:200,added:200,role:'Admin',denied:401});
});

test("troca de senha exige a senha atual e aceita a nova no próximo login",()=>{
  const scenario=`
    import {createCodaServer} from './server.mjs';
    const server=createCodaServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+server.address().port;
    const login=async password=>{const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({email:'dono@example.com',password,role:'Admin',adminCode:'ADMIN-CODA'})});return {status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0]}};
    try{const initial=await login('SenhaInicialForte2026');const change=async(currentPassword,newPassword)=>{const response=await fetch(origin+'/api/auth/change-password',{method:'POST',headers:{origin,'content-type':'application/json',cookie:initial.cookie},body:JSON.stringify({currentPassword,newPassword})});return response.status};const wrong=await change('SenhaErrada2026','NovaSenhaSegura2026');const changed=await change('SenhaInicialForte2026','NovaSenhaSegura2026');const old=await login('SenhaInicialForte2026');const next=await login('NovaSenhaSegura2026');console.log(JSON.stringify({initial:initial.status,wrong,changed,old:old.status,next:next.status}))}finally{await new Promise(resolve=>server.close(resolve))}
  `;
  const env={...process.env,NODE_ENV:'production',CODA_DATABASE:':memory:',CODA_TEACHER_EMAIL:'professor@example.com',CODA_TEACHER_PASSWORD:'SenhaProfessorForte2026',CODA_ADMIN_EMAIL:'dono@example.com',CODA_ADMIN_PASSWORD:'SenhaInicialForte2026'};
  const result=spawnSync(process.execPath,['--input-type=module','-e',scenario],{cwd:new URL('../',import.meta.url),env,encoding:'utf8',timeout:20_000});
  assert.equal(result.status,0,result.stderr);
  assert.deepEqual(JSON.parse(result.stdout.trim()),{initial:200,wrong:401,changed:200,old:401,next:200});
});
