#!/bin/sh
# Docker entrypoint script for fancai Frontend
# Handles runtime configuration and nginx startup

set -e

echo "==========================================="
echo "fancai Frontend - Starting..."
echo "==========================================="

# Environment variables for runtime configuration
API_URL=${API_URL:-""}
WS_URL=${WS_URL:-""}

# Display configuration (for debugging)
if [ -n "$API_URL" ]; then
    echo "✓ API URL: $API_URL"
fi

if [ -n "$WS_URL" ]; then
    echo "✓ WebSocket URL: $WS_URL"
fi

# Optional: Replace environment variables in nginx config at runtime
# This is useful if you need to inject API_URL/WS_URL into nginx.conf
# Note: By default, this is handled at build time via Vite env vars
if [ -n "$API_URL" ] && [ -n "$WS_URL" ]; then
    echo "Configuring nginx with runtime environment variables..."

    # Example: Replace placeholders in nginx.conf if needed
    # sed -i "s|{{API_URL}}|${API_URL}|g" /etc/nginx/nginx.conf
    # sed -i "s|{{WS_URL}}|${WS_URL}|g" /etc/nginx/nginx.conf
fi

# Validate nginx configuration
echo "Validating nginx configuration..."
nginx -t

# Start nginx in foreground
echo "Starting nginx server..."
echo "==========================================="
exec nginx -g 'daemon off;'
