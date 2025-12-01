# 📱 Testing from Another Device

Step-by-step guide to test your production Docker setup from another device.

## 🌐 Your Server Information

- **Server IP:** `10.170.254.126`
- **Port:** `5000`
- **Base URL:** `http://10.170.254.126:5000`

---

## ✅ Pre-Test Checklist

- [x] Docker container is running
- [x] Port 5000 is bound to `0.0.0.0:5000`
- [x] Windows Firewall rule added
- [ ] Both devices on same Wi-Fi network
- [ ] Another device ready (phone, tablet, or another computer)

---

## 📱 Test 1: Basic Health Check

### On Another Device:

1. **Open a web browser** (Chrome, Safari, Firefox, etc.)

2. **Navigate to:**
   ```
   http://10.170.254.126:5000/drive/status
   ```

3. **Expected Result:**
   - You should see JSON response like:
   ```json
   {
     "configured": true,
     "message": "Google Drive is fully configured and ready",
     "nextStep": "Audio files will be uploaded to Google Drive automatically",
     ...
   }
   ```

4. **If it works:** ✅ Connection successful!
5. **If it doesn't work:** See Troubleshooting section below

---

## 🔐 Test 2: OAuth Endpoint

### On Another Device:

1. **Navigate to:**
   ```
   http://10.170.254.126:5000/auth/google
   ```

2. **Expected Result:**
   - You should see JSON with `authUrl`:
   ```json
   {
     "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
   }
   ```

3. **If you see the authUrl:** ✅ OAuth endpoint is working!

---

## 🔄 Test 3: Complete OAuth Flow

### On Another Device:

1. **Get the auth URL:**
   - Visit: `http://10.170.254.126:5000/auth/google`
   - Copy the `authUrl` value from the JSON response

2. **Open the authUrl in browser:**
   - Paste the full URL in the address bar
   - Press Enter

3. **Complete Google OAuth:**
   - Sign in to Google (if needed)
   - Review and accept permissions
   - Click "Allow"

4. **Expected Result:**
   - You should be redirected to: `http://10.170.254.126:5000/oauth2callback?code=...`
   - You should see: **"✅ Authorization Successful!"** page

5. **If successful:** ✅ OAuth is fully working!

---

## 🎵 Test 4: Audio Extraction API

### Option A: Using Browser (Simple Test)

1. **Open browser developer tools** (F12)
2. **Go to Console tab**
3. **Run this JavaScript:**
   ```javascript
   fetch('http://10.170.254.126:5000/extract', {
     method: 'POST',
     headers: {'Content-Type': 'application/json'},
     body: JSON.stringify({
       youtubeUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
     })
   })
   .then(r => r.json())
   .then(data => console.log(data))
   .catch(err => console.error(err))
   ```

4. **Expected Result:**
   - Should see response with `success: true` and `fileUrl` or `driveWebViewLink`
   - Check the server logs on your main computer

### Option B: Using curl (If Available)

```bash
curl -X POST http://10.170.254.126:5000/extract \
  -H "Content-Type: application/json" \
  -d '{"youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

---

## 📊 Monitor on Main Computer

While testing from another device, watch the logs on your main computer:

```powershell
docker-compose -f docker-compose.prod.yml logs -f
```

You should see:
- Incoming requests with the other device's IP
- Request details (method, URL, user agent)
- Processing status
- Success/error messages

---

## 🧪 Test 5: Chrome Extension (If Updated)

### Update Extension for Network Testing:

1. **Edit `Frontend/src/popup/popup.tsx`:**
   ```typescript
   // Change this line:
   const res = await fetch("http://localhost:5000/extract", {
   
   // To:
   const res = await fetch("http://10.170.254.126:5000/extract", {
   ```

2. **Rebuild extension:**
   ```powershell
   cd Frontend
   npm run build
   ```

3. **Load extension** in Chrome on the other device

4. **Test extraction:**
   - Go to a YouTube video
   - Click extension icon
   - Click "Detect YouTube URL"
   - Click "Extract Audio"
   - Watch logs on main computer

---

## 🐛 Troubleshooting

### ❌ Can't Connect from Another Device

**Check 1: Same Network?**
- Both devices must be on the same Wi-Fi network
- Check Wi-Fi name matches on both devices

**Check 2: Firewall Rule**
```powershell
# Verify firewall rule exists
Get-NetFirewallRule -DisplayName "Audio Extractor Backend"
```

**Check 3: Container Status**
```powershell
docker ps
# Should show container as "Up"
```

**Check 4: Port Binding**
```powershell
netstat -ano | findstr :5000
# Should show: 0.0.0.0:5000 (not 127.0.0.1:5000)
```

**Check 5: Router Firewall**
- Some routers block device-to-device communication
- Check router settings if needed

### ❌ Connection Timeout

- Verify IP address is correct: `10.170.254.126`
- Try pinging from other device: `ping 10.170.254.126`
- Check if Windows Firewall is blocking

### ❌ OAuth Redirect Not Working

- Update `.env` file:
  ```env
  GOOGLE_REDIRECT_URI=http://10.170.254.126:5000/oauth2callback
  ```
- Update Google Cloud Console with same redirect URI
- Restart container:
  ```powershell
  docker-compose -f docker-compose.prod.yml restart
  ```

### ❌ "Connection Refused" Error

- Container might not be running
- Check: `docker ps`
- Restart: `docker-compose -f docker-compose.prod.yml restart`

---

## ✅ Success Indicators

You'll know it's working when:

- ✅ Can access `http://10.170.254.126:5000/drive/status` from other device
- ✅ See JSON response (not error page)
- ✅ OAuth flow completes successfully
- ✅ Server logs show requests from other device's IP
- ✅ Audio extraction works (if tested)

---

## 📝 Test Results Template

```
Date: ___________
Device Used: ___________
Network: ___________

✅ Health Check: [ ] Pass [ ] Fail
✅ OAuth Endpoint: [ ] Pass [ ] Fail  
✅ OAuth Flow: [ ] Pass [ ] Fail
✅ Audio Extraction: [ ] Pass [ ] Fail
✅ Logs Visible: [ ] Pass [ ] Fail

Notes:
_______________________________________
_______________________________________
```

---

## 🎉 Next Steps

Once all tests pass from another device:

1. ✅ **Local production testing complete**
2. 🚀 **Ready for cloud deployment!**
3. 📖 **See `DEPLOYMENT.md` for cloud options**

---

## 💡 Quick Test Commands

**On Main Computer (Watch Logs):**
```powershell
docker-compose -f docker-compose.prod.yml logs -f
```

**On Another Device (Test URLs):**
- Health: `http://10.170.254.126:5000/drive/status`
- OAuth: `http://10.170.254.126:5000/auth/google`
- Extract: `POST http://10.170.254.126:5000/extract`

