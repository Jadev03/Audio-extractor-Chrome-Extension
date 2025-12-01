# 🔥 Enable Windows Firewall for Port 5000

Allow incoming connections on port 5000 so other devices can access your backend.

## Method 1: PowerShell (Run as Administrator)

1. **Right-click PowerShell** → **Run as Administrator**

2. **Run this command:**
   ```powershell
   New-NetFirewallRule -DisplayName "Audio Extractor Backend" -Direction Inbound -LocalPort 5000 -Protocol TCP -Action Allow
   ```

3. **Verify it was created:**
   ```powershell
   Get-NetFirewallRule -DisplayName "Audio Extractor Backend"
   ```

## Method 2: Windows Firewall GUI

1. **Open Windows Defender Firewall:**
   - Press `Win + R`
   - Type: `wf.msc`
   - Press Enter

2. **Click "Inbound Rules"** (left sidebar)

3. **Click "New Rule..."** (right sidebar)

4. **Rule Type:**
   - Select: **Port**
   - Click **Next**

5. **Protocol and Ports:**
   - Select: **TCP**
   - Select: **Specific local ports**
   - Enter: `5000`
   - Click **Next**

6. **Action:**
   - Select: **Allow the connection**
   - Click **Next**

7. **Profile:**
   - Check all: **Domain**, **Private**, **Public**
   - Click **Next**

8. **Name:**
   - Name: `Audio Extractor Backend`
   - Click **Finish**

## Method 3: Quick Test (Temporary)

If you just want to test quickly, you can temporarily disable Windows Firewall (NOT RECOMMENDED for production):

1. **Open Windows Defender Firewall**
2. **Turn off** firewall (temporarily)
3. **Test from another device**
4. **Turn firewall back on** after testing

---

## ✅ Verify Firewall Rule

After adding the rule, verify it works:

```powershell
# Check if rule exists
Get-NetFirewallRule -DisplayName "Audio Extractor Backend"

# Check if port is listening
netstat -ano | findstr :5000
```

---

## 🧪 Test After Enabling

1. **On another device**, open browser
2. **Navigate to:** `http://10.170.254.126:5000/drive/status`
3. **Should see JSON response**

If it still doesn't work, check:
- Both devices on same Wi-Fi network
- Router doesn't block device-to-device communication
- Container is running: `docker ps`

