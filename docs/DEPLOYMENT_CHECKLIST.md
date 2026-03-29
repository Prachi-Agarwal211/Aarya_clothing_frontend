# 🚀 DUAL PAYMENT GATEWAY - DEPLOYMENT CHECKLIST

**Date:** March 27, 2026  
**Status:** Ready for Production Deployment

---

## 📋 PRE-DEPLOYMENT CHECKLIST

### 1. Environment Variables ✅

**File:** `.env`

```bash
# ==================== Razorpay Configuration ====================
RAZORPAY_KEY_ID=key_xxx                           # From Razorpay Dashboard
RAZORPAY_KEY_SECRET=secret_xxx                    # From Razorpay Dashboard
RAZORPAY_WEBHOOK_SECRET=whsec_xxx                 # From Razorpay Dashboard
RAZORPAY_CHECKOUT_CONFIG_ID=config_xxx            # From Razorpay Dashboard (enables UPI)

# ==================== Cashfree Configuration ====================
CASHFREE_APP_ID=CASHFREE_APP_REDACTED  # From Cashfree Dashboard
CASHFREE_SECRET_KEY=cfsk_REDACTED_xxx              # From Cashfree Dashboard
CASHFREE_ENV=production                           # production or sandbox

# ==================== Payment URLs ====================
PAYMENT_SUCCESS_URL=https://aaryaclothing.in/payment/success
PAYMENT_FAILURE_URL=https://aaryaclothing.in/payment/failure
PAYMENT_NOTIFY_URL=https://aaryaclothing.in/api/v1/webhooks/razorpay

# ==================== Service URLs ====================
CORE_SERVICE_URL=http://core:5001
COMMERCE_SERVICE_URL=http://commerce:5002
PAYMENT_SERVICE_URL=http://payment:5003
```

**Verification:**
- [ ] All Razorpay credentials are set
- [ ] All Cashfree credentials are set
- [ ] PAYMENT_SUCCESS_URL is correct
- [ ] PAYMENT_FAILURE_URL is correct
- [ ] PAYMENT_NOTIFY_URL is correct

---

### 2. Database Migration ✅

**File:** `migrations/add_cashfree_payment_support.sql`

**Steps:**

```bash
# 1. Connect to PostgreSQL
docker-compose exec postgres psql -U postgres -d aarya_clothing

# 2. Run migration
\i /opt/Aarya_clothing_frontend/migrations/add_cashfree_payment_support.sql

# 3. Verify columns were added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'payment_transactions' 
  AND column_name LIKE '%cashfree%';

# 4. Verify orders table
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' 
  AND (column_name LIKE '%cashfree%' OR column_name LIKE '%razorpay%');
```

**Expected Output:**
```
payment_transactions:
- cashfree_order_id
- cashfree_reference_id
- cashfree_session_id
- cashfree_signature

orders:
- razorpay_order_id
- razorpay_payment_id
- cashfree_order_id
- cashfree_reference_id
```

**Verification:**
- [ ] Migration script executed successfully
- [ ] All Cashfree columns added to payment_transactions
- [ ] All Razorpay/Cashfree columns added to orders
- [ ] Indexes created for performance

---

### 3. Docker Images Build ✅

**Build Command:**
```bash
# Rebuild all services with latest code
docker-compose build --no-cache payment commerce frontend

# Or build individually
docker-compose build payment
docker-compose build commerce
docker-compose build frontend
```

**Verification:**
```bash
# Check image build timestamps
docker images | grep aarya

# Expected output (timestamps should be recent):
aarya_payment     latest    xxxxx    2 minutes ago
aarya_commerce    latest    xxxxx    2 minutes ago
aarya_frontend    latest    xxxxx    2 minutes ago
```

**Verification:**
- [ ] Payment service image rebuilt
- [ ] Commerce service image rebuilt
- [ ] Frontend image rebuilt
- [ ] No build errors

---

### 4. Container Deployment ✅

**Start Services:**
```bash
# Start all services
docker-compose up -d

# Or restart specific services
docker-compose restart payment commerce frontend nginx
```

**Check Container Status:**
```bash
docker-compose ps
```

**Expected Output:**
```
NAME                STATUS                    PORTS
aarya_postgres      Up (healthy)              5432/tcp
aarya_redis         Up (healthy)              6379/tcp
aarya_meilisearch   Up (healthy)              7700/tcp
aarya_core          Up (healthy)              5001/tcp
aarya_commerce      Up (healthy)              5002/tcp
aarya_payment       Up (healthy)              5003/tcp
aarya_admin         Up                        5004/tcp
aarya_frontend      Up                        3000/tcp
aarya_nginx         Up                        80/tcp, 443/tcp
```

**Verification:**
- [ ] All containers are running
- [ ] Health checks passing
- [ ] No restart loops

