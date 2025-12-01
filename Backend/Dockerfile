# Multi-stage build for efficient Docker image
FROM node:20-slim as builder

# Install Python and pip for yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp (--break-system-packages is safe in Docker containers)
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci

# Copy source files
COPY *.ts ./

# Build TypeScript
RUN npm run build

# Production stage
FROM node:20-slim

# Install Python, pip, and FFmpeg for yt-dlp
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

# Install yt-dlp (--break-system-packages is safe in Docker containers)
RUN pip3 install --no-cache-dir --break-system-packages yt-dlp

# Create app directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install only production dependencies
RUN npm ci --only=production

# Copy built files from builder stage
COPY --from=builder /app/dist ./dist

# Create downloads directory
RUN mkdir -p downloads

# Expose port
EXPOSE 5000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=5000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/drive/status', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start the server
CMD ["node", "dist/server.js"]

