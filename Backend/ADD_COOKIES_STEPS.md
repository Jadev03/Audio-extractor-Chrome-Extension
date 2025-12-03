# 🍪 Quick Guide: Adding Cookies to EC2

## Step 1: Export Cookies from Browser

### Option A: Using Browser Extension (Recommended)

1. **Install Extension:**
   - Chrome: [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) (Recommended)
   - Alternative Chrome: [Cookie-Editor](https://cookie-editor.com/)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. **Export Cookies:**
   - Go to https://www.youtube.com (make sure you're logged in!)
   - Click the extension icon
   - Select "youtube.com"
   - Click "Export" or "Download"
   - Save as `cookies.txt` on your Desktop

### Option B: Using yt-dlp (If you have it installed)

```bash
# For Chrome
yt-dlp --cookies-from-browser chrome --cookies cookies.txt https://www.youtube.com

# For Firefox  
yt-dlp --cookies-from-browser firefox --cookies cookies.txt https://www.youtube.com
```

## Step 2: Upload to EC2

### Using PowerShell (Windows):

```powershell
# Replace with your EC2 IP and PEM file path
scp -i "C:\Users\YOUR_USERNAME\Downloads\extractor.pem" cookies.txt ubuntu@13.200.189.31:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
```

### Using SSH (After uploading):

```bash
# SSH into EC2
ssh -i "C:\Users\YOUR_USERNAME\Downloads\extractor.pem" ubuntu@13.200.189.31

# Navigate to Backend directory
cd /home/ubuntu/Audio-extractor-Chrome-Extension/Backend

# Verify file is there
ls -la cookies.txt

# Set correct permissions (if needed)
chmod 644 cookies.txt
```

## Step 3: Verify It's Working

### Check Logs:

```bash
# On EC2, check if cookies are detected
docker-compose -f docker-compose.prod.yml logs | grep -i cookie
```

You should see:
```
Cookies file found, will use for authentication
```

### Test Extraction:

Try extracting a video. If cookies are working, you should see successful extraction without bot detection errors.

## Step 4: Update Docker Volume (If Needed)

If the cookies file is not being seen by Docker, you may need to restart the container:

```bash
cd /home/ubuntu/Audio-extractor-Chrome-Extension/Backend
docker-compose -f docker-compose.prod.yml restart
```

## ✅ Quick Checklist

- [ ] Logged into YouTube in browser
- [ ] Exported cookies.txt file
- [ ] Uploaded to EC2 Backend directory
- [ ] Verified file exists: `ls -la cookies.txt`
- [ ] Checked logs for "Cookies file found"
- [ ] Tested extraction

## 🔄 When to Update Cookies

- Cookies expire after a few weeks
- If extraction starts failing with bot detection again
- After changing your YouTube password
- Just re-export and replace the file - no restart needed!

## 📍 File Location

**On EC2:**
```
/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/cookies.txt
```

**In Docker container:**
```
/app/cookies.txt
```

The code automatically checks for this file and uses it if available.

