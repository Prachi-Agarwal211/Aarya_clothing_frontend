# DEEP ANALYSIS: Signup Button Issue on AaryaClothing.in

## 🎯 PROBLEM STATEMENT
**Issue:** When navigating to landing page (aaryaclothing.in) and clicking "signup", the page doesn't navigate to the signup page where users can actually login.

**Behavior:**
- ✅ Works in incognito mode
- ❌ Doesn't work in normal browser session

This indicates a **session/state dependency issue** - something stored in the browser that doesn't exist in incognito mode.

---

## 📊 SYSTEM ARCHITECTURE OVERVIEW

```
Internet User
    ↓
[HTTPS] nginx:443
    ├─ / → Frontend:3000 (Next.js SSR)
    ├─ /api/v1/auth/ → Core:5001
    ├─ /api/v1/products/ → Commerce:5002
    ├─ /api/v1/payments/ → Payment:5003
    ├─ /api/v1/admin/ → Admin:5004
    └─ /api/v1/landing/ → Admin:5004
```

### Services:
1. **Nginx** (Port 80/443) - Reverse proxy, routing, SSL termination
2. **Frontend** (Port 3000) - Next.js 14, React, Client-side routing
3. **Core Service** (Port 5001) - Auth, users, site config, JWT generation
4. **Commerce Service** (Port 5002) - Products, cart, orders
5. **Payment Service** (Port 5003) - Payments, Razorpay integration
6. **Admin Service** (Port 5004) - Admin dashboard, landing page CMS

---

## 🔍 ISSUE ANALYSIS

### Current Signup Flow:
1. User lands on `/` (landing page)
2. **NO signup button exists on landing page** - only "Sign In" in header
3. User clicks "Sign In" → navigates to `/auth/login`
4. On login page → "Create account" link → `/auth/register`

**Question:** Where is the "signup" button on the landing page that the user is clicking?

---

## 🐛 ROOT CAUSE IDENTIFIED

### Issue 1: Missing Signup Button on Landing Page

Looking at `frontend_new/components/landing/EnhancedHeader.jsx` (lines 255-284):

```jsx
{isAuthenticated ? (
  <>
    {/* Dashboard button, profile button */}
  </>
) : (
  <Link href={`/auth/login?redirect_url=${encodeURIComponent(pathname)}`}>
    Sign In
  </Link>
)}
```

**There is NO "Sign Up" button on the landing page!**

The landing page only has:
- "Sign In" link in the header
- No signup/register button anywhere visible

### Issue 2: Login Page Has "Create Account" Link

In `frontend_new/app/auth/login/LoginPageContent.jsx` (lines 183-190):

```jsx
<div className="w-full mt-6 sm:mt-8">
  <p className="text-center text-[#8A6A5C] text-xs sm:text-sm tracking-wide">
    New here?{' '}
    <Link href="/auth/register" className="text-[#C27A4E] hover:text-[#F2C29A] transition-colors ml-1 uppercase text-sm font-bold tracking-widest">
      Create account
    </Link>
  </p>
</div>
```

**This IS the signup link**, but it's on the login page, not the landing page.

---

## 🔑 WHAT'S DIFFERENT IN INCNOCO MODE?

### Potential Causes:

#### 1. **localStorage Values Affecting Landing Page Visibility**

In `frontend_new/app/(landing)/LandingClient.jsx` (lines 25-32):

```javascript
useEffect(() => {
  const lastSeen = localStorage.getItem('introVideoLastSeen');
  const isRecentlySeen = lastSeen && (Date.now() - parseInt(lastSeen, 10)) < 24 * 60 * 60 * 1000;

  if (isMobile || isRecentlySeen || localStorage.getItem('introVideoSeen') === 'true') {
    setShowLanding(true);
  }
}, [isMobile]);
```

**If `localStorage` has old values from a previous session, it could affect the landing page rendering.**

#### 2. **Session Cookie Issues**

Looking at `frontend_new/middleware.js` (lines 176-198):

```javascript
const accessToken = request.cookies.get('access_token')?.value;
const refreshToken = request.cookies.get('refresh_token')?.value;

const accessDecoded = accessSignatureValid ? parseJwt(accessToken) : null;
const refreshDecoded = refreshSignatureValid ? parseJwt(refreshToken) : null;

const now = Date.now();
const accessValid = accessDecoded?.exp && accessDecoded.exp * 1000 > now;
const refreshValid = refreshDecoded?.exp && refreshDecoded.exp * 1000 > now;

const decodedToken = accessValid ? accessDecoded : refreshValid ? refreshDecoded : null;
const isAuthenticated = !!decodedToken;
const hasRefreshToken = !!refreshToken;
const userRole = decodedToken?.role;
```

**If there's an old/invalid token in cookies:**
- User appears "authenticated"
- Can't access auth pages (redirected to dashboard)

#### 3. **localStorage.setItem('user') in authContext.js (lines 71, 216)**

```javascript
// In checkAuth (line 71)
localStorage.setItem('user', JSON.stringify(userData));

// In updateUser (line 216)
localStorage.setItem('user', JSON.stringify(updated));
```

