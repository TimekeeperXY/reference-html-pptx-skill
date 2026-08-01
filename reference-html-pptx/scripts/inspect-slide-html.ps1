param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$ScreenshotPath,
  [int]$Width = 1600,
  [int]$Height = 900
)

$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$outputParent = Split-Path -Parent $ScreenshotPath
if ($outputParent -and -not (Test-Path -LiteralPath $outputParent)) {
  New-Item -ItemType Directory -Force -Path $outputParent | Out-Null
}

$browserCandidates = @(
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Microsoft\Edge\Application\msedge.exe',
  'C:\Program Files\Google\Chrome\Application\chrome.exe'
)
$browser = $browserCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $browser) { throw 'Microsoft Edge or Google Chrome was not found.' }

$fileUri = [System.Uri]::new($resolvedInput).AbsoluteUri
& $browser --headless --disable-gpu --hide-scrollbars "--window-size=$Width,$Height" "--screenshot=$ScreenshotPath" $fileUri | Out-Null

for ($i = 0; $i -lt 20 -and -not (Test-Path -LiteralPath $ScreenshotPath); $i++) {
  Start-Sleep -Milliseconds 250
}
if (-not (Test-Path -LiteralPath $ScreenshotPath)) { throw "Screenshot was not created: $ScreenshotPath" }

$html = Get-Content -Raw -LiteralPath $resolvedInput
$slideCount = ([regex]::Matches($html, 'class\s*=\s*["''][^"'']*\bslide\b')).Count
if ($slideCount -lt 1) { throw 'No .slide element found.' }

[pscustomobject]@{
  InputPath = $resolvedInput
  ScreenshotPath = (Resolve-Path -LiteralPath $ScreenshotPath).Path
  SlideCount = $slideCount
  Width = $Width
  Height = $Height
}
