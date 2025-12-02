# 🔧 Troubleshoot Slow/Stuck Docker Build

## 🔍 Check if Build is Actually Running

### On EC2, check in another terminal:

```bash
# Check if Docker build process is running
ps aux | grep docker

# Check Docker processes
docker ps -a

# Check system resources
htop
# or
top
```

**Look for:**
- High CPU usage (normal during build)
- Memory usage (should be < 2GB on t3.micro)
- Docker processes running

## 🐛 If Build is Stuck

### Option 1: Cancel and Rebuild with More Verbose Output

```bash
# Press Ctrl+C to cancel current build

# Rebuild with more output
docker-compose -f docker-compose.prod.yml build --progress=plain --no-cache
```

### Option 2: Check Disk Space

```bash
# Check available disk space
df -h

# If low on space, clean up
docker system prune -a
```

### Option 3: Build Without Cache (Fresh Start)

```bash
# Cancel current build (Ctrl+C)
docker-compose -f docker-compose.prod.yml down

# Clean build
docker-compose -f docker-compose.prod.yml build --no-cache

# Then start
docker-compose -f docker-compose.prod.yml up -d
```

### Option 4: Build Step by Step

```bash
# Build just the Docker image first
docker build -t audio-extractor-backend .

# Then start with compose
docker-compose -f docker-compose.prod.yml up -d
```

## ⚡ Faster Alternative: Build Locally and Push

If EC2 build is too slow, build on your local machine and push:

### Step 1: Build Locally

```bash
# On your local machine
cd Backend
docker build -t audio-extractor-backend:latest .
```

### Step 2: Save Image

```bash
# Save image to tar file
docker save audio-extractor-backend:latest | gzip > backend-image.tar.gz
```

### Step 3: Upload to EC2

```bash
# Upload to EC2
scp -i your-key.pem backend-image.tar.gz ubuntu@YOUR-ELASTIC-IP:/home/ubuntu/
```

### Step 4: Load on EC2

```bash
# SSH into EC2
ssh -i your-key.pem ubuntu@YOUR-ELASTIC-IP

# Load image
docker load < backend-image.tar.gz

# Tag it
docker tag audio-extractor-backend:latest backend-backend:latest

# Start with compose
cd ~/Audio-extractor-Chrome-Extension/Backend
docker-compose -f docker-compose.prod.yml up -d
```

## 🔄 Alternative: Use Pre-built Base Image

Create a Dockerfile that uses a pre-built base:

```dockerfile
# Use a pre-built image with dependencies
FROM node:20-slim

# Install dependencies
RUN apt-get update && apt-get install -y \
    python3 python3-pip ffmpeg \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY dist ./dist
COPY docker-compose.prod.yml ./

EXPOSE 5000
CMD ["node", "dist/server.js"]
```

Then build TypeScript locally and copy `dist` folder.

## 📊 Check Current Status

Run these commands to see what's happening:

```bash
# Check if TypeScript compilation is actually running
docker ps -a

# Check Docker build logs (if available)
docker events

# Check system load
uptime

# Check memory
free -h
```

## 💡 Quick Fix: Skip TypeScript Build in Docker

Build TypeScript locally, then copy `dist` folder:

### On Local Machine:

```bash
cd Backend
npm install
npm run build
```

### On EC2:

```bash
# Upload dist folder
scp -r -i your-key.pem dist ubuntu@YOUR-ELASTIC-IP:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/

# Modify Dockerfile to skip build (just copy dist)
```

## ✅ Recommended: Wait a Bit Longer

TypeScript compilation on t3.micro can take 3-5 minutes. If it's been less than 10 minutes, it's probably still working.

**Check if it's actually stuck:**
```bash
# In another terminal on EC2
watch -n 1 'docker ps -a'
```

If you see the container status changing, it's still building.

## 🚨 If Completely Stuck

1. **Cancel build:** `Ctrl+C`
2. **Check logs:** `docker-compose -f docker-compose.prod.yml logs`
3. **Try simpler approach:** Build locally and upload

