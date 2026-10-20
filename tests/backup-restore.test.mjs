import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { restoreDatabaseBackup } from "../scripts/backup-restore.mjs";

function makeDb(path,value){const db=new DatabaseSync(path);db.exec("CREATE TABLE sample(value TEXT)");db.prepare("INSERT INTO sample(value) VALUES(?)").run(value);db.close()}

test("restaura um backup íntegro e guarda uma cópia do banco substituído",()=>{
  const root=mkdtempSync(join(tmpdir(),"coda-restore-test-")),database=join(root,"data","coda.sqlite"),backups=join(root,"data","backups"),source=join(backups,"coda-backup-test.sqlite");mkdirSync(backups,{recursive:true});makeDb(database,"atual");makeDb(source,"backup");
  try{const result=restoreDatabaseBackup(database,source,{backupDirectory:backups,timestamp:"teste"});const restored=new DatabaseSync(database,{readOnly:true}),previous=new DatabaseSync(result.safetyCopy,{readOnly:true});assert.equal(restored.prepare("SELECT value FROM sample").get().value,"backup");assert.equal(previous.prepare("SELECT value FROM sample").get().value,"atual");restored.close();previous.close()}
  finally{rmSync(root,{recursive:true,force:true})}
});

test("cancela backup corrompido sem alterar o banco ativo",()=>{
  const root=mkdtempSync(join(tmpdir(),"coda-restore-invalid-")),database=join(root,"data","coda.sqlite"),backups=join(root,"data","backups"),source=join(backups,"coda-backup-bad.sqlite");mkdirSync(backups,{recursive:true});makeDb(database,"preservado");writeFileSync(source,"não é SQLite");
  try{assert.throws(()=>restoreDatabaseBackup(database,source,{backupDirectory:backups}),/integridade/);const active=new DatabaseSync(database,{readOnly:true});assert.equal(active.prepare("SELECT value FROM sample").get().value,"preservado");active.close()}
  finally{rmSync(root,{recursive:true,force:true})}
});
