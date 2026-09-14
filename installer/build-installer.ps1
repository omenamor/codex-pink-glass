[CmdletBinding()]
param(
  [string]$PluginPath,
  [string]$CompilerPath = (Join-Path $PSScriptRoot 'tools\inno\ISCC.exe'),
  [string]$OutputDirectory = (Join-Path $PSScriptRoot 'out'),
  [string]$LicensePath
)
$ErrorActionPreference = 'Stop'
if (-not $PluginPath) {
  $repositoryPlugin = Join-Path $PSScriptRoot '..\plugins\pink-glass'
  if (Test-Path -LiteralPath (Join-Path $repositoryPlugin 'VERSION.txt')) { $PluginPath = $repositoryPlugin }
  else { $PluginPath = Join-Path $env:USERPROFILE 'plugins\pink-glass' }
}
if (-not $LicensePath) {
  foreach ($candidate in @((Join-Path $PluginPath 'LICENSE'), (Join-Path $PSScriptRoot '..\LICENSE'), (Join-Path $PSScriptRoot '..\..\release\pink-glass-public\LICENSE'))) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) { $LicensePath = $candidate; break }
  }
}
if (-not $LicensePath) { throw 'Supply -LicensePath with the application MIT license.' }
$PluginPath = (Resolve-Path -LiteralPath $PluginPath).Path
$CompilerPath = (Resolve-Path -LiteralPath $CompilerPath).Path
$version = (Get-Content -LiteralPath (Join-Path $PluginPath 'VERSION.txt') -Raw).Trim()
if ($version -notmatch '^\d+\.\d+\.\d+$') { throw 'Invalid package version.' }
$packageHashes = Get-Content -LiteralPath (Join-Path $PluginPath 'FILES.json') -Raw | ConvertFrom-Json
$stage = Join-Path $PSScriptRoot ('stage\' + $version + '-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $stage -Force | Out-Null
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$OutputDirectory = (Resolve-Path -LiteralPath $OutputDirectory).Path
foreach ($entry in $packageHashes.PSObject.Properties) {
  if ($entry.Name -notmatch '^(payload|scripts)/[A-Za-z0-9_ ./-]+$' -or $entry.Name.Contains('..')) { throw "Invalid package entry: $($entry.Name)" }
  $source = Join-Path $PluginPath $entry.Name
  if ((Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash -ne $entry.Value) { throw "Package checksum mismatch: $($entry.Name)" }
  $destination = Join-Path $stage $entry.Name
  New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $destination
}
foreach ($name in @('FILES.json','VERSION.txt','README.md')) { Copy-Item -LiteralPath (Join-Path $PluginPath $name) -Destination $stage }
foreach ($name in @('Launch-Theme.ps1','Launch-Theme.vbs','WELCOME.txt')) { Copy-Item -LiteralPath (Join-Path $PSScriptRoot $name) -Destination $stage }
Copy-Item -LiteralPath $LicensePath -Destination (Join-Path $stage 'LICENSE.txt')
$compilerLicense = Join-Path (Split-Path -Parent $CompilerPath) 'License.txt'
Copy-Item -LiteralPath $compilerLicense -Destination (Join-Path $stage 'INNO-SETUP-LICENSE.txt')
$notices = @'
This application and installer were created by omenamor.
The bundled Node.js runtime includes its license at payload/runtime/LICENSE.txt.
The Windows setup wizard is built using Inno Setup by Jordan Russell and Martijn Laan.
Inno Setup: https://jrsoftware.org/ (license included in INNO-SETUP-LICENSE.txt).
The compiler itself is a build dependency and is not installed by this package.
'@
[IO.File]::WriteAllText((Join-Path $stage 'THIRD-PARTY-NOTICES.txt'), $notices, (New-Object Text.UTF8Encoding $false))

# Draw an original small app icon (layered theme panels), using only Windows APIs.
Add-Type -AssemblyName System.Drawing
$bitmap = New-Object Drawing.Bitmap 256,256
$graphics = [Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([Drawing.Color]::Transparent)
function Paint-RoundedPanel($G, [int]$X, [int]$Y, [int]$W, [int]$H, [int]$R, [string]$Color) {
  $path = New-Object Drawing.Drawing2D.GraphicsPath
  $d = 2 * $R
  $path.AddArc($X,$Y,$d,$d,180,90)
  $path.AddArc($X+$W-$d,$Y,$d,$d,270,90)
  $path.AddArc($X+$W-$d,$Y+$H-$d,$d,$d,0,90)
  $path.AddArc($X,$Y+$H-$d,$d,$d,90,90)
  $path.CloseFigure()
  $brush = New-Object Drawing.SolidBrush ([Drawing.ColorTranslator]::FromHtml($Color))
  $G.FillPath($brush,$path)
  $brush.Dispose(); $path.Dispose()
}
Paint-RoundedPanel $graphics 8 8 240 240 52 '#342E48'
Paint-RoundedPanel $graphics 43 48 146 137 25 '#A0CFC0'
Paint-RoundedPanel $graphics 65 70 146 137 25 '#D4B4E8'
Paint-RoundedPanel $graphics 82 89 112 20 10 '#FFF8FC'
Paint-RoundedPanel $graphics 82 124 72 10 5 '#FFF8FC'
Paint-RoundedPanel $graphics 82 148 95 10 5 '#FFF8FC'
$imageStream = New-Object IO.MemoryStream
$bitmap.Save($imageStream,[Drawing.Imaging.ImageFormat]::Png)
$png = $imageStream.ToArray()
$iconStream = [IO.File]::Create((Join-Path $stage 'app.ico'))
$writer = New-Object IO.BinaryWriter $iconStream
$writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]1)
$writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0); $writer.Write([byte]0)
$writer.Write([uint16]1); $writer.Write([uint16]32); $writer.Write([uint32]$png.Length); $writer.Write([uint32]22); $writer.Write($png)
$writer.Dispose(); $imageStream.Dispose(); $graphics.Dispose(); $bitmap.Dispose()

