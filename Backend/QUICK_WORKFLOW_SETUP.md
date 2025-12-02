# ⚡ Quick GitHub Actions Setup

## 🎯 3 Steps to Enable Auto-Deployment

### Step 1: Add GitHub Secrets

Go to your GitHub repository:
**Settings → Secrets and variables → Actions → New repository secret**

#### Secret 1: `EC2_HOST`
```
Value: 13.200.189.31
```

#### Secret 2: `EC2_SSH_KEY`
Get your private key content:
```powershell
# On Windows (PowerShell)
Get-Content "C:\Users\THABENDRA\Downloads\extractor.pem"
```

Copy **everything** including:
```
-----BEGIN RSA PRIVATE KEY-----
... (all content) ...
-----END RSA PRIVATE KEY-----
```

### Step 2: Verify EC2 Setup

**On EC2, run:**
```bash
cd ~/Audio-extractor-Chrome-Extension/Backend

# Ensure these exist:
ls -la Dockerfile.fast
ls -la .env.prod
file token.json  # Should be a file, not directory
```

### Step 3: Push to Production Branch

```bash
# Commit the workflow file
git add .github/workflows/deploy-ec2.yml
git commit -m "Add auto-deployment workflow"
git push origin production
```

## ✅ Done!

Now every push to `production` branch will:
1. Build TypeScript in GitHub Actions
2. Upload `dist` folder to EC2
3. Deploy using fast Dockerfile
4. Start the container

## 🧪 Test It

1. Make a small change to `Backend/server.ts`
2. Commit and push to `production`:
   ```bash
   git add Backend/server.ts
   git commit -m "Test deployment"
   git push origin production
   ```
3. Go to **Actions** tab in GitHub
4. Watch the workflow run!

## 📊 Monitor

**View logs:**
- GitHub Actions tab → Click workflow run

**On EC2:**
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

## 🎉 Success!

Your workflow is ready for automatic deployments!

