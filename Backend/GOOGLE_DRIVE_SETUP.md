# Google Drive Setup Guide

This guide will help you set up Google Drive integration for uploading audio files to a shared folder.

## 🎯 Overview

The system supports:
- **First-time OAuth setup** via web interface (works locally and in production)
- **Automatic token refresh** - tokens are saved and refreshed automatically
- **Shared folder uploads** - files go to your specified Google Drive folder
- **Production-ready** - tokens persist across server restarts

## 📋 Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

## 🔐 Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have Google Workspace)
   - Fill in required fields:
     - App name: "YouTube Audio Extractor"
     - User support email: Your email
     - Developer contact: Your email
   - Add scopes: `https://www.googleapis.com/auth/drive.file`
   - Add test users (your email) if in testing mode
   - Save and continue
4. Create OAuth client ID:
   - Application type: **Web application**
   - Name: "Audio Extractor Backend"
   - **Authorized redirect URIs**: 
     - For local: `http://localhost:5000/oauth2callback`
     - For production: `https://yourdomain.com/oauth2callback` (replace with your domain)
   - Click "Create"
5. **Copy the Client ID and Client Secret**

## 📁 Step 3: Get Your Google Drive Folder ID

1. Open Google Drive in your browser
2. Navigate to the folder where you want files uploaded (or create a new folder)
3. **Make the folder accessible** (if you want others to upload):
   - Right-click folder → Share
   - Set permission: "Anyone with the link can upload"
   - Copy the link
4. Get the Folder ID from the URL:
   - URL format: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy the `FOLDER_ID_HERE` part

## ⚙️ Step 4: Configure Environment Variables

Create a `.env` file in the `Backend` directory:

```env
# Google Drive OAuth Credentials (Required)
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here

# Redirect URI (change for production)
GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
# For production: GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth2callback

# Google Drive Folder ID (Required - where files will be uploaded)
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here

# Note: GOOGLE_REFRESH_TOKEN is NOT needed in .env
# It will be generated automatically during first-time OAuth setup
```

## 🚀 Step 5: First-Time OAuth Setup

### For Local Development:

1. **Start your backend server:**
   ```bash
   cd Backend
   npm run dev
   ```

2. **Get the authorization URL:**
   - Open browser: `http://localhost:5000/auth/google`
   - Or use curl: `curl http://localhost:5000/auth/google`
   - You'll get a JSON response with `authUrl`

3. **Authorize the application:**
   - Copy the `authUrl` from the response
   - Open it in your browser
   - Sign in with your Google account
   - Grant permissions
   - You'll be redirected to `http://localhost:5000/oauth2callback`
   - You should see "✅ Authorization Successful!"

4. **Token is saved:**
   - Token is automatically saved to `Backend/token.json`
   - This file is in `.gitignore` (won't be committed)
   - Token will be refreshed automatically

### For Production:

1. **Set environment variables** on your production server
2. **Update redirect URI** in Google Cloud Console to match your production domain
3. **Visit** `https://yourdomain.com/auth/google` to get auth URL
4. **Complete OAuth flow** - token will be saved on server
5. **Token persists** - no need to re-authenticate unless revoked

## ✅ Step 6: Verify Setup

Check if Google Drive is configured:

```bash
curl http://localhost:5000/drive/status
```

Response:
```json
{
  "configured": true,
  "message": "Google Drive is configured and ready"
}
```

## 🔄 How It Works

1. **First Time:**
   - Visit `/auth/google` → Get authorization URL
   - Complete OAuth flow → Token saved to `token.json`
   - Token includes refresh token for automatic renewal

2. **Subsequent Requests:**
   - Token is loaded from `token.json`
   - Automatically refreshed when expired
   - No manual intervention needed

3. **File Upload:**
   - Audio files are extracted locally
   - Automatically uploaded to your Google Drive folder
   - File permissions set to "anyone can read" (optional)
   - Returns Google Drive link in API response

## 📤 API Response Format

After extraction, the API returns:

```json
{
  "success": true,
  "fileUrl": "https://drive.google.com/file/d/...",  // Google Drive link
  "driveFileId": "file_id_here",
  "driveWebViewLink": "https://drive.google.com/file/d/...",
  "localFileUrl": null  // null if uploaded to Drive
}
```

## 🔒 Security Notes

- **Never commit `.env` or `token.json`** (both in `.gitignore`)
- **Keep credentials secure**
- **Refresh token doesn't expire** unless revoked
- **Revoke access** in [Google Account Security](https://myaccount.google.com/permissions) if needed
- **For production:** Use environment variables, not `.env` file

## 🛠️ Troubleshooting

### "Google Drive credentials not configured"
- Check `.env` file has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`
- Verify values are correct (no extra spaces)

### "Token not found"
- Complete OAuth flow by visiting `/auth/google`
- Check `token.json` file exists in `Backend/` directory

### "Failed to upload to Google Drive"
- Check folder ID is correct
- Verify folder exists and is accessible
- Check token hasn't been revoked

### Production Issues
- Ensure redirect URI matches exactly in Google Cloud Console
- Check server can access Google APIs (firewall/network)
- Verify environment variables are set correctly

## 📝 Quick Setup Checklist

- [ ] Google Cloud project created
- [ ] Google Drive API enabled
- [ ] OAuth 2.0 credentials created
- [ ] Redirect URI configured (local and/or production)
- [ ] Folder ID obtained from Google Drive
- [ ] `.env` file created with credentials
- [ ] OAuth flow completed (visit `/auth/google`)
- [ ] Token saved (`token.json` exists)
- [ ] Test upload works

## 🎉 You're Done!

After setup, all extracted audio files will automatically upload to your Google Drive folder. The token will persist and refresh automatically, so you only need to set it up once!