---

### 5. Service Health Checks ✅

**Test Payment Service:**
```bash
curl http://localhost:5003/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "payment",
  "version": "1.0.0",
  "features": {
    "razorpay": true,
    "webhooks": true
  }
}
```

**Test Payment Config:**
```bash
curl http://localhost:5003/api/v1/payment/config
```

**Expected Response:**
```json
{
  "razorpay": {
    "key_id": "key_xxx",
    "enabled": true,
    "checkout_config_id": "config_xxx"
  },
  "cashfree": {
    "app_id": "CASHFREE_APP_REDACTED",
    "enabled": true,
    "env": "production"
  },
  "currency": "INR",
  "default_method": "razorpay",
  "fee_structure": {
    "razorpay": {"type": "percentage", "rate": 2.0},
    "cashfree": {"type": "percentage", "rate": 1.9}
  }
}
```

**Test Commerce Service:**
```bash
curl http://localhost:5002/health
```

**Expected Response:**
```json
{
  "status": "healthy",
  "service": "commerce",
  "version": "1.0.0"
}
```

**Test Frontend:**
```bash
curl -I http://localhost:6004
```

**Expected Response:**
```
HTTP/1.1 200 OK
Content-Type: text/html
```

**Verification:**
- [ ] Payment service health check passes
- [ ] Payment config endpoint returns both gateways
- [ ] Commerce service health check passes
- [ ] Frontend is accessible

---

### 6. Webhook Configuration ✅

**Razorpay Webhook:**

1. **Log in to Razorpay Dashboard:** https://dashboard.razorpay.com
2. **Go to:** Settings → Webhooks
3. **Add Webhook:**
   - **URL:** `https://aaryaclothing.in/api/v1/webhooks/razorpay`
   - **Events:** 
     - ✅ payment.captured
     - ✅ payment.failed
   - **Secret:** Copy from `.env` (RAZORPAY_WEBHOOK_SECRET)
4. **Save**

**Cashfree Webhook:**

1. **Log in to Cashfree Dashboard:** https://dashboard.cashfree.com
2. **Go to:** Settings → Webhooks
3. **Add Webhook:**
   - **URL:** `https://aaryaclothing.in/api/v1/webhooks/cashfree`
   - **Events:**
     - ✅ payment.success
     - ✅ payment.failure
   - **Secret:** (if required by Cashfree)
4. **Save**

**Verification:**
- [ ] Razorpay webhook URL is accessible
- [ ] Razorpay webhook events are selected
- [ ] Cashfree webhook URL is accessible
- [ ] Cashfree webhook events are selected

---

### 7. Test Payments ✅

**Test Razorpay Payment:**

1. **Add items to cart** on https://aaryaclothing.in
2. **Proceed to checkout**
3. **Select Razorpay** as payment method
4. **Complete payment** (use real card/UPI for production test)
5. **Verify:**
   - [ ] Payment completes successfully
   - [ ] Redirects to order confirmation page
   - [ ] Order is created in database
   - [ ] Cart is cleared

**Check Database:**
```sql
SELECT id, payment_method, transaction_id, status, total_amount, created_at
FROM orders
WHERE payment_method = 'razorpay'
ORDER BY created_at DESC
LIMIT 5;
```

**Test Cashfree Payment:**

1. **Add items to cart** on https://aaryaclothing.in
2. **Proceed to checkout**
3. **Select Cashfree** as payment method
4. **Complete payment** (use real card/UPI for production test)
5. **Verify:**
   - [ ] Payment completes successfully
   - [ ] Redirects to order confirmation page
   - [ ] Order is created in database
   - [ ] Cart is cleared

**Check Database:**
```sql
SELECT id, payment_method, cashfree_order_id, cashfree_reference_id, status, total_amount, created_at
FROM orders
WHERE payment_method = 'cashfree'
ORDER BY created_at DESC
LIMIT 5;
```

**Verification:**
- [ ] Razorpay payment test successful
- [ ] Cashfree payment test successful
- [ ] Orders created for both gateways
- [ ] Payment details stored correctly

---

### 8. Log Verification ✅

**Check Payment Service Logs:**
```bash
docker-compose logs -f payment | grep -i "cashfree\|razorpay"
```

**Expected Logs (Successful Payment):**
```
✓ Cashfree order created: id=order_123
✓ Cashfree return: order=order_123, payment=payment_456, status=PAID
✓ Cashfree payment verified: order=order_123
✓ Cashfree webhook processed: success=True
```

**Check Commerce Service Logs:**
```bash
docker-compose logs -f commerce | grep -i "order"
```

**Expected Logs (Order Creation):**
```
✓ Order created: id=123, payment_method=cashfree, user_id=456
✓ Cashfree payment verified: order=order_123
```

