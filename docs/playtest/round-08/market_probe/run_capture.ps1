# R8 market: one timed capture-mode run of the dev shell (own -capture profile; never the real save).
# .\run_capture.ps1 -Name t1 -Save <save.json> -Script <cues.json> -Secs 30 [-Env @{KK_CAPTURE_BG='#00ff00'}] [-Shots 5,10] [-Keys @{8='8';12='8'}]
#   -Shots: seconds after launch at which to screenshot the bottom 420 px of the primary display (strip region) to out\<Name>_<t>.png
#   -Keys:  seconds -> digit, injects Ctrl+Shift+Alt+<digit> (capture hotkeys) with keybd_event
param([string]$Name, [string]$Save = '', [string]$Script = '', [int]$Secs = 30, [hashtable]$Env = @{}, [int[]]$Shots = @(), [hashtable]$Keys = @{})
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\..\.."
$out = "$PSScriptRoot\out"
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public static class KKW { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra); }
"@
[KKW]::SetProcessDPIAware() | Out-Null
$env:KK_CAPTURE = '1'
$env:KK_CAPTURE_SAVE = $Save; $env:KK_CAPTURE_SCRIPT = $Script
foreach ($k in $Env.Keys) { Set-Item -Path "env:$k" -Value $Env[$k] }
$p = Start-Process -FilePath "$root\node_modules\electron\dist\electron.exe" -ArgumentList '.' -WorkingDirectory $root -RedirectStandardOutput "$out\$Name.stdout.txt" -RedirectStandardError "$out\$Name.stderr.txt" -PassThru
$t0 = Get-Date
$events = @()
foreach ($s in $Shots) { $events += [pscustomobject]@{ t = $s; kind = 'shot'; v = $s } }
foreach ($k in $Keys.Keys) { $events += [pscustomobject]@{ t = [double]$k; kind = 'key'; v = $Keys[$k] } }
foreach ($e in ($events | Sort-Object t)) {
  $wait = $e.t - ((Get-Date) - $t0).TotalSeconds
  if ($wait -gt 0) { Start-Sleep -Milliseconds ([int]($wait * 1000)) }
  if ($e.kind -eq 'shot') {
    $W = 2560; $Hh = 420; $y = 1392 - $Hh
    $bmp = New-Object System.Drawing.Bitmap $W, $Hh
    $g = [System.Drawing.Graphics]::FromImage($bmp); $g.CopyFromScreen(0, $y, 0, 0, $bmp.Size); $g.Dispose()
    $bmp.Save("$out\${Name}_$($e.v).png", [System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
  } else {
    $vk = [byte](0x30 + [int]$e.v)
    foreach ($m in 0x11, 0x10, 0x12) { [KKW]::keybd_event([byte]$m, 0, 0, [UIntPtr]::Zero) }
    [KKW]::keybd_event($vk, 0, 0, [UIntPtr]::Zero); [KKW]::keybd_event($vk, 0, 2, [UIntPtr]::Zero)
    foreach ($m in 0x12, 0x10, 0x11) { [KKW]::keybd_event([byte]$m, 0, 2, [UIntPtr]::Zero) }
    Add-Content "$out\$Name.keys.txt" ("{0:N1}s hotkey Ctrl+Shift+Alt+{1}" -f ((Get-Date) - $t0).TotalSeconds, $e.v)
  }
}
$rest = $Secs - ((Get-Date) - $t0).TotalSeconds
if ($rest -gt 0) { Start-Sleep -Milliseconds ([int]($rest * 1000)) }
& taskkill /PID $p.Id /T /F | Out-Null
Start-Sleep -Milliseconds 500
Get-Content "$out\$Name.stdout.txt"
