#!/bin/bash
# =============================================================================
# RAZORPAY INTEGRATION VERIFICATION SCRIPT
# Aarya Clothing - Payment Gateway Setup Verification
# =============================================================================
#
# USAGE:
#   ./verify-razorpay-setup.sh
#
# This script verifies:
#   ✓ Environment variable configuration
#   ✓ Payment service health
#   ✓ API endpoint functionality
#   ✓ Docker container status
#   ✓ Webhook secret validation
#
# Exit codes:
#   0 = All checks passed
#   1 = Some checks failed
#   2 = Critical errors (service not running)
#
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
WARNINGS=0

# Configuration
COMPOSE_FILE="docker-compose.dev.yml"
PAYMENT_SERVICE_PORT="5003"
FRONTEND_PORT="6005"

# =============================================================================
# Helper Functions
# =============================================================================

print_header() {
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}\n"
}

print_section() {
    echo -e "\n${YELLOW}▶ $1${NC}"
}

pass() {
    echo -e "  ${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "  ${RED}✗${NC} $1"
    ((FAILED++))
}

warn() {
    echo -e "  ${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

info() {
    echo -e "  ${BLUE}ℹ${NC} $1"
}

# =============================================================================
# Verification Functions
# =============================================================================

check_env_file() {
    print_section "Checking .env file"
    
    if [ ! -f ".env" ]; then
        fail ".env file not found"
        info "Copy .env.example to .env and configure Razorpay credentials"
        return 1
    fi
    
    pass ".env file exists"
    
    # Check RAZORPAY_KEY_ID
    if grep -q "^RAZORPAY_KEY_ID=rzp_test_" .env; then
        pass "RAZORPAY_KEY_ID configured (TEST MODE)"
        info "Key ID: $(grep "^RAZORPAY_KEY_ID=" .env | cut -d'=' -f2 | head -c 15)..."
    elif grep -q "^RAZORPAY_KEY_ID=rzp_live_" .env; then
        warn "RAZORPAY_KEY_ID configured (LIVE MODE) - Real money will be charged!"
        info "Key ID: $(grep "^RAZORPAY_KEY_ID=" .env | cut -d'=' -f2 | head -c 15)..."
    elif grep -q "^RAZORPAY_KEY_ID=" .env; then
        fail "RAZORPAY_KEY_ID has invalid format (should start with rzp_test_ or rzp_live_)"
    else
        fail "RAZORPAY_KEY_ID not configured"
    fi
    
    # Check RAZORPAY_KEY_SECRET
    if grep -q "^RAZORPAY_KEY_SECRET=.\\{20,\\}" .env; then
        pass "RAZORPAY_KEY_SECRET configured"
    elif grep -q "^RAZORPAY_KEY_SECRET=" .env; then
        fail "RAZORPAY_KEY_SECRET too short (may be invalid)"
    else
        fail "RAZORPAY_KEY_SECRET not configured"
    fi
    
    # Check RAZORPAY_WEBHOOK_SECRET
    if grep -q "^RAZORPAY_WEBHOOK_SECRET=.\\{60,\\}" .env; then
        pass "RAZORPAY_WEBHOOK_SECRET configured"
    elif grep -q "^RAZORPAY_WEBHOOK_SECRET=" .env; then
        warn "RAZORPAY_WEBHOOK_SECRET may be too short (recommended: 64 characters)"
    else
        warn "RAZORPAY_WEBHOOK_SECRET not configured (optional for local testing)"
        info "Generate with: python3 -c \"import secrets; print(secrets.token_hex(32))\""
    fi
    
    # Check for common mistakes
    if grep -q "^RAZORPAY_KEY_ID = " .env || grep -q "^RAZORPAY_KEY_ID= " .env; then
        fail "RAZORPAY_KEY_ID has spaces around '=' (should be KEY=value)"
    fi
    
    if grep -q '^RAZORPAY_KEY_ID="' .env; then
        warn "RAZORPAY_KEY_ID has quotes (usually not needed)"
    fi
}

check_docker_status() {
    print_section "Checking Docker containers"
    
    # Check if docker-compose is available
    if ! command -v docker-compose &> /dev/null; then
        if ! docker compose version &> /dev/null; then
            fail "docker-compose not found"
            return 1
        fi
        COMPOSE_CMD="docker compose"
    else
        COMPOSE_CMD="docker-compose"
    fi
    
    # Check payment service
    if $COMPOSE_CMD -f $COMPOSE_FILE ps payment 2>/dev/null | grep -q "Up"; then
        pass "Payment service is running"
    else
        fail "Payment service is not running"
        info "Start with: $COMPOSE_CMD -f $COMPOSE_FILE up -d payment"
        return 1
    fi
    
    # Check postgres service
    if $COMPOSE_CMD -f $COMPOSE_FILE ps postgres 2>/dev/null | grep -q "Up"; then
        pass "PostgreSQL service is running"
    else
        warn "PostgreSQL service is not running (required for transactions)"
    fi
    
    # Check redis service
    if $COMPOSE_CMD -f $COMPOSE_FILE ps redis 2>/dev/null | grep -q "Up"; then
        pass "Redis service is running"
    else
        warn "Redis service is not running (optional but recommended)"
    fi
}

check_payment_health() {
    print_section "Checking payment service health"
    
    # Health endpoint
    HEALTH_RESPONSE=$(curl -s --connect-timeout 5 "http://localhost:$PAYMENT_SERVICE_PORT/health" 2>/dev/null || echo "")
    
    if [ -z "$HEALTH_RESPONSE" ]; then
        fail "Payment service not responding on port $PAYMENT_SERVICE_PORT"
        info "Check logs: docker-compose -f $COMPOSE_FILE logs payment"
        return 1
    fi
    
    if echo "$HEALTH_RESPONSE" | grep -q '"status": "healthy"'; then
        pass "Payment service is healthy"
    else
        fail "Payment service returned unhealthy status"
        info "Response: $HEALTH_RESPONSE"
        return 1
    fi
    
    # Check Razorpay feature flag
    if echo "$HEALTH_RESPONSE" | grep -q '"razorpay": true'; then
        pass "Razorpay is enabled in payment service"
    else
        fail "Razorpay not enabled in payment service"
        info "Check RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env"
    fi
    
    # Check webhook feature
    if echo "$HEALTH_RESPONSE" | grep -q '"webhooks": true'; then
        pass "Webhooks are enabled"
    else
        warn "Webhooks not enabled (optional for local testing)"
    fi
}

check_config_endpoint() {
    print_section "Checking payment config endpoint"
    
    CONFIG_RESPONSE=$(curl -s --connect-timeout 5 "http://localhost:$FRONTEND_PORT/api/v1/payment/config" 2>/dev/null || echo "")
    
    if [ -z "$CONFIG_RESPONSE" ]; then
        fail "Config endpoint not responding on port $FRONTEND_PORT"
        info "Is the API gateway/backend running?"
        return 1
    fi
    
    # Check for key_id
    if echo "$CONFIG_RESPONSE" | grep -q '"key_id": "rzp_'; then
        pass "Config endpoint returns Razorpay key_id"
        
        # Extract and display (masked)
        KEY_ID=$(echo "$CONFIG_RESPONSE" | grep -o '"key_id": "[^"]*"' | cut -d'"' -f4)
        if [ -n "$KEY_ID" ]; then
            info "Key ID: ${KEY_ID:0:15}..."
        fi
    else
        fail "Config endpoint not returning key_id"
        info "Response: $CONFIG_RESPONSE"
    fi
    
    # Check enabled status
    if echo "$CONFIG_RESPONSE" | grep -q '"enabled": true'; then
        pass "Razorpay is marked as enabled"
    else
        fail "Razorpay marked as disabled in config"
    fi
    
    # Check currency
    if echo "$CONFIG_RESPONSE" | grep -q '"currency": "INR"'; then
        pass "Currency configured as INR"
    else
        warn "Currency may not be INR"
    fi
}

check_webhook_secret() {
    print_section "Validating webhook secret"
    
    WEBHOOK_SECRET=$(grep "^RAZORPAY_WEBHOOK_SECRET=" .env 2>/dev/null | cut -d'=' -f2)
    
    if [ -z "$WEBHOOK_SECRET" ]; then
        warn "Webhook secret not set (optional for local testing)"
        info "Required for production webhook verification"
        return 0
    fi
    
    # Check length (should be 64 characters for 32 bytes hex)
    SECRET_LENGTH=${#WEBHOOK_SECRET}
    if [ $SECRET_LENGTH -ge 60 ]; then
        pass "Webhook secret has good length ($SECRET_LENGTH characters)"
    else
        fail "Webhook secret too short ($SECRET_LENGTH characters, recommended: 64)"
        info "Generate with: python3 -c \"import secrets; print(secrets.token_hex(32))\""
    fi
    
    # Check if it's hex
    if [[ $WEBHOOK_SECRET =~ ^[a-f0-9]+$ ]]; then
        pass "Webhook secret is valid hexadecimal"
    else
        fail "Webhook secret contains non-hex characters"
        info "Should only contain characters 0-9 and a-f"
    fi
}

check_payment_logs() {
    print_section "Checking payment service logs"
    
    # Get recent logs
    LOGS=$(docker-compose -f $COMPOSE_FILE logs --tail=50 payment 2>/dev/null || echo "")
    
    if [ -z "$LOGS" ]; then
        warn "No logs available from payment service"
        return 0
    fi
    
    # Check for successful initialization
    if echo "$LOGS" | grep -q "Razorpay client initialized"; then
        pass "Razorpay client initialized successfully"
    elif echo "$LOGS" | grep -q "Razorpay credentials not configured"; then
        fail "Razorpay credentials not configured (check .env)"
    else
        info "Looking for initialization message..."
    fi
    
    # Check for errors
    if echo "$LOGS" | grep -qi "error"; then
        ERROR_COUNT=$(echo "$LOGS" | grep -ci "error")
        if [ $ERROR_COUNT -gt 0 ]; then
            warn "Found $ERROR_COUNT error(s) in recent logs"
            info "Review with: docker-compose -f $COMPOSE_FILE logs payment | grep -i error"
        fi
    fi
    
    # Check service started
    if echo "$LOGS" | grep -q "Payment service started"; then
        pass "Payment service started successfully"
    else
        warn "Payment service start message not found"
    fi
}

test_create_order() {
    print_section "Testing order creation (optional)"
    
    info "This test requires authentication. Skipping automated test."
    info "Manual test:"
    info "  1. Login to the application"
    info "  2. Add items to cart"
    info "  3. Proceed to checkout"
    info "  4. Click 'Pay Now'"
    info "  5. Razorpay modal should open"
    warn "Automated order creation test requires valid auth token"
}

print_summary() {
    print_header "VERIFICATION SUMMARY"
    
    echo -e "  ${GREEN}Passed:${NC}   $PASSED"
    echo -e "  ${RED}Failed:${NC}   $FAILED"
    echo -e "  ${YELLOW}Warnings:${NC} $WARNINGS"
    echo ""
    
    if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${GREEN}  ✓ ALL CHECKS PASSED - Ready for testing!${NC}"
        echo -e "${GREEN}═══════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "Next steps:"
        echo "  1. Start your frontend: http://localhost:6004"
        echo "  2. Add items to cart and proceed to checkout"
        echo "  3. Test with card: 4111 1111 1111 1111"
        echo "  4. CVV: 123, Expiry: Any future date"
        echo ""
        return 0
    elif [ $FAILED -eq 0 ]; then
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${YELLOW}  ✓ MOST CHECKS PASSED - Review warnings above${NC}"
        echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "You can proceed with testing, but review the warnings."
        echo ""
        return 0
    else
        echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
        echo -e "${RED}  ✗ CRITICAL ISSUES FOUND - Fix before testing${NC}"
        echo -e "${RED}═══════════════════════════════════════════════════════════${NC}"
        echo ""
        echo "Fix the failed checks above before proceeding."
        echo "See full guide: docs/RAZORPAY_COMPLETE_SETUP_GUIDE.md"
        echo ""
        return 1
    fi
}

print_help() {
    echo "Razorpay Integration Verification Script"
    echo ""
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -h, --help      Show this help message"
    echo "  -v, --verbose   Show verbose output"
    echo "  -q, --quiet     Only show summary"
    echo "  -f, --fix       Attempt to fix common issues"
    echo ""
    echo "Examples:"
    echo "  $0              Run all verification checks"
    echo "  $0 --verbose    Run with detailed output"
    echo "  $0 --fix        Fix common configuration issues"
    echo ""
}

fix_common_issues() {
    print_header "FIXING COMMON ISSUES"
    
    # Check if .env exists
    if [ ! -f ".env" ]; then
        info "Creating .env from .env.example..."
        if [ -f ".env.example" ]; then
            cp .env.example .env
            pass "Created .env from template"
            warn "Edit .env and add your Razorpay credentials"
        else
            fail ".env.example not found"
        fi
    fi
    
    # Check for spaces in .env
    if grep -q "^RAZORPAY_KEY_ID = " .env 2>/dev/null; then
        info "Fixing spaces in RAZORPAY_KEY_ID..."
        sed -i 's/^RAZORPAY_KEY_ID = /RAZORPAY_KEY_ID=/' .env
        pass "Removed spaces from RAZORPAY_KEY_ID"
    fi
    
    if grep -q "^RAZORPAY_KEY_SECRET = " .env 2>/dev/null; then
        info "Fixing spaces in RAZORPAY_KEY_SECRET..."
        sed -i 's/^RAZORPAY_KEY_SECRET = /RAZORPAY_KEY_SECRET=/' .env
        pass "Removed spaces from RAZORPAY_KEY_SECRET"
    fi
    
    # Restart payment service
    info "Restarting payment service..."
    if docker-compose -f $COMPOSE_FILE restart payment &>/dev/null; then
        pass "Payment service restarted"
        info "Wait 10 seconds for service to start..."
        sleep 10
    else
        fail "Failed to restart payment service"
    fi
    
    echo ""
    info "Re-run verification to check if issues are resolved"
}

# =============================================================================
# Main Script
# =============================================================================

main() {
    print_header "RAZORPAY INTEGRATION VERIFICATION"
    echo "Aarya Clothing - Payment Gateway Setup"
    echo ""
    echo "Working directory: $(pwd)"
    echo "Compose file: $COMPOSE_FILE"
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                print_help
                exit 0
                ;;
            -v|--verbose)
                VERBOSE=true
                shift
                ;;
            -q|--quiet)
                QUIET=true
                shift
                ;;
            -f|--fix)
                fix_common_issues
                exit 0
                ;;
            *)
                echo "Unknown option: $1"
                print_help
                exit 1
                ;;
        esac
    done
    
    # Run verification checks
    check_env_file
    check_docker_status
    check_payment_health
    check_config_endpoint
    check_webhook_secret
    check_payment_logs
    # test_create_order  # Optional - requires auth
    
    # Print summary
    print_summary
    exit_code=$?
    
    # Additional resources
    if [ $exit_code -eq 0 ]; then
        echo "═══════════════════════════════════════════════════════════"
        echo ""
        echo "Additional Resources:"
        echo "  • Full Guide: docs/RAZORPAY_COMPLETE_SETUP_GUIDE.md"
        echo "  • Test Cards: https://razorpay.com/docs/payments/payments/test-card-upi-details"
        echo "  • API Docs:   http://localhost:$PAYMENT_SERVICE_PORT/docs"
        echo ""
    fi
    
    exit $exit_code
}

# Run main function
main "$@"
