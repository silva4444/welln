@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale Node.js 22.5 ou mais recente no computador.
  pause
  exit /b 1
)
echo.
echo CODA para computador e celular na mesma rede Wi-Fi.
echo No celular, abra http://IP-DO-COMPUTADOR:8080
echo Para descobrir o IP do computador, veja o endereco IPv4 abaixo:
ipconfig | findstr /i "IPv4"
echo.
echo Mantenha esta janela aberta. Nao use 127.0.0.1 no celular.
echo.
node server.mjs --host 0.0.0.0 --port 8080
pause
