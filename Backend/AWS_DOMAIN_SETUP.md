# 🌐 Domain Setup for AWS EC2 (Google OAuth Requirement)

Google OAuth **requires a domain name**, not an IP address. Here are your options for AWS EC2.

## 🎯 Quick Solutions

### Option 1: Free Domain (Best for Testing) ⭐

#### Using Freenom (Free .tk, .ml, .ga domains)

1. **Go to:** https://www.freenom.com
2. **Search for domain** (e.g., `audio-extractor`)
3. **Select free domain** (`.tk`, `.ml`, `.ga`, etc.)
4. **Complete registration** (free)

5. **Point to Your Elastic IP:**
   - Go to: Manage Domain → Management Tools → Nameservers
   - Use Freenom's nameservers
   - Go to: Management Tools → DNS Management
   - Add A Record:
     - **Name:** `@` or leave blank
     - **Type:** A
     - **TTL:** 3600
     - **Target:** Your Elastic IP (e.g., `54.123.45.67`)

6. **Wait for DNS propagation** (5-30 minutes)

7. **Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://yourdomain.tk/oauth2callback
   ```

8. **Update Google OAuth:**
   - Add: `https://yourdomain.tk/oauth2callback`

#### Using DuckDNS (Free Subdomain)

1. **Go to:** https://www.duckdns.org
2. **Sign up** (free)
3. **Create subdomain:** `yourname.duckdns.org`
4. **Update IP:** Enter your Elastic IP
5. **Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://yourname.duckdns.org/oauth2callback
   ```

### Option 2: AWS Route 53 (Production) 💼

1. **Go to:** AWS Console → Route 53
2. **Register Domain:**
   - Click "Register domain"
   - Search for available domain
   - Complete registration (~$12-15/year)

3. **Create Hosted Zone:**
   - Route 53 → Hosted zones → Create
   - Domain: `yourdomain.com`

4. **Create A Record:**
   - Click "Create record"
   - **Record name:** `@` (root) or `backend` (subdomain)
   - **Record type:** A
   - **Value:** Your Elastic IP
   - **TTL:** 300
   - Create

5. **Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth2callback
   # OR for subdomain:
   # GOOGLE_REDIRECT_URI=https://backend.yourdomain.com/oauth2callback
   ```

### Option 3: Use Existing Domain

If you already own a domain:

1. **Go to your domain registrar** (GoDaddy, Namecheap, etc.)
2. **DNS Settings → Add A Record:**
   - **Host:** `backend` or `@`
   - **Type:** A
   - **Value:** Your Elastic IP
   - **TTL:** 3600

3. **Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://backend.yourdomain.com/oauth2callback
   ```

### Option 4: ngrok (Temporary Testing) ⚠️

**Only for quick testing before domain setup:**

1. **Install on EC2:**
   ```bash
   wget https://bin.equinox.io/c/bNyj1mQVY4c/ngrok-v3-stable-linux-amd64.tgz
   tar xvzf ngrok-v3-stable-linux-amd64.tgz
   sudo mv ngrok /usr/local/bin/
   ```

2. **Start ngrok:**
   ```bash
   ngrok http 5000
   # Keep this terminal open!
   ```

3. **Copy the HTTPS URL** (e.g., `https://abc123.ngrok-free.dev`)

4. **Update `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://abc123.ngrok-free.dev/oauth2callback
   ```

5. **Update Google OAuth** with ngrok URL

**Note:** ngrok URLs change on restart. Use only for testing!

## 🔐 Set Up HTTPS (Required)

Once you have a domain, set up HTTPS:

### Install Nginx & Certbot

```bash
# On EC2
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx -y
```

### Configure Nginx

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

### Enable Site

```bash
sudo ln -s /etc/nginx/sites-available/audio-extractor /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Get SSL Certificate

```bash
sudo certbot --nginx -d yourdomain.com
```

Follow prompts. Certbot will:
- Get SSL certificate
- Configure Nginx for HTTPS
- Set up auto-renewal

### Update Security Group

Add HTTPS rule:
- **Type:** HTTPS
- **Port:** 443
- **Source:** 0.0.0.0/0

## ✅ Final Configuration

### Update .env.prod

```env
GOOGLE_REDIRECT_URI=https://yourdomain.com/oauth2callback
```

### Update Google OAuth

1. **Google Cloud Console → Credentials**
2. **Add redirect URI:** `https://yourdomain.com/oauth2callback`
3. **Save**

### Restart Container

```bash
docker-compose -f docker-compose.prod.yml restart
```

## 🧪 Test

1. **Test domain:**
   ```bash
   curl https://yourdomain.com/drive/status
   ```

2. **Test OAuth:**
   - Visit: `https://yourdomain.com/auth/google`
   - Should redirect to Google OAuth
   - After authorization, redirects back to your domain

## 📝 DNS Propagation

After setting up DNS:
- **Wait 5-30 minutes** for DNS to propagate
- **Check DNS:** Use `nslookup yourdomain.com` or https://dnschecker.org
- **Verify:** Should resolve to your Elastic IP

## 🐛 Troubleshooting

### Domain Not Resolving

- Check DNS records are correct
- Wait for propagation (can take up to 48 hours)
- Verify A record points to correct IP

### HTTPS Not Working

- Check Nginx is running: `sudo systemctl status nginx`
- Check certbot certificate: `sudo certbot certificates`
- Verify security group allows port 443

### OAuth Still Fails

- Verify redirect URI in Google Console **exactly matches** `.env.prod`
- Check domain is using HTTPS (not HTTP)
- Ensure domain is accessible: `curl https://yourdomain.com`

## 💡 Recommendations

**For Testing:**
- Use **Freenom** (free domain) or **DuckDNS** (free subdomain)

**For Production:**
- Use **AWS Route 53** or your existing domain
- Set up HTTPS with Let's Encrypt
- Use a proper domain name (.com, .net, etc.)

## ✅ Checklist

- [ ] Domain registered/configured
- [ ] DNS A record points to Elastic IP
- [ ] DNS propagated (verified with nslookup)
- [ ] Nginx installed and configured
- [ ] SSL certificate obtained (Let's Encrypt)
- [ ] HTTPS working (test in browser)
- [ ] `.env.prod` updated with domain URL
- [ ] Google OAuth redirect URI updated
- [ ] Container restarted
- [ ] OAuth flow tested and working

