# 🍪 How to Export YouTube Cookies to Bypass Bot Detection

## 🎯 Why Export Cookies?

YouTube is blocking automated requests with bot detection. By exporting cookies from your browser (where you're logged into YouTube), you can bypass this detection and successfully extract audio.

## ✅ Step-by-Step Guide

### Method 1: Using Browser Extension (Easiest)

1. **Install a cookie export extension:**
   - Chrome: [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc) (Recommended - open source, works offline)
   - Alternative Chrome: [Cookie-Editor](https://cookie-editor.com/) (Also supports export)
   - Firefox: [cookies.txt](https://addons.mozilla.org/en-US/firefox/addon/cookies-txt/)

2. **Export cookies:**
   - Go to YouTube and make sure you're logged in
   - Click the extension icon
   - Select "youtube.com"
   - Click "Export" or "Save"
   - Save the file as `cookies.txt`

3. **Place the file:**
   - Copy `cookies.txt` to the `Backend/` directory on your EC2 instance
   - Or upload it via SCP:
     ```bash
     scp cookies.txt ubuntu@YOUR_EC2_IP:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
     ```

### Method 2: Using yt-dlp Directly (Manual)

1. **Install yt-dlp on your local machine:**
   ```bash
   pip install yt-dlp
   ```

2. **Export cookies using yt-dlp:**
   ```bash
   yt-dlp --cookies-from-browser chrome --cookies cookies.txt https://www.youtube.com
   ```
   
   Or for Firefox:
   ```bash
   yt-dlp --cookies-from-browser firefox --cookies cookies.txt https://www.youtube.com
   ```

3. **Upload to EC2:**
   ```bash
   scp cookies.txt ubuntu@YOUR_EC2_IP:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
   ```

### Method 3: Manual Export (Advanced)

1. **Use browser developer tools:**
   - Open YouTube in your browser
   - Press F12 to open Developer Tools
   - Go to Application/Storage tab → Cookies → https://www.youtube.com
   - Copy all cookies and format them as Netscape cookie format
   - Save as `cookies.txt` in Backend directory

## 📁 File Location

Place `cookies.txt` in:
```
Backend/cookies.txt
```

On EC2, the full path is:
```
/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/cookies.txt
```

## 🔄 Updating Cookies

Cookies expire after some time. If extraction starts failing again:

1. Re-export cookies from your browser
2. Replace the old `cookies.txt` file
3. No need to restart the server - it will use the new cookies automatically

## ✅ Verify It's Working

After placing cookies.txt, try extracting a video. Check the logs:

```bash
docker-compose -f docker-compose.prod.yml logs -f | grep cookies
```

You should see:
```
Cookies file found, will use for authentication
```

## 🚨 Security Note

- **Never commit cookies.txt to git** - it's already in `.gitignore`
- Cookies contain your session - keep them private
- Only share cookies.txt with trusted people
- Regenerate cookies if you suspect they're compromised

## 💡 Tips

1. **Stay logged in:** Make sure you're logged into YouTube when exporting cookies
2. **Use a dedicated account:** Consider using a separate YouTube account for this
3. **Regular updates:** Update cookies every few weeks or when extraction fails
4. **Multiple browsers:** You can export from Chrome, Firefox, or Edge

## ❓ Troubleshooting

**Q: Cookies file not found error?**
- Make sure the file is named exactly `cookies.txt` (lowercase)
- Check the file is in the `Backend/` directory
- Verify file permissions: `chmod 644 cookies.txt`

**Q: Still getting bot detection?**
- Make sure you exported cookies while logged into YouTube
- Try re-exporting cookies
- Check that cookies.txt is in Netscape format

**Q: How do I check if cookies are being used?**
- Check the logs for "Cookies file found" message
- Look for successful extractions after adding cookies

## 📚 Additional Resources

- [yt-dlp Cookies Documentation](https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp)
- [Exporting YouTube Cookies](https://github.com/yt-dlp/yt-dlp/wiki/Extractors#exporting-youtube-cookies)


