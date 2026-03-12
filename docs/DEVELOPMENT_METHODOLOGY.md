# Aarya Clothing - Development Methodology

> **Purpose**: Establish a systematic, verifiable development workflow that prevents hallucinations, ensures consistency, and enables reliable implementation across this large e-commerce platform.

---

# Table of Contents

1. [Core Development Philosophy](#1-core-development-philosophy)
2. [Development Environment Setup](#2-development-environment-setup)
3. [Development Workflow](#3-development-workflow)
4. [Code Implementation Standards](#4-code-implementation-standards)
5. [Testing Strategy](#5-testing-strategy)
6. [Bug Handling Process](#6-bug-handling-process)
7. [Code Review Process](#7-code-review-process)
8. [Documentation Standards](#8-documentation-standards)
9. [Version Control Practices](#9-version-control-practices)
10. [Verification Checklist](#10-verification-checklist)

---

# 1. CORE DEVELOPMENT PHILOSOPHY

## 1.1 The Golden Rules

### Rule 1: Verify Before You Code
- **NEVER** assume how something works
- **ALWAYS** read the actual source code first
- Check database schema, API endpoints, existing implementations
- Use the verification checklist at the end of this document

### Rule 2: Single Source of Truth
- Database schema (`init.sql`) is the truth for data structures
- API endpoints in `main.py` are the truth for routes
- Existing implementations are the truth for patterns
- Documentation may be outdated - verify with actual code

### Rule 3: Traceability
- Every feature must be traceable to a requirement
- Every bug must have a test case
- Every change must have context in the commit

### Rule 4: Incremental Development
- Small, verifiable changes
- Test each piece before combining
- Don't refactor and add features simultaneously

## 1.2 The Verification First Approach

Before implementing ANY feature or fix:

```
1. Find the relevant source files
   - Frontend: Check frontend_new/app/, frontend_new/lib/, frontend_new/components/
   - Backend: Check services/core/, services/commerce/, services/payment/, services/admin/
   - Database: Check docker/postgres/init.sql
   - Config: Check docker-compose.yml, docker/nginx/nginx.conf

2. Read the actual implementation
   - Don't rely on documentation alone
   - Check function signatures
   - Check database column names
   - Check API route paths

3. Understand the existing patterns
   - How are similar features implemented?
   - What's the naming convention?
   - What's the error handling pattern?

4. Plan the implementation
   - What files need to change?
   - What's the exact change needed?
   - How will you verify it works?

5. Implement and test
   - Make the smallest possible change
   - Verify it works
   - Document what you changed
```

---

# 2. DEVELOPMENT ENVIRONMENT SETUP

## 2.1 Prerequisites

### Required Software
- Docker Desktop (latest)
- Python 3.11+
- Node.js 18+
- Git

### Environment Variables

Create `.env` file:
```bash
# PostgreSQL
POSTGRES_PASSWORD=postgres123

# Redis
REDIS_PASSWORD=

# JWT Secret (generate a secure key for production)
SECRET_KEY=your-super-secret-key-change-in-production

# Razorpay (get from razorpay.com)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Meilisearch
MEILI_MASTER_KEY=dev_master_key

# Cloudflare R2 (for image storage)
R2_ACCESS_KEY=your_access_key
R2_SECRET_KEY=your_secret_key
R2_BUCKET_NAME=aarya-clothing-images
R2_ACCOUNT_ID=your_account_id
```

## 2.2 Starting the Development Environment

### Step 1: Start Docker Desktop

### Step 2: Start All Services
```bash
# From project root
docker-compose up -d

# Wait for services to be ready (30-60 seconds)
docker-compose ps
```

### Step 3: Verify Services
```bash
# Check all containers are running
docker-compose ps

# Should show:
# aarya_postgres      Running
# aarya_redis         Running  
# aarya_meilisearch   Running
# aarya_core          Running
# aarya_commerce      Running
# aarya_payment       Running
# aarya_admin         Running
# aarya_frontend      Running
# aarya_nginx        Running
```

### Step 4: Access Services
| Service | URL |
|---------|-----|
| Frontend | http://localhost:6004 |
| API Gateway | http://localhost:6005 |
| Core API | http://localhost:5001 |
| Commerce API | http://localhost:5002 |
| Payment API | http://localhost:5003 |
| Admin API | http://localhost:5004 |

### Step 5: Verify Database
```bash
# Connect to PostgreSQL
docker exec -it aarya_postgres psql -U postgres -d aarya_clothing

# List tables
\dt

# Should show: users, user_profiles, products, inventory, orders, etc.
```

## 2.3 Running Individual Services

### Frontend Only (for UI development)
```bash
cd frontend_new
npm run dev
# Access at http://localhost:3000
```

### Backend Only (for API development)
```bash
# Core Service
cd services/core
pip install -r requirements.txt
python main.py
# Runs on http://localhost:5001
```

### Full Stack with Hot Reload
```bash
# Start infrastructure only
docker-compose up -d postgres redis meilisearch

# Start services you need
docker-compose up -d core commerce

# Run frontend locally
cd frontend_new && npm run dev
```

---

# 3. DEVELOPMENT WORKFLOW

## 3.1 Feature Implementation Workflow

### Phase 1: Understanding (DO NOT SKIP)

```
1. Identify the feature/change needed
   - Read the requirement carefully
   - Understand the user journey
   - Identify all affected components

2. Find existing implementations
   - Search for similar features
   - Check adminApi.js for similar API calls
   - Check services/*/main.py for similar endpoints
   
3. Read the actual code
   - Don't assume - verify
   - Check exact function names
   - Check exact parameter names
   - Check exact return formats
```

### Phase 2: Planning

```
1. List all files that need changes
   - Frontend files (pages, components, lib)
   - Backend files (services/*/main.py, services/*/service/*.py)
   - Database changes (init.sql)
   - Configuration (docker-compose.yml, nginx.conf)

2. Plan the changes
   - Start with database
   - Then backend API
   - Then frontend
   - Then testing

3. Write the implementation plan
   - File by file
   - Exact changes needed
   - How to verify each change
```

### Phase 3: Implementation

```
1. Make ONE small change at a time
2. After each change:
   - Verify the code compiles/runs
   - Test the specific functionality
   - If broken, fix before continuing

3. Common implementation order:
   a. Database (init.sql) - if needed
   b. SQLAlchemy models - if needed  
   c. Pydantic schemas - if needed
   d. Backend service layer
   e. Backend API endpoint
   f. Frontend API client
   g. Frontend component
   h. Frontend page
```

### Phase 4: Testing

```
1. Unit test the backend service
2. Test API endpoint with curl/httpie
3. Test frontend integration
4. Test the full flow
5. Test error cases
```

### Phase 5: Documentation

```
1. Update relevant documentation
2. Add code comments for complex logic
3. Update API contracts if changed
4. Document any new environment variables
```

## 3.2 Bug Fix Workflow

### Step 1: Reproduce the Bug
```
1. Understand the exact bug report
2. Identify the user journey that triggers it
3. Reproduce in development environment
4. Note exact error messages
```

### Step 2: Find the Root Cause
```
1. Check frontend console for errors
2. Check backend logs
3. Check database state
4. Trace the code path
5. Identify the exact line/file causing the bug
```

### Step 3: Fix the Bug
```
1. Make the smallest possible fix
2. Don't add new features while fixing bugs
3. Don't refactor unrelated code
```

### Step 4: Verify the Fix
```
1. Test the exact scenario that caused the bug
2. Test related scenarios
3. Ensure no regression
```

### Step 5: Document
```
1. Note what was fixed
2. Add test case to prevent regression
3. Update if documentation was incorrect
```

## 3.3 Example: Adding a New Admin Feature

Let's say we want to add "Bulk Export Orders to CSV" in admin.

### Phase 1: Understanding
```bash
# 1. Find existing admin order endpoints
grep -r "orders" services/admin/main.py | head -20

# 2. Check existing bulk operations
grep -r "bulk" services/admin/main.py

# 3. Check how admin exports might work
grep -r "export" services/admin/main.py
grep -r "csv" services/admin/main.py
```

### Phase 2: Planning
```
Files to change:
1. services/admin/main.py - Add /api/v1/admin/orders/export endpoint
2. frontend_new/lib/adminApi.js - Add ordersApi.export() function
3. frontend_new/app/admin/orders/page.js - Add export button

Implementation:
1. Add GET /api/v1/admin/orders/export endpoint in admin service
2. Return CSV format
3. Add exportOrders function in adminApi.js  
4. Add button in orders page
```

### Phase 3: Implementation
```python
# Step 1: Add endpoint in services/admin/main.py
@app.get("/api/v1/admin/orders/export")
async def export_orders(
    format: str = Query("csv"),
    db: Session = Depends(get_db),
    user: dict = Depends(require_admin)
):
    # Get all orders
    orders = db.query(Order).all()
    
    # Convert to CSV
    csv_data = "Order ID,Customer,Total,Status,Date\n"
    for order in orders:
        csv_data += f"{order.id},{order.user_id},{order.total_amount},{order.status},{order.created_at}\n"
    
    return StreamingResponse(
        iter([csv_data]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=orders.csv"}
    )
```

### Phase 4: Testing
```bash
# Test the endpoint
curl -H "Authorization: Bearer <admin_token>" \
  http://localhost:5004/api/v1/admin/orders/export

# Should download a CSV file
```

---

# 4. CODE IMPLEMENTATION STANDARDS

## 4.1 Backend (Python/FastAPI)

### File Organization
```
services/
├── [service_name]/
│   ├── main.py              # FastAPI app, routes, endpoints
│   ├── requirements.txt     # Dependencies
│   ├── Dockerfile          
│   ├── core/               # Configuration, redis client
│   ├── database/            # Database connection
│   ├── models/             # SQLAlchemy models
│   ├── schemas/            # Pydantic schemas
│   ├── service/            # Business logic (ALWAYS use this!)
│   └── middleware/         # Custom middleware
```

### Endpoint Structure Pattern
```python
# In services/*/main.py
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database.database import get_db
from shared.auth_middleware import get_current_user, require_admin

router = APIRouter()

@router.get("/api/v1/resource")
async def get_resources(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    search: str = Query(None),
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)  # Or require_admin
):
    """Endpoint description"""
    # 1. Validate input
    # 2. Query database
    # 3. Return response
    pass
```

### Service Layer Pattern
```python
# In services/*/service/resource_service.py
class ResourceService:
    def __init__(self, db: Session):
        self.db = db
    
    def get_resources(self, page: int, limit: int, search: str = None):
        query = self.db.query(Resource)
        
        if search:
            query = query.filter(Resource.name.ilike(f"%{search}%"))
        
        total = query.count()
        items = query.offset((page - 1) * limit).limit(limit).all()
        
        return {
            "items": items,
            "total": total,
            "page": page,
            "limit": limit
        }
```

### Error Handling Pattern
```python
from fastapi import HTTPException

# Don't do this:
if not item:
    return {"error": "Not found"}  # Wrong!

# Do this:
if not item:
    raise HTTPException(status_code=404, detail="Item not found")

# For known errors with specific codes:
from core.exception_handler import ValidationException, DatabaseException

if invalid:
    raise ValidationException("Invalid input: description")
```

## 4.2 Frontend (React/Next.js)

### File Organization
```
frontend_new/
├── app/                    # Next.js App Router pages
│   ├── page.js            # Homepage
│   ├── [resource]/        # Dynamic routes
│   └── admin/             # Admin pages
├── components/            # React components
│   ├── ui/               # Reusable UI components
│   ├── admin/             # Admin-specific components
│   └── landing/           # Landing page components
├── lib/                   # Utilities, API clients, context
└── public/                # Static assets
```

### API Client Pattern
```javascript
// In frontend_new/lib/customerApi.js or adminApi.js

// Always use the established pattern
export const resourceApi = {
  // GET list
  list: (params) => client.get('/api/v1/resource', params),
  
  // GET single
  get: (id) => client.get(`/api/v1/resource/${id}`),
  
  // POST create
  create: (data) => client.post('/api/v1/resource', data),
  
  // PUT update
  update: (id, data) => client.put(`/api/v1/resource/${id}`, data),
  
  // PATCH partial update
  patch: (id, data) => client.patch(`/api/v1/resource/${id}`, data),
  
  // DELETE
  delete: (id) => client.delete(`/api/v1/resource/${id}`),
  
  // Custom operations
  customAction: (id, data) => client.post(`/api/v1/resource/${id}/action`, data),
};
```

### React Component Pattern
```javascript
// In components/admin/resource/ResourceList.jsx
'use client';

import { useState, useEffect } from 'react';
import { resourceApi } from '@/lib/adminApi';
import { useAuth } from '@/lib/authContext';

export default function ResourceList() {
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { user } = useAuth();

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    try {
      setLoading(true);
      const data = await resourceApi.list();
      setResources(data.items || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div>
      {resources.map(resource => (
        <ResourceItem key={resource.id} resource={resource} />
      ))}
    </div>
  );
}
```

### Context Pattern
```javascript
// In lib/someContext.js
'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

const SomeContext = createContext(null);

export function SomeProvider({ children }) {
  const [state, setState] = useState(null);
  const [loading, setLoading] = useState(true);

  // Initialize
  useEffect(() => {
    // Load initial data
  }, []);

  const action = async () => {
    // Perform action
  };

  return (
    <SomeContext.Provider value={{ state, loading, action }}>
      {children}
    </SomeContext.Provider>
  );
}

export function useSome() {
  const context = useContext(SomeContext);
  if (!context) {
    throw new Error('useSome must be used within SomeProvider');
  }
  return context;
}
```

## 4.3 Database

### Always Use the Existing Schema
```sql
-- WRONG: Creating new tables without checking existing
CREATE TABLE new_table (...);

-- RIGHT: Check existing tables first
-- docker/postgres/init.sql already has:
-- - users, user_profiles, user_security
-- - products, product_images, inventory
-- - orders, order_items, order_tracking
-- - addresses, wishlist, reviews
-- - promotions, return_requests
-- - chat_rooms, chat_messages
-- - landing_config, landing_images
-- - staff_tasks, staff_notifications

-- If you need a new table, add it to init.sql
-- If you need new columns, use ALTER TABLE
```

### Migration Pattern
```sql
-- When adding new columns to existing table
ALTER TABLE products ADD COLUMN new_column VARCHAR(255) DEFAULT NULL;

-- When adding new table
CREATE TABLE new_entity (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Always add indexes for performance
CREATE INDEX idx_new_entity_name ON new_entity(name);
```

---

# 5. TESTING STRATEGY

## 5.1 Testing Levels

### Level 1: Syntax & Import Testing
```bash
# Python backend
cd services/core
python -c "from main import app; print('OK')"

# JavaScript frontend  
cd frontend_new
npm run build
```

### Level 2: API Endpoint Testing
```bash
# Test health endpoints first
curl http://localhost:5001/health
curl http://localhost:5002/health
curl http://localhost:5003/health
curl http://localhost:5004/health

# Should return {"status": "healthy", "service": "..."}
```

### Level 3: Functional Testing

#### Authentication Flow
```bash
# Register
curl -X POST http://localhost:6005/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","username":"testuser","password":"Test123!","full_name":"Test User","phone":"9876543210"}'

# Login
curl -X POST http://localhost:6005/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@aarya.com","password":"admin123"}'

# Check the response for cookies
# access_token, refresh_token, session_id should be set
```

#### Product Browsing
```bash
# List products
curl http://localhost:6005/api/v1/products

# Get single product
curl http://localhost:6005/api/v1/products/1
```

#### Cart Operations (requires auth)
```bash
# First login to get cookies, then:
curl -v http://localhost:6005/api/v1/cart \
  -H "Cookie: access_token=xxx; refresh_token=yyy"
```

### Level 4: Integration Testing
- Test complete user flows
- Test admin operations
- Test error scenarios

## 5.2 Manual Testing Checklist

### For Every Feature, Test:

1. **Happy Path**
   - Normal operation works correctly

2. **Error Cases**
   - Invalid input shows proper error
   - Unauthorized access is blocked
   - Not found items return 404

3. **Edge Cases**
   - Empty lists
   - Very long input
   - Special characters
   - Maximum limits

4. **Security**
   - Cannot access other users' data
   - Cannot access admin without admin role
   - SQL injection doesn't work
   - XSS is prevented

## 5.3 Automated Testing

### Backend Unit Tests (pytest)
```python
# In services/commerce/
# test_product_service.py
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.product import Product
from service.product_service import ProductService

@pytest.fixture
def db_session():
    engine = create_engine("sqlite:///:memory:")
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()

def test_get_products(db_session):
    service = ProductService(db_session)
    products = service.get_products()
    assert isinstance(products, list)
```

### Frontend Tests (manual for now)
- Test each page loads
- Test each form submission
- Test navigation
- Test error states

---

# 6. BUG HANDLING PROCESS

## 6.1 Bug Triage

### Severity Levels

| Severity | Description | Response Time |
|----------|-------------|---------------|
| Critical | System down, data loss | Immediate |
| High | Major feature broken | 4 hours |
| Medium | Feature partially working | 24 hours |
| Low | Minor issue, cosmetic | Next sprint |

## 6.2 Bug Investigation Steps

### Step 1: Gather Information
```
1. Exact error message
2. Steps to reproduce
3. Browser/OS if frontend
4. User account if applicable
5. Time of occurrence
6. Frequency: always/sometimes/once
```

### Step 2: Reproduce
```
1. Try to reproduce in dev environment
2. If cannot reproduce, ask for more info
3. Note exact steps if reproducible
```

### Step 3: Locate
```
1. Check frontend console (F12)
2. Check backend logs: docker-compose logs [service]
3. Check database state
4. Trace through code
```

### Step 4: Fix
```
1. Make minimal fix
2. Don't change anything else
3. Test the fix
4. Test related functionality
```

### Step 5: Verify
```
1. User confirms fix
2. Monitor for recurrence
3. Add test case
```

## 6.3 Common Bug Patterns

### Frontend Bugs
| Symptom | Likely Cause | Check |
|---------|-------------|-------|
| Page not loading | API call failing | Check console |
| Form not submitting | Validation error | Check network tab |
| Data not showing | Wrong API endpoint | Check API response |
| Style broken | CSS conflict | Check browser dev tools |

### Backend Bugs
| Symptom | Likely Cause | Check |
|---------|-------------|-------|
| 500 Error | Exception in code | Check logs |
| 401 Error | Auth issue | Check token |
| 404 Error | Wrong endpoint | Check route |
| Slow response | Database query | Check query time |

### Database Bugs
| Symptom | Likely Cause | Check |
|---------|-------------|-------|
| Data missing | Query error | Check SQL |
| Insert failing | Constraint violation | Check constraints |
| Slow queries | Missing index | Check EXPLAIN |

---

# 7. CODE REVIEW PROCESS

## 7.1 Self Review Checklist

Before creating a pull request, verify:

### Code Quality
- [ ] Code follows project conventions
- [ ] No hardcoded values (use config)
- [ ] Error handling is proper
- [ ] No security issues
- [ ] Code is readable

### Functionality
- [ ] Feature works as expected
- [ ] Error cases handled
- [ ] Edge cases considered

### Testing
- [ ] Tested locally
- [ ] No console errors
- [ ] API responses correct

### Documentation
- [ ] Comments added for complex logic
- [ ] README updated if needed
- [ ] API changes documented

## 7.2 Review Questions

When reviewing others' code (or your own):

1. **Does it work?** - Did you test it?
2. **Is it readable?** - Could someone else understand it?
3. **Is it secure?** - Any security concerns?
4. **Is it efficient?** - Any performance issues?
5. **Is it complete?** - Edge cases handled?

---

# 8. DOCUMENTATION STANDARDS

## 8.1 Code Comments

### When to Comment
- Complex business logic
- Non-obvious workarounds
- API contract explanations
- TODO items

### Comment Style
```python
# Good comments:
# Calculate discount based on promotion rules
# Note: Inventory is reserved for 15 minutes during checkout
# TODO: Add pagination for >100 items

# Bad comments:
# This is a function  # obvious
# Do stuff here      # meaningless
```

## 8.2 API Documentation

### Endpoint Documentation
```python
@router.post("/api/v1/resource",
    summary="Create Resource",
    description="Creates a new resource. Requires admin access.",
    response_model=ResourceResponse,
    responses={
        201: {"description": "Resource created successfully"},
        400: {"description": "Invalid input"},
        401: {"description": "Not authenticated"},
        403: {"description": "Not authorized"}
    }
)
async def create_resource(...):
```

## 8.3 README Files

Each service should have a README.md with:
- Service purpose
- Setup instructions
- Environment variables
- API endpoints
- Common issues

---

# 9. VERSION CONTROL PRACTICES

## 9.1 Branch Strategy

```
main (or develop)
├── feature/add-admin-export
├── feature/add-new-payment-method
├── bugfix/fix-cart-empty-error
└── hotfix/security-patch
```

### Branch Naming
- `feature/description` - New features
- `bugfix/description` - Bug fixes
- `hotfix/description` - Urgent production fixes

## 9.2 Commit Messages

### Format
```
type(scope): description

[optional body]

[optional footer]
```

### Types
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `style` - Formatting
- `refactor` - Restructuring
- `test` - Testing
- `chore` - Maintenance

### Examples
```
feat(admin): add orders export to CSV

Added /api/v1/admin/orders/export endpoint that allows
admin users to download all orders as a CSV file.

Fix(cart): resolve cart empty error on logout

The cart was not clearing properly when user logged out.
Now clears cart state in both Redis and frontend context.

docs(api): update product endpoint description

Clarified that the products endpoint returns paginated results.
```

## 9.3 Pull Request Process

1. Create branch from `main`
2. Make changes
3. Test locally
4. Push branch
5. Create PR with description
6. Request review
7. Address feedback
8. Merge after approval

---

# 10. VERIFICATION CHECKLIST

## 10.1 Before Implementing ANY Change

### Understanding Phase
- [ ] Read the actual source files related to this change
- [ ] Check database schema for relevant tables
- [ ] Check existing API endpoints
- [ ] Check existing frontend components
- [ ] Identified all files that need changes

### Planning Phase
- [ ] Written implementation plan
- [ ] Identified correct order of changes
- [ ] Known how to verify each change works

### Implementation Phase
- [ ] Made ONE small change at a time
- [ ] Verified each change before continuing
- [ ] Used existing code patterns

### Testing Phase
- [ ] Tested the happy path
- [ ] Tested error cases
- [ ] Tested edge cases
- [ ] Verified no console errors
- [ ] Verified API responses are correct

### Documentation Phase
- [ ] Updated comments if needed
- [ ] Updated README if needed
- [ ] Documented any new environment variables

## 10.2 Quick Verification Commands

### Backend
```bash
# Check service is running
docker-compose ps | grep [service]

# Check service logs
docker-compose logs [service] --tail=50

# Test endpoint
curl http://localhost:[port]/health

# Check database
docker exec -it aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT * FROM users LIMIT 1;"
```

### Frontend
```bash
# Build check
cd frontend_new && npm run build

# Lint check
cd frontend_new && npm run lint

# Test specific page loads (manual)
# http://localhost:6004/products
# http://localhost:6004/admin
```

### Integration
```bash
# Full flow test
# 1. Register new user
# 2. Login
# 3. Browse products
# 4. Add to cart
# 5. Checkout
# 6. Verify order created

# Admin test
# 1. Login as admin
# 2. Create product
# 3. Verify product appears in catalog
```

---

# APPENDIX: QUICK REFERENCE

## File Locations

| Purpose | Location |
|---------|-----------|
| Database Schema | `docker/postgres/init.sql` |
| Core Service | `services/core/main.py` |
| Commerce Service | `services/commerce/main.py` |
| Payment Service | `services/payment/main.py` |
| Admin Service | `services/admin/main.py` |
| Frontend Pages | `frontend_new/app/` |
| Frontend API | `frontend_new/lib/*.js` |
| Frontend Components | `frontend_new/components/` |
| Docker Config | `docker-compose.yml` |
| Nginx Config | `docker/nginx/nginx.conf` |

## Service Ports

| Service | Port |
|---------|------|
| Frontend | 6004 |
| API Gateway | 6005 |
| Core | 5001 |
| Commerce | 5002 |
| Payment | 5003 |
| Admin | 5004 |
| PostgreSQL | 6001 |
| Redis | 6002 |
| Meilisearch | 6003 |

## Test Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aarya.com | admin123 |
| Staff | staff@aarya.com | staff123 |
| Customer | customer@aarya.com | customer123 |

## Common Commands

```bash
# Start everything
docker-compose up -d

# Restart specific service
docker-compose restart core

# View logs
docker-compose logs -f commerce

# Rebuild service
docker-compose up -d --build core

# Reset database
docker-compose down -v
docker-compose up -d

# Frontend development
cd frontend_new && npm run dev

# Backend development  
cd services/core && python main.py
```

---

*Document Version: 1.0*
*Last Updated: 2026-02-23*
*Purpose: Systematic development methodology for reliable e-commerce platform development*
