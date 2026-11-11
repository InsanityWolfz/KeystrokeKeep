@echo off
rem Puts a "Keystroke Keep" shortcut on your desktop. Double-click this file once.
rem The shortcut runs "Play Keystroke Keep.bat" from this folder, so keep the folder where it is.
setlocal
set "KK_DIR=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dir = $env:KK_DIR.TrimEnd('\');" ^
  "$desk = [Environment]::GetFolderPath('Desktop');" ^
  "$lnk = Join-Path $desk 'Keystroke Keep.lnk';" ^
  "$s = (New-Object -ComObject WScript.Shell).CreateShortcut($lnk);" ^
  "$s.TargetPath = Join-Path $dir 'Play Keystroke Keep.bat';" ^
  "$s.WorkingDirectory = $dir;" ^
  "$s.IconLocation = (Join-Path $dir 'build\icon.ico') + ',0';" ^
  "$s.WindowStyle = 7;" ^
  "$s.Description = 'Keystroke Keep';" ^
  "$s.Save();" ^
  "Write-Host ('Shortcut created: ' + $lnk)"
if errorlevel 1 (
  echo Could not create the shortcut.
) else (
  echo Done. Double-click "Keystroke Keep" on your desktop to play.
)
pause
