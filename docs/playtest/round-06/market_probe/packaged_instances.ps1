# R6 market: REAL (non-snapshot) launches of the packaged full + demo builds, to test the instance handling of 89f4651:
#   P1 same build twice while the strip is hidden (second-instance -> strip comes back)
#   P2 full running, demo launched -> dialog -> "Close the other one..." -> full saves + quits, demo starts
#   P3 demo running, full launched -> dialog -> Cancel -> full exits, demo keeps running
#   P4 demo running, full launched -> "Close the other one..." -> demo quits, full starts
# These builds always use %APPDATA%\Keystroke Keep[ Demo]. SAFETY: both folders are copied to a backup first and
# restored byte-for-byte in `finally` (the md5 of the real save is checked before and after).
param([string]$Out = "C:\Development\KeystrokeKeep\docs\playtest\round-06\market_probe\out",
      [string]$Backup = "C:\Users\SHAUN\AppData\Local\Temp\claude\17172949064ba502\e7281c9e-4091-4bbc-a584-0af95d1ec806\scratchpad\appdata_backup")
$ErrorActionPreference = 'Continue'
Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text; using System.Collections.Generic;
public static class KkW {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern int GetClassName(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
  public static string Wins(uint pid) {
    var sb = new StringBuilder();
    EnumWindows((h, l) => { uint p; GetWindowThreadProcessId(h, out p); if (p == pid && IsWindowVisible(h)) { var c = new StringBuilder(128); GetClassName(h, c, 128); sb.Append(c.ToString()).Append(';'); } return true; }, IntPtr.Zero);
    return sb.ToString();
  }
}
"@
$FULL = 'C:\Development\KeystrokeKeep\dist\full\win-unpacked\Keystroke Keep.exe'
$DEMO = 'C:\Development\KeystrokeKeep\dist\demo\win-unpacked\Keystroke Keep Demo.exe'
$AFull = Join-Path $env:APPDATA 'Keystroke Keep'; $ADemo = Join-Path $env:APPDATA 'Keystroke Keep Demo'
$realSave = Join-Path $AFull 'saves\keystroke-keep.json'
$R = [ordered]@{}
function MainPid($exe) { # the browser process = the one without --type=
  $p = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $exe -and $_.CommandLine -notmatch '--type=' } | Select-Object -First 1
  if ($p) { [uint32]$p.ProcessId } else { $null }
}
function StripVisible($exe) { $m = MainPid $exe; if (-not $m) { return 'not running' }; $w = [KkW]::Wins($m); return [bool]($w -match 'Chrome_WidgetWin_1') }
function KillAll { foreach ($e in @($FULL, $DEMO)) { Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $e } | ForEach-Object { try { Stop-Process -Id $_.ProcessId -Force } catch {} } }; Start-Sleep -Seconds 1 }
function Quit($exe) { $m = MainPid $exe; if ($m) { & taskkill.exe /PID $m | Out-Null; $null = (Get-Process -Id $m -ErrorAction SilentlyContinue).WaitForExit(10000) } }
function FindDialog($ownerExe, $timeoutS = 8) {
  $t0 = Get-Date
  while (((Get-Date) - $t0).TotalSeconds -lt $timeoutS) {
    $m = MainPid $ownerExe
    if ($m) {
      $cond = New-Object System.Windows.Automation.PropertyCondition([System.Windows.Automation.AutomationElement]::ProcessIdProperty, [int]$m)
      $wins = [System.Windows.Automation.AutomationElement]::RootElement.FindAll([System.Windows.Automation.TreeScope]::Children, $cond)
      foreach ($w in $wins) { if ($w.Current.ClassName -eq '#32770') { return $w } }
    }
    Start-Sleep -Milliseconds 250
  }
  return $null
}
function DialogInfo($d) {
  $all = $d.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  $texts = @(); $buttons = @()
  foreach ($e in $all) { if ($e.Current.ControlType.ProgrammaticName -eq 'ControlType.Button') { $buttons += $e.Current.Name } elseif ($e.Current.Name) { $texts += $e.Current.Name } }
  [ordered]@{ title = $d.Current.Name; texts = ($texts | Select-Object -Unique); buttons = $buttons }
}
function Click($d, $nameLike) {
  $all = $d.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition)
  foreach ($e in $all) { if ($e.Current.ControlType.ProgrammaticName -eq 'ControlType.Button' -and $e.Current.Name -like $nameLike) { $e.GetCurrentPattern([System.Windows.Automation.InvokePattern]::Pattern).Invoke(); return $e.Current.Name } }
  return $null
}
function SaveFloor($dir) { $f = Join-Path $dir 'saves\keystroke-keep.json'; if (Test-Path $f) { try { $j = Get-Content $f -Raw | ConvertFrom-Json; return [ordered]@{ floor = $j.floor; lastSave = $j.lastSave; mtime = (Get-Item $f).LastWriteTime.ToString('HH:mm:ss.fff') } } catch { return 'unreadable' } } else { return 'missing' } }

