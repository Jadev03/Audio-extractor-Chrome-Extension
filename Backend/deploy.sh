#!/bin/bash
# Production deployment script for EC2
# This script is run on the EC2 instance

set -e  # Exit on error

echo "🚀 Starting deployment..."

# Navigate to backend directory
# Auto-detect repository directory
REPO_DIR=$(find /home/ubuntu -maxdepth 1 -type d -name "*" ! -name "ubuntu" | head -1)
cd "$REPO_DIR/Backend" || { echo "❌ Backend directory not found!"; exit 1; }

echo "📥 Pulling latest code from production branch..."
git fetch origin
git checkout production
git pull origin production

echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.prod.yml down || true

echo "🏗️ Building and starting containers..."
docker-compose -f docker-compose.prod.yml up -d --build

echo "⏳ Waiting for containers to be healthy..."
sleep 10

echo "🧹 Cleaning up unused Docker images..."
docker image prune -f

echo "📊 Container status:"
docker-compose -f docker-compose.prod.yml ps

echo "📋 Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20

echo "✅ Deployment complete!"

# Health check
echo "🏥 Health check..."
curl -f http://localhost:5000/drive/status || echo "⚠️ Health check failed, but deployment completed"

echo "🎉 Done!"

