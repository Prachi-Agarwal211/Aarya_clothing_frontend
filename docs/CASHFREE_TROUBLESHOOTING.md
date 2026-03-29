# Cashfree Credentials Troubleshooting Guide

## 🔴 **Current Issue**

**Error:** `authentication Failed`  
**HTTP Status:** 401 Unauthorized  
**Credentials Being Used:**
```
App ID: cfsk_REDACTED_HEX_REDACTED_HEX_REDACTED
Secret: CASHFREE_APP_REDACTED
```

---

## ✅ **Verification Steps Completed**

- ✅ Headers are formatted correctly (`x-client-id`, `x-client-secret`, `x-api-version`)
- ✅ API endpoint is correct (`https://api.cashfree.com/pg/orders`)
- ✅ API version is correct (`2025-01-01`)
- ✅ Content-Type is correct (`application/json`)
- ✅ Request payload is correct

**Conclusion:** Credentials are being rejected by Cashfree's authentication server.

---

## 🔍 **Possible Reasons (Even If Credentials Look Correct)**

### 1. **Account Not Activated** 🔴 MOST LIKELY
- Cashfree account created but not fully activated
- KYC (Know Your Customer) verification pending
- Account under review by Cashfree

**Action Required:**
- Log in to https://dashboard.cashfree.com
- Check if there's a "Complete Activation" or "KYC Pending" banner
- Complete all required verification steps
- Wait for activation email from Cashfree

---

### 2. **Wrong Account Type**
- Credentials are for **sandbox** but trying to use **production** endpoint
- Or vice versa

**Check:**
- App ID format:
  - Production: `cfsk_REDACTED_...`
  - Sandbox: `cfsk_ma_sandbox_...` or `cfsk_ma_test_...`

**Your App ID:** `cfsk_REDACTED_HEX_REDACTED_HEX_REDACTED`
- Format looks like production ✅
- But maybe it's actually a sandbox account?

**Test:**
```bash
# Try sandbox endpoint
curl -X POST "https://sandbox.cashfree.com/pg/orders" \
  -H "x-api-version: 2025-01-01" \
  -H "x-client-id: cfsk_REDACTED_HEX_REDACTED_HEX_REDACTED" \
  -H "x-client-secret: CASHFREE_APP_REDACTED" \
  -d '{"order_id":"test","order_amount":100}'
```

---

### 3. **IP Whitelisting Required**
- Cashfree might require IP whitelisting for production access
- Your server IP might not be whitelisted

**Action Required:**
- Log in to Cashfree dashboard
- Go to Settings → Security → IP Whitelisting
- Add your server's public IP address
- For testing, you can temporarily allow all IPs (0.0.0.0/0)

---

### 4. **API Access Not Enabled**
- API access might be disabled in dashboard
- Need to enable "PG APIs" or "Payment Gateway APIs"

**Action Required:**
- Log in to Cashfree dashboard
- Go to Settings → API Keys
- Look for "Enable API Access" toggle
- Enable it if disabled

---

### 5. **Credentials Copied Incorrectly**
- Extra spaces before/after App ID or Secret Key
- Missing characters
- Wrong characters (0 vs O, 1 vs l, etc.)

**Verify:**
```bash
# Check for extra spaces
echo "APP_ID: [$(cat .env | grep CASHFREE_APP_ID | cut -d'=' -f2)]"
echo "SECRET: [$(cat .env | grep CASHFREE_SECRET_KEY | cut -d'=' -f2)]"
```

Should look like:
```
APP_ID: [cfsk_REDACTED_HEX_REDACTED_HEX_REDACTED]
SECRET: [CASHFREE_APP_REDACTED]
```

No extra spaces inside the brackets.

---

### 6. **Account Suspended/Banned**
- Account might be suspended due to:
  - Suspicious activity
  - Terms of service violation
  - Chargebacks/frauds

