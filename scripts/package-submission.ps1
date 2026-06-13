param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem

$root = Split-Path -Parent $PSScriptRoot
$manifestPath = Join-Path $root "manifest.json"
$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$version = $manifest.version
$dist = Join-Path $root "dist"
$stageRoot = Join-Path $dist "_stage"

$runtimeFiles = @(
  "background.js",
  "browser-polyfill.min.js",
  "content.js",
  "icons\\icon-128.png",
  "icons\\icon-16.png",
  "icons\\icon-32.png",
  "icons\\icon-48.png",
  "icons\\icon-96.png",
  "LICENSE",
  "manifest.json",
  "options.html",
  "options.js",
  "popup.css",
  "popup.html",
  "popup.js",
  "search.js",
  "sw.js"
)

$runtimeDirs = @()

$sourceFiles = @(
  "CHANGELOG.md",
  "LICENSE",
  "PRIVACY.md",
  "README.md",
  "background.js",
  "browser-polyfill.min.js",
  "content.js",
  "icons\\generate.py",
  "icons\\icon-128.png",
  "icons\\icon-16.png",
  "icons\\icon-32.png",
  "icons\\icon-48.png",
  "icons\\icon-96.png",
  "manifest.json",
  "options.html",
  "options.js",
  "popup.css",
  "popup.html",
  "popup.js",
  "search.js",
  "sw.js",
  "scripts\\package-submission.ps1",
  "docs\\AMO-listing.md",
  "docs\\AMO-source-package.md",
  "docs\\CHROME-listing.md",
  "docs\\FIREFOX-update.md",
  "docs\\SUBMISSION.md"
)

$sourceDirs = @()

function Reset-Dir([string]$Path) {
  if (Test-Path $Path) {
    Remove-Item -LiteralPath $Path -Recurse -Force
  }
  New-Item -ItemType Directory -Path $Path | Out-Null
}

function Copy-RelativeFile([string]$RelativePath, [string]$DestinationRoot) {
  $sourcePath = Join-Path $root $RelativePath
  if (-not (Test-Path $sourcePath)) {
    throw "Missing file: $RelativePath"
  }

  $destinationPath = Join-Path $DestinationRoot $RelativePath
  $destinationDir = Split-Path -Parent $destinationPath
  if (-not (Test-Path $destinationDir)) {
    New-Item -ItemType Directory -Path $destinationDir -Force | Out-Null
  }

  Copy-Item -LiteralPath $sourcePath -Destination $destinationPath -Force
}

function Copy-RelativeDir([string]$RelativePath, [string]$DestinationRoot) {
  $sourcePath = Join-Path $root $RelativePath
  if (-not (Test-Path $sourcePath)) {
    throw "Missing directory: $RelativePath"
  }

  $destinationPath = Join-Path $DestinationRoot $RelativePath
  $destinationParent = Split-Path -Parent $destinationPath
  if (-not (Test-Path $destinationParent)) {
    New-Item -ItemType Directory -Path $destinationParent -Force | Out-Null
  }

  Copy-Item -LiteralPath $sourcePath -Destination $destinationParent -Recurse -Force
}

function New-ZipFromSpec(
  [string]$Name,
  [string[]]$Files,
  [string[]]$Dirs
) {
  $stagePath = Join-Path $stageRoot $Name
  Reset-Dir $stagePath

  foreach ($file in $Files) {
    Copy-RelativeFile $file $stagePath
  }

  foreach ($dir in $Dirs) {
    Copy-RelativeDir $dir $stagePath
  }

  $zipPath = Join-Path $dist "$Name.zip"
  if (Test-Path $zipPath) {
    Remove-Item -LiteralPath $zipPath -Force
  }

  $zip = [System.IO.Compression.ZipFile]::Open($zipPath, [System.IO.Compression.ZipArchiveMode]::Create)
  try {
    $stagePrefixLength = $stagePath.Length + 1
    Get-ChildItem -LiteralPath $stagePath -Recurse -File | ForEach-Object {
      $fullName = $_.FullName
      $entryName = $fullName.Substring($stagePrefixLength).Replace('\', '/')
      $entry = $zip.CreateEntry($entryName, [System.IO.Compression.CompressionLevel]::Optimal)
      $entryStream = $entry.Open()
      $fileStream = [System.IO.File]::OpenRead($fullName)
      try {
        $fileStream.CopyTo($entryStream)
      } finally {
        $fileStream.Dispose()
        $entryStream.Dispose()
      }
    }
  } finally {
    $zip.Dispose()
  }

  return $zipPath
}

if (-not (Test-Path $dist)) {
  New-Item -ItemType Directory -Path $dist | Out-Null
}

Reset-Dir $stageRoot

$chromeZip = New-ZipFromSpec -Name "the-missing-link-chrome-webstore-v$version" -Files $runtimeFiles -Dirs $runtimeDirs
$firefoxZip = New-ZipFromSpec -Name "the-missing-link-firefox-amo-v$version" -Files $runtimeFiles -Dirs $runtimeDirs
$sourceZip = New-ZipFromSpec -Name "the-missing-link-firefox-source-v$version" -Files $sourceFiles -Dirs $sourceDirs

$instructions = @"
Chrome Web Store:
- Upload: $(Split-Path -Leaf $chromeZip)
- Listing copy: docs/CHROME-listing.md
- Privacy policy URL: https://github.com/rlfordon/the-missing-link/blob/main/PRIVACY.md
- Also prepare: at least one screenshot and one small promotional image

Firefox AMO update:
- Upload: $(Split-Path -Leaf $firefoxZip)
- Reviewer notes: docs/FIREFOX-update.md
- If AMO asks for source code, upload: $(Split-Path -Leaf $sourceZip)
- Listing copy: docs/AMO-listing.md
"@

$instructionsPath = Join-Path $dist "WHAT-TO-UPLOAD.txt"
Set-Content -Path $instructionsPath -Value $instructions -Encoding ASCII

Write-Host "Created:"
Write-Host " - $chromeZip"
Write-Host " - $firefoxZip"
Write-Host " - $sourceZip"
Write-Host " - $instructionsPath"
