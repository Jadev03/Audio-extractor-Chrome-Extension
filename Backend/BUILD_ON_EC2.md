# 🔧 Build TypeScript on EC2

## Problem
The dist folder doesn't have the `/auth/latest` endpoint code.

## Solution: Build TypeScript directly on EC2

**Run these commands on EC2:**

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# 1. Make sure you have the latest code
git pull origin production

# 2. Install dependencies (if needed)
npm install

# 3. Build TypeScript
npm run build

# 4. Verify the endpoint is now in dist/server.js
grep -n "auth/latest" dist/server.js

# 5. Rebuild Docker container
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# 6. Test the endpoint
curl http://localhost:5000/auth/latest
```

