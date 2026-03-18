# 🎯 MASTER TASK LIST - Aarya Clothing 24-Issue Fix Program

**Created:** March 18, 2026
**Orchestrator:** Lead Project Manager
**Status:** IN PROGRESS
**Total Tasks:** 87

---

## 📊 EXECUTIVE SUMMARY

| Priority | Issues | Tasks | Status | Completion |
|----------|--------|-------|--------|------------|
| **Priority 1** - Critical Backend | 5 | 20 | 🔴 BLOCKING | 0% |
| **Priority 2** - Core Functionality | 8 | 32 | 🟡 PENDING | 0% |
| **Priority 3** - UX/UI Improvements | 8 | 28 | 🟢 PENDING | 0% |
| **Priority 4** - Cleanup | 3 | 7 | ⚪ PENDING | 0% |
| **TOTAL** | **24** | **87** | **IN PROGRESS** | **0%** |

---

## 🎯 EXECUTION STRATEGY

### Parallelization Matrix
```
WEEK 1 (Priority 1 - Blocking):
  lead-architect:     Tasks 1.1-1.3, 2.1, 4.1, 5.1
  frontend-specialist: Tasks 1.4, 3.1-3.2, 4.2, 5.2
  qa-engineer:        Tasks 1.5, 2.3-2.4, 3.3, 4.3, 5.3

WEEK 2 (Priority 2 - Core):
  lead-architect:     Tasks 6.1-6.3✅, 7.1, 8.3, 9.1-9.2, 10.1-10.3, 11.1-11.2, 12.1, 13.1
  frontend-specialist: Tasks 6.4✅, 7.2, 8.1-8.2, 9.3, 11.3, 12.2, 13.2
  qa-engineer:        Tasks 6.5✅, 7.3, 8.4, 9.4, 10.4, 11.4, 12.3, 13.3

WEEK 3 (Priority 3 - UX/UI):
  lead-architect:     Tasks 15.1, 16.1, 18.2, 20.1, 20.3, 21.3
  frontend-specialist: Tasks 14.1-14.3, 15.2-15.3, 16.2, 17.1-17.2, 19.1-19.2, 20.2, 21.1-21.2
  qa-engineer:        Tasks 14.4, 15.4, 16.3, 17.3, 18.1, 18.3, 19.3, 20.4, 21.4

WEEK 4 (Priority 4 - Cleanup):
  lead-architect:     Tasks 22.1, 22.3, 23.1-23.2, 24.3
  frontend-specialist: Task 22.2
  qa-engineer:        Tasks 22.4, 23.3, 24.1-24.2, 24.4
```

### Sequential Dependencies
```
Backend API Fix → Frontend Integration → QA Testing → Docker Rebuild → Production Deploy
     ↓                   ↓                    ↓              ↓              ↓
  lead-architect   frontend-specialist   qa-engineer   qa-engineer    orchestrator
```

---

## 🔴 PRIORITY 1: CRITICAL BACKEND ISSUES (BLOCKING)

### Issue #1: Admin Dashboard 500 Errors
**Severity:** CRITICAL | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 1.1 | Check admin service logs for error traces | lead-architect | ⏳ PENDING | 30m |
| 1.2 | Identify failing API endpoints | lead-architect | ⏳ PENDING | 30m |
| 1.3 | Fix backend service errors | lead-architect | ⏳ PENDING | 2h |
| 1.4 | Verify admin dashboard loads | frontend-specialist | ⏳ PENDING | 30m |
| 1.5 | Add regression test | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** All admin functionality

---

### Issue #2: Order Cycle Logic Inconsistencies
**Severity:** HIGH | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 2.1 | Review order_service.py status transitions | lead-architect | ⏳ PENDING | 1h |
| 2.2 | Check frontend getStatusActions() alignment | frontend-specialist | ⏳ PENDING | 30m |
| 2.3 | Test all valid transitions | qa-engineer | ⏳ PENDING | 1h |
| 2.4 | Test invalid transitions rejected | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** Order management

**Note:** QA report shows this is already implemented correctly. Verification needed.

---

