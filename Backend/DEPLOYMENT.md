# 🚀 Deployment Guide - Audio Extractor Backend

Complete guide to deploy the Docker container to various platforms.

## 📋 Pre-Deployment Checklist

- [ ] Docker image builds successfully
- [ ] All environment variables configured
- [ ] Google OAuth redirect URI updated for production domain
- [ ] Security considerations reviewed
- [ ] Domain/URL for deployment ready

---

## 🌐 Deployment Options

### Option 1: Deploy to Your Own Server/VPS

#### Prerequisites
- Server with Docker installed
- Domain name (optional, can use IP)
- Port 5000 (or custom port) open in firewall

#### Steps

1. **Transfer files to server:**
   ```bash
   # On your local machine
   scp -r Backend user@your-server-ip:/path/to/deployment/
   ```

2. **SSH into your server:**
   ```bash
   ssh user@your-server-ip
   ```

3. **Navigate to Backend directory:**
   ```bash
   cd /path/to/deployment/Backend
   ```

4. **Create/Update `.env` file with production values:**
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_DRIVE_FOLDER_ID=your_folder_id
   GOOGLE_REDIRECT_URI=https://your-domain.com/oauth2callback
   NODE_ENV=production
   PORT=5000
   ```

5. **Update Google Cloud Console:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Add authorized redirect URI: `https://your-domain.com/oauth2callback`
   - Save changes

6. **Build and start:**
   ```bash
   docker-compose up -d --build
   ```

7. **Check status:**
   ```bash
   docker-compose ps
   docker-compose logs -f
   ```

8. **Test:**
   ```bash
   curl https://your-domain.com/drive/status
   ```

#### Using Nginx Reverse Proxy (Recommended)

Create `/etc/nginx/sites-available/audio-extractor`:

```nginx
server {
    listen 80;
    server_name your-domain.com;

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

Enable and restart:
```bash
sudo ln -s /etc/nginx/sites-available/audio-extractor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Option 2: Deploy to Docker Hub & Pull Anywhere

#### Build and Push to Docker Hub

1. **Build the image:**
   ```bash
   cd Backend
   docker build -t your-dockerhub-username/audio-extractor-backend:latest .
   ```

2. **Login to Docker Hub:**
   ```bash
   docker login
   ```

3. **Push the image:**
   ```bash
   docker push your-dockerhub-username/audio-extractor-backend:latest
   ```

#### Deploy on Any Server

1. **Pull and run:**
   ```bash
   docker run -d \
     --name audio-extractor-backend \
     -p 5000:5000 \
     -e GOOGLE_CLIENT_ID=your_client_id \
     -e GOOGLE_CLIENT_SECRET=your_client_secret \
     -e GOOGLE_DRIVE_FOLDER_ID=your_folder_id \
     -e GOOGLE_REDIRECT_URI=https://your-domain.com/oauth2callback \
     -v $(pwd)/downloads:/app/downloads \
     -v $(pwd)/token.json:/app/dist/token.json \
     -v $(pwd)/logs:/app/logs \
     your-dockerhub-username/audio-extractor-backend:latest
   ```

---

### Option 3: Deploy to Cloud Platforms

#### AWS EC2 / Lightsail

1. **Launch EC2 instance** (Ubuntu recommended)
2. **Install Docker:**
   ```bash
   sudo apt update
   sudo apt install docker.io docker-compose -y
   sudo systemctl start docker
   sudo systemctl enable docker
   ```

3. **Follow "Deploy to Your Own Server" steps above**

4. **Configure Security Group:**
   - Open port 5000 (or 80/443 if using Nginx)
   - Allow HTTP/HTTPS traffic

#### Google Cloud Platform (GCP)

1. **Create Compute Engine instance**
2. **Install Docker:**
   ```bash
   curl -fsSL https://get.docker.com -o get-docker.sh
   sudo sh get-docker.sh
   ```

3. **Deploy using docker-compose** (same as server deployment)

#### DigitalOcean Droplet

1. **Create Droplet** (Ubuntu, Docker on Ubuntu image)
2. **SSH into droplet**
3. **Clone or upload your Backend folder**
4. **Deploy:**
   ```bash
   cd Backend
   docker-compose up -d
   ```

#### Railway.app

1. **Connect your GitHub repository**
2. **Add environment variables** in Railway dashboard
3. **Set build command:** `docker build -t app .`
4. **Set start command:** `docker run app`
5. **Deploy!**

#### Render.com

1. **Create new Web Service**
2. **Connect repository**
3. **Build command:** `cd Backend && docker build -t app .`
4. **Start command:** `docker run -p $PORT:5000 app`
5. **Add environment variables**
6. **Deploy**

---

## 🔧 Production Configuration

### Update docker-compose.yml for Production

