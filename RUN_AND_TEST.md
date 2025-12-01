# 🚀 How to Run Backend & Chrome Extension

Complete guide to run and test the Audio Extractor application.

## 📋 Prerequisites

- **Docker** installed and running ([Download Docker](https://www.docker.com/get-started))
- **Node.js** (v20+) installed
- **Google Chrome** browser

---

## 🔧 Step 1: Start Backend (Docker)

### Option A: Using Docker Compose (Recommended)

1. **Navigate to Backend directory:**
   ```powershell
   cd Backend
   ```

2. **Create `.env` file** (if not exists) with your configuration:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_DRIVE_FOLDER_ID=your_folder_id
   GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
   ```
   > **Note:** Google Drive credentials are optional. The backend works without them (files saved locally).

3. **Build and start the container:**
   ```powershell
   docker-compose up -d
   ```

4. **Check if backend is running:**
   ```powershell
   docker-compose ps
   ```

5. **View logs:**
   ```powershell
   docker-compose logs -f
   ```

### Option B: Using Docker directly

```powershell
cd Backend
docker build -t audio-extractor-backend .
docker run -d -p 5000:5000 --name audio-extractor-backend audio-extractor-backend
```

### ✅ Verify Backend is Running

Open your browser and visit:
- **Health Check:** http://localhost:5000/drive/status
- **Google OAuth:** http://localhost:5000/auth/google

You should see JSON responses or a status page.

---

## 🎨 Step 2: Build Chrome Extension

1. **Open a new terminal/PowerShell window**

2. **Navigate to Frontend directory:**
   ```powershell
   cd Frontend
   ```

3. **Install dependencies** (if not already installed):
   ```powershell
   npm install
   ```

4. **Build the extension:**
   ```powershell
   npm run build
   ```

   ✅ This creates the `Frontend/dist` folder with all extension files.

---

## 🌐 Step 3: Load Extension in Chrome

1. **Open Google Chrome**

2. **Go to Extensions page:**
   - Type in address bar: `chrome://extensions/`
   - Or: Menu (⋮) → Extensions → Manage Extensions

3. **Enable Developer Mode:**
   - Toggle the **"Developer mode"** switch in the top-right corner

4. **Load the extension:**
   - Click **"Load unpacked"** button
   - Navigate to: `D:\Audio-Extractor\Chrome-extension\Frontend\dist`
   - Click **"Select Folder"**

5. **Verify extension loaded:**
   - You should see "YouTube Audio Extractor" in your extensions list
   - The extension icon should appear in Chrome toolbar (puzzle piece icon area)

---

## 🧪 Step 4: Test the Application

### Test 1: Check Backend Connection

1. **Open Chrome DevTools:**
   - Press `F12` or Right-click → Inspect

2. **Go to Console tab**

3. **Click the extension icon** in Chrome toolbar

4. **Check for errors:**
   - Should see no connection errors
   - If you see "Cannot connect to backend", verify Docker container is running

### Test 2: Extract Audio from YouTube

1. **Open a YouTube video:**
   - Go to: https://www.youtube.com/watch?v=dQw4w9WgXcQ (or any video)

2. **Click the extension icon** in Chrome toolbar

3. **Click "Detect YouTube URL"**
   - The URL should auto-fill from the current page

4. **Click "Extract Audio"**
   - You'll see "Extracting..." status
   - Wait for processing (may take 30-60 seconds)

5. **Click "Download Audio"**
   - Once extraction completes, download button appears
   - MP3 file downloads to your Downloads folder

### Test 3: Check Backend Logs

While testing, monitor backend logs:

```powershell
cd Backend
docker-compose logs -f
```

You should see:
- Request logs
- Extraction progress
- Success/error messages

---

## 🔍 Troubleshooting

### ❌ Backend not starting?

**Check Docker:**
```powershell
docker ps
```

**Check logs:**
```powershell
cd Backend
docker-compose logs
```

**Restart container:**
```powershell
docker-compose restart
```

### ❌ Extension shows "Cannot connect to backend"?

1. **Verify backend is running:**
   ```powershell
   docker ps
   ```
   Should show `audio-extractor-backend` container

2. **Test backend directly:**
   - Open: http://localhost:5000/drive/status
   - Should return JSON, not error

3. **Check port 5000:**
   ```powershell
   netstat -ano | findstr :5000
   ```

4. **Restart backend:**
   ```powershell
   cd Backend
   docker-compose restart
   ```

### ❌ Extension not appearing?

1. **Verify you loaded the correct folder:**
   - Should be: `Frontend/dist` (not `Frontend`)

2. **Check Developer mode is enabled:**
   - Go to `chrome://extensions/`
   - Toggle should be ON

3. **Reload the extension:**
   - Click the reload icon (🔄) on the extension card

### ❌ "yt-dlp not found" error?

The Docker image includes yt-dlp. If you see this error:

1. **Rebuild the image:**
   ```powershell
   cd Backend
   docker-compose build --no-cache
   docker-compose up -d
   ```

### ❌ Audio extraction fails?

1. **Check backend logs:**
   ```powershell
   docker-compose logs -f
   ```

2. **Verify YouTube URL is valid:**
   - Try a different video
   - Make sure URL is complete

3. **Check downloads folder:**
   ```powershell
   cd Backend
   ls downloads
   ```

---

## 🛑 Stopping the Application

### Stop Backend:
```powershell
cd Backend
docker-compose down
```

### Remove Extension:
1. Go to `chrome://extensions/`
2. Click "Remove" on the extension card

---

## 🔄 Quick Commands Reference

### Backend:
```powershell
# Start
cd Backend
docker-compose up -d

# Stop
docker-compose down

# View logs
docker-compose logs -f

# Restart
docker-compose restart

# Rebuild
docker-compose build --no-cache
docker-compose up -d
```

### Extension:
```powershell
# Build
cd Frontend
npm run build

# Watch mode (auto-rebuild on changes)
npm run dev
```

---

## ✅ Success Checklist

- [ ] Docker container is running (`docker ps` shows container)
- [ ] Backend responds at http://localhost:5000/drive/status
- [ ] Extension is loaded in Chrome (`chrome://extensions/`)
- [ ] Extension icon appears in Chrome toolbar
- [ ] Can detect YouTube URL from video page
- [ ] Can extract audio successfully
- [ ] MP3 file downloads correctly

---

## 📝 Notes

- **Backend runs in Docker** - isolated environment, includes all dependencies
- **Extension connects to** `http://localhost:5000`
- **Files are saved to** `Backend/downloads` (if not using Google Drive)
- **Logs are in** `Backend/logs` directory
- **After code changes**, rebuild extension: `cd Frontend && npm run build`

---

## 🆘 Still Having Issues?

1. Check all logs: `docker-compose logs`
2. Verify Docker is running: `docker ps`
3. Check Chrome console: `F12` → Console tab
4. Verify port 5000 is not blocked by firewall
5. Try restarting Docker Desktop

