# 🚀 Deploy to AWS EC2 with Auto-Deploy (GitHub Actions)

Complete guide to deploy your backend to AWS EC2 with automatic deployment from GitHub.

## 📋 Prerequisites

- AWS Free Tier account
- GitHub repository with your code
- Production branch ready

## 💰 AWS Free Tier

- **t2.micro or t3.micro:** 750 hours/month free (12 months)
- **30 GB storage:** Free tier eligible
- **1 GB data transfer:** Free per month

## 🎯 Step-by-Step Deployment

### Step 1: Create EC2 Instance

1. **Go to [AWS Console](https://console.aws.amazon.com/)**
2. **Navigate to:** EC2 → Instances → Launch Instance

3. **Configure Instance:**
   - **Name:** `audio-extractor-backend`
   - **AMI:** Ubuntu Server 22.04 LTS (Free tier eligible)
   - **Instance type:** `t2.micro` (Free tier) or `t3.micro`
   - **Key pair:** Create new or use existing (download `.pem` file!)
   - **Network settings:**
     - ✅ **Allow SSH traffic** (port 22)
     - ✅ **Allow HTTP traffic** (port 80)
     - ✅ **Allow HTTPS traffic** (port 443)
     - **Add custom rule:** Port `5000`, Source `0.0.0.0/0`

4. **Storage:** 8 GB (free tier includes 30 GB)

5. **Click "Launch Instance"**

6. **Wait for instance to be running** (1-2 minutes)

### Step 2: Allocate Elastic IP (Static IP)

1. **Go to:** EC2 → Network & Security → Elastic IPs
2. **Click "Allocate Elastic IP address"**
3. **Click "Allocate"**
4. **Select the IP → Actions → Associate Elastic IP address**
5. **Select your instance → Associate**

**Note the Elastic IP** (e.g., `54.123.45.67`)

### Step 3: Set Up Security Group

1. **Go to:** EC2 → Security Groups
2. **Select your instance's security group**
3. **Inbound rules → Edit inbound rules**
4. **Add rule:**
   - **Type:** Custom TCP
   - **Port:** `5000`
   - **Source:** `0.0.0.0/0` (or restrict to your IP)
   - **Description:** Backend API
5. **Save rules**

### Step 4: Connect to EC2 Instance

#### Option A: Using AWS Console (Browser)

1. **Select instance → Connect**
2. **EC2 Instance Connect → Connect**

#### Option B: Using SSH (Local Machine)

```bash
# Windows PowerShell
ssh -i path/to/your-key.pem ubuntu@YOUR-ELASTIC-IP

# Or use AWS CLI
aws ec2-instance-connect send-ssh-public-key \
  --instance-id i-1234567890abcdef0 \
  --availability-zone us-east-1a \
  --instance-os-user ubuntu \
  --ssh-public-key file://~/.ssh/id_rsa.pub
```

### Step 5: Install Docker on EC2

Once connected via SSH:

```bash
# Update system
sudo apt update
sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add ubuntu user to docker group
sudo usermod -aG docker ubuntu

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify
docker --version
docker-compose --version

# Log out and back in
exit
```

Reconnect via SSH.

### Step 6: Clone Repository on EC2

```bash
# Install Git if needed
sudo apt install git -y

# Clone your repository
cd /home/ubuntu
git clone https://github.com/YOUR-USERNAME/YOUR-REPO.git
cd YOUR-REPO/Backend

# Switch to production branch
git checkout production
```

### Step 7: Create Production Environment File

```bash
# Create .env.prod file
nano .env.prod
```

Add your configuration:

```env
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
GOOGLE_REDIRECT_URI=https://your-domain.com/oauth2callback
# OR if using ngrok for testing:
# GOOGLE_REDIRECT_URI=https://your-ngrok-url.ngrok-free.dev/oauth2callback
NODE_ENV=production
PORT=5000
DOCKER_CONTAINER=true
```

**Important:** Google OAuth requires a domain name, not an IP address. See "Domain Setup" section below.

**Save:** `Ctrl+X`, `Y`, `Enter`

### Step 8: Set Up Domain Name (Required for Google OAuth)

**⚠️ Important:** Google OAuth **does not accept IP addresses**. You must use a domain name.

#### Option A: Use Free Domain Service (Recommended for Testing)

**1. Get a Free Domain:**
   - **Freenom** (https://www.freenom.com) - Free `.tk`, `.ml`, `.ga` domains
   - **No-IP** (https://www.noip.com) - Free dynamic DNS
   - **DuckDNS** (https://www.duckdns.org) - Free subdomain

**2. Point Domain to Your Elastic IP:**
   - Add **A Record** pointing to your Elastic IP
   - Example: `yourdomain.tk` → `54.123.45.67`

**3. Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://yourdomain.tk/oauth2callback
   ```

#### Option B: Use AWS Route 53 (Production)

**1. Register Domain in Route 53:**
   - Go to: Route 53 → Registered domains
   - Click "Register domain"
   - Choose domain (e.g., `.com`, `.net`)
   - Complete registration (~$12-15/year)

**2. Create Hosted Zone:**
   - Route 53 → Hosted zones → Create
   - Domain: `yourdomain.com`

**3. Create A Record:**
   - Type: A
   - Name: `@` or `backend`
   - Value: Your Elastic IP
   - TTL: 300

**4. Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth2callback
   ```

#### Option C: Use Existing Domain

If you already have a domain:

**1. Add A Record:**
   - In your domain registrar's DNS settings
   - Add A record: `backend.yourdomain.com` → Your Elastic IP

**2. Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://backend.yourdomain.com/oauth2callback
   ```

#### Option D: Use ngrok (Temporary Testing Only)

For quick testing before setting up a domain:

**1. Install ngrok on EC2:**
   ```bash
   # On EC2 instance
   wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
   tar xvzf ngrok-v3-stable-linux-amd64.tgz
   sudo mv ngrok /usr/local/bin/
   
   # Start ngrok (keep this running)
   ngrok http 5000
   ```

**2. Get ngrok URL** (e.g., `https://abc123.ngrok-free.dev`)

**3. Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://abc123.ngrok-free.dev/oauth2callback
   ```

**Note:** ngrok URLs change on restart. Use for testing only.

### Step 9: Set Up HTTPS (Required for Production)

Once you have a domain, set up HTTPS with Let's Encrypt:

**1. Install Certbot:**
   ```bash
   sudo apt update
   sudo apt install certbot python3-certbot-nginx nginx -y
   ```

**2. Configure Nginx:**
   ```bash
   sudo nano /etc/nginx/sites-available/audio-extractor
   ```

   Add:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

**3. Enable Site:**
   ```bash
   sudo ln -s /etc/nginx/sites-available/audio-extractor /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

**4. Get SSL Certificate:**
   ```bash
   sudo certbot --nginx -d yourdomain.com
   ```

**5. Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth2callback
   ```

### Step 10: Update Google OAuth

1. **Go to:** [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services → Credentials**
3. **Click your OAuth Client ID**
4. **Add redirect URI:** `https://yourdomain.com/oauth2callback`
   - Use your actual domain (not IP address!)
5. **Save**

### Step 9: Initial Manual Deployment

```bash
cd /home/ubuntu/YOUR-REPO/Backend

# Build and start
docker-compose -f docker-compose.prod.yml up -d --build

# Check status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### Step 10: Test Deployment

```bash
# Test locally on instance
curl http://localhost:5000/drive/status

# Test from your browser
# http://YOUR-ELASTIC-IP:5000/drive/status
```

## 🔄 Set Up Automatic Deployment (GitHub Actions)

### Step 11: Create GitHub Actions Workflow

Create `.github/workflows/deploy-ec2.yml` in your repository:

```yaml
name: Deploy to AWS EC2

on:
  push:
    branches:
      - production
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v3
      
      - name: Deploy to EC2
        uses: appleboy/ssh-action@v0.1.7
        with:
          host: ${{ secrets.EC2_HOST }}
          username: ubuntu
          key: ${{ secrets.EC2_SSH_KEY }}
          script: |
            cd /home/ubuntu/YOUR-REPO-NAME/Backend
            git pull origin production
            docker-compose -f docker-compose.prod.yml down
            docker-compose -f docker-compose.prod.yml up -d --build
            docker-compose -f docker-compose.prod.yml logs --tail=50
```

**Important:** Replace `YOUR-REPO-NAME` with your actual repository name.

### Step 12: Set Up GitHub Secrets

1. **Go to your GitHub repository**
2. **Settings → Secrets and variables → Actions**
3. **Click "New repository secret"**

Add these secrets:

#### Secret 1: EC2_HOST
- **Name:** `EC2_HOST`
- **Value:** Your Elastic IP (e.g., `54.123.45.67`)

#### Secret 2: EC2_SSH_KEY
- **Name:** `EC2_SSH_KEY`
- **Value:** Contents of your `.pem` key file
  ```bash
  # On your local machine
  cat path/to/your-key.pem
  # Copy the entire output
  ```

### Step 13: Test Auto-Deploy

1. **Make a small change** in your `production` branch
2. **Commit and push:**
   ```bash
   git add .
   git commit -m "Test auto-deploy"
   git push origin production
   ```

3. **Check GitHub Actions:**
   - Go to your repo → Actions tab
   - Watch the deployment workflow run
   - Should see "Deploy to EC2" job running

4. **Verify on EC2:**
   ```bash
   # SSH into EC2
   docker-compose -f docker-compose.prod.yml logs --tail=20
   ```

## 📁 Production-Only Files Structure

Your production branch should have:

```
Backend/
├── .env.prod              # Production environment (NOT in git)
├── docker-compose.prod.yml # Production Docker config
├── Dockerfile             # Docker build file
├── package.json           # Dependencies
├── tsconfig.json          # TypeScript config
├── *.ts                   # Source files
└── .github/
    └── workflows/
        └── deploy-ec2.yml # Auto-deploy workflow
```

## 🔒 Security Best Practices

### 1. Never Commit Secrets

Make sure `.env.prod` is in `.gitignore`:

```gitignore
.env
.env.prod
token.json
```

### 2. Use GitHub Secrets

All sensitive data should be in GitHub Secrets, not in code.

### 3. Restrict Security Group

Instead of `0.0.0.0/0`, restrict to:
- Your IP address
- Or use AWS WAF for better protection

### 4. Use IAM Roles

For better security, use IAM roles instead of access keys.

## 🔧 Advanced: Better Auto-Deploy Script

Create `deploy.sh` on EC2:

```bash
#!/bin/bash
set -e

echo "🚀 Starting deployment..."

cd /home/ubuntu/YOUR-REPO-NAME/Backend

echo "📥 Pulling latest code..."
git pull origin production

echo "🛑 Stopping containers..."
docker-compose -f docker-compose.prod.yml down

echo "🏗️ Building and starting containers..."
docker-compose -f docker-compose.prod.yml up -d --build

echo "🧹 Cleaning up old images..."
docker image prune -f

echo "✅ Deployment complete!"
docker-compose -f docker-compose.prod.yml ps
```

Make executable:
```bash
chmod +x deploy.sh
```

Update GitHub Actions to use script:
```yaml
script: |
  cd /home/ubuntu/YOUR-REPO-NAME/Backend
  git pull origin production
  ./deploy.sh
```

## 📊 Monitoring

### View Logs

```bash
# On EC2
docker-compose -f docker-compose.prod.yml logs -f

# Or specific service
docker logs audio-extractor-backend -f
```

### Check Status

```bash
docker-compose -f docker-compose.prod.yml ps
docker stats
```

### Set Up CloudWatch (Optional)

1. **Install CloudWatch agent:**
   ```bash
   wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
   sudo dpkg -i amazon-cloudwatch-agent.deb
   ```

2. **Configure monitoring** in AWS Console

## 💰 Cost Management

### Free Tier Limits

- **t2.micro:** 750 hours/month free (12 months)
- **30 GB EBS storage:** Free tier eligible
- **1 GB data transfer:** Free per month

### Estimated Cost After Free Tier

- **t2.micro:** ~$8-10/month
- **EBS (8 GB):** ~$0.80/month
- **Data transfer:** Minimal
- **Total:** ~$9-11/month

### Set Up Billing Alerts

1. **Go to:** Billing → Preferences
2. **Enable "Receive Billing Alerts"**
3. **CloudWatch → Alarms → Create alarm**
4. **Set threshold:** $10/month

## 🐛 Troubleshooting

### GitHub Actions Fails

- Check SSH key is correct in secrets
- Verify EC2 security group allows SSH from GitHub Actions IPs
- Check workflow logs in GitHub Actions tab

### Container Won't Start

```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Check Docker
docker ps -a
docker system df
```

### Can't Access from Browser

- Verify security group allows port 5000
- Check Elastic IP is associated
- Test locally on instance first

### Auto-Deploy Not Triggering

- Verify workflow file is in `.github/workflows/`
- Check branch name matches (production)
- Verify workflow file syntax is correct

## ✅ Deployment Checklist

- [ ] EC2 instance created (t2.micro)
- [ ] Elastic IP allocated and associated
- [ ] Security group configured (port 5000)
- [ ] Docker installed on EC2
- [ ] Repository cloned on EC2
- [ ] `.env.prod` created with correct values
- [ ] Google OAuth redirect URI updated
- [ ] Initial deployment successful
- [ ] GitHub Actions workflow created
- [ ] GitHub Secrets configured
- [ ] Auto-deploy tested and working
- [ ] Health endpoint accessible
- [ ] OAuth flow working

## 🎉 Success!

Your backend is now deployed on AWS EC2 with automatic deployment!

**Access URLs:**
- Health: `http://YOUR-ELASTIC-IP:5000/drive/status`
- OAuth: `http://YOUR-ELASTIC-IP:5000/auth/google`
- Extract: `POST http://YOUR-ELASTIC-IP:5000/extract`

Every push to `production` branch will automatically deploy! 🚀

