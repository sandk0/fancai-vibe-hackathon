#!/bin/bash
# Скрипт для быстрой проверки Cache-Control headers
# Usage: ./VERIFY_CACHE_CONTROL.sh [base_url] [token]

set -e

BASE_URL="${1:-http://localhost:8000}"
TOKEN="${2:-}"

# Colors для output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Проверка Cache-Control headers для BookReader AI"
echo "Base URL: $BASE_URL"
echo ""

# Helper function для проверки header
check_header() {
    local endpoint="$1"
    local expected="$2"
    local auth_required="${3:-false}"
    local method="${4:-GET}"

    echo -n "Testing $method $endpoint ... "

    if [ "$auth_required" = "true" ]; then
        if [ -z "$TOKEN" ]; then
            echo -e "${YELLOW}SKIPPED${NC} (no token provided)"
            return
        fi
        RESPONSE=$(curl -s -I -X "$method" "$BASE_URL$endpoint" -H "Authorization: Bearer $TOKEN")
    else
        RESPONSE=$(curl -s -I -X "$method" "$BASE_URL$endpoint")
    fi

    CACHE_CONTROL=$(echo "$RESPONSE" | grep -i "cache-control" | cut -d' ' -f2- | tr -d '\r')

    if echo "$CACHE_CONTROL" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASS${NC}"
        echo "  Cache-Control: $CACHE_CONTROL"
    else
        echo -e "${RED}✗ FAIL${NC}"
        echo "  Expected: $expected"
        echo "  Got: $CACHE_CONTROL"
    fi
    echo ""
}

echo "=== User-Specific Endpoints ==="
echo "Expected: private, no-cache, must-revalidate"
echo ""
check_header "/api/v1/books" "private" true
check_header "/api/v1/users/me" "private" true

echo "=== Admin Endpoints ==="
echo "Expected: no-store, no-cache, must-revalidate, private"
echo ""
check_header "/api/v1/admin/stats" "no-store" true

echo "=== Auth Endpoints ==="
echo "Expected: no-store, no-cache, must-revalidate, private"
echo ""
check_header "/api/v1/auth/login" "no-store" false "POST"

echo "=== File Serving ==="
echo "Expected: public, max-age=31536000, immutable"
echo ""
check_header "/api/v1/images/file/test.png" "immutable" false

echo "=== Public Endpoints ==="
echo "Expected: public, max-age=3600"
echo ""
check_header "/health" "public" false
check_header "/api/v1/info" "public" false

echo "=== POST Requests (should never cache) ==="
echo "Expected: no-store, no-cache"
echo ""
check_header "/api/v1/books" "no-store" true "POST"

echo ""
echo "✅ Verification complete!"
echo ""
echo "Примечания:"
echo "- SKIPPED endpoints требуют authentication token"
echo "- Запустите с токеном: ./VERIFY_CACHE_CONTROL.sh http://localhost:8000 YOUR_TOKEN"
echo "- Для production: ./VERIFY_CACHE_CONTROL.sh https://fancai.ru YOUR_TOKEN"
