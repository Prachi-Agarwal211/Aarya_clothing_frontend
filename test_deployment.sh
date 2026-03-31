#!/bin/bash
# Deployment Validation Script for Aarya Clothing
# Tests all key functionality after Docker rebuild

echo "=========================================="
echo "Aarya Clothing - Deployment Validation"
echo "=========================================="
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASS_COUNT=0
FAIL_COUNT=0

# Function to increment counters (avoid set -e issues)
pass_test() {
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail_test() {
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

# Function to test endpoint
test_endpoint() {
    local name="$1"
    local url="$2"
    local expected="$3"
    
    echo -n "Testing $name... "
    
    if curl -sf "$url" | grep -q "$expected"; then
        echo -e "${GREEN}✓ PASS${NC}"
        pass_test
    else
        echo -e "${RED}✗ FAIL${NC}"
        fail_test
    fi
}

# Function to test HTTP status
test_status() {
    local name="$1"
    local url="$2"
    local expected_status="$3"
    
    echo -n "Testing $name... "
    
    status=$(curl -s -o /dev/null -w "%{http_code}" "$url")
    
    if [ "$status" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (HTTP $status)"
        ((PASS_COUNT++))
    else
        echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $status)"
        ((FAIL_COUNT++))
    fi
}

echo "1. Backend Service Health Checks"
echo "--------------------------------"
test_endpoint "Core Service" "http://localhost:5001/health" "healthy"
test_endpoint "Commerce Service" "http://localhost:5002/health" "healthy"
test_endpoint "Payment Service" "http://localhost:5003/health" "healthy"
test_endpoint "Admin Service" "http://localhost:5004/health" "healthy"
echo ""

echo "2. Frontend Page Loads"
echo "----------------------"
test_status "Homepage" "http://localhost:6004" "200"
test_status "Products Page" "http://localhost:6004/products" "200"
test_status "Collections Page" "http://localhost:6004/collections" "200"
echo ""

echo "3. Performance Optimizations"
echo "----------------------------"
echo -n "Testing preconnect headers... "
if curl -sf http://localhost:6004 | grep -q "preconnect"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi

echo -n "Testing service worker registration... "
if curl -sf http://localhost:6004 | grep -q "serviceWorker"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi
echo ""

echo "4. API Timeout & Retry Logic"
echo "----------------------------"
echo -n "Testing baseApi.js fetchWithTimeout... "
if grep -q "fetchWithTimeout" frontend_new/lib/baseApi.js; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi

echo -n "Testing fetchWithRetry implementation... "
if grep -q "fetchWithRetry" frontend_new/lib/baseApi.js; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi
echo ""

echo "5. Mobile Optimizations"
echo "-----------------------"
echo -n "Testing mobile ProductCard changes... "
if grep -q "lg:hidden" frontend_new/components/common/ProductCard.jsx; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi

echo -n "Testing mobile HeroSection spacing... "
if grep -q "bottom-24" frontend_new/components/landing/HeroSection.jsx; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi

echo -n "Testing SilkBackground mobile optimization... "
if grep -q "STATIC_GRADIENT" frontend_new/components/SilkBackground.js; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi
echo ""

echo "6. Chat Widget Fixes"
echo "--------------------"
echo -n "Testing CustomerChatWidget hook order fix... "
if grep -A5 "Guard AFTER all hooks" frontend_new/components/chat/CustomerChatWidget.jsx | grep -q "return null"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi
echo ""

echo "7. Search Functionality"
echo "-----------------------"
echo -n "Testing EnhancedHeader search submit... "
if grep -q "handleSearchSubmit" frontend_new/components/landing/EnhancedHeader.jsx; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi

echo -n "Testing mobile search in header... "
if grep -A10 "Mobile Search Input" frontend_new/components/landing/EnhancedHeader.jsx | grep -q "search"; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi
echo ""

echo "8. Loading & Error States"
echo "-------------------------"
echo -n "Testing products loading.js exists... "
if [ -f "frontend_new/app/products/loading.js" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi

echo -n "Testing products error.js exists... "
if [ -f "frontend_new/app/products/error.js" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi

echo -n "Testing collections loading.js exists... "
if [ -f "frontend_new/app/collections/loading.js" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi

echo -n "Testing collections error.js exists... "
if [ -f "frontend_new/app/collections/error.js" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
    ((PASS_COUNT++))
else
    echo -e "${RED}✗ FAIL${NC}"
    ((FAIL_COUNT++))
fi
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo -e "Passed: ${GREEN}$PASS_COUNT${NC}"
echo -e "Failed: ${RED}$FAIL_COUNT${NC}"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ All tests passed! Deployment is successful.${NC}"
    exit 0
else
    echo -e "${RED}✗ Some tests failed. Please review the output above.${NC}"
    exit 1
fi