$stagedFiles = @(Get-ChildItem -LiteralPath $stage -File -Recurse | Sort-Object FullName | ForEach-Object {
  [ordered]@{ path=$_.FullName.Substring($stage.Length+1).Replace('\','/'); sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash.ToLowerInvariant() }
})
$manifest = [ordered]@{ product='Codex Custom Themes for Windows'; version=$version; files=$stagedFiles } | ConvertTo-Json -Depth 5
$manifestPath = Join-Path $stage 'INSTALLER-FILES.json'
[IO.File]::WriteAllText($manifestPath, $manifest, (New-Object Text.UTF8Encoding $false))
$versionId = $version + '-' + (Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.Substring(0,12).ToLowerInvariant()
$allFiles = @($stagedFiles) + @([ordered]@{path='INSTALLER-FILES.json';sha256=(Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()})
$fileLines = New-Object Collections.Generic.List[string]
$verifyLines = New-Object Collections.Generic.List[string]
foreach ($file in $allFiles) {
  $relative = $file.path.Replace('/','\')
  $parent = Split-Path -Parent $relative
  $dest = '{app}\versions\' + $versionId
  if ($parent) { $dest += '\' + $parent }
  $source = Join-Path $stage $relative
  $fileLines.Add('Source: "'+$source+'"; DestDir: "'+$dest+'"; Flags: ignoreversion onlyifdoesntexist')
  $installed = '{app}\versions\' + $versionId + '\' + $relative
  $verifyLines.Add("if FileExists(ExpandConstant('$installed')) then if CompareText(GetSHA256OfFile(ExpandConstant('$installed')), '$($file.sha256)') <> 0 then begin Result := 'An existing version has changed. Uninstall it before reinstalling; your saved themes will be kept.'; Exit; end;")
}
[IO.File]::WriteAllLines((Join-Path $stage 'files.iss'), $fileLines, (New-Object Text.UTF8Encoding $false))
[IO.File]::WriteAllLines((Join-Path $stage 'verify.iss'), $verifyLines, (New-Object Text.UTF8Encoding $false))
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'setup.iss') -Destination $stage
$compilerOutput = & $CompilerPath '/Qp' ("/DStageDir=$stage") ("/DProductVersion=$version") ("/DVersionId=$versionId") ("/DOutputDir=$OutputDirectory") (Join-Path $stage 'setup.iss') 2>&1
if ($LASTEXITCODE -ne 0) { $compilerOutput | Write-Output; throw 'Inno Setup compilation failed.' }
$artifact = Join-Path $OutputDirectory "Codex-Custom-Themes-Windows-Setup-$version.exe"
$hash = (Get-FileHash -LiteralPath $artifact -Algorithm SHA256).Hash.ToLowerInvariant()
[IO.File]::WriteAllText(($artifact+'.sha256'), ($hash+'  '+[IO.Path]::GetFileName($artifact)+"`n"), (New-Object Text.UTF8Encoding $false))
[pscustomobject]@{Artifact=$artifact;Version=$version;VersionId=$versionId;Stage=$stage;Bytes=(Get-Item -LiteralPath $artifact).Length;SHA256=$hash} | ConvertTo-Json
