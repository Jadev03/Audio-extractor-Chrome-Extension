# 🚀 Deploy New /auth/latest Endpoint

## 🎯 Problem

The `/auth/latest` endpoint returns 404 because the new code hasn't been deployed to EC2 yet.

## ✅ Solution: Deploy Updated Code

### Option 1: Deploy via GitHub Actions (Recommended)

**On your local machine:**

```bash
# Make sure you're in the Backend directory
cd Backend

# Verify the build works
npm run build

# Commit and push
git add .
git commit -m "Add /auth/latest endpoint for per-user authentication"
git push origin production
```

**GitHub Actions will automatically:**
1. Build TypeScript
2. Upload dist folder to EC2
3. Rebuild Docker container
4. Restart the service

### Option 2: Manual Deploy to EC2

**On your local machine:**

```bash
# Build locally
cd Backend
npm run build

# Upload dist folder to EC2
scp -i "C:\Users\THABENDRA\Downloads\extractor.pem" -o StrictHostKeyChecking=no -r dist ubuntu@13.200.189.31:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
```

**On EC2:**

```bash
# SSH into EC2
ssh -i "C:\Users\THABENDRA\Downloads\extractor.pem" ubuntu@13.200.189.31

# Navigate to Backend
cd ~/Audio-extractor-Chrome-Extension/Backend

# Restart container to use new code
docker-compose -f docker-compose.prod.yml restart

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Option 3: Full Rebuild on EC2

**On EC2:**

```bash
# Pull latest code
cd ~/Audio-extractor-Chrome-Extension/Backend
git pull origin production

# Rebuild and restart
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

## ✅ Verify Deployment

**Test the endpoint:**

```bash
# From your local machine
curl http://13.200.189.31:5000/auth/latest

# Or from browser
http://13.200.189.31:5000/auth/latest
```

**Expected response:**
```json
{
  "userId": "123456789",
  "email": "user@example.com"
}
```

Or if no recent authentication:
```json
{
  "userId": null,
  "email": null
}
```

## 🎉 After Deployment

Once deployed:
1. Extension will be able to call `/auth/latest`
2. Authentication detection will work
3. "Detect" button will enable after OAuth