Create `docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  backend:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: audio-extractor-backend
    ports:
      - "0.0.0.0:5000:5000"  # Bind to all interfaces
    environment:
      - NODE_ENV=production
      - PORT=5000
      - LOG_CONSOLE=true
      - GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
      - GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
      - GOOGLE_DRIVE_FOLDER_ID=${GOOGLE_DRIVE_FOLDER_ID}
      - GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
      - GOOGLE_REFRESH_TOKEN=${GOOGLE_REFRESH_TOKEN}
    volumes:
      - ./downloads:/app/downloads
      - ./token.json:/app/dist/token.json
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:5000/drive/status', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s
```

Deploy with:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

---

## 🔐 Security Considerations

### 1. Use HTTPS (Required for Production)

- **Let's Encrypt SSL Certificate:**
  ```bash
  sudo apt install certbot python3-certbot-nginx
  sudo certbot --nginx -d your-domain.com
  ```

- **Or use Cloudflare** for free SSL

### 2. Environment Variables

- **Never commit `.env` file** to version control
- Use **Docker secrets** or **environment variable management** in cloud platforms
- Rotate credentials regularly

### 3. Firewall Configuration

```bash
# Allow only necessary ports
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 4. Rate Limiting (Recommended)

Add rate limiting middleware to prevent abuse. Consider using:
- Nginx rate limiting
- Cloudflare protection
- Application-level rate limiting

### 5. Update Google OAuth Settings

- Add production redirect URI in Google Cloud Console
- Remove localhost redirect URIs in production
- Use HTTPS URLs only

---

## 🧪 Testing Deployment

### 1. Health Check

```bash
curl https://your-domain.com/drive/status
```

Expected response:
```json
{
  "configured": true,
  "message": "Google Drive is fully configured and ready"
}
```

### 2. Test OAuth Flow

1. Visit: `https://your-domain.com/auth/google`
2. Complete OAuth authorization
3. Verify token is saved

### 3. Test Audio Extraction

Use the Chrome extension or test API:

```bash
curl -X POST https://your-domain.com/extract \
  -H "Content-Type: application/json" \
  -d '{"youtubeUrl": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

### 4. Monitor Logs

```bash
docker-compose logs -f
# Or
docker logs -f audio-extractor-backend
```

---

## 🔄 Updating Chrome Extension for Production

Update the Chrome extension to point to your production URL:

1. **Edit `Frontend/src/popup/popup.tsx`:**
   ```typescript
   const API_URL = process.env.NODE_ENV === 'production' 
     ? 'https://your-domain.com'
     : 'http://localhost:5000';
   
   const res = await fetch(`${API_URL}/extract`, {
     // ...
   });
   ```

2. **Update `Frontend/manifest.json`:**
   ```json
   "host_permissions": [
     "https://www.youtube.com/*",
     "https://your-domain.com/*"
   ]
   ```

3. **Rebuild extension:**
   ```bash
   cd Frontend
   npm run build
   ```

---

## 📊 Monitoring & Maintenance

### View Logs

```bash
# Real-time logs
docker-compose logs -f

# Last 100 lines
docker-compose logs --tail=100

# Specific service
docker logs audio-extractor-backend
```

### Restart Service

```bash
docker-compose restart
```

### Update Deployment

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backup Important Data

```bash
# Backup token.json
cp token.json token.json.backup

# Backup downloads (if needed)
tar -czf downloads-backup.tar.gz downloads/
```

---

## 🐛 Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs

# Check container status
docker ps -a

# Restart
docker-compose restart
```

### Can't access from outside

- Check firewall rules
- Verify port binding: `0.0.0.0:5000:5000`
- Check if service is listening: `netstat -tulpn | grep 5000`

### OAuth not working

- Verify redirect URI matches exactly in Google Cloud Console
- Check logs for OAuth errors
- Ensure using HTTPS in production

### High resource usage

- Monitor with: `docker stats`
- Consider resource limits in docker-compose.yml
- Clean up old downloads regularly

---

## 📝 Quick Deploy Script

Create `deploy.sh`:

```bash
#!/bin/bash

echo "🚀 Deploying Audio Extractor Backend..."

# Pull latest code (if using git)
# git pull

# Stop existing containers
docker-compose down

# Build new image
docker-compose build --no-cache

# Start containers
docker-compose up -d

# Show logs
docker-compose logs -f --tail=50

echo "✅ Deployment complete!"
```

Make executable:
```bash
chmod +x deploy.sh
./deploy.sh
```

---

## ✅ Deployment Checklist

- [ ] Server/Domain ready
- [ ] Docker installed
- [ ] Environment variables configured
- [ ] Google OAuth redirect URI updated
- [ ] Firewall configured
- [ ] SSL certificate installed (HTTPS)
- [ ] Container running
- [ ] Health check passing
- [ ] OAuth flow working
- [ ] Extension updated with production URL
- [ ] Monitoring set up
- [ ] Backups configured

---

## 🎉 You're Deployed!

Your backend is now accessible at: `https://your-domain.com`

Test it:
- Health: `https://your-domain.com/drive/status`
- OAuth: `https://your-domain.com/auth/google`
- Extract: `POST https://your-domain.com/extract`

