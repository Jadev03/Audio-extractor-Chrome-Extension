# 🚀 GitHub Actions Setup for Production Deployment

## 📋 Overview

This workflow automatically:
1. ✅ Builds TypeScript locally (in GitHub Actions)
2. ✅ Uploads `dist` folder to EC2
3. ✅ Deploys using fast Dockerfile (no TypeScript compilation on EC2)
4. ✅ Starts the container

## 🔧 Setup Required

### 1. GitHub Secrets

Add these secrets to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

#### Required Secrets:

1. **`EC2_HOST`**
   - Value: Your EC2 public IP (e.g., `13.200.189.31`)
   - Or: Your EC2 domain name (e.g., `api.yourdomain.com`)

2. **`EC2_SSH_KEY`**
   - Value: Your EC2 private key (`.pem` file content)
   - How to get:
     ```bash
     # On Windows (PowerShell)
     Get-Content "C:\Users\THABENDRA\Downloads\extractor.pem" | Out-String
     
     # Copy the entire output including:
     # -----BEGIN RSA PRIVATE KEY-----
     # ... (all content) ...
     # -----END RSA PRIVATE KEY-----
     ```

### 2. Verify EC2 Setup

**On EC2, ensure:**
```bash
# Repository is cloned
cd ~/Audio-extractor-Chrome-Extension/Backend

# Dockerfile.fast exists
ls -la Dockerfile.fast

# .env.prod exists
ls -la .env.prod

# token.json is a file (not directory)
file token.json
# Should say: empty or ASCII text
```

### 3. EC2 Security Group

Make sure your EC2 Security Group allows:
- **Inbound SSH (Port 22)** from GitHub Actions IPs
  - Or: `0.0.0.0/0` (less secure, but works)
- **Inbound Port 5000** from your IP or `0.0.0.0/0`

## 🎯 How It Works

### Workflow Steps:

1. **Checkout code** - Gets the latest code from `production` branch
2. **Setup Node.js** - Installs Node.js 20 with npm cache
3. **Install dependencies** - Runs `npm ci` in Backend directory
4. **Build TypeScript** - Runs `npm run build` to create `dist` folder
5. **Create package** - Creates `dist.tar.gz` for upload
6. **Upload to EC2** - Uses SCP to upload `dist.tar.gz` to EC2
7. **Deploy on EC2** - SSH into EC2 and:
   - Pulls latest code
   - Extracts `dist` folder
   - Uses `Dockerfile.fast`
   - Builds and starts container

## 🚀 Triggering Deployment

### Automatic:
- **Push to `production` branch** triggers deployment

### Manual:
- Go to **Actions** tab in GitHub
- Select **"Deploy to AWS EC2"** workflow
- Click **"Run workflow"**
- Select `production` branch
- Click **"Run workflow"**

## 📊 Monitoring

### View Workflow Runs:
1. Go to **Actions** tab in GitHub
2. Click on the workflow run
3. See real-time logs

### Check Deployment Status:
**On EC2:**
```bash
cd ~/Audio-extractor-Chrome-Extension/Backend
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

## 🔍 Troubleshooting

### Build Fails in GitHub Actions

**Check:**
- Node.js version matches (should be 20)
- `package.json` has `build` script
- TypeScript compiles without errors

**Fix:**
```bash
# Test locally first
cd Backend
npm ci
npm run build
```

### Upload Fails

**Check:**
- `EC2_HOST` secret is correct
- `EC2_SSH_KEY` secret includes full key (with headers)
- EC2 Security Group allows SSH from GitHub IPs

**Fix:**
- Verify secrets in GitHub Settings
- Test SSH manually:
  ```bash
  ssh -i extractor.pem ubuntu@13.200.189.31
  ```

### Deployment Fails on EC2

**Check:**
- `Dockerfile.fast` exists on EC2
- `.env.prod` exists on EC2
- `token.json` is a file (not directory)
- Disk space available

**Fix:**
```bash
# On EC2
cd ~/Audio-extractor-Chrome-Extension/Backend
ls -la Dockerfile.fast
ls -la .env.prod
file token.json
df -h  # Check disk space
```

### Container Not Starting

**Check logs:**
```bash
docker-compose -f docker-compose.prod.yml logs
```

**Common issues:**
- Missing `.env.prod` → Create it
- `token.json` is directory → `rm -rf token.json && touch token.json`
- Port 5000 in use → Check with `netstat -tulpn | grep 5000`

## ✅ Success Indicators

After deployment, you should see:
- ✅ Workflow shows green checkmark
- ✅ Container status: `Up (healthy)`
- ✅ Health check: `200 OK`
- ✅ Logs show: `Backend server started`

## 🔄 Update Workflow

To modify the workflow:
1. Edit `.github/workflows/deploy-ec2.yml`
2. Commit and push to `production` branch
3. Workflow will run automatically

## 📝 Notes

- **Build time**: ~2-3 minutes (TypeScript build in CI)
- **Deploy time**: ~2-3 minutes (Docker build on EC2)
- **Total time**: ~5-6 minutes

- **Fast build**: Uses `Dockerfile.fast` (no TypeScript compilation on EC2)
- **Disk space**: Workflow cleans up Docker before building

## 🎉 Done!

Your workflow is ready! Push to `production` branch to deploy automatically.

