---
name: aarya-finishing-a-development-branch
description: Use when completing work on an Aarya feature or bugfix branch. Verifies all tests pass, presents merge/PR/cleanup options, and removes worktrees. Ensures clean completion with no leftover artifacts.
---

# Aarya Finish Development Branch

## Overview
Formal completion process for Aarya feature branches. Verifies all tests, presents integration options, and cleans up worktrees. No branch is "done" until this process completes successfully.

## When to Use
- After implementing all tasks in a feature plan
- After fixing a bug and verifying the fix
- Before requesting code review
- Before merging to main
- **When NOT to use:** WIP work, still implementing tasks

## Core Pattern

### Verify → Present Options → Execute Chosen Path → Cleanup

```
ALL TASKS COMPLETE
    ↓
VERIFY all tests pass
    ↓
PRESENT options (merge, PR, cleanup)
    ↓
EXECUTE chosen option
    ↓
CLEANUP worktrees
```

## Quick Reference

| Option | When to Use | Command |
|--------|-------------|---------|
| Merge to main | Small features, bug fixes | `git checkout main && git merge feature/branch` |
| Create PR | Larger features, team review | `git push origin feature/branch` then create PR |
| Keep branch | Experimental, not ready yet | Do nothing, continue working |

## Implementation

### Step 1: Verify Everything

```bash
# Run all tests
cd /opt/Aarya_clothing_frontend/frontend_new && npm test
cd /opt/Aarya_clothing_frontend/services/commerce && pytest
cd /opt/Aarya_clothing_frontend/services/payment && pytest
npx playwright test

# Check build
cd /opt/Aarya_clothing_frontend/frontend_new && npm run build

# Check logs for errors
docker logs aarya_commerce --tail 50 | grep -i "error\|exception"
docker logs aarya_payment --tail 50 | grep -i "error\|exception"

# Verify database integrity
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
  SELECT COUNT(*) FROM orders;
  SELECT COUNT(*) FROM payment_transactions;
"
```

### Step 2: Present Completion Summary

```markdown
## ✅ Feature Complete: Coupon System

### What Was Implemented
- ✅ Coupon validation service (percentage & fixed discounts)
- ✅ Usage limits (per customer, global, time-based)
- ✅ Admin CRUD interface with analytics
- ✅ Checkout coupon input with real-time validation
- ✅ Discount tracking in orders table

### Test Results
- Frontend: 42 tests passing ✅
- Backend: 28 tests passing ✅
- E2E: 5 scenarios passing ✅
- Build: Successful ✅

### Files Changed
- 2 new migrations
- 5 new backend files
- 4 new frontend files
- 8 test files

### Database Changes
- ✅ coupons table created
- ✅ coupon_usage table created
- ✅ orders.discount_amount column added
- ✅ All indexes created

### Breaking Changes
- None (fully backward compatible)
```

### Step 3: Present Options

```
What would you like to do?

1. **Merge to main immediately**
   git checkout main
   git merge feature/coupon-system --no-ff
   git push origin main
   git worktree remove ../aarya-coupon-system
   git branch -d feature/coupon-system

2. **Create PR for review**
   git push origin feature/coupon-system
   # Opens GitHub PR page
   # Team reviews, approves, then merges

3. **Keep working on branch**
   # Continue development in worktree
   # Run this skill again when ready

4. **Squash and merge**
   git checkout main
   git merge --squash feature/coupon-system
   git commit -m "feat: add complete coupon system"
   git push origin main
```

### Step 4: Execute & Cleanup

```bash
# If option 1 (merge):
git checkout main
git pull origin main
git merge feature/coupon-system --no-ff -m "feat: add complete coupon system with admin UI"
git push origin main
git worktree remove ../aarya-coupon-system
git branch -d feature/coupon-system

# If option 2 (PR):
git push origin feature/coupon-system
# Use GitHub UI to create PR
# Keep worktree for addressing review comments

# If option 4 (squash):
git checkout main
git pull origin main
git merge --squash feature/coupon-system
git commit -m "feat: add coupon system with validation, admin UI, and checkout integration"
git push origin main
git worktree remove ../aarya-coupon-system
git branch -d feature/coupon-system
```

### Step 5: Post-Merge Verification

```bash
# Verify main branch still works
cd /opt/Aarya_clothing_frontend
git checkout main

# Run tests on main
cd frontend_new && npm test
cd services/commerce && pytest

# Build and restart if needed
docker-compose build commerce frontend
docker-compose restart commerce frontend

# Verify in production/staging
curl -I https://aaryaclothing.in
```

## Common Mistakes

- **[Merging without running tests]:** Always verify on main branch after merge.
- **[Leaving worktrees around]:** They consume disk space and create confusion.
- **[Forgetting to push]:** Local merge doesn't help if not pushed to remote.
- **[Not updating main first]:** Always pull latest main before merging to avoid conflicts.
- **[Deleting branch before push]:** Can't recover if something goes wrong.

## Real-World Impact

- **Clean git history** - proper merges with descriptive messages
- **No orphaned worktrees** - saves disk space, reduces confusion
- **Confident merges** - verified working before and after
- **Team alignment** - clear process everyone follows
