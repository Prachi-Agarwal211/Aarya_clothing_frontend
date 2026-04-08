---
name: aarya-verification-before-completion
description: Use when completing any task, feature, or bugfix in the Aarya project. Mandates comprehensive verification checklist before marking work as done: tests pass, manual testing complete, no new errors in logs, database integrity verified. Prevents "works on my machine" deployments.
---

# Aarya Verification Before Completion

## Overview
Mandatory verification checklist before marking any Aarya task as complete. Ensures code works in practice, not just in theory. No "works on my machine" allowed.

## When to Use
- After implementing any feature
- After fixing any bug
- Before committing code
- Before deploying to production
- **When NOT to use:** WIP work, experimental branches

## Core Pattern

### Automated Tests → Manual Testing → Log Check → Database Check → Document → Complete

```
CODE CHANGES COMPLETE
    ↓
RUN automated tests (must all pass)
    ↓
MANUAL testing in dev environment
    ↓
CHECK logs for new errors
    ↓
VERIFY database integrity
    ↓
DOCUMENT what was done
    ↓
MARK as complete
```

## Quick Reference

### Verification Commands by Component

| Component | Test Command | Manual Check |
|-----------|--------------|--------------|
| Frontend | `cd frontend_new && npm test && npm run build` | Open in browser, test user flow |
| Backend API | `cd services/<service> && pytest` | `curl` all new/modified endpoints |
| Database | N/A | Run migration, verify schema |
| Docker | `docker-compose config` | `docker-compose ps` (all healthy) |
| Production | N/A | `curl -I https://aaryaclothing.in` |

## Implementation

### Complete Verification Checklist

#### 1. Automated Tests ✅

```bash
# Frontend unit/integration tests
cd /opt/Aarya_clothing_frontend/frontend_new
npm test
# Expected: All tests passing

# Build check (catches TypeScript/compilation errors)
npm run build
# Expected: Build successful, no errors

# Backend tests
cd /opt/Aarya_clothing_frontend/services/commerce
pytest -v
# Expected: All tests passing

cd /opt/Aarya_clothing_frontend/services/payment
pytest -v
# Expected: All tests passing

# E2E tests (if applicable)
cd /opt/Aarya_clothing_frontend
npx playwright test
# Expected: All scenarios passing
```

#### 2. Manual Testing ✅

```bash
# Test the actual feature end-to-end

# Example: Coupon system
# 1. Create coupon in admin panel
curl -X POST https://localhost:6004/api/v1/admin/coupons \
  -H "Authorization: Bearer <admin_token>" \
  -d '{"code": "TEST20", "type": "percentage", "value": 20}'

# 2. Apply coupon in checkout
curl -X POST https://localhost:6004/api/v1/coupons/validate \
  -d '{"code": "TEST20", "cart_total": 1000}'
# Expected: {"valid": true, "discount": 200}

# 3. Complete order with coupon
# Verify discount applied in order total
# Verify discount stored in database
```

#### 3. Log Check ✅

```bash
# Check for new errors in logs
docker logs aarya_frontend --tail 100 | grep -i "error\|exception\|failed"
# Expected: No new critical errors

docker logs aarya_commerce --tail 100 | grep -i "error\|exception\|failed"
# Expected: No new critical errors

docker logs aarya_payment --tail 100 | grep -i "error\|exception\|failed"
# Expected: No new critical errors
```

#### 4. Database Integrity ✅

```bash
# Verify migrations ran successfully
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' 
  ORDER BY table_name;
"

# Check data integrity
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
  -- Example: Check no orphaned records
  SELECT COUNT(*) as orphaned_orders
  FROM orders o
  LEFT JOIN payment_transactions pt ON o.id = pt.order_id
  WHERE pt.id IS NULL AND o.payment_method = 'razorpay';
"
# Expected: 0

# Verify new columns/tables exist
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
  SELECT column_name FROM information_schema.columns 
  WHERE table_name = 'coupons' ORDER BY ordinal_position;
"
```

#### 5. Documentation ✅

```markdown
# Create brief summary of what was done

## Changes Made
- Added coupon validation service
- Created admin coupon management UI
- Integrated discount calculation in checkout
- Added database tables: coupons, coupon_usage

## Files Modified
- migrations/add_coupons_table.sql (NEW)
- services/commerce/service/coupon_service.py (NEW)
- services/commerce/routes/coupons.py (NEW)
- frontend_new/components/checkout/CouponInput.jsx (NEW)
- frontend_new/app/admin/coupons/page.js (NEW)

## Testing
- ✅ Unit tests: 15 tests passing
- ✅ Integration tests: 5 tests passing
- ✅ Manual testing: Coupon creation, validation, application working
- ✅ No new errors in logs

## Deployment Notes
- Run migration before deploying code
- No environment variables needed
- Backward compatible (no breaking changes)
```

## Common Mistakes

- **[Skipping tests because "it works"]:** Always run automated tests first.
- **[Not testing edge cases]:** Test invalid inputs, empty states, error scenarios.
- **[Ignoring logs]:** New errors in logs indicate hidden problems.
- **[Assuming migrations work]:** Always verify database schema changes.
- **[No documentation]:** Future developers (including you) will forget what was done.

## Real-World Impact

- **Zero "works on my machine" issues** - verification catches environment differences
- **Faster debugging** - complete documentation helps diagnose future issues
- **Confident deployments** - know exactly what changed and how to verify it
- **No regressions** - comprehensive testing ensures existing features still work
