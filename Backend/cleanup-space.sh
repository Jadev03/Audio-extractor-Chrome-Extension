#!/bin/bash

# Emergency disk space cleanup script
# Run this when you get "No space left on device" error

echo "🧹 Starting disk cleanup..."

# Stop containers
echo "🛑 Stopping containers..."
cd ~/Audio-extractor-Chrome-Extension/Backend
docker-compose -f docker-compose.prod.yml down || true

# Remove stopped containers
echo "🗑️ Removing stopped containers..."
docker container prune -f

# Remove unused images (frees most space!)
echo "🗑️ Removing unused Docker images..."
docker image prune -a -f

# Remove unused volumes
echo "🗑️ Removing unused volumes..."
docker volume prune -f

# Remove build cache
echo "🗑️ Removing build cache..."
docker builder prune -a -f

# Clean apt cache
echo "🧹 Cleaning apt cache..."
sudo apt-get clean
sudo apt-get autoclean

# Show disk space
echo ""
echo "📊 Current disk space:"
df -h

echo ""
echo "📊 Docker disk usage:"
docker system df

echo ""
echo "✅ Cleanup complete!"

