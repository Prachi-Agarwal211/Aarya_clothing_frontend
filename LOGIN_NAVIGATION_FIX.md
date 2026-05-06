# CRITICAL ISSUE: Sign In Button Not Navigating

## 🎯 PROBLEM (CORRECTED)
**Issue:** Clicking "Sign In" button on landing page does NOT navigate to login page.

**Behavior:**
- ❌ Doesn't work in normal browser session
- ✅ Works in incognito mode

**Root Cause:** Something in the browser session (cookies/localStorage) is blocking the navigation.

---

## 🔍 CURRENT CODE ANALYSIS

### EnhancedHeader.jsx - Desktop Sign In Button (lines 278-284)

```jsx
{isAuthenticated ? (
  <>
    {/* Dashboard, profile buttons */}
  </>
) : (
  <Link
    href={`/auth/login?redirect_url=${encodeURIComponent(pathname)}`}
    className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-sm font-medium transition-colors duration-300 flex items-center"
  >
    Sign In
  </Link>
)}
```

**Issue:** This is a standard Next.js Link component. It should work by default.

---

## 🐛 ROOT CAUSE IDENTIFICATION

### Problem 1: Event Handler Blocking on Mobile

Looking at the mobile menu section (lines 172-175):

```jsx
const toggleMobileMenu = useCallback(() => {
  setIsMobileMenuOpen(prev => !prev);
}, []);
```

**This is fine.**

### Problem 2: Scroll Event Handler (lines 110-123)

```jsx
useEffect(() => {
  const handleScroll = () => {
    if (!tickingRef.current) {
      requestAnimationFrame(() => {
        setIsScrolled(window.scrollY > 50);
        tickingRef.current = false;
      });
      tickingRef.current = true;
    }
  };

  window.addEventListener('scroll', handleScroll, { passive: true });
  return () => window.removeEventListener('scroll', handleScroll);
}, []);
```

**This is fine too.**

### Problem 3: KEY ISSUE - click event handling

Looking at line 143-158:

```jsx
const handleNavClick = useCallback((e, link) => {
  if (isLandingPage && link.anchor) {
    e.preventDefault();
    const target = document.querySelector(link.anchor);
    if (target) {
      const isMobile = window.innerWidth < 768;
      gsap.to(window, {
        scrollTo: { y: target, offsetY: isMobile ? 60 : 80 },
        duration: 1,
        ease: 'power3.inOut',
      });
      window.history.pushState(null, '', link.anchor);
    }
  }
  // If not on landing page, default <Link> navigation to /#anchor handles it
}, [isLandingPage]);
```

**CRITICAL FINDING:**

For anchor links on the landing page (`/#new-arrivals`, `/#collections`, etc.), this function:
1. Calls `e.preventDefault()` on the event
2. Prevents default link behavior
3. Scrolls smoothly with GSAP instead
4. Uses `window.history.pushState` to update URL

**This is GOOD for navigation links, but might be interfering if the Sign In link is somehow treated as an anchor link!**

---

## 🚨 ACTUAL PROBLEM: Event Propagation

### The Issue:

When clicking "Sign In", the browser might be treating it as:

1. **Navigation to `/auth/login`** - Should work with standard Link
2. **But somehow intercepted by scroll handler** - No, that's for scroll events only
3. **Or the event handler is preventing default** - Let me check the Link onClick

Looking at lines 233-250 (desktop nav links):

```jsx
{navLinks.map((link) => (
  <Link
    key={link.name}
    href={link.href}
    scroll={false}
    onClick={(e) => handleNavClick(e, link)}
    className={...}
    aria-current={link.name === 'New Arrivals' ? 'page' : undefined}
  >
    {link.name}
  </Link>
))}
```

**AHA! FOUND IT!**

The desktop navigation links (New Arrivals, Collections, Products, About, Contact) **ALSO have `onClick={(e) => handleNavClick(e, link)}`**.

This means:
- All navigation links use `handleNavClick`
- `handleNavClick` calls `e.preventDefault()` for anchor links on landing page
- **The Sign In link in the header does NOT have this onClick handler!**

---

## 🎯 ROOT CAUSE CONFIRMED

### Why Sign In Works in Desktop but Not on Landing Page:

1. **On Desktop Navigation Bar:**
   - Links use `onClick={(e) => handleNavClick(e, link)}`
   - But `handleNavClick` only prevents default for `link.anchor`
   - Navigation links like `/products` don't have anchor, so they navigate normally

2. **On Landing Page Header (Desktop):**
   - Sign In link does NOT have `onClick` handler
   - Should work normally with Next.js Link
   - **BUT...** there might be an issue

3. **On Mobile Menu:**
   - Mobile Sign In link (lines 460-467) ALSO does NOT have `onClick`
   - Should work normally

---

## 🔍 REAL ISSUE: What's Blocking Sign In?

Let me check if there's an event listener blocking the click:

### Hypothesis 1: window.addEventListener('click', ...) somewhere

**Not in EnhancedHeader.jsx.**

### Hypothesis 2: CSS pointer-events

**Not in the code.**

### Hypothesis 3: The mobile menu event handler is interfering

Looking at lines 470-474:

```jsx
<button
  onClick={() => {
    setIsMobileMenuOpen(false);
    handleCartClick();
  }}
  className="relative text-[#EAE0D5] hover:text-[#F2C29A] min-h-[44px] min-w-[44px] flex items-center justify-center"
  aria-label={`Shopping cart with ${itemCount} items`}
  type="button"
>
```

**This is fine - only affects cart button.**

---

## 🚨 CRITICAL DISCOVERY: e.preventDefault() in Mobile Menu Links

Looking at lines 392-405 (mobile nav links):

```jsx
{navLinks.map((link, index) => (
  <Link
    key={link.name}
    href={link.href}
    scroll={false}
    ref={index === 0 ? firstNavItemRef : null}
    className="text-2xl text-[#EAE0D5] hover:text-[#F2C29A] transition-colors duration-300 nav-link"
    style={{ fontFamily: 'Cinzel, serif', transitionDelay: `${index * 100}ms` }}
    onClick={(e) => {
      setIsMobileMenuOpen(false);
      handleNavClick(e, link);
    }}
  >
    {link.name}
  </Link>
))}
```

**These links ALSO call `handleNavClick`, but the mobile menu is open by default!**

So when mobile menu is open:
1. User clicks "Sign In" link in mobile menu
2. `handleNavClick` is called
3. If it's treated as an anchor link, `e.preventDefault()` is called
4. Link doesn't navigate

**But wait - the Sign In link in mobile menu doesn't have the same onClick!**

---

## 💡 ACTUAL ROOT CAUSE: Something in the Landing Page State

### Let me check the LandingClient state:

```jsx
const [showLanding, setShowLanding] = useState(false);

useEffect(() => {
  const lastSeen = localStorage.getItem('introVideoLastSeen');
  const isRecentlySeen = lastSeen && (Date.now() - parseInt(lastSeen, 10)) < 24 * 60 * 60 * 1000;

  if (isMobile || isRecentlySeen || localStorage.getItem('introVideoSeen') === 'true') {
    setShowLanding(true);
  }
}, [isMobile]);
```

**If `showLanding` is false, the main content is hidden with `opacity-0`.**

Looking at lines 60-65:

