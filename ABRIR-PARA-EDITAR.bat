@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title CODA - Modo de edicao
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale o Node.js 22.5 ou mais recente em https://nodejs.org/
  pause
  exit /b 1
)
node -e "import('node:sqlite').then(function(){process.exit(0)}).catch(function(){process.exit(1)})" >nul 2>nul
if errorlevel 1 (
  echo O Node.js instalado e antigo. Atualize para o Node.js 22.5 ou mais recente.
  pause
  exit /b 1
)
node dev.mjs %*
echo.
echo O servidor foi encerrado.
pause
