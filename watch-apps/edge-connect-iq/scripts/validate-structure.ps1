param()

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$requiredPaths = @(
  "manifest.xml",
  "monkey.jungle",
  "source\App.mc",
  "source\Contract.mc",
  "source\BatchQueue.mc",
  "source\MetricCollector.mc",
  "source\WatchLinkService.mc",
  "source\StatusView.mc",
  "source\StatusDelegate.mc",
  "resources\strings\strings.xml"
)

$missing = @()
foreach ($relativePath in $requiredPaths) {
  $absolutePath = Join-Path $root $relativePath
  if (-not (Test-Path $absolutePath)) {
    $missing += $relativePath
  }
}

if ($missing.Count -gt 0) {
  Write-Error ("Fichiers Connect IQ manquants: " + ($missing -join ", "))
  exit 1
}

Write-Host "Squelette Connect IQ valide."
