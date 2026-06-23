$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

Write-Host ""
Write-Host "DraftOps one-click launcher" -ForegroundColor Cyan
Write-Host "Project: $PSScriptRoot"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Install Node.js 22+ first, then run this script again." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  Write-Host "npm was not found. Reinstall Node.js with npm enabled." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Yellow
  npm install
}

$url = "http://127.0.0.1:3002/"
Write-Host "Opening $url" -ForegroundColor Green
Start-Process $url

Write-Host ""
Write-Host "Starting dev server and DeepSeek chat proxy. Keep this window open while using DraftOps." -ForegroundColor Yellow
Write-Host "If port 3002 is occupied, stop the other process or run: npm run dev -- --host 127.0.0.1 --port 3003"
Write-Host ""

$agentHealthy = $false
try {
  $health = Invoke-WebRequest -Uri "http://127.0.0.1:4318/api/deepseek/health" -UseBasicParsing -TimeoutSec 2
  $agentHealthy = $health.StatusCode -eq 200
} catch {
  $agentHealthy = $false
}

if (-not $agentHealthy) {
  Write-Host "Starting DeepSeek local proxy on http://127.0.0.1:4318" -ForegroundColor Yellow
  Start-Process -FilePath node.exe -ArgumentList @("scripts/deepseek-chat-server.mjs") -WorkingDirectory $PSScriptRoot -WindowStyle Hidden
}

npm run dev:local
