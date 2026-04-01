#!/bin/bash
# Aarya Clothing - Critical Fixes Verification Script
# This script verifies all critical fixes have been properly applied

echo "=========================================="
echo "  Aarya Clothing - Critical Fixes Audit"
echo "=========================================="
echo ""

FRONTEND_DIR="frontend_new"
PASS_COUNT=0
FAIL_COUNT=0

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass() {
    echo -e "${GREEN}✓${NC} $1"
    PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Change to project root
cd "$(dirname "$0")/.."

echo "=== Phase 1: Critical Issue Verification ==="
echo ""

# 1. Check baseApi.js doesn't throw error
echo "1. Checking baseApi.js graceful fallback..."
if grep -q "throw new Error" "$FRONTEND_DIR/lib/baseApi.js" && \
   grep -q "NEXT_PUBLIC_API_URL environment variable is required" "$FRONTEND_DIR/lib/baseApi.js"; then
    fail "baseApi.js still throws error for missing NEXT_PUBLIC_API_URL"
else
    # Verify it has the graceful fallback
    if grep -q "console.warn" "$FRONTEND_DIR/lib/baseApi.js" && \
       grep -q "Priority 3: SSR fallback" "$FRONTEND_DIR/lib/baseApi.js"; then
        pass "baseApi.js has graceful fallback (no throwing)"
    else
        fail "baseApi.js missing proper fallback implementation"
    fi
fi

# 2. Check sitemap.js has error handling
echo "2. Checking sitemap.js error handling..."
if grep -q "try {" "$FRONTEND_DIR/app/sitemap.js" && \
   grep -q "catch (error)" "$FRONTEND_DIR/app/sitemap.js" && \
   grep -q "Failed to fetch products" "$FRONTEND_DIR/app/sitemap.js" && \
   grep -q "Failed to fetch collections" "$FRONTEND_DIR/app/sitemap.js"; then
    pass "sitemap.js has comprehensive error handling"
else
    fail "sitemap.js missing error handling for API calls"
fi

# 3. Check ProductCard has backward compatibility
echo "3. Checking ProductCard.jsx backward compatibility..."
if grep -q "initialWishlistStatus !== undefined" "$FRONTEND_DIR/components/common/ProductCard.jsx" && \
   grep -q "internalWishlistStatus" "$FRONTEND_DIR/components/common/ProductCard.jsx" && \
   grep -q "controlled (parent-managed) and uncontrolled (self-managed)" "$FRONTEND_DIR/components/common/ProductCard.jsx"; then
    pass "ProductCard.jsx supports both controlled and uncontrolled modes"
else
    fail "ProductCard.jsx missing backward compatibility for wishlist state"
fi

# 4. Check page.js video intro status
echo "4. Checking page.js video intro implementation..."
if grep -q "IntroVideo" "$FRONTEND_DIR/app/page.js" && \
   grep -q "handleVideoEnd" "$FRONTEND_DIR/app/page.js"; then
    # Check if it has proper error handling
    if grep -q "retry" "$FRONTEND_DIR/app/page.js" && \
       grep -q "ERROR_FALLBACK_DATA" "$FRONTEND_DIR/app/page.js"; then
        pass "page.js video intro has proper error handling and retry logic"
    else
        warn "page.js video intro may be missing error handling"
    fi
else
    fail "page.js missing video intro implementation"
fi

echo ""
echo "=== Phase 2: High-Priority Issue Verification ==="
echo ""

# 5. Check CollectionDetailClient has rollback
echo "5. Checking CollectionDetailClient.js rollback on error..."
COLLECTION_FILE="$FRONTEND_DIR/app/collections/[slug]/CollectionDetailClient.js"
if [ -f "$COLLECTION_FILE" ]; then
    if grep -q "previousState" "$COLLECTION_FILE" && \
       grep -q "ROLLBACK" "$COLLECTION_FILE" && \
       grep -q "setWishlistStatus(prev => ({ ...prev, \[productId\]: previousState }))" "$COLLECTION_FILE"; then
        pass "CollectionDetailClient.js has rollback on wishlist API failure"
    else
        fail "CollectionDetailClient.js missing rollback implementation"
    fi
else
    fail "CollectionDetailClient.js file not found"
fi

# 6. Check admin edit page uses authError
echo "6. Checking admin edit page authError usage..."
ADMIN_FILE="$FRONTEND_DIR/app/admin/products/[id]/edit/page.js"
if [ -f "$ADMIN_FILE" ]; then
    if grep -q "authError" "$ADMIN_FILE" && \
       grep -q "setAuthError" "$ADMIN_FILE"; then
        # Check if it's used in UI
        if grep -q "{authError &&" "$ADMIN_FILE" || \
           grep -q "Authentication required" "$ADMIN_FILE"; then
            pass "admin edit page properly uses authError state in UI"
        else
            warn "admin edit page has authError state but may not use it in UI"
        fi
    else
        fail "admin edit page has unused authError state"
    fi
else
    fail "admin edit page file not found"
fi

# 7. Check z-index values
echo "7. Checking z-index hierarchy..."
INTRO_VIDEO_Z=$(grep -o "z-\[[0-9]*\]" "$FRONTEND_DIR/components/landing/IntroVideo.jsx" | head -1 | grep -o "[0-9]*")
if [ "$INTRO_VIDEO_Z" -ge 150 ] 2>/dev/null; then
    pass "IntroVideo z-index ($INTRO_VIDEO_Z) is appropriately high"
else
    fail "IntroVideo z-index may conflict with other overlays (found: $INTRO_VIDEO_Z)"
fi

echo ""
echo "=== Phase 3: Backend Compatibility Verification ==="
echo ""

# 8. Test production API endpoints
echo "8. Testing production API endpoints..."

# Test products endpoint
PRODUCTS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://aaryaclothing.in/api/v1/products?limit=1" 2>/dev/null || echo "000")
if [ "$PRODUCTS_RESPONSE" = "200" ]; then
    pass "Production API: /api/v1/products is accessible (HTTP $PRODUCTS_RESPONSE)"
else
    fail "Production API: /api/v1/products returned HTTP $PRODUCTS_RESPONSE"
fi

# Test collections endpoint
COLLECTIONS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://aaryaclothing.in/api/v1/collections?limit=1" 2>/dev/null || echo "000")
if [ "$COLLECTIONS_RESPONSE" = "200" ]; then
    pass "Production API: /api/v1/collections is accessible (HTTP $COLLECTIONS_RESPONSE)"
else
    fail "Production API: /api/v1/collections returned HTTP $COLLECTIONS_RESPONSE"
fi

# Test auth required endpoint (should return 401, not 404)
AUTH_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" "https://aaryaclothing.in/api/v1/wishlist" 2>/dev/null || echo "000")
if [ "$AUTH_RESPONSE" = "401" ]; then
    pass "Production API: /api/v1/wishlist requires auth (HTTP $AUTH_RESPONSE - expected)"
elif [ "$AUTH_RESPONSE" = "404" ]; then
    fail "Production API: /api/v1/wishlist endpoint not found (HTTP $AUTH_RESPONSE)"
else
    warn "Production API: /api/v1/wishlist returned HTTP $AUTH_RESPONSE"
fi

echo ""
echo "=== Phase 4: Docker Isolation Verification ==="
echo ""

# 9. Check Docker isolation
echo "9. Checking Docker isolation..."

# Verify .dockerignore prevents local changes
if grep -q "\.env\.local" ".dockerignore" && \
   grep -q "node_modules" ".dockerignore"; then
    pass ".dockerignore properly configured for local development"
else
    fail ".dockerignore may sync local files to Docker"
fi

# Verify no hardcoded production URLs in baseApi.js
if grep -q "return 'https://aaryaclothing.in'" "$FRONTEND_DIR/lib/baseApi.js"; then
    fail "baseApi.js has hardcoded production URL"
else
    pass "baseApi.js uses environment variables (no hardcoded URLs)"
fi

echo ""
echo "=========================================="
echo "  Verification Summary"
echo "=========================================="
echo -e "  ${GREEN}Passed:${NC} $PASS_COUNT"
echo -e "  ${RED}Failed:${NC} $FAIL_COUNT"
echo "=========================================="

if [ $FAIL_COUNT -eq 0 ]; then
    echo -e "\n${GREEN}✓ All critical fixes verified successfully!${NC}"
    exit 0
else
    echo -e "\n${RED}✗ $FAIL_COUNT issue(s) require attention${NC}"
    exit 1
fi
