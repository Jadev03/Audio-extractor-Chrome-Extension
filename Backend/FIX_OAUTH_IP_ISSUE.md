# 🔧 Fix: Google OAuth Doesn't Accept IP Addresses

Google Cloud Console requires a domain name for OAuth redirect URIs, not IP addresses. Here are solutions:

## 🎯 The Problem

- ❌ **IP Address:** `http://10.170.254.126:5000/oauth2callback` (Not allowed)
- ✅ **Domain Required:** Must use a domain like `.com`, `.org`, etc.

## ✅ Solution Options

### Option 1: Use ngrok (Easiest for Testing) ⭐ RECOMMENDED

ngrok creates a public URL that tunnels to your local server.

#### Step 1: Install ngrok

1. **Download ngrok:** https://ngrok.com/download
2. **Extract and add to PATH** (or use full path)

#### Step 2: Start ngrok

```powershell
# In a new terminal
ngrok http 5000
```

You'll get a URL like: `https://abc123.ngrok.io`

#### Step 3: Update .env

```env
GOOGLE_REDIRECT_URI=https://abc123.ngrok.io/oauth2callback
```

#### Step 4: Update Google Cloud Console

1. Go to Google Cloud Console → Credentials
2. Add redirect URI: `https://abc123.ngrok.io/oauth2callback`
3. Save

#### Step 5: Restart Container

```powershell
docker-compose -f docker-compose.prod.yml restart
```

#### Step 6: Test from Phone

- Use the ngrok URL: `https://abc123.ngrok.io/auth/google`
- OAuth will work from anywhere!

**Note:** Free ngrok URLs change each time you restart. For permanent URL, upgrade to paid plan or use Option 2.

---

### Option 2: Use Local Domain (localhost.me)

localhost.me is a free service that redirects to localhost.

#### Step 1: Update .env

```env
GOOGLE_REDIRECT_URI=http://10.170.254.126.localhost.me:5000/oauth2callback
```

**But wait!** This still uses IP. Better option:

#### Use a Custom Local Domain

1. **Edit hosts file** (requires admin):
   - Windows: `C:\Windows\System32\drivers\etc\hosts`
   - Add line: `10.170.254.126 audio-extractor.local`

2. **Update .env:**
   ```env
   GOOGLE_REDIRECT_URI=http://audio-extractor.local:5000/oauth2callback
   ```

3. **Update Google Cloud Console:**
   - Add: `http://audio-extractor.local:5000/oauth2callback`
   - **Note:** This might still not work because Google requires a real public domain

---

### Option 3: Test OAuth Locally Only (Temporary)

For now, test OAuth from the same computer:

1. **Keep localhost in .env:**
   ```env
   GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
   ```

2. **Test OAuth on the same machine** (not from phone)

3. **When deploying to cloud**, use a real domain

---

### Option 4: Deploy to Cloud with Real Domain (Best for Production)

When you deploy to cloud (Railway, Render, etc.), you'll get a real domain:

1. **Deploy to cloud platform** (see DEPLOYMENT.md)
2. **Get your domain:** e.g., `your-app.railway.app`
3. **Update .env:**
   ```env
   GOOGLE_REDIRECT_URI=https://your-app.railway.app/oauth2callback
   ```
4. **Update Google Cloud Console** with the real domain

---

## 🚀 Recommended: Use ngrok for Testing

For local testing before cloud deployment, **ngrok is the easiest solution**:

### Quick Setup:

```powershell
# Terminal 1: Start ngrok
ngrok http 5000

# Terminal 2: Update .env with ngrok URL
# Copy the "Forwarding" URL from ngrok (e.g., https://abc123.ngrok.io)
# Update .env:
GOOGLE_REDIRECT_URI=https://abc123.ngrok.io/oauth2callback

# Terminal 2: Restart container
docker-compose -f docker-compose.prod.yml restart

# Then update Google Cloud Console with the ngrok URL
```

### ngrok Benefits:

- ✅ Works from anywhere (phone, other devices)
- ✅ Real domain (Google accepts it)
- ✅ HTTPS included
- ✅ Free for testing
- ✅ Easy to set up

### ngrok Limitations:

- ⚠️ Free URLs change on restart (paid plans have fixed URLs)
- ⚠️ Free tier has connection limits

---

## 📝 Step-by-Step: ngrok Setup

### 1. Download & Install ngrok

- Visit: https://ngrok.com/download
- Download Windows version
- Extract to a folder (e.g., `C:\ngrok`)
- Or add to PATH

### 2. Start ngrok

```powershell
ngrok http 5000
```

You'll see:
```
Forwarding   https://abc123.ngrok.io -> http://localhost:5000
```

### 3. Copy the HTTPS URL

Copy the `https://abc123.ngrok.io` part (your URL will be different)

### 4. Update .env

```env
GOOGLE_REDIRECT_URI=https://abc123.ngrok.io/oauth2callback
```

### 5. Update Google Cloud Console

- Add redirect URI: `https://abc123.ngrok.io/oauth2callback`
- Save

### 6. Restart Container

```powershell
docker-compose -f docker-compose.prod.yml restart
```

### 7. Test from Phone

- Visit: `https://abc123.ngrok.io/auth/google`
- Complete OAuth
- Should work! ✅

---

## 🔄 Alternative: Skip OAuth for Now

If you just want to test audio extraction without Google Drive:

1. **Don't configure OAuth** (skip it)
2. **Test audio extraction** - files will be saved locally in `downloads/` folder
3. **Set up OAuth later** when you deploy to cloud with a real domain

---

## ✅ Summary

**For Local Testing:**
- Use **ngrok** (easiest) ⭐
- Or test OAuth only on same machine

**For Production:**
- Deploy to cloud platform
- Use the provided domain
- Update OAuth redirect URI

**Quick Fix Right Now:**
1. Install ngrok
2. Run: `ngrok http 5000`
3. Use the ngrok URL in `.env` and Google Cloud Console
4. Test from phone!

