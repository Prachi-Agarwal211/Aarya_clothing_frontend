# Account Verification Login Fix

## Issue Summary

**User Report:** User `15anuragsingh2003@gmail.com` tried to login and received error: "Your account has been disabled. Please contact support."

**Root Cause:** The account is **NOT disabled**. The user registered but never completed email/phone verification via OTP.

## Database Status

Query result for `15anuragsingh2003@gmail.com`:

```
id: 374
is_active: true                ← Account IS active
email_verified: false          ← Email NOT verified
phone_verified: false          ← Phone NOT verified
signup_verification_method: otp_email  ← Registered with email OTP
created_at: 2026-04-12 23:12:10.640827
```

## Expected Behavior

When an unverified user tries to login:

1. **Backend** (`services/core/service/auth_service.py` line 439):
   - Checks `email_verified` AND `phone_verified`
   - If both false, raises: `EMAIL_NOT_VERIFIED:{email}:{method}`
   
2. **Backend** (`services/core/main.py` lines 700-714):
   - Catches the ValueError
   - Returns HTTP 403 with structured error:
   ```json
   {
     "detail": {
       "error_code": "EMAIL_NOT_VERIFIED",
       "email": "15anuragsingh2003@gmail.com",
       "signup_verification_method": "otp_email",
       "message": "Please verify your account before logging in..."
     }
   }
   ```

3. **Frontend** (`frontend_new/app/auth/login/page.js`):
   - Should catch HTTP 403 with `error_code === 'EMAIL_NOT_VERIFIED'`
   - Redirect to `/auth/register?step=verify&email=...&method=otp_email`
   - Register page auto-sends OTP and shows verification form

## Problem Found

The error handling in the login page was fragile:

1. **Error parsing was incomplete**: Only checked `err.data.detail` but didn't handle all possible error structures
2. **No fallback for stringified errors**: If error came as a string, parsing might fail
3. **Generic 403 handler too broad**: Line 26 caught ALL 403 errors and showed "disabled" message

## Fixes Applied

### Fix 1: Improved Error Parsing in Login Page

**File:** `frontend_new/app/auth/login/page.js`

**Changes:**
- Added multiple methods to extract error detail from different response structures
- Added fallback to parse `EMAIL_NOT_VERIFIED` from error message string
- Added logging to track when redirects happen
- Improved 403 error handler to check for EMAIL_NOT_VERIFIED in message before showing "disabled"

**Before:**
```javascript
let detail = err?.data?.detail ?? err?.response?.data?.detail;
if (typeof detail === 'string') {
  try { detail = JSON.parse(detail); } catch { detail = {}; }
}
if (err.status === 403 && detail.error_code === 'EMAIL_NOT_VERIFIED') {
  // redirect
}
```

**After:**
```javascript
// Try multiple ways to extract error detail
let detail = null;
if (err?.data) {
  detail = err.data.detail ?? err.data;
}
if (!detail && err?.response?.data) {
  detail = err.response.data.detail ?? err.response.data;
}

// Parse stringified JSON if needed
if (typeof detail === 'string') {
  try { detail = JSON.parse(detail); } catch { detail = {}; }
}

// Check for EMAIL_NOT_VERIFIED error code
if (err.status === 403 && detail.error_code === 'EMAIL_NOT_VERIFIED') {
  logger.info(`Email not verified for ${email}, redirecting to verification`);
  router.push(`/auth/register?step=verify&email=...&method=...`);
  return;
}

// Fallback: check error message string
if (err.message && err.message.includes('EMAIL_NOT_VERIFIED')) {
  // Parse and redirect
}
```

### Fix 2: Better 403 Error Message Handling

**File:** `frontend_new/app/auth/login/page.js` - `getLoginErrorMessage()`

**Before:**
```javascript
if (err.status === 403) return 'Your account has been disabled. Please contact support.';
```

**After:**
```javascript
if (err.status === 403) {
  const msg = err.message || '';
  if (msg.includes('EMAIL_NOT_VERIFIED')) {
    return 'Please verify your email before logging in. Request a new verification code if needed.';
  }
  return 'Your account has been disabled. Please contact support.';
}
```

