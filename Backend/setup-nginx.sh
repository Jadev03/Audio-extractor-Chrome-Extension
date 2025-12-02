#!/bin/bash
# Quick Nginx setup script for EC2

echo "🌐 Setting up Nginx reverse proxy..."

# Install Nginx
echo "📦 Installing Nginx..."
sudo apt update
sudo apt install -y nginx

# Create Nginx configuration
echo "📝 Creating Nginx configuration..."
sudo tee /etc/nginx/sites-available/audio-extractor > /dev/null << 'EOF'
server {
    listen 80;
    server_name audiothabe.duckdns.org;

    proxy_read_timeout 300s;
    proxy_connect_timeout 75s;
    proxy_send_timeout 300s;
    client_max_body_size 100M;

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
EOF

# Enable site
echo "🔗 Enabling site..."
sudo ln -sf /etc/nginx/sites-available/audio-extractor /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default

# Test configuration
echo "🧪 Testing Nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid!"
    echo "🔄 Reloading Nginx..."
    sudo systemctl reload nginx
    sudo systemctl enable nginx
    echo "✅ Nginx is now running!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Update EC2 Security Group to allow port 80"
    echo "2. Update .env.prod: GOOGLE_REDIRECT_URI=http://audiothabe.duckdns.org/oauth2callback"
    echo "3. Update Google Cloud Console redirect URI"
    echo "4. Restart backend: docker-compose -f docker-compose.prod.yml restart"
else
    echo "❌ Nginx configuration has errors. Please check manually."
    exit 1
fi