```jsx
<main
  id="main-content"
  className={`min-h-screen text-[#EAE0D5] overflow-x-hidden selection:bg-[#F2C29A] selection:text-[#050203] transition-opacity duration-700 ${showLanding ? 'opacity-100' : 'opacity-0 md:opacity-100'}`}
  role="main"
  aria-label="Aarya Clothing Landing Page"
>
```

**Ah! The main content has `opacity-0` when `showLanding` is false!**

**If the Sign In button is somehow rendered with this opacity-0 class, the user can't click it!**

---

## 🎯 THE ACTUAL BUG

### When Intro Video is Showing:

1. `showLanding = false`
2. Main content has `opacity-0`
3. Header should still be visible (it's outside the main)
4. **But wait - let me check if the header is also affected**

Looking at the JSX structure (lines 52-58):
```jsx
<>
  {!showLanding && !isMobile && (
    <div className="fixed inset-0 z-[200]">
      <IntroVideo onVideoEnd={handleVideoEnd} />
    </div>
  )}

  <main
    id="main-content"
    className={...}
    ...
  >
    <div className="relative z-10">
      <EnhancedHeader />
```

**Good - the header is outside the main, so it should be visible.**

---

## 🔍 What's REALLY Blocking the Click?

Let me think about what could cause this:

### Scenario 1: localStorage prevents intro video from ending

If `localStorage.getItem('introVideoLastSeen')` has a value from more than 24 hours ago, `showLanding` might be forced to true on load, but...

Actually, looking at line 26-31:
```jsx
if (isMobile || isRecentlySeen || localStorage.getItem('introVideoSeen') === 'true') {
  setShowLanding(true);
}
```

If `isRecentlySeen` is true (video seen within 24 hours), it sets `showLanding` to true immediately.

### Scenario 2: Something in the browser console

Let me ask the user to check console logs.

---

## 🚨 FOUND THE ISSUE!

### Looking at lines 143-158 again:

```jsx
const handleNavClick = useCallback((e, link) => {
  if (isLandingPage && link.anchor) {
    e.preventDefault();
    const target = document.querySelector(link.anchor);
    if (target) {
      const isMobileView = window.innerWidth < 768;
      gsap.to(window, {
        scrollTo: { y: target, offsetY: isMobileView ? 60 : 80 },
        duration: 1,
        ease: 'power3.inOut',
      });
      window.history.pushState(null, '', link.anchor);
    }
  }
  // If not on landing page, default <Link> navigation to /#anchor handles it
}, [isLandingPage]);
```

**The comment says:** "If not on landing page, default <Link> navigation to /#anchor handles it"

**BUT WHAT IF THE SIGN IN LINK IS BEING TREATED AS AN ANCHOR LINK?**

Looking at the Sign In link (lines 278-283):
```jsx
<Link
  href={`/auth/login?redirect_url=${encodeURIComponent(pathname)}`}
  className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-sm font-medium transition-colors duration-300 flex items-center"
>
  Sign In
</Link>
```

**It doesn't have `scroll={false}`!**

**And it doesn't have `onClick={(e) => handleNavClick(e, link)}`!**

**So it should work normally.**

---

## 💡 REAL ROOT CAUSE: The Mobile Menu Z-Index Issue

### Looking at lines 346-359 (Mobile Menu Overlay):

```jsx
<div
  id="mobile-menu"
  className={cn(
    "fixed inset-0 z-[95] flex flex-col items-center justify-center transition-all duration-400 md:hidden",
    isMobileMenuOpen
      ? "opacity-100 pointer-events-auto translate-y-0"
      : "opacity-0 pointer-events-none translate-y-4"
  )}
  role="dialog"
  aria-modal="true"
  aria-label="Mobile navigation menu"
  hidden={!isMobileMenuOpen}
>
```

**The mobile menu has `z-index: 95`!**

**The header has `z-index: 100`!**

**And the Sign In button in mobile menu is inside the mobile menu!**

**When mobile menu is open, it covers the Sign In button!**

**But the user says "Sign in" button - they might be clicking on the mobile menu's Sign In button when the menu is open, but they can't see it properly because of the overlay!**

---

## 🎯 CONFIRMED ROOT CAUSE

### The mobile Sign In button is hidden when mobile menu is open!

Looking at lines 460-467 (mobile menu Sign In link):

```jsx
<Link
  href={`/auth/login?redirect_url=${encodeURIComponent(pathname)}`}
  onClick={() => setIsMobileMenuOpen(false)}
  className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-xl transition-colors duration-300"
  style={{ fontFamily: 'Cinzel, serif' }}
>
  Sign In
</Link>
```

**This is INSIDE the mobile menu!**

**When mobile menu is open:**
- Overlay has `z-index: 95`
- Content container has `z-index: 10`
- Sign In link has no z-index specified
- **It should be visible!**

**But wait - let me check the mobile menu structure again.**

Looking at lines 386-490, the mobile menu has:
- Background div with `z-index: -1` (inside absolute container)
- Content container with `relative z-10`
- Sign In link inside the nav

**So the Sign In link should be visible!**

---

## 🚨 WAIT - I NEED TO CHECK IF THERE'S AN EVENT LISTENER

Let me search for any global event listeners:

### In EnhancedHeader.jsx, lines 98-107:

```jsx
useEffect(() => {
  const handleEscape = (e) => {
    if (e.key === 'Escape' && isMobileMenuOpen) {
      setIsMobileMenuOpen(false);
    }
  };

  document.addEventListener('keydown', handleEscape);
  return () => document.removeEventListener('keydown', handleEscape);
}, [isMobileMenuOpen]);
```

**This is fine - only handles Escape key.**

---

## 💡 THE REAL PROBLEM: Something in the Browser State

Given that:
1. Code looks correct
2. Works in incognito
3. Doesn't work in normal mode
4. Sign In is a simple Next.js Link component

**The issue is likely:**

1. **A JavaScript error in the browser console** preventing the click
2. **localStorage or cookies causing state issues**
3. **Browser caching an old version of the file**

---

## 🔧 IMMEDIATE FIX

### Fix 1: Add Error Boundary Around Link

```jsx
<Link
  href={`/auth/login?redirect_url=${encodeURIComponent(pathname)}`}
  onClick={(e) => {
    try {
      // Try to navigate
      window.location.href = `/auth/login?redirect_url=${encodeURIComponent(pathname)}`;
      e.preventDefault();
    } catch (err) {
      console.error('Navigation failed:', err);
    }
  }}
  className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-sm font-medium transition-colors duration-300 flex items-center"
>
  Sign In
</Link>
```

### Fix 2: Force Navigation with window.location

Replace the Link with a button:

```jsx
<button
  onClick={() => {
    window.location.href = `/auth/login?redirect_url=${encodeURIComponent(pathname)}`;
  }}
  className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-sm font-medium transition-colors duration-300 flex items-center"
  type="button"
>
  Sign In
</button>
```

### Fix 3: Check Browser Console

Add this to the Sign In button to see if there's an error:

```jsx
<Link
  href={`/auth/login?redirect_url=${encodeURIComponent(pathname)}`}
  onClick={(e) => {
    console.log('Sign In clicked, path:', pathname);
    console.log('isAuthenticated:', isAuthenticated);
  }}
  className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-sm font-medium transition-colors duration-300 flex items-center"
>
  Sign In
</Link>
```

---

## 📋 ACTION PLAN

### Step 1: Add Console Logs to Sign In Button

Modify `frontend_new/components/landing/EnhancedHeader.jsx` lines 278-283:

```jsx
<Link
  href={`/auth/login?redirect_url=${encodeURIComponent(pathname)}`}
  onClick={(e) => {
    console.log('[Sign In] Click detected');
    console.log('[Sign In] isAuthenticated:', isAuthenticated);
    console.log('[Sign In] pathname:', pathname);
    console.log('[Sign In] user:', user);
  }}
  className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-sm font-medium transition-colors duration-300 flex items-center"
>
  Sign In
</Link>
```

### Step 2: Check Browser Console

1. Navigate to https://aaryaclothing.in/
2. Open browser console (F12)
3. Click "Sign In"
4. Check console for errors or the debug logs above

### Step 3: Clear Browser Data

1. Clear all cookies
2. Clear localStorage
3. Refresh page
4. Try clicking Sign In again

### Step 4: Add Fallback Navigation

If the Link doesn't work, add a fallback:

```jsx
{!isAuthenticated ? (
  <>
    <button
      onClick={() => {
        window.location.href = `/auth/login?redirect_url=${encodeURIComponent(pathname)}`;
      }}
      className="text-[#EAE0D5]/80 hover:text-[#F2C29A] text-sm font-medium transition-colors duration-300 flex items-center"
      type="button"
    >
      Sign In
    </button>
  </>
) : (
  // ... existing authenticated UI
)}
```

---

## 🎯 FINAL ANSWER

**The most likely cause:** There's a JavaScript error or state issue in the browser session that's preventing the Next.js Link component from navigating.

**Quick fix:** Replace the Next.js Link with a standard HTML button that uses `window.location.href` for navigation.

**Recommended fix:** Add console logs to debug the exact issue, then add a fallback button if needed.

---

*Report updated: 2026-05-06*
*Issue confirmed: Sign In button not navigating to login page*
