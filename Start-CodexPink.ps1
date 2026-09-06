[CmdletBinding()]
param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$modRoot = $PSScriptRoot
$modPort = 9337
function Show-ModMessage([string]$message) {
  Add-Type -AssemblyName PresentationFramework
  [System.Windows.MessageBox]::Show($message, 'Codex Pink Mod') | Out-Null
}
try {
  $modPackage = Get-AppxPackage -Name OpenAI.Codex | Sort-Object Version -Descending | Select-Object -First 1
  if (-not $modPackage) { throw 'Official Codex is not installed.' }
  $modExe = Join-Path $modPackage.InstallLocation 'app\ChatGPT.exe'
  if (-not (Test-Path -LiteralPath $modExe -PathType Leaf)) { throw 'Codex executable was not found.' }
  $modNode = Join-Path $modRoot 'runtime\node.exe'
  if (-not (Test-Path -LiteralPath $modNode -PathType Leaf)) { throw 'The bundled Node runtime was not found.' }
  $modProcesses = @(Get-CimInstance Win32_Process -Filter "Name='ChatGPT.exe'" | Where-Object { $_.ExecutablePath -eq $modExe })
  $modListeners = @(Get-NetTCPConnection -LocalPort $modPort -State Listen -ErrorAction SilentlyContinue)
  if ($modProcesses.Count -gt 0 -and $modListeners.Count -eq 0) {
    Show-ModMessage 'Codex is already open without Pink Mod. Finish active tasks, fully close Codex, then open this launcher again. Nothing was restarted or changed.'
    exit 0
  }
  if ($modProcesses.Count -eq 0 -and $modListeners.Count -eq 0 -and -not $Remove) {
    Start-Process -FilePath $modExe -ArgumentList @('--remote-debugging-address=127.0.0.1', "--remote-debugging-port=$modPort") | Out-Null
  }
  $modDeadline = (Get-Date).AddSeconds(35)
  $modIdentity = $null
  do {
    $modListeners = @(Get-NetTCPConnection -LocalPort $modPort -State Listen -ErrorAction SilentlyContinue)
    if ($modListeners.Count -gt 0) {
      foreach ($modListener in $modListeners) {
        if ($modListener.LocalAddress -notin @('127.0.0.1','::1')) { throw 'The debugger must listen only on loopback.' }
        $modOwner = Get-CimInstance Win32_Process -Filter "ProcessId=$($modListener.OwningProcess)"
        if ($modOwner.ExecutablePath -ne $modExe) { throw 'Port 9337 belongs to another process. Connection refused.' }
      }
      try { $modIdentity = Invoke-RestMethod "http://127.0.0.1:$modPort/json/version" -TimeoutSec 2 -MaximumRedirection 0 } catch {}
    }
    if (-not $modIdentity) { Start-Sleep -Milliseconds 350 }
  } until ($modIdentity -or (Get-Date) -ge $modDeadline)
  if (-not $modIdentity) { throw 'Codex did not expose the local connection. No app files were changed. Close Codex and start it normally.' }
  $modSocket = [Uri]$modIdentity.webSocketDebuggerUrl
  $modBrowserId = $modSocket.Segments[-1]
  if ($modBrowserId -notmatch '^[A-Za-z0-9_-]{1,128}$') { throw 'Unexpected browser identity.' }
  $modConnector = Join-Path $modRoot 'connector.mjs'
  $modRunning = @(Get-CimInstance Win32_Process -Filter "Name='node.exe'" | Where-Object { $_.CommandLine -and $_.CommandLine.Contains($modConnector) })
  if ($Remove) {
    foreach ($modProcess in $modRunning) { Stop-Process -Id $modProcess.ProcessId }
    & $modNode $modConnector --port $modPort --browser-id $modBrowserId --remove
    if ($LASTEXITCODE -ne 0) { throw 'Removal was incomplete. Fully close Codex and open it normally.' }
    Show-ModMessage 'Pink Mod removed from current windows. Close Codex and launch it normally to also close the local debugging connection.'
  } elseif ($modRunning.Count -eq 0) {
    # Recover registrations left behind by a stopped connector in this browser.
    if (Test-Path -LiteralPath (Join-Path $modRoot '.connector-session.json')) {
      & $modNode $modConnector --port $modPort --browser-id $modBrowserId --remove
      if ($LASTEXITCODE -ne 0) { throw 'Could not recover the previous mod session.' }
    }
    $modArgs = '"' + $modConnector + '" --port ' + $modPort + ' --browser-id ' + $modBrowserId
    Start-Process -FilePath $modNode -ArgumentList $modArgs -WorkingDirectory $modRoot -WindowStyle Hidden -RedirectStandardOutput (Join-Path $modRoot 'connector.log') -RedirectStandardError (Join-Path $modRoot 'connector-error.log') | Out-Null
  }
} catch { Show-ModMessage $_.Exception.Message; exit 1 }
