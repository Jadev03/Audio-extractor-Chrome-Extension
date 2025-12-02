# ✅ Production Deployment Checklist

## 📁 Files Needed in Production Branch

### Required Files (Must be in Git)

```
Backend/
├── .github/
│   └── workflows/
│       └── deploy-ec2.yml      # GitHub Actions workflow
├── docker-compose.prod.yml    # Production Docker config
├── Dockerfile                  # Docker build file
├── package.json                # Dependencies
├── package-lock.json          # Lock file
├── tsconfig.json              # TypeScript config
├── server.ts                  # Main server file
├── driveService.ts            # Google Drive service
├── logger.ts                  # Logging service
├── deploy.sh                  # Deployment script (optional)
└── .gitignore                 # Git ignore rules
```

### Files NOT in Git (Created on Server)

```
Backend/
├── .env.prod                  # Production environment variables
├── token.json                 # Google OAuth token
├── downloads/                 # Downloaded audio files
└── logs/                      # Application logs
```

## 🔧 Configuration Steps

### 1. Update Workflow File

Edit `.github/workflows/deploy-ec2.yml`:

**Replace:**
- `YOUR-REPO-NAME` → Your actual GitHub repository name

**Example:**
```yaml
cd /home/ubuntu/audio-extractor-backend/Backend
```

### 2. Update Deploy Script (Optional)

Edit `deploy.sh`:

**Replace:**
- `YOUR-REPO-NAME` → Your actual GitHub repository name

**Make executable on EC2:**
```bash
chmod +x deploy.sh
```

### 3. Set Up GitHub Secrets

In GitHub repository → Settings → Secrets → Actions:

1. **EC2_HOST**
   - Value: Your Elastic IP (e.g., `54.123.45.67`)

2. **EC2_SSH_KEY**
   - Value: Full contents of your `.pem` file
   ```bash
   # On local machine
   cat your-key.pem
   # Copy everything including -----BEGIN and -----END lines
   ```

### 4. Create .env.prod on EC2

After first deployment, SSH into EC2:

```bash
cd /home/ubuntu/YOUR-REPO-NAME/Backend
nano .env.prod
```

Add:
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_REDIRECT_URI=http://YOUR-ELASTIC-IP:5000/oauth2callback
NODE_ENV=production
PORT=5000
DOCKER_CONTAINER=true
```

## 🚀 Deployment Flow

1. **Push to production branch**
   ```bash
   git checkout production
   git add .
   git commit -m "Your changes"
   git push origin production
   ```

2. **GitHub Actions automatically:**
   - Triggers workflow
   - Connects to EC2 via SSH
   - Pulls latest code
   - Rebuilds and restarts containers

3. **Deployment completes** (~2-3 minutes)

## 📝 What Gets Deployed

### Included:
- ✅ All TypeScript source files
- ✅ Docker configuration
- ✅ Package dependencies (installed during build)
- ✅ GitHub Actions workflow

### NOT Included (Created on Server):
- ❌ `.env.prod` (created manually on EC2)
- ❌ `token.json` (created after OAuth)
- ❌ `downloads/` folder (created automatically)
- ❌ `logs/` folder (created automatically)

## 🔒 Security Checklist

- [ ] `.env.prod` is in `.gitignore`
- [ ] `token.json` is in `.gitignore`
- [ ] `.pem` files are in `.gitignore`
- [ ] GitHub Secrets configured (not in code)
- [ ] Security group restricts access (if possible)
- [ ] Elastic IP allocated (prevents IP changes)

## 🧪 Testing Auto-Deploy

1. **Make a small change:**
   ```bash
   # Add a comment or update README
   git commit --allow-empty -m "Test auto-deploy"
   git push origin production
   ```

2. **Check GitHub Actions:**
   - Go to repo → Actions tab
   - Watch workflow run
   - Should see "Deploy to EC2" job

3. **Verify on EC2:**
   ```bash
   ssh -i your-key.pem ubuntu@YOUR-ELASTIC-IP
   docker-compose -f docker-compose.prod.yml logs --tail=20
   ```

## 📊 Monitoring Deployment

### GitHub Actions Logs
- Repository → Actions → Latest workflow run
- See real-time deployment progress

### EC2 Logs
```bash
# SSH into EC2
docker-compose -f docker-compose.prod.yml logs -f
```

### Health Check
```bash
curl http://YOUR-ELASTIC-IP:5000/drive/status
```

## 🐛 Common Issues

### Workflow Fails: "Permission denied"
- Check SSH key in GitHub Secrets is correct
- Verify key includes BEGIN/END lines
- Ensure key has correct permissions

### Workflow Fails: "Connection timeout"
- Check EC2 security group allows SSH from GitHub Actions
- Verify Elastic IP is correct
- Check instance is running

### Container Won't Start
- Check `.env.prod` exists on EC2
- Verify all environment variables are set
- Check Docker logs: `docker-compose -f docker-compose.prod.yml logs`

## ✅ Pre-Deployment Checklist

Before pushing to production:

- [ ] All code changes tested locally
- [ ] `docker-compose.prod.yml` is correct
- [ ] `.github/workflows/deploy-ec2.yml` has correct repo name
- [ ] GitHub Secrets configured
- [ ] EC2 instance running
- [ ] `.env.prod` created on EC2
- [ ] Google OAuth redirect URI updated
- [ ] Security group allows port 5000
- [ ] Elastic IP allocated

## 🎉 Ready to Deploy!

Once checklist is complete:
1. Push to `production` branch
2. Watch GitHub Actions deploy automatically
3. Test your deployed backend!

