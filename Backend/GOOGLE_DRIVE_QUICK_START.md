# Google Drive Quick Start

## 🚀 Quick Setup (5 minutes)

### 1. Get Google Cloud Credentials
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Create OAuth 2.0 credentials (see `GOOGLE_DRIVE_SETUP.md` for details)
- Copy **Client ID** and **Client Secret**

### 2. Get Your Folder ID
- Open Google Drive
- Create or open the folder where files should be uploaded
- Copy the folder ID from the URL: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`

### 3. Create `.env` File
```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
GOOGLE_DRIVE_FOLDER_ID=your_folder_id_here
```

### 4. First-Time Authentication
```bash
# Start the server
npm run dev

# In another terminal or browser, visit:
http://localhost:5000/auth/google

# Copy the authUrl from the JSON response
# Open it in your browser
# Grant permissions
# Done! Token is saved automatically
```

### 5. Test It
```bash
# Check status
curl http://localhost:5000/drive/status

# Extract audio - it will automatically upload to Google Drive!
```

## 📦 For Production

1. **Set environment variables** on your server (not `.env` file)
2. **Update redirect URI** in Google Cloud Console:
   - Add: `https://yourdomain.com/oauth2callback`
3. **Complete OAuth once**:
   - Visit: `https://yourdomain.com/auth/google`
   - Complete authorization
   - Token saved on server (persists across restarts)
4. **Done!** All files will upload to Google Drive automatically

## ✅ That's It!

- Token is saved in `token.json` (auto-refreshes)
- Files upload to your specified folder
- Works locally and in production
- No manual token management needed

See `GOOGLE_DRIVE_SETUP.md` for detailed instructions.