**Action Required:**
- Contact Cashfree support: support@cashfree.com
- Ask about account status

---

### 7. **Wrong Secret Key Type**
- Cashfree has different keys for different purposes:
  - **API Secret Key** (for server-side API calls) ← You need this
  - **Checkout Key** (for frontend SDK)
  - **Webhook Secret** (for verifying webhooks)

**Verify:**
- Make sure you copied the **API Secret Key**, not checkout key
- In dashboard, it should be labeled as "Secret Key" or "API Secret"

---

## 🧪 **Diagnostic Tests**

### Test 1: Check Account Status
```bash
# Try the authorize endpoint (if available)
curl -X POST "https://api.cashfree.com/auth/authorize" \
  -H "x-client-id: YOUR_APP_ID" \
  -H "x-client-secret: YOUR_SECRET"
```

If this returns a token → Account is active  
If this returns 401 → Account issue

---

### Test 2: Try Sandbox Endpoint
```bash
curl -X POST "https://sandbox.cashfree.com/pg/orders" \
  -H "x-api-version: 2025-01-01" \
  -H "x-client-id: YOUR_APP_ID" \
  -H "x-client-secret: YOUR_SECRET" \
  -d '{"order_id":"test","order_amount":100}'
```

If sandbox works → Your credentials are for sandbox, not production

---

### Test 3: Check API Version
```bash
# Try older API version (2024-08-01)
curl -X POST "https://api.cashfree.com/pg/orders" \
  -H "x-api-version: 2024-08-01" \
  -H "x-client-id: YOUR_APP_ID" \
  -H "x-client-secret: YOUR_SECRET" \
  -d '{"order_id":"test","order_amount":100}'
```

If older version works → Your account doesn't have access to 2025-01-01 API

---

## 📞 **Contact Cashfree Support**

If none of the above works, contact Cashfree:

**Email:** support@cashfree.com  
**Phone:** +91-80-4718-6600 (Bangalore)  
**Live Chat:** Available in dashboard

**What to tell them:**
```
Subject: API Authentication Failed - Account Activation Issue

Hi Cashfree Support,

I'm trying to use the PG Orders API but getting "authentication Failed" error.

My App ID: cfsk_REDACTED_HEX_REDACTED_HEX_REDACTED

I've verified:
- Credentials are copied correctly from dashboard
- Using correct endpoint (https://api.cashfree.com/pg/orders)
- Using correct headers (x-client-id, x-client-secret, x-api-version)

Can you please check:
1. Is my account fully activated?
2. Is API access enabled for my account?
3. Are there any IP restrictions on my account?
4. Is my App ID and Secret Key valid?

Error received:
{
  "message": "authentication Failed",
  "code": "request_failed",
  "type": "authentication_error"
}

Thanks,
[Your Name]
```

---

## 🎯 **IMMEDIATE WORKAROUND**

While waiting for Cashfree issue to be resolved:

**Option 1: Use Razorpay Only**
```bash
# In .env file
CASHFREE_ENABLED=false
```

Users will see only Razorpay option (which is working perfectly).

**Option 2: Use Cashfree Sandbox**
1. Create sandbox account at https://sandbox.cashfree.com
2. Get sandbox credentials
3. Set `CASHFREE_ENV=sandbox` in `.env`
4. Test with sandbox until production is activated

---

## 📊 **Current Status Summary**

| Component | Status | Notes |
|-----------|--------|-------|
| Frontend Code | ✅ Working | SDK loads, checkout works |
| Backend Code | ✅ Working | Service code is correct |
| API Endpoint | ✅ Correct | https://api.cashfree.com/pg/orders |
| Headers Format | ✅ Correct | x-client-id, x-client-secret, x-api-version |
| **Credentials** | ❌ **Rejected** | Authentication failing |
| Account Status | ❓ **Unknown** | Need to verify with Cashfree |

---

**Next Step:** Contact Cashfree support OR complete account activation in dashboard.
