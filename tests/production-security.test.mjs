import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

test("produção recusa iniciar sem credenciais secretas fortes",()=>{
  const directory=mkdtempSync(join(tmpdir(),"coda-production-guard-")),env={...process.env,NODE_ENV:"production",CODA_DATABASE:join(directory,"coda.sqlite")};
  for(const key of ["CODA_TEACHER_EMAIL","CODA_TEACHER_PASSWORD","CODA_TEACHER_CODE","CODA_ADMIN_EMAIL","CODA_ADMIN_PASSWORD","CODA_ADMIN_CODE"])delete env[key];
  try{const result=spawnSync(process.execPath,["-e","import('./server.mjs')"],{cwd:process.cwd(),env,encoding:"utf8"});assert.notEqual(result.status,0);assert.match(result.stderr,/Configuração de produção inválida/)}
  finally{rmSync(directory,{recursive:true,force:true})}
});
