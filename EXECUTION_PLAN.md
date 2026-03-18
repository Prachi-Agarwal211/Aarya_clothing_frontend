# 🚀 24-ISSUE FIX PROGRAM - EXECUTION PLAN

**Created:** March 18, 2026
**Orchestrator:** Lead Project Manager
**Status:** EXECUTION STARTED
**Phase:** Priority 1 - Critical Backend

---

## 📊 CURRENT STATUS

### Codebase Analysis Complete ✅

**Project Structure:**
- **Frontend:** Next.js 15, React 19, TypeScript (`frontend_new/`)
- **Backend:** 4 FastAPI microservices
  - Core Service (Port 5001) - Auth, Users, Sessions
  - Commerce Service (Port 5002) - Products, Orders, Cart, Inventory
  - Payment Service (Port 5003) - Razorpay, Invoices, Refunds
  - Admin Service (Port 5004) - Dashboard, Analytics, Staff, Chat
- **Database:** PostgreSQL with pgvector
- **Cache:** Redis
- **Search:** Meilisearch
- **CDN:** Cloudflare Images (working ✅)
- **Storage:** Cloudflare R2

**Recent Fixes (Completed March 17):**
- ✅ COEP header fixes for Cloudflare CDN
- ✅ imageLoader.ts URL encoding
- ✅ Role-based redirect fixes
- ✅ JWT token claims completion
- ✅ Excel export improvements (QA verified)
- ✅ Order cycle logic (QA verified)

---

## 🎯 PRIORITY 1 EXECUTION PLAN

### Issue #1: Admin Dashboard 500 Errors

**Initial Analysis:**
- Admin service has 83 API endpoints across 12 tag categories
- Key endpoints: `/api/v1/admin/orders`, `/api/v1/admin/inventory`, `/api/v1/admin/chat`
- Frontend has 24 admin pages identified

**Execution Steps:**

#### Step 1.1: Check Admin Service Logs (lead-architect)
```bash
# Command to run
docker-compose logs admin | grep -E "(ERROR|500|Exception|Traceback)" | tail -100

# What we're looking for:
- Python tracebacks
- Database connection errors
- Missing dependencies
- Authentication failures
```

**Expected Findings:**
- Likely causes: Database query errors, missing env vars, authentication issues
- ETA: 30 minutes

#### Step 1.2: Identify Failing Endpoints (lead-architect)
```bash
# Test each admin endpoint
curl -H "Authorization: Bearer <admin_token>" http://localhost:8004/api/v1/admin/orders
curl -H "Authorization: Bearer <admin_token>" http://localhost:8004/api/v1/admin/inventory
curl -H "Authorization: Bearer <admin_token>" http://localhost:8004/api/v1/admin/chat/rooms

# Check which return 500 errors
```

**Key Endpoints to Test:**
1. `/api/v1/admin/orders` - Order list
2. `/api/v1/admin/orders/{id}` - Order detail
3. `/api/v1/admin/inventory` - Inventory list
4. `/api/v1/admin/chat/rooms` - Chat rooms
5. `/api/v1/admin/analytics` - Dashboard analytics

#### Step 1.3: Fix Backend Errors (lead-architect)
**Common Issues & Fixes:**
- Database connection → Check DATABASE_URL
- Missing tables → Run migrations
- Auth middleware → Verify JWT secret
- Import errors → Check dependencies

#### Step 1.4: Verify Frontend (frontend-specialist)
```javascript
// Check admin dashboard API calls
// File: frontend_new/app/admin/page.js
- Verify fetch calls to admin endpoints
- Check error handling
- Test loading states
```

#### Step 1.5: Regression Test (qa-engineer)
```bash
# Run admin dashboard tests
cd frontend_new
npm run test:admin

# Specific test: admin-dashboard.spec.js
```

---

### Issue #2: Order Cycle Logic

**Status:** ✅ QA VERIFIED (per QA_VERIFICATION_REPORT.md)

**Verification Needed:**
- Backend transitions: `services/commerce/service/order_service.py:310-315`
- Frontend transitions: `frontend_new/app/admin/orders/page.js:169-177`

**Execution:**
```python
# Backend (already verified)
valid_transitions = {
    OrderStatus.CONFIRMED: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
    OrderStatus.SHIPPED:   [OrderStatus.DELIVERED],
    OrderStatus.DELIVERED: [],  # Terminal
    OrderStatus.CANCELLED: [],  # Terminal
}
```

```javascript
// Frontend (already verified)
const transitions = {
  'confirmed': ['shipped', 'cancelled'],
  'shipped':   ['delivered'],
  'delivered': [],
  'cancelled': [],
};
```

**Action:** Mark as VERIFIED - No changes needed unless new issues found.

---

### Issue #3: Return Page Layout (Double Headers)

**Execution Steps:**

#### Step 3.1: Inspect Return Pages (frontend-specialist)
**Files to Check:**
- `frontend_new/app/admin/returns/page.js`
- `frontend_new/app/admin/returns/[id]/page.js`

**What to Look For:**
- Multiple header component imports
- Duplicate layout wrappers
- Nested layout components

#### Step 3.2: Fix Duplicate Headers (frontend-specialist)
**Expected Fix:**
```javascript
// Remove duplicate header imports
// Keep only one layout wrapper
```

#### Step 3.3: Visual Verification (qa-engineer)
```bash
# Take screenshots before/after
# Run Playwright visual regression test
```

