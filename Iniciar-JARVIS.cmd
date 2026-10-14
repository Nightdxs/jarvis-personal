@echo off
set JARVIS_NO_PAID_API=1
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Instala Node.js 22 o superior desde https://nodejs.org
  pause
  exit /b 1
)
echo Iniciando JARVIS. Deja esta ventana abierta mientras lo usas.
echo Abre http://localhost:8787 en Chrome o Edge.
node server.mjs
pause
