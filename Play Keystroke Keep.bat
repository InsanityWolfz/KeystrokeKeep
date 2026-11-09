@echo off
rem Launches Keystroke Keep as an always-on-top strip at the bottom of your screen.
rem Right-click the crown icon in the system tray to pause input counting or quit.
cd /d "%~dp0"
if not exist node_modules\electron (
  echo First run: installing Electron...
  call npm install
)
start "" npx electron .
