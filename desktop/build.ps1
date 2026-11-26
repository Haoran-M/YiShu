[CmdletBinding()]
param([string]$DependencyCache = (Join-Path $env:LOCALAPPDATA 'YiShu\BuildDependencies'))

$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $PSScriptRoot
$site = Join-Path $project 'sites\yishu\dist'
$deliverables = Join-Path $project 'dist'
$stage = Join-Path $PSScriptRoot 'build\YiShu'
$version = '1.0.4314.35'
$package = Join-Path $DependencyCache "webview2-$version"
$archive = Join-Path $package 'webview2.nupkg'
$checksum = '90778DEB1B77E36292828B4B5833C9255C27533F40E0DDD55891AE718944EDC4'
$framework = Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319'

if (!(Test-Path -LiteralPath (Join-Path $site 'index.html'))) { throw 'Website output is missing.' }
New-Item -ItemType Directory -Force -Path $package,$deliverables,$stage,(Join-Path $stage 'website') | Out-Null
if (!(Test-Path -LiteralPath $archive)) {
    curl.exe -fsSL --retry 2 -o $archive "https://api.nuget.org/v3-flatcontainer/microsoft.web.webview2/$version/microsoft.web.webview2.$version.nupkg"
    if ($LASTEXITCODE -ne 0) { throw 'WebView2 SDK download failed.' }
}
if ((Get-FileHash -LiteralPath $archive).Hash -ne $checksum) { throw 'Unexpected WebView2 SDK checksum.' }
if (!(Test-Path -LiteralPath (Join-Path $package 'lib\net462\Microsoft.Web.WebView2.WinForms.dll'))) {
    tar.exe -xf $archive -C $package
    if ($LASTEXITCODE -ne 0) { throw 'WebView2 SDK extraction failed.' }
}
$lib = Join-Path $package 'lib\net462'
$dlls = @((Join-Path $lib 'Microsoft.Web.WebView2.WinForms.dll'),(Join-Path $lib 'Microsoft.Web.WebView2.Core.dll'))
$loader = Join-Path $package 'runtimes\win-x64\native\WebView2Loader.dll'

Copy-Item -LiteralPath $dlls -Destination $stage -Force
Copy-Item -LiteralPath $loader -Destination $stage -Force
Copy-Item -LiteralPath (Join-Path $package 'LICENSE.txt') -Destination (Join-Path $stage 'WebView2-LICENSE.txt') -Force
Copy-Item -LiteralPath (Join-Path $package 'NOTICE.txt') -Destination (Join-Path $stage 'WebView2-NOTICE.txt') -Force
Get-ChildItem -LiteralPath $site -Force | Where-Object Name -ne 'server' | Copy-Item -Destination (Join-Path $stage 'website') -Recurse -Force
Copy-Item -LiteralPath (Join-Path $PSScriptRoot 'START-HERE.txt') -Destination $stage -Force

$iconImage = [IO.File]::ReadAllBytes((Join-Path $site 'assets\mark.png'))
$iconPath = Join-Path (Split-Path -Parent $stage) 'YiShu.ico'
$iconStream = [IO.File]::Open($iconPath,[IO.FileMode]::Create)
$icon = [IO.BinaryWriter]::new($iconStream)
try {
    $icon.Write([uint16]0)
    $icon.Write([uint16]1)
    $icon.Write([uint16]1)
    $icon.Write([byte]96)
    $icon.Write([byte]96)
    $icon.Write([byte]0)
    $icon.Write([byte]0)
    $icon.Write([uint16]1)
    $icon.Write([uint16]32)
    $icon.Write([uint32]$iconImage.Length)
    $icon.Write([uint32]22)
    $icon.Write($iconImage)
} finally { $icon.Dispose() }

$compiler = Join-Path $framework 'csc.exe'
$exe = Join-Path $stage 'YiShu.exe'
$compilerArgs = @('/nologo','/target:winexe','/platform:x64','/optimize+','/utf8output','/codepage:65001',"/out:$exe",
    "/win32manifest:$(Join-Path $PSScriptRoot 'YiShu.manifest')","/win32icon:$iconPath",
    '/reference:System.Drawing.dll','/reference:System.Windows.Forms.dll',
    "/reference:$($dlls[0])","/reference:$($dlls[1])",(Join-Path $PSScriptRoot 'Program.cs'))
& $compiler @compilerArgs
if ($LASTEXITCODE -ne 0) { throw 'Desktop compilation failed.' }

$zip = Join-Path $deliverables 'YiShu-1.3.0-Windows-x64.zip'
Compress-Archive -LiteralPath $stage -DestinationPath $zip -Force
Write-Output "Windows package: $zip"
Get-FileHash -LiteralPath $zip
