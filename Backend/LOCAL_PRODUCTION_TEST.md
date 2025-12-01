# 🧪 Local Production Testing Checklist

Test your production Docker setup locally before deploying to cloud.

## 📋 Your Test Environment

- **Local IP:** `10.170.254.126`
- **Port:** `5000`
- **Local URL:** `http://localhost:5000`
- **Network URL:** `http://10.170.254.126:5000`

---

## ✅ Step-by-Step Testing

### Step 1: Verify Container is Running

```powershell
docker ps
```

**Expected:** Container `audio-extractor-backend` shows as "Up"

**Check logs:**
```powershell
docker-compose -f docker-compose.prod.yml logs --tail=20
```

**Expected:** See "Backend server started" message

---

### Step 2: Test Local Access

**Test 1: Health Check (Local)**
```powershell
curl http://localhost:5000/drive/status
```

**Or in browser:** `http://localhost:5000/drive/status`

**Expected Response:**
```json
{
  "configured": true,
  "message": "Google Drive is fully configured and ready",
  ...
}
```

**Test 2: OAuth Endpoint (Local)**
```powershell
curl http://localhost:5000/auth/google
```

**Or in browser:** `http://localhost:5000/auth/google`

**Expected:** JSON with `authUrl` field

---

### Step 3: Test Network Access (From Another Device)

**Prerequisites:**
- Another device on the same Wi-Fi network
- Or use your phone's browser

**Test 1: Health Check (Network)**
- Open browser on another device
- Go to: `http://10.170.254.126:5000/drive/status`
- **Expected:** Same JSON response as local test

**Test 2: OAuth Endpoint (Network)**
- Go to: `http://10.170.254.126:5000/auth/google`
- **Expected:** JSON with `authUrl` field

**Test 3: Full OAuth Flow (Network)**
1. Visit: `http://10.170.254.126:5000/auth/google`
2. Copy the `authUrl` from response
3. Open it in browser
4. Complete OAuth authorization
5. Should redirect to: `http://10.170.254.126:5000/oauth2callback?code=...`
6. **Expected:** "✅ Authorization Successful!" page

---

### Step 4: Test API Endpoint (Extract Audio)

**From Local Machine:**
```powershell
$body = @{
    youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/extract" -Method POST -Body $body -ContentType "application/json"
```

**From Network (Another Device):**
```powershell
# Use the network IP instead
Invoke-RestMethod -Uri "http://10.170.254.126:5000/extract" -Method POST -Body $body -ContentType "application/json"
```

**Expected:** 
- Success response with `fileUrl` or `driveWebViewLink`
- Check logs: `docker-compose -f docker-compose.prod.yml logs -f`

---

### Step 5: Test Chrome Extension (If Updated)

**Update Extension for Network Testing:**

1. **Edit `Frontend/src/popup/popup.tsx`:**
   ```typescript
   const API_URL = "http://10.170.254.126:5000";  // Your network IP
   ```

2. **Rebuild:**
   ```powershell
   cd Frontend
   npm run build
   ```

3. **Load extension** in Chrome
4. **Test extraction** from YouTube video
5. **Watch logs:** `docker-compose -f docker-compose.prod.yml logs -f`

---

### Step 6: Test from Different Networks (Optional)

If you want to test from outside your local network:

1. **Port Forwarding** (Router):
   - Forward external port → `10.170.254.126:5000`
   - Access via: `http://YOUR-PUBLIC-IP:5000`

2. **Or use ngrok** (Temporary tunnel):
   ```powershell
   # Install ngrok: https://ngrok.com/
   ngrok http 5000
   # Use the ngrok URL provided
   ```

---

## 🔍 Monitoring During Tests

**Watch logs in real-time:**
```powershell
docker-compose -f docker-compose.prod.yml logs -f
```

**Check container status:**
```powershell
docker stats audio-extractor-backend
```

**Check network connections:**
```powershell
netstat -ano | findstr :5000
```

---

## ✅ Success Criteria

All tests should pass:

- [ ] Container running and healthy
- [ ] Local access works (`localhost:5000`)
- [ ] Network access works (`10.170.254.126:5000`)
- [ ] Health endpoint responds correctly
- [ ] OAuth endpoint accessible
- [ ] OAuth flow completes successfully
- [ ] Audio extraction works (if tested)
- [ ] Logs show requests coming in
- [ ] No errors in container logs

---

## 🐛 Troubleshooting

### Can't access from network

**Check Windows Firewall:**
```powershell
# Allow port 5000
New-NetFirewallRule -DisplayName "Audio Extractor Backend" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
```

**Verify binding:**
```powershell
netstat -ano | findstr :5000
# Should show: 0.0.0.0:5000 (not 127.0.0.1:5000)
```

### Container not starting

```powershell
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Restart
docker-compose -f docker-compose.prod.yml restart
```

### OAuth redirect not working

- Update `GOOGLE_REDIRECT_URI` in `.env`:
  ```env
  GOOGLE_REDIRECT_URI=http://10.170.254.126:5000/oauth2callback
  ```
- Update in Google Cloud Console
- Restart container

---

## 📝 Test Results Template

```
Date: ___________
Tester: ___________

✅ Container Status: [ ] Pass [ ] Fail
✅ Local Access: [ ] Pass [ ] Fail
✅ Network Access: [ ] Pass [ ] Fail
✅ Health Endpoint: [ ] Pass [ ] Fail
✅ OAuth Endpoint: [ ] Pass [ ] Fail
✅ OAuth Flow: [ ] Pass [ ] Fail
✅ Audio Extraction: [ ] Pass [ ] Fail
✅ Logs Working: [ ] Pass [ ] Fail

Notes:
_______________________________________
_______________________________________
_______________________________________
```

---

## 🚀 Ready for Cloud Deployment?

Once all local tests pass, you're ready to deploy to cloud!

See `DEPLOYMENT.md` for cloud deployment instructions.

