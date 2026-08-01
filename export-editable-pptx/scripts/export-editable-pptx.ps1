param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputPath,
  [string]$SlideSelector = "",
  [int]$Width = 1920,
  [int]$Height = 1080
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$packageFile = Join-Path $scriptDir "package.json"
$moduleMarker = Join-Path $scriptDir "node_modules\pptxgenjs\package.json"

if (-not (Test-Path -LiteralPath $moduleMarker)) {
  Write-Host "Installing exporter dependencies..."
  npm --prefix $scriptDir install --no-audit --no-fund
  if ($LASTEXITCODE -ne 0) { throw "npm install failed with exit code $LASTEXITCODE" }
}

$argsList = @(
  (Join-Path $scriptDir "export-editable-pptx.mjs"),
  "--input", $InputPath,
  "--output", $OutputPath,
  "--width", "$Width",
  "--height", "$Height"
)
if ($SlideSelector) { $argsList += @("--selector", $SlideSelector) }

node @argsList
if ($LASTEXITCODE -ne 0) { throw "PPTX export failed with exit code $LASTEXITCODE" }
