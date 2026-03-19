# ✅ Hostinger Email Setup - Aarya Clothing

**Date:** March 2026  
**Email Provider:** Hostinger  
**Status:** Ready for Configuration

---

## 📧 Email Addresses to Configure

| Email | Purpose | Status |
|-------|---------|--------|
| `noreply@aaryaclothing.in` | Automated emails (orders, OTP, password reset) | ✅ Configured in backend |
| `info@aaryaclothing.in` | Customer contact (website inquiries) | ✅ Added to contact page |

---

## 🔧 Current Configuration

### **Backend (`.env` file)**
```bash
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=noreply@aaryaclothing.in
SMTP_PASSWORD=<to_be_added>
SMTP_TLS=true
EMAIL_FROM=noreply@aaryaclothing.in
EMAIL_FROM_NAME=Aarya Clothing
```

### **Contact Page**
- ✅ Displays: `info@aaryaclothing.in`
- ✅ Location: `frontend_new/app/contact/page.js`
- ✅ Clickable mailto link added

---

## 📋 Setup Steps for Hostinger Email

### **Step 1: Access Hostinger Email Dashboard** (2 minutes)

1. Log in to your Hostinger account: https://hpanel.hostinger.com
2. Go to **Email** section
3. Select your domain: `aaryaclothing.in`

### **Step 2: Create Email Accounts** (5 minutes)

#### Create `noreply@aaryaclothing.in`
1. Click **"Create Email Account"**
2. Email: `noreply@aaryaclothing.in`
3. Password: Generate strong password (save it!)
4. Storage: Use default (10GB on Business plan)
5. Click **Create**

#### Create `info@aaryaclothing.in`
1. Click **"Create Email Account"**
2. Email: `info@aaryaclothing.in`
3. Password: Generate strong password (save it!)
4. Storage: Use default
5. Click **Create**

**Save both passwords** - you'll need them!

### **Step 3: Configure DNS Records** (10 minutes)

In Hostinger hPanel → Email → DNS Management:

Hostinger usually auto-configures DNS, but verify these records exist:

#### MX Records (Receive Emails)
```
Type: MX
Host: @
Value: mx1.hostinger.com
Priority: 5

Type: MX
Host: @
Value: mx2.hostinger.com
Priority: 10
```

#### SPF Record (Prevent Spam)
```
Type: TXT
Host: @
Value: v=spf1 include:spf.hostinger.com ~all
```

#### DKIM Record (Authentication)
Hostinger auto-generates this. Find it in:
- Email → DNS Management → DKIM
- Should look like:
```
Type: TXT
Host: hostinger._domainkey
Value: v=DKIM1; k=rsa; p=MIGfMA0GCSqGSIb3DQEBAQUAA4...
```

#### DMARC Record (Optional but Recommended)
```
Type: TXT
Host: _dmarc
Value: v=DMARC1; p=none; rua=mailto:info@aaryaclothing.in
```

**DNS propagation:** Usually 15-30 minutes

### **Step 4: Update .env with Password** (2 minutes)

Edit `/opt/Aarya_clothing_frontend/.env`:

```bash
# Add the password you created for noreply@
SMTP_PASSWORD=your_actual_password_here
```

### **Step 5: Test Email Configuration** (5 minutes)

#### Test SMTP Connection
```bash
# Restart backend service
docker-compose -f docker-compose.dev.yml restart core

# Check logs
docker-compose -f docker-compose.dev.yml logs core | grep -i email
```

#### Test Scenarios
- [ ] Send test OTP email (try signup)
- [ ] Send test password reset email
- [ ] Place test order → check confirmation email
- [ ] Send email to `info@aaryaclothing.in` → verify it's received

### **Step 6: Access Webmail** (Optional)

You can access emails via:
- **Hostinger Webmail:** https://webmail.hostinger.com
- Login with: `noreply@aaryaclothing.in` or `info@aaryaclothing.in`
- Use the passwords you created

---

## 🧪 Testing Checklist

### Email Sending (noreply@)
- [ ] OTP email sends successfully
- [ ] Password reset email sends successfully
- [ ] Order confirmation email sends successfully
- [ ] Emails land in inbox (not spam)
- [ ] Email templates render correctly on mobile

### Email Receiving (info@)
- [ ] Can receive emails at info@aaryaclothing.in
- [ ] Can access webmail at webmail.hostinger.com
- [ ] Can send emails from info@aaryaclothing.in

### Website Integration
- [ ] Contact page shows correct email: `info@aaryaclothing.in`
- [ ] Mailto links work (click opens mail client)
- [ ] No console errors related to email

