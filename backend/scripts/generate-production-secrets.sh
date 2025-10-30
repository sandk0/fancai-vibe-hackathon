#!/bin/bash
# BookReader AI - Production Secrets Generator
#
# Generates cryptographically secure secrets for production deployment
# Usage: bash scripts/generate-production-secrets.sh

set -e

echo "🔐 BookReader AI - Production Secrets Generator"
echo "=================================================="
echo ""
echo "⚠️  IMPORTANT SECURITY NOTES:"
echo "   - Save these secrets in a secure location (1Password, AWS Secrets Manager, etc.)"
echo "   - DO NOT commit these secrets to git"
echo "   - Use different secrets for staging and production"
echo "   - Rotate secrets every 90 days"
echo ""
echo "=================================================="
echo ""

# Function to generate random hex string
generate_hex_secret() {
    local length=$1
    openssl rand -hex "$length"
}

# Function to generate alphanumeric password
generate_password() {
    local length=$1
    LC_ALL=C tr -dc 'A-Za-z0-9!@#$%^&*' < /dev/urandom | head -c "$length"
}

echo "🔑 SECURITY KEYS (for backend/.env.production):"
echo "-----------------------------------------------"
echo ""
echo "# Application secret key (64 chars)"
echo "SECRET_KEY=$(generate_hex_secret 32)"
echo ""
echo "# JWT secret key (64 chars)"
echo "JWT_SECRET_KEY=$(generate_hex_secret 32)"
echo ""

echo "🗄️  DATABASE CREDENTIALS:"
echo "-----------------------------------------------"
echo ""
echo "# PostgreSQL password (32 chars)"
echo "DB_PASSWORD=$(generate_hex_secret 16)"
echo ""

echo "🔴 REDIS CREDENTIALS:"
echo "-----------------------------------------------"
echo ""
echo "# Redis password (32 chars)"
echo "REDIS_PASSWORD=$(generate_hex_secret 16)"
echo ""

echo "👤 ADMIN CREDENTIALS:"
echo "-----------------------------------------------"
echo ""
echo "# Admin password (16 chars with special chars)"
echo "ADMIN_PASSWORD=$(generate_password 16)"
echo ""

echo "📊 MONITORING CREDENTIALS (Optional):"
echo "-----------------------------------------------"
echo ""
echo "# Grafana admin password (16 chars)"
echo "GRAFANA_PASSWORD=$(generate_password 16)"
echo ""

echo "=================================================="
echo ""
echo "✅ Secrets generated successfully!"
echo ""
echo "📝 NEXT STEPS:"
echo "   1. Copy backend/.env.production.example to backend/.env.production"
echo "   2. Replace all CHANGE_ME values with secrets above"
echo "   3. Save .env.production to secure location"
echo "   4. Add .env.production to .gitignore (should already be there)"
echo "   5. Deploy to production server"
echo ""
echo "🔒 SECURITY CHECKLIST:"
echo "   ✓ Secrets are 32+ characters"
echo "   ✓ Different secrets for each environment"
echo "   ✓ Secrets stored in secure vault"
echo "   ✓ .env.production NOT committed to git"
echo "   ✓ Secrets rotation schedule set (90 days)"
echo ""
echo "=================================================="
