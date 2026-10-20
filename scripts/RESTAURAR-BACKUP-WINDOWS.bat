@echo off
setlocal
cd /d "%~dp0\.."
echo Pare o servidor CODA antes de restaurar o banco.
set /p confirm=Digite PARAR para confirmar que o servidor foi fechado: 
if /i not "%confirm%"=="PARAR" (
  echo Restauracao cancelada.
  pause
  exit /b 2
)
set /p backup=Informe o caminho de um arquivo coda-backup-*.sqlite: 
if "%backup%"=="" (
  echo Nenhum arquivo informado.
  pause
  exit /b 2
)
set CODA_RESTORE_CONFIRM=SERVER_STOPPED
node scripts\restore-backup.mjs "%backup%"
if errorlevel 1 echo A restauracao falhou. O banco atual foi preservado.
pause
