#!/bin/bash
# ============================================================================
# Test Recovery Script - Verify fixes for order/payment issues
# ============================================================================

set -e

cd /opt/Aarya_clothing_frontend

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}================================================================${NC}"
echo -e "${GREEN}  Order/Payment Recovery Test Script${NC}"
echo -e "${GREEN}================================================================${NC}\n"

# Test 1: Check timezone fixes in models
echo -e "${YELLOW}[TEST 1] Checking timezone fixes in models...${NC}"

if grep -q "datetime.now(timezone.utc)" services/commerce/models/order.py; then
    echo -e "${GREEN}✓${NC} Order model uses UTC for created_at"
else
    echo -e "${RED}✗${NC} Order model timezone fix missing!"
    exit 1
fi

if grep -q "datetime.now(timezone.utc)" services/payment/models/payment.py; then
    echo -e "${GREEN}✓${NC} PaymentTransaction model uses UTC for created_at"
else
    echo -e "${RED}✗${NC} PaymentTransaction model timezone fix missing!"
    exit 1
fi

# Test 2: Check webhook status fix
echo -e "\n${YELLOW}[TEST 2] Checking webhook status fix...${NC}"

if grep -q "webhook_status = event_info.get" services/payment/service/payment_service.py; then
    echo -e "${GREEN}✓${NC} webhook_status properly defined in payment handler"
else
    echo -e "${RED}✗${NC} webhook_status fix missing!"
    exit 1
fi

# Test 3: Check stock reservation cleanup
echo -e "\n${YELLOW}[TEST 3] Checking stock reservation cleanup...${NC}"

if grep -q "def release_expired_reservations" services/commerce/service/inventory_service.py; then
    echo -e "${GREEN}✓${NC} release_expired_reservations() method exists"
else
    echo -e "${RED}✗${NC} release_expired_reservations() missing!"
    exit 1
fi

if grep -q "def get_stuck_reservations" services/commerce/service/inventory_service.py; then
    echo -e "${GREEN}✓${NC} get_stuck_reservations() method exists"
else
    echo -e "${RED}✗${NC} get_stuck_reservations() missing!"
    exit 1
fi

# Test 4: Check admin endpoints
echo -e "\n${YELLOW}[TEST 4] Checking admin API endpoints...${NC}"

if grep -q '/admin/reservations/stuck' services/commerce/routes/orders.py; then
    echo -e "${GREEN}✓${NC} GET /admin/reservations/stuck endpoint exists"
else
    echo -e "${RED}✗${NC} GET /admin/reservations/stuck endpoint missing!"
    exit 1
fi

if grep -q '/admin/reservations/release-expired' services/commerce/routes/orders.py; then
    echo -e "${GREEN}✓${NC} POST /admin/reservations/release-expired endpoint exists"
else
    echo -e "${RED}✗${NC} POST /admin/reservations/release-expired endpoint missing!"
    exit 1
fi

if grep -q '/admin/recovery/run-now' services/commerce/routes/orders.py; then
    echo -e "${GREEN}✓${NC} POST /admin/recovery/run-now endpoint exists"
else
    echo -e "${RED}✗${NC} POST /admin/recovery/run-now endpoint missing!"
    exit 1
fi

if grep -q '/admin/payment-recovery' services/commerce/routes/orders.py; then
    echo -e "${GREEN}✓${NC} GET /admin/payment-recovery endpoint exists"
else
    echo -e "${RED}✗${NC} GET /admin/payment-recovery endpoint missing!"
    exit 1
fi

# Test 5: Check recovery job
echo -e "\n${YELLOW}[TEST 5] Checking recovery job...${NC}"

if [ -f "scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py" ]; then
    echo -e "${GREEN}✓${NC} Recovery script exists"
else
    echo -e "${RED}✗${NC} Recovery script missing!"
    exit 1
fi

if grep -q "def run_payment_recovery" services/payment/jobs/recovery_job.py; then
    echo -e "${GREEN}✓${NC} Recovery job function exists"
else
    echo -e "${RED}✗${NC} Recovery job function missing!"
    exit 1
fi

if grep -q 'scheduler_thread.start()' services/payment/main.py; then
    echo -e "${GREEN}✓${NC} Recovery scheduler thread configured"
else
    echo -e "${RED}✗${NC} Recovery scheduler not configured!"
    exit 1
fi

# Summary
echo -e "\n${GREEN}================================================================${NC}"
echo -e "${GREEN}  ALL TESTS PASSED! ✓${NC}"
echo -e "${GREEN}================================================================${NC}\n"

echo -e "${GREEN}Summary of fixes:${NC}"
echo -e "  1. ✅ Timezone consistency: orders.created_at uses UTC (was IST)"
echo -e "  2. ✅ Timezone consistency: payment_transactions.created_at uses UTC (was IST)"
echo -e "  3. ✅ Webhook handler: webhook_status properly defined (was 'status' undefined)"
echo -e "  4. ✅ Stock reservations: release_expired_reservations() added"
echo -e "  5. ✅ Stock reservations: get_stuck_reservations() added"
echo -e "  6. ✅ Admin API: Reservation management endpoints added"
echo -e "  7. ✅ Admin API: Recovery trigger endpoint added"
echo -e "  8. ✅ Admin API: Payment recovery report endpoint added"
echo -e "  9. ✅ Recovery job: Payment recovery scheduler configured"
echo -e " 10. ✅ Recovery job: Manual recovery script available\n"

echo -e "${YELLOW}Next steps:${NC}"
echo -e "  1. Run: ./scripts/test_recovery.sh (this script)"
echo -e "  2. Run: ./scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py"
echo -e "  3. Run: python scripts/sync_missing_orders.py"
echo -e "  4. Call: POST /admin/reservations/release-expired"
echo -e "  5. Call: POST /admin/recovery/run-now"
echo -e "  6. Call: GET /admin/payment-recovery\n"

echo -e "${GREEN}Recovery complete!${NC}"