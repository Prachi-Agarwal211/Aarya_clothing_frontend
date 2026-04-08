---
name: aarya-using-git-worktrees
description: Use when implementing any feature or fix that requires code changes in the Aarya project. Creates isolated Git worktrees for safe development, preventing conflicts with main branch and enabling easy cleanup. Triggers on any implementation task.
---

# Aarya Git Worktree Isolation

## Overview
Isolated development using Git worktrees for safe feature development. Each feature gets its own branch and working directory, preventing interference with main codebase and enabling easy cleanup or rollback.

## When to Use
- Implementing any new feature
- Fixing bugs that require multiple commits
- Experimenting with different approaches
- Testing risky changes
- **When NOT to use:** One-line fixes, documentation updates

## Core Pattern

### Create → Develop → Merge → Cleanup

```
MAIN BRANCH (clean)
    ↓
CREATE worktree on feature branch
    ↓
DEVELOP safely (tests, commits, iterations)
    ↓
MERGE back to main when complete
    ↓
CLEANUP worktree
```

## Quick Reference

| Command | Purpose |
|---------|---------|
| `git worktree add ../aarya-feature-branch -b feature/branch-name` | Create isolated worktree |
| `git worktree list` | List all worktrees |
| `git worktree remove ../aarya-feature-branch` | Remove worktree |
| `git worktree prune` | Clean up stale worktrees |

## Implementation

### Standard Workflow

```bash
# 1. Start from clean main branch
cd /opt/Aarya_clothing_frontend
git checkout main
git pull origin main

# 2. Create worktree for feature
git worktree add ../aarya-coupon-system -b feature/coupon-system

# 3. Work in the isolated directory
cd ../aarya-coupon-system

# Make changes, commit safely
git add .
git commit -m "feat: add coupon database schema"

# 4. When complete, merge back to main
cd /opt/Aarya_clothing_frontend
git merge feature/coupon-system

# 5. Push and cleanup
git push origin main
git worktree remove ../aarya-coupon-system
```

### Parallel Feature Development

```bash
# Create multiple worktrees for parallel features
git worktree add ../aarya-coupons -b feature/coupons
git worktree add ../aarya-reviews -b feature/reviews
git worktree add ../aarya-analytics -b feature/analytics

# Work on each independently
cd ../aarya-coupons
# ... develop coupons ...

cd ../aarya-reviews
# ... develop reviews ...

# Merge when ready
cd /opt/Aarya_clothing_frontend
git merge feature/coupons
git merge feature/reviews
```

## Common Mistakes

- **[Working directly on main]:** Always use feature branches via worktrees.
- **[Not cleaning up worktrees]:** Remove them after merging to save disk space.
- **[Forgetting to pull latest main]:** Always start from updated main branch.
- **[Committing broken code]:** Only commit working code with passing tests.

## Real-World Impact

- **Zero main branch breakages** - all development isolated
- **Parallel development** - multiple features without conflicts
- **Easy experimentation** - discard failed approaches cleanly
- **Safe rollbacks** - just switch back to main branch
