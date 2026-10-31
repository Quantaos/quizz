@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto missing_node
where npm >nul 2>nul
if errorlevel 1 goto missing_node

if not exist "node_modules\socket.io\package.json" (
  echo Cai dat thu vien cho QuizLab...
  call npm install
  if errorlevel 1 goto install_failed
)

start "QuizLab Server" /D "%~dp0" cmd /k npm start
timeout /t 3 /nobreak >nul
start "" "http://localhost:3000/host.html"
exit /b 0

:missing_node
echo Chua tim thay Node.js va npm tren may nay.
echo Hay cai Node.js ban LTS tu https://nodejs.org/ roi dong mo lai file nay.
start "" "https://nodejs.org/"
pause
exit /b 1

:install_failed
echo Cai thu vien that bai. Kiem tra ket noi Internet roi chay lai file nay.
pause
exit /b 1
