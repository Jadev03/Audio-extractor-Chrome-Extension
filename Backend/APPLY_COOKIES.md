# 🍪 Apply Cookies to Running Container

## ✅ Quick Steps

### 1. Make sure cookies.txt is on EC2

```bash
# SSH into EC2
ssh -i "YOUR_PEM_FILE" ubuntu@13.200.189.31

# Check if file exists
cd /home/ubuntu/Audio-extractor-Chrome-Extension/Backend
ls -la cookies.txt
```

### 2. Restart Docker Container

After adding or updating cookies.txt, restart the container:

```bash
cd /home/ubuntu/Audio-extractor-Chrome-Extension/Backend
docker-compose -f docker-compose.prod.yml restart
```

Or if you need to rebuild:

```bash
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Verify Cookies are Loaded

Check the logs to see if cookies are detected:

```bash
docker-compose -f docker-compose.prod.yml logs -f | grep -i cookie
```

You should see:
```
Cookies file found, will use for authentication
```

### 4. Test Extraction

Try extracting a video. If cookies are working, you should see successful extraction without bot detection errors.

## 🔄 After Deployment

If you've just deployed new code that includes cookie support:

1. **Upload cookies.txt to EC2** (if not already there):
   ```bash
   scp -i "YOUR_PEM_FILE" cookies.txt ubuntu@13.200.189.31:/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/
   ```

2. **Restart container**:
   ```bash
   ssh -i "YOUR_PEM_FILE" ubuntu@13.200.189.31
   cd /home/ubuntu/Audio-extractor-Chrome-Extension/Backend
   docker-compose -f docker-compose.prod.yml restart
   ```

3. **Verify**:
   ```bash
   docker-compose -f docker-compose.prod.yml logs | grep -i cookie
   ```

## 📍 File Locations

- **On EC2 host**: `/home/ubuntu/Audio-extractor-Chrome-Extension/Backend/cookies.txt`
- **In Docker container**: `/app/cookies.txt` (mounted from host)

## ⚠️ Important Notes

- The file must exist before starting/restarting the container
- If cookies.txt doesn't exist, the container will still start (it just won't use cookies)
- After updating cookies.txt, restart the container to pick up changes
- Cookies expire after a few weeks - re-export and restart when needed

