# Google Drive Setup Instructions

This guide will help you set up Google Drive integration for uploading audio files.

## Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the **Google Drive API**:
   - Navigate to "APIs & Services" > "Library"
   - Search for "Google Drive API"
   - Click "Enable"

## Step 2: Create OAuth 2.0 Credentials

1. Go to "APIs & Services" > "Credentials"
2. Click "Create Credentials" > "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - Choose "External" (unless you have a Google Workspace)
   - Fill in required fields (App name, User support email, etc.)
   - Add scopes: `https://www.googleapis.com/auth/drive.file`
   - Add test users (your email)
   - Save and continue
4. Create OAuth client ID:
   - Application type: "Web application"
   - Name: "Audio Extractor Backend"
   - Authorized redirect URIs: `http://localhost:5000/oauth2callback`
   - Click "Create"
5. Copy the **Client ID** and **Client Secret**

## Step 3: Get Refresh Token

1. Go to [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/)
2. Click the gear icon (⚙️) in the top right
3. Check "Use your own OAuth credentials"
4. Enter your **Client ID** and **Client Secret**
5. In the left panel, find "Drive API v3"
6. Select scope: `https://www.googleapis.com/auth/drive.file`
7. Click "Authorize APIs"
8. Sign in with your Google account and grant permissions
9. Click "Exchange authorization code for tokens"
10. Copy the **Refresh token** (not the access token)

## Step 4: Configure Environment Variables

Create a `.env` file in the Backend directory with the following:

```env
GOOGLE_CLIENT_ID=your_client_id_here
GOOGLE_CLIENT_SECRET=your_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
GOOGLE_REFRESH_TOKEN=your_refresh_token_here

# Optional: Google Drive Folder ID
# Leave empty to upload to root directory
# To get folder ID: Open folder in Google Drive, copy ID from URL
GOOGLE_DRIVE_FOLDER_ID=
```

## Step 5: Get Folder ID (Optional)

If you want to upload files to a specific folder:

1. Open Google Drive in your browser
2. Navigate to the folder where you want files uploaded
3. Copy the folder ID from the URL:
   - URL format: `https://drive.google.com/drive/folders/FOLDER_ID_HERE`
   - Copy the `FOLDER_ID_HERE` part
4. Add it to `.env` as `GOOGLE_DRIVE_FOLDER_ID`

## Security Notes

- **Never commit `.env` file to git** (it's already in `.gitignore`)
- Keep your credentials secure
- The refresh token doesn't expire unless revoked
- You can revoke access in [Google Account Security](https://myaccount.google.com/permissions)

## Testing

After setup, restart your backend server and try extracting audio. Files will be uploaded to Google Drive instead of (or in addition to) local storage.

