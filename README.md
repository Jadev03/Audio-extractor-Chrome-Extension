# YouTube Audio Extractor - Chrome Extension

A Chrome extension that extracts audio from YouTube videos, applies noise reduction, segments the audio using Voice Activity Detection (VAD), and uploads segments to Google Drive with automatic Google Sheets integration.

## Prerequisites

- **Node.js** (v20.17.0 or higher) - [Download](https://nodejs.org/)
- **Python** (3.8 or higher) - [Download](https://www.python.org/downloads/)
- **FFmpeg** - [Download](https://ffmpeg.org/download.html)
- **Google Chrome** browser
- **Google Cloud Console** account (for Google Drive and Sheets integration)

## Setup Instructions

### 1. Frontend Setup

#### Using Windows PowerShell:
```powershell
# Navigate to frontend directory
cd Frontend

# Install dependencies
npm install

# Build the extension
npm run build
```

#### Using Windows CMD:
```cmd
REM Navigate to frontend directory
cd Frontend

REM Install dependencies
npm install

REM Build the extension
npm run build
```

After building, the extension files will be in the `Frontend/dist` folder.

**Note:** You will load the extension after completing backend setup and authentication (see Step 3 below).

---

### 2. Backend Setup

#### Step 1: Navigate to Backend Directory

**Windows PowerShell:**
```powershell
cd Backend
```

**Windows CMD:**
```cmd
cd Backend
```

#### Step 2: Install Node.js Dependencies

**Windows PowerShell:**
```powershell
npm install
```

**Windows CMD:**
```cmd
npm install
```

#### Step 3: Verify Python Installation

**Windows PowerShell:**
```powershell
python --version
```

**Windows CMD:**
```cmd
python --version
```

If Python is not installed or the command is not recognized:

**Install Python on Windows:**
1. Download Python from [https://www.python.org/downloads/](https://www.python.org/downloads/)
2. During installation, **check the box** "Add Python to PATH"
3. Complete the installation
4. Restart your terminal/PowerShell
5. Verify installation:
   ```powershell
   python --version
   pip --version
   ```

**Alternative: Install via Microsoft Store (PowerShell):**
```powershell
# Search for Python in Microsoft Store and install, or use winget:
winget install Python.Python.3.12
```

#### Step 4: Install Python Modules

Install all required Python packages using pip:

**Windows PowerShell:**
```powershell
pip install -r requirements.txt
```

**Windows CMD:**
```cmd
pip install -r requirements.txt
```

**If the above command fails, install packages individually:**

**Windows PowerShell:**
```powershell
pip install librosa>=0.10.0
pip install soundfile>=0.12.0
pip install numpy>=1.24.0
pip install noisereduce>=3.0.0
pip install torch>=2.0.0
pip install torchaudio>=2.0.0
pip install yt-dlp>=2023.12.0
```

**Windows CMD:**
```cmd
pip install librosa>=0.10.0
pip install soundfile>=0.12.0
pip install numpy>=1.24.0
pip install noisereduce>=3.0.0
pip install torch>=2.0.0
pip install torchaudio>=2.0.0
pip install yt-dlp>=2023.12.0
```

**Note:** Installing `torch` and `torchaudio` may take several minutes as they are large packages.

#### Step 5: Configure Environment Variables

Create a `.env` file in the `Backend` directory (if it doesn't exist) and add the following variables:

**Create .env file:**

**Windows PowerShell:**
```powershell
# Create .env file
New-Item -Path .env -ItemType File -Force
```

**Windows CMD:**
```cmd
REM Create .env file
type nul > .env
```

**Add the following to `.env` file:**

```env
# User Number (1, 2, or 3) - Determines which Google Sheet to use
USER_NUMBER=1

# FFmpeg Configuration
# Option 1: Set the directory containing ffmpeg.exe
FFMPEG_DIR=C:\path\to\ffmpeg\bin

# Option 2: Set the full path to ffmpeg.exe (alternative to FFMPEG_DIR)
# FFMPEG_PATH=C:\path\to\ffmpeg\bin\ffmpeg.exe

# Google Drive Configuration (Optional - for uploading to Google Drive)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
GOOGLE_DRIVE_FOLDER_ID=your_google_drive_folder_id_here

# Google Sheets Configuration
# The spreadsheet ID is hardcoded in sheetsService.ts
# Make sure to enable Google Sheets API in Google Cloud Console

# Noise Reduction Configuration (Optional)
ENABLE_NOISE_REDUCTION=true
NOISE_REDUCTION_METHOD=spectral_gating
NOISE_REDUCTION_STATIONARY=false
NOISE_REDUCTION_PROP_DECREASE=0.8

# VAD (Voice Activity Detection) Configuration (Optional)
VAD_MIN_SILENCE_MS=650
VAD_MIN_SPEECH_MS=900
VAD_SENTENCE_PAUSE_MS=1100
VAD_MAX_SEGMENT_SECONDS=28
VAD_SILENCE_THRESHOLD=0.004

# Python Binary Path (Optional - defaults to "python")
# PYTHON_BIN=python

# yt-dlp Browser for Cookies (Optional - defaults to "chrome")
# YT_DLP_BROWSER=chrome
```

**Important Configuration Values:**

1. **USER_NUMBER**: Set to `1`, `2`, or `3` to determine which sheet (Sheet1, Sheet2, or Sheet3) in the Google Sheet will be used.

2. **FFMPEG_DIR**: Set to the directory containing `ffmpeg.exe`. For example:
   ```env
   FFMPEG_DIR=C:\Users\YourName\Desktop\ffmpeg\bin
   ```
   
   Or use **FFMPEG_PATH** for the full path:
   ```env
   FFMPEG_PATH=C:\Users\YourName\Desktop\ffmpeg\bin\ffmpeg.exe
   ```

3. **Google Drive Configuration**: Only required if you want to upload audio segments to Google Drive. See `Backend/GOOGLE_DRIVE_SETUP.md` for detailed setup instructions.

#### Step 6: Run the Backend Server

**Windows PowerShell:**
```powershell
npm run dev
```

**Windows CMD:**
```cmd
npm run dev
```

The backend server will start on `http://localhost:5000`.

You should see output like:
```
Backend server started on port 5000
```

#### Step 7: Google Authentication (First Time Setup)

**Important:** 
- This step is required only if you want to upload audio segments to Google Drive and write to Google Sheets.
- **Authentication is only acceptable with CSE email** (use your CSE email account for Google authentication).

1. **Open your web browser** and navigate to:
   ```
   http://localhost:5000/auth/google
   ```

2. **Copy the authUrl** from the JSON response that appears in your browser. It will look like:
   ```json
   {
     "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?..."
   }
   ```

3. **Paste the authUrl** into your browser's address bar and press Enter.

4. **Sign in to Google using your CSE email** and grant permissions for:
   - Google Drive API
   - Google Sheets API

5. **After successful authentication**, you will be redirected to a success page. You can close this window.

6. **Verify authentication** by checking:
   ```
   http://localhost:5000/drive/status
   ```
   
   You should see a response indicating that Google Drive is fully configured.

**Note:** The authentication token is saved locally in `Backend/token.json`. You only need to authenticate once unless you revoke access or the token expires.

---

### 3. Load Chrome Extension

After completing the backend setup and authentication:

1. **Open Google Chrome** browser

2. **Navigate to Extensions**:
   - Go to `chrome://extensions/`
   - Or click the three dots menu (⋮) → **More tools** → **Extensions**

3. **Enable Developer Mode**:
   - Toggle the **Developer mode** switch in the top-right corner

4. **Load the Extension**:
   - Click **Load unpacked** button
   - Navigate to and select the `Frontend/dist` folder
   - Click **Select Folder**

5. **Verify Extension is Loaded**:
   - The extension should now appear in your extensions list
   - You should see "YouTube Audio Extractor" in the list

---

### 4. Extract YouTube Video

Now you're ready to extract audio from YouTube videos:

1. **Open a YouTube video** in your browser (e.g., `https://www.youtube.com/watch?v=...`)

2. **Click the extension icon** in Chrome toolbar (top-right)

3. **Click "Detect YouTube URL"** (if needed) to auto-detect the current video URL

4. **Click "Extract Audio"** to start the extraction process

5. **Wait for processing**:
   - Audio will be downloaded from YouTube
   - Noise reduction will be applied
   - Audio will be segmented using VAD
   - Segments will be uploaded to Google Drive (if configured)
   - URLs will be written to Google Sheets (if configured)

6. **Check Google Sheets** to see the uploaded segment URLs with timestamps

---

## Project Structure

```
Chrome-extension/
├── Frontend/              # Chrome extension frontend
│   ├── src/              # Source files
│   ├── dist/             # Built extension (after npm run build)
│   └── package.json      # Frontend dependencies
├── Backend/              # Backend server
│   ├── server.ts         # Main server file
│   ├── downloads/        # Downloaded audio files
│   ├── .env              # Environment variables (create this)
│   ├── requirements.txt  # Python dependencies
│   └── package.json      # Backend dependencies
└── README.md             # This file
```

## How It Works

1. **Extract Audio**: Downloads audio from YouTube URL
2. **Convert to WAV**: Converts MP3 to WAV format (16kHz, mono)
3. **Noise Reduction**: Applies ML-based noise reduction to the audio
4. **VAD Segmentation**: Splits audio into speech segments using Voice Activity Detection
5. **Upload to Drive**: Uploads each segment to Google Drive (if configured)
6. **Write to Sheets**: Writes segment URLs, duration, and upload time to Google Sheets
7. **Cleanup**: Deletes the main unsegmented file, keeps only segmented files locally

## Troubleshooting

### Python Not Found
- Make sure Python is installed and added to PATH
- Restart your terminal after installing Python
- Try using `py` instead of `python` on Windows:
  ```powershell
  py --version
  ```

### FFmpeg Not Found
- Download FFmpeg from [https://ffmpeg.org/download.html](https://ffmpeg.org/download.html)
- Extract to a folder (e.g., `C:\ffmpeg`)
- Set `FFMPEG_DIR` in `.env` to point to the `bin` folder containing `ffmpeg.exe`

### Python Modules Installation Fails
- Make sure pip is up to date:
  ```powershell
  python -m pip install --upgrade pip
  ```
- For torch/torchaudio, you may need to install from the official PyTorch website:
  ```powershell
  pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
  ```

### Backend Server Won't Start
- Check if port 5000 is already in use
- Verify all Node.js dependencies are installed: `npm install`
- Check the `.env` file exists and has correct values
- Look for error messages in the console

### Extension Not Working
- Make sure the backend server is running on `http://localhost:5000`
- Check browser console for errors (F12 → Console tab)
- Reload the extension in `chrome://extensions/`
- Verify the extension is built: `cd Frontend && npm run build`

## Additional Resources

- **Google Drive Setup**: See `Backend/GOOGLE_DRIVE_SETUP.md` for detailed Google Drive and Sheets API setup instructions
- **Python Requirements**: See `Backend/requirements.txt` for all Python dependencies
- **Node.js Requirements**: See `Backend/package.json` for all Node.js dependencies

## License

ISC

