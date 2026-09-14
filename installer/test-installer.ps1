[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$InstallerPath, [string]$UpgradeInstallerPath)
$ErrorActionPreference = 'Stop'
$InstallerPath = (Resolve-Path -LiteralPath $InstallerPath).Path
if ($UpgradeInstallerPath) { $UpgradeInstallerPath = (Resolve-Path -LiteralPath $UpgradeInstallerPath).Path }
$qaRoot = Join-Path $PSScriptRoot ('qa\' + [guid]::NewGuid().ToString('N'))
$installPath = Join-Path $qaRoot 'Installed app with spaces'
New-Item -ItemType Directory -Path $qaRoot -Force | Out-Null
$desktopLink = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Codex Custom Themes for Windows.lnk'
$menuPath = Join-Path ([Environment]::GetFolderPath('Programs')) 'Codex Custom Themes for Windows'
$regPath = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\CodexCustomThemesForWindows_is1'
$beforeDesktop = Test-Path -LiteralPath $desktopLink
$beforeMenu = Test-Path -LiteralPath $menuPath
$beforeRegistry = Test-Path -LiteralPath $regPath
$powerShell = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
function Run-Setup([string]$Path, [string]$LogName) {
  $args = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /NOICONS /TESTINSTALL=1 /DIR="' + $installPath + '" /LOG="' + (Join-Path $qaRoot $LogName) + '"'
  $process = Start-Process -FilePath $Path -ArgumentList $args -WindowStyle Hidden -Wait -PassThru
  return $process.ExitCode
}
if ((Run-Setup $InstallerPath 'install.log') -ne 0) { throw "Silent install failed: $qaRoot" }
$versionDirs = @(Get-ChildItem -LiteralPath (Join-Path $installPath 'versions') -Directory)
if ($versionDirs.Count -ne 1) { throw 'Expected one immutable version directory.' }
$firstRoot = $versionDirs[0].FullName
$check = & $powerShell -NoProfile -NonInteractive -File (Join-Path $firstRoot 'Launch-Theme.ps1') -CheckOnly
if ($LASTEXITCODE -ne 0) { throw "Installed package verification failed: $check" }
if ((Run-Setup $InstallerPath 'reinstall.log') -ne 0) { throw 'Idempotent reinstall failed.' }
$renderer = Join-Path $firstRoot 'payload\renderer.js'
$original = [IO.File]::ReadAllBytes($renderer)
[IO.File]::AppendAllText($renderer,"`n// deliberate QA tamper")
$tamperedHash = (Get-FileHash -LiteralPath $renderer -Algorithm SHA256).Hash
if ((Run-Setup $InstallerPath 'tampered-reinstall.log') -eq 0) { throw 'Damaged same-version files were accepted.' }
if ((Get-FileHash -LiteralPath $renderer -Algorithm SHA256).Hash -ne $tamperedHash) { throw 'Reinstall overwrote an existing changed file.' }
[IO.File]::WriteAllBytes($renderer,$original)
if ($UpgradeInstallerPath) {
  if ((Run-Setup $UpgradeInstallerPath 'upgrade.log') -ne 0) { throw 'Upgrade failed.' }
  $versionDirs = @(Get-ChildItem -LiteralPath (Join-Path $installPath 'versions') -Directory)
  if ($versionDirs.Count -ne 2) { throw 'Upgrade did not keep separate version payloads.' }
  foreach ($versionDir in $versionDirs) {
    $verified = & $powerShell -NoProfile -NonInteractive -File (Join-Path $versionDir.FullName 'Launch-Theme.ps1') -CheckOnly
    if ($LASTEXITCODE -ne 0) { throw "Upgrade damaged a version: $verified" }
  }
}
$uninstaller = Join-Path $installPath 'unins000.exe'
$node = Join-Path $firstRoot 'payload\runtime\node.exe'
$fakeNode = Start-Process -FilePath $node -ArgumentList '-e "setInterval(()=>{},1000)" connector.mjs' -WindowStyle Hidden -PassThru
try {
  $args = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG="' + (Join-Path $qaRoot 'active-uninstall.log') + '"'
  $blocked = Start-Process -FilePath $uninstaller -ArgumentList $args -WindowStyle Hidden -Wait -PassThru
  if ($blocked.ExitCode -eq 0) { throw 'Uninstall should refuse an active owned connector.' }
  if (-not (Test-Path -LiteralPath $renderer)) { throw 'Uninstall removed an active runtime.' }
} finally {
  $fakeNode.Refresh()
  if (-not $fakeNode.HasExited) { Stop-Process -Id $fakeNode.Id -Force }
}
$keepPath = Join-Path $installPath 'user-added-file.txt'
[IO.File]::WriteAllText($keepPath,'User file: must not be removed by uninstall.')
$args = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /LOG="' + (Join-Path $qaRoot 'uninstall.log') + '"'
$removed = Start-Process -FilePath $uninstaller -ArgumentList $args -WindowStyle Hidden -Wait -PassThru
if ($removed.ExitCode -ne 0) { throw "Uninstall failed: $qaRoot" }
foreach ($versionDir in $versionDirs) {
  if (Test-Path -LiteralPath (Join-Path $versionDir.FullName 'payload\runtime\node.exe')) { throw 'Uninstall left a registered bundled runtime.' }
}
if (-not (Test-Path -LiteralPath $keepPath)) { throw 'Uninstall removed an unregistered user file.' }
if ((Test-Path -LiteralPath $desktopLink) -ne $beforeDesktop -or (Test-Path -LiteralPath $menuPath) -ne $beforeMenu -or (Test-Path -LiteralPath $regPath) -ne $beforeRegistry) { throw 'Isolated QA changed real shortcuts or registration.' }
[pscustomobject]@{Result='PASS';Checks=@('silent per-user install','installed package SHA256','same-version reinstall','changed-file rejection','active connector uninstall refusal','exact installed-file uninstall','user-added file preserved','real shortcuts and uninstall registration unchanged');Upgrade=([bool]$UpgradeInstallerPath);Output=$qaRoot;Package=($check|ConvertFrom-Json)} | ConvertTo-Json -Depth 5
