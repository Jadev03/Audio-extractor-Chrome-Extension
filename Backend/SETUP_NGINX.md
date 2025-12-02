# 🌐 Setup Nginx Reverse Proxy for Duck DNS Domain

## 🎯 Problem

Your Duck DNS domain `audiothabe.duckdns.org` points to your EC2 IP, but:
- Backend runs on port **5000**
- OAuth redirects need standard HTTP port **80**
- Domain can't reach the backend

## ✅ Solution: Nginx Reverse Proxy

Nginx will forward requests from port 80 to your backend on port 5000.

## 🚀 Setup Steps

### Step 1: Install Nginx on EC2

**SSH into EC2 and run:**

```bash
# Update package list
sudo apt update

# Install Nginx
sudo apt install -y nginx

# Start Nginx
sudo systemctl start nginx

# Enable Nginx to start on boot
sudo systemctl enable nginx

# Check status
sudo systemctl status nginx
```

### Step 2: Configure Nginx

**Create Nginx configuration:**

```bash
sudo nano /etc/nginx/sites-available/audio-extractor
```

**Add this configuration:**

```nginx
server {
    listen 80;
    server_name audiothabe.duckdns.org;

    # Increase timeouts for long-running requests
    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;

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

**Save:** `Ctrl+X`, `Y`, `Enter`

### Step 3: Enable the Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/audio-extractor /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

### Step 4: Update Security Group

**In AWS Console:**

1. Go to **EC2 → Security Groups**
2. Select your instance's security group
3. **Inbound Rules → Edit**
4. Add rule:
   - **Type:** HTTP
   - **Port:** 80
   - **Source:** 0.0.0.0/0
5. **Save rules**

### Step 5: Update Backend Configuration

**Update `.env.prod` on EC2:**

```bash
nano ~/Audio-extractor-Chrome-Extension/Backend/.env.prod
```

**Change redirect URI:**

```env
GOOGLE_REDIRECT_URI=http://audiothabe.duckdns.org/oauth2callback
```

**Restart backend:**

```bash
cd ~/Audio-extractor-Chrome-Extension/Backend
docker-compose -f docker-compose.prod.yml restart
```

### Step 6: Update Google Cloud Console

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **APIs & Services → Credentials**
3. Click your OAuth 2.0 Client ID
4. **Authorized redirect URIs:**
   - Add: `http://audiothabe.duckdns.org/oauth2callback`
   - Remove old `localhost:5000` if not needed
5. **Save**

### Step 7: Test

**Test the domain:**

```bash
# From your local machine
curl http://audiothabe.duckdns.org/drive/status

# Should return JSON response
```

**Test OAuth:**

1. Visit: `http://audiothabe.duckdns.org/auth/google`
2. Should redirect to Google OAuth
3. After authentication, should redirect back to: `http://audiothabe.duckdns.org/oauth2callback`

## 🔍 Troubleshooting

### "502 Bad Gateway"

**Check:**
- Backend is running: `docker-compose -f docker-compose.prod.yml ps`
- Backend is accessible: `curl http://localhost:5000/drive/status`

**Fix:**
- Start backend if not running
- Check backend logs: `docker-compose -f docker-compose.prod.yml logs`

### "Connection refused"

**Check:**
- Nginx is running: `sudo systemctl status nginx`
- Security Group allows port 80
- Domain DNS is updated: `ping audiothabe.duckdns.org`

**Fix:**
- Start Nginx: `sudo systemctl start nginx`
- Check Nginx logs: `sudo tail -f /var/log/nginx/error.log`

### OAuth redirect still fails

**Check:**
- Redirect URI in Google Console matches exactly
- `.env.prod` has correct `GOOGLE_REDIRECT_URI`
- Backend restarted after config change

**Fix:**
- Verify redirect URI in both places
- Restart backend: `docker-compose -f docker-compose.prod.yml restart`

## ✅ Success Indicators

After setup:
- ✅ `http://audiothabe.duckdns.org/drive/status` returns JSON
- ✅ `http://audiothabe.duckdns.org/auth/google` redirects to Google
- ✅ OAuth callback works: `http://audiothabe.duckdns.org/oauth2callback`

## 🎉 Done!

Your domain is now accessible and OAuth will work!

