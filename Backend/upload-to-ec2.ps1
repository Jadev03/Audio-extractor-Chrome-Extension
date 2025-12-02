# PowerShell script to build locally and upload to EC2
param(
    [Parameter(Mandatory=$true)]
    [string]$EC2_IP,
    
    [Parameter(Mandatory=$true)]
    [string]$KEY_PATH,
    
    [string]$EC2_USER = "ubuntu",
    [string]$EC2_PATH = "/home/ubuntu/Audio-extractor-Chrome-Extension/Backend"
)

Write-Host "🚀 Building and Uploading to EC2" -ForegroundColor Cyan
Write-Host ""

# Step 1: Build TypeScript
Write-Host "📦 Step 1: Building TypeScript..." -ForegroundColor Yellow
Set-Location Backend

if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: package.json not found. Are you in the right directory?" -ForegroundColor Red
    exit 1
}

npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ TypeScript build failed!" -ForegroundColor Red
    exit 1
}

if (-not (Test-Path "dist")) {
    Write-Host "❌ Error: dist folder not created!" -ForegroundColor Red
    exit 1
}

Write-Host "✅ TypeScript build complete!" -ForegroundColor Green
Write-Host ""

# Step 2: Upload dist folder
Write-Host "📤 Step 2: Uploading dist folder to EC2..." -ForegroundColor Yellow
Write-Host "   Target: $EC2_USER@$EC2_IP:$EC2_PATH/dist" -ForegroundColor Gray

$scpCommand = "scp -i `"$KEY_PATH`" -r dist $EC2_USER@${EC2_IP}:${EC2_PATH}/"
Invoke-Expression $scpCommand

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Upload failed!" -ForegroundColor Red
    Write-Host "   Check:" -ForegroundColor Yellow
    Write-Host "   - EC2 IP is correct" -ForegroundColor Gray
    Write-Host "   - Key file path is correct" -ForegroundColor Gray
    Write-Host "   - EC2 instance is running" -ForegroundColor Gray
    exit 1
}

Write-Host "✅ Upload complete!" -ForegroundColor Green
Write-Host ""

# Step 3: Instructions
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host "📋 Next Steps on EC2:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. SSH into EC2:" -ForegroundColor White
Write-Host "   ssh -i $KEY_PATH $EC2_USER@$EC2_IP" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Navigate to Backend:" -ForegroundColor White
Write-Host "   cd $EC2_PATH" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Use fast Dockerfile:" -ForegroundColor White
Write-Host "   cp Dockerfile.fast Dockerfile" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Build and start:" -ForegroundColor White
Write-Host "   docker-compose -f docker-compose.prod.yml build" -ForegroundColor Gray
Write-Host "   docker-compose -f docker-compose.prod.yml up -d" -ForegroundColor Gray
Write-Host ""
Write-Host "✅ Done!" -ForegroundColor Green

