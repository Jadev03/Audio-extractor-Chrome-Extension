# 🔧 Fix: "not a directory" Mount Error

## 🎯 The Problem

After fixing `token.json` from directory to file, Docker still has the old mount cached. Need to fully stop and recreate the container.

## ✅ Solution

**On EC2, run:**

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Stop and remove the container completely
docker-compose -f docker-compose.prod.yml down

# Verify token.json is a file (should already be fixed)
file token.json
# Should say: empty

# Start container fresh
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔍 What Happened

1. Docker mounted `token.json` as a directory initially
2. You fixed it to be a file on the host
3. But Docker still has the old mount in the container
4. `docker-compose restart` doesn't fix mount issues
5. Need `docker-compose down` to fully remove the container, then `up` to recreate it

## ✅ Expected Result

After `down` and `up`:
- ✅ Container recreated with correct mount
- ✅ No EISDIR errors
- ✅ No mount errors
- ✅ Server starts normally

