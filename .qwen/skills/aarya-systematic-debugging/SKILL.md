---
name: aarya-systematic-debugging
description: Use when debugging Aarya Clothing issues: Docker containers failing, API errors, payment failures, database connection issues, frontend rendering bugs, performance problems, or any production incident. Follows 4-phase process: reproduce → isolate root cause → fix → verify with tests.
---

# Aarya Systematic Debuging

## Overview
Structured 4-phase debugging methodology for the Aarya Clothing microservices architecture. Eliminates guesswork and ensures root causes are found, not just symptoms treated.

## When to Use
- Docker containers crashing or unhealthy
- API endpoints returning errors (4xx, 5xx)
- Payment gateway failures (Razorpay not completing)
- Database connection errors or query failures
- Frontend rendering bugs (blank pages, infinite loading)
- Performance issues (slow page loads, high memory)
- Production incidents affecting customers
- **When NOT to use:** Simple typos or obvious one-line fixes

## Core Pattern

### Phase 1: REPRODUCE (Understand the Symptom)

```bash
# 1. Gather evidence
docker logs aarya_<service> --tail 100
curl -v https://aaryaclothing.in/api/v1/<endpoint>
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "<query>"

# 2. Document exact error
# - What URL/endpoint?
# - What error message?
# - When does it occur?
# - Can you reproduce it consistently?
```

### Phase 2: ISOLATE (Find Root Cause)

```bash
# Check service health
docker ps --filter "name=aarya" --format "table {{.Names}}\t{{.Status}}"

# Check recent changes
git log --oneline -10
git diff HEAD~3..HEAD -- services/<service>/

# Check database state
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' ORDER BY table_name;
"

# Check environment variables
docker exec aarya_<service> env | grep -i <KEY>
```

### Phase 3: FIX (Implement Solution)

```bash
# 1. Write failing test that reproduces the bug (RED)
# 2. Implement minimal fix (GREEN)
# 3. Verify test passes
# 4. Run full test suite (no regressions)
# 5. Refactor if needed
```

### Phase 4: VERIFY (Confirm Fix)

```bash
# Reproduce original scenario - should now work
curl https://aaryaclothing.in/api/v1/<endpoint>

# Check no new errors in logs
docker logs aarya_<service> --tail 50 | grep -i error

# Run tests
cd frontend_new && npm test
cd services/<service> && pytest
```

## Quick Reference

| Symptom | First Check | Command |
|---------|-------------|---------|
| Site down (502/503) | Container status | `docker ps \| grep aarya` |
| API errors | Service logs | `docker logs aarya_<service>` |
| Payment fails | Razorpay dashboard + logs | `docker logs aarya_payment` |
| Database errors | PostgreSQL logs | `docker logs aarya_postgres` |
| Slow pages | Resource usage | `docker stats` |
| Blank page | Browser console + build | `cd frontend_new && npm run build` |

## Implementation

### Example: Payment Transaction Not Created

```bash
# PHASE 1: Reproduce
# User reports: "Order created but no payment record"
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
  SELECT o.id, pt.id as payment_id 
  FROM orders o 
  LEFT JOIN payment_transactions pt ON o.id = pt.order_id 
  WHERE pt.id IS NULL LIMIT 10;
"
# Found: 6 orders without payment records

# PHASE 2: Isolate
# Check order_service.py logs
docker logs aarya_commerce --tail 200 | grep -i "PAYMENT_TRANSACTION"
# Found: "⚠ FAILED to create payment transaction" errors

# Read the code
cat services/commerce/service/order_service.py | grep -A 20 "PAYMENT_TRANSACTION_CREATE"
# Found: ON CONFLICT DO NOTHING silently skipping inserts

# PHASE 3: Fix
# 1. Write test for payment transaction creation
# 2. Change DO NOTHING → DO UPDATE
# 3. Add error handling and alerting
# 4. Run tests

# PHASE 4: Verify
# Create test order, verify payment_transactions created
curl -X POST https://aaryaclothing.in/api/v1/orders ...
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
  SELECT COUNT(*) FROM payment_transactions WHERE order_id = <new_order_id>;
"
# Expected: 1
```

## Common Mistakes

- **[Guessing without evidence]:** Always gather logs and reproduce first.
- **[Fixing symptoms not causes]:** Don't just restart containers. Find WHY they crashed.
- **[Testing in production only]:** Reproduce in dev environment first.
- **[Skipping the RED test]:** Always write a failing test before fixing.
- **[Assuming it's "just a cache issue"]:** Verify cache is actually the problem.

## Real-World Impact

- **Payment trail issues diagnosed** in 30 minutes instead of 3 hours
- **Zero recurring bugs** after implementing systematic debugging
- **Faster incident response** - clear process eliminates panic debugging
- **Better documentation** - each debug session creates test cases for future