### Issue #3: Return Page Layout Issues (Double Headers)
**Severity:** MEDIUM | **Owner:** frontend-specialist | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 3.1 | Inspect return page component structure | frontend-specialist | ⏳ PENDING | 30m |
| 3.2 | Remove duplicate header component | frontend-specialist | ⏳ PENDING | 30m |
| 3.3 | Verify layout consistency | qa-engineer | ⏳ PENDING | 30m |

**Dependencies:** None
**Blocks:** Returns UX

---

### Issue #4: Product Editing Not Working
**Severity:** HIGH | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 4.1 | Check product update API endpoint | lead-architect | ⏳ PENDING | 1h |
| 4.2 | Verify admin product form submission | frontend-specialist | ⏳ PENDING | 1h |
| 4.3 | Test product edit flow end-to-end | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** Product management

---

### Issue #5: Customer Pages Not Loading Products
**Severity:** HIGH | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 5.1 | Check product list API for customers | lead-architect | ⏳ PENDING | 1h |
| 5.2 | Verify customer product page fetch logic | frontend-specialist | ⏳ PENDING | 1h |
| 5.3 | Test product loading on customer pages | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** Customer shopping experience

---

## 🟡 PRIORITY 2: CORE FUNCTIONALITY

### Issue #6: Excel Export Improvements
**Severity:** MEDIUM | **Owner:** lead-architect | **Status:** ✅ COMPLETED

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 6.1 | Simplify columns to 9 essential fields | lead-architect | ✅ DONE | - |
| 6.2 | Add date range filter | lead-architect | ✅ DONE | - |
| 6.3 | Implement daily sheet splitting | lead-architect | ✅ DONE | - |
| 6.4 | Verify frontend export modal | frontend-specialist | ✅ DONE | - |
| 6.5 | Test export with various date ranges | qa-engineer | ✅ DONE | - |

**Note:** Per QA_VERIFICATION_REPORT.md - All checks PASSED

---

### Issue #7: Customer Management - Admin Can't See/Manage Customers
**Severity:** HIGH | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 7.1 | Check admin customer API endpoints | lead-architect | ⏳ PENDING | 1h |
| 7.2 | Verify customer list page | frontend-specialist | ⏳ PENDING | 1h |
| 7.3 | Test customer CRUD operations | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** Customer management

---

### Issue #8: Staff Accounts - New Tab Needed
**Severity:** MEDIUM | **Owner:** frontend-specialist | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 8.1 | Create staff dashboard route | frontend-specialist | ⏳ PENDING | 2h |
| 8.2 | Add orders/products/inventory/collections tabs | frontend-specialist | ⏳ PENDING | 3h |
| 8.3 | Implement staff permissions | lead-architect | ⏳ PENDING | 2h |
| 8.4 | Test staff access controls | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** Task 8.3 before 8.4
**Blocks:** Staff workflow

---

### Issue #9: Analytics - Realtime Improvements
**Severity:** MEDIUM | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 9.1 | Review current analytics implementation | lead-architect | ⏳ PENDING | 1h |
| 9.2 | Add realtime data updates (WebSocket/polling) | lead-architect | ⏳ PENDING | 3h |
| 9.3 | Update analytics dashboard UI | frontend-specialist | ⏳ PENDING | 2h |
| 9.4 | Verify data accuracy | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** Task 9.2 before 9.3
**Blocks:** Analytics accuracy

---

### Issue #10: AI Workflow Optimization
**Severity:** MEDIUM | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 10.1 | Audit AI tool usage patterns | lead-architect | ⏳ PENDING | 2h |
| 10.2 | Implement cost optimization | lead-architect | ⏳ PENDING | 2h |
| 10.3 | Add rate limiting | lead-architect | ⏳ PENDING | 2h |
| 10.4 | Test AI responses under load | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** Task 10.2 before 10.4
**Blocks:** AI cost control

---

### Issue #11: Chat Support - WhatsApp-like Realtime
**Severity:** MEDIUM | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 11.1 | Review current chat implementation | lead-architect | ⏳ PENDING | 1h |
| 11.2 | Add WebSocket for realtime updates | lead-architect | ⏳ PENDING | 3h |
| 11.3 | Update chat UI for realtime messages | frontend-specialist | ⏳ PENDING | 2h |
| 11.4 | Test concurrent chat sessions | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** Task 11.2 before 11.3
**Blocks:** Chat UX

---