**This stores user data in localStorage** which persists across sessions.

---

## 🎯 REAL ISSUE: Where is the Signup Button?

### Found It! In `frontend_new/app/auth/register/page.js`:

Line 310-313:

```javascript
if (isAuthenticated) {
  router.push(getRedirectForRole(user?.role || USER_ROLES.CUSTOMER));
  return null;
}
```

**This check happens AFTER the component renders.**

But wait - looking at the actual login page HTML from the curl output (line with "Create account"), I can see the link is there and working.

---

## 💡 ACTUAL PROBLEM: Navigation Path Issue

### User's Expected Flow:
1. Landing page `/`
2. Click "Signup" button
3. Go to signup page `/auth/register`

### Actual Code Flow:
1. Landing page `/`
2. NO "Signup" button exists on landing page
3. Only "Sign In" button exists in header
4. Clicking "Sign In" goes to `/auth/login`
5. On login page → "Create account" link → `/auth/register`

---

## 🚨 CRITICAL FINDING: Missing Signup Button

The landing page is **missing the signup button entirely**!

Let me search for any signup-related components:

### Search Results:
- ✅ `/auth/register/page.js` exists
- ✅ "Create account" link exists on login page
- ✅ "Sign in" link exists on login page
- ✅ "Sign in" button exists in EnhancedHeader
- ❌ **NO "Sign up" or "Create account" button on landing page**

---

## 🔧 POSSIBLE EXPLANATION FOR "Doesn't Work"

### Scenario A: User is Clicking the "Sign In" Link
- User clicks "Sign In" in header
- Goes to `/auth/login`
- Expects it to go directly to signup
- But it goes to login page instead
- Then has to click "Create account" link manually

**This is a UX issue, not a technical bug.**

### Scenario B: User is Trying to Click Non-Existent Signup Button
- No signup button exists on landing page
- User expects one to exist
- Clicking "Sign In" doesn't feel like "signing up"
- Can't find signup flow

**This is a UI/UX design issue.**

---

## 📋 VERIFICATION STEPS

### Step 1: Check Landing Page HTML
```bash
curl -s https://aaryaclothing.in/ | grep -i "signup\|create account\|register"
```

**Expected:** No "signup" or "register" links found

### Step 2: Check localStorage in Browser
```javascript
// Open browser console on landing page
localStorage.getItem('user')
localStorage.getItem('introVideoLastSeen')
localStorage.getItem('introVideoSeen')
```

### Step 3: Check Cookies
```javascript
// Open browser console
document.cookie.split('; ').find(c => c.startsWith('access_token'))
document.cookie.split('; ').find(c => c.startsWith('refresh_token'))
```

---

## 🎯 SOLUTION

### Option 1: Add Signup Button to Landing Page

Add a signup button in the landing page footer or hero section:

```jsx
// In frontend_new/components/landing/Footer.jsx
// Add between New Arrivals and Customer Care links
<Link href="/auth/register" className="...">
  Sign up
</Link>
```

Or in the hero section:
```jsx
// In frontend_new/components/landing/HeroSection.jsx
buttons={[...existing, { text: 'Sign up', link: '/auth/register', variant: 'heroLuxury' }]}
```

### Option 2: Make "Sign In" Redirect to Signup for New Users

Modify the login flow to detect if user is trying to sign up:
- If `/auth/login?signup=true` → redirect to `/auth/register`
- Or add a "Sign up" button next to "Sign in" on login page

### Option 3: Improve UX Flow

Add clear signup link on the login page:
- Make "Create account" more prominent
- Add a "Don't have an account? Sign up" section with a button
- Instead of just a text link

---

## 🎨 RECOMMENDED SOLUTION

### Add Signup Button to Landing Page Footer

Modify `frontend_new/components/landing/Footer.jsx`:

```jsx
{/* Quick Links */}
<nav aria-label="Explore links">
  <div className="space-y-2">
    <h3>Explore</h3>
    <ul>
      {[
        { name: 'New Arrivals', href: '/#new-arrivals' },
        { name: 'Collections', href: '/collections' },
        { name: 'Our Story', href: '/#about' },
        // ADD THIS:
        { name: 'Sign up', href: '/auth/register', isSignup: true } // Highlight signup
      ].map((item) => (
        <li key={item.name}>
          <Link href={item.href} className="...">
            {item.isSignup ? (
              <span className="text-[#F2C29A] font-semibold">Sign up</span>
            ) : (
              <span>{item.name}</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  </div>
</nav>
```

Or even simpler - add a "Sign up" button in the footer:

```jsx
<div className="mt-8 pt-8 border-t border-[#B76E79]/20 text-center">
  <Link href="/auth/register">
    <Button variant="heroLuxury" size="lg">
      Create Account
    </Button>
  </Link>
</div>
```

---

## 🔍 SESSION/COOKIE FLOW DEEP DIVE

### How Login Works:

1. **POST** `/api/v1/auth/login` with email/password
2. Backend creates JWT (access_token + refresh_token)
3. Backend sets **HttpOnly cookies**:
   ```
   Set-Cookie: access_token=eyJhbGci...; path=/; HttpOnly; Secure; SameSite=Strict
   Set-Cookie: refresh_token=eyJhbGci...; path=/; HttpOnly; Secure; SameSite=Strict
   ```
