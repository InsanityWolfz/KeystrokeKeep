# Round 04 market probe helper: a DPI-aware WinForms window in PHYSICAL pixels.
# -Mode borderless : borderless window covering the rect (borderless-fullscreen game)
# -Mode maximized  : normal sizable window placed in the rect, then maximized
# -Mode bigframe   : normal sizable window whose rect = monitor + 8 px on every side (what a
#                    maximized window looks like on a monitor with no taskbar / auto-hide taskbar)
# -Mode overlay    : topmost, click-through, colour-keyed (invisible) window covering the rect
#                    (what screen overlays / recorders / dimmers create)
param([int]$X = 0, [int]$Y = 0, [int]$W = 800, [int]$H = 600, [string]$Mode = 'borderless', [int]$Ms = 8000, [string]$Color = '255,0,255')
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Windows.Forms, System.Drawing -TypeDefinition @"
using System; using System.Runtime.InteropServices; using System.Windows.Forms;
public static class KkDpi { [DllImport("user32.dll")] public static extern bool SetProcessDpiAwarenessContext(IntPtr v); }
public class KkOverlay : Form {
  protected override CreateParams CreateParams { get { var cp = base.CreateParams; cp.ExStyle |= 0x20 | 0x80000 | 0x8; return cp; } }
}
"@
[void][KkDpi]::SetProcessDpiAwarenessContext([IntPtr](-4))
$rgb = $Color.Split(',') | ForEach-Object { [int]$_ }
if ($Mode -eq 'overlay') { $f = New-Object KkOverlay } else { $f = New-Object System.Windows.Forms.Form }
$f.StartPosition = 'Manual'
$f.Text = "KK probe $Mode"
$f.BackColor = [System.Drawing.Color]::FromArgb($rgb[0], $rgb[1], $rgb[2])
switch ($Mode) {
  'borderless' { $f.FormBorderStyle = 'None'; $f.Bounds = New-Object System.Drawing.Rectangle($X, $Y, $W, $H) }
  'maximized'  { $f.FormBorderStyle = 'Sizable'; $f.Bounds = New-Object System.Drawing.Rectangle(($X + 100), ($Y + 100), 800, 500) }
  'bigframe'   { $f.FormBorderStyle = 'Sizable'; $f.Bounds = New-Object System.Drawing.Rectangle(($X - 8), ($Y - 8), ($W + 16), ($H + 16)) }
  'overlay'    { $f.FormBorderStyle = 'None'; $f.TopMost = $true; $f.ShowInTaskbar = $false; $f.TransparencyKey = $f.BackColor; $f.Bounds = New-Object System.Drawing.Rectangle($X, $Y, $W, $H) }
}
$t = New-Object System.Windows.Forms.Timer; $t.Interval = $Ms; $t.add_Tick({ $f.Close() }); $t.Start()
$f.add_Shown({
  if ($Mode -eq 'maximized') { $f.WindowState = 'Maximized' }
  if ($Mode -ne 'overlay') { $f.Activate() }
  [Console]::Out.WriteLine('HWND ' + $f.Handle.ToInt64()); [Console]::Out.Flush()
})
[System.Windows.Forms.Application]::Run($f)