### Issue #12: Landing Page - Changes Not Reflecting
**Severity:** HIGH | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 12.1 | Check landing page cache invalidation | lead-architect | ⏳ PENDING | 1h |
| 12.2 | Verify admin landing page editor | frontend-specialist | ⏳ PENDING | 1h |
| 12.3 | Test landing page updates | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** Marketing updates

---

### Issue #13: Collections - Admin/Customer Sync
**Severity:** MEDIUM | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 13.1 | Check collections API consistency | lead-architect | ⏳ PENDING | 1h |
| 13.2 | Verify collection display on both sides | frontend-specialist | ⏳ PENDING | 1h |
| 13.3 | Test collection CRUD operations | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** Collection management

---

## 🟢 PRIORITY 3: UX/UI IMPROVEMENTS

### Issue #14: Layout Errors, Button Placement, Slider Alignment
**Severity:** LOW | **Owner:** frontend-specialist | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 14.1 | Audit all layout issues | frontend-specialist | ⏳ PENDING | 2h |
| 14.2 | Fix button placement inconsistencies | frontend-specialist | ⏳ PENDING | 2h |
| 14.3 | Fix slider alignment issues | frontend-specialist | ⏳ PENDING | 2h |
| 14.4 | Visual regression testing | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** Visual polish

---

### Issue #15: Remove COD, Simplify Checkout
**Severity:** HIGH | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 15.1 | Remove COD payment option from backend | lead-architect | ⏳ PENDING | 1h |
| 15.2 | Update checkout flow to single final price | frontend-specialist | ⏳ PENDING | 2h |
| 15.3 | Remove COD from payment methods UI | frontend-specialist | ⏳ PENDING | 1h |
| 15.4 | Test checkout flow end-to-end | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** Task 15.1 before 15.2
**Blocks:** Payment policy

---

### Issue #16: Simplify Billing/Invoice (No GST Breakup)
**Severity:** MEDIUM | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 16.1 | Update invoice generation to remove GST details | lead-architect | ⏳ PENDING | 1h |
| 16.2 | Simplify invoice template | frontend-specialist | ⏳ PENDING | 1h |
| 16.3 | Test invoice generation | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** Invoice simplicity

---

### Issue #17: Policy Documents (Returns with Video Only)
**Severity:** LOW | **Owner:** frontend-specialist | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 17.1 | Update returns policy content | frontend-specialist | ⏳ PENDING | 1h |
| 17.2 | Add video requirement to policy | frontend-specialist | ⏳ PENDING | 1h |
| 17.3 | Verify policy pages display correctly | qa-engineer | ⏳ PENDING | 30m |

**Dependencies:** None
**Blocks:** Policy clarity

---

### Issue #18: Razorpay Integration Verification
**Severity:** HIGH | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 18.1 | Test Razorpay payment flow | qa-engineer | ⏳ PENDING | 1h |
| 18.2 | Verify webhook handling | lead-architect | ⏳ PENDING | 1h |
| 18.3 | Test refund processing | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** None
**Blocks:** Payment reliability

---

### Issue #19: Mobile Responsiveness
**Severity:** HIGH | **Owner:** frontend-specialist | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 19.1 | Audit mobile layout issues | frontend-specialist | ⏳ PENDING | 2h |
| 19.2 | Fix responsive breakpoints | frontend-specialist | ⏳ PENDING | 3h |
| 19.3 | Test on multiple devices | qa-engineer | ⏳ PENDING | 2h |

**Dependencies:** None
**Blocks:** Mobile UX

---

### Issue #20: Staff Dashboard (Limited Features)
**Severity:** MEDIUM | **Owner:** frontend-specialist | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 20.1 | Define staff feature set | lead-architect | ⏳ PENDING | 1h |
| 20.2 | Implement staff dashboard UI | frontend-specialist | ⏳ PENDING | 3h |
| 20.3 | Add feature flags for staff | lead-architect | ⏳ PENDING | 2h |
| 20.4 | Test staff permissions | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** Task 20.1 before 20.2, 20.3 before 20.4
**Blocks:** Staff workflow

---