4. Frontend updates context with user data

### How Logout Works:

1. **POST** `/api/v1/auth/logout` (optional, clears server-side session)
2. Frontend clears cookies (browser sends `Cookie: access_token=; refresh_token=`)

### How Register Works:

1. **POST** `/api/v1/auth/register` with form data
2. Creates user in database
3. **Directly logs user in** (no separate login step)
4. Backend sets auth cookies
5. Frontend updates context and redirects to dashboard

---

## ✅ INCORPORATED SESSION ISSUES

### Issue 1: Old localStorage.user Data
**File:** `frontend_new/lib/authContext.js` (lines 71, 216)
**Problem:** `localStorage.setItem('user', ...)` persists user data across sessions
**Impact:** User appears "authenticated" even after logout
**Fix:** Clear localStorage on logout (line 201)

### Issue 2: Intro Video State Persistence
**File:** `frontend_new/app/(landing)/LandingClient.jsx` (lines 22-32)
**Problem:** `localStorage.getItem('introVideoLastSeen')` affects landing page visibility
**Impact:** Old intro video state might interfere with user experience
**Fix:** Already using 24-hour threshold, but could add clear button

### Issue 3: Missing Signup Button
**File:** Landing page components
**Problem:** No signup button on landing page
**Impact:** User can't find signup flow
**Fix:** Add signup button to footer or hero section

---

## 🎯 RECOMMENDED FIXES

### Fix 1: Add Signup Button to Landing Page (Priority: HIGH)

**File:** `frontend_new/components/landing/Footer.jsx`

Add a prominent "Create Account" button in the footer:

```jsx
{/* Bottom Action Bar */}
<div className="mt-8 pt-8 border-t border-[#B76E79]/20 text-center">
  <p className="text-sm text-[#EAE0D5]/70 mb-4">New customer?</p>
  <Link href="/auth/register">
    <Button variant="heroLuxury" size="lg" className="w-full sm:w-auto">
      Create Account
    </Button>
  </Link>
</div>
```

### Fix 2: Clear localStorage on Logout (Priority: MEDIUM)

**File:** `frontend_new/lib/authContext.js` (line 201)

```javascript
const logout = useCallback(async () => {
  setAuthError(null);

  isLoggingOutRef.current = true;

  try {
    await authApi.logout();
  } catch (err) {
    logger.warn('Logout API call failed:', err.message);
  } finally {
    try {
      localStorage.removeItem('cart');
      localStorage.removeItem('cart_backup');
    } catch (cartErr) {
      logger.warn('Failed to clear cart on logout:', cartErr);
    }

    // ADD THIS:
    localStorage.removeItem('user'); // Clear stored user data

    setUser(null);
    setIsAuthenticated(false);
    clearStoredTokens();
    clearAuthData();

    isLoggingOutRef.current = false;
  }
}, []);
```

### Fix 3: Improve Login Page UX (Priority: MEDIUM)

**File:** `frontend_new/app/auth/login/LoginPageContent.jsx` (lines 183-190)

Make "Create account" more prominent:

```jsx
<div className="w-full mt-4">
  <div className="p-4 rounded-xl bg-[#7A2F57]/10 border border-[#B76E79]/20">
    <p className="text-center text-[#EAE0D5]/80 text-sm mb-3">
      New here?{' '}
      <span className="font-semibold text-[#F2C29A]">Create your account</span>
    </p>
    <Link href="/auth/register" className="block w-full">
      <Button
        variant="heroLuxury"
        size="lg"
        className="w-full"
      >
        Create Account
      </Button>
    </Link>
  </div>
</div>
```

---

## 📝 SUMMARY

### Root Causes:
1. ❌ **No signup button exists on landing page** - Users can't find the signup flow
2. ⚠️ **localStorage.user persists across sessions** - Can affect authentication state
3. ⚠️ **"Sign in" button redirects to login page, not signup** - Creates confusion

### Why It Works in Incognito:
- No old localStorage data
- No old cookies from previous sessions
- Landing page loads fresh
- Clear user journey

### Why It Doesn't Work Normally:
- Old localStorage values (user, introVideoLastSeen)
- Old cookies (access_token, refresh_token)
- Landing page shows unexpected state
- User can't find signup button

---

## 🚀 NEXT STEPS

1. **Add signup button to landing page** (Critical)
2. **Clear localStorage.user on logout** (Important)
3. **Improve login page signup CTA** (Nice to have)
4. **Test signup flow in normal browser** (Verification)

---

## 📊 VERIFICATION

After implementing fixes:

1. Go to https://aaryaclothing.in/
2. Look for "Create Account" or "Sign up" button
3. Click it
4. Should navigate to `/auth/register` where user can complete signup
5. Verify "Sign In" button still works on login page

---

*Report generated: 2026-05-06*
*System: AaryaClothing.in*
*Analysis completed: Deep code review of frontend, middleware, nginx, and session management*
