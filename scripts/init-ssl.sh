#!/bin/bash
set -e

echo "=== SSL Certificate Initialization ==="
echo ""

# Check for required files
if [ ! -f "docker-compose.ssl.yml" ]; then
    echo "Error: docker-compose.ssl.yml not found"
    exit 1
fi

if [ ! -f "nginx/nginx.http-only.conf" ]; then
    echo "Error: nginx/nginx.http-only.conf not found"
    exit 1
fi

# Create required directories
mkdir -p nginx/ssl nginx/certbot-www

# Stop any existing temp nginx
docker stop nginx-temp 2>/dev/null || true
docker rm nginx-temp 2>/dev/null || true

echo "Starting temporary nginx for ACME challenge..."
docker run -d --name nginx-temp \
  -p 80:80 \
  -v "$(pwd)/nginx/certbot-www:/var/www/certbot:ro" \
  -v "$(pwd)/nginx/nginx.http-only.conf:/etc/nginx/nginx.conf:ro" \
  nginx:1.25-alpine

echo "Waiting for nginx to start..."
sleep 3

echo "Running certbot..."
docker compose -f docker-compose.ssl.yml --profile ssl-init up certbot

echo "Stopping temporary nginx..."
docker stop nginx-temp && docker rm nginx-temp

echo ""
echo "=== SSL certificates initialized successfully! ==="
echo "Certificates are in: ./nginx/ssl/"
