# 🔧 Fix: OAuth Still Redirecting to Localhost

## 🎯 The Problem

Even though `.env.prod` has the ngrok URL, OAuth is still redirecting to `localhost:5000` when signing in from mobile.

## 🔍 Root Cause

The server code was loading `.env` files from the filesystem, which was **overriding** the Docker environment variables set by `env_file` in `docker-compose.prod.yml`.

## ✅ Solution Applied

Updated `server.ts` and `driveService.ts` to:
1. **Check if Docker environment variables exist first**
2. **Use `override: false`** when loading `.env` files
3. **Skip loading `.env` files** if Docker env vars are present

This ensures Docker's `env_file` (`.env.prod`) takes precedence.

## 🔄 Rebuild Required

After the code fix, you need to rebuild the container:

```powershell
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

## ✅ Verify It's Working

1. **Check environment variable in container:**
   ```powershell
   docker exec audio-extractor-backend printenv | findstr GOOGLE_REDIRECT_URI
   ```
   Should show: `GOOGLE_REDIRECT_URI=https://unfoaming-rosalva-churchly.ngrok-free.dev/oauth2callback`

2. **Test auth URL:**
   ```powershell
   $response = Invoke-RestMethod -Uri "https://unfoaming-rosalva-churchly.ngrok-free.dev/auth/google"
   $response.authUrl
   ```
   The `authUrl` should contain: `redirect_uri=https://unfoaming-rosalva-churchly.ngrok-free.dev/oauth2callback`

3. **Test from phone:**
   - Visit: `https://unfoaming-rosalva-churchly.ngrok-free.dev/auth/google`
   - Complete OAuth
   - Should redirect to ngrok URL, not localhost!

## 📝 What Changed

### Before:
- Server loaded `.env` files which overrode Docker env vars
- Always used localhost redirect URI

### After:
- Docker env vars (from `.env.prod`) take precedence
- Server only loads `.env` files if Docker env vars don't exist
- Uses ngrok URL for redirect

## 🐛 If Still Not Working

1. **Verify `.env.prod` has correct URL:**
   ```powershell
   Get-Content .env.prod | Select-String "GOOGLE_REDIRECT_URI"
   ```

2. **Check container is using `.env.prod`:**
   ```powershell
   docker-compose -f docker-compose.prod.yml config | Select-String "env_file"
   ```

3. **Restart container:**
   ```powershell
   docker-compose -f docker-compose.prod.yml restart
   ```

4. **Check logs for redirect URI:**
   ```powershell
   docker-compose -f docker-compose.prod.yml logs | Select-String "redirect"
   ```

