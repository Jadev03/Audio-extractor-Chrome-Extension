# 🔧 Fix: "EISDIR: illegal operation on a directory, read" Error

## 🎯 The Problem

The error:
```
Error loading token {"error":"EISDIR: illegal operation on a directory, read"}
```

This happens because Docker created `token.json` as a **directory** instead of a **file** when mounting the volume.

## ✅ Solution

### On EC2, run:

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Check if token.json exists and what it is
ls -la token.json

# If it's a directory, remove it
rm -rf token.json

# Create an empty token.json file
touch token.json

# Set proper permissions
chmod 644 token.json

# Verify it's a file (not directory)
file token.json
# Should say: empty or ASCII text

# Restart container
docker-compose -f docker-compose.prod.yml restart

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔍 Verify Fix

After restart, logs should show:
- ✅ No "EISDIR" error
- ✅ Server starts normally
- ✅ Google Drive status works

## 📝 Alternative: Remove Volume Mount (If Not Needed)

If you don't need to persist `token.json` on the host, you can remove the volume mount from `docker-compose.prod.yml`:

```yaml
volumes:
  - ./downloads:/app/downloads
  # Comment out token.json mount if not needed:
  # - ./token.json:/app/dist/token.json
  - ./logs:/app/logs
```

Then restart:
```bash
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

## ✅ Expected Result

After fixing:
- ✅ `token.json` is a file (not directory)
- ✅ No EISDIR errors
- ✅ OAuth flow can save tokens properly

