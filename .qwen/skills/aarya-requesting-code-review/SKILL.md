---
name: aarya-requesting-code-review
description: Use when code changes are complete and need validation before merging to main branch in the Aarya project. Triggers automated two-stage review: spec compliance check → code quality check. Ensures implementation matches requirements and follows project standards.
---

# Aarya Code Review Process

## Overview
Two-stage code review for Aarya project changes. Stage 1 verifies spec compliance (does it meet requirements?), Stage 2 checks code quality (is it well-written?). Critical issues block merging until resolved.

## When to Use
- After completing any feature implementation
- Before merging feature branches to main
- After fixing complex bugs
- Before deploying to production
- **When NOT to use:** Documentation changes, typo fixes

## Core Pattern

### Stage 1: Spec Compliance → Stage 2: Code Quality → Approve or Block

```
IMPLEMENTATION COMPLETE
    ↓
STAGE 1: Does it meet requirements?
    ↓
STAGE 2: Is code quality acceptable?
    ↓
APPROVE (merge) or BLOCK (fix issues)
```

## Quick Reference

### Stage 1: Spec Compliance Checklist

| Question | How to Verify |
|----------|---------------|
| Does it meet all requirements? | Compare against original spec/plan |
| Are all edge cases handled? | Review error handling, validation |
| Are tests comprehensive? | Check test coverage, edge cases tested |
| Does it work end-to-end? | Manual testing in dev environment |
| Any breaking changes? | Check API contracts, database migrations |

### Stage 2: Code Quality Checklist

| Question | How to Verify |
|----------|---------------|
| Follows project patterns? | Compare with existing code in same files |
| No over-engineering? | KISS principle - simplest solution that works |
| DRY principles followed? | No code duplication |
| Security considerations? | No hardcoded secrets, proper auth checks |
| Performance acceptable? | No N+1 queries, proper indexing |

## Implementation

### Stage 1: Spec Compliance Review

```python
# Example: Review coupon system implementation

# 1. Load original requirements/plan
with open('.qwen/plans/coupon-system.md') as f:
    plan = f.read()

# 2. Check each requirement is met
requirements = [
    "✅ Coupon validation (code exists, not expired, not maxed out)",
    "✅ Percentage and fixed discounts working",
    "✅ Usage limits enforced (per customer, global)",
    "✅ Admin CRUD interface functional",
    "✅ Discount displayed in checkout",
    "✅ Discount amount stored in orders table",
    "❌ Usage analytics dashboard - MISSING"
]

# 3. Identify gaps
missing = ["Usage analytics dashboard"]
if missing:
    print(f"⚠️  SPEC COMPLIANCE ISSUES: {missing}")
    print("Either implement missing items or get approval to defer")
```

### Stage 2: Code Quality Review

```python
# Example: Review coupon_service.py

# 1. Check for over-engineering
with open('services/commerce/service/coupon_service.py') as f:
    code = f.read()
    
# ❌ BAD: Unnecessary abstraction
class CouponValidatorFactory:
    @staticmethod
    def create_validator(coupon_type):
        if coupon_type == 'percentage':
            return PercentageCouponValidator()
        elif coupon_type == 'fixed':
            return FixedCouponValidator()

# ✅ GOOD: Simple and direct
def validate_coupon(coupon_code, cart_total):
    coupon = get_coupon(coupon_code)
    if not coupon:
        return False, "Invalid coupon code"
    if coupon.is_expired():
        return False, "Coupon expired"
    if coupon.is_maxed_out():
        return False, "Coupon usage limit reached"
    if cart_total < coupon.min_order_value:
        return False, f"Minimum order value: ₹{coupon.min_order_value}"
    return True, "Coupon valid"

# 2. Check for code duplication
# Search for repeated patterns that should be extracted
grep -n "is_expired" services/commerce/service/*.py

# 3. Check security
grep -n "password\|secret\|key" services/commerce/service/coupon_service.py
# Should find nothing sensitive

# 4. Check performance
# Look for N+1 queries
grep -n "for.*in.*query" services/commerce/service/coupon_service.py
```

### Review Decision Matrix

| Stage 1 Issues | Stage 2 Issues | Decision |
|----------------|----------------|----------|
| None | None | ✅ APPROVE - Merge |
| Minor (documented) | None | ✅ APPROVE - Create follow-up task |
| Major | Any | 🚫 BLOCK - Fix before merging |
| None | Minor | ⚠️ CONDITIONAL - Fix minor issues, then merge |
| Any | Major | 🚫 BLOCK - Major refactoring needed |

## Common Mistakes

- **[Rubber-stamping reviews]:** Actually read and understand the code.
- **[Focusing on style over substance]:** Prioritize correctness over formatting.
- **[Not checking against spec]:** Code can be perfect but wrong if it doesn't meet requirements.
- **[Ignoring security]:** Always check for hardcoded secrets, missing auth checks.
- **[Skipping performance review]:** Look for N+1 queries, missing indexes, inefficient loops.

## Real-World Impact

- **Zero production bugs** from reviewed code
- **Consistent code quality** across all contributors
- **Knowledge sharing** - reviewers learn from implementations
- **Prevents technical debt** - catches over-engineering early
