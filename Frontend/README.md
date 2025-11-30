# YouTube Audio Extractor - Chrome Extension

A Chrome extension that extracts audio from YouTube videos and downloads them as MP3 files.

## Prerequisites

1. **Node.js** (v20.17.0 or higher)
2. **Backend server** running on `http://localhost:5000`
3. **Google Chrome** browser

## Setup Instructions

### 1. Install Dependencies

```bash
cd Frontend
npm install
```

### 2. Build the Extension

```bash
npm run build
```

This will create a `dist` folder with all the extension files.

### 3. Load Extension in Chrome

1. Open Google Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right)
4. Click **Load unpacked**
5. Select the `Frontend/dist` folder
6. The extension should now appear in your extensions list

### 4. Start the Backend Server

Make sure the backend server is running:

```bash
cd ../Backend
npm run dev
```

The backend should be running on `http://localhost:5000`

## How to Use

1. **Open a YouTube video** in your browser
   - Go to any YouTube video page (e.g., `https://www.youtube.com/watch?v=...`)

2. **Click the extension icon** in Chrome toolbar
   - The extension popup will open

3. **Click "Detect YouTube URL"**
   - This will automatically detect the current YouTube video URL

4. **Click "Extract Audio"**
   - The extension will send the URL to the backend
   - Wait for the extraction to complete (you'll see "Extracting..." status)

5. **Click "Download Audio"**
   - Once extraction is complete, a download button will appear
   - Click it to download the MP3 file

## Troubleshooting

### Extension not working?

- Make sure the backend server is running on `http://localhost:5000`
- Check the browser console for errors (F12 → Console tab)
- Reload the extension in `chrome://extensions/`

### "Cannot connect to backend server" error?

- Verify backend is running: `cd Backend && npm run dev`
- Check if port 5000 is available
- Make sure no firewall is blocking localhost connections

### "Could not detect YouTube URL" error?

- Make sure you're on a YouTube video page (not playlist or channel page)
- The URL should start with `https://www.youtube.com/watch?v=`

### Build errors?

- Make sure all dependencies are installed: `npm install`
- Check Node.js version: `node --version` (should be v20.17.0+)
- Delete `node_modules` and `dist` folders, then run `npm install` again

## Development

### Watch mode (auto-rebuild on changes)

```bash
npm run dev
```

### Production build

```bash
npm run build
```

After building, reload the extension in Chrome to see changes.

## File Structure

```
Frontend/
├── src/
│   ├── popup/          # Extension popup UI
│   ├── background/     # Background service worker
│   └── content/        # Content script (runs on YouTube pages)
├── manifest.json       # Extension manifest
├── index.html          # Popup HTML
└── dist/               # Built extension (created after build)
```

## Permissions

The extension requires:
- **tabs** - To detect current YouTube URL
- **activeTab** - To access current tab information
- **scripting** - To inject content scripts
- **host_permissions** - For YouTube and localhost API access
