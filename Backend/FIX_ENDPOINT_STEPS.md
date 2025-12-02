# 🔧 Fix /auth/latest Endpoint - Complete Steps

## Step 1: Remove existing container

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Stop and remove container
docker-compose -f docker-compose.prod.yml down

# Remove the image (optional, but ensures clean rebuild)
docker rmi backend-backend || true
```

## Step 2: Fix git conflicts and pull latest code

```bash
# Remove conflicting files
rm -f Dockerfile.fast
git checkout -- .dockerignore

# Pull latest code
git pull origin production
```

## Step 3: Build TypeScript

```bash
# Install dependencies (if needed)
npm install

# Build TypeScript
npm run build

# Verify the endpoint is in the compiled code
grep -n "auth/latest" dist/server.js
```

## Step 4: Rebuild Docker container

```bash
# Rebuild with no cache
docker-compose -f docker-compose.prod.yml build --no-cache

# Start container
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs --tail=30
```

## Step 5: Test the endpoint

```bash
curl http://localhost:5000/auth/latest
# Should return: {"userId":null,"email":null}
```