---

### Issue #4: Product Editing Not Working

**Execution Steps:**

#### Step 4.1: Check Product Update API (lead-architect)
**Endpoint:** `PUT /api/v1/products/{product_id}`
**File:** `services/commerce/main.py`

**Test:**
```bash
curl -X PUT http://localhost:8002/api/v1/products/1 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Product", "price": 999}'
```

#### Step 4.2: Check Admin Product Form (frontend-specialist)
**File:** `frontend_new/app/admin/products/[id]/edit/page.js`

**Check:**
- Form submission handler
- API call construction
- Error handling

#### Step 4.3: E2E Test (qa-engineer)
**Test:** Product edit flow
**Expected:** Product updates successfully

---

### Issue #5: Customer Pages Not Loading Products

**Execution Steps:**

#### Step 5.1: Check Product List API (lead-architect)
**Endpoint:** `GET /api/v1/products`
**File:** `services/commerce/main.py`

**Test:**
```bash
curl http://localhost:8002/api/v1/products?page=1&limit=20
```

**Check:**
- Response format
- Pagination
- Error handling

#### Step 5.2: Check Customer Product Pages (frontend-specialist)
**Files:**
- `frontend_new/app/products/page.js`
- `frontend_new/app/collections/page.js`

**Check:**
- Fetch logic
- Error states
- Loading states

#### Step 5.3: Test Product Loading (qa-engineer)
**Test:** Browse products as customer
**Expected:** Products load correctly

---

## 📅 WEEK 1 SCHEDULE

### Day 1 (Today)
- [x] Create master task list
- [x] Analyze codebase
- [ ] Task 1.1: Check admin service logs
- [ ] Task 1.2: Identify failing endpoints
- [ ] Task 2.1: Verify order cycle (likely already done)

### Day 2
- [ ] Task 1.3: Fix admin backend errors
- [ ] Task 1.4: Verify admin dashboard
- [ ] Task 1.5: Add regression test
- [ ] Task 3.1-3.3: Fix return page layout

### Day 3
- [ ] Task 4.1-4.3: Fix product editing
- [ ] Task 5.1-5.3: Fix customer product loading
- [ ] Docker rebuild
- [ ] Full Priority 1 verification

### Day 4-5
- Buffer for unexpected issues
- Documentation
- Prepare for Priority 2

---

## 🔧 AGENT DELEGATION

### lead-architect
**Tasks:**
1.1, 1.2, 1.3, 2.1, 4.1, 5.1

**Instructions:**
- Use `grep_search` for targeted file discovery
- Read specific lines, not entire files
- Focus on error traces and failing endpoints
- Follow KISS principle - simplest fix first

### frontend-specialist
**Tasks:**
1.4, 3.1, 3.2, 4.2, 5.2

**Instructions:**
- Check component structure for duplicates
- Verify API integration points
- Follow Next.js best practices
- Ensure Server Components by default

### qa-engineer
**Tasks:**
1.5, 2.3, 2.4, 3.3, 4.3, 5.3

**Instructions:**
- Rebuild Docker after backend changes
- Run Playwright tests
- Document test results
- Verify no regressions

---

## 📊 SUCCESS METRICS

### Priority 1 Completion Criteria
- [ ] Admin dashboard loads without 500 errors
- [ ] Order cycle transitions work correctly
- [ ] Return pages have single header
- [ ] Product editing functional
- [ ] Customer pages load products
- [ ] All E2E tests passing
- [ ] Docker build successful
- [ ] No console errors

### Performance Standards
- LCP < 2.5s
- CLS < 0.1
- FID < 100ms
- API response time < 200ms (p95)

---

## 🚨 RISK MITIGATION

### Identified Risks
1. **Database Migration Issues**
   - Mitigation: Backup before changes
   - Rollback: Restore from backup

2. **Breaking API Changes**
   - Mitigation: Version endpoints
   - Rollback: Revert commit

3. **Frontend Regressions**
   - Mitigation: E2E tests before deploy
   - Rollback: Previous Docker image

4. **Performance Degradation**
   - Mitigation: Performance testing
   - Rollback: Revert changes

---

## 📝 COMMUNICATION PROTOCOL

### Daily Standup
- Time: 9:00 AM IST
- Format: Markdown in chat
- Content:
  - Completed yesterday
  - Planned today
  - Blockers

### Progress Updates
- Frequency: Every 4 hours
- Format: Task status update in MASTER_TASK_LIST.md
- Audience: All agents + user

### Escalation
- Trigger: Blocker > 2 hours
- Path: Agent → Orchestrator → User
- Resolution: Within 24 hours

---

## 🎯 NEXT ACTIONS

1. **Immediate (Next 2 hours):**
   - lead-architect: Start Task 1.1 (admin logs)
   - frontend-specialist: Review return page components
   - qa-engineer: Prepare test environment

2. **Today:**
   - Complete Tasks 1.1, 1.2, 2.1
   - Begin Task 1.3 if errors found
   - Update MASTER_TASK_LIST.md with progress

3. **This Week:**
   - Complete all Priority 1 tasks (20 tasks)
   - Docker rebuild and deployment
   - Full regression testing

---

**Execution Started:** March 18, 2026, 10:30 AM IST
**First Milestone:** Priority 1 Complete by March 21, 2026
**Target Completion:** All 24 issues by April 15, 2026
