param(
    [string]$Version = "0.3.0"
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$extensionDir = Join-Path $root "extensions\chrome-edge"
$releaseDir = Join-Path $root "releases"
$stagingDir = Join-Path $releaseDir "passworder-chrome-edge-v$Version"
$zipPath = Join-Path $releaseDir "passworder-chrome-edge-v$Version.zip"

if (!(Test-Path -LiteralPath (Join-Path $extensionDir "manifest.json"))) {
    throw "Extension manifest not found: $extensionDir"
}

if (Test-Path -LiteralPath $stagingDir) {
    Remove-Item -LiteralPath $stagingDir -Recurse -Force
}

New-Item -ItemType Directory -Path $stagingDir -Force | Out-Null

$items = @(
    "manifest.json",
    "background.js",
    "content.js",
    "popup.html",
    "popup.css",
    "popup.js",
    "README.md",
    "BUILD.md",
    "pkg"
)

foreach ($item in $items) {
    $source = Join-Path $extensionDir $item
    $destination = Join-Path $stagingDir $item
    if (!(Test-Path -LiteralPath $source)) {
        throw "Missing extension resource: $item"
    }
    Copy-Item -LiteralPath $source -Destination $destination -Recurse -Force
}

if (Test-Path -LiteralPath $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
}

$archiveItems = Get-ChildItem -LiteralPath $stagingDir -Force
Compress-Archive -LiteralPath $archiveItems.FullName -DestinationPath $zipPath -Force

Write-Output "Created $zipPath"
Write-Output "Load unpacked directory: $stagingDir"
