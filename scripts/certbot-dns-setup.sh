#!/bin/bash

# Certbot DNS Challenge Setup
# Use this when domain exists but A record is not yet configured

echo "🔧 Setting up Certbot with DNS challenge..."

echo "📋 Available DNS plugins:"
echo "  - Cloudflare: python3-certbot-dns-cloudflare"
echo "  - Route53: python3-certbot-dns-route53"  
echo "  - Google: python3-certbot-dns-google"
echo "  - DigitalOcean: python3-certbot-dns-digitalocean"
echo ""

read -p "Enter your DNS provider (cloudflare/route53/google/digitalocean): " provider

case $provider in
    "cloudflare")
        echo "Installing Cloudflare plugin..."
        sudo apt install python3-certbot-dns-cloudflare -y
        
        echo "Create /etc/letsencrypt/cloudflare.ini with:"
        echo "dns_cloudflare_email = your-email@example.com"  
        echo "dns_cloudflare_api_key = your-api-key"
        echo ""
        echo "Then run:"
        echo "sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /etc/letsencrypt/cloudflare.ini -d fancai.ru -d www.fancai.ru"
        ;;
        
    "route53")
        echo "Installing Route53 plugin..."
        sudo apt install python3-certbot-dns-route53 -y
        
        echo "Configure AWS credentials, then run:"
        echo "sudo certbot certonly --dns-route53 -d fancai.ru -d www.fancai.ru"
        ;;
        
    "google")
        echo "Installing Google plugin..."
        sudo apt install python3-certbot-dns-google -y
        
        echo "Create service account JSON, then run:"
        echo "sudo certbot certonly --dns-google --dns-google-credentials /path/to/credentials.json -d fancai.ru -d www.fancai.ru"
        ;;
        
    "digitalocean")
        echo "Installing DigitalOcean plugin..."
        sudo apt install python3-certbot-dns-digitalocean -y
        
        echo "Create /etc/letsencrypt/digitalocean.ini with:"
        echo "dns_digitalocean_token = your-api-token"
        echo ""
        echo "Then run:"  
        echo "sudo certbot certonly --dns-digitalocean --dns-digitalocean-credentials /etc/letsencrypt/digitalocean.ini -d fancai.ru -d www.fancai.ru"
        ;;
        
    *)
        echo "❌ Unsupported provider. Manual DNS challenge:"
        echo "sudo certbot certonly --manual --preferred-challenges dns -d fancai.ru -d www.fancai.ru"
        echo ""
        echo "This will ask you to create TXT records manually."
        ;;
esac

echo ""
echo "📋 After getting certificate:"
echo "sudo cp /etc/letsencrypt/live/fancai.ru/fullchain.pem nginx/ssl/"
echo "sudo cp /etc/letsencrypt/live/fancai.ru/privkey.pem nginx/ssl/"  
echo "sudo cp /etc/letsencrypt/live/fancai.ru/chain.pem nginx/ssl/"
echo "sudo chown -R \$USER:\$USER nginx/ssl/"