---

## 📊 Email Templates Ready

Your system automatically sends these branded emails:

1. **Password Reset** - Beautiful Aarya branding
2. **OTP Verification** - 6-digit code in styled box
3. **Email Verification** - Welcome + verification button
4. **Order Confirmation** - Full order details with items, pricing
5. **Order Shipped** - Tracking information + carrier details
6. **Order Delivered** - Delivery confirmation + review request
7. **Order Cancelled** - Cancellation details + refund info

All templates use your brand colors: `#F2C29A`, `#B76E79`, `#0B0608`

---

## 🔐 Hostinger Email Features

**Included in Your Plan:**
- ✅ 10GB storage per email (Business Email Hosting)
- ✅ Free domain (if purchased with Hostinger)
- ✅ Spam & virus protection
- ✅ 99.9% uptime guarantee
- ✅ Webmail + IMAP/POP3 access
- ✅ Forwarding & autoresponders
- ✅ 24/7 customer support

**Sending Limits:**
- 100 emails/hour (Business Starter)
- 500 emails/hour (Business Premium)
- More than enough for order confirmations & OTPs

---

## 💰 Cost Breakdown

**Hostinger Business Email Hosting:**
- Usually bundled with web hosting (FREE)
- Standalone: ~₹79-99/month
- Your plan likely includes it already

**Total Cost:** Likely ₹0 extra (included in hosting)

---

## 📞 Hostinger Support

### Contact Options
- 💬 **Live Chat:** 24/7 via hPanel
- 🎫 **Ticket System:** Available in dashboard
- 📚 **Knowledge Base:** https://www.hostinger.in/tutorials/email

### Quick Links
- Email Dashboard: https://hpanel.hostinger.com/email
- Webmail: https://webmail.hostinger.com
- DNS Management: https://hpanel.hostinger.com/dns

---

## 🚨 Troubleshooting

### SMTP Connection Failed
1. Verify SMTP_HOST is `smtp.hostinger.com`
2. Check SMTP_PORT is `465` (SSL) or `587` (TLS)
3. Ensure SMTP_TLS is `true`
4. Confirm SMTP_USER is full email: `noreply@aaryaclothing.in`
5. Double-check password (no extra spaces)

### Emails Going to Spam
1. Wait 24-48 hours (new domain reputation builds)
2. Verify SPF record includes Hostinger
3. Set up DKIM in Hostinger dashboard
4. Don't send bulk emails initially (warm up gradually)

### Can't Receive Emails
1. Check MX records point to Hostinger
2. Verify email account exists in Hostinger hPanel
3. Check mailbox isn't full (10GB limit)
4. Test from different email providers (Gmail, Yahoo)

### DNS Not Propagating
1. Wait up to 48 hours (usually 15-30 min)
2. Clear browser cache (Ctrl+Shift+Delete)
3. Use https://dnschecker.org to verify propagation
4. Try different DNS server (8.8.8.8)

---

## 📝 Quick Reference

| Setting | Value |
|---------|-------|
| **SMTP Host** | `smtp.hostinger.com` |
| **SMTP Port** | `465` (SSL) or `587` (TLS) |
| **IMAP Host** | `imap.hostinger.com` |
| **IMAP Port** | `993` (SSL) |
| **POP3 Host** | `pop.hostinger.com` |
| **POP3 Port** | `995` (SSL) |
| **Webmail URL** | https://webmail.hostinger.com |
| **Email Dashboard** | https://hpanel.hostinger.com/email |

---

## ✅ What's Been Configured

### Backend
- ✅ `.env` file updated with Hostinger SMTP settings
- ✅ Email service ready to send automated emails
- ✅ All email templates configured

### Frontend
- ✅ Contact page displays `info@aaryaclothing.in`
- ✅ Mailto links functional
- ✅ Footer and other pages ready

### Documentation
- ✅ This setup guide created
- ✅ DNS records documented
- ✅ Troubleshooting guide included

---

## 🎯 Next Steps

1. **Log in to Hostinger** → Create both email accounts
2. **Add passwords** to `.env` file
3. **Verify DNS records** in Hostinger dashboard
4. **Restart backend** service
5. **Test email sending** (place test order)
6. **Test email receiving** (send to info@)

**Total Time:** ~30 minutes  
**Difficulty:** Easy (Hostinger has simple interface)

---

**You're all set!** Just create the email accounts in Hostinger and add the passwords to `.env`. Everything else is already configured. 🚀
