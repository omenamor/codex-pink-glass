[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
$compilerDirectory = Join-Path $PSScriptRoot 'tools\inno'
$compiler = Join-Path $compilerDirectory 'ISCC.exe'
if (Test-Path -LiteralPath $compiler -PathType Leaf) { Write-Output $compiler; exit 0 }
$downloadDirectory = Join-Path $PSScriptRoot 'tools'
New-Item -ItemType Directory -Path $downloadDirectory -Force | Out-Null
$download = Join-Path $downloadDirectory 'innosetup-6.4.3.exe'
$expectedHash = 'f3c42116542c4cc57263c5ba6c4feabfc49fe771f2f98a79d2f7628b8762723b'
Invoke-WebRequest -Uri 'https://github.com/jrsoftware/issrc/releases/download/is-6_4_3/innosetup-6.4.3.exe' -OutFile $download
if ((Get-FileHash -LiteralPath $download -Algorithm SHA256).Hash -ne $expectedHash) { throw 'The compiler download SHA256 did not match.' }
$signature = Get-AuthenticodeSignature -LiteralPath $download
if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'CN=Pyrsys B\.V\.') { throw 'The compiler publisher signature could not be verified.' }
$arguments = '/VERYSILENT /SUPPRESSMSGBOXES /NORESTART /CURRENTUSER /NOICONS /TASKS="" /DIR="' + $compilerDirectory + '"'
$process = Start-Process -FilePath $download -ArgumentList $arguments -WindowStyle Hidden -Wait -PassThru
if ($process.ExitCode -ne 0 -or -not (Test-Path -LiteralPath $compiler -PathType Leaf)) { throw 'Compiler installation failed.' }
Write-Output $compiler
