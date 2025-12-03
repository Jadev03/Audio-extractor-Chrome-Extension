# 🍪 Upload Cookies to EC2 via SCP

## Quick Upload Command

### Using PowerShell (Windows):

```powershell
# Replace with your actual PEM file path
scp -i "C:\Users\YOUR_USERNAME\Downloads\extractor.pem" cookies.txt ubuntu@13.200.189.31:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
```

### Using Bash/Linux/Mac:

```bash
scp -i "path/to/extractor.pem" cookies.txt ubuntu@13.200.189.31:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
```

## After Uploading

### 1. Verify File is There:

```bash
ssh -i "YOUR_PEM_FILE" ubuntu@13.200.189.31
cd /home/ubuntu/Audio-extractor-Chrome-Extension/Backend
ls -la cookies.txt
```

### 2. Set Correct Permissions:

```bash
chmod 644 cookies.txt
```

### 3. Restart Container:

```bash
docker-compose -f docker-compose.prod.yml restart
```

Or if you want a full restart:

```bash
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### 4. Verify Cookies are Loaded:

```bash
docker-compose -f docker-compose.prod.yml logs | grep -i cookie
```

You should see:
```
Cookies file found, will use for authentication
```

## 🔄 Workflow Integration

The GitHub Actions workflow will:
- ✅ Preserve cookies.txt during deployments
- ✅ Not commit cookies.txt to git (it's in .gitignore)
- ✅ Keep cookies.txt safe during git operations

**You only need to upload cookies.txt once** - the workflow will preserve it during all future deployments!

## 📝 Notes

- Cookies expire after a few weeks
- When extraction starts failing again, just re-export and re-upload
- The file is automatically mounted in Docker container
- No need to restart after every deployment (only after first upload or updates)

