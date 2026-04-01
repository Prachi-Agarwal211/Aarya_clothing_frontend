# SAFE TO DEPLOY Checklist

**⚠️ CRITICAL: This checklist MUST be completed before deploying to production VPS**

**Production URL:** https://aaryaclothing.in  
**Environment:** Direct VPS deployment (no staging)  
**Risk Level:** HIGH - Real transactions and customer data at stake

---

## 📋 Pre-Deployment Checklist

### Critical (MUST PASS - Do Not Deploy If Any Fail)

- [ ] **All API calls verified against production backend**
  - Tested endpoints return expected response format
  - No new API endpoints required
  - Backward compatible with current backend version
  - Verification command:
    ```bash
    curl -s "https://aaryaclothing.in/api/v1/products?limit=1" | jq 'keys'
    # Expected: ["items", "total", "skip", "limit", "has_more"]
    ```

- [ ] **No database schema changes required**
  - Zero changes to `migrations/` directory
  - Zero changes to `database/` directory
  - No new tables or columns assumed
  - Verification command:
    ```bash
    git diff HEAD~5 -- migrations/ database/ | wc -l
    # Expected: 0
    ```

- [ ] **No breaking changes to component APIs**
  - All React components maintain existing props
  - No required props added without defaults
  - Event handler signatures unchanged
  - Verification: Review `git diff` for component changes

- [ ] **Backward compatibility 100%**
  - Old URLs still work (no broken links)
  - Old API responses still parsed correctly
  - Graceful degradation for missing data
  - Error boundaries prevent crashes

- [ ] **Error handling prevents crashes**
  - All API calls wrapped in try-catch
  - Loading states for async operations
  - Fallback UI for error states
  - No unhandled Promise rejections

- [ ] **Rollback procedure tested**
  - Rollback commands documented and ready
  - Database backup created (< 1 hour old)
  - Previous git commit hash recorded
  - Team knows rollback steps

### High Priority (Should Pass - Deploy With Caution If Any Fail)

- [ ] **Tested product browsing flow**
  - [ ] Homepage loads with products
  - [ ] Product listing page works
  - [ ] Product detail page loads
  - [ ] Product images display correctly
  - [ ] Size selection functional
  - [ ] Related products display

- [ ] **Tested collection browsing**
  - [ ] Collection listing page loads
  - [ ] Collection detail page works
  - [ ] Filter functionality operational
  - [ ] Pagination works correctly
  - [ ] Sort options functional

- [ ] **Tested wishlist add/remove**
  - [ ] Add to wishlist works (authenticated)
  - [ ] Remove from wishlist works
  - [ ] Wishlist page displays correctly
  - [ ] Wishlist count updates
  - [ ] Guest user redirected to login

- [ ] **Tested cart operations**
  - [ ] Add to cart from product page
  - [ ] Add to cart from collection page
  - [ ] Cart count updates in header
  - [ ] Cart page displays correctly
  - [ ] Quantity update works
  - [ ] Remove item works
  - [ ] Empty cart state displays
  - [ ] Cart persists across sessions

- [ ] **Tested checkout flow (CRITICAL - Use Test Mode)**
  - [ ] Checkout page loads from cart
  - [ ] Address form validates correctly
  - [ ] Delivery state selection works
  - [ ] GST calculation correct (CGST+SGST vs IGST)
  - [ ] Order summary displays correctly
  - [ ] Payment gateway loads (Razorpay test mode)
  - [ ] **Complete test transaction with real payment**
  - [ ] Payment success redirect works
  - [ ] Order confirmation page displays
  - [ ] Order confirmation email received
  - [ ] Order appears in admin panel

- [ ] **Tested admin panel**
  - [ ] Admin login works
  - [ ] Dashboard loads with metrics
  - [ ] Order list displays correctly
  - [ ] Order detail view works
  - [ ] Order status update works
  - [ ] Product list displays
  - [ ] Product edit page loads
  - [ ] Product update saves
  - [ ] Inventory management works
  - [ ] No console errors in admin

### Medium Priority (Nice to Have - Document If Any Fail)

- [ ] **Tested search functionality**
  - [ ] Search bar accepts input
  - [ ] Search results display
  - [ ] Search filters work
  - [ ] No results state displays
  - [ ] Search suggestions work (if implemented)

- [ ] **Tested user authentication**
  - [ ] Login with email/password
  - [ ] Login with OTP
  - [ ] OTP delivery (email)
  - [ ] OTP verification works
  - [ ] Logout works
  - [ ] Session persists correctly
  - [ ] Protected routes redirect to login

- [ ] **Tested profile pages**
  - [ ] Profile page loads
  - [ ] Profile edit works
  - [ ] Password change works
  - [ ] Order history displays
  - [ ] Order detail from history
  - [ ] Address management works
  - [ ] Wishlist from profile

- [ ] **Tested order tracking**
  - [ ] Track order page loads
  - [ ] Order status displays correctly
  - [ ] Tracking timeline shows
  - [ ] Invoice download works
  - [ ] Order cancellation works (if allowed)

- [ ] **Tested responsive design**
  - [ ] Mobile view (320px - 767px)
  - [ ] Tablet view (768px - 1023px)
  - [ ] Desktop view (1024px+)
  - [ ] No layout breaks
  - [ ] Touch targets appropriate size

- [ ] **Tested performance**
  - [ ] LCP < 2.5s (Largest Contentful Paint)
  - [ ] CLS < 0.1 (Cumulative Layout Shift)
  - [ ] FID < 100ms (First Input Delay)
  - [ ] Images use Next.js Image component
  - [ ] No layout shift on images
  - [ ] Skeleton loaders display correctly

---

## 🔍 Code Review Checklist

### Security

