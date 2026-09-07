[CmdletBinding()]
param(
  [ValidateSet('Status','Install','Enable','Disable','Editor','Theme')][string]$Action='Status',
  [ValidateSet('sakura','lavender','moonlight','peach','mint')][string]$Theme
)
$ErrorActionPreference='Stop'
$pluginRoot=Split-Path -Parent $PSScriptRoot
$pluginVersion=(Get-Content -LiteralPath (Join-Path $pluginRoot 'VERSION.txt') -Raw).Trim()
if ($pluginVersion -notmatch '^[0-9]+\.[0-9]+\.[0-9]+$') {throw 'Invalid package version'}
$packageId=(Get-FileHash -LiteralPath (Join-Path $pluginRoot 'FILES.json') -Algorithm SHA256).Hash.Substring(0,12).ToLowerInvariant()
$installRoot=Join-Path $env:LOCALAPPDATA "PinkGlassPlugin\$pluginVersion-$packageId"
$installedPayload=Join-Path $installRoot 'payload'
$installedNode=Join-Path $installedPayload 'runtime\node.exe'

function Resolve-PhysicalFile([string]$Path) {
  # Resolve through a file handle: MSIX redirects LocalAppData for Codex, but
  # Explorer and Windows Script Host need the actual on-disk path.
  if(-not ('PinkGlass.NativePath' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace PinkGlass {
  public static class NativePath {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern uint GetFinalPathNameByHandle(SafeFileHandle handle, StringBuilder path, uint size, uint flags);
  }
}
'@
  }
  $file=[IO.File]::OpenRead($Path)
  try {
    $buffer=New-Object Text.StringBuilder 32768
    $length=[PinkGlass.NativePath]::GetFinalPathNameByHandle($file.SafeFileHandle,$buffer,$buffer.Capacity,0)
    if($length -eq 0 -or $length -ge $buffer.Capacity){throw "Could not resolve physical path: $Path"}
    $resolved=$buffer.ToString()
    if($resolved.StartsWith('\\?\UNC\')){return '\\'+$resolved.Substring(8)}
    if($resolved.StartsWith('\\?\')){return $resolved.Substring(4)}
    return $resolved
  } finally { $file.Dispose() }
}
function Set-PhysicalRuntime {
  $script:installedPayload=Split-Path -Parent (Resolve-PhysicalFile (Join-Path $installedPayload 'Codex Pink.vbs'))
  $script:installRoot=Split-Path -Parent $installedPayload
  $script:installedNode=Join-Path $installedPayload 'runtime\node.exe'
}
function Write-Launcher([string]$DesktopPath=[Environment]::GetFolderPath('Desktop')) {
  $launcher=Join-Path $installedPayload 'Codex Pink.vbs'
  Write-Output "Pink Glass launcher: $launcher"
  $desktop=$DesktopPath
  if(-not $desktop){Write-Warning 'Desktop is unavailable; use the launcher path above.';return}
  $shortcutPath=Join-Path $desktop 'Codex Pink Glass.lnk'
  $shell=New-Object -ComObject WScript.Shell
  $shortcut=$shell.CreateShortcut($shortcutPath)
  # Do not overwrite an unrelated shortcut that happens to have the same name.
  if((Test-Path -LiteralPath $shortcutPath) -and
     ($shortcut.TargetPath -notlike '*\wscript.exe' -or $shortcut.Arguments -notlike '*\PinkGlassPlugin\*\payload\Codex Pink.vbs"')) {
    Write-Warning "Shortcut already belongs to another program: $shortcutPath"
    return
  }
  $shortcut.TargetPath=Join-Path $env:WINDIR 'System32\wscript.exe'
  $shortcut.Arguments='"'+$launcher+'"'
  $shortcut.WorkingDirectory=$installedPayload
  $shortcut.Description='Launch Codex with Pink Glass'
  $shortcut.Save()
  Write-Output "Pink Glass shortcut: $(Resolve-PhysicalFile $shortcutPath)"
}
function Install-PinkGlass {
  $hashes=Get-Content -LiteralPath (Join-Path $pluginRoot 'FILES.json') -Raw | ConvertFrom-Json
  foreach($entry in $hashes.PSObject.Properties){
    if($entry.Name -match '(^|/)\.\.(/|$)' -or [IO.Path]::IsPathRooted($entry.Name)){throw 'Invalid package path'}
    $file=Join-Path $pluginRoot $entry.Name
    if((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.Value){throw "Package checksum mismatch: $($entry.Name)"}
  }
  if(Test-Path -LiteralPath $installRoot){
    foreach($entry in $hashes.PSObject.Properties){
      if((Get-FileHash -LiteralPath (Join-Path $installRoot $entry.Name) -Algorithm SHA256).Hash -ne $entry.Value){throw 'Existing runtime differs. Use a new plugin version; no files were overwritten.'}
    }
    Set-PhysicalRuntime
    return
  }
  New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
  foreach($entry in $hashes.PSObject.Properties){
    $dest=Join-Path $installRoot $entry.Name
    New-Item -ItemType Directory -Path (Split-Path -Parent $dest) -Force | Out-Null
    Copy-Item -LiteralPath (Join-Path $pluginRoot $entry.Name) -Destination $dest
  }
  Copy-Item -LiteralPath (Join-Path $pluginRoot 'VERSION.txt') -Destination $installRoot
  Set-PhysicalRuntime
}
function Get-CodexIdentity {
  $package=Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
  if(-not $package){throw 'Official Codex for Windows is not installed.'}
  $exe=Join-Path $package.InstallLocation 'app\ChatGPT.exe'
  $listeners=@(Get-NetTCPConnection -LocalPort 9337 -State Listen -ErrorAction SilentlyContinue)
  if(-not $listeners.Count){return $null}
  foreach($listener in $listeners){
    $owner=Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    if($listener.LocalAddress -notin @('127.0.0.1','::1') -or $owner.ExecutablePath -ne $exe){throw 'Port 9337 is not a verified local Codex process.'}
  }
  $info=Invoke-RestMethod 'http://127.0.0.1:9337/json/version' -TimeoutSec 5 -MaximumRedirection 0
  $uri=[Uri]$info.webSocketDebuggerUrl
  if($uri.Scheme -ne 'ws' -or $uri.Host -notin @('127.0.0.1','localhost','[::1]') -or $uri.Port -ne 9337 -or $uri.AbsolutePath -notmatch '^/devtools/browser/([A-Za-z0-9_-]{1,128})$'){throw 'Invalid debugger identity'}
  return $Matches[1]
}
if($Action -eq 'Install'){Install-PinkGlass; Write-Output "Installed runtime: $installRoot"; Write-Launcher; exit 0}
$identity=Get-CodexIdentity
if($Action -eq 'Status'){
  if(-not $identity){Write-Output '{"connected":false,"reason":"Start Codex through the Pink Glass launcher after closing it normally."}';exit 0}
  & (Join-Path $pluginRoot 'payload\runtime\node.exe') (Join-Path $PSScriptRoot 'control.mjs') status $identity
  exit $LASTEXITCODE
}
if($Action -eq 'Enable'){
  Install-PinkGlass
  Write-Launcher
  # Never stack a plugin connector over a mod running from another installation.
  $foreign=@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -like '*connector.mjs*' -and $_.CommandLine -notlike "*$installedPayload\connector.mjs*"})
  if($foreign.Count){throw 'Another Pink Glass connector is running. Disable it with its original launcher before enabling this plugin.'}
  & (Join-Path $installedPayload 'Start-CodexPink.ps1')
  if($LASTEXITCODE -ne 0){exit $LASTEXITCODE}
  $enabled=$false
  for($attempt=0;$attempt -lt 10;$attempt++){
    $identity=Get-CodexIdentity
    if($identity){
      $result=& $installedNode (Join-Path $installRoot 'scripts\control.mjs') status $identity
      if($LASTEXITCODE -eq 0){$state=$result | ConvertFrom-Json;if($state.active -and $state.version -eq $pluginVersion){$enabled=$true;break}}
    }
    Start-Sleep -Milliseconds 400
  }
  if(-not $enabled){throw "Connector did not confirm version $pluginVersion. Inspect $installedPayload\connector-error.log"}
  Write-Output $result
  Write-Output "Pink Glass launcher: $installedPayload\Codex Pink.vbs"
  exit 0
}
if(-not $identity){throw 'Codex is open without a local connection. Finish tasks, close Codex normally and use Enable.'}
if($Action -eq 'Disable'){
  if(-not (Test-Path -LiteralPath $installedNode)){throw 'Plugin runtime is not installed; use the original mod launcher to disable it.'}
  Set-PhysicalRuntime
  $foreign=@(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {$_.CommandLine -like '*connector.mjs*' -and $_.CommandLine -notlike "*$installedPayload\connector.mjs*"})
  if($foreign.Count){throw 'Another installation is active. Use its original launcher to disable it.'}
  & (Join-Path $installedPayload 'Start-CodexPink.ps1') -Remove
  exit $LASTEXITCODE
}
if($Action -eq 'Theme' -and -not $Theme){throw 'Supply -Theme sakura, lavender, moonlight, peach or mint'}
& (Join-Path $pluginRoot 'payload\runtime\node.exe') (Join-Path $PSScriptRoot 'control.mjs') $Action.ToLowerInvariant() $identity $Theme
exit $LASTEXITCODE
