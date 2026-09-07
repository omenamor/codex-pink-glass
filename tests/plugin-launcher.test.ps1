$ErrorActionPreference='Stop'
$source=Join-Path $PSScriptRoot '..\plugins\pink-glass\scripts\PinkGlass.ps1'
$tokens=$null; $parseErrors=$null
$ast=[Management.Automation.Language.Parser]::ParseFile($source,[ref]$tokens,[ref]$parseErrors)
if($parseErrors.Count){throw ($parseErrors | Out-String)}
# Load helpers without running the install/enable dispatcher.
foreach($name in @('Resolve-PhysicalFile','Write-Launcher')) {
  $function=$ast.Find({param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq $name},$true)
  . ([scriptblock]::Create($function.Extent.Text))
}
$testParent=Join-Path $env:LOCALAPPDATA 'PinkGlassPlugin-tests'
$testRoot=Join-Path $testParent ([guid]::NewGuid().ToString('N'))
try {
  $installedPayload=Join-Path $testRoot 'PinkGlassPlugin\test version\payload'
  $desktop=Join-Path $testRoot 'Desktop'
  New-Item -ItemType Directory -Path $installedPayload,$desktop -Force | Out-Null
  $logical=Join-Path $installedPayload 'Codex Pink.vbs'
  Set-Content -LiteralPath $logical -Value "' path test only"
  $physical=Resolve-PhysicalFile $logical
  if($physical.StartsWith('\\?\') -or -not [IO.File]::Exists($physical)){throw 'Physical path is not shell-compatible'}
  if((Get-FileHash -LiteralPath $logical).Hash -ne (Get-FileHash -LiteralPath $physical).Hash){throw 'Resolved wrong file'}
  $installedPayload=Split-Path -Parent $physical
  Write-Launcher -DesktopPath $desktop | Out-Null
  Write-Launcher -DesktopPath $desktop | Out-Null
  $shell=New-Object -ComObject WScript.Shell
  $shortcutPath=Join-Path $desktop 'Codex Pink Glass.lnk'
  $shortcut=$shell.CreateShortcut($shortcutPath)
  if($shortcut.Arguments -cne ('"'+$physical+'"')){throw 'Shortcut lost physical path or quoting'}
  if($shortcut.WorkingDirectory -ne $installedPayload){throw 'Shortcut working directory differs'}
  # Existing unrelated shortcuts must survive installation.
  $shortcut.TargetPath=Join-Path $env:WINDIR 'System32\notepad.exe'
  $shortcut.Arguments=''
  $shortcut.Save()
  $before=(Get-FileHash -LiteralPath $shortcutPath).Hash
  Write-Launcher -DesktopPath $desktop -WarningAction SilentlyContinue | Out-Null
  if((Get-FileHash -LiteralPath $shortcutPath).Hash -ne $before){throw 'Unrelated shortcut overwritten'}
  $missingFailed=$false
  try {Resolve-PhysicalFile (Join-Path $testRoot 'missing.vbs') | Out-Null} catch {$missingFailed=$true}
  if(-not $missingFailed){throw 'Missing path was accepted'}
  Write-Output "PASS: physical path, spaces, repeated shortcut update, unrelated shortcut preservation, missing path rejection."
  Write-Output "Physical test location: $physical"
} finally {
  $resolvedTest=[IO.Path]::GetFullPath($testRoot)
  $resolvedParent=[IO.Path]::GetFullPath($testParent).TrimEnd('\')+'\'
  if(-not $resolvedTest.StartsWith($resolvedParent,[StringComparison]::OrdinalIgnoreCase)){throw 'Unsafe test cleanup path'}
  if(Test-Path -LiteralPath $resolvedTest){Remove-Item -LiteralPath $resolvedTest -Recurse -Force}
}

