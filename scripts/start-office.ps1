param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
if (-not (Test-Path -LiteralPath '.env.local')) { throw 'Run local Convex setup first.' }
if ((Get-Content -Raw -LiteralPath '.env.local') -notmatch 'VITE_CONVEX_URL=["'']?http://(127\.0\.0\.1|localhost):3210') {
    throw 'This launcher only supports the existing local backend on port 3210.'
}
New-Item -ItemType Directory -Path '.office' -Force | Out-Null
function Test-LocalPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try { $client.Connect('127.0.0.1', $Port); return $true } catch { return $false } finally { $client.Dispose() }
}
$nodePath = (Get-Command node.exe).Source
$env:CONVEX_AGENT_MODE = 'anonymous'
if (-not (Test-LocalPort 3210)) {
    Start-Process -FilePath $nodePath -ArgumentList @('node_modules/convex/bin/main.js','dev','--tail-logs','disable') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput '.office/backend.stdout.log' -RedirectStandardError '.office/backend.stderr.log' | Out-Null
}
if (-not (Test-LocalPort 5173)) {
    Start-Process -FilePath $nodePath -ArgumentList @('node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5173','--strictPort') -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput '.office/frontend.stdout.log' -RedirectStandardError '.office/frontend.stderr.log' | Out-Null
}
for ($attempt = 0; $attempt -lt 80; $attempt++) {
    if ((Test-LocalPort 3210) -and (Test-LocalPort 5173)) { break }
    Start-Sleep -Milliseconds 250
}
if (-not ((Test-LocalPort 3210) -and (Test-LocalPort 5173))) { throw 'Startup timed out. Check the .office log files.' }
Write-Output 'AI Trading Office: http://127.0.0.1:5173/ai-town/'
if (-not $NoBrowser) { Start-Process 'http://127.0.0.1:5173/ai-town/' }
