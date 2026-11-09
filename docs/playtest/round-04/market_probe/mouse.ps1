# Round 04 market probe helper: injects tiny relative mouse moves (+1 / -1 px, net zero) for -Secs seconds,
# as fast as Thread.Sleep(1) allows, to measure what the global low-level mouse hook costs while you move the mouse.
param([int]$Secs = 8)
Add-Type -TypeDefinition @"
using System; using System.Runtime.InteropServices;
public static class KkMouse {
  [DllImport("user32.dll")] public static extern void mouse_event(uint f, int dx, int dy, uint d, UIntPtr e);
  [DllImport("winmm.dll")] public static extern uint timeBeginPeriod(uint p);
  [DllImport("winmm.dll")] public static extern uint timeEndPeriod(uint p);
  public static int Run(int secs) {
    timeBeginPeriod(1); int n = 0; var t0 = DateTime.UtcNow;
    while ((DateTime.UtcNow - t0).TotalSeconds < secs) { mouse_event(1, (n & 1) == 0 ? 1 : -1, 0, 0, UIntPtr.Zero); n++; System.Threading.Thread.Sleep(1); }
    timeEndPeriod(1); return n;
  }
}
"@
$n = [KkMouse]::Run($Secs)
[Console]::Out.WriteLine("MOVES $n")
