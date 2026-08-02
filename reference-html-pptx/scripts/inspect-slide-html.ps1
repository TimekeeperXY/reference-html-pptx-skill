param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$ScreenshotPath,
  [int]$Width = 1760,
  [int]$Height = 1100
)

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$auditScript = Join-Path $scriptDir 'audit-slide-layout.mjs'
if (-not (Test-Path -LiteralPath $auditScript)) { throw "Audit script was not found: $auditScript" }

$outputParent = Split-Path -Parent $ScreenshotPath
if ($outputParent -and -not (Test-Path -LiteralPath $outputParent)) {
  New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
}

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) { throw 'Node.js was not found.' }

$exportSkillScripts = Join-Path (Split-Path -Parent $scriptDir) '..\export-editable-pptx\scripts'
$exportSkillScripts = [System.IO.Path]::GetFullPath($exportSkillScripts)
$playwright = Join-Path $exportSkillScripts 'node_modules\playwright-core\package.json'
if (-not (Test-Path -LiteralPath $playwright)) {
  if (-not (Test-Path -LiteralPath (Join-Path $exportSkillScripts 'package.json'))) {
    throw "Playwright dependency source was not found: $exportSkillScripts"
  }
  npm --prefix $exportSkillScripts install --no-audit --no-fund | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Failed to install the editable-PPTX exporter dependencies.' }
}

$json = & $node.Source $auditScript --input $resolvedInput --screenshot $ScreenshotPath --width $Width --height $Height --playwright-root $exportSkillScripts
$exitCode = $LASTEXITCODE
if (-not $json) { throw 'The slide auditor returned no result.' }
$result = $json | ConvertFrom-Json

if ($result.warnings.Count -gt 0) {
  foreach ($warning in $result.warnings) { Write-Warning $warning }
}
if ($exitCode -ne 0 -or $result.errors.Count -gt 0) {
  $details = ($result.errors -join [Environment]::NewLine)
  throw "HTML slide audit failed:`n$details"
}

$result
