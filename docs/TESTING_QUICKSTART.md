# 🧪 TESTING QUICK START GUIDE
## Aarya Clothing - Essential Tests Only

**Generated:** March 16, 2026

---

## ⚡ QUICK SETUP (5 Minutes)

### **1. Frontend Tests**

```bash
cd frontend_new

# Install test dependencies
npm install --save-dev jest @testing-library/react @testing-library/jest-dom

# Run existing tests
npm test

# Run with coverage
npm test -- --coverage
```

### **2. Backend Tests**

```bash
cd services/core

# Install test dependencies
pip install pytest pytest-cov pytest-asyncio

# Run tests
pytest

# Run with coverage
pytest --cov=.
```

### **3. E2E Tests (Playwright)**

```bash
cd frontend_new

# Install Playwright
npx playwright install

# Run E2E tests
npx playwright test

# Run with UI
npx playwright test --ui
```

---

## 📝 ESSENTIAL TEST FILES TO CREATE

### **Frontend Unit Tests**

**File: `frontend_new/lib/__tests__/roles.test.js`**

```javascript
import {
  getRedirectForRole,
  isAdmin,
  isStaff,
  isSuperAdmin,
} from '../roles';

describe('Role Helpers', () => {
  test('getRedirectForRole returns correct URLs', () => {
    expect(getRedirectForRole('super_admin')).toBe('/admin/super');
    expect(getRedirectForRole('admin')).toBe('/admin');
    expect(getRedirectForRole('staff')).toBe('/admin/staff');
    expect(getRedirectForRole('customer')).toBe('/products');
  });

  test('isAdmin correctly identifies admin roles', () => {
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('super_admin')).toBe(true);
    expect(isAdmin('staff')).toBe(false);
    expect(isAdmin('customer')).toBe(false);
  });

  test('isStaff correctly identifies staff roles', () => {
    expect(isStaff('staff')).toBe(true);
    expect(isStaff('admin')).toBe(true);
    expect(isStaff('super_admin')).toBe(true);
    expect(isStaff('customer')).toBe(false);
  });
});
```

**File: `frontend_new/lib/__tests__/apiClient.test.js`**

```javascript
import { apiClient } from '../apiClient';

global.fetch = jest.fn();

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('makes GET request with auth token', async () => {
    localStorage.setItem('auth', JSON.stringify({
      access_token: 'test_token'
    }));

    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ data: 'test' }),
    });

    await apiClient.get('/api/v1/products');

    expect(fetch).toHaveBeenCalled();
  });
});
```

---

### **Backend Unit Tests**

**File: `services/core/tests/test_roles.py`**

```python
import pytest
from shared.roles import UserRole, is_admin, is_staff, get_redirect_for_role

class TestRoleHelpers:
    def test_get_redirect_for_role(self):
        assert get_redirect_for_role(UserRole.SUPER_ADMIN) == "/admin/super"
        assert get_redirect_for_role(UserRole.ADMIN) == "/admin"
        assert get_redirect_for_role(UserRole.STAFF) == "/admin/staff"
        assert get_redirect_for_role(UserRole.CUSTOMER) == "/products"

    def test_is_admin(self):
        assert is_admin(UserRole.ADMIN) is True
        assert is_admin(UserRole.SUPER_ADMIN) is True
        assert is_admin(UserRole.STAFF) is False

    def test_is_staff(self):
        assert is_staff(UserRole.STAFF) is True
        assert is_staff(UserRole.ADMIN) is True
        assert is_staff(UserRole.SUPER_ADMIN) is True
        assert is_staff(UserRole.CUSTOMER) is False
```

**File: `services/core/tests/test_auth.py`**

```python
import pytest
from fastapi import status

class TestAuthEndpoints:
    def test_login_success(self, client):
        """Test successful login."""
        response = client.post("/api/v1/auth/login", json={
            "email": "customer@test.com",
            "password": "test123"
        })
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data
        assert "user" in data

    def test_login_invalid_credentials(self, client):
        """Test login with invalid credentials."""
        response = client.post("/api/v1/auth/login", json={
            "email": "invalid@test.com",
            "password": "wrongpassword"
        })
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
```

