#!/bin/sh
# Nginx entrypoint with environment variable substitution
# This script processes nginx.prod.conf.template and replaces ${DOMAIN_NAME} with actual value

set -e

echo "Starting nginx with dynamic configuration..."
echo "Domain: ${DOMAIN_NAME:-localhost}"

# Check if template exists
if [ ! -f /etc/nginx/nginx.conf.template ]; then
    echo "ERROR: Template file not found at /etc/nginx/nginx.conf.template"
    exit 1
fi

# Substitute environment variables in template
# Only substitute DOMAIN_NAME to avoid accidentally replacing other $ variables
envsubst '${DOMAIN_NAME}' < /etc/nginx/nginx.conf.template > /etc/nginx/nginx.conf

# Verify nginx configuration
nginx -t

# Start nginx in foreground
exec nginx -g 'daemon off;'
