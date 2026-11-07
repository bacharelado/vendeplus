@echo off
cd /d "%~dp0.."
echo VENDE+ -- Primeira execucao: npm install
if not exist node_modules (
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar dependencias. Verifique sua internet e versao do Node.
    pause
    exit /b 1
  )
)
echo Abrindo VENDE+ em http://localhost:5173
call npm run dev
pause
