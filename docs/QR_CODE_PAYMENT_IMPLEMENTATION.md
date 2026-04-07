# UPI QR Code Payment Implementation - Complete

**Date:** 2026-04-05  
**Status:** ✅ Implementation Complete - Ready for Testing  
**Feature:** Pay with UPI QR Code (scan with GPay, PhonePe, Paytm)

---

## 🎯 What Was Implemented

A complete UPI QR Code payment system that allows customers to:
1. Select "UPI QR Code" as a payment option at checkout
2. Get a dynamic QR code displayed on the payment page
3. Scan the QR code with any UPI app (GPay, PhonePe, Paytm, BHIM)
4. Complete payment - system auto-detects and confirms

**Key Advantage:** No iframe needed, no redirect to Razorpay for UPI payments. QR code is displayed directly on your site.

---

## 📋 Changes Summary

### Backend (7 files modified/created)

| File | Changes | Lines |
|------|---------|-------|
| `services/payment/core/razorpay_client.py` | Added `create_qr_code()` and `fetch_qr_code()` methods | +80 |
| `services/payment/schemas/payment.py` | Added 3 new Pydantic schemas for QR code | +45 |
| `services/payment/models/payment.py` | Added `razorpay_qr_code_id` column | +3 |
| `services/payment/service/payment_service.py` | Modified `_handle_payment_captured()` for QR matching | +25 |
| `services/payment/main.py` | Added 2 new API endpoints | +140 |
| `services/payment/requirements.txt` | Added `requests==2.31.0` | +1 |
| `database/migrations/add_razorpay_qr_code_id.sql` | New migration file | +8 |

### Frontend (3 files modified)

| File | Changes | Lines |
|------|---------|-------|
| `frontend_new/lib/customerApi.js` | Added `createQrCode()` and `checkQrStatus()` methods | +8 |
| `frontend_new/app/checkout/payment/page.js` | Added QR UI with all states + polling logic | +350 |
| `frontend_new/next.config.js` | Added `rzp.io` to image remote patterns | +5 |

**Total:** ~665 lines of production-ready code

---

## 🏗️ Architecture

### Payment Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    USER FLOW                                 │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. User selects "UPI QR Code" on payment page              │
│     ↓                                                         │
│  2. Frontend → POST /api/v1/payments/razorpay/create-qr-code│
│     ↓                                                         │
│  3. Backend creates PaymentTransaction (status=pending)      │
│     ↓                                                         │
│  4. Backend → Razorpay QR API → gets image_url + qr_code_id │
│     ↓                                                         │
│  5. Frontend displays QR code image with countdown timer    │
│     ↓                                                         │
│  6. Frontend polls every 3s → POST /qr-status/{qr_code_id}  │
│     ↓                                                         │
│  7. User scans QR with UPI app → completes payment          │
│     ↓                                                         │
│  8. Razorpay → webhook payment.captured → Backend handler   │
│     ↓                                                         │
│  9. Backend updates transaction → status="completed"         │
│     ↓                                                         │
│  10. Polling detects "paid" → redirects to /checkout/confirm│
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Backend API Endpoints

#### 1. Create QR Code
```
POST /api/v1/payments/razorpay/create-qr-code
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 50000,  // in paise (₹500.00)
  "description": "Aarya Clothing Order"
}

Response:
{
  "qr_code_id": "qr_xxxxxxxx",
  "image_url": "https://rzp.io/i/xxxxx",
  "amount": 50000,
  "status": "active",
  "expires_at": 1712345678,
  "transaction_id": "qr_123_xxxxx"
}
```

#### 2. Check QR Status
```
POST /api/v1/payments/razorpay/qr-status/{qr_code_id}

Response (waiting):
{
  "status": "waiting",
  "qr_code_id": "qr_xxxxxxxx",
  "amount_received": 0,
  "payment_count": 0,
  "payment_id": null,
  "expires_at": 1712345678
}

Response (paid):
{
  "status": "paid",
  "qr_code_id": "qr_xxxxxxxx",
  "amount_received": 50000,
  "payment_count": 1,
  "payment_id": "pay_xxxxxxxx",
  "expires_at": 1712345678
}
```

---

## 🔧 How to Deploy

### Step 1: Run Database Migration

```bash
# Connect to your PostgreSQL database
psql -U <username> -d <database_name>

# Run the migration
\i /opt/Aarya_clothing_frontend/database/migrations/add_razorpay_qr_code_id.sql

# Verify column was added
\d payment_transactions
```

Expected output:
```
Column "razorpay_qr_code_id" should appear in the table structure
```

### Step 2: Rebuild Payment Service Docker Container

```bash
cd /opt/Aarya_clothing_frontend

# Rebuild payment service (includes new 'requests' package)
docker-compose build payment

# Restart payment service
docker-compose up -d payment

# Check logs
docker-compose logs -f payment | grep -i "qr"
```

### Step 3: Rebuild Frontend

