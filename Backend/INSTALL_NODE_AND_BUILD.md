# 📦 Install Node.js and Build on EC2

## Step 1: Install Node.js 20 (includes npm)

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

## Step 2: Build TypeScript

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Install dependencies
npm install

# Build TypeScript
npm run build

# Verify the endpoint is in dist/server.js
grep -n "auth/latest" dist/server.js
```

## Step 3: Rebuild Docker container

```bash
# Rebuild with no cache
docker-compose -f docker-compose.prod.yml build --no-cache

# Start container
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs --tail=30
```

## Step 4: Test the endpoint

```bash
curl http://localhost:5000/auth/latest
```

