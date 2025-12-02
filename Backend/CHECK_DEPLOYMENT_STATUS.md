# 📊 How to Check Deployment Status

## 🎯 Method 1: GitHub Actions (Recommended)

### View Workflow Runs:

1. **Go to your GitHub repository**
   - Open your repo in browser
   - Click on **"Actions"** tab (top navigation)

2. **Find your workflow run**
   - You should see: **"Deploy to AWS EC2"** workflow
   - Status will show:
     - 🟡 **Yellow dot** = Running
     - ✅ **Green checkmark** = Success
     - ❌ **Red X** = Failed

3. **Click on the workflow run** to see details
   - See real-time logs
   - Check each step status
   - View any errors

### What to Look For:

**✅ Success indicators:**
- All steps show green checkmarks
- Final step: "✅ Deployment complete!"
- Health check: `200 OK`

**❌ Failure indicators:**
- Red X on any step
- Error messages in logs
- Check which step failed

## 🎯 Method 2: Check EC2 Directly

### SSH into EC2:

```bash
ssh -i "C:\Users\THABENDRA\Downloads\extractor.pem" ubuntu@13.200.189.31
```

### Check Container Status:

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Check if container is running
docker-compose -f docker-compose.prod.yml ps

# Should show:
# NAME                      STATUS
# audio-extractor-backend   Up (healthy)
```

### View Logs:

```bash
# Real-time logs
docker-compose -f docker-compose.prod.yml logs -f

# Recent logs (last 50 lines)
docker-compose -f docker-compose.prod.yml logs --tail=50
```

### Test Health Endpoint:

```bash
# From EC2
curl http://localhost:5000/drive/status

# Should return JSON with status
```

## 🎯 Method 3: Test from Browser

### Health Check:
```
http://13.200.189.31:5000/drive/status
```

**Expected response:**
```json
{
  "configured": true/false,
  "message": "...",
  "details": {...}
}
```

### OAuth Endpoint:
```
http://13.200.189.31:5000/auth/google
```

Should redirect to Google OAuth page.

## 🔍 Troubleshooting

### If Workflow Shows Failed:

1. **Click on the failed step**
2. **Read the error message**
3. **Common issues:**
   - Missing GitHub secrets → Add `EC2_HOST` and `EC2_SSH_KEY`
   - SSH connection failed → Check EC2 Security Group (allow SSH)
   - Build failed → Check TypeScript errors
   - Docker build failed → Check disk space on EC2

### If Container Not Running:

```bash
# On EC2, check:
docker-compose -f docker-compose.prod.yml ps

# If not running, check logs:
docker-compose -f docker-compose.prod.yml logs

# Restart if needed:
docker-compose -f docker-compose.prod.yml restart
```

### If Health Check Fails:

```bash
# Check if port is listening
netstat -tulpn | grep 5000

# Check container logs
docker-compose -f docker-compose.prod.yml logs --tail=50

# Check if .env.prod exists
ls -la .env.prod
```

## ✅ Success Checklist

After deployment, verify:

- [ ] GitHub Actions shows ✅ green checkmark
- [ ] Container status: `Up (healthy)`
- [ ] Health endpoint returns 200
- [ ] Logs show: "Backend server started"
- [ ] No errors in logs

## 📱 Quick Status Check

**One-liner to check everything:**

```bash
# On EC2
cd ~/Audio-extractor-Chrome-Extension/Backend && \
docker-compose -f docker-compose.prod.yml ps && \
echo "---" && \
curl -s http://localhost:5000/drive/status | head -5
```

## 🎉 Done!

Your deployment status is visible in GitHub Actions!