**Check Frontend Logs:**
```bash
docker-compose logs -f frontend
```

**Verification:**
- [ ] No errors in payment service logs
- [ ] No errors in commerce service logs
- [ ] No errors in frontend logs
- [ ] Payment verification logs present
- [ ] Order creation logs present

---

### 9. Frontend UI Verification ✅

**Visit:** https://aaryaclothing.in/checkout/payment

**Verify:**
- [ ] Both Razorpay and Cashfree options are shown
- [ ] No fee comparisons displayed
- [ ] No "Primary" or "Lower Fees" badges
- [ ] Both gateways appear as equal options
- [ ] Gateway selection works correctly
- [ ] Payment button text is "Pay Now"
- [ ] No gateway preference indicated

**Expected UI:**
```
Select Payment Method

○ Razorpay
  UPI, Cards, Net Banking, Wallets

○ Cashfree
  UPI, Cards, Net Banking, Wallets
```

**What should NOT appear:**
- ❌ "Primary" badge on Razorpay
- ❌ "Lower Fees" badge on Cashfree
- ❌ "Settlement: T+1 day" or "T+2 days"
- ❌ "Fees: ~1.9%" or "~2.0%"

---

### 10. Database Verification ✅

**Check Payment Transactions:**
```sql
SELECT 
    id,
    order_id,
    payment_method,
    razorpay_order_id,
    razorpay_payment_id,
    cashfree_order_id,
    cashfree_reference_id,
    status,
    amount,
    created_at
FROM payment_transactions
ORDER BY created_at DESC
LIMIT 10;
```

**Check Orders:**
```sql
SELECT 
    id,
    user_id,
    payment_method,
    transaction_id,
    razorpay_order_id,
    razorpay_payment_id,
    cashfree_order_id,
    cashfree_reference_id,
    status,
    total_amount,
    created_at
FROM orders
ORDER BY created_at DESC
LIMIT 10;
```

**Check Webhook Events:**
```sql
SELECT 
    gateway,
    event_type,
    event_id,
    processed,
    created_at
FROM webhook_events
ORDER BY created_at DESC
LIMIT 20;
```

**Verification:**
- [ ] Payment transactions have correct gateway fields
- [ ] Orders have correct payment method
- [ ] Webhook events are being logged
- [ ] No NULL payment IDs for completed orders

---

## 🎯 PRODUCTION DEPLOYMENT

### Final Steps

1. **Update Production .env:**
   ```bash
   # Copy verified .env to production server
   scp .env user@production-server:/opt/Aarya_clothing_frontend/.env
   ```

2. **Deploy to Production:**
   ```bash
   # On production server
   cd /opt/Aarya_clothing_frontend
   
   # Pull latest code
   git pull origin main
   
   # Rebuild images
   docker-compose build --no-cache payment commerce frontend
   
   # Restart services
   docker-compose up -d
   
   # Run migration
   docker-compose exec postgres psql -U postgres -d aarya_clothing \
     -f /opt/Aarya_clothing_frontend/migrations/add_cashfree_payment_support.sql
   ```

3. **Monitor Deployment:**
   ```bash
   # Watch logs
   docker-compose logs -f payment commerce frontend
   
   # Check container health
   watch docker-compose ps
   ```

4. **Test in Production:**
   - Make a small test purchase with Razorpay
   - Make a small test purchase with Cashfree
   - Verify both orders appear in database
   - Verify webhooks are being received

---

## 🚨 ROLLBACK PLAN

If issues occur:

1. **Revert to Previous Version:**
   ```bash
   git checkout <previous-commit>
   docker-compose build payment commerce
   docker-compose up -d payment commerce
   ```

2. **Disable Cashfree (if needed):**
   ```bash
   # In .env
   CASHFREE_ENABLED=false
   
   # Restart payment service
   docker-compose restart payment
   ```

3. **Use Razorpay Only:**
   - Cashfree can be disabled without affecting Razorpay
   - Razorpay continues to work independently

---

## ✅ DEPLOYMENT SIGN-OFF

**Completed By:** _________________  
**Date:** _________________  
**Time:** _________________  

**Checklist Verification:**
- [ ] Environment variables configured
- [ ] Database migration completed
- [ ] Docker images rebuilt
- [ ] Containers deployed successfully
- [ ] Service health checks passing
- [ ] Webhooks configured
- [ ] Test payments successful (Razorpay)
- [ ] Test payments successful (Cashfree)
- [ ] Logs verified
- [ ] Frontend UI verified
- [ ] Database records verified

**Status:** 🟢 **PRODUCTION READY**

---

**Next Steps:**
1. Monitor first few days of transactions
2. Track payment success rates for both gateways
3. Compare transaction fees
4. Optimize gateway routing if needed