### Issue #21: Super Admin (AI Analysis Only)
**Severity:** LOW | **Owner:** frontend-specialist | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 21.1 | Create super admin route | frontend-specialist | ⏳ PENDING | 1h |
| 21.2 | Add AI analysis dashboard | frontend-specialist | ⏳ PENDING | 3h |
| 21.3 | Implement super admin permissions | lead-architect | ⏳ PENDING | 2h |
| 21.4 | Test super admin access | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** Task 21.3 before 21.4
**Blocks:** AI oversight

---

## ⚪ PRIORITY 4: CLEANUP

### Issue #22: Remove Hardcoded R2 URLs
**Severity:** MEDIUM | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 22.1 | Find all hardcoded R2 URLs (grep search) | lead-architect | ⏳ PENDING | 1h |
| 22.2 | Create admin upload interface | frontend-specialist | ⏳ PENDING | 3h |
| 22.3 | Migrate hardcoded URLs to dynamic | lead-architect | ⏳ PENDING | 2h |
| 22.4 | Verify all images load correctly | qa-engineer | ⏳ PENDING | 1h |

**Dependencies:** Task 22.2 before 22.3
**Blocks:** Image management

---

### Issue #23: General Bug Fixes
**Severity:** LOW | **Owner:** lead-architect | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 23.1 | Collect all minor bugs | lead-architect | ⏳ PENDING | 1h |
| 23.2 | Fix bugs in batches | lead-architect + frontend-specialist | ⏳ PENDING | 4h |
| 23.3 | Regression testing | qa-engineer | ⏳ PENDING | 2h |

**Dependencies:** None
**Blocks:** Polish

---

### Issue #24: Full Sync Verification
**Severity:** HIGH | **Owner:** qa-engineer | **Status:** PENDING

| Task | Description | Agent | Status | Est. Time |
|------|-------------|-------|--------|-----------|
| 24.1 | Create comprehensive test checklist | qa-engineer | ⏳ PENDING | 1h |
| 24.2 | Run full test suite | qa-engineer | ⏳ PENDING | 4h |
| 24.3 | Document any remaining issues | lead-architect | ⏳ PENDING | 1h |
| 24.4 | Final approval | orchestrator | ⏳ PENDING | 1h |

**Dependencies:** All other tasks must be complete
**Blocks:** Production deployment

---

## 📈 PROGRESS TRACKING

### Daily Standup Template
```markdown
## Date: YYYY-MM-DD

### Completed Today
- [ ] Task X.X - Description

### In Progress
- [ ] Task X.X - Description (ETA: EOD/Tomorrow)

### Blockers
- [ ] Issue description

### Tomorrow's Plan
- Task X.X
- Task Y.Y
```

### Weekly Milestone Check
- [ ] Week 1: Priority 1 complete (5 issues, 20 tasks)
- [ ] Week 2: Priority 2 complete (8 issues, 32 tasks)
- [ ] Week 3: Priority 3 complete (8 issues, 28 tasks)
- [ ] Week 4: Priority 4 complete (3 issues, 7 tasks)

---

## 🎯 AGENT ASSIGNMENTS SUMMARY

### lead-architect (33 tasks)
- Backend API design and implementation
- Database schema changes
- Service integration
- Security patterns
- Performance optimization

### frontend-specialist (32 tasks)
- Next.js component implementation
- UI/UX polish
- Responsive design
- Client-side state management
- Performance optimization (Core Web Vitals)

### qa-engineer (22 tasks)
- Docker rebuilds
- Playwright test execution
- Environment cleanup
- Regression testing
- Performance verification

---

## 📋 DEFINITION OF DONE

Each task is considered complete when:
1. ✅ Code implemented following KISS/DRY principles
2. ✅ Unit/integration tests passing
3. ✅ No breaking changes to existing functionality
4. ✅ Performance metrics meet standards (LCP < 2.5s, CLS < 0.1, FID < 100ms)
5. ✅ Code reviewed by orchestrator
6. ✅ Docker rebuild successful
7. ✅ E2E test passing

---

## 🚨 ESCALATION PATH

If a task is blocked or failing:
1. Agent reports blocker in task status
2. Orchestrator investigates within 2 hours
3. Orchestrator provides solution or reassigns
4. If unresolved after 24 hours, escalate to user

---

**Last Updated:** March 18, 2026
**Next Review:** Daily standup
**Target Completion:** April 15, 2026 (4 weeks)
