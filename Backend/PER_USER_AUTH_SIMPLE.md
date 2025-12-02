# 🔐 Per-User Authentication (Simple Method - No Chrome Identity API)

## 🎯 Overview

This implementation uses the **backend OAuth flow** instead of Chrome Identity API. This means:
- ✅ **No special redirect URI needed** - Works with any backend URL
- ✅ **No extension publishing required** - Perfect for sharing with friends
- ✅ **Simple setup** - Just configure Google Cloud Console with your backend URL

## ✅ How It Works

### Authentication Flow:

1. **User clicks "Sign in with Google"** in extension
2. **Extension opens a new tab** with backend's OAuth URL
3. **User authenticates** with Google in the browser
4. **Google redirects** to backend's `/oauth2callback`
5. **Backend gets user info** and stores token per user
6. **Callback page** stores user info in localStorage
7. **Extension detects** completion and updates UI

### Upload Flow:

1. **User extracts audio** → Extension sends `userId` with request
2. **Backend uses user's token** → Uploads to Drive with user's account
3. **File appears in Drive** → Shows user's name as uploader

## 🔧 Setup (Simple!)

### 1. Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services → Credentials**
3. Click your OAuth 2.0 Client ID
4. **Authorized redirect URIs:**
   - Add: `http://13.200.189.31:5000/oauth2callback`
   - Or: `https://yourdomain.com/oauth2callback` (if you have a domain)

That's it! No special Chrome extension redirect URI needed.

### 2. Backend Configuration

Make sure your `.env.prod` has:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_REDIRECT_URI=http://13.200.189.31:5000/oauth2callback
```

### 3. Extension

No special configuration needed! The extension:
- Opens backend OAuth URL in a new tab
- Detects when OAuth completes
- Stores user info locally
- Sends userId with each request

## 🚀 Testing

### Test Authentication:

1. Open Chrome extension
2. Click "🔐 Sign in with Google"
3. A new tab opens with Google OAuth
4. Sign in and grant permissions
5. Tab closes automatically
6. Extension shows: "✅ Logged in as: your-email@gmail.com"

### Test Upload:

1. Make sure you're authenticated
2. Go to YouTube video
3. Click "Detect YouTube URL"
4. Click "Extract Audio"
5. File uploads to Google Drive
6. Check Drive - file shows your name as uploader

## 📋 What Changed

### Frontend:
- ✅ Removed Chrome Identity API dependency
- ✅ Uses backend OAuth flow (opens tab)
- ✅ Detects OAuth completion via tab listener
- ✅ Stores user info in localStorage

### Backend:
- ✅ OAuth callback gets user info from Google
- ✅ Stores token per user automatically
- ✅ Returns success page with user info

## 🎉 Benefits

1. **No Extension Publishing** - Works with unpacked extensions
2. **No Special Redirect URI** - Just use your backend URL
3. **Simple Setup** - Only need to configure Google Cloud Console
4. **Per-User Uploads** - Each user's files show their name

## 🐛 Troubleshooting

### "Failed to get authentication URL"

**Check:**
- Backend is running
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set

**Fix:**
- Verify backend is accessible
- Check backend logs

### OAuth tab opens but doesn't close

**Check:**
- OAuth callback completed successfully
- Check browser console for errors

**Fix:**
- Manually close the tab
- Check backend logs for OAuth errors
- Verify redirect URI in Google Cloud Console

### "User token not found" after authentication

**Check:**
- OAuth callback saved user token
- Backend `user-tokens/` directory exists

**Fix:**
- Re-authenticate
- Check backend logs
- Verify file permissions on `user-tokens/` directory

## ✅ Done!

Your extension now works without Chrome Identity API or special redirect URIs!

Perfect for sharing with friends for research purposes! 🎉

