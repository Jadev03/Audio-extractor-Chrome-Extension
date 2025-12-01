# 📁 Environment Files Guide

Guide for managing development and production environment files.

## 📋 Environment Files

- **`.env`** - Development environment (localhost)
- **`.env.prod`** - Production testing environment (ngrok/public URL)

## 🔄 Switching Between Environments

### Development (Localhost)

Uses `docker-compose.yml` with `.env`:

```powershell
# Start development container
docker-compose up -d

# Uses: .env file
# Redirect URI: http://localhost:5000/oauth2callback
```

### Production Testing (ngrok/Public)

Uses `docker-compose.prod.yml` with `.env.prod`:

```powershell
# Start production container
docker-compose -f docker-compose.prod.yml up -d

# Uses: .env.prod file
# Redirect URI: https://unfoaming-rosalva-churchly.ngrok-free.dev/oauth2callback
```

## 📝 Current Configuration

### Development (.env)
- **Redirect URI:** `http://localhost:5000/oauth2callback`
- **Use for:** Local development and testing on same machine

### Production (.env.prod)
- **Redirect URI:** `https://unfoaming-rosalva-churchly.ngrok-free.dev/oauth2callback`
- **Use for:** Testing from other devices, production-like setup

## 🔧 Updating Environment Files

### Update Production Redirect URI

If your ngrok URL changes:

1. **Edit `.env.prod`:**
   ```env
   GOOGLE_REDIRECT_URI=https://YOUR-NEW-NGROK-URL.ngrok-free.dev/oauth2callback
   ```

2. **Update Google Cloud Console:**
   - Add new redirect URI
   - Remove old one (optional)

3. **Restart container:**
   ```powershell
   docker-compose -f docker-compose.prod.yml restart
   ```

### Update Development Settings

Edit `.env` file directly (for localhost testing).

## ✅ Google Cloud Console Setup

Make sure both redirect URIs are added:

1. **Development:** `http://localhost:5000/oauth2callback`
2. **Production:** `https://unfoaming-rosalva-churchly.ngrok-free.dev/oauth2callback`

You can have multiple redirect URIs in Google Cloud Console.

## 🚀 Quick Commands

### Start Production Testing
```powershell
# Make sure ngrok is running first!
# In another terminal: ngrok http 5000

docker-compose -f docker-compose.prod.yml up -d
docker-compose -f docker-compose.prod.yml logs -f
```

### Start Development
```powershell
docker-compose up -d
docker-compose logs -f
```

### Stop Production
```powershell
docker-compose -f docker-compose.prod.yml down
```

### Stop Development
```powershell
docker-compose down
```

## 📝 File Structure

```
Backend/
├── .env              # Development (localhost)
├── .env.prod         # Production (ngrok/public)
├── docker-compose.yml        # Development config
└── docker-compose.prod.yml   # Production config
```

## 🔐 Security Notes

- Both `.env` and `.env.prod` are in `.gitignore` (not committed)
- Never commit these files to version control
- Keep credentials secure

## 🧪 Testing Checklist

### Development Testing
- [ ] `.env` file has localhost redirect URI
- [ ] `docker-compose.yml` uses `.env`
- [ ] OAuth works on same machine
- [ ] Google Console has localhost redirect URI

### Production Testing
- [ ] `.env.prod` file has ngrok/public redirect URI
- [ ] `docker-compose.prod.yml` uses `.env.prod`
- [ ] ngrok is running
- [ ] Google Console has ngrok redirect URI
- [ ] OAuth works from phone/other devices

## 🐛 Troubleshooting

### Wrong redirect URI being used?

**Check which env file is loaded:**
```powershell
docker exec audio-extractor-backend env | findstr GOOGLE_REDIRECT_URI
```

**Verify container is using correct compose file:**
```powershell
docker-compose -f docker-compose.prod.yml ps
```

### ngrok URL changed?

1. Update `.env.prod` with new URL
2. Update Google Cloud Console
3. Restart container

### Want to use same config for both?

You can copy `.env.prod` to `.env`:
```powershell
Copy-Item .env.prod .env
```

