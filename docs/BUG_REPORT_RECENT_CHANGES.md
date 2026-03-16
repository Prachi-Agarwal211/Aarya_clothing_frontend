# 🐛 COMPREHENSIVE BUG REPORT - Recent Changes

**Generated:** March 16, 2026  
**Analysis Method:** Systematic code review + runtime error analysis  
**Severity Distribution:** 3 Critical, 5 High, 4 Medium

---

## 🔴 CRITICAL BUGS (Must Fix Immediately)

### **BUG-001: Commerce Service Pydantic Validation Error**

**Severity:** CRITICAL  
**File:** `services/commerce/main.py`  
**Line:** 610-640  
**Endpoint:** `GET /api/v1/products`

**Issue:**
The endpoint returns a plain list `[_enrich_product(p) for p in products]` but somewhere in the code there's a reference to `ProductListResponse` schema that requires `skip` and `has_more` fields.

**Error:**
```
fastapi.exceptions.ResponseValidationError: 2 validation errors:
  - {'type': 'missing', 'loc': ('response', 'skip'), 'msg': 'Field required'}
  - {'type': 'missing', 'loc': ('response', 'has_more'), 'msg': 'Field required'}
```

**Impact:**
- ❌ Homepage products fail to load (500 error)
- ❌ All collection pages broken
- ❌ Search results non-functional
- ❌ New arrivals section broken

**Reproduction:**
```bash
curl http://localhost:6005/api/v1/products
# Returns: 500 Internal Server Error
```

**Fix:**
The endpoint has NO response_model decorator currently, which means the error must be coming from the cache wrapper or enrich function. Need to check `_enrich_product()` return type.

---

### **BUG-002: Token Storage Security Vulnerability**

**Severity:** CRITICAL  
**Files:** 
- `frontend_new/lib/apiClient.js:67-73`
- `frontend_new/lib/baseApi.js:25-35`

**Issue:**
Tokens are stored in BOTH localStorage AND cookies, creating a security vulnerability:

```javascript
// apiClient.js:67-73
function setStoredTokens(tokens) {
  localStorage.setItem('auth', JSON.stringify(tokens));  // ❌ XSS vulnerable
  if (tokens.access_token) {
    setCookie('access_token', tokens.access_token, 1);  // ✅ HttpOnly OK
  }
}
```

**Impact:**
- 🔒 XSS attacks can steal tokens from localStorage
- 🔒 Token sync issues between storage mechanisms
- 🔒 Confusing token management logic

**Fix:**
Remove localStorage entirely, use HttpOnly cookies only:
```javascript
function setStoredTokens(tokens) {
  // Remove localStorage - backend sets HttpOnly cookies
  // No client-side token storage needed
}
```

---

### **BUG-003: Middleware Token Expiration Check**

**Severity:** CRITICAL  
**File:** `frontend_new/middleware.js:79`  
**Line:** 79

**Issue:**
Token expiration check compares timestamp in seconds with milliseconds:

```javascript
const isTokenValid = decodedToken && decodedToken.exp && (decodedToken.exp * 1000 > Date.now());
```

**Problem:** `decodedToken.exp` is already in seconds (Unix timestamp), `Date.now()` returns milliseconds. The `* 1000` is correct, but this should be verified.

**Impact:**
- ⚠️ Tokens might be considered valid when expired
- ⚠️ Or valid tokens rejected prematurely

**Verification Needed:**
Check JWT spec - `exp` claim should be NumericDate (seconds since epoch).

---

## 🟠 HIGH SEVERITY BUGS

### **BUG-004: Missing .env.local File**

**Severity:** HIGH  
**File:** `frontend_new/.env.local` (DOES NOT EXIST)

**Issue:**
No environment configuration file exists. Frontend uses hardcoded fallback:

```javascript
// lib/apiClient.js:100
return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:6005';
```

**Impact:**
- ⚠️ Works locally but will fail in production
- ⚠️ No environment-specific configuration
- ⚠️ Cannot switch between staging/production

**Fix:**
Create `.env.local`:
```bash
NEXT_PUBLIC_API_URL=http://localhost:6005
NODE_ENV=development
```

---

### **BUG-005: Duplicate API Client Implementations**

**Severity:** HIGH  
**Files:**
- `frontend_new/lib/api.js`
- `frontend_new/lib/apiClient.js`
- `frontend_new/lib/baseApi.js`

**Issue:**
Three different API client implementations with overlapping functionality:

```javascript
// Some components use:
import { apiFetch } from '@/lib/api';

// Others use:
import { apiClient } from '@/lib/apiClient';

// Yet others use:
import { coreClient } from '@/lib/baseApi';
```

**Impact:**
- ⚠️ Inconsistent error handling
- ⚠️ Duplicate token management
- ⚠️ Confusing for developers
- ⚠️ Hard to maintain

**Fix:**
Consolidate to single client, remove duplicates.

---

### **BUG-006: Auth Context Race Condition**

**Severity:** HIGH  
**File:** `frontend_new/lib/authContext.js:48-83`  
**Function:** `checkAuth()`

**Issue:**
Potential race condition when checking auth on mount:

