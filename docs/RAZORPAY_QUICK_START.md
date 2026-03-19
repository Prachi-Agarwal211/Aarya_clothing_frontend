# 🚀 Razorpay Quick Start Card

> **Print this page or keep it open while setting up Razorpay**

---

## ⚡ 5-Minute Setup (Test Mode)

### Step 1: Get Your Keys (2 min)

1. Go to https://dashboard.razorpay.com
2. Ensure **TEST MODE** is ON (purple banner at top)
3. Navigate to **Settings** → **API Keys**
4. Copy:
   - **Key ID**: `rzp_test_XXXXXXXXXXXXXXXX`
   - **Key Secret**: Click "REVEAL" to see

### Step 2: Generate Webhook Secret (30 sec)

Run one of these commands:

```bash
# Python
python3 -c "import secrets; print(secrets.token_hex(32))"

# Or OpenSSL
openssl rand -hex 32
```

Save the output (64 characters).

### Step 3: Update .env File (2 min)

```bash
cd /opt/Aarya_clothing_frontend
nano .env
```

Add/update these three lines:

```env
RAZORPAY_KEY_ID=rzp_test_YOUR_KEY_ID_HERE
RAZORPAY_KEY_SECRET=YOUR_KEY_SECRET_HERE
RAZORPAY_WEBHOOK_SECRET=YOUR_GENERATED_SECRET_HERE
```

**Save** (Ctrl+O, Enter) and **Exit** (Ctrl+X).

### Step 4: Restart Payment Service (30 sec)

```bash
docker-compose -f docker-compose.dev.yml restart payment
```

### Step 5: Verify (30 sec)

```bash
./scripts/verify-razorpay-setup.sh
```

Look for: **✓ ALL CHECKS PASSED**

---

## 🧪 Test Payment

1. Open http://localhost:6004
2. Add items to cart
3. Checkout → Payment
4. Click **Pay Now**
5. Use test card:

```
Card Number: 4111 1111 1111 1111
CVV: 123
Expiry: 12/25
Name: Test Customer
```

6. Click **Pay** → Should succeed!

---

## 🔧 Troubleshooting

| Problem | Quick Fix |
|---------|-----------|
| "Payment service unavailable" | `docker-compose -f docker-compose.dev.yml restart payment` |
| "Razorpay not configured" | Check .env for typos, restart payment |
| Modal doesn't open | Check browser console for errors |
| "Invalid signature" | Verify no spaces in .env around `=` |

---

## 📞 Need Help?

- **Full Guide:** `docs/RAZORPAY_COMPLETE_SETUP_GUIDE.md`
- **Verification:** `./scripts/verify-razorpay-setup.sh`
- **Logs:** `docker-compose -f docker-compose.dev.yml logs payment`

---

## 🎯 Going Live Checklist

- [ ] All test payments successful
- [ ] SSL certificate installed (HTTPS)
- [ ] Bank account verified in Razorpay
- [ ] Switch to LIVE keys (`rzp_live_...`)
- [ ] Configure production webhook URL
- [ ] Test with small amount (₹1)
- [ ] Monitor first 24 hours

---

## 🔐 Security Reminders

- ✅ Never commit `.env` to Git
- ✅ Use test keys in development
- ✅ Keep secrets secret (Key Secret, Webhook Secret)
- ✅ Use HTTPS in production
- ✅ Verify webhook signatures

---

**Quick Reference:**

```bash
# Verify setup
./scripts/verify-razorpay-setup.sh

# View logs
docker-compose -f docker-compose.dev.yml logs -f payment

# Restart service
docker-compose -f docker-compose.dev.yml restart payment

# Test health
curl http://localhost:5003/health

# Test config
curl http://localhost:6005/api/v1/payment/config
```

---

**Test Cards Reference:**

| Result | Card Number |
|--------|-------------|
| ✅ Success | 4111 1111 1111 1111 |
| ❌ Failure | 4111 1111 1111 1112 |
| 🔐 3D Secure | 5267 3181 8797 5449 |

---

Made with ❤️ for Aarya Clothing
