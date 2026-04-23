# Urgent Recovery: Lost Order pay_Sf2CAGW41ycUri - ₹599.00

**Customer:** kirtisumi.1991@gmail.com / +91 7717 759940  
**Payment ID:** pay_Sf2CAGW41ycUri  
**Amount:** ₹599.00  
**Status:** Captured in Razorpay but NOT recorded in database  
**Date:** Sat Apr 18, 10:45pm

---

## 🚨 ROOT CAUSE

**Critical Bug in Commit 02b5f07**  
File: `services/payment/service/payment_service.py`  
Lines: **691, 695**

**Bug:** Used undefined variable `status` instead of `event_info.get("status")`  
**Result:** ALL payment.captured webhooks crashed, preventing order creation

```python
# BROKEN CODE (lines 691, 695):
if status in ["captured", "authorized", "completed"]:  # ❌ 'status' is undefined!
    transaction.status = "completed"
elif status in ["failed", "rejected"]:  # ❌ 'status' is undefined!
    transaction.status = "failed"
```

```python
# FIXED CODE (lines 689-696):
webhook_status = event_info.get("status", "")  # ✅ Define variable first
if webhook_status in ["captured", "authorized", "completed"] and transaction.status != "completed":
    transaction.status = "completed"
    if not transaction.completed_at:
        transaction.completed_at = datetime.now(timezone.utc)
elif webhook_status in ["failed", "rejected"] and transaction.status != "failed":
    transaction.status = "failed"
```

---

## ✅ FIXES APPLIED

### 1. Code Fix (ALREADY DONE)
- ✅ Fixed `services/payment/service/payment_service.py` line 689-696
- ✅ Variable `webhook_status` now properly defined from `event_info.get("status", "")`

### 2. Docker Compose Fix (PENDING)
Add commerce service dependency to payment service:

In `docker-compose.yml`, find the `payment:` service and add:
```yaml
depends_on:
  postgres:
    condition: service_healthy
  redis:
    condition: service_healthy
  core:
    condition: service_started
  commerce:  # ⬅️ ADD THIS
    condition: service_started  # ⬅️ ADD THIS
```

**Why:** Payment service calls commerce internal API (`/api/v1/internal/cart/{user_id}`) to fetch cart data for order recovery. Without this dependency, payment may start before commerce is ready.

---

## 🎯 RECOVERY ROADMAP

### Method 1: FULL AUTOMATED RECOVERY (Recommended)

Run the master script that does everything:

```bash
# Make executable
chmod +x FIX_EVERYTHING\ *18.sh

# Run it (as root or with docker permissions)
./FIX_EVERYTHING\ *18.sh
```

This script will:
1. ✅ Fix the code bug (if not already fixed)
2. ✅ Fix docker-compose.yml dependencies
3. ✅ Rebuild all Docker images
4. ✅ Restart services in correct order
5. ✅ Run database checks
6. ✅ Execute recovery script
7. ✅ Output what customer bought

---

### Method 2: MANUAL STEP-BY-STEP RECOVERY

#### Step 1: Fix Docker Compose
```bash
# Add commerce dependency to payment service
python3 << 'PYEOF'
import re
with open('docker-compose.yml', 'r') as f:
    content = f.read()

# Add commerce dependency under payment service depends_on
content_new = re.sub(
    r'(payment:.*?depends_on:\s*\n(\s+\w+:\s*\n\s+condition: service_\w+\s*\n)+)',
    lambda m: m.group(0).rstrip() + '\n      commerce:\n        condition: service_started',
    content,
    flags=re.DOTALL
)

with open('docker-compose.yml', 'w') as f:
    f.write(content_new)
print("✓ Updated docker-compose.yml")
PYEOF
```

#### Step 2: Rebuild and Restart
```bash
# Stop everything
docker-compose down

# Rebuild
docker-compose build payment

# Start in order
docker-compose up -d postgres redis pgbouncer
sleep 30  # Wait for database

docker-compose up -d core
sleep 10

docker-compose up -d commerce
sleep 10

docker-compose up -d payment
sleep 15

docker-compose up -d admin frontend_new nginx
sleep 10
```

