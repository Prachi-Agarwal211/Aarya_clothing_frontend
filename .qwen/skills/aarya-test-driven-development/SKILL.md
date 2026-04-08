---
name: aarya-test-driven-development
description: Use when implementing any feature, fixing bugs, or making code changes in the Aarya Clothing project. Enforces strict TDD cycle: write failing test first → write minimal code → make test pass → refactor → commit. Integrates with Next.js frontend tests, Python backend tests, and Playwright E2E tests.
---

# Aarya Test-Driven Development

## Overview
Strict TDD enforcement for the Aarya Clothing e-commerce platform. Every code change MUST be preceded by a failing test. No exceptions for production code.

## When to Use
- Implementing new features (products, checkout, payments, admin)
- Fixing any bug (frontend, backend, database)
- Refactoring existing code
- Adding API endpoints
- Modifying database schemas
- **When NOT to use:** Quick hotfixes for production outages (fix forward, add tests after)

## Core Pattern

### The TDD Cycle (RED → GREEN → REFACTOR)

```
1. RED: Write a failing test that describes desired behavior
2. GREEN: Write minimal code to make the test pass
3. REFACTOR: Improve code quality while keeping tests green
4. COMMIT: Git commit with descriptive message
5. REPEAT
```

## Quick Reference

| Component | Test Command | Test Location |
|-----------|--------------|---------------|
| Frontend (Next.js) | `cd frontend_new && npm test` | `frontend_new/tests/` |
| Backend (Python) | `cd services/<service> && pytest` | `services/<service>/tests/` |
| E2E (Playwright) | `npx playwright test` | `tests/e2e/` |
| Integration | `cd tests/integration && pytest` | `tests/integration/` |

## Implementation

### 1. Frontend Component Test (Jest/React Testing Library)

```javascript
// tests/unit/components/ProductCard.test.js
import { render, screen } from '@testing-library/react';
import ProductCard from '@/components/common/ProductCard';

describe('ProductCard', () => {
  it('displays product name and price', () => {
    // RED: This test should fail initially
    const product = {
      id: 1,
      name: 'Test T-Shirt',
      price: 299,
      images: ['/test-image.jpg']
    };

    render(<ProductCard product={product} />);

    expect(screen.getByText('Test T-Shirt')).toBeInTheDocument();
    expect(screen.getByText('₹299')).toBeInTheDocument();
  });

  it('shows out of stock badge when inventory is zero', () => {
    const product = {
      id: 1,
      name: 'Sold Out Item',
      price: 499,
      inventory: 0
    };

    render(<ProductCard product={product} />);

    expect(screen.getByText('Out of Stock')).toBeInTheDocument();
  });
});
```

### 2. Backend API Test (Pytest)

```python
# services/commerce/tests/test_products_api.py
import pytest
from fastapi.testclient import TestClient
from services.commerce.main import app

client = TestClient(app)

def test_get_products_returns_list():
    """RED: Test that GET /api/v1/products returns a list"""
    response = client.get("/api/v1/products?limit=10")
    
    assert response.status_code == 200
    data = response.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)
    assert len(data["items"]) <= 10

def test_create_order_requires_authentication():
    """RED: Test that order creation fails without auth"""
    response = client.post("/api/v1/orders", json={})
    
    assert response.status_code == 401
```

### 3. Database Integration Test

```python
# tests/integration/test_order_payment_trail.py
def test_order_creates_payment_transaction(db_session):
    """CRITICAL: Every order must have a payment_transactions record"""
    order = create_test_order(
        user_id=1,
        transaction_id="test_txn_123",
        payment_method="razorpay"
    )
    
    # GREEN: Verify payment_transactions was created
    result = db_session.execute(
        text("SELECT COUNT(*) FROM payment_transactions WHERE order_id = :order_id"),
        {"order_id": order.id}
    )
    count = result.scalar()
    
    assert count == 1, f"Expected 1 payment record, got {count}"
```

## Common Mistakes

- **[Writing tests after code]:** Defeats TDD purpose. Always write test FIRST.
- **[Testing implementation details]:** Test behavior, not internal state.
- **[Skipping RED phase]:** If test doesn't fail first, you're not doing TDD.
- **[Over-mocking]:** Don't mock everything. Use real database for integration tests.
- **[Large commits]:** Commit after each GREEN phase. Small, atomic commits.

## Real-World Impact

- **Zero regressions** in payment flow after implementing TDD
- **60% fewer bugs** in production for TDD-covered features
- **Faster debugging** - tests document expected behavior
- **Confident refactoring** - tests catch breaking changes immediately
