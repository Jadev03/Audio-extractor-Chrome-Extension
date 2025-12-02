# ⚡ Quick Fix: Build Faster on EC2

If your build is taking too long, here's a faster approach.

## 🚀 Option 1: Build TypeScript Locally, Deploy to EC2

### Step 1: Build Locally (Your Machine)

```bash
# On your local machine
cd Backend
npm install
npm run build
```

This creates the `dist` folder.

### Step 2: Upload to EC2

```bash
# Upload dist folder and necessary files
scp -i your-key.pem -r dist ubuntu@YOUR-ELASTIC-IP:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
scp -i your-key.pem package*.json ubuntu@YOUR-ELASTIC-IP:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
```

### Step 3: Use Faster Dockerfile on EC2

On EC2, temporarily use `Dockerfile.fast`:

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Copy fast Dockerfile
cp Dockerfile.fast Dockerfile

# Build (much faster - no TypeScript compilation!)
docker-compose -f docker-compose.prod.yml build

# Start
docker-compose -f docker-compose.prod.yml up -d
```

## 🚀 Option 2: Check if Current Build is Actually Working

### In Another Terminal (SSH into EC2):

```bash
# Check if process is running
ps aux | grep -i "tsc\|node\|docker"

# Check Docker
docker ps -a

# Check system load
top
```

**If you see:**
- `tsc` or `node` processes → Build is working, just slow
- High CPU usage → Normal, compilation is CPU-intensive
- No processes → Build might be stuck

## 🚀 Option 3: Cancel and Rebuild with Progress

```bash
# Cancel current build (Ctrl+C in the terminal running build)

# Rebuild with verbose output
docker-compose -f docker-compose.prod.yml build --progress=plain 2>&1 | tee build.log

# This shows detailed progress
```

## 🚀 Option 4: Use GitHub Actions to Build

Let GitHub Actions build the image, then pull it on EC2.

### Update GitHub Actions Workflow:

Add build step before deploy:

```yaml
- name: Build Docker image
  run: |
    cd Backend
    docker build -t audio-extractor-backend .
    docker save audio-extractor-backend | gzip > image.tar.gz

- name: Upload image
  uses: actions/upload-artifact@v3
  with:
    name: docker-image
    path: Backend/image.tar.gz
```

Then download and load on EC2.

## ✅ Recommended: Wait a Bit More

**t3.micro TypeScript compilation typically takes:**
- **3-5 minutes** for first build
- **1-2 minutes** for cached builds

**If it's been less than 10 minutes**, it's probably still working.

**Check progress:**
```bash
# Watch Docker processes
watch -n 2 'docker ps -a && echo "---" && docker images'
```

## 🎯 Quick Decision Tree

1. **Been < 5 minutes?** → Wait, it's normal
2. **Been 5-10 minutes?** → Check with `ps aux | grep docker`
3. **Been > 10 minutes?** → Cancel and try Option 1 (build locally)

## 💡 Best Long-term Solution

After first successful build:
- Docker caches everything
- Future builds take 1-2 minutes
- Auto-deploy will be fast

**The first build is always the slowest!**

