#!/bin/bash

# SSL Initialization Script for BookReader
# This script initializes SSL certificates using Let's Encrypt

set -e

# Color output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}=== BookReader SSL Initialization ===${NC}"

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root (sudo)${NC}"
  exit 1
fi

# Configuration
DOMAIN_NAME="${1:-fancai.ru}"
SSL_EMAIL="${2:-sandk008@gmail.com}"
STAGING="${3:-0}"  # Set to 1 for testing with staging server

echo -e "${YELLOW}Domain: ${DOMAIN_NAME}${NC}"
echo -e "${YELLOW}Email: ${SSL_EMAIL}${NC}"
echo -e "${YELLOW}Staging Mode: ${STAGING}${NC}"

# Create necessary directories
echo -e "${GREEN}Creating SSL directories...${NC}"
mkdir -p ./nginx/ssl
mkdir -p ./nginx/certbot-www/.well-known/acme-challenge
chmod -R 755 ./nginx/certbot-www

# Create a test file for verification
echo "OK" > ./nginx/certbot-www/.well-known/acme-challenge/test.txt

# Export environment variables for docker-compose
export DOMAIN_NAME
export SSL_EMAIL

# Start nginx without SSL first (for HTTP-01 challenge)
echo -e "${GREEN}Starting nginx for HTTP-01 challenge...${NC}"
docker compose -f docker-compose.prod.yml up -d nginx

# Wait for nginx to start
echo -e "${YELLOW}Waiting for nginx to start...${NC}"
sleep 5

# Test if webroot is accessible
echo -e "${GREEN}Testing webroot accessibility...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://${DOMAIN_NAME}/.well-known/acme-challenge/test.txt || echo "000")
if [ "$HTTP_CODE" != "200" ]; then
  echo -e "${RED}ERROR: Webroot not accessible (HTTP ${HTTP_CODE})${NC}"
  echo -e "${YELLOW}Please check:${NC}"
  echo "1. DNS points to this server"
  echo "2. Port 80 is open"
  echo "3. Nginx is running: docker compose -f docker-compose.prod.yml ps"
  exit 1
fi
echo -e "${GREEN}Webroot accessible!${NC}"

# Build certbot command
CERTBOT_CMD="certbot certonly --webroot -w /var/www/certbot"
CERTBOT_CMD="$CERTBOT_CMD --email $SSL_EMAIL"
CERTBOT_CMD="$CERTBOT_CMD --agree-tos --no-eff-email"
CERTBOT_CMD="$CERTBOT_CMD -d $DOMAIN_NAME -d www.$DOMAIN_NAME"

# Add staging flag if needed
if [ "$STAGING" = "1" ]; then
  CERTBOT_CMD="$CERTBOT_CMD --staging"
  echo -e "${YELLOW}Using Let's Encrypt STAGING server (for testing)${NC}"
fi

# Run certbot
echo -e "${GREEN}Running certbot...${NC}"
docker run --rm \
  -v "$(pwd)/nginx/ssl:/etc/letsencrypt" \
  -v "$(pwd)/nginx/certbot-www:/var/www/certbot" \
  certbot/certbot:latest \
  $CERTBOT_CMD

# Check if certificates were created
if [ ! -f "./nginx/ssl/live/${DOMAIN_NAME}/fullchain.pem" ]; then
  echo -e "${RED}ERROR: Certificates not created!${NC}"
  exit 1
fi

echo -e "${GREEN}✓ SSL certificates obtained successfully!${NC}"

# Now restart with SSL configuration
echo -e "${GREEN}Restarting nginx with SSL...${NC}"
docker compose -f docker-compose.prod.yml down nginx
docker compose -f docker-compose.prod.yml up -d nginx

# Start certbot renewal service
echo -e "${GREEN}Starting certbot auto-renewal...${NC}"
docker compose -f docker-compose.ssl.yml --profile ssl-renew up -d certbot-renew

# Test SSL
echo -e "${GREEN}Testing SSL connection...${NC}"
sleep 3
if curl -s https://${DOMAIN_NAME} > /dev/null 2>&1; then
  echo -e "${GREEN}✓ SSL is working!${NC}"
else
  echo -e "${YELLOW}⚠ SSL test failed. Check nginx logs:${NC}"
  echo "docker compose -f docker-compose.prod.yml logs nginx"
fi

echo ""
echo -e "${GREEN}=== SSL Setup Complete! ===${NC}"
echo ""
echo -e "${YELLOW}Next steps:${NC}"
echo "1. Test your site: https://${DOMAIN_NAME}"
echo "2. Check SSL rating: https://www.ssllabs.com/ssltest/analyze.html?d=${DOMAIN_NAME}"
echo "3. Monitor renewal: docker compose -f docker-compose.ssl.yml logs certbot-renew"
echo ""
echo -e "${YELLOW}Certificate locations:${NC}"
echo "- Certificate: ./nginx/ssl/live/${DOMAIN_NAME}/fullchain.pem"
echo "- Private Key: ./nginx/ssl/live/${DOMAIN_NAME}/privkey.pem"
echo ""
echo -e "${YELLOW}Auto-renewal:${NC}"
echo "Certbot will automatically renew certificates every 12 hours"
