# ⚡ Quick Deployment Guide

Fastest way to deploy and test your Docker container.

## 🚀 Quick Deploy (5 minutes)

### Step 1: Update for Remote Access

The container is already configured! Just use the production compose file:

```powershell
cd Backend
docker-compose -f docker-compose.prod.yml up -d
```

This binds to `0.0.0.0:5000`, making it accessible from outside.

### Step 2: Update Google OAuth (If Using)

If you're using Google Drive, update the redirect URI:

1. **In `.env` file:**
   ```env
   GOOGLE_REDIRECT_URI=http://YOUR-IP-OR-DOMAIN:5000/oauth2callback
   ```

2. **In Google Cloud Console:**
   - Add: `http://YOUR-IP-OR-DOMAIN:5000/oauth2callback`
   - Save

3. **Restart container:**
   ```powershell
   docker-compose -f docker-compose.prod.yml restart
   ```

### Step 3: Test Locally First

```powershell
# Check if running
docker ps

# Test health endpoint
curl http://localhost:5000/drive/status

# Or in browser
# http://localhost:5000/drive/status
```

### Step 4: Test from Another Device

1. **Find your IP address:**
   ```powershell
   # Windows
   ipconfig
   # Look for IPv4 Address (e.g., 192.168.1.100)
   ```

2. **From another device/computer:**
   - Open: `http://YOUR-IP:5000/drive/status`
   - Should see JSON response

3. **If not accessible:**
   - Check Windows Firewall: Allow port 5000
   - Check router firewall (if testing from outside network)
   - Verify container is bound to `0.0.0.0:5000`

### Step 5: Update Chrome Extension (Optional)

To test with Chrome extension from another device:

1. **Update `Frontend/src/popup/popup.tsx`:**
   ```typescript
   const API_URL = "http://YOUR-IP:5000";  // Change this
   ```

2. **Rebuild extension:**
   ```powershell
   cd Frontend
   npm run build
   ```

3. **Load extension** in Chrome on the other device

## 🌐 Deploy to Cloud (Production)

### Option A: DigitalOcean (Easiest)

1. **Create Droplet** (Ubuntu, $6/month)
2. **SSH in:**
   ```bash
   ssh root@your-droplet-ip
   ```
3. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sh get-docker.sh
   ```
4. **Upload Backend folder** (use SCP or Git)
5. **Deploy:**
   ```bash
   cd Backend
   docker-compose -f docker-compose.prod.yml up -d
   ```
6. **Access:** `http://your-droplet-ip:5000`

### Option B: Railway.app (Free Tier Available)

1. Go to [railway.app](https://railway.app)
2. **New Project** → **Deploy from GitHub**
3. **Select your repository**
4. **Add environment variables:**
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `GOOGLE_DRIVE_FOLDER_ID`
   - `GOOGLE_REDIRECT_URI` (use Railway's domain)
5. **Deploy!**

### Option C: Render.com (Free Tier)

1. Go to [render.com](https://render.com)
2. **New** → **Web Service**
3. **Connect GitHub repository**
4. **Settings:**
   - Build Command: `cd Backend && docker build -t app .`
   - Start Command: `docker run -p $PORT:5000 app`
5. **Add environment variables**
6. **Deploy!**

## 🔍 Verify Deployment

```powershell
# Check container status
docker ps

# View logs
docker-compose logs -f

# Test endpoint
curl http://localhost:5000/drive/status
```

## ✅ Success Indicators

- ✅ Container shows as "Up" in `docker ps`
- ✅ `http://YOUR-IP:5000/drive/status` returns JSON
- ✅ Logs show "Backend server started"
- ✅ Can access from other devices on same network

## 🐛 Common Issues

### Can't access from other device

**Fix:** Use production compose file:
```powershell
docker-compose -f docker-compose.prod.yml up -d
```

### Port already in use

**Fix:** Change port in docker-compose.prod.yml:
```yaml
ports:
  - "0.0.0.0:8080:5000"  # Use port 8080 instead
```

### Firewall blocking

**Windows Firewall:**
1. Windows Defender Firewall
2. Advanced settings
3. Inbound Rules → New Rule
4. Port → 5000 → Allow

## 📝 Next Steps

- Set up domain name (optional)
- Configure HTTPS with Let's Encrypt
- Set up monitoring
- Configure backups

See `DEPLOYMENT.md` for detailed instructions.

