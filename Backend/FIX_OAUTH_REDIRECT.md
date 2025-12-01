# 🔧 Fix OAuth Redirect URI for Network Access

When accessing from your phone, the OAuth redirect goes to `localhost:5000` which doesn't work. Here's how to fix it.

## 🎯 The Problem

- **Current redirect URI:** `http://localhost:5000/oauth2callback`
- **Needs to be:** `http://10.170.254.126:5000/oauth2callback` (your network IP)

## ✅ Solution: Update Redirect URI

### Step 1: Update `.env` File

1. **Open or create `.env` file** in the `Backend` directory

2. **Add or update this line:**
   ```env
   GOOGLE_REDIRECT_URI=http://10.170.254.126:5000/oauth2callback
   ```

3. **Your complete `.env` should look like:**
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_DRIVE_FOLDER_ID=your_folder_id
   GOOGLE_REDIRECT_URI=http://10.170.254.126:5000/oauth2callback
   ```

### Step 2: Update Google Cloud Console

1. **Go to [Google Cloud Console](https://console.cloud.google.com/)**

2. **Navigate to:**
   - APIs & Services → Credentials
   - Click on your OAuth 2.0 Client ID

3. **Add Authorized redirect URI:**
   - Click "Add URI"
   - Enter: `http://10.170.254.126:5000/oauth2callback`
   - Click "Save"

4. **Keep both URIs** (you can have multiple):
   - `http://localhost:5000/oauth2callback` (for local testing)
   - `http://10.170.254.126:5000/oauth2callback` (for network access)

### Step 3: Restart Container

```powershell
docker-compose -f docker-compose.prod.yml restart
```

### Step 4: Test from Phone

1. **On your phone**, visit: `http://10.170.254.126:5000/auth/google`
2. **Copy the `authUrl`** from the JSON response
3. **Open it in browser**
4. **Complete OAuth**
5. **Should redirect to:** `http://10.170.254.126:5000/oauth2callback?code=...`
6. **Should see:** "✅ Authorization Successful!"

## 🔄 Alternative: Update docker-compose.prod.yml Directly

If you prefer not to use `.env` file, you can update `docker-compose.prod.yml`:

```yaml
environment:
  - GOOGLE_REDIRECT_URI=http://10.170.254.126:5000/oauth2callback
```

Then restart:
```powershell
docker-compose -f docker-compose.prod.yml up -d
```

## ✅ Verify It's Working

1. **Check the redirect URI in logs:**
   ```powershell
   docker-compose -f docker-compose.prod.yml logs | Select-String "redirect"
   ```

2. **Test OAuth from phone:**
   - Visit: `http://10.170.254.126:5000/auth/google`
   - The `authUrl` in response should contain: `redirect_uri=http://10.170.254.126:5000/oauth2callback`

## 🚨 Important Notes

- **For production deployment:** Use your domain name instead of IP
  - Example: `https://your-domain.com/oauth2callback`
  
- **For cloud deployment:** Update to your cloud server's domain/IP

- **Multiple redirect URIs are allowed** in Google Cloud Console, so you can keep both localhost and network IP

## 🐛 Troubleshooting

### Still redirecting to localhost?

1. **Check `.env` file** has the correct redirect URI
2. **Verify environment variable is loaded:**
   ```powershell
   docker exec audio-extractor-backend env | findstr GOOGLE_REDIRECT_URI
   ```
3. **Restart container** after changes

### OAuth still fails?

- Make sure the redirect URI in Google Cloud Console **exactly matches** what's in `.env`
- Check for typos (http vs https, port number, etc.)
- Wait a few minutes after updating Google Cloud Console (changes may take time to propagate)

