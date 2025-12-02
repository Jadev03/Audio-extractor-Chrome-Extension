# Docker Setup for Audio Extractor Backend

This guide explains how to run the Audio Extractor backend as a Docker container.

## Prerequisites

- Docker installed on your system ([Download Docker](https://www.docker.com/get-started))
- Docker Compose (usually included with Docker Desktop)

## Quick Start

### Option 1: Using Docker Compose (Recommended)

1. **Navigate to the Backend directory:**
   ```bash
   cd Backend
   ```

2. **Create a `.env` file** (if you haven't already) with your configuration:
   ```env
   GOOGLE_CLIENT_ID=your_client_id
   GOOGLE_CLIENT_SECRET=your_client_secret
   GOOGLE_DRIVE_FOLDER_ID=your_folder_id
   GOOGLE_REDIRECT_URI=http://localhost:5000/oauth2callback
   GOOGLE_REFRESH_TOKEN=your_refresh_token  # Optional, can be obtained via OAuth flow
   ```

3. **Build and start the container:**
   ```bash
   docker-compose up -d
   ```

4. **View logs:**
   ```bash
   docker-compose logs -f
   ```

5. **Stop the container:**
   ```bash
   docker-compose down
   ```

### Option 2: Using Docker directly

1. **Build the Docker image:**
   ```bash
   cd Backend
   docker build -t audio-extractor-backend .
   ```

2. **Run the container:**
   ```bash
   docker run -d \
     --name audio-extractor-backend \
     -p 5000:5000 \
     -e GOOGLE_CLIENT_ID=your_client_id \
     -e GOOGLE_CLIENT_SECRET=your_client_secret \
     -e GOOGLE_DRIVE_FOLDER_ID=your_folder_id \
     -v $(pwd)/downloads:/app/downloads \
     -v $(pwd)/token.json:/app/token.json \
     -v $(pwd)/logs:/app/logs \
     audio-extractor-backend
   ```

## Configuration

### Environment Variables

You can set these environment variables either in a `.env` file (for docker-compose) or as `-e` flags (for docker run):

- `GOOGLE_CLIENT_ID` - Your Google OAuth Client ID
- `GOOGLE_CLIENT_SECRET` - Your Google OAuth Client Secret
- `GOOGLE_DRIVE_FOLDER_ID` - The Google Drive folder ID where files will be uploaded
- `GOOGLE_REDIRECT_URI` - OAuth redirect URI (default: `http://localhost:5000/oauth2callback`)
- `GOOGLE_REFRESH_TOKEN` - Optional: Pre-configured refresh token
- `NODE_ENV` - Set to `production` for production use
- `PORT` - Server port (default: 5000)

### Volumes

The docker-compose.yml mounts these directories for persistence:

- `./downloads` - Downloaded audio files
- `./token.json` - Google Drive OAuth token (persists authentication)
- `./logs` - Application logs

## Accessing the Service

Once the container is running, the backend will be available at:

- **API Endpoint:** `http://localhost:5000`
- **Health Check:** `http://localhost:5000/drive/status`
- **Google OAuth:** `http://localhost:5000/auth/google`

## Google Drive Setup

1. **Check Drive status:**
   ```bash
   curl http://localhost:5000/drive/status
   ```

2. **If not configured, get the OAuth URL:**
   ```bash
   curl http://localhost:5000/auth/google
   ```

3. **Visit the returned URL in your browser** to complete OAuth flow

4. **After authorization**, the token will be saved to `token.json` (persisted via volume)

## Troubleshooting

### Container won't start

- Check logs: `docker-compose logs`
- Verify environment variables are set correctly
- Ensure port 5000 is not already in use

### FFmpeg not found

- The Docker image includes FFmpeg, so this shouldn't happen
- If you see this error, rebuild the image: `docker-compose build --no-cache`

### yt-dlp not working

- The Docker image includes Python and yt-dlp
- Check logs for specific error messages
- Try accessing the container: `docker exec -it audio-extractor-backend bash`

### Google Drive upload fails

- Verify your credentials in `.env` file
- Check that the OAuth flow was completed
- Ensure the folder ID is correct and accessible

## Building for Production

1. **Build the image:**
   ```bash
   docker build -t audio-extractor-backend:latest .
   ```

2. **Tag for registry (optional):**
   ```bash
   docker tag audio-extractor-backend:latest your-registry/audio-extractor-backend:latest
   ```

3. **Push to registry (optional):**
   ```bash
   docker push your-registry/audio-extractor-backend:latest
   ```

## Exposing to Network

To make the backend accessible to other devices on your network:

1. **Update docker-compose.yml** to bind to all interfaces:
   ```yaml
   ports:
     - "0.0.0.0:5000:5000"
   ```

2. **Or use Docker run:**
   ```bash
   docker run -d -p 0.0.0.0:5000:5000 ...
   ```

3. **Access from other devices:**
   - Replace `localhost` with your machine's IP address
   - Example: `http://192.168.1.100:5000`

## Security Notes

- Never commit `.env` files or `token.json` to version control
- Use environment variables or Docker secrets for sensitive data in production
- Consider using HTTPS in production (requires reverse proxy like nginx)
- Restrict network access as needed using Docker network policies

## Health Check

The container includes a health check that verifies the server is responding:

```bash
docker ps  # Check health status
```

The health check endpoint is: `http://localhost:5000/drive/status`


