#!/bin/bash
# Payment Transaction Verification Test Script
# This script verifies the complete payment transaction flow

set -e

echo "========================================"
echo "PAYMENT TRANSACTION VERIFICATION TEST"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

pass_count=0
fail_count=0

# Test 1: Check service health
echo "Test 1: Checking service health..."
commerce_health=$(curl -s http://localhost:5002/health | grep -c '"status": "healthy"' || true)
payment_health=$(curl -s http://localhost:5003/health | grep -c '"status": "healthy"' || true)

if [ "$commerce_health" -ge 1 ] && [ "$payment_health" -ge 1 ]; then
    echo -e "${GREEN}✓ PASS${NC}: Both commerce and payment services are healthy"
    ((pass_count++))
else
    echo -e "${RED}✗ FAIL${NC}: Service health check failed"
    ((fail_count++))
fi

# Test 2: Check payment_transactions table has data
echo ""
echo "Test 2: Checking payment_transactions table..."
tx_count=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c "SELECT COUNT(*) FROM payment_transactions;" | tr -d ' ')

if [ "$tx_count" -gt 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: payment_transactions table has $tx_count records"
    ((pass_count++))
else
    echo -e "${RED}✗ FAIL${NC}: payment_transactions table is EMPTY"
    ((fail_count++))
fi

# Test 3: Check all Razorpay orders have payment transactions
echo ""
echo "Test 3: Checking order-payment transaction linkage..."
unlinked_orders=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c "
    SELECT COUNT(*) 
    FROM orders o
    WHERE o.payment_method = 'razorpay'
    AND o.id NOT IN (SELECT order_id FROM payment_transactions WHERE order_id IS NOT NULL);
" | tr -d ' ')

if [ "$unlinked_orders" -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: All Razorpay orders have payment transactions"
    ((pass_count++))
else
    echo -e "${RED}✗ FAIL${NC}: $unlinked_orders orders missing payment transactions"
    ((fail_count++))
fi

# Test 4: Check payment transaction data integrity
echo ""
echo "Test 4: Checking payment transaction data integrity..."
invalid_tx=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c "
    SELECT COUNT(*) 
    FROM payment_transactions 
    WHERE amount IS NULL 
    OR status IS NULL 
    OR transaction_id IS NULL;
" | tr -d ' ')

if [ "$invalid_tx" -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: All payment transactions have valid data"
    ((pass_count++))
else
    echo -e "${RED}✗ FAIL${NC}: $invalid_tx payment transactions have invalid data"
    ((fail_count++))
fi

# Test 5: Check webhook endpoint is accessible
echo ""
echo "Test 5: Checking webhook endpoint..."
webhook_check=$(curl -s -o /dev/null -w "%{http_code}" -X POST http://localhost:5003/api/v1/webhooks/razorpay || true)

# We expect 400 or 401 (missing signature), not 404
if [ "$webhook_check" = "400" ] || [ "$webhook_check" = "401" ]; then
    echo -e "${GREEN}✓ PASS${NC}: Webhook endpoint is accessible (HTTP $webhook_check)"
    ((pass_count++))
else
    echo -e "${YELLOW}⚠ WARN${NC}: Webhook endpoint check returned HTTP $webhook_check"
    # Don't count as failure, just a warning
fi

# Test 6: Check database constraints
echo ""
echo "Test 6: Checking database constraints..."
constraint_check=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c "
    SELECT COUNT(*) 
    FROM information_schema.table_constraints 
    WHERE table_name = 'payment_transactions' 
    AND constraint_type = 'FOREIGN KEY';
" | tr -d ' ')

if [ "$constraint_check" -ge 1 ]; then
    echo -e "${GREEN}✓ PASS${NC}: Database constraints are in place"
    ((pass_count++))
else
    echo -e "${YELLOW}⚠ WARN${NC}: No foreign key constraints found"
fi

# Test 7: Check indexes
echo ""
echo "Test 7: Checking database indexes..."
index_count=$(docker exec aarya_postgres psql -U postgres -d aarya_clothing -t -c "
    SELECT COUNT(*) 
    FROM pg_indexes 
    WHERE tablename = 'payment_transactions';
" | tr -d ' ')

if [ "$index_count" -ge 3 ]; then
    echo -e "${GREEN}✓ PASS${NC}: Database indexes are in place ($index_count indexes)"
    ((pass_count++))
else
    echo -e "${YELLOW}⚠ WARN${NC}: Few indexes found ($index_count)"
fi

# Summary
echo ""
echo "========================================"
echo "TEST SUMMARY"
echo "========================================"
echo -e "Passed: ${GREEN}$pass_count${NC}"
echo -e "Failed: ${RED}$fail_count${NC}"
echo ""

if [ "$fail_count" -eq 0 ]; then
    echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    echo ""
    echo "Payment transaction system is fully operational!"
    exit 0
else
    echo -e "${RED}✗ SOME TESTS FAILED${NC}"
    echo ""
    echo "Please review the failures above."
    exit 1
fi
