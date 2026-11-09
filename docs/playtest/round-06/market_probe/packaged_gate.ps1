# R6 market: packaged self-test sprite gate (KK_SNAPSHOT = -selftest profile, never the real save).
# For each build x low-GPU setting: exit code, the gate line, and whether the GPU process really got
# --disable-direct-composition (read from its command line while the self-test runs).
# KK_SNAPSHOT_JS=blank: clears every knight frame at 2.5 s to prove the gate FAILS on blank sprites.
param([string]$Out = "C:\Development\KeystrokeKeep\docs\playtest\round-06\market_probe\out")
$ErrorActionPreference = 'Continue'
$builds = @(
  @{ tag = 'full'; exe = 'C:\Development\KeystrokeKeep\dist\full\win-unpacked\Keystroke Keep.exe' },
  @{ tag = 'demo'; exe = 'C:\Development\KeystrokeKeep\dist\demo\win-unpacked\Keystroke Keep Demo.exe' }
)
$blankJs = "for (const f of KK.SPR.frames.knight) f.c.getContext('2d').clearRect(0, 0, f.c.width, f.c.height); 'blanked'"
$rows = @()
foreach ($b in $builds) {
  foreach ($lg in @('auto', '1', '0', 'blank')) {
    $png = Join-Path $Out ("gate_{0}_{1}.png" -f $b.tag, $lg)
    $log = Join-Path $Out ("gate_{0}_{1}.log" -f $b.tag, $lg)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $b.exe; $psi.UseShellExecute = $false; $psi.RedirectStandardOutput = $true; $psi.RedirectStandardError = $true
    $psi.EnvironmentVariables['KK_SNAPSHOT'] = $png
    if ($lg -eq '1' -or $lg -eq '0') { $psi.EnvironmentVariables['KK_LOWGPU'] = $lg }
    if ($lg -eq 'blank') { $psi.EnvironmentVariables['KK_SNAPSHOT_JS'] = $blankJs }
    $p = [System.Diagnostics.Process]::Start($psi)
    $so = $p.StandardOutput.ReadToEndAsync(); $se = $p.StandardError.ReadToEndAsync()
    Start-Sleep -Seconds 3
    $gpu = Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $b.exe -and $_.CommandLine -match '--type=gpu-process' } | Select-Object -First 1
    $ddc = if ($gpu) { [bool]($gpu.CommandLine -match 'disable-direct-composition') } else { 'no gpu proc' }
    $null = $p.WaitForExit(30000)
    $text = $so.Result + $se.Result
    Set-Content -Path $log -Value $text -Encoding utf8
    $gate = ($text -split "`n" | Where-Object { $_ -match 'sprite check|SPRITE CHECK' }) -join ' '
    $rows += [pscustomobject]@{ build = $b.tag; lowGpu = $lg; exitCode = $p.ExitCode; gate = $gate.Trim(); gpuProcDisableDirectComposition = $ddc; png = (Test-Path $png) }
  }
}
$rows | ConvertTo-Json | Set-Content -Path (Join-Path $Out 'packaged_gate.json') -Encoding utf8
$rows | Format-Table -AutoSize | Out-String -Width 220
