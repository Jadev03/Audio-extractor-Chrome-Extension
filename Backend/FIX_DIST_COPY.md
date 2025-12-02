# 🔧 Fix: Docker Can't Find dist Folder

## 🎯 The Problem

Docker build fails with:
```
failed to solve: "/dist": not found
```

This happens because `.dockerignore` is excluding the `dist` folder.

## ✅ Solution

### Option 1: Update .dockerignore (Recommended)

The `.dockerignore` file has `dist` in it, which prevents Docker from copying it.

**On EC2, edit .dockerignore:**

```bash
nano .dockerignore
```

**Comment out or remove the `dist` line:**
```
node_modules
# dist  # Commented - needed for fast build
*.log
logs/
.env
.env.prod
downloads/
token.json
```

Save: `Ctrl+X`, `Y`, `Enter`

**Then rebuild:**
```bash
docker-compose -f docker-compose.prod.yml build
```

### Option 2: Verify dist Folder Location

Make sure `dist` folder is in the Backend directory:

```bash
# Check current directory
pwd
# Should be: /home/ubuntu/Audio-extractor-Chrome-Extension/Backend

# Verify dist exists
ls -la dist/
# Should see: server.js, driveService.js, logger.js

# Check if dist is a directory
file dist
# Should say: directory
```

### Option 3: Copy dist to Build Context

If dist is in wrong location:

```bash
# Make sure you're in Backend directory
cd ~/Audio-extractor-Chrome-Extension/Backend

# Verify dist is here
ls -la | grep dist
```

## 🔍 Debug Steps

**1. Check build context:**
```bash
# Docker build context is the current directory
pwd
# Should be: /home/ubuntu/Audio-extractor-Chrome-Extension/Backend
```

**2. Check .dockerignore:**
```bash
cat .dockerignore | grep dist
# If it shows "dist", that's the problem
```

**3. Test Docker build manually:**
```bash
docker build -t test-build .
# This will show exactly what Docker sees
```

## ✅ Quick Fix

**On EC2, run:**

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Edit .dockerignore
nano .dockerignore
# Comment out the "dist" line (add # in front)

# Rebuild
docker-compose -f docker-compose.prod.yml build
```

## 🎯 Expected Result

After fixing `.dockerignore`, the build should:
- ✅ Find the `dist` folder
- ✅ Copy it to the image
- ✅ Complete in 1-2 minutes