#### Step 3: Check Database
```bash
# Run this to see current state
docker-compose exec postgres psql -U postgres -d aarya_clothing << 'EOF'
-- Find user
SELECT id, email, phone FROM users 
WHERE email = 'kirtisumi.1991@gmail.com' OR phone LIKE '%7717759940%';

-- Find webhook (should exist but may not be processed)
SELECT id, event_type, processed, processing_error, created_at 
FROM webhook_events 
WHERE payload->'payload'->'payment'->'entity'->>'id' = 'pay_Sf2CAGW41ycUri';

-- Find if order already exists
SELECT o.id, o.invoice_number, o.total_amount, o.status, o.shipping_address 
FROM orders o
JOIN users u ON o.user_id = u.id 
WHERE u.email = 'kirtisumi.1991@gmail.com' OR u.phone LIKE '%7717759940%'
ORDER BY o.created_at DESC;
EOF
```

#### Step 4: Run Recovery Script
```bash
# Method A: Inside payment container
docker-compose exec payment python3 scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py

# Method B: From host (if Python + psycopg2 installed)
export DB_HOST=pgbouncer
export DB_PORT=6432
export DB_NAME=aarya_clothing
export DB_USER=postgres
export DB_PASSWORD=postgres123
python3 scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py
```

---

## 📦 RECOVERY SCRIPT OUTPUT EXAMPLE

When you run the recovery script, it will output something like:

```
================================================================================
RECOVERY SCRIPT: Lost Order pay_Sf2CAGW41ycUri
================================================================================

1. Looking for webhook event with payment_id: pay_Sf2CAGW41ycUri
   ✓ Found webhook event ID: 12345
   Event type: payment.captured

2. Looking for user by email/phone: kirtisumi.1991@gmail.com / +91 7717 759940
   ✓ Found user: ID=42, Email=kirtisumi.1991@gmail.com, Phone=+917717759940

3. Checking for existing payment transaction
   ✓ Found transaction: ID=99, Status=pending

4. Getting cart snapshot from audit logs
   ✓ Found 2 items in cart snapshot
      - Product Name 1 x 1 @ ₹299.50
      - Product Name 2 x 1 @ ₹299.50
   Address: John Doe, 123 Main St, Jaipur, Rajasthan 302001

5. Creating payment transaction
   Using existing transaction: 99

6. Creating order
   ✓ Order created: ID=100
   ✓ Marked webhook as processed

================================================================================
RECOVERY SUMMARY
================================================================================
Payment ID: pay_Sf2CAGW41ycUri
Razorpay Order ID: order_Sf2CAGW41ycUri
Amount: ₹599.00
Customer: kirtisumi.1991@gmail.com / +917717759940
Order ID: 100
Transaction ID: txn_123456
Invoice: INV-2026-000100

Items Purchased (2):
  • Product Name 1 x 1 = ₹299.50
  • Product Name 2 x 1 = ₹299.50
  Total: ₹599.00

Address:
  John Doe
  123 Main St, Jaipur
  Rajasthan 302001
  Phone: +917717759940
================================================================================
RECOVERY COMPLETE!
================================================================================
```

---

## 📊 HOW TO FIND WHAT CUSTOMER BOUGHT (If Recovery Script Fails)

### Option 1: Check Recent Orders for Same User
```bash
docker-compose exec postgres psql -U postgres -d aarya_clothing -c "
SELECT o.id, oi.product_id, oi.product_name, oi.quantity, oi.price 
FROM orders o 
JOIN order_items oi ON o.id = oi.order_id 
JOIN users u ON o.user_id = u.id 
WHERE u.email = 'kirtisumi.1991@gmail.com' 
ORDER BY o.created_at DESC 
LIMIT 3;
"
```