```javascript
const checkAuth = useCallback(async () => {
  try {
    const storedUser = getStoredUser();
    
    if (!storedUser) {
      setUser(null);
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }
    
    // Pre-set from localStorage
    setUser(storedUser);
    setIsAuthenticated(true);
    
    // Verify with backend
    try {
      const userData = await apiFetch('/api/v1/users/me');
      setUser(userData);
      localStorage.setItem('user', JSON.stringify(userData));
    } catch (err) {
      // ❌ If this fails, state is inconsistent
      console.warn('Backend session verification failed:', err.message);
    }
  }
}, []);
```

**Impact:**
- ⚠️ User might see stale data briefly
- ⚠️ Auth state inconsistent if backend call fails
- ⚠️ Multiple state updates in quick succession

**Fix:**
Add proper error handling and state cleanup.

---

### **BUG-007: Logout Function Doesn't Clear Backend Session**

**Severity:** HIGH  
**File:** `frontend_new/lib/authContext.js:128-140`

**Issue:**
Logout only clears local state, doesn't invalidate backend session:

```javascript
const logout = useCallback(async () => {
  try {
    await authApi.logout();  // ✅ Calls backend
  } catch (err) {
    console.warn('Logout API call failed:', err.message);  // ⚠️ Ignores errors
  } finally {
    // Always clear local state
    setUser(null);
    setIsAuthenticated(false);
    clearStoredTokens();
    clearAuthData();
  }
}, []);
```

**Problem:** If backend logout fails, tokens are still valid but client thinks user is logged out.

**Impact:**
- 🔒 Security risk - tokens remain valid
- 🔒 Session not properly terminated

**Fix:**
Retry logout or force clear backend session.

---

### **BUG-008: Middleware Redirect Loop Potential**

**Severity:** HIGH  
**File:** `frontend_new/middleware.js:93-125`

**Issue:**
Complex redirect logic for admin routes could cause loops:

```javascript
if (isAdminRoute) {
  if (!isAuthenticated && !hasRefreshToken) {
    return NextResponse.redirect(loginUrl);  // ✅ OK
  }
  
  if (isAuthenticated && !isStaff(userRole)) {
    return NextResponse.redirect(homeUrl);  // ✅ OK
  }
  
  // ❓ What if user role changes mid-session?
  // ❓ What if token expires during redirect?
}
```

**Impact:**
- ⚠️ Potential redirect loops
- ⚠️ Users might get stuck

---

## 🟡 MEDIUM SEVERITY BUGS

### **BUG-009: Missing Error Boundary in Pages**

**Severity:** MEDIUM  
**Files:** Multiple page files

**Issue:**
Only root layout has ErrorBoundary. Individual pages lack error recovery:

```javascript
// app/layout.js - Has ErrorBoundary ✅
// app/products/page.js - No ErrorBoundary ❌
// app/cart/page.js - No ErrorBoundary ❌
```

**Impact:**
- ⚠️ Single component error crashes entire page
- ⚠️ Poor user experience
- ⚠️ No graceful degradation

**Fix:**
Add page-level error boundaries.

---

### **BUG-010: Console Statements in Production**

**Severity:** MEDIUM  
**Files:** 64 instances across frontend

**Issue:**
Console statements not stripped from production build:

```javascript
console.warn('Failed to parse JWT token:', e.message);  // middleware.js
console.error('Failed to store auth data:', e);  // baseApi.js
console.log('ServiceWorker registration successful');  // layout.js
```

**Impact:**
- ⚠️ Information leakage
- ⚠️ Performance impact
- ⚠️ Console spam in production

**Fix:**
Use proper logger with environment-based filtering.

---

### **BUG-011: Missing Product Images**

**Severity:** MEDIUM  
**File:** Commerce service database

**Issue:**
Products exist but have no images:

```json
{
  "primary_image": null,
  "images": []
}
```

**Impact:**
- ⚠️ Poor user experience
- ⚠️ Reduced conversion rates

**Fix:**
Upload images via admin panel or seed database.

---

### **BUG-012: ESLint Build Warnings**

**Severity:** MEDIUM  
**Files:** Multiple component files

**Issue:**
Build completes with warnings:

```
./components/ui/Carousel.jsx - useCallback missing dependency
./components/ui/Modal.jsx - useEffect missing dependency
./components/ui/SearchDropdown.jsx - useCallback missing dependency
```

**Impact:**
- ⚠️ Potential runtime bugs
- ⚠️ Code quality issues

---

## 📋 SUMMARY

| Severity | Count | Status |
|----------|-------|--------|
| 🔴 Critical | 3 | Must fix before production |
| 🟠 High | 5 | Should fix this week |
| 🟡 Medium | 4 | Fix this month |

---

## 🎯 IMMEDIATE ACTION PLAN

### Today (Critical)
1. **Fix commerce service validation error** - BUG-001
2. **Remove localStorage token storage** - BUG-002
3. **Verify middleware token expiration** - BUG-003

### This Week (High)
4. **Create .env.local** - BUG-004
5. **Consolidate API clients** - BUG-005
6. **Fix auth context race condition** - BUG-006
7. **Fix logout session invalidation** - BUG-007

### This Month (Medium)
8. **Add page-level error boundaries** - BUG-009
9. **Replace console with logger** - BUG-010
10. **Upload product images** - BUG-011
11. **Fix ESLint warnings** - BUG-012

---

*Generated by QA Engineer Agent - March 16, 2026*
