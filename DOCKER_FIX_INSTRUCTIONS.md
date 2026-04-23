# Docker Fix Instructions for Payment Service

## Issue Summary
After commit `02b5f07` (CRITICAL FIX: Razorpay webhook parsing bug + QR code payment linking), the payment service had a critical bug that caused all `payment.captured` webhooks to crash, preventing order creation.

## Root Cause
File: `services/payment/service/payment_service.py`  
Lines: 691, 695  
Issue: Undefined variable `status` was being used instead of `event_info.get("status")`

## Fix Applied
```python
# Before (BROKEN):
if status in ["captured", "authorized", "completed"] and transaction.status != "completed":
    transaction.status = "completed"
elif status in ["failed", "rejected"] and transaction.status != "failed":
    transaction.status = "failed"

# After (FIXED):
webhook_status = event_info.get("status", "")
if webhook_status in ["captured", "authorized", "completed"] and transaction.status != "completed":
    transaction.status = "completed"
elif webhook_status in ["failed", "rejected"] and transaction.status != "failed":
    transaction.status = "failed"
```

## Files Modified
1. `services/payment/service/payment_service.py` - Fixed undefined `status` variable

## Recovery Steps

### Step 1: Apply the Fix
The fix has already been applied to `services/payment/service/payment_service.py`. Verify it:

```bash
cd /opt/Aarya_clothing_frontend
grep -n "webhook_status = event_info.get" services/payment/service/payment_service.py
# Should show: 691:                webhook_status = event_info.get("status", "")
```

### Step 2: Rebuild Payment Service Docker Image

```bash
# Rebuild the payment service
docker-compose build payment

# Or rebuild all services (recommended)
docker-compose build
```

### Step 3: Restart Services in Correct Order

The services need to be started in the correct order to avoid dependency issues:

```bash
# Stop all services
docker-compose down

# Start database layer first
docker-compose up -d postgres redis pgbouncer

# Wait for database to be healthy (check with: docker-compose logs postgres)
sleep 30

# Start core service (payment and commerce depend on it)
docker-compose up -d core

# Wait for core to start
sleep 10

# Start commerce service (payment depends on it for internal API)
docker-compose up -d commerce

# Wait for commerce to start
sleep 10

# Start payment service
docker-compose up -d payment

# Start remaining services
docker-compose up -d admin frontend_new nginx
```

### Step 4: Replay the Lost Webhook (Optional)

If the webhook for `pay_Sf2CAGW41ycUri` was not processed and Razorpay doesn't resend it automatically, you can manually replay it:

```bash
# Get the webhook payload from the database
psql -h pgbouncer -p 6432 -U postgres -d aarya_clothing \
  -c "SELECT payload FROM webhook_events \
       WHERE payload->'payload'->'payment'->'entity'->>'id' = 'pay_Sf2CAGW41ycUri' \
       ORDER BY created_at DESC LIMIT 1;"

# Then replay it using curl (replace with actual payload)
curl -X POST http://localhost:5003/api/v1/webhooks/razorpay \
  -H "X-Razorpay-Signature: <signature>" \
  -H "Content-Type: application/json" \
  -d '<webhook_payload>'
```

Or use the recovery script provided.

### Step 5: Run Recovery Script

```bash
# Make script executable
chmod +x scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py

# Run the recovery (inside docker or with DB access)
# If running from host:
export DB_HOST=pgbouncer
export DB_PORT=6432
export DB_NAME=aarya_clothing
export DB_USER=postgres
export DB_PASSWORD=<your_password>
python3 scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py

# If running inside docker container:
docker-compose exec payment python scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py
```

## Docker Compose Dependencies Fix (Recommended)

The payment service depends on the commerce service (to call internal API), but the docker-compose.yml doesn't reflect this. Update the payment service dependencies:

### In `docker-compose.yml`:

Find the `payment:` service section and update `depends_on:`:

```yaml
  payment:
    build:
      context: .
      dockerfile: services/payment/Dockerfile
    container_name: aarya_payment
    env_file:
      - .env
    environment:
      # ... existing environment variables ...
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
      core:
        condition: service_started
      commerce:  # ADD THIS
        condition: service_started  # ADD THIS
    # ... rest of configuration ...
```

This ensures commerce is started before payment service tries to call its internal endpoints.

## Verification

### Check Payment Service is Running
```bash
docker-compose ps payment
docker-compose logs -f payment
```

### Check Webhook Processing
```bash
# Check for errors in payment service logs
docker-compose logs payment | grep -i "error\|exception\|failed\|pay_Sf2CAGW41ycUri"
```

### Verify Order Creation
```bash
# Check if order was created
psql -h pgbouncer -p 6432 -U postgres -d aarya_clothing \
  -c "SELECT id, user_id, total_amount, transaction_id, razorpay_payment_id, status \
       FROM orders WHERE razorpay_payment_id = 'pay_Sf2CAGW41ycUri' OR transaction_id = 'pay_Sf2CAGW41ycUri';

# Check if payment transaction exists
psql -h pgbouncer -p 6432 -U postgres -d aarya_clothing \
  -c "SELECT id, user_id, amount, razorpay_payment_id, status \
       FROM payment_transactions WHERE razorpay_payment_id = 'pay_Sf2CAGW41ycUri';
"  
```

## For Customer kirtisumi.1991@gmail.com +91 7717 759940

The recovery script will:
1. Find the user by email/phone
2. Look for the webhook event
3. Get cart snapshot from audit logs or recent orders
4. Create payment transaction if missing
5. Create order with items
6. Link everything properly

The script will output:
- Order ID
- Invoice Number
- Items Purchased
- Total Amount
- Customer Details

Then the order will:
- Appear in admin dashboard
- Be visible to customer in their order history
- Be properly linked to the Razorpay payment

## What the Customer Bought

Run the recovery script to find out. The script will output the items if they can be recovered from:
- Cart snapshot in audit logs
- Recent orders for the same user
- Webhook payload (if cart data was included)

If no cart data is found, you'll need to manually add items to the order in the admin panel.

## Preventing Future Issues

1. **Code Review**: Always test webhook payload parsing changes
2. **Monitoring**: Set up alerts for webhook processing failures
3. **Dependencies**: Ensure docker-compose.yml has correct service dependencies
4. **Retry Logic**: Implement retry for failed internal API calls
5. **Backup**: Regular database backups before deployments

## Emergency Contacts

If you need immediate help:
1. Check Docker logs: `docker-compose logs -f payment commerce`
2. Check database: Connect to pgbouncer:6432/aarya_clothing
3. Run recovery script as shown above
