#!/bin/bash
# =============================================================================
# Aarya Clothing - Production Verification Script
# =============================================================================
# This script verifies all production systems are working correctly
# Run with: bash scripts/verify_production.sh
# =============================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
DOMAIN="aaryaclothing.in"
BASE_URL="https://$DOMAIN"
PASS=0
FAIL=0
WARN=0

# =============================================================================
# Test Functions
# =============================================================================

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    ((PASS++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    ((FAIL++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    ((WARN++))
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

section() {
    echo ""
    echo "=============================================="
    echo "$1"
    echo "=============================================="
}

# =============================================================================
# Container Tests
# =============================================================================

test_containers() {
    section "Container Status"
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_fail "Docker is not running"
        return
    fi
    log_pass "Docker daemon is running"
    
    # Check all containers
    cd /opt/Aarya_clothing_frontend
    
    EXPECTED_CONTAINERS=(
        "aarya_postgres"
        "aarya_redis"
        "aarya_meilisearch"
        "aarya_core"
        "aarya_commerce"
        "aarya_payment"
        "aarya_admin"
        "aarya_frontend"
        "aarya_nginx"
    )
    
    for container in "${EXPECTED_CONTAINERS[@]}"; do
        if docker ps --format '{{.Names}}' | grep -q "^${container}$"; then
            STATUS=$(docker inspect --format='{{.State.Health.Status}}' "$container" 2>/dev/null || echo "running")
            if [ "$STATUS" = "healthy" ] || [ "$STATUS" = "running" ]; then
                log_pass "$container is running ($STATUS)"
            else
                log_fail "$container is unhealthy ($STATUS)"
            fi
        else
            log_fail "$container is not running"
        fi
    done
}

# =============================================================================
# HTTPS & SSL Tests
# =============================================================================

test_https() {
    section "HTTPS & SSL Tests"
    
    # Test HTTPS connectivity
    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL" --max-time 10)
    if [ "$HTTP_CODE" -eq 200 ]; then
        log_pass "HTTPS is working (HTTP $HTTP_CODE)"
    else
        log_fail "HTTPS returned HTTP $HTTP_CODE"
    fi
    
    # Test HTTP redirect
    REDIRECT_CODE=$(curl -s -o /dev/null -w "%{http_code}" "http://$DOMAIN" --max-time 10)
    if [ "$REDIRECT_CODE" -eq 301 ]; then
        log_pass "HTTP redirects to HTTPS (301)"
    else
        log_warn "HTTP redirect code: $REDIRECT_CODE (expected 301)"
    fi
    
    # Test SSL certificate
    if echo | openssl s_client -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -dates &> /dev/null; then
        EXPIRY=$(echo | openssl s_client -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -enddate)
        log_pass "SSL certificate is valid ($EXPIRY)"
    else
        log_fail "SSL certificate check failed"
    fi
    
    # Test certificate issuer
    ISSUER=$(echo | openssl s_client -connect "$DOMAIN:443" 2>/dev/null | openssl x509 -noout -issuer)
    if [[ "$ISSUER" == *"Let's Encrypt"* ]]; then
        log_pass "Certificate issued by Let's Encrypt"
    else
        log_warn "Certificate issuer: $ISSUER"
    fi
}

# =============================================================================
# Security Headers Tests
# =============================================================================

test_security_headers() {
    section "Security Headers"
    
    HEADERS=$(curl -s -I "$BASE_URL" --max-time 10)
    
    # HSTS
    if echo "$HEADERS" | grep -qi "Strict-Transport-Security"; then
        log_pass "HSTS header present"
    else
        log_fail "HSTS header missing"
    fi
    
    # X-Frame-Options
    if echo "$HEADERS" | grep -qi "X-Frame-Options"; then
        log_pass "X-Frame-Options header present"
    else
        log_fail "X-Frame-Options header missing"
    fi
    
    # X-Content-Type-Options
    if echo "$HEADERS" | grep -qi "X-Content-Type-Options"; then
        log_pass "X-Content-Type-Options header present"
    else
        log_fail "X-Content-Type-Options header missing"
    fi
    
    # X-XSS-Protection
    if echo "$HEADERS" | grep -qi "X-XSS-Protection"; then
        log_pass "X-XSS-Protection header present"
    else
        log_warn "X-XSS-Protection header missing (optional)"
    fi
    
    # Content-Security-Policy
    if echo "$HEADERS" | grep -qi "Content-Security-Policy"; then
        log_pass "Content-Security-Policy header present"
    else
        log_warn "Content-Security-Policy header missing (recommended)"
    fi
    
    # Referrer-Policy
    if echo "$HEADERS" | grep -qi "Referrer-Policy"; then
        log_pass "Referrer-Policy header present"
    else
        log_warn "Referrer-Policy header missing (recommended)"
    fi
}

# =============================================================================
# API Tests
# =============================================================================

test_api() {
    section "API Tests"
    
    # Health endpoint
    HEALTH=$(curl -s "$BASE_URL/health" --max-time 10)
    if echo "$HEALTH" | grep -q "healthy"; then
        log_pass "Health endpoint responding"
    else
        log_fail "Health endpoint not responding correctly"
    fi
    
    # Products API
    PRODUCTS=$(curl -s "$BASE_URL/api/v1/products?limit=5" --max-time 10)
    if echo "$PRODUCTS" | grep -q "hits\|products"; then
        log_pass "Products API responding"
    else
        log_fail "Products API not responding correctly"
    fi
    
    # Categories API
    CATEGORIES=$(curl -s "$BASE_URL/api/v1/categories" --max-time 10)
    if echo "$CATEGORIES" | grep -q "\["; then
        log_pass "Categories API responding"
    else
        log_fail "Categories API not responding correctly"
    fi
    
    # Collections API
    COLLECTIONS=$(curl -s "$BASE_URL/api/v1/collections" --max-time 10)
    if echo "$COLLECTIONS" | grep -q "\["; then
        log_pass "Collections API responding"
    else
        log_fail "Collections API not responding correctly"
    fi
}

# =============================================================================
# Database Tests
# =============================================================================

test_database() {
    section "Database Tests"
    
    # Check PostgreSQL connection
    if docker exec aarya_postgres pg_isready -U postgres &> /dev/null; then
        log_pass "PostgreSQL is accepting connections"
    else
        log_fail "PostgreSQL is not ready"
        return
    fi
    
    # Check database exists
    if docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT 1" &> /dev/null; then
        log_pass "Database 'aarya_clothing' exists"
    else
        log_fail "Database 'aarya_clothing' not found"
        return
    fi
    
    # Check table counts
    TABLES=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c "
        SELECT COUNT(*) FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    ")
    if [ "${TABLES// /}" -gt 10 ]; then
        log_pass "Database has $TABLES tables"
    else
        log_warn "Database has only $TABLES tables (expected >10)"
    fi
    
    # Check products count
    PRODUCTS=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c "SELECT COUNT(*) FROM products;")
    log_info "Products in database: ${PRODUCTS// /}"
    
    # Check indexes
    INDEXES=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c "
        SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';
    ")
    log_info "Database indexes: ${INDEXES// /}"
}

# =============================================================================
# Redis Tests
# =============================================================================

test_redis() {
    section "Redis Tests"
    
    # Check Redis connection
    if docker exec aarya_redis redis-cli ping &> /dev/null; then
        log_pass "Redis is responding"
    else
        log_fail "Redis is not responding"
        return
    fi
    
    # Check Redis info
    if docker exec aarya_redis redis-cli info server &> /dev/null; then
        log_pass "Redis server info available"
    else
        log_warn "Redis server info not available"
    fi
}

# =============================================================================
# Frontend Tests
# =============================================================================

test_frontend() {
    section "Frontend Tests"
    
    # Test homepage loads
    HOMEPAGE=$(curl -s "$BASE_URL" --max-time 10)
    if echo "$HOMEPAGE" | grep -q "<!DOCTYPE html>\|<html"; then
        log_pass "Homepage loads HTML"
    else
        log_fail "Homepage not loading correctly"
    fi
    
    # Check for Next.js
    if echo "$HOMEPAGE" | grep -q "_next"; then
        log_pass "Next.js assets detected"
    else
        log_warn "Next.js assets not detected"
    fi
    
    # Test static assets
    STATIC_CHECK=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/_next/static" --max-time 10)
    if [ "$STATIC_CHECK" -eq 200 ] || [ "$STATIC_CHECK" -eq 302 ]; then
        log_pass "Static assets accessible"
    else
        log_warn "Static assets returned HTTP $STATIC_CHECK"
    fi
}

# =============================================================================
# Performance Tests
# =============================================================================

test_performance() {
    section "Performance Tests"
    
    # Response time
    START=$(date +%s%N)
    curl -s -o /dev/null "$BASE_URL/health" --max-time 10
    END=$(date +%s%N)
    RESPONSE_TIME=$(( (END - START) / 1000000 ))
    
    if [ "$RESPONSE_TIME" -lt 1000 ]; then
        log_pass "Health endpoint response time: ${RESPONSE_TIME}ms (<1s)"
    elif [ "$RESPONSE_TIME" -lt 3000 ]; then
        log_warn "Health endpoint response time: ${RESPONSE_TIME}ms (1-3s)"
    else
        log_fail "Health endpoint response time: ${RESPONSE_TIME}ms (>3s)"
    fi
    
    # Check disk space
    DISK_AVAILABLE=$(df -P /opt | awk 'NR==2 {print $4}')
    DISK_GB=$((DISK_AVAILABLE / 1048576))
    if [ "$DISK_GB" -gt 5 ]; then
        log_pass "Disk space: ${DISK_GB}GB available"
    elif [ "$DISK_GB" -gt 2 ]; then
        log_warn "Disk space: ${DISK_GB}GB available (low)"
    else
        log_fail "Disk space: ${DISK_GB}GB available (critical)"
    fi
    
    # Check memory
    MEM_AVAILABLE=$(free -m | awk 'NR==2 {print $7}')
    if [ "$MEM_AVAILABLE" -gt 2048 ]; then
        log_pass "Memory: ${MEM_AVAILABLE}MB available"
    elif [ "$MEM_AVAILABLE" -gt 1024 ]; then
        log_warn "Memory: ${MEM_AVAILABLE}MB available (low)"
    else
        log_fail "Memory: ${MEM_AVAILABLE}MB available (critical)"
    fi
}

# =============================================================================
# Summary
# =============================================================================

print_summary() {
    section "Verification Summary"
    
    TOTAL=$((PASS + FAIL + WARN))
    
    echo ""
    echo -e "Total Tests: $TOTAL"
    echo -e "${GREEN}Passed: $PASS${NC}"
    echo -e "${RED}Failed: $FAIL${NC}"
    echo -e "${YELLOW}Warnings: $WARN${NC}"
    echo ""
    
    if [ "$FAIL" -eq 0 ]; then
        echo -e "${GREEN}✓ All critical tests passed!${NC}"
        echo ""
        echo "Production deployment is healthy."
        exit 0
    else
        echo -e "${RED}✗ $FAIL critical test(s) failed!${NC}"
        echo ""
        echo "Please review the failures above and fix them."
        echo "See PRODUCTION_FIX_GUIDE.md for troubleshooting."
        exit 1
    fi
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo "=============================================="
    echo "Aarya Clothing Production Verification"
    echo "=============================================="
    echo "Domain: $DOMAIN"
    echo "Time: $(date)"
    echo ""
    
    test_containers
    test_https
    test_security_headers
    test_api
    test_database
    test_redis
    test_frontend
    test_performance
    
    print_summary
}

# Run main function
main "$@"
