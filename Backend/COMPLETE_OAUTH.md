# Complete Google Drive OAuth Setup

## Current Status
✅ Google Drive credentials are configured  
❌ OAuth authorization not completed

## Steps to Complete OAuth

### Step 1: Get the Authorization URL

The backend is already running. You can get the auth URL in two ways:

**Option A: Direct URL (Easiest)**
1. Open your browser
2. Visit: `http://localhost:5000/auth/google`
3. Copy the `authUrl` from the JSON response

**Option B: Use the JSON response you already have**
The authUrl is:
```
https://accounts.google.com/o/oauth2/v2/auth?access_type=offline&scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fdrive.file&prompt=consent&response_type=code&client_id=443250610252-havsei8vveq3r380hbf84i2rlin0nier.apps.googleusercontent.com&redirect_uri=http%3A%2F%2Flocalhost%3A5000%2Foauth2callback
```

### Step 2: Authorize the Application

1. **Open the authUrl in your browser:**
   - Copy the entire `authUrl` from the JSON response
   - Paste it in your browser's address bar
   - Press Enter

2. **Sign in to Google** (if not already signed in)

3. **Review permissions:**
   - You'll see what the app wants to access
   - Click "Allow" or "Continue"

4. **Complete authorization:**
   - Google will redirect you to: `http://localhost:5000/oauth2callback?code=...`
   - You should see a success page: "✅ Authorization Successful!"

### Step 3: Verify Setup

1. **Check the status:**
   ```
   http://localhost:5000/drive/status
   ```

2. **Expected response:**
   ```json
   {
     "configured": true,
     "message": "Google Drive is fully configured and ready",
     "nextStep": "Audio files will be uploaded to Google Drive automatically"
   }
   ```

## Troubleshooting

### ❌ "Authorization Failed" or "No authorization code received"

**Possible causes:**
1. The redirect URI doesn't match in Google Cloud Console
2. The authorization code expired (they expire quickly)
3. Browser blocked the redirect

**Solution:**
1. Make sure in Google Cloud Console, the redirect URI is exactly:
   ```
   http://localhost:5000/oauth2callback
   ```
2. Try the OAuth flow again immediately
3. Make sure you're using the same browser

### ❌ Redirect goes to localhost but shows error

**Check:**
1. Make sure Docker container is running: `docker ps`
2. Check backend logs: `docker-compose logs -f`
3. Verify the token.json file was created:
   ```powershell
   docker exec audio-extractor-backend ls -la /app/dist/token.json
   ```

### ❌ Token saved but status still shows "not configured"

**Solution:**
1. Check if token.json exists in the container:
   ```powershell
   docker exec audio-extractor-backend cat /app/dist/token.json
   ```
2. If it exists but status is wrong, restart the container:
   ```powershell
   docker-compose restart
   ```

## Quick Test After Setup

Once OAuth is complete, test the full flow:

1. Extract audio from a YouTube video using the Chrome extension
2. Check backend logs to see if upload to Drive succeeds:
   ```powershell
   docker-compose logs -f
   ```
3. Check your Google Drive folder - the audio file should appear there!

## Notes

- The token is saved to `token.json` in the container
- The token persists via Docker volume mount (if configured in docker-compose.yml)
- Refresh tokens don't expire, so you only need to do this once
- If you revoke access in Google Account settings, you'll need to re-authorize

