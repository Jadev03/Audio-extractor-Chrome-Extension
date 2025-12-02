# ⚡ Quick AWS EC2 Setup Guide

Fastest way to set up AWS EC2 for automatic deployment.

## 🎯 Quick Setup (30 minutes)

### 1. Create EC2 Instance

1. **AWS Console → EC2 → Launch Instance**
2. **Settings:**
   - **Name:** `audio-extractor-backend`
   - **AMI:** Ubuntu 22.04 LTS
   - **Instance:** `t2.micro` (Free tier)
   - **Key pair:** Create new (download `.pem` file!)
   - **Network:** Allow SSH (22), HTTP (80), HTTPS (443)
   - **Add rule:** Custom TCP, Port 5000, Source 0.0.0.0/0
3. **Launch**

### 2. Get Elastic IP

1. **EC2 → Elastic IPs → Allocate**
2. **Associate with your instance**
3. **Note the IP** (e.g., `54.123.45.67`)

### 3. Connect & Install Docker

```bash
# Connect via SSH (use your .pem file)
ssh -i your-key.pem ubuntu@YOUR-ELASTIC-IP

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

exit  # Log out and back in
```

### 4. Clone Repository

```bash
cd /home/ubuntu
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO/Backend
git checkout production
```

### 5. Set Up Domain (Required for Google OAuth)

**⚠️ Important:** Google OAuth requires a domain name, not an IP address.

**Quick Option - Free Domain:**
1. Get free domain from **Freenom** (https://www.freenom.com) - `.tk`, `.ml`, `.ga` domains
2. Point A record to your Elastic IP
3. Wait 5-30 minutes for DNS propagation

**Or use DuckDNS** (https://www.duckdns.org) for free subdomain.

See `AWS_DOMAIN_SETUP.md` for detailed domain setup instructions.

### 6. Create .env.prod

```bash
nano .env.prod
```

Paste (replace with your values):
```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth2callback
# Use your actual domain (not IP address!)
NODE_ENV=production
PORT=5000
DOCKER_CONTAINER=true
```

Save: `Ctrl+X`, `Y`, `Enter`

### 7. Set Up HTTPS (Recommended)

```bash
# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx -y

# Configure Nginx (see AWS_DOMAIN_SETUP.md for details)
# Get SSL certificate
sudo certbot --nginx -d yourdomain.com
```

### 8. Update GitHub Secrets

1. **GitHub repo → Settings → Secrets → Actions**
2. **Add secrets:**

   **EC2_HOST:**
   - Value: Your Elastic IP (e.g., `54.123.45.67`)

   **EC2_SSH_KEY:**
   - Value: Contents of your `.pem` file
   ```bash
   # On local machine
   cat your-key.pem
   # Copy entire output
   ```

### 9. Update Workflow File

Edit `.github/workflows/deploy-ec2.yml`:
- Replace `YOUR-REPO-NAME` with your actual repo name

### 10. Initial Deploy

```bash
# On EC2
cd /home/ubuntu/YOUR-REPO-NAME/Backend
docker-compose -f docker-compose.prod.yml up -d --build
```

### 11. Test Auto-Deploy

```bash
# Make a change and push
git commit --allow-empty -m "Test auto-deploy"
git push origin production
```

Check GitHub Actions tab - should deploy automatically!

## ✅ Done!

Your backend auto-deploys on every push to `production` branch!

## 📝 Important Notes

1. **Replace `YOUR-REPO-NAME`** in:
   - `.github/workflows/deploy-ec2.yml`
   - `deploy.sh`
   - EC2 commands

2. **Keep `.pem` file secure** - never commit to git!

3. **Set up domain** (required for Google OAuth - see `AWS_DOMAIN_SETUP.md`)
4. **Update Google OAuth** with your domain URL (not IP!)

4. **Test health endpoint:** `http://YOUR-ELASTIC-IP:5000/drive/status`

## 🔧 Useful Commands

```bash
# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Restart
docker-compose -f docker-compose.prod.yml restart

# Manual deploy
./deploy.sh
```

