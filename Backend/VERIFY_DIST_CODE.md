# 🔍 Verify if dist folder has new code

## Check on EC2

**Run these commands to verify:**

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# 1. Check if dist/server.js has the /auth/latest endpoint
grep -n "auth/latest" dist/server.js

# If it shows line numbers, the code is there
# If it shows nothing, the code is missing
```

## If code is missing

**The dist folder on EC2 is old. You need to:**

### Option 1: Wait for GitHub Actions (if you pushed to production)
- GitHub Actions will build and upload the new dist folder
- Check GitHub Actions status

### Option 2: Build and upload manually

**On your local machine:**

```powershell
cd D:\Audio-Extractor\Chrome-extension\Backend

# Build TypeScript
npm run build

# Create tar.gz
tar -czf dist.tar.gz dist/

# Upload to EC2 (replace with your EC2 IP and key)
scp -i "your-key.pem" dist.tar.gz ubuntu@13.200.189.31:~/Audio-extractor-Chrome-Extension/Backend/
```

**Then on EC2:**

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Extract new dist folder
rm -rf dist/
tar -xzf dist.tar.gz
rm dist.tar.gz

# Rebuild Docker image
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Test
curl http://localhost:5000/auth/latest
```

