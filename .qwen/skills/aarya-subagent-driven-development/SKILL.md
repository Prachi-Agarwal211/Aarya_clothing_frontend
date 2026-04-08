---
name: aarya-subagent-driven-development
description: Use when implementing multi-part features, fixing complex bugs across services, or any task that can be decomposed into independent subtasks in the Aarya project. Dispatches isolated subagents (frontend-specialist, lead-architect, qa-engineer) for parallel execution with strict context boundaries and integration checkpoints.
---

# Aarya Subagent-Driven Development

## Overview
Decompose complex Aarya tasks into isolated subagent executions. Each subagent works on a single problem domain with zero shared context, enabling parallel development and preventing cross-task interference.

## When to Use
- Implementing features spanning multiple services (e.g., new checkout flow)
- Fixing bugs that touch frontend + backend + database
- Large refactoring tasks (database migrations, API changes)
- Performance optimization across multiple components
- Any task that takes >30 minutes of sequential work
- **When NOT to use:** Simple one-file changes, obvious fixes (<5 lines)

## Core Pattern

### Decomposition → Dispatch → Integrate → Verify

```
COMPLEX TASK
    ↓
DECOMPOSE into independent subtasks
    ↓
DISPATCH subagents in parallel (if independent)
    ↓
INTEGRATE results (check for conflicts)
    ↓
VERIFY with full test suite
```

## Quick Reference

| Subagent | When to Use | Example |
|----------|-------------|---------|
| **frontend-specialist** | Next.js components, UI/UX, performance | "Build product detail page" |
| **lead-architect** | Code review, architecture decisions | "Review API design before implementing" |
| **qa-engineer** | Test validation, regression prevention | "Run tests after feature implementation" |
| **aarya-orchestrator** | Full-stack feature development | "Add coupon code feature" |
| **general-purpose** | Research, exploration, multi-file search | "Find all payment-related code" |

## Implementation

### Example: Implement Product Reviews Feature

#### Step 1: DECOMPOSE

```
Task: "Add product reviews feature"

Independent subtasks:
1. Database schema (reviews table)
2. Backend API (CRUD endpoints)
3. Frontend UI (review form + display)
4. Admin moderation panel
5. Tests (unit + integration + E2E)
```

#### Step 2: DISPATCH (Parallel Where Possible)

```javascript
// Dispatch database schema task
Task("Create reviews table migration:
- id, product_id, user_id, order_id, rating, title, comment
- Foreign keys with CASCADE delete
- Indexes on product_id, user_id
- Run migration and verify table created
File: migrations/add_reviews_table.sql")

// Dispatch backend API task (can run in parallel with DB)
Task("Create review API endpoints:
- GET /api/v1/reviews/product/:product_id
- POST /api/v1/reviews (requires auth + verified purchase)
- PUT /api/v1/reviews/:id (author only)
- DELETE /api/v1/reviews/:id (admin only)
- GET /api/v1/reviews/:id
Include validation, error handling, pagination.
Files: services/commerce/routes/reviews.py, services/commerce/service/review_service.py")

// Dispatch frontend UI task (can run in parallel)
Task("Build product review UI components:
- ReviewList component (display reviews with pagination)
- ReviewForm component (star rating, title, comment)
- ReviewSummary component (average rating, distribution)
- Integrate with product detail page
Files: frontend_new/components/reviews/ReviewList.jsx, etc.")
```

#### Step 3: INTEGRATE

```bash
# After all subagents complete:

# 1. Check for file conflicts
git status
git diff --name-only

# 2. Verify no overlapping edits
# - Did multiple agents edit the same file?
# - Are there conflicting changes?

# 3. Run migration
docker exec -i aarya_postgres psql -U postgres -d aarya_clothing < \
  migrations/add_reviews_table.sql

# 4. Rebuild services
docker-compose build commerce frontend

# 5. Restart
docker-compose restart commerce frontend
```

#### Step 4: VERIFY

```bash
# Run all tests
cd frontend_new && npm test
cd services/commerce && pytest
npx playwright test tests/e2e/reviews.spec.js

# Test in browser
curl https://aaryaclothing.in/api/v1/reviews/product/1

# Verify in admin panel
# Navigate to /admin/reviews
```

### Example: Fix Payment Transaction Bug (Sequential)

```javascript
// These must run SEQUENTIALLY (each depends on previous)

// Step 1: Research root cause
Task("Investigate why payment_transactions records are missing for 6 orders:
1. Read services/commerce/service/order_service.py (lines 427-467)
2. Check docker logs for errors
3. Query database to find orphaned orders
4. Document root cause analysis
Return: Detailed findings with code locations")

// Step 2: Implement fix (after root cause identified)
Task("Fix payment transaction creation in order_service.py:
1. Change ON CONFLICT DO NOTHING → DO UPDATE
2. Add rowcount verification
3. Add error handling with order marking
4. Add retry logic
5. Add alerting for failures
File: services/commerce/service/order_service.py")

// Step 3: Write tests
Task("Write integration tests for payment transaction creation:
1. Test that order creation creates payment_transactions
2. Test duplicate handling
3. Test error scenarios
4. Test retry logic
File: tests/integration/test_order_payment_trail.py")

// Step 4: Verify and deploy
Task("1. Run all tests
2. Create test order and verify payment record
3. Run migration to backfill orphaned orders
4. Verify no orphaned orders remain
5. Document verification results")
```

## Common Mistakes

- **[Dispatching dependent tasks in parallel]:** If task B needs task A's output, run sequentially.
- **[Sharing too much context]:** Only give subagents the files/info they need.
- **[Not verifying integration]:** Always run full test suite after integrating subagent work.
- **[Skipping the architect review]:** For complex features, use lead-architect BEFORE implementing.
- **[Letting subagents run too long]:** Check progress every 5-10 minutes.

## Real-World Impact

- **3x faster development** - parallel execution of independent tasks
- **Zero integration conflicts** - strict context boundaries prevent overlaps
- **Better code quality** - specialized agents focus on their domains
- **Easier debugging** - each subagent isolates its problem domain