# ---------------- backup
if (MainPid $FULL -or MainPid $DEMO) { Write-Output 'ABORT: a packaged build is already running'; exit 1 }
$R.realSaveMd5Before = (Get-FileHash $realSave -Algorithm MD5).Hash
Remove-Item -Recurse -Force $Backup -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $Backup | Out-Null
$hadDemo = Test-Path $ADemo
& robocopy.exe $AFull (Join-Path $Backup 'full') /MIR /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
if ($hadDemo) { & robocopy.exe $ADemo (Join-Path $Backup 'demo') /MIR /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null }
$R.backupFiles = @(Get-ChildItem -Recurse -File (Join-Path $Backup 'full')).Count
try {
  # ---------------- P1: same build twice, strip hidden by the hotkey
  $p = Start-Process -FilePath $FULL -PassThru; Start-Sleep -Seconds 9
  $R.P1_visibleAtStart = StripVisible $FULL
  # Ctrl+Shift+Alt+K (the game's hide hotkey)
  foreach ($vk in 0x11, 0x10, 0x12) { [KkW]::keybd_event([byte]$vk, 0, 0, [UIntPtr]::Zero) }
  [KkW]::keybd_event(0x4B, 0, 0, [UIntPtr]::Zero); Start-Sleep -Milliseconds 60; [KkW]::keybd_event(0x4B, 0, 2, [UIntPtr]::Zero)
  foreach ($vk in 0x12, 0x10, 0x11) { [KkW]::keybd_event([byte]$vk, 0, 2, [UIntPtr]::Zero) }
  Start-Sleep -Seconds 2
  $R.P1_visibleAfterHotkey = StripVisible $FULL
  $p2 = Start-Process -FilePath $FULL -PassThru; Start-Sleep -Seconds 5
  $R.P1_secondExited = $p2.HasExited
  $R.P1_visibleAfterSecondLaunch = StripVisible $FULL
  $R.P1_fullProfileHasPrefs = Test-Path (Join-Path $AFull 'Preferences')
  # ---------------- P2: full running -> demo -> close the other one
  $R.P2_fullSaveBefore = SaveFloor $AFull
  $fullPid = MainPid $FULL
  $d0 = Get-Date
  $pd = Start-Process -FilePath $DEMO -PassThru
  $dlg = FindDialog $DEMO 10
  if ($dlg) {
    $R.P2_dialogAfterS = [math]::Round(((Get-Date) - $d0).TotalSeconds, 1)
    $R.P2_dialog = DialogInfo $dlg
    $t0 = Get-Date
    $R.P2_clicked = Click $dlg 'Close the other one*'
    $gone = $null; $demoUp = $null; $dialogs = 0
    while (((Get-Date) - $t0).TotalSeconds -lt 15) {
      if (-not $gone -and -not (Get-Process -Id $fullPid -ErrorAction SilentlyContinue)) { $gone = [math]::Round(((Get-Date) - $t0).TotalSeconds, 2) }
      if (-not $demoUp -and (StripVisible $DEMO) -eq $true) { $demoUp = [math]::Round(((Get-Date) - $t0).TotalSeconds, 2) }
      $again = FindDialog $DEMO 0.1; if ($again) { $dialogs++; $R.P2_secondDialog = DialogInfo $again; Click $again 'Cancel' | Out-Null }
      if ($gone -and $demoUp) { break }
      Start-Sleep -Milliseconds 200
    }
    $R.P2_fullExitedAfterS = $gone; $R.P2_demoStripVisibleAfterS = $demoUp; $R.P2_extraDialogs = $dialogs
    $R.P2_fullSaveAfter = SaveFloor $AFull
    $R.P2_demoProfileHasPrefs = Test-Path (Join-Path $ADemo 'Preferences')
    $R.P2_demoSave = SaveFloor $ADemo
  } else { $R.P2_dialog = 'NO DIALOG'; $R.P2_demoExited = $pd.HasExited }
  Start-Sleep -Seconds 4
  # ---------------- P3: demo running -> full -> Cancel
  $demoPid = MainPid $DEMO
  $pf = Start-Process -FilePath $FULL -PassThru
  $dlg = FindDialog $FULL 10
  if ($dlg) { $R.P3_dialog = DialogInfo $dlg; $R.P3_clicked = Click $dlg 'Cancel'; Start-Sleep -Seconds 3; $R.P3_fullExited = -not (MainPid $FULL); $R.P3_demoStillRunning = [bool](Get-Process -Id $demoPid -ErrorAction SilentlyContinue); $R.P3_demoVisible = StripVisible $DEMO }
  else { $R.P3_dialog = 'NO DIALOG' }
  # ---------------- P4: demo running -> full -> close the other one
  $pf = Start-Process -FilePath $FULL -PassThru
  $dlg = FindDialog $FULL 10
  if ($dlg) {
    $t0 = Get-Date; $R.P4_clicked = Click $dlg 'Close the other one*'
    $gone = $null; $fullUp = $null; $dialogs = 0
    while (((Get-Date) - $t0).TotalSeconds -lt 15) {
      if (-not $gone -and -not (Get-Process -Id $demoPid -ErrorAction SilentlyContinue)) { $gone = [math]::Round(((Get-Date) - $t0).TotalSeconds, 2) }
      if (-not $fullUp -and (StripVisible $FULL) -eq $true) { $fullUp = [math]::Round(((Get-Date) - $t0).TotalSeconds, 2) }
      $again = FindDialog $FULL 0.1; if ($again) { $dialogs++; Click $again 'Cancel' | Out-Null }
      if ($gone -and $fullUp) { break }
      Start-Sleep -Milliseconds 200
    }
    $R.P4_demoExitedAfterS = $gone; $R.P4_fullStripVisibleAfterS = $fullUp; $R.P4_extraDialogs = $dialogs
    $R.P4_demoSaveAfter = SaveFloor $ADemo
    # the full game now starts with a demo save present and a real full save: it must load its own save (no import)
    Start-Sleep -Seconds 3
  } else { $R.P4_dialog = 'NO DIALOG' }
  $R.gpuProcFlags = @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $FULL -and $_.CommandLine -match '--type=gpu-process' } | ForEach-Object { [bool]($_.CommandLine -match 'disable-direct-composition') })
  Quit $FULL; Quit $DEMO
} finally {
  KillAll
  # ---------------- restore byte-for-byte
  Remove-Item -Recurse -Force $AFull -ErrorAction SilentlyContinue
  & robocopy.exe (Join-Path $Backup 'full') $AFull /MIR /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null
  Remove-Item -Recurse -Force $ADemo -ErrorAction SilentlyContinue
  if ($hadDemo) { & robocopy.exe (Join-Path $Backup 'demo') $ADemo /MIR /COPY:DAT /DCOPY:DAT /R:1 /W:1 /NFL /NDL /NJH /NJS | Out-Null }
  $R.realSaveMd5After = (Get-FileHash $realSave -Algorithm MD5).Hash
  $R.restoredFiles = @(Get-ChildItem -Recurse -File $AFull).Count
  $R.restoredOk = ($R.realSaveMd5After -eq $R.realSaveMd5Before) -and ($R.restoredFiles -eq $R.backupFiles)
  $R | ConvertTo-Json -Depth 6 | Set-Content -Path (Join-Path $Out 'packaged_instances.json') -Encoding utf8
  $R | ConvertTo-Json -Depth 6
}
