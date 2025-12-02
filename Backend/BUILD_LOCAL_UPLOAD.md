# 🚀 Build Locally & Upload to EC2

Step-by-step guide to build TypeScript locally and deploy to EC2 faster.

## 📋 Prerequisites

- Local machine with Node.js installed
- EC2 instance running
- SSH access to EC2
- Your `.pem` key file

## 🎯 Step-by-Step Process

### Step 1: Build TypeScript Locally

On your **local machine** (Windows):

```powershell
cd Backend

# Install dependencies (if not already done)
npm install

# Build TypeScript
npm run build
```

This creates the `dist` folder with compiled JavaScript files.

**Verify build:**
```powershell
# Check dist folder exists
ls dist
# Should see: server.js, driveService.js, logger.js
```

### Step 2: Prepare Files for Upload

On your **local machine**:

```powershell
cd Backend

# Create a package with necessary files
# Option A: Upload entire Backend folder (easiest)
# Option B: Upload only what's needed (faster)
```

**Files needed on EC2:**
- `dist/` folder (compiled JavaScript)
- `package.json` and `package-lock.json`
- `Dockerfile.fast` (or modify Dockerfile)
- `docker-compose.prod.yml`
- `.env.prod` (create on EC2, don't upload)

### Step 3: Upload Files to EC2

**Option A: Upload Entire Backend Folder**

```powershell
# From your local machine
scp -i path/to/your-key.pem -r Backend ubuntu@YOUR-ELASTIC-IP:/home/ubuntu/
```

**Option B: Upload Only Required Files (Faster)**

```powershell
# Create a temporary folder with needed files
mkdir Backend-upload
xcopy Backend\dist Backend-upload\dist /E /I
copy Backend\package.json Backend-upload\
copy Backend\package-lock.json Backend-upload\
copy Backend\Dockerfile.fast Backend-upload\Dockerfile
copy Backend\docker-compose.prod.yml Backend-upload\

# Upload
scp -i path/to/your-key.pem -r Backend-upload ubuntu@YOUR-ELASTIC-IP:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend
```

### Step 4: SSH into EC2

```powershell
ssh -i path/to/your-key.pem ubuntu@YOUR-ELASTIC-IP
```

### Step 5: Set Up on EC2

```bash
# Navigate to Backend directory
cd ~/Audio-extractor-Chrome-Extension/Backend

# If you uploaded entire folder, you're done
# If you uploaded separate files, organize them:
# (Files should already be in place)

# Verify dist folder exists
ls -la dist/
# Should see: server.js, driveService.js, logger.js

# Use the fast Dockerfile (no TypeScript compilation)
cp Dockerfile.fast Dockerfile
# OR if Dockerfile.fast doesn't exist, we'll create it
```

### Step 6: Create .env.prod on EC2

```bash
nano .env.prod
```

Add:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth2callback
NODE_ENV=production
PORT=5000
DOCKER_CONTAINER=true
```

Save: `Ctrl+X`, `Y`, `Enter`

### Step 7: Build Docker Image (Fast!)

```bash
# Build using fast Dockerfile (no TypeScript compilation)
docker-compose -f docker-compose.prod.yml build

# This should take only 1-2 minutes!
```

### Step 8: Start Container

```bash
docker-compose -f docker-compose.prod.yml up -d

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 9: Verify Deployment

```bash
# Test locally on EC2
curl http://localhost:5000/drive/status

# Test from your browser
# http://YOUR-ELASTIC-IP:5000/drive/status
```

## 🔄 For Future Updates

### Update Code and Redeploy:

**On Local Machine:**
```powershell
cd Backend
npm run build
scp -i your-key.pem -r dist ubuntu@YOUR-ELASTIC-IP:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
```

**On EC2:**
```bash
cd ~/Audio-extractor-Chrome-Extension/Backend
docker-compose -f docker-compose.prod.yml restart
```

## 📝 Quick Script for Local Build & Upload

Create `upload-to-ec2.ps1` on your local machine:

```powershell
# upload-to-ec2.ps1
param(
    [string]$EC2_IP = "YOUR-ELASTIC-IP",
    [string]$KEY_PATH = "path/to/your-key.pem"
)

Write-Host "🔨 Building TypeScript..." -ForegroundColor Cyan
cd Backend
npm run build

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "📤 Uploading to EC2..." -ForegroundColor Cyan
scp -i $KEY_PATH -r dist ubuntu@$EC2_IP:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/

Write-Host "✅ Upload complete!" -ForegroundColor Green
Write-Host "Now SSH into EC2 and run: docker-compose -f docker-compose.prod.yml restart" -ForegroundColor Yellow
```

**Usage:**
```powershell
.\upload-to-ec2.ps1 -EC2_IP "54.123.45.67" -KEY_PATH "C:\path\to\key.pem"
```

## ✅ Checklist

- [ ] TypeScript built locally (`npm run build`)
- [ ] `dist` folder created
- [ ] Files uploaded to EC2
- [ ] `.env.prod` created on EC2
- [ ] `Dockerfile.fast` copied to `Dockerfile` (or use existing)
- [ ] Docker image built
- [ ] Container started
- [ ] Health endpoint working

## 🎉 Benefits

- ✅ **Much faster:** No TypeScript compilation on EC2
- ✅ **Uses local resources:** Your machine is faster
- ✅ **Easier debugging:** See build errors locally
- ✅ **Faster iterations:** Quick updates

## 🔄 Update GitHub Actions (Optional)

You can also update the GitHub Actions workflow to build locally and upload:

```yaml
- name: Build TypeScript
  run: |
    cd Backend
    npm install
    npm run build

- name: Upload dist to EC2
  uses: appleboy/scp-action@v0.1.4
  with:
    host: ${{ secrets.EC2_HOST }}
    username: ubuntu
    key: ${{ secrets.EC2_SSH_KEY }}
    source: "Backend/dist"
    target: "/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/"
```

