# 🔐 Aarya Clothing — Complete Authentication System Specification

**Document Version:** 2.0  
**Last Updated:** April 10, 2026  
**Author:** Deep Audit & Architecture Analysis  
**Status:** Authoritative Reference — All Auth Decisions Must Reference This Doc

---

## 📋 TABLE OF CONTENTS

1. [System Architecture Overview](#1-system-architecture-overview)
2. [Authentication Flows — End to End](#2-authentication-flows--end-to-end)
3. [Email OTP System](#3-email-otp-system)
4. [SMS OTP System](#4-sms-otp-system)
5. [Rate Limiting & Throttling](#5-rate-limiting--throttling)
6. [Performance Under Load (100+ Concurrent Users)](#6-performance-under-load-100-concurrent-users)
7. [Token Lifecycle](#7-token-lifecycle)
8. [Security Architecture](#8-security-architecture)
9. [Known Bugs & Fixes](#9-known-bugs--fixes)
10. [Frontend Client Architecture](#10-frontend-client-architecture)
11. [Middleware Route Protection](#11-middleware-route-protection)
12. [Configuration Reference](#12-configuration-reference)
13. [Disaster Recovery](#13-disaster-recovery)
14. [Monitoring & Alerts](#14-monitoring--alerts)

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 1.1 High-Level Auth Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         AUTHENTICATION ARCHITECTURE                      │
│                                                                          │
│  Browser (Next.js Client)                                                │
│       │                                                                  │
│       │  POST /api/v1/auth/*                                             │
│       ▼                                                                  │
│  ┌─────────────┐                                                         │
│  │    Nginx    │  ← SSL termination, rate limiting, CSP headers          │
│  │  (Gateway)  │                                                         │
│  └──────┬──────┘                                                         │
│         │                                                                │
│         ▼                                                                │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐                │
│  │ Core Service│────▶│   Redis     │────▶│  PostgreSQL │                │
│  │  (FastAPI)  │     │  (OTP Store │     │  (Users DB) │                │
│  │  Port 5001  │     │   + Rate    │     │             │                │
│  │             │     │   Limiting) │     │             │                │
│  │ • Login     │     └──────┬──────┘     └─────────────┘                │
│  │ • Register  │            │                                           │
│  │ • OTP Gen   │            │ (reads OTP)                                │
│  │ • JWT Issue │            │                                           │
│  └──────┬──────┘            │                                           │
│         │                   │                                           │
│         │ (trigger)         ▼                                           │
│         │            ┌─────────────┐     ┌─────────────┐                │
│         └───────────▶│    SMTP     │     │   MSG91     │                │
│                      │  (Hostinger)│     │   SMS API   │                │
│                      │  Email OTP  │     │   SMS OTP   │                │
│                      └─────────────┘     └─────────────┘                │
└─────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Service Responsibilities

| Service | Auth Responsibility | Port |
|---------|-------------------|------|
| **Core Service** | User CRUD, authentication, OTP generation/verification, JWT issuance, password hashing, email sending | 5001 |
| **Redis** | OTP code storage (key-value), rate limiting counters, session tracking, login attempt counters | 6379 |
| **PostgreSQL** | User accounts, roles, password hashes (bcrypt), account lockout state, verification status | 5432 |
| **SMTP (Hostinger)** | Email delivery for OTP codes, verification links, password reset notifications | smtp.hostinger.com:465 |
| **MSG91** | SMS delivery for OTP codes (Indian phone numbers) | External API |
| **Nginx** | SSL termination, rate limiting (token bucket), request routing, CSP headers | 80/443 |
| **Frontend (Next.js)** | Auth UI, token management (cookies), session state, auto-refresh | 3000 |

### 1.3 OTP Delivery — Dual Channel System

The system supports **two OTP delivery channels**:

```
                    ┌──────────────────────────────┐
                    │   User Requests OTP          │
                    │   (Register / Forgot Pwd)    │
                    └──────────────┬───────────────┘
                                   │
                          User selects method
                                   │
                    ┌──────────────┴──────────────┐
                    │                             │
                    ▼                             ▼
          ┌─────────────────┐         ┌─────────────────┐
          │   EMAIL OTP     │         │    SMS OTP      │
          │   (Default ✅)  │         │  (Available ⚠️) │
          │                 │         │                 │
          │ SMTP Hostinger  │         │ MSG91 API       │
          │ Port 465 (TLS)  │         │ REST API        │
          │ noreply@        │         │ Template-based  │
          │ aaryaclothing.in│         │ 6-digit code    │
          │                 │         │                 │
          │ ✅ CONFIGURED   │         │ ⚠️ REQUIRES      │
          │ & WORKING       │         │   MSG91 KEY     │
          └─────────────────┘         └─────────────────┘
```

**CRITICAL:** Email OTP is the primary and ONLY guaranteed delivery method in production. SMS requires the `MSG91_AUTH_KEY` environment variable to be set. If it's empty, SMS OTP will fail with a 500 error.

---

## 2. AUTHENTICATION FLOWS — END TO END

### 2.1 User Registration with Email OTP

```
USER ACTION               FRONTEND                BACKEND              EXTERNAL
─────────                 ────────                ───────              ────────

1. Fill registration form
   (name, username,
    email, phone, pwd)

2. Select "EMAIL OTP"
   (or "SMS OTP")

3. Click "CONTINUE"
                          POST /api/v1/auth/register
                          {
                            full_name,
                            username,
                            email,
                            phone,
                            password,
                            role: "customer",
                            verification_method:
                              "otp_email" | "otp_sms"
                          }
                                                    1. Validate input
                                                    2. Check unique email/username/phone
                                                    3. Hash password (bcrypt, cost=12)
                                                    4. Create user in DB (unverified)
                                                    5. Generate 6-digit OTP
                                                    6. Store OTP in Redis (TTL: 10 min)
                                                    7. Send OTP via selected channel
                                                         │
                              ◀─────────────────────────┘
                              { success: true }

4. Show OTP input screen
   (6 digit boxes,
    120s countdown)

5. User enters OTP

6. Click "VERIFY"
                          POST /api/v1/auth/
                            verify-otp-registration
                            ?otp_code=123456
                            &email=user@x.com
                            &otp_type=EMAIL
                              (⚠️ BUG: query params)
                                                    1. Look up OTP in Redis
                                                    2. Verify code matches
                                                    3. Check expiry (10 min)
                                                    4. Check attempt count (max 3)
                                                    5. If valid:
                                                       - Mark user as verified
                                                       - Generate JWT access token
                                                       - Generate JWT refresh token
                                                       - Set HttpOnly cookies
                                                    6. If invalid:
                                                       - Increment attempt count
                                                       - Return error
                              ◀─────────────────────────┘
                              {
                                user: { ... },
                                tokens: { access_token, refresh_token }
                              }

7. Store user in localStorage
   setAuthData({ user })

8. Call checkAuth()
                          GET /api/v1/users/me
                                                    Return fresh user data
                              ◀─────────────────────────┘
                              { user: { ... } }

9. Auto-redirect to /products
```

### 2.2 User Login

```
USER ACTION               FRONTEND                BACKEND
─────────                 ────────                ────────

1. Enter username/email
   + password

2. Click "SIGN IN"
                          POST /api/v1/auth/login
                          {
                            username: "...",
                            password: "...",
                            remember_me: true
                          }
                                                    1. Find user by username/email/phone
                                                    2. Check account status
                                                       - Deactivated? → 403
                                                       - Not verified? → 403 EMAIL_NOT_VERIFIED
                                                       - Locked? → 403 LOCKED
                                                    3. Rate limit check (5 per 5 min)
                                                    4. Verify password (bcrypt compare)
                                                    5. If wrong:
                                                       - Increment failed attempts
                                                       - If 5 fails: lock account (30 min)
                                                    6. If correct:
                                                       - Generate JWT access token (30 min)
                                                       - Generate JWT refresh token (1440 min)
                                                       - Set HttpOnly cookies
                                                    7. Return user data
                              ◀─────────────────────────┘
                              {
                                user: { id, email, role, ... },
                                tokens: { access_token, refresh_token }
                              }

3. Store user in localStorage
   setAuthData({ user })

4. Redirect based on role:
   - customer → /products
   - staff → /admin/staff
   - admin → /admin
   - super_admin → /admin/super
```

### 2.3 Forgot Password via OTP

```
USER ACTION               FRONTEND                BACKEND              EXTERNAL
─────────                 ────────                ───────              ────────

1. Enter email/phone
   on forgot-password page

2. Select EMAIL or SMS

3. Click "SEND CODE"
                          POST /api/v1/auth/
                            forgot-password-otp
                          {
                            identifier: "user@x.com",
                            otp_type: "EMAIL" | "SMS"
                          }
                                                    1. Find user by identifier
                                                    2. Generate 6-digit OTP
                                                    3. Store OTP in Redis (TTL: 10 min)
                                                    4. Send OTP via selected channel
                                                         │
                              ◀─────────────────────────┘
                              { success: true }

4. Show OTP input screen
   (6 digit boxes,
    120s countdown)

5. User enters OTP

6. Click "VERIFY & RESET"
                          POST /api/v1/auth/
                            verify-reset-otp
                          {
                            identifier: "user@x.com",
                            otp_code: "123456",
                            otp_type: "EMAIL"
                          }
                                                    1. Look up OTP in Redis
                                                    2. Verify code matches
                                                    3. Check expiry
                                                    4. Check attempt count (max 3)
                                                    5. If valid:
                                                       { verified: true }
                              ◀─────────────────────────┘
                              { verified: true }

7. Store in sessionStorage:
   { identifier, otpType,
     verified: true, otpCode }

8. Redirect to
   /auth/reset-password
   ?verified=email&otp_type=EMAIL

9. Enter new password
   + confirm password

10. Click "RESET PASSWORD"
                          POST /api/v1/auth/
                            reset-password-with-otp
                          {
                            identifier: "user@x.com",
                            otp_code: "123456",
                            new_password: "...",
                            otp_type: "EMAIL"
                          }
                                                    1. Re-verify OTP (defense in depth)
                                                    2. Hash new password (bcrypt, cost=12)
                                                    3. Update password in DB
                                                    4. Invalidate all existing sessions
                              ◀─────────────────────────┘
                              { success: true }

11. Clear sessionStorage
12. Show success screen
13. User clicks "GO TO SIGN IN"
```

### 2.4 Change Password (Authenticated Users)

```
USER ACTION               FRONTEND                BACKEND
─────────                 ────────                ────────

1. Navigate to
   /auth/change-password
   (accessible to
    logged-in users only)

2. Enter current password
   + new password + confirm

3. Click "CHANGE PASSWORD"
                          POST /api/v1/auth/
                            change-password
                          [Authorization: Bearer cookie]
                          {
                            current_password: "...",
                            new_password: "..."
                          }
                                                    1. Verify current password (bcrypt)
                                                    2. Validate new password strength
                                                    3. Hash new password (bcrypt, cost=12)
                                                    4. Update password in DB
                                                    5. Return success
                              ◀─────────────────────────┘
                              { success: true }

4. Show success message
```

### 2.5 Token Refresh (Automatic)

```
TRIGGER                   FRONTEND                BACKEND
───────                   ────────                ────────

Proactive: Every 45 min
(while user is logged in)
                          POST /api/v1/auth/refresh
                          [cookies: refresh_token]
                                                    1. Validate refresh token
                                                    2. Check if revoked
                                                    3. Generate new access token
                                                    4. Set new HttpOnly cookie
                              ◀─────────────────────────┘
                              { access_token: "..." }

Reactive: When API returns 401
(auto-retry by BaseApiClient)
                          1. Request gets 401
                          2. _tryRefreshToken() fires
                          3. POST /api/v1/auth/refresh
                          4. If success → retry original request
                          5. If fail → clearAuthData()
                                                    

After login (initial):
                          Backend sets cookies automatically
                          in login/register response
```

---

## 3. EMAIL OTP SYSTEM

### 3.1 Configuration

```yaml
# docker-compose.yml — Core Service
environment:
  # SMTP — Hostinger
  - SMTP_HOST=smtp.hostinger.com
  - SMTP_PORT=465
  - SMTP_USER=noreply@aaryaclothing.in
  - SMTP_PASSWORD=Aarya@2026          # ⚠️ HARDCODED — should use env var
  - SMTP_TLS=true
  - EMAIL_FROM=noreply@aaryaclothing.in
  - EMAIL_FROM_NAME=Aarya Clothing

  # OTP Settings
  - OTP_CODE_LENGTH=6
  - OTP_EXPIRY_MINUTES=10
  - OTP_MAX_ATTEMPTS=3
  - OTP_RESEND_COOLDOWN_MINUTES=1
  - OTP_MAX_RESEND_PER_HOUR=5
```

### 3.2 Email OTP Flow — Step by Step

```
┌─────────────────────────────────────────────────────────────────┐
│  EMAIL OTP DELIVERY PIPELINE                                     │
│                                                                   │
│  Core Service (FastAPI)                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐   │
│  │ Generate OTP │──▶│ Store in     │──▶│ Send via SMTP      │   │
│  │ 6 digits     │   │ Redis        │   │ (Hostinger)        │   │
│  │ random       │   │ KEY: otp:    │   │ Port 465 (TLS)     │   │
│  │              │   │  {type}:{id} │   │                    │   │
│  │              │   │ VALUE: {     │   │ FROM: noreply@     │   │
│  │              │   │  code,       │   │  aaryaclothing.in  │   │
│  │              │   │  expires_at, │   │ TO: user's email   │   │
│  │              │   │  attempts: 0 │   │                    │   │
│  │              │   │ }            │   │ SUBJECT: "Your OTP"│   │
│  │              │   │ TTL: 600s    │   │ BODY: "Code: 123456│   │
│  └──────────────┘   └──────────────┘   └────────────────────┘   │
│                                    │                              │
│                                    ▼                              │
│                          ┌────────────────────┐                   │
│                          │   Hostinger SMTP   │                   │
│                          │   Mail Server      │                   │
│                          └────────┬───────────┘                   │
│                                   │                               │
│                                   ▼                               │
│                          ┌────────────────────┐                   │
│                          │   User's Inbox     │                   │
│                          │   (Gmail, Outlook, │                   │
│                          │    Yahoo, etc.)    │                   │
│                          └────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### 3.3 Email OTP — Rate Limits & Constraints

| Constraint | Value | Purpose |
|------------|-------|---------|
| OTP code length | 6 digits | 1 million possible codes |
| OTP expiry | 10 minutes | Security window |
| Max verification attempts | 3 per OTP | Brute force prevention |
| Resend cooldown | 1 minute | Prevent spam |
| Max resends per hour | 5 | Abuse prevention |
| SMTP connection | 1 (sequential) | Default aiosmtplib pool |

### 3.4 Email OTP — Known Issues

| Issue | Severity | Impact | Fix |
|-------|----------|--------|-----|
| SMTP password hardcoded in docker-compose | 🔴 HIGH | Credential exposure | Move to `.env` file |
| No email queue for bulk sends | 🟠 MEDIUM | Thundering herd on 100+ registrations | Add Redis queue for async email sending |
| No email delivery retry | 🟡 LOW | Single SMTP failure = lost OTP | Implement retry with exponential backoff |
| SMTP_PASSWORD visible in `docker-compose.yml` | 🔴 CRITICAL | Anyone with repo access sees password | Use `.env` with `SMTP_PASSWORD=${SMTP_PASSWORD}` |

---

## 4. SMS OTP SYSTEM

### 4.1 Configuration

```yaml
# docker-compose.yml — Core Service
environment:
  # MSG91 SMS API
  - MSG91_AUTH_KEY=${MSG91_AUTH_KEY:-}        # ⚠️ EMPTY BY DEFAULT
  - MSG91_TEMPLATE_ID=${MSG91_TEMPLATE_ID:-}  # ⚠️ EMPTY BY DEFAULT
  - MSG91_SENDER_ID=${MSG91_SENDER_ID:-}      # ⚠️ EMPTY BY DEFAULT
```

### 4.2 SMS OTP Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  SMS OTP DELIVERY PIPELINE                                       │
│                                                                   │
│  Core Service (FastAPI)                                          │
│  ┌──────────────┐   ┌──────────────┐   ┌────────────────────┐   │
│  │ Generate OTP │──▶│ Store in     │──▶│ Send via MSG91     │   │
│  │ 6 digits     │   │ Redis        │   │ REST API           │   │
│  │              │   │              │   │                    │   │
│  │              │   │              │   │ POST /api/v2/send  │   │
│  │              │   │              │   │ {                  │   │
│  │              │   │              │   │   authkey: "...",  │   │
│  │              │   │              │   │   template_id: "", │   │
│  │              │   │              │   │   sender: "",      │   │
│  │              │   │              │   │   mobiles: "91XXX" │   │
│  │              │   │              │   │ }                  │   │
│  └──────────────┘   └──────────────┘   └────────────────────┘   │
│                                    │                              │
│                                    ▼                              │
│                          ┌────────────────────┐                   │
│                          │   MSG91 API        │                   │
│                          │   (External)       │                   │
│                          │   Rate limit:      │                   │
│                          │   varies by plan   │                   │
│                          └────────┬───────────┘                   │
│                                   │                               │
│                                   ▼                               │
│                          ┌────────────────────┐                   │
│                          │   User's Phone     │                   │
│                          │   (SMS received)   │                   │
│                          └────────────────────┘                   │
└─────────────────────────────────────────────────────────────────┘
```

### 4.3 SMS OTP — CRITICAL: NOT CONFIGURED IN PRODUCTION

**Current state:**
- `MSG91_AUTH_KEY` defaults to empty string (`${MSG91_AUTH_KEY:-}`)
- `MSG91_TEMPLATE_ID` defaults to empty string
- `MSG91_SENDER_ID` defaults to empty string

**What happens when user selects SMS:**
1. Backend receives request with `otp_type: "SMS"`
2. Backend tries to send SMS via MSG91 API
3. MSG91 API rejects the request (empty auth key) → returns 4xx error
4. Backend raises `ValueError("SMS OTP is not configured")`
5. Frontend shows error: "Failed to send SMS message. Please use email verification instead."

**This means SMS OTP is COMPLETELY BROKEN until MSG91 credentials are added.**

### 4.4 SMS OTP — What You Need to Configure

1. **Sign up for MSG91:** https://msg91.com
2. **Get AUTH_KEY:** From MSG91 dashboard → API Key
3. **Create SMS Template:** MSG91 dashboard → Templates → Create
   - Template must include `{#var#}` for the OTP code
   - Template must be approved by DLT (India regulatory requirement)
4. **Get Sender ID:** MSG91 dashboard → Sender ID → Create
   - Must be 6 characters, approved by DLT
5. **Set environment variables:**
   ```bash
   MSG91_AUTH_KEY=your_actual_auth_key_here
   MSG91_TEMPLATE_ID=your_template_id
   MSG91_SENDER_ID=AARYAC
   ```

### 4.5 MSG91 Rate Limits (Typical)

| Constraint | Value | Note |
|------------|-------|------|
| Free tier | ~100 SMS/month | Promotional |
| Transactional | Varies by plan | Must purchase credits |
| API rate limit | ~10 requests/second | Per auth key |
| DLT registration | Required for India | 3-7 day approval |

---

## 5. RATE LIMITING & THROTTLING

### 5.1 Backend Rate Limits (Core Service)

```yaml
# docker-compose.yml
- LOGIN_RATE_LIMIT=5          # 5 login attempts per window
- LOGIN_RATE_WINDOW=300       # 5 minutes (300 seconds)
- MAX_LOGIN_ATTEMPTS=5        # Lock account after 5 failures
- ACCOUNT_LOCKOUT_MINUTES=30  # Lock duration
```

### 5.2 OTP Rate Limits

| Endpoint | Limit | Window | Mechanism |
|----------|-------|--------|-----------|
| Send OTP (register) | 5 per hour | Per email/phone | Redis counter |
| Send OTP (forgot pwd) | 5 per hour | Per email/phone | Redis counter |
| Verify OTP | 3 attempts | Per OTP code | Redis counter |
| Resend OTP | 1 per minute | Per session | Redis cooldown |

### 5.3 Nginx Rate Limiting

```nginx
# Rate limiting zones (configured in nginx.conf)
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=auth:10m rate=5r/m;
```

### 5.4 Frontend Rate Limiting

The frontend has **NO client-side rate limiting** beyond UI state (`isSubmitting`). It relies entirely on backend rate limits and handles 429 errors by showing user-friendly messages.

### 5.5 Rate Limit — What Happens at 100 Concurrent Users

```
TIMELINE: 100 users hit "Register" simultaneously

T+0s:    100 POST /api/v1/auth/register → Core Service
T+0.1s:  100 users created in DB (fast, ~50ms each)
T+0.2s:  100 OTPs generated in Redis (fast, ~5ms each)
T+0.3s:  100 emails queued for SMTP sending

         ⚠️ SMTP is the bottleneck:
         - Hostinger SMTP: ~1 email per 2-5 seconds
         - 100 emails = 200-500 seconds (3-8 minutes!)
         - Many emails will timeout or queue

T+10s:   First 5-10 users receive OTP emails
T+30s:   ~20 users received OTPs, rest still waiting
T+60s:   Impatient users click "Resend OTP"
         → 20 resend requests → 20 more emails queued
         → Now 120 emails in queue

T+120s:  First batch of OTPs expire (10-min TTL starts from send)
         → Users who didn't get OTP must request new one

T+300s:  Rate limit kicks in (5 resends per hour)
         → Some users hit rate limit → 429 errors

SOLUTION: The backend MUST send OTP emails asynchronously via a 
background task queue, not synchronously during the API request.
```

---

## 6. PERFORMANCE UNDER LOAD (100+ CONCURRENT USERS)

### 6.1 Performance Profile by Flow

| Flow | Concurrent Users | Expected Response Time | Bottleneck |
|------|-----------------|----------------------|------------|
| Login | 100 | 2-10 seconds | bcrypt hashing (CPU-bound) |
| Registration (step 1) | 100 | 3-30+ seconds | SMTP email queue |
| OTP Verification | 100 | 0.1-0.5 seconds | Redis lookup (fast) |
| Forgot Password (send OTP) | 100 | 3-30+ seconds | SMTP email queue |
| Password Reset | 100 | 0.5-2 seconds | bcrypt hashing |
| Token Refresh | 100 | 0.2-1 second | JWT generation |

### 6.2 The Retry × Timeout × 100 Users Cascade

```
WORST-CASE SCENARIO: Backend becomes unresponsive

T+0s:    100 users submit login forms
         → 100 POST requests to backend

T+10s:   All 100 requests timeout (frontend timeout = 10s)
         → Each request schedules retry after 1s delay

T+11s:   100 retry requests hit backend
         → Backend is still slow → all timeout again

T+21s:   100 second retry requests hit backend (2s delay)
         → Backend is still slow → all timeout again

TOTAL REQUESTS TO BACKEND: 300 (100 users × 3 retries each)
TOTAL TIME PER USER: 10 + 1 + 10 + 2 + 10 = 33 seconds
```

**Impact:** A backend slowdown is amplified by **3x** in request volume and **3x** in user-perceived latency.

### 6.3 Thundering Herd: Proactive Token Refresh

If 100 users log in at approximately the same time:

```
T+0min:   All 100 users log in
T+45min:  All 100 users' proactive refresh fires simultaneously
          → 100 POST /api/v1/auth/refresh
          → Backend processes 100 JWT refreshes
          → If slow: cascades to retry logic
```

**Mitigation:** Add jitter to the refresh interval:
```javascript
// Instead of exactly 45 minutes:
const jitter = Math.random() * 5 * 60 * 1000; // 0-5 min random jitter
const REFRESH_INTERVAL_MS = (45 * 60 * 1000) + jitter;
```

---

## 7. TOKEN LIFECYCLE

### 7.1 Token Types

| Token Type | Storage | Lifetime | Purpose |
|------------|---------|----------|---------|
| **Access Token** | HttpOnly cookie | 30 minutes | API authentication |
| **Refresh Token** | HttpOnly cookie | 1440 minutes (24 hours) | Obtain new access tokens |
| **User Data** | localStorage | Until cleared | UI display only (non-sensitive) |

### 7.2 Token Flow Diagram

```
┌──────────────────────────────────────────────────────────────────┐
│  TOKEN LIFECYCLE                                                  │
│                                                                    │
│  ┌─────────────┐                                                   │
│  │   Login /   │                                                   │
│  │   Register  │                                                   │
│  └──────┬──────┘                                                   │
│         │                                                          │
│         ▼                                                          │
│  ┌─────────────────────────────────────────────┐                  │
│  │  Backend sets HttpOnly cookies:              │                  │
│  │  - access_token (expires in 30 min)          │                  │
│  │  - refresh_token (expires in 24 hours)       │                  │
│  └──────────────────┬──────────────────────────┘                  │
│                     │                                              │
│                     ▼                                              │
│  ┌─────────────────────────────────────────────┐                  │
│  │  Proactive Refresh (every 45 min)            │                  │
│  │  POST /api/v1/auth/refresh                   │                  │
│  │  → New access_token cookie set               │                  │
│  └──────────────────┬──────────────────────────┘                  │
│                     │                                              │
│        ┌────────────┴────────────┐                                │
│        │                         │                                │
│        ▼                         ▼                                │
│  ┌───────────┐         ┌───────────────┐                         │
│  │ SUCCESS   │         │ FAIL (401)    │                         │
│  │ Session   │         │ Clear auth    │                         │
│  │ extended  │         │ Redirect to   │                         │
│  │ silently  │         │ /auth/login   │                         │
│  └───────────┘         └───────────────┘                         │
│                                                                    │
│  Reactive Refresh (on 401):                                       │
│  ┌─────────────┐                                                   │
│  │ API returns │                                                   │
│  │ 401         │                                                   │
│  └──────┬──────┘                                                   │
│         │                                                          │
│         ▼                                                          │
│  ┌─────────────────────────────────────────────┐                  │
│  │  BaseApiClient._tryRefreshToken()            │                  │
│  │  POST /api/v1/auth/refresh                   │                  │
│  │  If success → retry original request         │                  │
│  │  If fail → clearAuthData()                   │                  │
│  └─────────────────────────────────────────────┘                  │
│                                                                    │
│  Logout:                                                          │
│  ┌─────────────┐                                                   │
│  │ POST /api/  │                                                   │
│  │ v1/auth/    │                                                   │
│  │ logout      │                                                   │
│  └──────┬──────┘                                                   │
│         │                                                          │
│         ▼                                                          │
│  ┌─────────────────────────────────────────────┐                  │
│  │  Backend:                                   │                  │
│  │  - Revoke refresh token                     │                  │
│  │  - Clear cookies                            │                  │
│  │  Frontend:                                  │                  │
│  │  - Clear localStorage.user                  │                  │
│  │  - Redirect to /auth/login                  │                  │
│  └─────────────────────────────────────────────┘                  │
└──────────────────────────────────────────────────────────────────┘
```

### 7.3 Token Refresh — Race Condition Protection

The `_tryRefreshToken()` method uses a promise deduplication pattern:

```javascript
// baseApi.js — only ONE refresh happens at a time
async _tryRefreshToken() {
  if (this._refreshing) {
    return this._refreshing;  // All concurrent calls share same promise
  }
  this._refreshing = (async () => { ... })();
  return this._refreshing;
}
```

**HOWEVER:** This only works within a single `BaseApiClient` instance. Since `coreClient` is a Proxy that creates a new instance on each property access, different API calls may create separate clients with separate `_refreshing` states. This means under heavy load, multiple refresh requests could fire simultaneously.

---

## 8. SECURITY ARCHITECTURE

### 8.1 Password Security

| Property | Value | Reason |
|----------|-------|--------|
| Algorithm | bcrypt | Industry standard, CPU-hard |
| Cost factor | 12 | ~250ms per hash on modern CPU |
| Min length | 8 characters | Backend enforced |
| Requires uppercase | Yes | Entropy increase |
| Requires lowercase | Yes | Entropy increase |
| Requires number | Yes | Entropy increase |
| Requires special char | No | Optional |

### 8.2 Cookie Security

| Property | Value | Reason |
|----------|-------|--------|
| HttpOnly | true | JavaScript cannot read (XSS protection) |
| Secure | false in dev, true in prod | Only sent over HTTPS |
| SameSite | lax | CSRF protection |
| Path | / | Available across entire site |

### 8.3 OTP Security

| Property | Value | Reason |
|----------|-------|--------|
| Code length | 6 digits | 1 million possibilities |
| Expiry | 10 minutes | Short window reduces attack surface |
| Max attempts | 3 per OTP | Brute force prevention |
| Storage | Redis (in-memory) | Auto-expires, no DB persistence |
| Rate limit | 5 per hour | Prevents email/SMS spam |

### 8.4 CSRF Protection

- **HttpOnly cookies** prevent JavaScript-based CSRF token theft
- **SameSite=lax** prevents cross-site cookie sending on POST/PUT/DELETE
- **No custom CSRF tokens** needed because of cookie-based auth + SameSite

### 8.5 XSS Protection

| Layer | Mechanism |
|-------|-----------|
| CSP headers | Restricts script sources |
| HttpOnly cookies | Tokens inaccessible to JS |
| React auto-escaping | JSX escapes all output |
| Input sanitization | `sanitizeSearch()` for search queries |

---

## 9. KNOWN BUGS & FIXES

### 9.1 Critical Bugs (Must Fix)

| # | Bug | Impact | Fix Priority |
|---|-----|--------|-------------|
| 1 | `/auth/change-password` in AUTH_ROUTES — unreachable for logged-in users | Feature completely broken | 🔴 P0 |
| 2 | `forgotPassword()` defaults to `'SMS'` but SMS not configured | Silent failures if param omitted | 🔴 P0 |
| 3 | OTP code sent in URL query params | Security leak (logs, history, Referer) | 🔴 P0 |
| 4 | SMTP password hardcoded in docker-compose.yml | Credential exposure | 🔴 P0 |

### 9.2 High Priority Bugs

| # | Bug | Impact | Fix Priority |
|---|-----|--------|-------------|
| 5 | `sessionStorage` read at render time (reset-password) | Hydration mismatch, UX flash | 🟠 P1 |
| 6 | No email queue for bulk OTP sends | SMTP thundering herd at scale | 🟠 P1 |
| 7 | `fetchWithRetry` amplifies backend load 3x during outages | Cascade failure risk | 🟠 P1 |

### 9.3 Medium Priority Bugs

| # | Bug | Impact | Fix Priority |
|---|-----|--------|-------------|
| 8 | Dead `isProfileRoute` variable in middleware | Code confusion | 🟡 P2 |
| 9 | Unused `identifier` variables in register page | Dead code | 🟡 P2 |
| 10 | Orphaned `/auth/check-email` page | Dead page | 🟡 P2 |

### 9.4 Low Priority Bugs

| # | Bug | Impact | Fix Priority |
|---|-----|--------|-------------|
| 11 | Misleading function names in baseApi.js | Developer confusion | 🟢 P3 |
| 12 | `isAdmin` in AdminLayout useEffect deps but unused | Unnecessary re-runs | 🟢 P3 |
| 13 | Duplicate `formatTime` in register page | Code quality | 🟢 P3 |
| 14 | Redundant refresh API call (proactive + reactive) | Minor inefficiency | 🟢 P3 |

---

## 10. FRONTEND CLIENT ARCHITECTURE

### 10.1 API Client Hierarchy

```
┌─────────────────────────────────────────────────────┐
│  Component (page.js, etc.)                          │
│       │                                              │
│       │  import { authApi } from '@/lib/customerApi' │
│       ▼                                              │
│  ┌─────────────────────────────────────────┐        │
│  │  customerApi.js (unified export)         │        │
│  │  - authApi                               │        │
│  │  - productsApi                           │        │
│  │  - ordersApi                             │        │
│  │  - cartApi                               │        │
│  └──────────────┬──────────────────────────┘        │
│                 │                                    │
│                 ▼                                    │
│  ┌─────────────────────────────────────────┐        │
│  │  baseApi.js                              │        │
│  │  - coreClient (→ Core Service 5001)      │        │
│  │  - commerceClient (→ Commerce 5002)      │        │
│  │  - paymentClient (→ Payment 5003)        │        │
│  │  - BaseApiClient class                   │        │
│  │  - fetchWithRetry, fetchWithTimeout       │        │
│  └─────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────┘
```

### 10.2 Request Pipeline (Single API Call)

```
1. Component calls: authApi.login(credentials)
2. customerApi.js routes to: coreClient.post('/api/v1/auth/login', credentials)
3. baseApi.js Proxy creates: new BaseApiClient(getCoreBaseUrl())
4. BaseApiClient.post() → _prepareRequest() → fetch()
5. fetchWithRetry() wraps the fetch (max 2 retries)
6. fetchWithTimeout() adds AbortController (10s timeout)
7. Native fetch() sends request with credentials: 'include'
8. Response parsed as JSON
9. If 401: _tryRefreshToken() → retry original request
10. If error: throw Error with status and message
```

### 10.3 AuthContext State Machine

```
              ┌─────────────┐
              │   INITIAL   │  loading: true
              │             │  isAuthenticated: false
              └──────┬──────┘
                     │
                     │ checkAuth()
                     ▼
          ┌──────────────────────┐
          │   CHECKING LOCAL     │  Reads localStorage.user
          │                      │
          │  No user found? ────▶│──▶ ┌─────────────┐
          │                      │    │ UNAUTHENTICATED│
          │  User found? ───────▶│──▶ │ loading: false │
          └──────────────────────┘    │ isAuth: false  │
                     │                └─────────────┘
                     │ verify with backend
                     ▼
          ┌──────────────────────┐
          │  VERIFYING WITH API  │  GET /api/v1/users/me
          │                      │
          │  200 OK? ───────────▶│──▶ ┌──────────────┐
          │                      │    │ AUTHENTICATED │
          │  401/403? ─────────▶│──▶ │ loading: false│
          │                      │    │ isAuth: true  │
          └──────────────────────┘    └──────────────┘
                                       │
                                       │ proactive refresh
                                       │ every 45 minutes
                                       ▼
                              ┌─────────────────┐
                              │  REFRESH TOKEN  │
                              │                 │
                              │  Success? ────▶│──▶ Stay authenticated
                              │                 │
                              │  401? ───────▶│──▶ Clear auth, redirect to login
                              └─────────────────┘
```

---

## 11. MIDDLEWARE ROUTE PROTECTION

### 11.1 Route Classification

| Route Category | Paths | Access Required | Behavior |
|----------------|-------|----------------|----------|
| **Public** | `/`, `/products`, `/collections`, `/about` | None | Anyone can access |
| **Auth Entry** | `/auth/login`, `/auth/register`, `/auth/forgot-password`, `/auth/reset-password` | Unauthenticated only | Redirect logged-in users away |
| **Protected** | `/cart`, `/checkout`, `/dashboard`, `/profile`, `/orders` | Authenticated | Redirect unauthenticated to login |
| **Admin** | `/admin/*` | Staff/Admin/SuperAdmin | Role-based redirects |
| **Static** | `/_next/*`, `*.js`, `*.css`, `/favicon.ico` | None | Bypassed |

### 11.2 Bug: `/auth/change-password` Misclassification

```javascript
// CURRENT (WRONG):
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/change-password',  // ← THIS IS THE BUG
];

// SHOULD BE:
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
];

const protectedRoutes = [
  '/cart', '/checkout', '/dashboard', '/profile', '/orders',
  '/auth/change-password',  // ← Move here (requires authentication)
];
```

### 11.3 Middleware Execution Flow

```
Request arrives
     │
     ▼
Skip static files, API routes, images
     │
     ▼
Parse JWT from access_token cookie
     │
     ▼
Classify route (admin / protected / auth / public)
     │
     ├─ Admin route? → Check isStaff(role)
     │    └─ Not staff? → Redirect to home
     │
     ├─ Protected route? → Check isAuthenticated
     │    └─ Not auth + no refresh_token? → Redirect to login
     │
     ├─ Auth route? → Check isAuthenticated
     │    └─ Authenticated? → Redirect to role-appropriate page
     │
     └─ Public/Other? → Proceed
```

---

## 12. CONFIGURATION REFERENCE

### 12.1 Environment Variables — Authentication

| Variable | Service | Default | Description |
|----------|---------|---------|-------------|
| `SECRET_KEY` | Core | `dev_secret_key_change_in_production` | JWT signing key |
| `ALGORITHM` | Core | `HS256` | JWT algorithm |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Core | `30` | Access token lifetime |
| `REFRESH_TOKEN_EXPIRE_MINUTES` | Core | `1440` | Refresh token lifetime (24h) |
| `SESSION_EXPIRE_MINUTES` | Core | `1440` | Session lifetime |
| `PASSWORD_MIN_LENGTH` | Core | `8` | Min password length |
| `PASSWORD_REQUIRE_UPPERCASE` | Core | `true` | Require uppercase |
| `PASSWORD_REQUIRE_LOWERCASE` | Core | `true` | Require lowercase |
| `PASSWORD_REQUIRE_NUMBER` | Core | `true` | Require number |
| `PASSWORD_REQUIRE_SPECIAL` | Core | `false` | Require special char |
| `LOGIN_RATE_LIMIT` | Core | `5` | Max logins per window |
| `LOGIN_RATE_WINDOW` | Core | `300` | Rate limit window (seconds) |
| `MAX_LOGIN_ATTEMPTS` | Core | `5` | Lockout threshold |
| `ACCOUNT_LOCKOUT_MINUTES` | Core | `30` | Lockout duration |
| `OTP_CODE_LENGTH` | Core | `6` | OTP code digits |
| `OTP_EXPIRY_MINUTES` | Core | `10` | OTP lifetime |
| `OTP_MAX_ATTEMPTS` | Core | `3` | Max OTP verification attempts |
| `OTP_RESEND_COOLDOWN_MINUTES` | Core | `1` | Min time between resends |
| `OTP_MAX_RESEND_PER_HOUR` | Core | `5` | Max resends per hour |

### 12.2 Email Configuration

| Variable | Value | Notes |
|----------|-------|-------|
| `SMTP_HOST` | `smtp.hostinger.com` | Hostinger mail server |
| `SMTP_PORT` | `465` | TLS port |
| `SMTP_USER` | `noreply@aaryaclothing.in` | SMTP username |
| `SMTP_PASSWORD` | `Aarya@2026` | ⚠️ HARDCODED — move to .env |
| `SMTP_TLS` | `true` | Use TLS |
| `EMAIL_FROM` | `noreply@aaryaclothing.in` | From address |
| `EMAIL_FROM_NAME` | `Aarya Clothing` | From display name |

### 12.3 SMS Configuration (MSG91)

| Variable | Value | Notes |
|----------|-------|-------|
| `MSG91_AUTH_KEY` | (empty) | ⚠️ REQUIRED for SMS |
| `MSG91_TEMPLATE_ID` | (empty) | ⚠️ REQUIRED for SMS |
| `MSG91_SENDER_ID` | (empty) | ⚠️ REQUIRED for SMS |

### 12.4 Cookie Configuration

| Variable | Value | Notes |
|----------|-------|-------|
| `COOKIE_SECURE` | `false` (dev) / `true` (prod) | HTTPS only |
| `COOKIE_HTTPONLY` | `true` | JS inaccessible |
| `COOKIE_SAMESITE` | `lax` | CSRF protection |

---

## 13. DISASTER RECOVERY

### 13.1 SMTP Failure — Email OTP Down

**Symptoms:** Users cannot register or reset passwords via email.

**Symptoms detection:**
- Frontend shows: "Failed to send email. Please check your email address or try SMS instead."
- Backend logs: SMTP connection errors, authentication failures

**Recovery steps:**
1. Check SMTP credentials in Core Service logs
2. Verify `smtp.hostinger.com:465` is reachable from Docker network
3. If Hostinger is down, switch to alternative SMTP (SendGrid, Mailgun)
4. Temporarily enable SMS OTP as fallback (if MSG91 is configured)

**Prevention:**
- Add SMTP health check endpoint
- Implement email queue with retry
- Configure backup SMTP provider

### 13.2 Redis Failure — OTP & Rate Limiting Down

**Symptoms:** OTP verification fails, rate limiting stops working.

**Recovery steps:**
1. Restart Redis container: `docker restart aarya_redis`
2. Check Redis health: `docker exec aarya_redis redis-cli ping`
3. If Redis is corrupted: clear data and restart
   ```bash
   docker stop aarya_redis
   docker volume rm aarya_clothing_frontend_redis_data
   docker compose up -d redis
   ```

**Impact during outage:**
- OTP verification will fail (OTP codes stored in Redis)
- Rate limiting stops (all requests allowed)
- Users cannot register or reset passwords

### 13.3 JWT Secret Compromise

**Symptoms:** Unauthorized access, forged tokens.

**Recovery steps:**
1. Rotate `SECRET_KEY` immediately
2. All existing JWTs become invalid
3. All users must re-login
4. Invalidate all refresh tokens in Redis

**Prevention:**
- Use strong random SECRET_KEY (64+ chars)
- Never commit SECRET_KEY to git
- Rotate keys periodically

### 13.4 Mass Account Lockout

**Symptoms:** Many users locked out after failed login attempts.

**Cause:** A coordinated attack or bug causing repeated failed logins.

**Recovery steps:**
1. Check login attempt logs in Redis
2. Unlock affected accounts:
   ```python
   # In Core Service
   redis.delete(f"login_attempts:{user_id}")
   redis.delete(f"account_lock:{user_id}")
   ```
3. Investigate root cause (bug, attack, credential stuffing)
4. If attack: implement IP-based blocking

---

## 14. MONITORING & ALERTS

### 14.1 Key Metrics to Monitor

| Metric | Threshold | Alert Level | Why |
|--------|-----------|-------------|-----|
| Login success rate | < 95% | 🟠 Warning | Users unable to login |
| OTP delivery time (p95) | > 30 seconds | 🟠 Warning | SMTP bottleneck |
| OTP delivery failure rate | > 5% | 🔴 Critical | Email/SMS provider issue |
| Password reset success rate | < 90% | 🟠 Warning | Broken flow |
| Token refresh failure rate | > 10% | 🔴 Critical | JWT or Redis issue |
| Account lockout rate | > 20% of logins | 🟠 Warning | Possible attack |
| API response time (p95) | > 5 seconds | 🟠 Warning | Backend slowdown |
| 5xx error rate | > 1% | 🔴 Critical | Service instability |

### 14.2 Log Patterns to Watch

```
# Successful OTP send
[INFO] OTP sent successfully to user@example.com via EMAIL

# OTP send failure
[ERROR] Failed to send OTP: SMTP connection refused
[ERROR] Failed to send SMS: MSG91 authentication failed

# Rate limit hit
[WARNING] Rate limit exceeded for login: user@example.com

# Account lockout
[WARNING] Account locked after 5 failed attempts: user@example.com

# Token refresh
[INFO] [TokenRefresh] Successfully refreshed access token
[WARNING] [TokenRefresh] Refresh token invalid or expired
```

### 14.3 Production Readiness Checklist

- [ ] `SECRET_KEY` changed from default
- [ ] `SMTP_PASSWORD` moved to `.env` (not hardcoded)
- [ ] `MSG91_AUTH_KEY` configured (if SMS needed)
- [ ] `COOKIE_SECURE=true` set
- [ ] CORS allows only production domains
- [ ] Nginx rate limiting enabled
- [ ] Error tracking (Sentry) configured
- [ ] Email delivery monitoring set up
- [ ] Redis backup strategy in place
- [ ] SSL certificates auto-renewing (certbot)
- [ ] `/auth/change-password` moved to protected routes
- [ ] OTP sent in request body (not URL params)

---

## 15. RECOMMENDED IMPROVEMENTS (Future)

### 15.1 Short Term (Week 1-2)

| Improvement | Effort | Impact |
|-------------|--------|--------|
| Fix `/auth/change-password` route classification | 5 min | 🔴 Critical fix |
| Move SMTP password to `.env` | 5 min | 🔴 Security fix |
| Send OTP in request body (not URL params) | 30 min | 🔴 Security fix |
| Change `forgotPassword` default from `'SMS'` to `'EMAIL'` | 5 min | 🔴 Bug fix |
| Move `sessionStorage` read to `useEffect` | 15 min | 🟠 UX fix |
| Remove dead code (`isProfileRoute`, unused vars, orphaned page) | 30 min | 🟡 Code quality |

### 15.2 Medium Term (Week 3-4)

| Improvement | Effort | Impact |
|-------------|--------|--------|
| Implement async email queue (Redis + background worker) | 4 hours | 🟠 Eliminates SMTP bottleneck |
| Add jitter to proactive token refresh | 15 min | 🟡 Prevents thundering herd |
| Add request deduplication for `/users/me` calls | 1 hour | 🟡 Reduces backend load |
| Reduce `maxRetries` from 2 to 1 for auth endpoints | 15 min | 🟠 Prevents cascade amplification |
| Add CSP `connect-src` for relative URLs | 5 min | 🟡 Better CSP compliance |

### 15.3 Long Term (Month 2+)

| Improvement | Effort | Impact |
|-------------|--------|--------|
| Implement Passkey/WebAuthn for passwordless login | 2 weeks | 🟢 Modern auth |
| Add email template HTML (branded OTP emails) | 1 day | 🟢 Brand consistency |
| Implement device fingerprinting for session tracking | 1 week | 🟡 Security |
| Add login history in user profile | 3 days | 🟢 User transparency |
| Implement MFA (TOTP) for admin accounts | 1 week | 🔴 Security requirement |
| Add OTP code length option (4/6/8 digits) | 1 day | 🟢 Flexibility |

---

## 16. OTP DELIVERY — EMAIL vs SMS COMPARISON

### 16.1 Feature Comparison

| Feature | Email OTP | SMS OTP |
|---------|-----------|---------|
| **Setup required** | ✅ Already configured | ❌ Needs MSG91 account + DLT |
| **Cost** | Free (Hostinger plan) | Paid per SMS |
| **Delivery speed** | 2-30 seconds | 5-60 seconds |
| **Reliability** | High (Hostinger is stable) | Medium (depends on telecom) |
| **Rate limits** | ~100 emails/hour | Depends on MSG91 plan |
| **User preference** | Medium (requires inbox access) | High (SMS is immediate) |
| **Spam risk** | Low (transactional email) | Low (transactional SMS) |
| **Production ready** | ✅ YES | ❌ NO (needs setup) |

### 16.2 Recommended Strategy

```
┌──────────────────────────────────────────────────────┐
│  OTP DELIVERY STRATEGY (Production Ready)             │
│                                                        │
│  DEFAULT: Email OTP (always available)                │
│  FALLBACK: SMS OTP (only after MSG91 is configured)   │
│                                                        │
│  User Registration:                                    │
│  1. Show Email OTP as default (pre-selected)          │
│  2. Show SMS OTP as optional (greyed out if not setup)│
│  3. If Email fails → auto-suggest SMS (if available)  │
│                                                        │
│  Forgot Password:                                      │
│  1. Default to Email OTP                              │
│  2. If user's phone is verified → offer SMS option    │
│  3. If Email fails → auto-suggest SMS (if available)  │
│                                                        │
│  Graceful Degradation:                                │
│  - If SMTP down → show clear error + SMS option       │
│  - If MSG91 not configured → hide SMS option entirely │
│  - If both down → show maintenance message            │
└──────────────────────────────────────────────────────┘
```

### 16.3 What Happens Right Now (Current State)

```
USER SELECTS "EMAIL OTP":
  → Works ✅
  → OTP sent via Hostinger SMTP
  → User receives email in 2-30 seconds
  → User enters code → verified → done

USER SELECTS "SMS OTP":
  → FAILS ❌
  → MSG91_AUTH_KEY is empty
  → Backend throws error: "SMS OTP is not configured"
  → Frontend shows: "Failed to send SMS message. Please try email instead."
  → User must switch to Email OTP

RESULT: SMS OTP is a UI option that doesn't work. Only Email OTP works.
```

---

## 17. COMPLETE FILE INVENTORY (Auth-Related)

### 17.1 Frontend Files

| File | Purpose | Lines |
|------|---------|-------|
| `frontend_new/middleware.js` | Route protection, JWT parsing | ~230 |
| `frontend_new/lib/authContext.js` | Auth state, token refresh, login/logout | ~280 |
| `frontend_new/lib/baseApi.js` | HTTP client, retry, token refresh, URL routing | ~420 |
| `frontend_new/lib/customerApi.js` | API namespaces (authApi, productsApi, etc.) | ~400 |
| `frontend_new/lib/authHelpers.js` | Password validation, OTP timer utils | ~150 |
| `frontend_new/lib/logger.js` | Dev-only logging | ~80 |
| `frontend_new/lib/roles.js` | Role constants and helpers | ~60 |
| `frontend_new/app/auth/login/page.js` | Login form | ~250 |
| `frontend_new/app/auth/register/page.js` | Registration + OTP verification | ~715 |
| `frontend_new/app/auth/forgot-password/page.js` | Forgot password + OTP | ~450 |
| `frontend_new/app/auth/reset-password/page.js` | Password reset (OTP flow) | ~350 |
| `frontend_new/app/auth/change-password/page.js` | Change password (authenticated) | ~210 |
| `frontend_new/app/auth/check-email/page.js` | Check email (orphaned page) | ~70 |

### 17.2 Backend Files (Core Service)

| File | Purpose |
|------|---------|
| `services/core/app/auth/` | Auth endpoints (login, register, OTP, tokens) |
| `services/core/app/users/` | User CRUD, profile management |
| `services/core/app/schemas/auth.py` | Pydantic schemas (LoginRequest, RegisterRequest, ForgotPasswordRequest) |
| `services/core/app/core/security.py` | Password hashing, JWT creation/verification |
| `services/core/app/core/otp.py` | OTP generation, Redis storage, verification |
| `services/core/app/core/email.py` | SMTP email sending |
| `services/core/app/core/sms.py` | MSG91 SMS sending |

---

## 18. QUICK REFERENCE: AUTH ENDPOINTS

| Method | Endpoint | Auth Required | Purpose |
|--------|----------|--------------|---------|
| POST | `/api/v1/auth/login` | No | User login |
| POST | `/api/v1/auth/register` | No | User registration |
| POST | `/api/v1/auth/logout` | Yes | User logout |
| POST | `/api/v1/auth/refresh` | No (cookie) | Token refresh |
| POST | `/api/v1/auth/forgot-password-otp` | No | Send OTP for password reset |
| POST | `/api/v1/auth/verify-reset-otp` | No | Verify OTP for password reset |
| POST | `/api/v1/auth/reset-password-with-otp` | No | Reset password with OTP |
| POST | `/api/v1/auth/reset-password` | No | Reset password with email token |
| POST | `/api/v1/auth/change-password` | Yes | Change password (authenticated) |
| POST | `/api/v1/auth/verify-otp-registration` | No | Verify OTP for registration |
| POST | `/api/v1/auth/send-verification-otp` | No | Resend verification OTP |
| POST | `/api/v1/auth/verify-email` | No | Verify email with token |
| POST | `/api/v1/auth/resend-verification` | No | Resend verification email |
| GET | `/api/v1/users/me` | Yes | Get current user |
| PATCH | `/api/v1/users/me` | Yes | Update profile |

---

**END OF DOCUMENT**

This document is the authoritative reference for the Aarya Clothing authentication system. Any changes to auth flows, OTP delivery, token management, or security settings must be documented here first.
