# 🔧 Fix: "No Space Left on Device" Error

## 🎯 The Problem

Docker build fails with:
```
no space left on device
```

This happens because EC2 instance (especially t3.micro) has limited storage and Docker images/layers take up space.

## ✅ Solution: Free Up Disk Space

### Step 1: Check Disk Usage

```bash
# Check overall disk usage
df -h

# Check Docker disk usage
docker system df
```

### Step 2: Clean Up Docker (Recommended)

**On EC2, run these commands:**

```bash
# Remove all stopped containers
docker container prune -f

# Remove all unused images
docker image prune -a -f

# Remove all unused volumes
docker volume prune -f

# Remove all unused networks
docker network prune -f

# Full cleanup (removes everything unused)
docker system prune -a -f --volumes

# Check freed space
docker system df
df -h
```

### Step 3: Remove Old Build Cache

```bash
# Remove build cache
docker builder prune -a -f

# Check space again
df -h
```

### Step 4: Check What's Using Space

```bash
# Find large files/directories
du -sh /* 2>/dev/null | sort -h | tail -10

# Check Docker directory size
du -sh /var/lib/docker
```

### Step 5: Rebuild After Cleanup

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Rebuild (should work now)
docker-compose -f docker-compose.prod.yml build
```

## 🚀 Quick Cleanup Script

**Run this on EC2:**

```bash
#!/bin/bash
echo "🧹 Cleaning up Docker..."
docker system prune -a -f --volumes
docker builder prune -a -f
echo "✅ Cleanup complete!"
echo ""
echo "📊 Current disk usage:"
df -h | grep -E 'Filesystem|/dev/'
echo ""
echo "📦 Docker disk usage:"
docker system df
```

## 💡 Prevention Tips

### 1. Use Multi-Stage Builds (Already Done ✅)
Your Dockerfile already uses multi-stage builds to reduce image size.

### 2. Regular Cleanup
Add this to your deployment script:

```bash
# Clean up before building
docker system prune -f
```

### 3. Monitor Disk Space
Check regularly:

```bash
df -h
```

### 4. Consider Larger Instance
If you frequently run out of space:
- **t3.small**: 20GB storage
- **t3.medium**: 20GB storage
- Or add EBS volume

## 🔍 If Still Out of Space

### Option 1: Remove Specific Images

```bash
# List all images
docker images

# Remove specific image
docker rmi <image-id>
```

### Option 2: Clean Logs

```bash
# Check log size
du -sh /var/log/*

# Clean old logs (be careful!)
sudo journalctl --vacuum-time=3d
```

### Option 3: Remove Unused Packages

```bash
# Remove unused packages
sudo apt-get autoremove -y
sudo apt-get autoclean
```

## ✅ Expected Result

After cleanup:
- ✅ Disk space freed
- ✅ Build should complete successfully
- ✅ Image size reduced

## 📊 Typical Space Usage

- **Base Node image**: ~200MB
- **Python + FFmpeg**: ~150MB
- **yt-dlp**: ~50MB
- **Node modules**: ~100MB
- **Your dist files**: ~50KB
- **Total**: ~500MB per image

**Docker overhead**: Can use 2-3x this amount during build.

