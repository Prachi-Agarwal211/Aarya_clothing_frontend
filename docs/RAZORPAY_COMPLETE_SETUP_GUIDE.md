# 🚀 Complete Razorpay Integration Guide for Aarya Clothing

> **Last Updated:** March 19, 2026  
> **Project:** Aarya Clothing E-commerce Platform  
> **Payment Gateway:** Razorpay (Primary)  
> **Integration Status:** ✅ Backend & Frontend Ready

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Step 1: Razorpay Dashboard Setup](#step-1-razorpay-dashboard-setup)
4. [Step 2: Generate Webhook Secret](#step-2-generate-webhook-secret)
5. [Step 3: Configure Environment Variables](#step-3-configure-environment-variables)
6. [Step 4: Test Mode vs Live Mode](#step-4-test-mode-vs-live-mode)
7. [Step 5: Webhook Configuration (Optional for Testing)](#step-5-webhook-configuration)
8. [Step 6: Testing the Integration](#step-6-testing-the-integration)
9. [Step 7: Verification Checklist](#step-7-verification-checklist)
10. [Troubleshooting](#troubleshooting)
11. [Going Live](#going-live)
12. [API Reference](#api-reference)

---

## 📖 Overview

This guide walks you through the complete Razorpay integration for Aarya Clothing's e-commerce platform. The integration is **already implemented** in your codebase—you just need to configure your credentials and test.

### What's Already Built

✅ **Backend (FastAPI Payment Service)**
- `GET /api/v1/payment/config` - Get Razorpay public key
- `POST /api/v1/payments/razorpay/create-order` - Create payment order
- `POST /api/v1/payments/razorpay/verify-signature` - Verify payment signature
- `POST /api/v1/webhooks/razorpay` - Handle webhook events

✅ **Frontend (Next.js Checkout)**
- Razorpay modal integration
- Payment flow with error handling
- Stock validation before payment
- Automatic redirect on success

✅ **Security Features**
- HMAC signature verification
- Webhook signature validation
- Idempotent transaction processing
- Row-level locking to prevent double-charging

---

## ✅ Prerequisites

Before starting, ensure you have:

- [ ] **Razorpay Account** - Sign up at https://razorpay.com
- [ ] **Test Mode Credentials** - Available immediately after signup
- [ ] **Docker Environment** - For running the payment service
- [ ] **Bank Account Added** - In Razorpay dashboard (required for live mode)

### Your Current Status

Based on your setup:
- ✅ Razorpay account created
- ✅ `RAZORPAY_KEY_ID` obtained
- ✅ `RAZORPAY_KEY_SECRET` obtained
- ✅ Bank account added to Razorpay
- ⏳ Need to configure `RAZORPAY_WEBHOOK_SECRET`
- ⏳ Need to test the integration

---

## 🎯 Step 1: Razorpay Dashboard Setup

### 1.1 Access Your Dashboard

1. Go to https://dashboard.razorpay.com
2. Log in with your credentials
3. You'll see **Test Mode** toggle at the top-left (purple banner when enabled)

### 1.2 Find Your API Keys

**For Test Mode:**

1. Click on **Settings** (gear icon) → **API Keys**
2. Or navigate directly to: `https://dashboard.razorpay.com/app/keys`
3. You'll see:
   - **Key ID** (starts with `rzp_test_`)
   - **Key Secret** (click "Reveal" to see)

**For Live Mode:**

1. Toggle **Test Mode** OFF (top-left)
2. Go to **Settings** → **API Keys**
3. You'll see:
   - **Key ID** (starts with `rzp_live_`)
   - **Key Secret** (click "Reveal" to see)

### 1.3 Screenshot Guide

```
┌─────────────────────────────────────────────────────────┐
│  🟣 TEST MODE                                    [ON]   │  ← Toggle here
├─────────────────────────────────────────────────────────┤
│  Settings → API Keys                                    │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Key ID          │  rzp_test_xxxxxxxxxxxxxx     │   │
│  │  Key Secret      │  ••••••••••••••••••••••••   │   │
│  │                  │  [REVEAL] [COPY]             │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 1.4 Copy Your Credentials

Copy these values—you'll need them in Step 3:

```
Test Key ID:     rzp_test_XXXXXXXXXXXXXXXX
Test Key Secret: XXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## 🔐 Step 2: Generate Webhook Secret

The webhook secret is used to verify that webhook requests actually come from Razorpay.

### 2.1 What is a Webhook Secret?

A webhook secret is a random string that:
- Razorpay uses to sign webhook payloads
- Your backend uses to verify webhook authenticity
- Should be kept secret (never commit to Git)

### 2.2 Generate a Webhook Secret

**Option A: Using Python (Recommended)**

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

**Option B: Using OpenSSL**

```bash
openssl rand -hex 32
```

**Option C: Using Node.js**

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Option D: Online Generator**

1. Go to https://generate-secret.vercel.app/32
2. Copy the generated hex string

### 2.3 Example Output

```
Your webhook secret: a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6
```

⚠️ **Important:** Save this secret securely. You'll need it in Step 3 and Step 5.

---

## ⚙️ Step 3: Configure Environment Variables

### 3.1 Locate Your .env File

Your project uses Docker with environment variables. The file location:

```
/opt/Aarya_clothing_frontend/.env
```

If `.env` doesn't exist, create it from the template:

```bash
cd /opt/Aarya_clothing_frontend
cp .env.example .env
```

### 3.2 Add Razorpay Configuration

Open `.env` and find the **Payment Gateways** section:

```bash
nano .env
# or
code .env
# or
vim .env
```

Add/update these values:

```env
# ==================== Payment Gateways ====================
# Razorpay (Primary Payment Method)

# Test Mode Keys (starts with rzp_test_)
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_test_key_secret_here
RAZORPAY_WEBHOOK_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6

# Payment URLs (for redirect after payment)
PAYMENT_SUCCESS_URL=http://localhost:6005/checkout/confirm
PAYMENT_FAILURE_URL=http://localhost:6005/checkout/payment
```

### 3.3 Full .env Template for Razorpay

Here's a complete template with all Razorpay-related settings:

```env
# ==================== Environment ====================
ENVIRONMENT=development
DEBUG=true

# ==================== Database ====================
POSTGRES_PASSWORD=your_secure_password_here
DATABASE_URL=postgresql://postgres:your_secure_password_here@postgres:5432/aarya_clothing

# ==================== Redis ====================
REDIS_URL=redis://:your_redis_password_here@redis:6379/0
REDIS_PASSWORD=your_redis_password_here

# ==================== Security ====================
SECRET_KEY=your_secret_key_here

# ==================== Token Settings ====================
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# ==================== URLs ====================
NEXT_PUBLIC_API_URL=http://localhost:6005
ALLOWED_ORIGINS=["http://localhost:6004","http://localhost:6005"]

# ==================== Payment Gateways ====================
# Razorpay Configuration

# TEST MODE (use these for development)
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_test_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_generated_webhook_secret_hex

# LIVE MODE (uncomment when going live)
# RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
# RAZORPAY_KEY_SECRET=your_live_key_secret_here
# RAZORPAY_WEBHOOK_SECRET=your_live_webhook_secret

# Payment redirect URLs
PAYMENT_SUCCESS_URL=http://localhost:6005/checkout/confirm
PAYMENT_FAILURE_URL=http://localhost:6005/checkout/payment

# ==================== Service URLs (Internal Docker) ====================
PAYMENT_SERVICE_URL=http://payment:5003
```

### 3.4 Restart Docker Services

After updating `.env`, restart the payment service:

```bash
cd /opt/Aarya_clothing_frontend

# Option A: Restart only payment service
docker-compose -f docker-compose.dev.yml restart payment

# Option B: Full rebuild (recommended for env changes)
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d
```

### 3.5 Verify Configuration

Check if the payment service started correctly:

```bash
docker-compose -f docker-compose.dev.yml logs payment
```

Look for:
```
✓ Payment service: Razorpay client initialized
✓ Payment service started
```

If you see errors, check:
- `.env` file syntax (no spaces around `=`)
- Keys are copied correctly (no extra spaces)
- All required variables are set

---

## 🧪 Step 4: Test Mode vs Live Mode

### Understanding Razorpay Modes

Razorpay has two separate environments:

| Feature | Test Mode | Live Mode |
|---------|-----------|-----------|
| **Key Prefix** | `rzp_test_` | `rzp_live_` |
| **Real Money** | ❌ No | ✅ Yes |
| **Test Cards** | ✅ Yes | ❌ No |
| **Webhooks** | ✅ Yes (to test URL) | ✅ Yes (to production URL) |
| **Dashboard** | Separate view | Separate view |
| **Use For** | Development, Testing | Production |

### Test Mode Card Details

Use these test cards in Test Mode (no real money charged):

| Card Type | Card Number | CVV | Expiry | Result |
|-----------|-------------|-----|--------|--------|
| **Success** | 4111 1111 1111 1111 | 123 | Any future | Payment succeeds |
| **Failure** | 4111 1111 1111 1112 | 123 | Any future | Payment fails |
| **3D Secure** | 5267 3181 8797 5449 | 123 | Any future | OTP required |
| **American Express** | 3782 822463 10005 | 1234 | Any future | Success |
| **Net Banking** | Any bank | - | - | Success |
| **UPI** | Any UPI ID | - | - | Success |

### Switching Between Modes

**In Razorpay Dashboard:**
1. Click the **Test Mode** toggle (top-left)
2. Purple banner = Test Mode ON
3. No banner = Live Mode

**In Your .env File:**

For **Test Mode**:
```env
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=test_secret_here
```

For **Live Mode**:
```env
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=live_secret_here
```

⚠️ **Critical:** Never use live keys in development! Always test thoroughly in test mode first.

---

## 🔔 Step 5: Webhook Configuration

### What Are Webhooks?

Webhooks allow Razorpay to notify your backend about payment events:
- `payment.captured` - Payment succeeded
- `payment.failed` - Payment failed
- `refund.processed` - Refund completed

### Webhook Setup: Optional vs Required

| Scenario | Webhook Required? |
|----------|-------------------|
| **Local Development** | ❌ Optional (manual verification works) |
| **Testing on Staging** | ✅ Recommended |
| **Production** | ✅ **REQUIRED** |

### 5.1 For Local Testing (Optional)

You can skip webhook setup for initial testing. The frontend directly verifies payments using the `/verify-signature` endpoint.

### 5.2 For Production (Required)

#### Step A: Prepare Your Webhook URL

Your webhook endpoint is already implemented:

```
POST https://your-domain.com/api/v1/webhooks/razorpay
```

**Requirements:**
- Must be HTTPS (Razorpay requires secure endpoints)
- Must be publicly accessible (not localhost)
- Must return 200 OK within 30 seconds

#### Step B: Configure Webhook in Razorpay

1. Go to **Settings** → **Webhooks**
2. Or: `https://dashboard.razorpay.com/app/webhooks`
3. Click **+ Add New Webhook**

```
┌─────────────────────────────────────────────────────────┐
│  Add New Webhook                                        │
├─────────────────────────────────────────────────────────┤
│  URL: https://your-domain.com/api/v1/webhooks/razorpay  │
│                                                         │
│  Events to monitor:                                     │
│  ☑ payment.captured                                     │
│  ☑ payment.failed                                       │
│  ☑ refund.processed                                     │
│                                                         │
│  Secret: [your RAZORPAY_WEBHOOK_SECRET]                 │
│                                                         │
│  [Save]                                                 │
└─────────────────────────────────────────────────────────┘
```

4. **URL:** Enter your production webhook URL
5. **Events:** Select:
   - ✅ payment.captured
   - ✅ payment.failed
   - ✅ refund.processed
6. **Secret:** Paste your `RAZORPAY_WEBHOOK_SECRET`
7. Click **Save**

#### Step C: Verify Webhook Status

After saving:
1. Webhook shows as **Active**
2. You'll see **Recent Deliveries** below
3. Test with a payment to see delivery logs

### 5.3 Webhook Security

Your backend already implements:
- ✅ HMAC SHA256 signature verification
- ✅ Timing-safe comparison
- ✅ Idempotency checks (prevents duplicate processing)
- ✅ Event logging

---

## 🧪 Step 6: Testing the Integration

### 6.1 Start Your Development Environment

```bash
cd /opt/Aarya_clothing_frontend

# Start all services
docker-compose -f docker-compose.dev.yml up -d

# Check logs
docker-compose -f docker-compose.dev.yml logs -f payment frontend
```

### 6.2 Verify Backend is Running

```bash
# Check health endpoint
curl http://localhost:5003/health

# Expected response:
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

### 6.3 Test Payment Config Endpoint

```bash
curl http://localhost:6005/api/v1/payment/config

# Expected response:
{
  "razorpay": {
    "key_id": "rzp_test_XXXXXXXXXXXXXXXX",
    "enabled": true
  },
  "currency": "INR",
  "default_method": "razorpay"
}
```

If `key_id` is empty or `enabled` is false:
- Check `.env` file
- Restart payment service
- Check payment service logs

### 6.4 End-to-End Payment Test

#### Step 1: Add Items to Cart

1. Go to http://localhost:6004
2. Browse products
3. Add items to cart

#### Step 2: Proceed to Checkout

1. Click cart icon → **Checkout**
2. Add/select delivery address
3. Click **Continue to Payment**

#### Step 3: Initiate Payment

1. Review order summary
2. Click **Pay Now** button
3. Razorpay modal should open

**Expected Behavior:**
- Modal loads within 2 seconds
- Shows Aarya Clothing branding
- Displays correct amount
- Shows all payment methods (UPI, Cards, Net Banking, Wallets)

#### Step 4: Complete Test Payment

Use test card details:

```
Card Number: 4111 1111 1111 1111
CVV: 123
Expiry: 12/25 (any future date)
Name: Test Customer
```

**Flow:**
1. Enter card details
2. Click **Pay**
3. Should show "Payment Successful"
4. Redirect to `/checkout/confirm`

#### Step 5: Verify Success

On confirmation page, check:
- ✅ Order ID displayed
- ✅ Payment ID displayed
- ✅ Order status = "Confirmed"
- ✅ Email confirmation sent (if SMTP configured)

### 6.5 Test Failure Scenarios

#### Test Card Decline

Use card: `4111 1111 1111 1112`

**Expected:**
- Error message in Razorpay modal
- User stays on payment page
- Error displayed: "Payment failed. Please try again."
- No order created

#### Test Modal Dismissal

1. Open Razorpay modal
2. Click X (close) button

**Expected:**
- User stays on payment page
- No error message
- Can retry payment

### 6.6 Test Webhook (If Configured)

#### Using Razorpay Dashboard

1. Go to **Settings** → **Webhooks**
2. Find your webhook
3. Click **Test** (if available)
4. Or trigger a real test payment

#### Check Webhook Logs

In Razorpay Dashboard:
1. **Settings** → **Webhooks**
2. Scroll to **Recent Deliveries**
3. Check status: ✅ Success or ❌ Failed

In Your Backend Logs:

```bash
docker-compose -f docker-compose.dev.yml logs payment | grep webhook
```

Expected logs:
```
Webhook received: payment.captured
Webhook signature verified
Webhook processed successfully
```

---

## ✅ Step 7: Verification Checklist

### Pre-Launch Checklist

Copy this checklist and verify each item:

```markdown
## Configuration
- [ ] RAZORPAY_KEY_ID set in .env (test mode)
- [ ] RAZORPAY_KEY_SECRET set in .env (test mode)
- [ ] RAZORPAY_WEBHOOK_SECRET generated and set
- [ ] .env file not committed to Git
- [ ] Docker services restarted after .env changes

## Backend Verification
- [ ] /health endpoint returns "healthy"
- [ ] /api/v1/payment/config returns key_id
- [ ] Payment service logs show "Razorpay client initialized"
- [ ] No errors in payment service logs

## Frontend Verification
- [ ] Razorpay SDK loads successfully
- [ ] Razorpay modal opens on "Pay Now" click
- [ ] Correct amount displayed in modal
- [ ] Aarya Clothing branding visible

## Payment Flow Testing
- [ ] Test card payment succeeds (4111 1111 1111 1111)
- [ ] Test card payment fails gracefully (4111 1111 1111 1112)
- [ ] Modal dismissal works without errors
- [ ] Success redirect to /checkout/confirm
- [ ] Order created in database
- [ ] Stock reduced for purchased items

## Error Handling
- [ ] Network error shows user-friendly message
- [ ] Payment failure doesn't create order
- [ ] Signature verification rejects tampered responses
- [ ] Double-payment prevented (idempotency)

## Webhook (Production Only)
- [ ] Webhook URL is HTTPS
- [ ] Webhook configured in Razorpay dashboard
- [ ] Webhook secret matches .env
- [ ] payment.captured event processed
- [ ] payment.failed event processed
- [ ] Webhook deliveries show success

## Security
- [ ] Test keys used in development
- [ ] Live keys NOT in code/repository
- [ ] Webhook secret is strong (64+ characters)
- [ ] Signature verification enabled
- [ ] CORS configured correctly

## Performance
- [ ] Razorpay SDK loads < 2 seconds
- [ ] Payment modal opens < 1 second
- [ ] Signature verification < 500ms
- [ ] No layout shift on payment page
```

### Quick Verification Script

Run this script to verify your setup:

```bash
#!/bin/bash
# verify-razorpay.sh

echo "🔍 Razorpay Integration Verification"
echo "===================================="
echo ""

# Check .env file
if [ -f ".env" ]; then
    echo "✅ .env file exists"
    
    # Check Razorpay keys
    if grep -q "RAZORPAY_KEY_ID=rzp_test_" .env || grep -q "RAZORPAY_KEY_ID=rzp_live_" .env; then
        echo "✅ RAZORPAY_KEY_ID configured"
    else
        echo "❌ RAZORPAY_KEY_ID missing or invalid"
    fi
    
    if grep -q "RAZORPAY_KEY_SECRET=" .env; then
        echo "✅ RAZORPAY_KEY_SECRET configured"
    else
        echo "❌ RAZORPAY_KEY_SECRET missing"
    fi
    
    if grep -q "RAZORPAY_WEBHOOK_SECRET=" .env; then
        echo "✅ RAZORPAY_WEBHOOK_SECRET configured"
    else
        echo "⚠️  RAZORPAY_WEBHOOK_SECRET missing (optional for testing)"
    fi
else
    echo "❌ .env file not found"
fi

echo ""
echo "🔗 Backend Health Check"
echo "-----------------------"

# Check payment service health
HEALTH_RESPONSE=$(curl -s http://localhost:5003/health)
if echo "$HEALTH_RESPONSE" | grep -q '"status": "healthy"'; then
    echo "✅ Payment service is healthy"
    
    if echo "$HEALTH_RESPONSE" | grep -q '"razorpay": true'; then
        echo "✅ Razorpay is enabled"
    else
        echo "❌ Razorpay not enabled in payment service"
    fi
else
    echo "❌ Payment service not responding"
fi

echo ""
echo "🔑 Config Endpoint Check"
echo "------------------------"

# Check config endpoint
CONFIG_RESPONSE=$(curl -s http://localhost:6005/api/v1/payment/config)
if echo "$CONFIG_RESPONSE" | grep -q '"key_id": "rzp_'; then
    echo "✅ Config endpoint returns key_id"
else
    echo "❌ Config endpoint not returning key_id"
fi

echo ""
echo "🐳 Docker Container Status"
echo "-------------------------"

docker-compose -f docker-compose.dev.yml ps payment

echo ""
echo "📋 Next Steps"
echo "-------------"
echo "1. If all checks pass, proceed to payment flow testing"
echo "2. Use test card: 4111 1111 1111 1111"
echo "3. Verify order creation in database"
```

**Run the script:**

```bash
cd /opt/Aarya_clothing_frontend
chmod +x verify-razorpay.sh
./verify-razorpay.sh
```

---

## 🐛 Troubleshooting

### Common Issues and Solutions

#### Issue 1: "Payment service unavailable"

**Symptoms:**
- Frontend shows "Payment service unavailable"
- `/api/v1/payment/config` returns empty key_id

**Solutions:**
```bash
# 1. Check payment service logs
docker-compose -f docker-compose.dev.yml logs payment

# 2. Verify .env file
cat .env | grep RAZORPAY

# 3. Restart payment service
docker-compose -f docker-compose.dev.yml restart payment

# 4. Check if service is running
docker-compose -f docker-compose.dev.yml ps payment
```

#### Issue 2: "Failed to initialize payment"

**Symptoms:**
- Razorpay modal doesn't open
- Error: "Failed to initialize payment"

**Solutions:**
```bash
# 1. Check create-order endpoint
curl -X POST http://localhost:6005/api/v1/payments/razorpay/create-order \
  -H "Content-Type: application/json" \
  -d '{"amount": 10000, "currency": "INR", "receipt": "test_1"}'

# 2. Check for errors in response
# Expected: {"id": "order_xxx", "amount": 10000, ...}
```

**Common causes:**
- Invalid amount (must be in paise, e.g., ₹100 = 10000)
- Missing currency field
- Payment service not running

#### Issue 3: "Invalid payment signature"

**Symptoms:**
- Payment succeeds in Razorpay
- Verification fails with "Invalid signature"

**Solutions:**
1. Verify `RAZORPAY_KEY_SECRET` is correct
2. Check for extra spaces in .env:
   ```env
   # Wrong (spaces around =)
   RAZORPAY_KEY_SECRET = abc123
   
   # Correct
   RAZORPAY_KEY_SECRET=abc123
   ```
3. Restart payment service after .env changes

#### Issue 4: Razorpay SDK not loading

**Symptoms:**
- Modal doesn't open
- Console error: "Razorpay is not defined"

**Solutions:**
1. Check internet connection (SDK loads from CDN)
2. Verify script loads in browser DevTools → Network tab
3. Check for ad blockers blocking Razorpay domain
4. Try alternative SDK URL in frontend code

#### Issue 5: Webhook not triggering

**Symptoms:**
- Payment succeeds but webhook not received
- No entries in "Recent Deliveries"

**Solutions:**
1. **For local development:** Webhooks won't work to localhost
   - Use ngrok for testing: `ngrok http 6005`
   - Update webhook URL to ngrok URL

2. **For production:**
   - Verify webhook URL is HTTPS
   - Check firewall allows Razorpay IPs
   - Verify webhook secret matches

3. **Check webhook logs:**
   ```bash
   docker-compose -f docker-compose.dev.yml logs payment | grep webhook
   ```

#### Issue 6: "Razorpay credentials not configured"

**Symptoms:**
- Payment service logs show: "Razorpay credentials not configured"

**Solutions:**
```bash
# 1. Verify .env has all three variables
grep RAZORPAY .env

# 2. Check for typos (common mistakes)
# RAZORPAY_KEY_ID vs RAZORPAY_KEY
# RAZORPAY_KEY_SECRET vs RAZORPAY_SECRET

# 3. Ensure no quotes around values
# Wrong: RAZORPAY_KEY_ID="rzp_test_xxx"
# Correct: RAZORPAY_KEY_ID=rzp_test_xxx

# 4. Rebuild container
docker-compose -f docker-compose.dev.yml up -d --build payment
```

#### Issue 7: Payment succeeds but order not created

**Symptoms:**
- Razorpay shows success
- Redirects to confirmation page
- Order not in database

**Solutions:**
1. Check frontend logs for verification errors
2. Verify `/verify-signature` endpoint is called
3. Check database connection
4. Look for errors in payment service logs

---

## 🚀 Going Live

### Pre-Launch Requirements

Before switching to live mode:

- [ ] All test payments successful
- [ ] Webhook configured and tested
- [ ] SSL certificate installed (HTTPS required)
- [ ] Bank account verified in Razorpay
- [ ] Live API keys obtained
- [ ] .env updated with live keys
- [ ] Webhook URL updated to production URL

### Step-by-Step Go-Live

#### Step 1: Get Live Keys

1. Log in to Razorpay Dashboard
2. Toggle **Test Mode** OFF
3. Go to **Settings** → **API Keys**
4. Copy:
   - Live Key ID (`rzp_live_...`)
   - Live Key Secret

#### Step 2: Update .env

```bash
cd /opt/Aarya_clothing_frontend
nano .env
```

Update:
```env
# Change from test to live
RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXXXXXXXX
RAZORPAY_KEY_SECRET=your_live_key_secret_here

# Update webhook URL to production
# RAZORPAY_WEBHOOK_SECRET stays the same (or generate new one)
```

#### Step 3: Update Webhook URL

1. Go to **Settings** → **Webhooks**
2. Edit existing webhook
3. Change URL to production:
   ```
   https://aaryaclothings.com/api/v1/webhooks/razorpay
   ```
4. Save

#### Step 4: Deploy Changes

```bash
# Rebuild and restart
docker-compose -f docker-compose.dev.yml down
docker-compose -f docker-compose.dev.yml up -d

# Verify
docker-compose -f docker-compose.dev.yml logs payment
```

#### Step 5: Test Live Payment

⚠️ **Use small amount first!**

1. Create test order for ₹1 or ₹2
2. Complete payment with real card
3. Verify order created
4. Check webhook delivery
5. Refund the test payment

#### Step 6: Monitor

First 24 hours:
- Monitor payment success rate
- Check webhook delivery logs
- Watch for failed payments
- Verify all orders created correctly

### Rollback Plan

If issues occur:

```bash
# 1. Switch back to test keys
nano .env
# Change RAZORPAY_KEY_ID back to rzp_test_...

# 2. Restart payment service
docker-compose -f docker-compose.dev.yml restart payment

# 3. Investigate logs
docker-compose -f docker-compose.dev.yml logs -f payment
```

---

## 📚 API Reference

### Endpoints Summary

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| GET | `/api/v1/payment/config` | Get Razorpay public key | None |
| POST | `/api/v1/payments/razorpay/create-order` | Create payment order | User |
| POST | `/api/v1/payments/razorpay/verify-signature` | Verify payment | User |
| POST | `/api/v1/webhooks/razorpay` | Handle webhooks | Razorpay |

### Request/Response Examples

#### GET /api/v1/payment/config

**Request:**
```http
GET /api/v1/payment/config HTTP/1.1
Host: localhost:6005
```

**Response:**
```json
{
  "razorpay": {
    "key_id": "rzp_test_XXXXXXXXXXXXXXXX",
    "enabled": true
  },
  "currency": "INR",
  "default_method": "razorpay",
  "fee_structure": {
    "razorpay": {
      "type": "percentage",
      "rate": 2.0
    }
  }
}
```

#### POST /api/v1/payments/razorpay/create-order

**Request:**
```http
POST /api/v1/payments/razorpay/create-order HTTP/1.1
Host: localhost:6005
Content-Type: application/json
Authorization: Bearer <user_token>

{
  "amount": 99900,
  "currency": "INR",
  "receipt": "order_12345"
}
```

**Response:**
```json
{
  "id": "order_XXXXXXXXXXXXXXXX",
  "entity": "order",
  "amount": 99900,
  "amount_paid": 0,
  "amount_due": 99900,
  "currency": "INR",
  "receipt": "order_12345",
  "status": "created",
  "created_at": 1234567890
}
```

#### POST /api/v1/payments/razorpay/verify-signature

**Request:**
```http
POST /api/v1/payments/razorpay/verify-signature HTTP/1.1
Host: localhost:6005
Content-Type: application/json

{
  "razorpay_payment_id": "pay_XXXXXXXXXXXXXXXX",
  "razorpay_order_id": "order_XXXXXXXXXXXXXXXX",
  "razorpay_signature": "signature_here"
}
```

**Response (Success):**
```json
{
  "success": true,
  "razorpay_payment_id": "pay_XXXXXXXXXXXXXXXX",
  "razorpay_order_id": "order_XXXXXXXXXXXXXXXX"
}
```

**Response (Failure):**
```json
{
  "success": false,
  "error": {
    "code": "BAD_REQUEST",
    "description": "Invalid payment signature"
  }
}
```

### Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | BAD_REQUEST | Invalid signature or request |
| 401 | UNAUTHORIZED | Missing or invalid auth token |
| 404 | NOT_FOUND | Order not found |
| 500 | INTERNAL_ERROR | Server error |
| 503 | SERVICE_UNAVAILABLE | Payment service down |

---

## 📞 Support

### Razorpay Support

- **Documentation:** https://razorpay.com/docs
- **API Reference:** https://razorpay.com/docs/api
- **Test Cards:** https://razorpay.com/docs/payments/payments/test-card-upi-details
- **Support Email:** support@razorpay.com
- **Support Portal:** https://support.razorpay.com

### Internal Resources

- **Payment Service Code:** `/opt/Aarya_clothing_frontend/services/payment/`
- **Frontend Checkout:** `/opt/Aarya_clothing_frontend/frontend_new/app/checkout/payment/page.js`
- **Razorpay Client:** `/opt/Aarya_clothing_frontend/services/payment/core/razorpay_client.py`

---

## 📝 Appendix

### A. Environment Variable Reference

| Variable | Description | Example | Required |
|----------|-------------|---------|----------|
| `RAZORPAY_KEY_ID` | Razorpay API Key ID | `rzp_test_xxx` | ✅ Yes |
| `RAZORPAY_KEY_SECRET` | Razorpay API Secret | `abc123...` | ✅ Yes |
| `RAZORPAY_WEBHOOK_SECRET` | Webhook verification secret | `hex_string` | ⚠️ Production |
| `PAYMENT_SUCCESS_URL` | Redirect URL on success | `http://...` | ✅ Yes |
| `PAYMENT_FAILURE_URL` | Redirect URL on failure | `http://...` | ✅ Yes |

### B. Test Card Reference

| Scenario | Card Number | CVV | Expiry |
|----------|-------------|-----|--------|
| Success | 4111 1111 1111 1111 | 123 | 12/25 |
| Failure | 4111 1111 1111 1112 | 123 | 12/25 |
| 3D Secure | 5267 3181 8797 5449 | 123 | 12/25 |
| Amex | 3782 822463 10005 | 1234 | 12/25 |
| Discover | 6011 0009 9013 9424 | 123 | 12/25 |

### C. Webhook Event Types

| Event | Description | Action |
|-------|-------------|--------|
| `payment.captured` | Payment succeeded | Update order status |
| `payment.failed` | Payment failed | Notify user |
| `refund.processed` | Refund completed | Update refund status |

### D. File Locations

```
/opt/Aarya_clothing_frontend/
├── .env                              # Environment variables
├── .env.example                      # Template
├── services/payment/
│   ├── core/razorpay_client.py       # Razorpay SDK wrapper
│   ├── service/payment_service.py    # Payment logic
│   ├── main.py                       # API endpoints
│   └── schemas/payment.py            # Request/Response models
├── frontend_new/app/checkout/payment/
│   └── page.js                       # Checkout UI
└── docs/
    └── RAZORPAY_COMPLETE_SETUP_GUIDE.md  # This guide
```

---

**🎉 You're all set!** Follow this guide step-by-step, and you'll have Razorpay fully integrated and tested for Aarya Clothing.

**Need help?** Check the [Troubleshooting](#troubleshooting) section or review the verification checklist.
