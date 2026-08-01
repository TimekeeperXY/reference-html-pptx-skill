param(
  [Parameter(Mandatory=$true)][string]$InputPath,
  [Parameter(Mandatory=$true)][string]$OutputDirectory,
  [int]$Width = 1600,
  [int]$Height = 900
)

$ErrorActionPreference = 'Stop'
$resolvedInput = (Resolve-Path -LiteralPath $InputPath).Path
$resolvedOutput = [System.IO.Path]::GetFullPath($OutputDirectory)
New-Item -ItemType Directory -Force -Path $resolvedOutput | Out-Null

$powerPoint = $null
$presentation = $null
try {
  $powerPoint = New-Object -ComObject PowerPoint.Application
  $presentation = $powerPoint.Presentations.Open($resolvedInput, $true, $false, $false)
  $presentation.Export($resolvedOutput, 'PNG', $Width, $Height)
  $slideCount = $presentation.Slides.Count
  $presentation.Close()
  $presentation = $null
  $powerPoint.Quit()
  $powerPoint = $null

  $images = @(Get-ChildItem -LiteralPath $resolvedOutput -Filter '*.PNG' | Sort-Object Name)
  if ($images.Count -ne $slideCount) {
    throw "Expected $slideCount rendered slides but found $($images.Count)."
  }
  [pscustomobject]@{
    InputPath = $resolvedInput
    OutputDirectory = $resolvedOutput
    SlideCount = $slideCount
    Width = $Width
    Height = $Height
    Images = @($images.FullName)
  }
}
finally {
  if ($presentation) { try { $presentation.Close() } catch {} }
  if ($powerPoint) { try { $powerPoint.Quit() } catch {} }
  if ($presentation) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($presentation) }
  if ($powerPoint) { [void][System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPoint) }
  [GC]::Collect()
  [GC]::WaitForPendingFinalizers()
}
