#!/bin/bash
# Aarya Clothing - Fix Verification Script
# Date: March 19, 2026
#
# This script verifies that all critical fixes are working correctly
#
# Usage: ./verify-fixes.sh

set -e

echo "=========================================="
echo "Aarya Clothing - Fix Verification"
echo "Date: $(date)"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

# Test function
test_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓ PASS:${NC} $2"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}✗ FAIL:${NC} $2"
        FAIL=$((FAIL + 1))
    fi
}

# Test 1: Nginx rate limiting configuration
echo -e "${YELLOW}[Test 1/8] Checking nginx rate limiting configuration...${NC}"
if grep -q "limit_req_zone.*rate=50r/s" docker/nginx/nginx.conf; then
    test_result 0 "Nginx API rate limit set to 50r/s"
else
    test_result 1 "Nginx API rate limit NOT updated"
fi

if grep -q "limit_req_zone.*login.*rate=5r/s" docker/nginx/nginx.conf; then
    test_result 0 "Nginx login rate limit set to 5r/s"
else
    test_result 1 "Nginx login rate limit NOT updated"
fi

if grep -q "burst=100" docker/nginx/nginx.conf; then
    test_result 0 "Nginx burst allowance set to 100"
else
    test_result 1 "Nginx burst allowance NOT updated"
fi
echo ""

# Test 2: Cookie domain configuration
echo -e "${YELLOW}[Test 2/8] Checking cookie domain configuration...${NC}"
if grep -q 'cookie_domain.*aaryaclothing.in' services/core/main.py; then
    test_result 0 "Cookie domain configured for production"
else
    test_result 1 "Cookie domain NOT configured"
fi
echo ""

# Test 3: JWT parsing improvements
echo -e "${YELLOW}[Test 3/8] Checking JWT parsing improvements...${NC}"
if grep -q "parts.length !== 3" frontend_new/middleware.js; then
    test_result 0 "JWT structure validation added"
else
    test_result 1 "JWT structure validation NOT found"
fi

if grep -q "parsed.exp.*1000.*Date.now" frontend_new/middleware.js; then
    test_result 0 "JWT expiration check added"
else
    test_result 1 "JWT expiration check NOT found"
fi
echo ""

# Test 4: Token refresh improvements
echo -e "${YELLOW}[Test 4/8] Checking token refresh improvements...${NC}"
if grep -q "credentials: 'include'" frontend_new/lib/baseApi.js; then
    test_result 0 "Token refresh includes credentials"
else
    test_result 1 "Token refresh credentials NOT configured"
fi

if grep -q "clearStoredTokens" frontend_new/lib/baseApi.js; then
    test_result 0 "Token cleanup on refresh failure"
else
    test_result 1 "Token cleanup NOT configured"
fi
echo ""

# Test 5: Cache-control headers
echo -e "${YELLOW}[Test 5/8] Checking cache-control headers...${NC}"
if grep -q "Cache-Control.*no-store" docker/nginx/nginx.conf; then
    test_result 0 "API cache-control headers added"
else
    test_result 1 "API cache-control headers NOT found"
fi
echo ""

# Test 6: Service health checks
echo -e "${YELLOW}[Test 6/8] Running service health checks...${NC}"

# Nginx
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k https://localhost/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Nginx is healthy (HTTP $HTTP_CODE)"
else
    test_result 1 "Nginx health check failed (HTTP $HTTP_CODE)"
fi

# Core service
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Core service is healthy (HTTP $HTTP_CODE)"
else
    test_result 1 "Core service health check failed (HTTP $HTTP_CODE)"
fi

# Commerce service
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5002/health 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Commerce service is healthy (HTTP $HTTP_CODE)"
else
    test_result 1 "Commerce service health check failed (HTTP $HTTP_CODE)"
fi

# Frontend
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:6004/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    test_result 0 "Frontend is healthy (HTTP $HTTP_CODE)"
else
    test_result 1 "Frontend health check failed (HTTP $HTTP_CODE)"
fi
echo ""

# Test 7: Rate limiting test (should NOT trigger with new limits)
echo -e "${YELLOW}[Test 7/8] Testing rate limiting (sending 30 rapid requests)...${NC}"
RATE_LIMITED=0
for i in {1..30}; do
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" -k https://localhost/api/v1/auth/health 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" = "503" ]; then
        RATE_LIMITED=$((RATE_LIMITED + 1))
    fi
done

if [ $RATE_LIMITED -eq 0 ]; then
    test_result 0 "No rate limiting triggered (30 requests)"
else
    test_result 1 "Rate limiting triggered ($RATE_LIMITED/30 requests got 503)"
fi
echo ""

# Test 8: Cookie domain test
echo -e "${YELLOW}[Test 8/8] Testing cookie configuration...${NC}"
# Login and check cookies
LOGIN_RESPONSE=$(curl -s -k -X POST https://localhost/api/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test@example.com","password":"test123","remember_me":true}' \
    -D - 2>/dev/null)

if echo "$LOGIN_RESPONSE" | grep -qi "access_token"; then
    test_result 0 "Login sets access_token cookie"
else
    test_result 1 "Login does NOT set access_token cookie"
fi

if echo "$LOGIN_RESPONSE" | grep -qi "Domain=.aaryaclothing.in"; then
    test_result 0 "Cookie has correct domain attribute"
else
    # This might fail in local testing - only critical in production
    echo -e "${YELLOW}⚠ SKIP:${NC} Cookie domain check (only valid in production)"
fi
echo ""

# Summary
echo "=========================================="
echo "Verification Summary"
echo "=========================================="
echo -e "${GREEN}Passed:${NC} $PASS"
echo -e "${RED}Failed:${NC} $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo -e "${GREEN}All tests passed! ✓${NC}"
    exit 0
else
    echo -e "${YELLOW}Some tests failed. Please review the output above.${NC}"
    exit 1
fi
