# 📧 Hostinger Email Setup - Quick Summary

## ✅ What's Configured

### Email Addresses
- **`noreply@aaryaclothing.in`** - Automated emails (orders, OTP, password reset)
- **`info@aaryaclothing.in`** - Customer contact (displayed on website)

### Backend Configuration
- **File:** `/opt/Aarya_clothing_frontend/.env`
- **SMTP Host:** `smtp.hostinger.com`
- **SMTP Port:** `465` (SSL)
- **SMTP User:** `noreply@aaryaclothing.in`
- **SMTP Password:** (you need to add this)

### Frontend Configuration
- **Contact Page:** Displays `info@aaryaclothing.in`
- **Location:** `frontend_new/app/contact/page.js`

---

## 🎯 What You Need to Do (15 minutes)

### Step 1: Create Email Accounts in Hostinger (5 min)
1. Login to Hostinger: https://hpanel.hostinger.com
2. Go to **Email** section
3. Create `noreply@aaryaclothing.in` (save password)
4. Create `info@aaryaclothing.in` (save password)

### Step 2: Add Password to .env (2 min)
Edit `/opt/Aarya_clothing_frontend/.env`:
```bash
SMTP_PASSWORD=your_actual_password_here
```

### Step 3: Restart & Test (5 min)
```bash
docker-compose -f docker-compose.dev.yml restart core
```

Test by:
- Placing a test order
- Checking if confirmation email arrives
- Sending email to `info@aaryaclothing.in`

---

## 📋 Hostinger SMTP Settings

| Setting | Value |
|---------|-------|
| SMTP Host | `smtp.hostinger.com` |
| SMTP Port | `465` (SSL) |
| SMTP User | `noreply@aaryaclothing.in` |
| SMTP Password | (from Hostinger) |
| TLS/SSL | Yes |

---

## 🔗 Useful Links

- **Hostinger Email Dashboard:** https://hpanel.hostinger.com/email
- **Webmail:** https://webmail.hostinger.com
- **DNS Management:** https://hpanel.hostinger.com/dns

---

## 📞 Need Help?

**Full Setup Guide:** `/opt/Aarya_clothing_frontend/docs/EMAIL_SETUP_HOSTINGER.md`

**Hostinger Support:**
- Live Chat: 24/7 via hPanel
- Knowledge Base: https://www.hostinger.in/tutorials/email

---

**That's it!** Just create the emails in Hostinger and add the password. Everything else is ready! 🚀
