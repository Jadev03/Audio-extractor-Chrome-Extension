# 🔐 Per-User Authentication Guide

## 🎯 Overview

The system now supports **per-user Google authentication**. Each Chrome extension user authenticates with their own Google account, and files uploaded to Google Drive will show the user's name as the uploader.

## ✅ What Changed

### Frontend (Chrome Extension)

1. **Chrome Identity API Integration**
   - Uses `chrome.identity.getAuthToken()` for OAuth
   - Each user authenticates with their own Google account
   - User's email and ID are stored

2. **Authentication Flow**
   - User clicks "Sign in with Google" button
   - Chrome handles OAuth flow
   - User's token is sent to backend
   - Authentication status is displayed

3. **Per-User Uploads**
   - Each extraction request includes `userId` and `userEmail`
   - Backend uses the user's token for uploads
   - Files appear in Google Drive with the user's name

### Backend

1. **User Token Storage**
   - New service: `userTokenService.ts`
   - Stores tokens per user (by userId)
   - Tokens stored in `user-tokens/` directory

2. **New Endpoints**
   - `POST /auth/user` - Save user authentication
   - `GET /auth/user/:userId` - Check user authentication status

3. **Updated Extract Endpoint**
   - Accepts `userId` and `userEmail` in request body
   - Uses user's token for uploads
   - Falls back to shared token if no user token

4. **New Upload Function**
   - `uploadToDriveWithUserToken()` - Uploads using user's access token
   - Files uploaded with user's credentials show user's name

## 🚀 How It Works

### 1. User Authentication

```
User clicks "Sign in with Google"
  ↓
Chrome Identity API handles OAuth
  ↓
User grants permissions
  ↓
Extension gets access token
  ↓
Token sent to backend: POST /auth/user
  ↓
Backend stores token per user
```

### 2. Audio Extraction

```
User clicks "Extract Audio"
  ↓
Extension sends request with userId
  ↓
Backend extracts audio
  ↓
Backend loads user's token
  ↓
Backend uploads to Drive with user's token
  ↓
File appears in Drive with user's name
```

## 📋 Setup Requirements

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. **APIs & Services → Credentials**
4. Click your OAuth 2.0 Client ID
5. **Authorized JavaScript origins:**
   - Add: `chrome-extension://YOUR_EXTENSION_ID`
   - Or use: `https://YOUR_DOMAIN.com` (if using hosted extension)

6. **Authorized redirect URIs:**
   - Add: `https://YOUR_EXTENSION_ID.chromiumapp.org/`
   - This is the default Chrome Identity redirect

### 2. Chrome Extension Manifest

The `manifest.json` already includes:
- `"identity"` permission
- `oauth2` configuration with client ID
- Required host permissions

### 3. Backend Configuration

No changes needed! The backend automatically:
- Stores user tokens
- Uses user tokens for uploads
- Falls back to shared token if needed

## 🔍 Testing

### Test Authentication

1. Open Chrome extension
2. Click "Sign in with Google"
3. Complete OAuth flow
4. Should see: "✅ Logged in as: your-email@gmail.com"

### Test Upload

1. Authenticate first
2. Go to YouTube video
3. Click "Detect YouTube URL"
4. Click "Extract Audio"
5. File should upload to Google Drive
6. Check Drive - file should show your name as uploader

## 🐛 Troubleshooting

### "Authentication failed"

**Check:**
- Chrome Identity API is enabled
- OAuth client ID is correct in manifest.json
- Authorized origins/redirects in Google Cloud Console

**Fix:**
- Verify `oauth2.client_id` in manifest.json matches Google Cloud Console
- Add correct redirect URI in Google Cloud Console

### "User token not found"

**Check:**
- User authenticated successfully
- Token was saved to backend
- `user-tokens/` directory exists

**Fix:**
- Re-authenticate
- Check backend logs for errors
- Verify `user-tokens/` directory permissions

### "Failed to upload to Google Drive"

**Check:**
- User's token is valid
- User has permission to upload to folder
- Folder ID is correct

**Fix:**
- Re-authenticate to refresh token
- Check folder permissions in Google Drive
- Verify `GOOGLE_DRIVE_FOLDER_ID` in backend

## 📊 File Structure

```
Backend/
├── userTokenService.ts      # Per-user token storage
├── driveService.ts          # Updated with user token upload
├── server.ts                # Updated extract endpoint
└── user-tokens/             # User token storage directory
    ├── user123.json         # User tokens (one per user)
    └── user456.json
```

## ✅ Benefits

1. **User Privacy** - Each user's files are associated with their account
2. **Proper Attribution** - Files show correct uploader name
3. **Individual Quotas** - Each user uses their own Drive quota
4. **Better Security** - No shared credentials

## 🎉 Done!

Your extension now supports per-user authentication!

