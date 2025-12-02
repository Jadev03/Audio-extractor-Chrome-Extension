#!/bin/bash
# Quick Docker cleanup script for EC2

echo "🧹 Starting Docker cleanup..."
echo ""

# Show current disk usage
echo "📊 Current disk usage:"
df -h | grep -E 'Filesystem|/dev/'
echo ""

# Show Docker disk usage
echo "📦 Docker disk usage before cleanup:"
docker system df
echo ""

# Clean up Docker
echo "🧹 Cleaning up Docker..."
docker system prune -a -f --volumes
docker builder prune -a -f

echo ""
echo "✅ Cleanup complete!"
echo ""

# Show disk usage after cleanup
echo "📊 Disk usage after cleanup:"
df -h | grep -E 'Filesystem|/dev/'
echo ""

echo "📦 Docker disk usage after cleanup:"
docker system df
echo ""

echo "🎯 Ready to build!"

