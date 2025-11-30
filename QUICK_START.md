# Quick Start Guide - YouTube Audio Extractor

## 🚀 Quick Setup (5 minutes)

### Step 1: Start Backend Server

```bash
cd Backend
npm install  # If not already installed
npm run dev
```

✅ Backend should be running on `http://localhost:5000`

### Step 2: Build Chrome Extension

Open a **new terminal** and run:

```bash
cd Frontend
npm install  # If not already installed
npm run build
```

✅ Extension built in `Frontend/dist` folder

### Step 3: Load Extension in Chrome

1. Open Chrome and go to: `chrome://extensions/`
2. Enable **Developer mode** (toggle in top-right corner)
3. Click **Load unpacked**
4. Navigate to: `D:\Audio-Extractor\Chrome-extension\Frontend\dist`
5. Click **Select Folder**

✅ Extension icon should appear in Chrome toolbar

## 📖 How to Use

### Method 1: From YouTube Video Page

1. **Open any YouTube video** (e.g., `https://www.youtube.com/watch?v=...`)
2. **Click the extension icon** in Chrome toolbar
3. Click **"Detect YouTube URL"** - URL will auto-fill
4. Click **"Extract Audio"** - Wait for processing
5. Click **"Download Audio"** - MP3 file downloads

### Method 2: Manual URL Entry

1. Click extension icon
2. Click **"Detect YouTube URL"** (or manually paste URL)
3. Click **"Extract Audio"**
4. Download the MP3 file

## ⚠️ Troubleshooting

### Backend not running?
```bash
cd Backend
npm run dev
```
Check: `http://localhost:5000` should be accessible

### Extension shows error?
- Check browser console: Press `F12` → Console tab
- Reload extension: `chrome://extensions/` → Click reload icon
- Make sure backend is running

### "Cannot connect to backend"?
- Verify backend is running: `http://localhost:5000`
- Check firewall settings
- Try restarting backend server

### Extension not appearing?
- Make sure you loaded `Frontend/dist` folder (not `Frontend` folder)
- Check Developer mode is enabled
- Reload the extension

## 🔄 Updating Extension

After making changes:

1. **Rebuild extension:**
   ```bash
   cd Frontend
   npm run build
   ```

2. **Reload in Chrome:**
   - Go to `chrome://extensions/`
   - Click reload icon on your extension

## 📁 Project Structure

```
Chrome-extension/
├── Backend/          # Node.js server (port 5000)
│   ├── server.ts     # Main server file
│   └── downloads/    # Extracted audio files
│
└── Frontend/         # Chrome extension
    ├── src/          # Source code
    └── dist/         # Built extension (load this in Chrome)
```

## ✅ Verification Checklist

- [ ] Backend server running on port 5000
- [ ] Extension loaded in Chrome
- [ ] Extension icon visible in toolbar
- [ ] Can open extension popup
- [ ] Can detect YouTube URL
- [ ] Can extract and download audio

## 🎯 Next Steps

1. Test with a YouTube video
2. Check `Backend/downloads/` for extracted files
3. Check `Backend/logs/` for any errors

Enjoy extracting audio from YouTube! 🎵

