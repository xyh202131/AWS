$ErrorActionPreference = "Stop"

Set-Location -LiteralPath $PSScriptRoot

function Test-LocalPortAvailable {
  param([Parameter(Mandatory = $true)][int]$Port)

  $listener = $null
  try {
    $address = [System.Net.IPAddress]::Parse("127.0.0.1")
    $endpoint = [System.Net.IPEndPoint]::new($address, $Port)
    $listener = [System.Net.Sockets.TcpListener]::new($endpoint)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($null -ne $listener) {
      $listener.Stop()
    }
  }
}

function Get-AvailableLocalPort {
  param(
    [Parameter(Mandatory = $true)][int]$StartPort,
    [int]$Attempts = 40
  )

  for ($port = $StartPort; $port -lt ($StartPort + $Attempts); $port++) {
    if (Test-LocalPortAvailable -Port $port) {
      return $port
    }
  }

  throw "No available local port from $StartPort to $($StartPort + $Attempts - 1)."
}

function Test-AgentHealthy {
  param(
    [Parameter(Mandatory = $true)][int]$Port,
    [string]$Origin
  )

  try {
    $headers = @{}
    if ($Origin) {
      $headers["Origin"] = $Origin
    }

    $health = Invoke-WebRequest -Uri "http://127.0.0.1:$Port/api/deepseek/health" -UseBasicParsing -TimeoutSec 2 -Headers $headers
    if ($health.StatusCode -ne 200) {
      return $false
    }

    if ($Origin) {
      $allowedOrigins = @($health.Headers["Access-Control-Allow-Origin"])
      return ($allowedOrigins -contains $Origin) -or ($allowedOrigins -contains "*")
    }

    return $true
  } catch {
    return $false
  }
}

function Wait-ForHttp {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 30
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 1
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $true
      }
    } catch {
      Start-Sleep -Milliseconds 500
    }
  }

  return $false
}

function Set-ProcessEnvironmentValue {
  param(
    [Parameter(Mandatory = $true)][string]$Name,
    [AllowNull()][string]$Value
  )

  if ($null -eq $Value) {
    Remove-Item -LiteralPath "Env:\$Name" -ErrorAction SilentlyContinue
  } else {
    Set-Item -LiteralPath "Env:\$Name" -Value $Value
  }
}

Write-Host ""
Write-Host "DraftOps one-click launcher" -ForegroundColor Cyan
Write-Host "Project: $PSScriptRoot"
Write-Host ""

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "Node.js was not found. Install Node.js 22+ first, then run this script again." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

$npmCommand = Get-Command npm.cmd -ErrorAction SilentlyContinue
if (-not $npmCommand) {
  $npmCommand = Get-Command npm -ErrorAction SilentlyContinue
}

if (-not $npmCommand) {
  Write-Host "npm was not found. Reinstall Node.js with npm enabled." -ForegroundColor Red
  Read-Host "Press Enter to exit"
  exit 1
}

$npmPath = $npmCommand.Source

if (-not (Test-Path -LiteralPath "node_modules")) {
  Write-Host "Installing dependencies..." -ForegroundColor Yellow
  & $npmPath install
  if ($LASTEXITCODE -ne 0) {
    Read-Host "Dependency install failed. Press Enter to exit"
    exit $LASTEXITCODE
  }
}

$clientPort = Get-AvailableLocalPort -StartPort 3002
$clientOrigin = "http://127.0.0.1:$clientPort"
$url = "$clientOrigin/"

if ($clientPort -ne 3002) {
  Write-Host "Port 3002 is occupied; using DraftOps frontend port $clientPort." -ForegroundColor Yellow
}

$agentPort = 4318
$agentHealthy = Test-AgentHealthy -Port $agentPort -Origin $clientOrigin
$agentProcess = $null

if ($agentHealthy) {
  Write-Host "Using existing DeepSeek local proxy on http://127.0.0.1:$agentPort" -ForegroundColor Green
} else {
  if (-not (Test-LocalPortAvailable -Port $agentPort)) {
    $agentPort = Get-AvailableLocalPort -StartPort 4319
    Write-Host "Port 4318 is occupied by another process; using DeepSeek proxy port $agentPort." -ForegroundColor Yellow
  }

  Write-Host "Starting DeepSeek local proxy on http://127.0.0.1:$agentPort" -ForegroundColor Yellow
  $previousAgentPort = $env:DEEPSEEK_AGENT_PORT
  $previousClientOrigin = $env:DRAFTOPS_CLIENT_ORIGIN
  $env:DEEPSEEK_AGENT_PORT = [string]$agentPort
  $env:DRAFTOPS_CLIENT_ORIGIN = $clientOrigin
  $agentProcess = Start-Process -FilePath node.exe -ArgumentList @("scripts/deepseek-chat-server.mjs") -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru
  Set-ProcessEnvironmentValue -Name "DEEPSEEK_AGENT_PORT" -Value $previousAgentPort
  Set-ProcessEnvironmentValue -Name "DRAFTOPS_CLIENT_ORIGIN" -Value $previousClientOrigin

  $agentReady = $false
  for ($attempt = 0; $attempt -lt 20; $attempt++) {
    if (Test-AgentHealthy -Port $agentPort -Origin $clientOrigin) {
      $agentReady = $true
      break
    }
    Start-Sleep -Milliseconds 500
  }

  if (-not $agentReady) {
    Write-Host "DeepSeek proxy did not answer yet; the page can still load, but chat may need a refresh." -ForegroundColor Yellow
  }
}

$env:VITE_DEEPSEEK_AGENT_PORT = [string]$agentPort

Write-Host ""
Write-Host "Starting DraftOps dev server on $url" -ForegroundColor Yellow
Write-Host "The browser will open after the dev server is reachable." -ForegroundColor Yellow
Write-Host "Keep this window open while using DraftOps."
Write-Host ""

$viteArgs = @("run", "dev", "--", "--host", "127.0.0.1", "--port", [string]$clientPort, "--strictPort")
$exitCode = 0

try {
  $viteProcess = Start-Process -FilePath $npmPath -ArgumentList $viteArgs -WorkingDirectory $PSScriptRoot -NoNewWindow -PassThru

  if (Wait-ForHttp -Url $url -TimeoutSeconds 30) {
    Write-Host "Opening $url" -ForegroundColor Green
    Start-Process $url
  } else {
    Write-Host "DraftOps did not answer within 30 seconds. If Vite printed an error above, fix it and rerun this launcher." -ForegroundColor Red
  }

  $viteProcess.WaitForExit()
  $exitCode = $viteProcess.ExitCode
} finally {
  if ($null -ne $agentProcess -and -not $agentProcess.HasExited) {
    Stop-Process -Id $agentProcess.Id -ErrorAction SilentlyContinue
  }
}

exit $exitCode
