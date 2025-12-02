# ✅ Next Steps on EC2

Your `dist` folder has been uploaded! Now complete the setup on EC2.

## 🚀 Steps to Complete on EC2

### Step 1: SSH into EC2

```bash
ssh -i "C:\Users\THABENDRA\Downloads\extractor.pem" ubuntu@13.200.189.31
```

### Step 2: Navigate to Backend Directory

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend
```

### Step 3: Verify dist Folder

```bash
ls -la dist/
# Should see: server.js, driveService.js, logger.js
```

### Step 4: Use Fast Dockerfile

```bash
# Copy the fast Dockerfile (no TypeScript compilation)
cp Dockerfile.fast Dockerfile
```

### Step 5: Create .env.prod (If Not Exists)

```bash
nano .env.prod
```

Add:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth2callback
NODE_ENV=production
PORT=5000
DOCKER_CONTAINER=true
```

Save: `Ctrl+X`, `Y`, `Enter`

### Step 6: Build Docker Image (Fast!)

```bash
docker-compose -f docker-compose.prod.yml build
```

**This should take only 1-2 minutes!** (No TypeScript compilation)

### Step 7: Start Container

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Step 8: Verify It's Running

```bash
# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Test health endpoint
curl http://localhost:5000/drive/status
```

## ✅ Success!

Your backend should now be running on EC2!

**Access URLs:**
- Health: `http://13.200.189.31:5000/drive/status`
- OAuth: `http://13.200.189.31:5000/auth/google`

## 🔄 For Future Updates

When you make code changes:

**On Local Machine:**
```powershell
cd Backend
npm run build
scp -i "C:\Users\THABENDRA\Downloads\extractor.pem" -o StrictHostKeyChecking=no -r dist ubuntu@13.200.189.31:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
```

**On EC2:**
```bash
cd ~/Audio-extractor-Chrome-Extension/Backend
docker-compose -f docker-compose.prod.yml restart
```

## 🎉 Done!

Your backend is deployed and ready!

