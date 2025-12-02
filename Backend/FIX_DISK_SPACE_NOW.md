# 🚨 URGENT: Fix "No space left on device" Error

## Problem
EC2 instance ran out of disk space during Docker build.

## ✅ Quick Fix (Run on EC2)

**Run these commands in order:**

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# 1. Stop all containers
docker-compose -f docker-compose.prod.yml down || true

# 2. Remove all stopped containers
docker container prune -f

# 3. Remove all unused images (this frees the most space!)
docker image prune -a -f

# 4. Remove all unused volumes
docker volume prune -f

# 5. Remove all build cache
docker builder prune -a -f

# 6. Check disk space
df -h

# 7. Clean apt cache (if needed)
sudo apt-get clean
sudo apt-get autoclean

# 8. Remove old logs (if any)
sudo journalctl --vacuum-time=1d

# 9. Check space again
df -h
```

## 🔧 If Still Not Enough Space

**Remove old Docker images manually:**

```bash
# List all images
docker images

# Remove specific old images
docker rmi <image-id>

# Or remove all unused images
docker image prune -a -f
```

## ✅ After Freeing Space

**Retry the build:**

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Rebuild with no cache
docker-compose -f docker-compose.prod.yml build --no-cache

# Start container
docker-compose -f docker-compose.prod.yml up -d
```

## 📊 Check Available Space

```bash
# Check disk usage
df -h

# Check Docker disk usage
docker system df

# You need at least 2GB free for the build
```