### Option 2: Check Cart Snapshots in Audit Log
```bash
docker-compose exec postgres psql -U postgres -d aarya_clothing -c "
SELECT cart_snapshot, shipping_address, created_at 
FROM payment_order_audit 
WHERE user_id = (SELECT id FROM users WHERE email = 'kirtisumi.1991@gmail.com') 
AND cart_snapshot IS NOT NULL 
ORDER BY created_at DESC 
LIMIT 5;
"
```

### Option 3: Check Webhook Payload
```bash
docker-compose exec postgres psql -U postgres -d aarya_clothing -c "
SELECT payload 
FROM webhook_events 
WHERE payload->'payload'->'payment'->'entity'->>'id' = 'pay_Sf2CAGW41ycUri';
"
```
Look for `notes` field in the webhook payload which may contain cart data.

---

## 🚀 QUICK COMMANDS

| Task | Command |
|------|---------
| Fix Docker Compose | `python3 scripts/fix_docker_deps.py` |
| Rebuild Payment | `docker-compose build payment` |
| Full Restart | `./FIX_EVERYTHING\ *18.sh` |
| Check DB State | `docker-compose exec postgres bash scripts/01_check_database.sh` |
| Recover Order | `docker-compose exec payment python3 scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py` |
| View Logs | `docker-compose logs -f payment` |

---

## 📋 FILES CREATED/MODIFIED

- ✅ **Fixed:** `services/payment/service/payment_service.py` (line 689-696)
- ✅ **Created:** `scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py`
- ✅ **Created:** `scripts/01_check_database.sh`
- ✅ **Created:** `FIX_EVERYTHING\ *18.sh` (master recovery script)
- ✅ **Created:** `DOCKER_FIX_INSTRUCTIONS.md`
- ✅ **Created:** `RECOVERY_SUMMARY.md` (this file)
- ⚠️ **Pending:** `docker-compose.yml` (add commerce dependency)

---

## 🎯 IMMEDIATE ACTIONS

### If you want everything done automatically:
```bash
./FIX_EVERYTHING\ *18.sh
```

### If you want to do it manually:
```bash
# 1. Fix docker-compose
python3 << 'EOF'
import re
with open('docker-compose.yml', 'r+') as f:
    c = f.read()
    f.seek(0)
    f.write(re.sub(r'(payment:.*?depends_on:.*?core:.*?condition: service_started)', r'\1\n      commerce:\n        condition: service_started', c, flags=re.DOTALL))
print("✓ Fixed docker-compose.yml")
EOF

# 2. Rebuild
docker-compose build payment

# 3. Restart in order
docker-compose down
docker-compose up -d postgres redis pgbouncer
sleep 30
docker-compose up -d core
sleep 10
docker-compose up -d commerce
sleep 10
docker-compose up -d payment
sleep 15
docker-compose up -d admin frontend_new nginx

# 4. Run recovery
sleep 5
docker-compose exec payment python3 scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py
```

---

## 💡 NOTES

1. **The fix prevents future orders from being lost** - All new webhooks will process correctly
2. **The recovery script restores the lost order** - It will appear in admin and customer dashboard
3. **Customer address comes from cart snapshot** - If no snapshot, you may need to add it manually
4. **If cart data is missing** - The script will create the order without items (you'll need to add them manually)

---

## 🎉 SUCCESS CRITERIA

After completing these steps, verify:

- ✅ No more `NameError: name 'status' is not defined` in payment logs
- ✅ Order appears in admin dashboard
- ✅ Customer kirtisumi.1991@gmail.com can see their order
- ✅ Order shows correct items, amount (₹599.00), and payment ID (pay_Sf2CAGW41ycUri)
- ✅ Order status is "confirmed"
- ✅ Payment transaction is "completed"

---

**Need Help?**
- Check logs: `docker-compose logs -f payment commerce admin`
- Check database: `docker-compose exec postgres psql -U postgres -d aarya_clothing`
- Re-run script: `./FIX_EVERYTHING\ *18.sh`
