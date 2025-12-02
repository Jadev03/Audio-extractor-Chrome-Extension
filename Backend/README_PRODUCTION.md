# 🚀 Production Deployment - Quick Reference

## 📦 What's Included in Production

### Files in Git (Deployed Automatically)
- ✅ All source code (`.ts` files)
- ✅ `Dockerfile`
- ✅ `docker-compose.prod.yml`
- ✅ `package.json` and dependencies
- ✅ `.github/workflows/deploy-ec2.yml` (GitHub Actions)
- ✅ `deploy.sh` (optional deployment script)

### Files NOT in Git (Created on Server)
- ❌ `.env.prod` - Created manually on EC2
- ❌ `token.json` - Created after OAuth
- ❌ `downloads/` - Created automatically
- ❌ `logs/` - Created automatically

## 🔄 Auto-Deploy Setup

### 1. GitHub Secrets Required

**EC2_HOST:**
```
Your Elastic IP (e.g., 54.123.45.67)
```

**EC2_SSH_KEY:**
```
Full contents of your .pem file
(Include -----BEGIN and -----END lines)
```

### 2. First-Time EC2 Setup

```bash
# 1. Connect to EC2
ssh -i your-key.pem ubuntu@YOUR-ELASTIC-IP

# 2. Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# 3. Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# 4. Clone repository
cd /home/ubuntu
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO/Backend
git checkout production

# 5. Create .env.prod
nano .env.prod
# Add your environment variables

# 6. Initial deploy
docker-compose -f docker-compose.prod.yml up -d --build
```

### 3. Auto-Deploy Works

After setup, every push to `production` branch automatically:
1. Triggers GitHub Actions
2. Connects to EC2
3. Pulls latest code
4. Rebuilds containers
5. Restarts services

## 📝 Quick Commands

### Deploy Manually
```bash
# On EC2
cd /home/ubuntu/YOUR-REPO/Backend
git pull origin production
docker-compose -f docker-compose.prod.yml up -d --build
```

### View Logs
```bash
docker-compose -f docker-compose.prod.yml logs -f
```

### Restart
```bash
docker-compose -f docker-compose.prod.yml restart
```

## 🔗 Access URLs

- **Health:** `http://YOUR-ELASTIC-IP:5000/drive/status`
- **OAuth:** `http://YOUR-ELASTIC-IP:5000/auth/google`
- **Extract:** `POST http://YOUR-ELASTIC-IP:5000/extract`

## 📚 Full Guides

- **`DEPLOY_AWS_EC2.md`** - Complete deployment guide
- **`AWS_SETUP_GUIDE.md`** - Quick setup guide
- **`PRODUCTION_CHECKLIST.md`** - Pre-deployment checklist

