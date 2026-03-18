# 🔒 FREE SSL CERTIFICATE - QUICK START

## ⚡ 3-Step Setup (Takes 5 minutes)

---

### **STEP 1: Update Your Email** 📧

Open `setup-ssl-docker.sh` and change line 10:

```bash
nano setup-ssl-docker.sh
```

Change this line:
```bash
EMAIL="admin@aaryaclothing.in"  # CHANGE THIS TO YOUR EMAIL
```

To:
```bash
EMAIL="your-real-email@gmail.com"  # Your actual email
```

Save and exit (Ctrl+X, Y, Enter)

---

### **STEP 2: Run Setup Script** 🚀

```bash
cd /opt/Aarya_clothing_frontend
./setup-ssl-docker.sh
```

**What it does:**
- ✅ Creates SSL directories
- ✅ Gets free certificate from Let's Encrypt
- ✅ Configures nginx for HTTPS
- ✅ Sets up auto-renewal
- ✅ Restarts services

**Wait for:** `🎉 SSL Certificate Setup Complete!`

---

### **STEP 3: Verify SSL** ✅

```bash
# Test in browser
firefox https://aaryaclothing.in

# Or check certificate
openssl x509 -in ./docker/nginx/ssl/fullchain.pem -text -noout | grep "Not After"
```

**Expected:** Shows expiry date (90 days from now)

---

## 🎯 That's It!

Your site now has **FREE HTTPS** with:
- ✅ Automatic renewal (every 90 days)
- ✅ A+ security rating
- ✅ No manual intervention needed

---

## 📋 Quick Commands

| Task | Command |
|------|---------|
| Check certificate expiry | `openssl x509 -enddate -noout -in ./docker/nginx/ssl/fullchain.pem` |
| Manual renewal | `./renew-ssl.sh` |
| View renewal logs | `tail -f /var/log/ssl-renewal.log` |
| Test SSL rating | Visit https://www.ssllabs.com/ssltest/ |

---

## 🆘 Troubleshooting

### Port 80 Error?
```bash
docker-compose stop nginx
./setup-ssl-docker.sh
```

### Domain Not Working?
```bash
# Check DNS
ping aaryaclothing.in
# Should show your server IP
```

### Need Help?
```bash
# View detailed logs
docker-compose logs certbot
docker-compose logs nginx
```

---

## 📞 Support

- **Full Guide**: `cat SSL_SETUP_GUIDE.md`
- **Let's Encrypt**: https://letsencrypt.org/support/

---

**Certificate Details:**
- **Provider**: Let's Encrypt (Free)
- **Validity**: 90 days
- **Auto-Renewal**: ✅ Enabled
- **Cost**: $0 (Forever Free)

---

**Created**: March 18, 2026  
**For**: Aarya Clothing (aaryaclothing.in)