```bash
cd /opt/Aarya_clothing_frontend/frontend_new

# Rebuild frontend
docker-compose build frontend

# Restart frontend service
docker-compose up -d frontend

# Or if using dev mode:
npm run build
```

### Step 4: Verify Deployment

```bash
# Check payment service is running
docker ps | grep payment

# Check frontend is running
docker ps | grep frontend

# Test QR code endpoint (requires auth token)
curl -X POST http://localhost:5001/api/v1/payments/razorpay/create-qr-code \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"amount": 10000, "description": "Test"}'
```

---

## 🧪 Testing Guide

### Prerequisites
- ✅ Razorpay **live mode** credentials configured (QR codes don't work in test mode)
- ✅ Database migration completed
- ✅ Docker containers rebuilt and running
- ✅ Test user account with valid checkout address

### Test Scenario 1: Basic QR Payment Flow

1. **Add item to cart**
   - Browse products → Add any product to cart

2. **Go to checkout**
   - Click cart → Proceed to checkout
   - Fill in delivery address

3. **Select UPI QR Code payment**
   - On payment page, select "UPI QR Code" option
   - Click "Pay Now"

4. **Verify QR code generation**
   - ✅ QR code image should appear (white background, black QR pattern)
   - ✅ Amount should display correctly
   - ✅ Countdown timer should start (30:00 → 29:59 → ...)
   - ✅ "Waiting for payment..." status should show
   - ✅ Cancel button should be visible

5. **Scan QR code**
   - Open GPay/PhonePe/Paytm on your phone
   - Scan the QR code from screen
   - Complete payment

6. **Verify payment detection**
   - ✅ Frontend should detect payment within 3-6 seconds
   - ✅ Status should change to "Payment Successful!"
   - ✅ Green checkmark should appear
   - ✅ Should auto-redirect to /checkout/confirm

7. **Verify order creation**
   - ✅ Order should be created in database
   - ✅ Payment method should show "upi_qr"
   - ✅ Order should appear in admin panel

### Test Scenario 2: QR Code Expiry

1. Generate QR code
2. Wait for 30 minutes (or modify expiry to 2 minutes for testing)
3. Verify:
   - ✅ Timer reaches 00:00
   - ✅ Status changes to "QR Code Expired"
   - ✅ Yellow clock icon appears
   - ✅ "Generate New QR Code" button appears

### Test Scenario 3: Cancel QR Payment

1. Generate QR code
2. Click "Cancel" button
3. Verify:
   - ✅ Polling stops immediately
   - ✅ QR code UI disappears
   - ✅ Returns to payment method selection
   - ✅ Can select another payment method

### Test Scenario 4: Webhook Integration

1. Generate QR code and complete payment
2. Check payment service logs:
   ```bash
   docker-compose logs payment | grep "payment.captured"
   ```
3. Verify:
   - ✅ Webhook received from Razorpay
   - ✅ Transaction status updated to "completed"
   - ✅ Payment ID linked to transaction
   - ✅ No duplicate transactions created

### Test Scenario 5: Error Handling

1. **Network error during generation**
   - Block payment service temporarily
   - Try to generate QR code
   - ✅ Should show error message
   - ✅ "Try Again" button should work

2. **Polling error**
   - Generate QR code
   - Block payment service
   - Verify:
     - ✅ Polling continues (doesn't stop on single error)
     - ✅ Retries next interval
     - ✅ Eventually shows error if service remains down

---

## 🎨 UI States

The QR payment UI has 5 distinct states:

### 1. Generating
```
[Spinner animation]
"Generating QR code..."
```

### 2. Waiting (for payment)
```
┌─────────────────────┐
│   [QR Code Image]   │
│   (white bg)        │
└─────────────────────┘

Scan to pay
₹500.00

Open any UPI app and scan this QR code
[GPay] [PhonePe] [Paytm] [BHIM]

⏳ Waiting for payment...
🕒 Expires in 28:45

[Cancel]
```

### 3. Paid
```
✓ (green, animated)
Payment Successful!
Redirecting to order confirmation...
```

### 4. Expired
```
🕒 (yellow)
QR Code Expired

This QR code has expired. Please generate a new one.

[Generate New QR Code]
```

### 5. Error
```
⚠️ (red)
Error

[Error message]

[Try Again]
```

---

## 🔐 Security Considerations

### ✅ Implemented
- Single-use QR codes (auto-close after payment)
- 30-minute expiry timer (prevents indefinite open payments)
- Amount is fixed in QR code (user cannot change amount)
- Transaction ID linked to QR code (traceability)
- Webhook signature verification (existing)
- Authentication required for API endpoints

### ⚠️ Notes
- QR codes only work in **live mode** (not test/sandbox)
- Amount matching used for webhook (less precise than payment_id)
- Frontend polling every 3s (adjustable, but 3s is reasonable)

---

## 🐛 Troubleshooting

### Issue: QR code not generating

**Symptoms:** Error "Failed to generate QR code"

**Check:**
```bash
# Payment service logs
docker-compose logs payment | grep -i "qr"

# Look for errors like:
# - "QR code creation failed"
# - "Razorpay credentials not configured"
```

**Solutions:**
1. Verify Razorpay credentials in `.env`:
   ```
   RAZORPAY_KEY_ID=rzp_live_xxxxx
   RAZORPAY_KEY_SECRET=xxxxx
   ```
2. Ensure you're using **live mode** (not test)
3. Check `requests` package is installed:
   ```bash
   docker-compose exec payment pip list | grep requests
   ```

### Issue: QR code image not displaying

**Symptoms:** Broken image icon instead of QR code

**Check:**
1. Browser console for CORS errors
2. CSP headers allow `rzp.io`

**Solution:**
Verify `next.config.js` has:
```javascript
images: {
  remotePatterns: [
    {
      protocol: 'https',
      hostname: 'rzp.io',
    },
  ],
}
```

### Issue: Payment not detected

**Symptoms:** User pays but frontend still shows "Waiting for payment..."

**Check:**
```bash
# Check Razorpay QR status
curl -X POST http://localhost:5001/api/v1/payments/razorpay/qr-status/qr_xxxxx \
  -H "Authorization: Bearer TOKEN"

# Check webhook logs
docker-compose logs payment | grep "payment.captured"

# Check transaction status
psql -U user -d db -c "SELECT * FROM payment_transactions WHERE razorpay_qr_code_id='qr_xxxxx';"
```

**Solutions:**
1. Verify webhook is configured in Razorpay dashboard
2. Check webhook URL is accessible from internet
3. Verify `_handle_payment_captured()` logic in payment_service.py

### Issue: Timer not counting down

**Symptoms:** Timer shows static time or "NaN:NaN"

**Check:**
1. Browser console for JavaScript errors
2. `qrExpiresAt` state is set correctly

**Solution:**
- Ensure `expires_at` is returned from backend as Unix timestamp
- Check `startQrTimer()` function is called after QR generation

---

## 📊 Monitoring

### Key Metrics to Track

1. **QR code generation success rate**
   ```bash
   docker-compose logs payment | grep "QR code created" | wc -l
   ```

2. **Average time to payment**
   - Monitor in admin panel - time between QR generation and order creation

3. **QR code expiry rate**
   ```bash
   docker-compose logs payment | grep "QR code expired" | wc -l
   ```

4. **Payment detection latency**
   - Time between actual payment and frontend detection (should be 3-6 seconds)

### Admin Panel Integration

Future enhancement: Add QR payment details to admin panel:
- QR code ID
- Time to payment
- Payment method: "UPI QR Code"
- UPI app used (if available from webhook)

---

## 🚀 Future Enhancements

### Phase 2 (Recommended)
- [ ] Static QR code for business (display on product pages)
- [ ] QR code payment history in user profile
- [ ] Analytics: Most used UPI apps for payments
- [ ] Multi-currency support (currently INR only)
- [ ] QR code email confirmation to user

### Phase 3 (Optional)
- [ ] WhatsApp integration (send QR code to user's phone)
- [ ] Shareable QR code link (for remote payments)
- [ ] Bulk QR code generation (for invoices)
- [ ] Custom branding on QR code page

---

## 📝 API Documentation

### Payment Methods Available

After implementation, your system supports:

| Method | Type | Description |
|--------|------|-------------|
| Razorpay (Hosted) | Redirect | User redirected to Razorpay checkout page |
| Cashfree (SDK) | Redirect | User redirected to Cashfree checkout page |
| **UPI QR Code** | **Inline** | **QR code displayed on your site (NEW)** |

### Supported UPI Apps

Users can scan QR code with:
- ✅ Google Pay (GPay)
- ✅ PhonePe
- ✅ Paytm
- ✅ BHIM
- ✅ Any UPI-enabled banking app

---

## ✅ Pre-Launch Checklist

- [ ] Database migration executed successfully
- [ ] Docker containers rebuilt and running
- [ ] Razorpay live mode credentials configured
- [ ] Test QR payment completed end-to-end
- [ ] Webhook verified working in Razorpay dashboard
- [ ] Frontend displays QR code correctly
- [ ] Timer countdown working
- [ ] Polling detects payment automatically
- [ ] Order created successfully after payment
- [ ] Admin panel shows "upi_qr" as payment method
- [ ] Error states tested (expiry, network error, etc.)
- [ ] Cancel functionality working
- [ ] Mobile responsive UI verified

---

## 📞 Support

For issues or questions:
- Check troubleshooting section above
- Review payment service logs: `docker-compose logs -f payment`
- Review frontend logs: `docker-compose logs -f frontend`
- Check Razorpay dashboard for QR code status: https://dashboard.razorpay.com

---

**Implementation completed:** 2026-04-05  
**Status:** ✅ Ready for testing  
**Next step:** Deploy and test with live Razorpay credentials
