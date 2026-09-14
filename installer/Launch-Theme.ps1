[CmdletBinding()]
param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$productName = 'Codex Custom Themes for Windows'
$mutex = $null
$ownsMutex = $false
function Show-LaunchError([string]$Message) {
  if ($CheckOnly) { Write-Output $Message; return }
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($Message, $productName, 'OK', 'Warning') | Out-Null
}
function Get-PhysicalFile([string]$Path) {
  if (-not ('CodexCustomThemes.NativePath' -as [type])) {
    Add-Type -TypeDefinition @'
using System;
using System.Text;
using System.Runtime.InteropServices;
using Microsoft.Win32.SafeHandles;
namespace CodexCustomThemes {
  public static class NativePath {
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode, SetLastError=true)]
    public static extern uint GetFinalPathNameByHandle(SafeFileHandle h, StringBuilder p, uint n, uint f);
  }
}
'@
  }
  $stream = [IO.File]::OpenRead($Path)
  try {
    $buffer = New-Object Text.StringBuilder 32768
    $length = [CodexCustomThemes.NativePath]::GetFinalPathNameByHandle($stream.SafeFileHandle, $buffer, $buffer.Capacity, 0)
    if ($length -eq 0 -or $length -ge $buffer.Capacity) { throw 'Could not resolve the installed file path.' }
    $result = $buffer.ToString()
    if ($result.StartsWith('\\?\UNC\')) { return '\\' + $result.Substring(8) }
    if ($result.StartsWith('\\?\')) { return $result.Substring(4) }
    return $result
  } finally { $stream.Dispose() }
}
try {
  $installVersionRoot = Split-Path -Parent (Get-PhysicalFile (Join-Path $PSScriptRoot 'Launch-Theme.ps1'))
  $payload = Join-Path $installVersionRoot 'payload'
  $packageVersion = (Get-Content -LiteralPath (Join-Path $installVersionRoot 'VERSION.txt') -Raw).Trim()
  if ($packageVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'The installed package version is invalid. Reinstall the application.' }
  $hashes = Get-Content -LiteralPath (Join-Path $installVersionRoot 'FILES.json') -Raw | ConvertFrom-Json
  foreach ($entry in $hashes.PSObject.Properties) {
    if ($entry.Name -notmatch '^(payload|scripts)/[A-Za-z0-9_ ./-]+$' -or $entry.Name.Contains('..')) { throw 'The package contains an invalid path.' }
    $file = [IO.Path]::GetFullPath((Join-Path $installVersionRoot $entry.Name))
    if (-not $file.StartsWith($installVersionRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'The package path is outside the installation.' }
    if ((Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash -ne $entry.Value) { throw 'An installed file has changed. Reinstall the application before launching it.' }
  }
  if ($CheckOnly) {
    [pscustomobject]@{ Product=$productName; Version=$packageVersion; FilesVerified=@($hashes.PSObject.Properties).Count; PhysicalPath=$installVersionRoot } | ConvertTo-Json -Compress
    exit 0
  }
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $mutex = New-Object Threading.Mutex($false, ('Local\CodexCustomThemes-Launcher-' + $sid))
  try { $ownsMutex = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $ownsMutex = $true }
  if (-not $ownsMutex) { exit 0 }
  $ownConnector = Join-Path $payload 'connector.mjs'
  $foreign = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object {
    $_.CommandLine -and $_.CommandLine.Contains('connector.mjs') -and -not $_.CommandLine.Contains($ownConnector)
  })
  if ($foreign.Count) {
    throw "Another version of the theme is still running. Finish your tasks and close Codex normally, then open this shortcut again. Your saved themes and images will remain available."
  }
  $powerShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $launchOutput = & $powerShell -NoProfile -NonInteractive -WindowStyle Hidden -File (Join-Path $payload 'Start-CodexPink.ps1') 2>&1
  if ($LASTEXITCODE -ne 0) {
    if ($LASTEXITCODE -eq 2) { throw 'Codex is already open. Finish your tasks and close it normally, then open this shortcut to apply your themes.' }
    throw (($launchOutput | Out-String).Trim())
  }
  $connected = $false
  for ($attempt = 0; $attempt -lt 8; $attempt++) {
    $status = & $powerShell -NoProfile -NonInteractive -WindowStyle Hidden -File (Join-Path $installVersionRoot 'scripts\PinkGlass.ps1') -Action Status 2>&1
    if ($LASTEXITCODE -ne 0) { throw (($status | Out-String).Trim()) }
    $state = ($status | Out-String) | ConvertFrom-Json
    if ($state.active -and $state.version -eq $packageVersion) { $connected = $true; break }
    Start-Sleep -Milliseconds 400
  }
  if (-not $connected) { throw 'The theme has not connected yet. Close Codex normally and launch this shortcut again. If this continues, reinstall the application.' }
} catch {
  Show-LaunchError $_.Exception.Message
  # Tell the VBS wrapper that the detailed error was already displayed.
  exit 10
} finally {
  if ($ownsMutex) { $mutex.ReleaseMutex() }
  if ($mutex) { $mutex.Dispose() }
}