- [ ] No hardcoded API keys or secrets
- [ ] Environment variables used correctly
- [ ] XSS prevention in place (sanitize inputs)
- [ ] CSRF protection enabled
- [ ] Authentication checks on protected routes
- [ ] Authorization checks on admin routes
- [ ] SQL injection prevention (parameterized queries)
- [ ] Rate limiting configured

### Performance

- [ ] No unnecessary re-renders (React.memo where needed)
- [ ] Efficient list rendering (keys on list items)
- [ ] Image optimization (Next.js Image component)
- [ ] Code splitting implemented
- [ ] Lazy loading for below-fold content
- [ ] API response caching where appropriate
- [ ] No memory leaks (cleanup in useEffect)

### Accessibility

- [ ] Semantic HTML used
- [ ] ARIA labels where needed
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Color contrast sufficient
- [ ] Alt text on images
- [ ] Form labels present

### Code Quality

- [ ] No console.log in production code
- [ ] Error handling in place
- [ ] Loading states implemented
- [ ] Code follows existing patterns
- [ ] Comments for complex logic
- [ ] No dead code
- [ ] TypeScript/PropTypes types correct

---

## 🧪 Automated Tests (If Available)

- [ ] Unit tests pass
  ```bash
  npm test
  ```

- [ ] Integration tests pass
  ```bash
  npm run test:integration
  ```

- [ ] E2E tests pass (Playwright)
  ```bash
  npm run test:e2e
  ```

- [ ] Linting passes
  ```bash
  npm run lint
  ```

- [ ] Type checking passes
  ```bash
  npm run type-check
  ```

---

## 📊 Deployment Verification Checklist

### Immediate (First 5 Minutes)

- [ ] Site responds with HTTP 200
  ```bash
  curl -I https://aaryaclothing.in
  ```

- [ ] Next.js cache working
  ```bash
  curl -sI https://aaryaclothing.in | grep x-nextjs-cache
  # Expected: HIT
  ```

- [ ] API responding correctly
  ```bash
  curl -s "https://aaryaclothing.in/api/v1/products?limit=1" | jq '.total'
  ```

- [ ] No critical errors in logs
  ```bash
  docker logs --tail 100 aarya_frontend | grep -i error
  ```

- [ ] All containers healthy
  ```bash
  docker ps --filter "name=aarya" --format "{{.Names}}\t{{.Status}}"
  ```

### Short-Term (First 30 Minutes)

- [ ] Homepage loads correctly (manual check)
- [ ] Product pages load correctly (sample 5 products)
- [ ] Collection pages load correctly (sample 3 collections)
- [ ] Add to cart works (test with different products)
- [ ] Checkout completes successfully (test transaction)
- [ ] Admin panel accessible
- [ ] No new errors in application logs
- [ ] No increase in error rate
- [ ] API latency normal
- [ ] Database connections stable

### Long-Term (First 24 Hours)

- [ ] No customer complaints received
- [ ] Payment success rate normal (> 95%)
- [ ] No unusual traffic patterns
- [ ] Database performance normal
- [ ] Error rate within acceptable range (< 1%)
- [ ] All scheduled jobs running
- [ ] Backups completing successfully

---

## 🚨 Rollback Readiness Checklist

Before deploying, ensure you can rollback within 1 minute:

- [ ] **Database backup location known**
  ```bash
  ls -lt /opt/backups/*.sql | head -1
  ```

- [ ] **Previous git commit hash recorded**
  ```bash
  git log -1 --oneline
  # Record this hash: _______________
  ```

- [ ] **Rollback commands ready in terminal**
  ```bash
  # Copy these to your terminal but DON'T execute yet:
  cd /opt/Aarya_clothing_frontend
  git reset --hard <previous-commit-hash>
  docker-compose build frontend
  docker-compose up -d --no-deps frontend
  ```

- [ ] **Team notified of deployment window**
  - [ ] Primary engineer: _______________
  - [ ] Secondary engineer: _______________
  - [ ] Database admin on standby: _______________

- [ ] **Rollback decision criteria understood**
  - Site down (500 errors) → Rollback immediately
  - Checkout broken → Rollback if fix > 10 minutes
  - Payment failures > 5% → Rollback immediately
  - Database errors → Rollback immediately

---

## ✅ Sign-Off

### Pre-Deployment Sign-Off

**Engineer:** _______________  
**Date:** _______________  
**Time:** _______________  

I confirm that:
- [ ] All Critical items passed
- [ ] All High Priority items tested
- [ ] Code review completed
- [ ] Rollback procedure ready
- [ ] Team notified

**Signature:** _______________

### Post-Deployment Sign-Off

**Engineer:** _______________  
**Date:** _______________  
**Time:** _______________  

I confirm that:
- [ ] All immediate verifications passed
- [ ] Test transaction completed successfully
- [ ] No critical errors in logs
- [ ] All containers healthy
- [ ] Monitoring active

**Signature:** _______________

### 24-Hour Post-Deployment Review

**Engineer:** _______________  
**Date:** _______________  
**Time:** _______________  

I confirm that:
- [ ] No customer complaints received
- [ ] Payment success rate normal
- [ ] Error rate within acceptable range
- [ ] All systems stable
- [ ] Deployment successful

**Signature:** _______________

---

## 📝 Deployment Notes

**Deployment ID:** _______________  
**Git Commit:** _______________  
**Changes Summary:**
```
_________________________________
_________________________________
_________________________________
```

**Issues Encountered:**
```
_________________________________
_________________________________
_________________________________
```

**Resolution:**
```
_________________________________
_________________________________
_________________________________
```

**Lessons Learned:**
```
_________________________________
_________________________________
_________________________________
```

---

**Document Version:** 1.0  
**Last Updated:** April 1, 2026  
**Next Review:** After each major deployment