### Fix 3: Better Logging in Verification Redirect

**File:** `frontend_new/app/auth/register/page.js`

**Changes:**
- Added logging when OTP is auto-sent for verification redirect
- Added logging when OTP sent successfully
- Improved error message when OTP sending fails (still shows form so user can retry)

## How the Flow Works Now

### Scenario 1: User tries to login without verification

```
User enters credentials
     ↓
POST /api/v1/auth/login
     ↓
Backend: Checks email_verified = false
     ↓
Backend: Returns HTTP 403 with error_code: "EMAIL_NOT_VERIFIED"
     ↓
Frontend: Catches error, parses detail
     ↓
Frontend: Redirects to /auth/register?step=verify&email=USER_EMAIL&method=otp_email
     ↓
Register page: Auto-sends OTP to user's email
     ↓
Register page: Shows OTP verification form (step 2)
     ↓
User enters OTP code
     ↓
Backend: Verifies OTP, sets email_verified = true
     ↓
Backend: Returns tokens, user is logged in
     ↓
Frontend: Redirects to /products (or role-appropriate page)
```

### Scenario 2: User's OTP expired, needs new code

```
User on verification page
     ↓
Clicks "Resend Code" button
     ↓
POST /api/v1/auth/send-verification-otp
     ↓
Backend: Generates new OTP, sends to email
     ↓
Backend: Returns success
     ↓
Frontend: Resets timer, clears input fields
     ↓
User enters new OTP code
```

## Testing Instructions

### Test 1: Login with Unverified Account

1. Ensure user exists with `email_verified = false` in database
2. Go to `/auth/login`
3. Enter email and correct password
4. **Expected:** Redirected to `/auth/register?step=verify&email=...` with OTP form
5. **Expected:** OTP sent to email automatically
6. Enter OTP code from email
7. **Expected:** Logged in and redirected to `/products`

### Test 2: Wrong Password

1. Go to `/auth/login`
2. Enter email and wrong password
3. **Expected:** Error "Invalid credentials. Please check your username/email and password."

### Test 3: Disabled Account (is_active = false)

1. Set `is_active = false` for a user in database
2. Try to login with correct password
3. **Expected:** Error "Your account has been disabled. Please contact support."

### Test 4: Resend OTP from Verification Page

1. On verification page (step 2)
2. Wait 30 seconds (cooldown)
3. Click "Resend Code"
4. **Expected:** New OTP sent to email
5. **Expected:** Timer resets to 2 minutes

## Database Queries

### Check user verification status:
```sql
SELECT id, email, is_active, email_verified, phone_verified, signup_verification_method, created_at
FROM users
WHERE email = '15anuragsingh2003@gmail.com';
```

### Manually verify a user (emergency fix):
```sql
UPDATE users
SET email_verified = true, is_active = true
WHERE email = '15anuragsingh2003@gmail.com';
```

### Find all unverified users:
```sql
SELECT id, email, created_at
FROM users
WHERE email_verified = false AND phone_verified = false
ORDER BY created_at DESC;
```

## Related Files

- `services/core/service/auth_service.py` - Login logic, verification check
- `services/core/main.py` - HTTP endpoint, error handling
- `services/core/service/otp_service.py` - OTP generation and sending
- `frontend_new/app/auth/login/page.js` - Login form, error handling
- `frontend_new/app/auth/register/page.js` - Registration + OTP verification
- `frontend_new/lib/baseApi.js` - API client, error creation
- `frontend_new/lib/customerApi.js` - Auth API methods

## Prevention

To prevent users from seeing "disabled" error when they're just unverified:

1. ✅ **Done:** Improved error parsing handles all response structures
2. ✅ **Done:** Added fallback parsing from error message string
3. ✅ **Done:** Better logging to track verification redirect flow
4. ✅ **Done:** Better error messages distinguish disabled vs unverified

## Future Improvements

1. Add a dedicated `/auth/verify-email` page separate from registration
2. Allow users to change verification method (email ↔ SMS) from verification page
3. Add email verification link in addition to OTP (already exists at `/api/v1/auth/verify-email`)
4. Show user their verification status in profile page
5. Auto-redirect unverified users to verification page on any protected route access
