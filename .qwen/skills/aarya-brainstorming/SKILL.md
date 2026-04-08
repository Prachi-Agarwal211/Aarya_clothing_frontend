---
name: aarya-brainstorming
description: Use when planning new features, architectural changes, or complex fixes for the Aarya Clothing project. Asks clarifying questions, extracts requirements, proposes design alternatives, and creates detailed implementation plans before any code is written. Triggers on phrases like "add a feature", "how should we implement", "let's plan", "what's the best approach".
---

# Aarya Brainstorming & Design

## Overview
Structured design process for Aarya features. Extracts requirements through Socratic questioning, presents digestible design options, and creates actionable implementation plans. No code is written until design is approved.

## When to Use
- Planning new features (wishlist, coupons, loyalty program)
- Architectural changes (new microservice, database redesign)
- Complex feature implementation (multi-step checkout, payment gateway)
- Performance optimization strategies
- **When NOT to use:** Obvious fixes, simple bug fixes, one-line changes

## Core Pattern

### Ask → Clarify → Design → Plan → Approve

```
USER REQUEST
    ↓
ASK clarifying questions (3-5 max)
    ↓
CLARIFY requirements and constraints
    ↓
DESIGN 2-3 alternatives with trade-offs
    ↓
PLAN chosen approach with specific tasks
    ↓
APPROVE before implementation
```

## Quick Reference

### Questions to Always Ask

| Category | Questions |
|----------|-----------|
| **Scope** | What's included? What's explicitly out of scope? |
| **Users** | Who uses this? (customers, admins, both) |
| **Data** | What new data models? What existing data is affected? |
| **Integration** | Which services are affected? Any third-party APIs? |
| **Constraints** | Performance requirements? Security concerns? Budget limits? |

## Implementation

### Example: "Add a coupon/discount system"

#### Step 1: ASK Clarifying Questions

```
Great! Before I design the coupon system, I need to clarify:

1. DISCOUNT TYPES: 
   - Percentage discounts only, or fixed amounts too?
   - Buy X get Y free? Free shipping coupons?
   - Minimum order value requirements?

2. USAGE LIMITS:
   - One-time use per customer, or multi-use?
   - Global usage limits (e.g., first 100 orders)?
   - Time-based expiration?

3. ADMIN MANAGEMENT:
   - Create/edit/delete coupons from admin panel?
   - Bulk import coupons via CSV?
   - Usage analytics dashboard needed?

4. FRONTEND UX:
   - Coupon input on cart page or checkout page?
   - Auto-apply best coupon, or manual entry only?
   - Show available coupons to users?

5. TECHNICAL CONSTRAINTS:
   - Apply discounts in cart service or order service?
   - Store discount amount in orders table?
   - Track coupon usage in separate table?
```

#### Step 2: Present Design Alternatives

**Option A: Simple Coupon System (MVP)**

```
✅ Pros:
- Quick to implement (1-2 days)
- Percentage discounts only
- Single-use per customer
- Admin creates coupons via SQL or simple form
- Discount stored in orders.discount_amount

❌ Cons:
- Limited functionality
- No analytics
- Manual coupon management

Files to create:
- migrations/add_coupon_to_orders.sql
- services/commerce/service/coupon_service.py
- frontend_new/components/checkout/CouponInput.jsx
```

**Option B: Full Coupon System (Recommended)**

```
✅ Pros:
- Multiple discount types (% and fixed)
- Usage limits (per customer, global, time-based)
- Admin CRUD interface with analytics
- Coupon codes with validation
- Usage tracking and reporting

❌ Cons:
- More complex (3-5 days)
- Requires new database tables
- More frontend components

Files to create:
- migrations/add_coupons_table.sql
- services/commerce/models/coupon.py
- services/commerce/service/coupon_service.py
- services/commerce/routes/coupons.py
- frontend_new/components/checkout/CouponInput.jsx
- frontend_new/app/admin/coupons/page.js
- tests/integration/test_coupons.py
```

**Option C: Advanced Promotion Engine**

```
✅ Pros:
- Coupons + flash sales + loyalty points
- Rule-based discounts (cart value, categories)
- A/B testing different promotions
- Advanced analytics

❌ Cons:
- Complex (1-2 weeks)
- Overkill for current needs
- Requires significant infrastructure
```

#### Step 3: Create Implementation Plan (After Approval)

```markdown
# Coupon System Implementation Plan

## Selected: Option B (Full Coupon System)

### Task 1: Database Schema (30 min)
- Create coupons table with all fields
- Create coupon_usage table for tracking
- Add discount_amount to orders table
- Add indexes for performance
File: migrations/add_coupons_table.sql

### Task 2: Backend Service (1 hour)
- Coupon validation logic
- Discount calculation
- Usage tracking
- Expiration checking
File: services/commerce/service/coupon_service.py

### Task 3: API Endpoints (1 hour)
- POST /api/v1/coupons/validate
- GET /api/v1/coupons/:code
- POST /api/v1/admin/coupons
- PUT /api/v1/admin/coupons/:id
- DELETE /api/v1/admin/coupons/:id
- GET /api/v1/admin/coupons
Files: services/commerce/routes/coupons.py

### Task 4: Frontend Checkout UI (1 hour)
- Coupon input field
- Apply/remove coupon buttons
- Display discount amount
- Error handling for invalid coupons
File: frontend_new/components/checkout/CouponInput.jsx

### Task 5: Admin Coupon Management (2 hours)
- Coupon list with search/filter
- Create/edit coupon form
- Usage analytics display
File: frontend_new/app/admin/coupons/page.js

### Task 6: Tests (1 hour)
- Unit tests for coupon validation
- Integration tests for API
- E2E test for checkout flow
Files: tests/unit/test_coupon_service.py, tests/integration/test_coupons.py

### Task 7: Integration & Verification (30 min)
- Run all tests
- Manual testing in dev
- Deploy to staging
- Verify in production
```

## Common Mistakes

- **[Jumping to implementation]:** Never code before design is approved.
- **[Asking too many questions]:** Limit to 3-5 high-impact questions.
- **[Presenting only one option]:** Always show 2-3 alternatives with trade-offs.
- **[Over-engineering MVPs]:** Start simple, iterate based on feedback.
- **[Skipping the plan]:** Detailed plans prevent miscommunication and rework.

## Real-World Impact

- **Zero major rework** - design approved before implementation
- **Faster decision making** - clear alternatives with trade-offs
- **Better features** - Socratic questioning reveals hidden requirements
- **Team alignment** - everyone agrees on approach before coding starts
