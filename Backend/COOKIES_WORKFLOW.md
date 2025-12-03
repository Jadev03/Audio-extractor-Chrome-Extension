# 🍪 Cookies Workflow with GitHub Actions

## Overview

The `cookies.txt` file is kept **out of git** (in `.gitignore`) for security, but the GitHub Actions workflow will preserve it during deployments.

## 🔒 Security

- ✅ `cookies.txt` is in `.gitignore` - never committed to git
- ✅ Workflow preserves existing cookies.txt during deployments
- ✅ File is mounted read-only in Docker container
- ✅ Only you have access (via SCP/SSH)

## 📋 Complete Workflow

### Initial Setup (One Time)

1. **Export cookies from browser:**
   - Install [Get cookies.txt LOCALLY](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - Go to YouTube (logged in) → Click extension → Export
   - Save as `cookies.txt`

2. **Upload to EC2:**
   ```powershell
   scp -i "YOUR_PEM_FILE" cookies.txt ubuntu@13.200.189.31:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
   ```

3. **Set permissions:**
   ```bash
   ssh -i "YOUR_PEM_FILE" ubuntu@13.200.189.31
   cd /home/ubuntu/Audio-extractor-Chrome-Extension/Backend
   chmod 644 cookies.txt
   ```

4. **Deploy via GitHub Actions:**
   - Push to `production` branch
   - Workflow will preserve cookies.txt automatically
   - Container will mount cookies.txt automatically

### Regular Deployments

After initial setup, you don't need to do anything special:

1. **Push code to production branch**
2. **GitHub Actions deploys:**
   - ✅ Preserves existing cookies.txt
   - ✅ Updates code
   - ✅ Restarts container with cookies mounted
   - ✅ Verifies cookies are available

3. **Done!** Cookies are automatically used

### Updating Cookies

When cookies expire (every few weeks):

1. **Re-export cookies** from browser
2. **Re-upload to EC2:**
   ```powershell
   scp -i "YOUR_PEM_FILE" cookies.txt ubuntu@13.200.189.31:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
   ```
3. **Restart container:**
   ```bash
   ssh -i "YOUR_PEM_FILE" ubuntu@13.200.189.31
   cd /home/ubuntu/Audio-extractor-Chrome-Extension/Backend
   docker-compose -f docker-compose.prod.yml restart
   ```

## ✅ What the Workflow Does

1. **Before git pull:** Backs up cookies.txt if it exists
2. **During git pull:** Excludes cookies.txt from cleanup
3. **After git pull:** Restores cookies.txt from backup
4. **Docker restart:** Mounts cookies.txt automatically
5. **Verification:** Checks if cookies.txt is accessible in container

## 🔍 Verification

After deployment, check logs:

```bash
docker-compose -f docker-compose.prod.yml logs | grep -i cookie
```

Should see:
```
Cookies file found, will use for authentication
```

## 📁 File Locations

- **On EC2 host:** `/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/cookies.txt`
- **In Docker container:** `/app/cookies.txt` (mounted read-only)
- **In git:** ❌ Not tracked (in .gitignore)

## 🚨 Important Notes

- **First time:** You must manually upload cookies.txt via SCP
- **After that:** Workflow preserves it automatically
- **Updates:** Re-upload and restart container when cookies expire
- **Security:** Never commit cookies.txt to git (already in .gitignore)

## 🆘 Troubleshooting

**Q: Cookies not working after deployment?**
- Check if file exists: `ls -la cookies.txt` on EC2
- Check if mounted: `docker exec audio-extractor-backend ls -la /app/cookies.txt`
- Restart container: `docker-compose -f docker-compose.prod.yml restart`

**Q: Cookies disappeared after deployment?**
- Check workflow logs for "Preserving existing cookies.txt"
- Re-upload cookies.txt if needed
- The workflow should preserve it, but if something went wrong, just re-upload

**Q: How do I know cookies are being used?**
- Check logs for "Cookies file found"
- Try extracting a video - should work without bot detection errors

