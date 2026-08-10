param(
  [string]$FrontendDir = "frontend",
  [string]$BackendUrl = "http://127.0.0.1:8000",
  [int]$Requests = 20
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$frontendPath = Join-Path $root $FrontendDir

Write-Host "== Frontend build =="
$build = Measure-Command {
  Push-Location $frontendPath
  try {
    npm run build | Out-Host
  } finally {
    Pop-Location
  }
}

$assets = Get-ChildItem (Join-Path $frontendPath "dist/assets") -File |
  Sort-Object Length -Descending |
  Select-Object -First 10 Name, @{Name="KB"; Expression={[math]::Round($_.Length / 1KB, 2)}}

Write-Host "Build seconds: $([math]::Round($build.TotalSeconds, 2))"
Write-Host "Largest assets:"
$assets | Format-Table | Out-Host

Write-Host "== Backend latency =="
$health = "$BackendUrl/api/v1/health"
$samples = @()
for ($i = 0; $i -lt $Requests; $i++) {
  try {
    $elapsed = Measure-Command { Invoke-WebRequest -UseBasicParsing -Uri $health | Out-Null }
    $samples += $elapsed.TotalMilliseconds
  } catch {
    Write-Host "Backend unavailable at $health"
    break
  }
}

if ($samples.Count -gt 0) {
  $sorted = $samples | Sort-Object
  $avg = ($samples | Measure-Object -Average).Average
  $p95Index = [Math]::Min($sorted.Count - 1, [Math]::Ceiling($sorted.Count * 0.95) - 1)
  Write-Host "Requests: $($samples.Count)"
  Write-Host "Average ms: $([math]::Round($avg, 2))"
  Write-Host "P95 ms: $([math]::Round($sorted[$p95Index], 2))"
}
