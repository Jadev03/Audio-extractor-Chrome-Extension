# How to Monitor Chrome Extension Requests to Docker Container

This guide shows you how to verify that requests from the Chrome extension are reaching your Docker container backend.

## Method 1: Real-Time Docker Logs (Recommended)

### Watch All Logs in Real-Time

```powershell
cd Backend
docker-compose logs -f
```

This shows **all requests** as they come in, including:
- Incoming request details (method, URL, IP, user agent)
- Request completion (status code, duration)
- Audio extraction requests
- Any errors

### Watch Only Recent Logs

```powershell
docker-compose logs -f --tail=50
```

### What You'll See

When the Chrome extension makes a request, you'll see logs like:

```
backend_1  | 2025-12-01 22:45:30 [info]: Incoming request {"method":"POST","url":"/extract","ip":"172.17.0.1","userAgent":"Mozilla/5.0..."}
backend_1  | 2025-12-01 22:45:30 [info]: Audio extraction request received {"requestId":"req-...","youtubeUrl":"https://youtube.com/watch?v=...","ip":"172.17.0.1"}
backend_1  | 2025-12-01 22:45:45 [info]: Request completed {"method":"POST","url":"/extract","statusCode":200,"duration":"15000ms","ip":"172.17.0.1"}
```

## Method 2: Check Log Files

Logs are saved to files in the `Backend/logs` directory:

```powershell
# View application logs
Get-Content Backend\logs\application-*.log -Tail 50

# View in real-time (PowerShell)
Get-Content Backend\logs\application-*.log -Wait -Tail 20
```

## Method 3: Add Console Output (More Visible)

The backend already logs to console in development mode. To make it more visible in Docker:

### Option A: Check if Console Logging is Enabled

The logger automatically adds console output when `NODE_ENV != "production"`. Check your docker-compose.yml:

```yaml
environment:
  - NODE_ENV=production  # Console logging disabled
```

To enable console logging, change to:
```yaml
environment:
  - NODE_ENV=development  # Console logging enabled
```

Then restart:
```powershell
docker-compose restart
```

### Option B: View Container Console Directly

```powershell
docker attach audio-extractor-backend
```

Press `Ctrl+P, Ctrl+Q` to detach without stopping the container.

## Method 4: Test Connection Manually

### Test 1: Direct Browser Test

1. Open browser: `http://localhost:5000/drive/status`
2. Watch logs: `docker-compose logs -f`
3. You should see the GET request in logs

### Test 2: Simulate Extension Request

Use PowerShell to send a test request:

```powershell
# Test POST request (like the extension does)
$body = @{
    youtubeUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/extract" -Method POST -Body $body -ContentType "application/json"
```

Watch the logs to see the request come in!

### Test 3: Use Chrome Extension

1. **Open logs in one terminal:**
   ```powershell
   cd Backend
   docker-compose logs -f
   ```

2. **In Chrome:**
   - Go to a YouTube video
   - Click extension icon
   - Click "Detect YouTube URL"
   - Click "Extract Audio"

3. **Watch the terminal** - you'll see:
   ```
   backend_1  | [info]: Incoming request {"method":"POST","url":"/extract",...}
   backend_1  | [info]: Audio extraction request received {"requestId":"req-...","youtubeUrl":"https://..."}
   ```

## Method 5: Check Container Network

Verify the container is listening on port 5000:

```powershell
# Check if container is running
docker ps

# Check container logs
docker logs audio-extractor-backend

# Check what ports are exposed
docker port audio-extractor-backend
```

## Method 6: Add Request ID to Response (For Testing)

You can temporarily add a request ID to responses to track requests. But the current logging already includes request IDs.

## What to Look For

### ✅ Successful Connection Signs:

1. **In logs, you see:**
   - `Incoming request` with method POST and url `/extract`
   - `Audio extraction request received` with a requestId
   - User agent shows Chrome/Chromium

2. **Request details include:**
   - IP address (usually `172.17.0.1` from Docker network)
   - User-Agent header (contains "Chrome")
   - YouTube URL in the request body

3. **Response sent:**
   - `Request completed` with status 200
   - Duration shows processing time

### ❌ Connection Issues Signs:

1. **No logs appear** when clicking "Extract Audio"
   - Extension can't reach backend
   - Check: `docker ps` (container running?)
   - Check: `http://localhost:5000/drive/status` (backend accessible?)

2. **Error in logs:**
   - `Failed to fetch` or `NetworkError` in extension
   - CORS errors (shouldn't happen, CORS is enabled)
   - Connection refused errors

3. **Wrong IP address:**
   - If IP shows something other than Docker network range
   - Might indicate requests coming from outside container

## Quick Test Script

Create a test script to verify connection:

```powershell
# test-connection.ps1
Write-Host "Testing backend connection..." -ForegroundColor Yellow

# Test 1: Health check
Write-Host "`n1. Testing /drive/status..." -ForegroundColor Cyan
try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/drive/status" -Method GET
    Write-Host "✅ Backend is responding!" -ForegroundColor Green
    Write-Host "   Status: $($response.message)" -ForegroundColor Gray
} catch {
    Write-Host "❌ Backend not accessible: $_" -ForegroundColor Red
    exit 1
}

# Test 2: Extract endpoint (without actually extracting)
Write-Host "`n2. Testing /extract endpoint..." -ForegroundColor Cyan
$testBody = @{
    youtubeUrl = "https://www.youtube.com/watch?v=test"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:5000/extract" -Method POST -Body $testBody -ContentType "application/json" -ErrorAction Stop
    Write-Host "✅ Extract endpoint is accessible!" -ForegroundColor Green
} catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
        Write-Host "✅ Extract endpoint is accessible (expected error for test URL)" -ForegroundColor Green
    } else {
        Write-Host "❌ Extract endpoint error: $_" -ForegroundColor Red
    }
}

Write-Host "`n✅ All connection tests passed!" -ForegroundColor Green
Write-Host "`nNow watch logs with: docker-compose logs -f" -ForegroundColor Yellow
```

Save as `Backend/test-connection.ps1` and run:
```powershell
cd Backend
.\test-connection.ps1
```

## Real-Time Monitoring Setup

### Terminal 1: Watch Logs
```powershell
cd Backend
docker-compose logs -f
```

### Terminal 2: Use Extension
- Open Chrome
- Use the extension to extract audio
- Watch Terminal 1 for incoming requests!

## Summary

**Best way to verify extension → Docker connection:**

1. **Open logs:** `docker-compose logs -f`
2. **Use extension** to extract audio
3. **Watch for:** `Incoming request` and `Audio extraction request received` in logs
4. **Verify:** Request includes YouTube URL and Chrome user agent

If you see these logs when using the extension, **the connection is working!** ✅

