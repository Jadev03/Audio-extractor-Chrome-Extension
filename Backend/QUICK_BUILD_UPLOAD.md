# ⚡ Quick: Build Locally & Upload

Fastest way to deploy - build on your machine, upload to EC2.

## 🚀 Quick Steps

### 1. Build Locally

```powershell
cd Backend
npm install
npm run build
```

### 2. Upload dist Folder

```powershell
scp -i your-key.pem -r dist ubuntu@YOUR-ELASTIC-IP:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
```

### 3. On EC2

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Use fast Dockerfile
cp Dockerfile.fast Dockerfile

# Build (fast - no TypeScript compilation!)
docker-compose -f docker-compose.prod.yml build

# Start
docker-compose -f docker-compose.prod.yml up -d
```

## 🎯 Or Use the Script

```powershell
.\upload-to-ec2.ps1 -EC2_IP "54.123.45.67" -KEY_PATH "C:\path\to\key.pem"
```

Then follow the instructions it prints!

## ✅ That's It!

Build takes 1-2 minutes instead of 5-10 minutes!

