# ============================================================
# start-backend.ps1  —  Kill any process on port 8080, then
# start the Spring Boot backend in local dev mode.
#
# Usage:  Right-click → "Run with PowerShell"
#         OR in PowerShell:  .\start-backend.ps1
# ============================================================

Write-Host "--- AI Trade Desk Backend Launcher ---" -ForegroundColor Cyan

# 1) Free port 8080 if occupied
$conn = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
    $procId   = $conn.OwningProcess
    $procName = (Get-Process -Id $procId -ErrorAction SilentlyContinue).ProcessName
    Write-Host "Killing $procName (PID $procId) on port 8080..." -ForegroundColor Yellow
    Stop-Process -Id $procId -Force
    Start-Sleep -Seconds 2
    Write-Host "Port 8080 freed." -ForegroundColor Green
} else {
    Write-Host "Port 8080 is free." -ForegroundColor Green
}

# 2) Set Java + Maven paths
$env:JAVA_HOME = "C:\Program Files\Eclipse Adoptium\jdk-21.0.11.10-hotspot"
$env:PATH      = "$env:JAVA_HOME\bin;C:\maven\bin;$env:PATH"

# 3) Start backend
Write-Host "`nStarting backend... (Ctrl+C to stop)" -ForegroundColor Cyan
Set-Location "$PSScriptRoot\backend"
& "C:\maven\bin\mvn.cmd" "spring-boot:run" "-Dspring-boot.run.profiles=local"
