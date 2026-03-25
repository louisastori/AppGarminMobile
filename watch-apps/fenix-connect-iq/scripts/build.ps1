param()

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$validateScript = Join-Path $PSScriptRoot "validate-structure.ps1"

& $validateScript

$compiler = Get-Command monkeyc -ErrorAction SilentlyContinue
$compilerPath = $null

if ($compiler) {
  $compilerPath = $compiler.Source
}

if (-not $compilerPath -and $env:CONNECTIQ_SDK_HOME) {
  $candidate = Join-Path $env:CONNECTIQ_SDK_HOME "bin\monkeyc.bat"
  if (Test-Path $candidate) {
    $compilerPath = $candidate
  }
}

if (-not $compilerPath) {
  $sdkConfig = Join-Path $env:APPDATA "Garmin\ConnectIQ\current-sdk.cfg"
  if (Test-Path $sdkConfig) {
    $sdkHome = (Get-Content $sdkConfig -ErrorAction SilentlyContinue | Select-Object -First 1).Trim()
    if ($sdkHome) {
      $candidate = Join-Path $sdkHome "bin\monkeyc.bat"
      if (Test-Path $candidate) {
        $compilerPath = $candidate
      }
    }
  }
}

if (-not $compilerPath) {
  Write-Host "Connect IQ SDK absent. Squelette valide, compilation sautee."
  exit 0
}

$devKey = $env:CONNECTIQ_DEV_KEY
if (-not $devKey) {
  $localDevKey = "C:\na\connectiq\developer_key.der"
  if (Test-Path $localDevKey) {
    $devKey = $localDevKey
  }
}

if (-not $devKey) {
  Write-Host "CONNECTIQ_DEV_KEY absent. Squelette valide, compilation sautee."
  exit 0
}

$manifest = Join-Path $root "manifest.xml"
$jungle = Join-Path $root "monkey.jungle"
$outputDir = Join-Path $root "bin"
$outputFile = Join-Path $outputDir "fenix-connect-iq.prg"

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Write-Host "Compilation Connect IQ en cours..."
& $compilerPath -f $jungle -o $outputFile -y $devKey