---

### **E2E Tests (Playwright)**

**File: `frontend_new/tests/e2e/auth.spec.js`**

```javascript
import { test, expect } from '@playwright/test';

test.describe('Authentication', () => {
  test('login successfully', async ({ page }) => {
    await page.goto('/auth/login');
    
    await page.fill('input[name="email"]', 'customer@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/products');
  });

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/auth/login');
    
    await page.fill('input[name="email"]', 'invalid@test.com');
    await page.fill('input[name="password"]', 'wrong');
    await page.click('button[type="submit"]');
    
    await expect(page.locator('text=/error/i')).toBeVisible();
  });
});
```

**File: `frontend_new/tests/e2e/rbac.spec.js`**

```javascript
import { test, expect } from '@playwright/test';

test.describe('Role-Based Access', () => {
  test('customer cannot access admin', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'customer@test.com');
    await page.fill('input[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    
    await page.goto('/admin');
    await expect(page.locator('text=/unauthorized/i')).toBeVisible();
  });

  test('staff can access staff dashboard', async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('input[name="email"]', 'staff@test.com');
    await page.fill('input[name="password"]', 'staff123');
    await page.click('button[type="submit"]');
    
    await expect(page).toHaveURL('/admin/staff');
  });
});
```

---

## 🎯 TEST COVERAGE GOALS

| Component | Target | Current |
|-----------|--------|---------|
| **Role Helpers** | 100% | Create tests |
| **API Client** | 90% | Create tests |
| **Auth Context** | 80% | Create tests |
| **Components** | 70% | Create tests |
| **Backend Services** | 80% | Create tests |

---

## 📋 TESTING CHECKLIST

### **Before Each Commit:**
- [ ] Run frontend tests: `npm test`
- [ ] Run backend tests: `pytest`
- [ ] Run linting: `npm run lint`

### **Before Deployment:**
- [ ] All unit tests pass
- [ ] All integration tests pass
- [ ] E2E critical flows pass
- [ ] Coverage > 70%

### **Critical Flows to Test:**
- [ ] User login
- [ ] Role-based redirects
- [ ] Product listing
- [ ] Add to cart
- [ ] Checkout flow
- [ ] Admin access control

---

## 🔧 TROUBLESHOOTING

### **Common Test Errors:**

**Error: "Cannot find module"**
```bash
# Install dependencies
npm install
# or
pip install -r requirements.txt
```

**Error: "fetch is not defined"**
```javascript
// Add to jest.setup.js
global.fetch = require('node-fetch');
```

**Error: "Database connection failed"**
```bash
# Make sure Docker containers are running
docker-compose ps

# Restart if needed
docker-compose restart postgres
```

---

## 📊 RUN TESTS IN CI/CD

**GitHub Actions (`.github/workflows/test.yml`):**

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '20'
    
    - name: Install dependencies
      working-directory: ./frontend_new
      run: npm ci
    
    - name: Run tests
      working-directory: ./frontend_new
      run: npm test
    
    - name: Setup Python
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      run: pip install -r services/core/requirements.txt
    
    - name: Run tests
      run: pytest
```

---

## 🎯 NEXT STEPS

1. **Create test files** listed above
2. **Run tests locally** before committing
3. **Add more tests** for critical components
4. **Set up CI/CD** to run tests automatically
5. **Aim for 80%+ coverage**

---

**Quick Commands:**

```bash
# Frontend
npm test                    # Run tests
npm test -- --watch        # Watch mode
npm test -- --coverage     # Coverage report

# Backend
pytest                     # Run tests
pytest -v                  # Verbose
pytest --cov              # Coverage

# E2E
npx playwright test        # Run E2E
npx playwright test --ui   # UI mode
```

---

**That's it! Start testing now! 🧪**
