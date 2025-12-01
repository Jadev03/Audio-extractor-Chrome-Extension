# Quick ngrok Setup Script
# Helps set up ngrok for OAuth testing

Write-Host "=== ngrok Setup for OAuth Testing ===" -ForegroundColor Cyan
Write-Host ""

# Check if ngrok is installed
if (Get-Command ngrok -ErrorAction SilentlyContinue) {
    Write-Host "[OK] ngrok is installed!" -ForegroundColor Green
} else {
    Write-Host "[FAIL] ngrok is NOT installed" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install ngrok:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://ngrok.com/download" -ForegroundColor White
    Write-Host "2. Extract to a folder" -ForegroundColor White
    Write-Host "3. Add to PATH or use full path" -ForegroundColor White
    Write-Host ""
    Write-Host "Or install via chocolatey:" -ForegroundColor Yellow
    Write-Host "  choco install ngrok" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "=== Instructions ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start ngrok in a NEW terminal:" -ForegroundColor Yellow
Write-Host "   ngrok http 5000" -ForegroundColor White
Write-Host ""
Write-Host "2. Copy the HTTPS URL from ngrok (e.g., https://abc123.ngrok.io)" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Update .env file with:" -ForegroundColor Yellow
Write-Host "   GOOGLE_REDIRECT_URI=https://YOUR-NGROK-URL.ngrok.io/oauth2callback" -ForegroundColor White
Write-Host ""
Write-Host "4. Update Google Cloud Console:" -ForegroundColor Yellow
Write-Host "   - Add redirect URI: https://YOUR-NGROK-URL.ngrok.io/oauth2callback" -ForegroundColor White
Write-Host ""
Write-Host "5. Restart container:" -ForegroundColor Yellow
Write-Host "   docker-compose -f docker-compose.prod.yml restart" -ForegroundColor White
Write-Host ""
Write-Host "6. Test from phone using ngrok URL!" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press any key to start ngrok now (or Ctrl+C to cancel)..." -ForegroundColor Gray
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

Write-Host ""
Write-Host "Starting ngrok..." -ForegroundColor Cyan
Write-Host "Keep this window open!" -ForegroundColor Yellow
Write-Host ""

# Start ngrok
ngrok http 5000

