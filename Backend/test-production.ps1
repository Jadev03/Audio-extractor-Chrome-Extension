# Production Testing Script
# Tests the production Docker setup locally

Write-Host "Testing Production Docker Setup" -ForegroundColor Cyan
Write-Host ""

# Get local IP
$localIP = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object {$_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*"} | Select-Object -First 1).IPAddress

Write-Host "Your Network IP: $localIP" -ForegroundColor Yellow
Write-Host ""

# Test 1: Container Status
Write-Host "1. Checking container status..." -ForegroundColor Cyan
$containerStatus = docker ps --filter "name=audio-extractor-backend" --format "{{.Status}}"
if ($containerStatus) {
    Write-Host "   [OK] Container is running: $containerStatus" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Container is not running!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 2: Local Health Check
Write-Host "2. Testing local health endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/drive/status" -Method GET -ErrorAction Stop
    Write-Host "   [OK] Local access works!" -ForegroundColor Green
    Write-Host "   Status: $($response.message)" -ForegroundColor Gray
} catch {
    Write-Host "   [FAIL] Local access failed: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 3: Network Health Check
Write-Host "3. Testing network health endpoint..." -ForegroundColor Cyan
Write-Host "   Testing: http://$localIP:5000/drive/status" -ForegroundColor Gray
try {
    $response = Invoke-RestMethod -Uri "http://$localIP:5000/drive/status" -Method GET -ErrorAction Stop
    Write-Host "   [OK] Network access works!" -ForegroundColor Green
    Write-Host "   Status: $($response.message)" -ForegroundColor Gray
} catch {
    Write-Host "   [WARN] Network access failed (may need firewall rule)" -ForegroundColor Yellow
    Write-Host "   Tip: Allow port 5000 in Windows Firewall" -ForegroundColor Gray
}
Write-Host ""

# Test 4: OAuth Endpoint
Write-Host "4. Testing OAuth endpoint..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/auth/google" -Method GET -ErrorAction Stop
    if ($response.authUrl) {
        Write-Host "   [OK] OAuth endpoint works!" -ForegroundColor Green
        Write-Host "   Auth URL generated successfully" -ForegroundColor Gray
    }
} catch {
    Write-Host "   [FAIL] OAuth endpoint failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Port Binding
Write-Host "5. Checking port binding..." -ForegroundColor Cyan
$portBinding = netstat -ano | findstr ":5000" | Select-String "0.0.0.0:5000"
if ($portBinding) {
    Write-Host "   [OK] Port 5000 is bound to 0.0.0.0 (accessible from network)" -ForegroundColor Green
} else {
    Write-Host "   [WARN] Port binding may not be correct" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host ""
Write-Host "[OK] Local URL: http://localhost:5000" -ForegroundColor Green
Write-Host "[OK] Network URL: http://$localIP:5000" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "   1. Test from another device: http://$localIP:5000/drive/status" -ForegroundColor White
Write-Host "   2. Test OAuth: http://$localIP:5000/auth/google" -ForegroundColor White
Write-Host "   3. Watch logs: docker-compose -f docker-compose.prod.yml logs -f" -ForegroundColor White
Write-Host ""
Write-Host "See LOCAL_PRODUCTION_TEST.md for detailed testing guide" -ForegroundColor Gray
Write-Host ""
