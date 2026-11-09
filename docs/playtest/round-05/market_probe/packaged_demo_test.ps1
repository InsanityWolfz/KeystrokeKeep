# R5 market: real launch of the PACKAGED demo build (dist/demo), isolated: it only runs when
# %APPDATA%\Keystroke Keep Demo does not exist yet, and deletes that folder afterwards.
# The full game's real save (%APPDATA%\Keystroke Keep) is never launched against.
# Checks: boots under the fuses, both natives load from app.asar.unpacked, the uiohook hook counts
# injected keys (F24, harmless), single-instance re-launch, graceful quit writes the save, memory.
param([string]$Exe = "C:\Development\KeystrokeKeep\dist\demo\win-unpacked\Keystroke Keep Demo.exe", [int]$Keys = 40)
$ErrorActionPreference = 'Continue'
$demoDir = Join-Path $env:APPDATA 'Keystroke Keep Demo'
if (Test-Path $demoDir) { Write-Output "ABORT: $demoDir already exists (would not be isolated)"; exit 1 }
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class KkKeys { [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra); }
"@
$out = [ordered]@{}
$p = Start-Process -FilePath $Exe -PassThru
Start-Sleep -Seconds 9
$procs = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $Exe }
$out.processes = @($procs).Count
$ws = 0; $priv = 0
foreach ($c in $procs) { try { $gp = Get-Process -Id $c.ProcessId; $ws += $gp.WorkingSet64; $priv += $gp.PrivateMemorySize64 } catch {} }
$out.workingSetMB = [math]::Round($ws / 1MB); $out.privateMB = [math]::Round($priv / 1MB)
try { $out.nativeModules = @((Get-Process -Id $p.Id).Modules | Where-Object { $_.ModuleName -like '*.node' } | ForEach-Object { $_.FileName }) } catch { $out.nativeModules = "err $_" }
# hook test: F24 (0x87) down/up pairs, ~8/s (the game's token bucket allows 15/s)
for ($i = 0; $i -lt $Keys; $i++) { [KkKeys]::keybd_event(0x87, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 20; [KkKeys]::keybd_event(0x87, 0, 2, [UIntPtr]::Zero); Start-Sleep -Milliseconds 100 }
$out.keysInjected = $Keys
Start-Sleep -Seconds 1
# second launch of the same build: must not start a second strip
$p2 = Start-Process -FilePath $Exe -PassThru
Start-Sleep -Seconds 5
$out.secondInstanceExited = $p2.HasExited
$out.processesAfterSecondLaunch = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $Exe }).Count
if (-not $p2.HasExited) { Stop-Process -Id $p2.Id -Force }
# graceful quit (WM_CLOSE), then read the save it wrote
$t0 = Get-Date
& taskkill.exe /PID $p.Id | Out-Null
$exited = $p.WaitForExit(15000)
$out.gracefulExit = $exited; $out.exitSecs = [math]::Round(((Get-Date) - $t0).TotalSeconds, 1)
if (-not $exited) { & taskkill.exe /F /T /PID $p.Id | Out-Null; Start-Sleep -Seconds 1 }
Start-Sleep -Seconds 1
$save = Join-Path $demoDir 'saves\keystroke-keep.json'
if (Test-Path $save) {
  $j = Get-Content $save -Raw | ConvertFrom-Json
  $out.saveBytes = (Get-Item $save).Length; $out.statsKeys = $j.stats.keys; $out.statsClicks = $j.stats.clicks; $out.demoSave = $j.demoSave; $out.lowGpu = $j.settings.lowGpu
} else { $out.save = 'missing' }
$out.filesInDemoDir = @(Get-ChildItem -Recurse -File $demoDir -ErrorAction SilentlyContinue).Count
Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $Exe } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }
Start-Sleep -Seconds 1
Remove-Item -Recurse -Force $demoDir
$out.cleanedUp = -not (Test-Path $demoDir)
$out | ConvertTo-Json -Depth 4
