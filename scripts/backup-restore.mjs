import { DatabaseSync } from "node:sqlite";
import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

function integrityCheck(file){
  let database;
  try{
    database=new DatabaseSync(file,{readOnly:true});
    const row=database.prepare("PRAGMA integrity_check").get();
    return Object.values(row||{})[0]==="ok";
  }catch{return false}finally{database?.close()}
}

export function restoreDatabaseBackup(databasePath,backupPath,{backupDirectory=join(dirname(resolve(databasePath)),"backups"),timestamp=new Date().toISOString().replace(/[:.]/g,"-")}={}){
  const database=resolve(databasePath),source=resolve(backupPath),allowedDirectory=resolve(backupDirectory);
  if(database===source)throw new Error("O arquivo de backup não pode ser o banco ativo.");
  if(dirname(source)!==allowedDirectory||!/^coda-(?:backup|before-restore)-[\w.-]+\.sqlite$/.test(basename(source)))throw new Error("Selecione um backup .sqlite da pasta de backups da Coda.");
  if(!existsSync(source)||!integrityCheck(source))throw new Error("O backup não existe ou falhou na verificação de integridade.");
  if(!existsSync(database)||!integrityCheck(database))throw new Error("O banco atual não existe ou falhou na verificação. A restauração foi cancelada.");
  mkdirSync(allowedDirectory,{recursive:true});
  const before=join(allowedDirectory,`coda-before-restore-${timestamp}.sqlite`),staged=join(dirname(database),`.coda-restore-${process.pid}-${timestamp}.sqlite`);
  if(existsSync(before)||existsSync(staged))throw new Error("Já existe um arquivo com o nome temporário de restauração.");
  copyFileSync(database,before);
  try{
    copyFileSync(source,staged);
    if(!integrityCheck(staged))throw new Error("A cópia temporária do backup falhou na verificação.");
    const displaced=join(dirname(database),`.coda-current-${process.pid}-${timestamp}.sqlite`);
    renameSync(database,displaced);
    try{renameSync(staged,database)}catch(error){renameSync(displaced,database);throw error}
    try{rmSync(displaced,{force:true})}catch{}
    return {restoredFrom:source,safetyCopy:before};
  }catch(error){rmSync(staged,{force:true});throw error}
}

