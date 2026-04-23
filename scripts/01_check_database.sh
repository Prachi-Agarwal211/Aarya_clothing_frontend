#!/bin/bash
# Check database for payment pay_Sf2CAGW41ycUri
# Run this inside a container that has access to pgbouncer/PostgreSQL

echo "=========================================="
echo "Checking Database for Lost Order"
echo "=========================================="

# Set these from environment or defaults
PGHOST=${DB_HOST:-pgbouncer}
PGPORT=${DB_PORT:-6432}
PGDATABASE=${DB_NAME:-aarya_clothing}
PGUSER=${DB_USER:-postgres}
PGPASSWORD=${DB_PASSWORD:-postgres123}

echo "Connecting to: $PGUSER@$PGHOST:$PGPORT/$PGDATABASE"

# 1. Find user
PSQL="psql -h $PGHOST -p $PGPORT -U $PGUSER -d $PGDATABASE -t -A -F ',' -c"

echo ""
echo "=== 1. FINDING USER ==="
$PSQL "SELECT id, email, phone, username, created_at FROM users WHERE email LIKE '%kirtisumi%' OR phone LIKE '%7717759940%' ORDER BY created_at DESC;"

# 2. Find webhook event
echo ""
echo "=== 2. WEBHOOK EVENTS FOR pay_Sf2CAGW41ycUri ==="
$PSQL "SELECT id, event_type, gateway, created_at, processed, processing_error from webhook_events WHERE payload->'payload'->'payment'->'entity'->>'id' = 'pay_Sf2CAGW41ycUri' OR payload->'payload'->'payment'->>'id' = 'pay_Sf2CAGW41ycUri' ORDER BY created_at DESC LIMIT 5;"

# Get user ID for next queries
USER_ID=$($PSQL "SELECT id FROM users WHERE email = 'kirtisumi.1991@gmail.com' OR phone LIKE '%7717759940%' LIMIT 1;" | tr -d ' ')

if [ -n "$USER_ID" ]; then
    echo ""
    echo "=== 3. PAYMENT TRANSACTIONS FOR USER $USER_ID ==="
    $PSQL "SELECT id, transaction_id, razorpay_payment_id, amount, payment_method, status, order_id, created_at FROM payment_transactions WHERE user_id = $USER_ID ORDER BY created_at DESC LIMIT 10;"
    
    echo ""
    echo "=== 4. ORDERS FOR USER $USER_ID ==="
    $PSQL "SELECT id, invoice_number, transaction_id, razorpay_payment_id, total_amount, status, shipping_address, created_at FROM orders WHERE user_id = $USER_ID ORDER BY created_at DESC LIMIT 10;"
    
    echo ""
    echo "=== 5. CART SNAPSHOT FROM AUDIT ==="
    $PSQL "SELECT id, event_type, created_at, cart_snapshot, shipping_address FROM payment_order_audit WHERE user_id = $USER_ID AND cart_snapshot IS NOT NULL ORDER BY created_at DESC LIMIT 5;"
    
    echo ""
    echo "=== 6. ALL ORDERS WITH AMOUNT ~₹599 ==="
    $PSQL "SELECT o.id, o.user_id, o.total_amount, o.transaction_id, o.razorpay_payment_id, o.created_at, u.email, u.phone, SUBSTRING(o.shipping_address, 1, 150) as address FROM orders o JOIN users u ON o.user_id = u.id WHERE o.total_amount BETWEEN 598 AND 601 ORDER BY o.created_at DESC LIMIT 10;"
else
    echo ""
    echo "No user found!"
fi

echo ""
echo "=========================================="
echo "Check complete!"
echo "=========================================="
