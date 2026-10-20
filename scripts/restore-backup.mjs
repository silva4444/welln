import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { restoreDatabaseBackup } from "./backup-restore.mjs";

const root=dirname(dirname(fileURLToPath(import.meta.url)));
const databasePath=resolve(process.env.CODA_DATABASE||join(root,"data","coda.sqlite"));
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  const backup=process.argv[2];
  if(!backup){console.error("Uso: node scripts/restore-backup.mjs data/backups/coda-backup-AAAA-MM-DD.sqlite");process.exitCode=2}
  else if(process.env.CODA_RESTORE_CONFIRM!=="SERVER_STOPPED"){
    console.error("Por segurança, pare o servidor e confirme com CODA_RESTORE_CONFIRM=SERVER_STOPPED.");process.exitCode=2;
  }else try{const result=restoreDatabaseBackup(databasePath,resolve(backup));console.log(`Banco restaurado de ${result.restoredFrom}`);console.log(`Cópia do banco anterior: ${result.safetyCopy}`)}catch(error){console.error(`Restauração cancelada: ${error.message}`);process.exitCode=1}
}

