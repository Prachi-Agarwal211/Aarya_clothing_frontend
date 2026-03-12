# Aarya Clothing - System Architecture Deep Dive

> **🎯 PURPOSE**: This document provides a comprehensive, sequential understanding of the entire Aarya Clothing e-commerce platform. It is designed for AI systems to deeply understand the architecture, make informed implementation decisions, and maintain consistency across all changes.
>
> **⚠️ IMPORTANT**: Always verify against actual source files when making changes. This document is a guide, not the source of truth.

---

# TABLE OF CONTENTS

1. [System Overview](#1-system-overview)
2. [Architecture Philosophy](#2-architecture-philosophy)
3. [Infrastructure Layer](#3-infrastructure-layer)
4. [Database Layer](#4-database-layer)
5. [Backend Services Layer](#5-backend-services-layer)
6. [Frontend Layer](#6-frontend-layer)
7. [Authentication & Security](#7-authentication--security)
8. [Data Flow Patterns](#8-data-flow-patterns)
9. [Implementation Guidelines](#9-implementation-guidelines)
10. [Quick Reference](#10-quick-reference)

---

# 1. SYSTEM OVERVIEW

## 1.1 What is Aarya Clothing?

Aarya Clothing is a **full-stack e-commerce platform** for premium ethnic wear (sarees, kurtis, gowns). It follows a **microservices architecture** with clear separation of concerns.

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Frontend | Next.js 15 + React 18 | Customer-facing web application |
| Styling | Tailwind CSS + GSAP | Responsive design + animations |
| API Gateway | Nginx | Reverse proxy, routing, rate limiting |
| Backend | FastAPI (Python) | RESTful microservices |
| Database | PostgreSQL 15 | Primary data store |
| Cache | Redis 7 | Session, cart, caching |
| Search | Meilisearch | Product search engine |
| Storage | Cloudflare R2 | Image/file storage |
| Payments | Razorpay | Payment gateway |
| Container | Docker + Docker Compose | Containerization |

### Service Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                        │
│                      Port: 6004 (Docker)                         │
│                    OR Port: 3000 (Local)                         │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NGINX REVERSE PROXY                         │
│                      Port: 6005 (Docker)                         │
│              Routes requests to appropriate service              │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│ CORE SERVICE  │     │COMMERCE SVC   │     │ ADMIN SERVICE │
│   Port: 5001  │     │   Port: 5002  │     │   Port: 5004  │
│               │     │               │     │               │
│ - Auth        │     │ - Products    │     │ - Dashboard   │
│ - Users       │     │ - Cart        │     │ - Analytics   │
│ - Sessions    │     │ - Orders      │     │ - CMS         │
│ - OTP         │     │ - Inventory   │     │ - Chat        │
└───────────────┘     └───────────────┘     └───────────────┘
        │                       │                       │
        └───────────────────────┼───────────────────────┘
                                ▼
                    ┌───────────────────────┐
                    │   PAYMENT SERVICE     │
                    │     Port: 5003        │
                    │                       │
                    │ - Razorpay Integration│
                    │ - Webhooks            │
                    │ - Refunds             │
                    └───────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│  PostgreSQL   │     │    Redis      │     │ Meilisearch   │
│  Port: 6001   │     │  Port: 6002   │     │  Port: 6003   │
└───────────────┘     └───────────────┘     └───────────────┘
```

---

# 2. ARCHITECTURE PHILOSOPHY

## 2.1 Core Principles

### 1. Backend is the Single Source of Truth
- All data transformations happen in backend services
- Frontend receives ready-to-display data
- No business logic in frontend components
- R2 URLs are constructed by backend, not frontend

### 2. Microservices with Clear Boundaries
- **Core Service**: Authentication, users, sessions
- **Commerce Service**: Products, orders, cart, inventory
- **Payment Service**: Payment processing, refunds
- **Admin Service**: Dashboard, analytics, CMS, chat

### 3. Shared Utilities for Cross-Cutting Concerns
- Located in `shared/` directory
- Used by all microservices
- Includes: auth middleware, caching, event bus, schemas

### 4. Cookie-Based Authentication
- HttpOnly cookies for security
- Access token: 30 minutes
- Refresh token: 24 hours (with remember_me)
- Session ID for tracking

### 5. Redis for Performance
- Session storage
- Cart caching
- API response caching
- Rate limiting

## 2.2 Data Flow Philosophy

```
User Action → Frontend → Nginx → Service → Database
                                    ↓
                              Cache (Redis)
                                    ↓
                              Response → Frontend → UI Update
```

**Key Rules:**
1. Frontend never accesses database directly
2. All API calls go through Nginx
3. Services communicate via HTTP (service_client.py)
4. Caching is transparent to frontend

---

# 3. INFRASTRUCTURE LAYER

## 3.1 Docker Compose Configuration

**File**: `docker-compose.yml`

### Service Definitions

```yaml
services:
  # DATABASE LAYER
  postgres:
    image: postgres:15-alpine
    container_name: aarya_postgres
    environment:
      POSTGRES_DB: aarya_clothing
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres123}
    ports:
      - "6001:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro

  redis:
    image: redis:7-alpine
    container_name: aarya_redis
    ports:
      - "6002:6379"
    volumes:
      - redis_data:/data

  meilisearch:
    image: getmeili/meilisearch:v1.6
    container_name: aarya_meilisearch
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY:-dev_master_key}
    ports:
      - "6003:7700"

  # BACKEND SERVICES
  core:
    build:
      context: .
      dockerfile: services/core/Dockerfile
    container_name: aarya_core
    ports:
      - "5001:5001"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/aarya_clothing
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY:-dev_secret_key}

  commerce:
    build:
      context: .
      dockerfile: services/commerce/Dockerfile
    container_name: aarya_commerce
    ports:
      - "5002:5002"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/aarya_clothing
      - REDIS_URL=redis://redis:6379/1
      - MEILISEARCH_URL=http://meilisearch:7700

  payment:
    build:
      context: .
      dockerfile: services/payment/Dockerfile
    container_name: aarya_payment
    ports:
      - "5003:5003"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/aarya_clothing
      - REDIS_URL=redis://redis:6379/2
      - RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
      - RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}

  admin:
    build:
      context: .
      dockerfile: services/admin/Dockerfile
    container_name: aarya_admin
    ports:
      - "5004:5004"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/aarya_clothing
      - REDIS_URL=redis://redis:6379/3

  # FRONTEND
  frontend:
    build:
      context: ./frontend_new
      dockerfile: Dockerfile
    container_name: aarya_frontend
    ports:
      - "6004:3000"

  # NGINX REVERSE PROXY
  nginx:
    image: nginx:alpine
    container_name: aarya_nginx
    ports:
      - "6005:80"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - frontend
      - core
      - commerce
      - payment
      - admin
```

### Port Mapping Reference

| Service | Host Port | Container Port | Internal URL |
|---------|-----------|----------------|--------------|
| PostgreSQL | 6001 | 5432 | postgres:5432 |
| Redis | 6002 | 6379 | redis:6379 |
| Meilisearch | 6003 | 7700 | meilisearch:7700 |
| Frontend | 6004 | 3000 | frontend:3000 |
| Nginx | 6005 | 80 | nginx:80 |
| Core | 5001 | 5001 | core:5001 |
| Commerce | 5002 | 5002 | commerce:5002 |
| Payment | 5003 | 5003 | payment:5003 |
| Admin | 5004 | 5004 | admin:5004 |

## 3.2 Nginx Configuration

**File**: `docker/nginx/nginx.conf`

### Key Routing Rules

```nginx
# API Routing
/api/v1/auth/*     → core:5001      # Authentication
/api/v1/users/*    → core:5001      # User management
/api/v1/products*  → commerce:5002  # Products
/api/v1/cart*      → commerce:5002  # Cart
/api/v1/orders*    → commerce:5002  # Orders
/api/v1/payments/* → payment:5003   # Payments
/api/v1/admin/*    → admin:5004     # Admin dashboard
/api/v1/landing/*  → admin:5004     # Landing CMS

# Frontend
/                  → frontend:3000  # Next.js app
/_next/*           → frontend:3000  # Next.js static assets
```

### Rate Limiting

```nginx
# Rate limiting zones
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login:10m rate=1r/s;

# Apply to endpoints
location /api/v1/auth/login {
    limit_req zone=login burst=5 nodelay;
    proxy_pass http://core_upstream;
}
```

### Security Headers

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
```

---

# 4. DATABASE LAYER

## 4.1 Database Schema Overview

**Database**: `aarya_clothing` (single database, shared by all services)

### ENUM Types

```sql
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'customer');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled', 'returned', 'refunded');
CREATE TYPE address_type AS ENUM ('shipping', 'billing', 'both');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE return_reason AS ENUM ('defective', 'wrong_item', 'not_as_described', 'size_issue', 'changed_mind', 'other');
CREATE TYPE return_status AS ENUM ('requested', 'approved', 'rejected', 'received', 'refunded', 'completed');
CREATE TYPE chat_status AS ENUM ('open', 'assigned', 'resolved', 'closed');
CREATE TYPE sender_type AS ENUM ('customer', 'staff', 'admin', 'system');
```

## 4.2 Core Service Tables

### users
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'customer',
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Core authentication and identity
**Service**: Core Service
**Key Fields**:
- `role`: Determines access level (admin/staff/customer)
- `is_active`: Soft delete flag
- `email_verified`: Email verification status

### user_profiles
```sql
CREATE TABLE user_profiles (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    full_name VARCHAR(100),
    phone VARCHAR(20) NOT NULL,
    avatar_url VARCHAR(500),
    bio TEXT,
    date_of_birth DATE,
    gender VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Extended user information (1:1 with users)
**Service**: Core Service

### user_security
```sql
CREATE TABLE user_security (
    user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP,
    last_login_at TIMESTAMP,
    last_login_ip VARCHAR(45),
    password_history JSONB DEFAULT '[]',
    last_password_change TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Security tracking (1:1 with users)
**Service**: Core Service
**Key Fields**:
- `failed_login_attempts`: For account locking
- `locked_until`: Account lockout timestamp
- `password_history`: Previous passwords (JSONB array)

### email_verifications
```sql
CREATE TABLE email_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    token_type VARCHAR(20) DEFAULT 'email_verification',
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Email verification and password reset tokens
**Service**: Core Service
**Token Types**: `email_verification`, `password_reset`

### otps
```sql
CREATE TABLE otps (
    id SERIAL PRIMARY KEY,
    otp_code VARCHAR(10) NOT NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    otp_type VARCHAR(20) NOT NULL,
    purpose VARCHAR(50) NOT NULL,
    is_used BOOLEAN DEFAULT FALSE,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    ip_address VARCHAR(45),
    user_agent TEXT
);
```

**Purpose**: OTP verification (email/phone)
**Service**: Core Service

## 4.3 Commerce Service Tables

### collections (categories)
```sql
CREATE TABLE collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    description TEXT,
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Backward compatibility view
CREATE OR REPLACE VIEW categories AS SELECT * FROM collections;
```

**Purpose**: Product categories/collections
**Note**: `collections` and `categories` are the same thing

### products
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    description TEXT,
    short_description VARCHAR(500),
    base_price DECIMAL(10, 2) NOT NULL,
    mrp DECIMAL(10, 2),
    category_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
    brand VARCHAR(100),
    average_rating DECIMAL(3, 2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    total_stock INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_new_arrival BOOLEAN DEFAULT FALSE,
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Product catalog
**Key Fields**:
- `base_price`: Selling price
- `mrp`: Maximum Retail Price (for discount display)
- `total_stock`: Aggregated from inventory table

### product_images
```sql
CREATE TABLE product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Product image gallery
**Note**: `image_url` is relative path to R2 storage

### inventory (product_variants)
```sql
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku VARCHAR(100) NOT NULL,
    size VARCHAR(50),
    color VARCHAR(50),
    quantity INTEGER DEFAULT 0,
    reserved_quantity INTEGER DEFAULT 0,
    low_stock_threshold INTEGER DEFAULT 10,
    cost_price DECIMAL(10, 2),
    variant_price DECIMAL(10, 2),
    description TEXT,
    weight DECIMAL(10, 3),
    location VARCHAR(100),
    barcode VARCHAR(100),
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_inventory_product_sku UNIQUE (product_id, sku)
);

-- Backward compatibility view
CREATE OR REPLACE VIEW product_variants AS
    SELECT id, product_id, size, color, sku, quantity AS inventory_count,
           created_at, updated_at FROM inventory;
```

**Purpose**: Product variants (size/color combinations) + stock tracking
**Key Fields**:
- `quantity`: Available stock
- `reserved_quantity`: Stock reserved in active orders
- `variant_price`: Variant-specific price override

### addresses
```sql
CREATE TABLE addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    address_type address_type DEFAULT 'shipping',
    full_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address_line1 VARCHAR(255) NOT NULL,
    address_line2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'India',
    landmark VARCHAR(255),
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: User shipping/billing addresses

### orders
```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount_applied DECIMAL(10, 2) DEFAULT 0,
    promo_code VARCHAR(50),
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    status order_status DEFAULT 'pending',
    shipping_address_id INTEGER REFERENCES addresses(id),
    shipping_address TEXT,
    billing_address_id INTEGER REFERENCES addresses(id),
    shipping_method VARCHAR(50),
    tracking_number VARCHAR(100),
    order_notes TEXT,
    transaction_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP
);
```

**Purpose**: Order header information
**Status Flow**: pending → confirmed → processing → shipped → delivered

### order_items
```sql
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id),
    product_id INTEGER,
    product_name VARCHAR(255),
    sku VARCHAR(100),
    size VARCHAR(50),
    color VARCHAR(50),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Order line items

### order_tracking
```sql
CREATE TABLE order_tracking (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    notes TEXT,
    location VARCHAR(255),
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Order status history

### wishlist
```sql
CREATE TABLE wishlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)
);
```

**Purpose**: User wishlist

### reviews
```sql
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    review_text TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Product reviews

### promotions
```sql
CREATE TABLE promotions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_type discount_type NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_amount DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2),
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    max_uses_per_user INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    applicable_categories TEXT,
    applicable_products TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Discount codes and promotions

### return_requests
```sql
CREATE TABLE return_requests (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    reason return_reason NOT NULL,
    description TEXT,
    status return_status DEFAULT 'requested',
    refund_amount DECIMAL(10, 2),
    refund_transaction_id VARCHAR(255),
    approved_by INTEGER,
    rejection_reason TEXT,
    return_tracking_number VARCHAR(100),
    is_item_received BOOLEAN DEFAULT FALSE,
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    received_at TIMESTAMP,
    refunded_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Return and refund requests

## 4.4 Payment Service Tables

### payment_transactions
```sql
CREATE TABLE payment_transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    razorpay_signature VARCHAR(500),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'initiated',
    payment_method VARCHAR(50),
    error_code VARCHAR(100),
    error_description TEXT,
    refund_id VARCHAR(255),
    refund_amount DECIMAL(10, 2),
    refund_status VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Payment transaction records
**Integration**: Razorpay

### webhook_events
```sql
CREATE TABLE webhook_events (
    id SERIAL PRIMARY KEY,
    event_id VARCHAR(255) UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(50) DEFAULT 'received',
    processed_at TIMESTAMP,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Webhook event processing queue

## 4.5 Admin Service Tables

### landing_config
```sql
CREATE TABLE landing_config (
    id SERIAL PRIMARY KEY,
    section VARCHAR(100) NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Landing page CMS configuration
**Sections**: hero, newArrivals, collections, about

### landing_images
```sql
CREATE TABLE landing_images (
    id SERIAL PRIMARY KEY,
    section VARCHAR(100) NOT NULL,
    image_url VARCHAR(500) NOT NULL,
    title VARCHAR(255),
    subtitle VARCHAR(255),
    link_url VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    device_variant VARCHAR(20) DEFAULT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Landing page images

### chat_rooms & chat_messages
```sql
CREATE TABLE chat_rooms (
    id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    customer_name VARCHAR(100),
    customer_email VARCHAR(255),
    assigned_to INTEGER,
    subject VARCHAR(255),
    status chat_status DEFAULT 'open',
    priority VARCHAR(20) DEFAULT 'medium',
    order_id INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at TIMESTAMP
);

CREATE TABLE chat_messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id INTEGER,
    sender_type sender_type DEFAULT 'customer',
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Customer support chat system

### staff_tasks & staff_notifications
```sql
CREATE TABLE staff_tasks (
    id SERIAL PRIMARY KEY,
    assigned_to INTEGER,
    task_type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium',
    status VARCHAR(20) DEFAULT 'pending',
    due_time TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE staff_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    notification_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Staff task management and notifications

### inventory_movements
```sql
CREATE TABLE inventory_movements (
    id SERIAL PRIMARY KEY,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id),
    adjustment INTEGER NOT NULL,
    reason VARCHAR(50) NOT NULL,
    notes TEXT,
    supplier VARCHAR(255),
    cost_price DECIMAL(10, 2),
    performed_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Purpose**: Inventory audit trail

---

# 5. BACKEND SERVICES LAYER

## 5.1 Shared Utilities

**Location**: `shared/`

### Key Files

| File | Purpose |
|------|---------|
| `auth_middleware.py` | JWT validation, role checking |
| `base_schemas.py` | Pydantic base classes |
| `service_client.py` | Inter-service HTTP client |
| `smart_cache.py` | Redis caching utilities |
| `event_bus.py` | Event-driven communication |
| `response_schemas.py` | Standard API responses |

### auth_middleware.py

```python
from shared.auth_middleware import (
    get_current_user,      # Get authenticated user from JWT
    require_admin,         # Require admin role
    require_staff,         # Require staff or admin role
    require_customer       # Require customer role
)

# Usage in FastAPI endpoints
@app.get("/api/v1/admin/users")
async def list_users(user: dict = Depends(require_admin)):
    # user contains: user_id, email, role
    pass
```

### service_client.py

```python
from shared.service_client import ServiceClient

# Create client for inter-service communication
commerce_client = ServiceClient(
    base_url="http://commerce:5002",
    service_name="commerce"
)

# Make requests
response = await commerce_client.get("/api/v1/products")
response = await commerce_client.post("/api/v1/orders", data=order_data)
```

### smart_cache.py

```python
from shared.smart_cache import SmartCache

cache = SmartCache(prefix="product:")

# Cache with TTL
await cache.set("product:1", product_data, ttl=3600)

# Get or compute
data = await cache.get_or_compute(
    "product:1",
    fetch_from_db,
    ttl=3600
)

# Invalidate patterns
await cache.invalidate_pattern("product:*")
```

## 5.2 Core Service (Port 5001)

**Location**: `services/core/`

### Directory Structure

```
services/core/
├── main.py                  # FastAPI app entry point
├── requirements.txt
├── Dockerfile
├── core/
│   ├── config.py           # Settings (env vars)
│   └── redis_client.py     # Redis connection
├── database/
│   └── database.py         # DB connection
├── middleware/
│   ├── auth_middleware.py  # JWT validation
│   └── csrf_middleware.py  # CSRF protection
├── models/
│   ├── user.py             # User model
│   ├── user_profile.py     # Profile model
│   ├── user_security.py    # Security model
│   ├── email_verification.py
│   └── otp.py
├── schemas/
│   ├── auth.py             # Auth schemas
│   └── otp.py
└── service/
    ├── auth_service.py     # Auth logic
    ├── email_service.py    # Email sending
    ├── otp_service.py      # OTP handling
    └── whatsapp_service.py # WhatsApp notifications
```

### API Endpoints

```
# Authentication
POST   /api/v1/auth/register          - User registration
POST   /api/v1/auth/login             - User login (sets cookies)
POST   /api/v1/auth/logout            - User logout (clears cookies)
POST   /api/v1/auth/refresh           - Refresh access token
POST   /api/v1/auth/forgot-password   - Request password reset
POST   /api/v1/auth/reset-password    - Reset password with token
POST   /api/v1/auth/send-otp          - Send OTP
POST   /api/v1/auth/verify-otp        - Verify OTP

# Users
GET    /api/v1/users/me               - Get current user
PUT    /api/v1/users/me               - Update profile
PUT    /api/v1/users/me/password      - Change password

# Health
GET    /health                         - Health check
```

### Key Implementation Details

#### Cookie-Based Authentication

```python
# In main.py - set_auth_cookies()
def set_auth_cookies(response: Response, auth_data: dict, remember_me: bool = False):
    tokens = auth_data["tokens"]
    session_id = auth_data.get("session_id")
    
    # Access token cookie (30 minutes)
    response.set_cookie(
        key="access_token",
        value=tokens["access_token"],
        httponly=True,
        secure=True,  # HTTPS only in production
        samesite="Lax",
        max_age=30 * 60,
        path="/"
    )
    
    # Refresh token cookie (24 hours if remember_me)
    response.set_cookie(
        key="refresh_token",
        value=tokens["refresh_token"],
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=24 * 60 * 60 if remember_me else 30 * 60,
        path="/api/v1/auth/refresh"
    )
    
    # Session ID cookie
    response.set_cookie(
        key="session_id",
        value=session_id,
        httponly=True,
        secure=True,
        samesite="Lax",
        max_age=24 * 60 * 60,
        path="/"
    )
```

## 5.3 Commerce Service (Port 5002)

**Location**: `services/commerce/`

### Directory Structure

```
services/commerce/
├── main.py                  # FastAPI app entry point
├── requirements.txt
├── Dockerfile
├── core/
│   ├── config.py           # Settings
│   ├── cart_lock.py        # Cart concurrency
│   └── redis_client.py     # Redis connection
├── database/
│   └── database.py         # DB connection
├── models/
│   ├── product.py          # Product model
│   ├── product_image.py    # Image model
│   ├── inventory.py        # Inventory/variant model
│   ├── category.py         # Category model
│   ├── order.py            # Order model
│   ├── order_tracking.py   # Tracking model
│   ├── address.py          # Address model
│   ├── wishlist.py         # Wishlist model
│   ├── review.py           # Review model
│   ├── promotion.py        # Promotion model
│   └── return_request.py   # Return model
├── schemas/
│   └── [corresponding schemas]
├── search/
│   └── meilisearch_client.py  # Search integration
└── service/
    ├── product_service.py     # Product logic
    ├── cart_service.py        # Cart logic
    ├── order_service.py       # Order logic
    ├── inventory_service.py   # Inventory logic
    ├── category_service.py    # Category logic
    ├── r2_service.py          # R2 image service
    └── [other services]
```

### API Endpoints

```
# Products (Public)
GET    /api/v1/products                 - List products
GET    /api/v1/products/{id}            - Get product
GET    /api/v1/products/slug/{slug}     - Get by slug
GET    /api/v1/products/featured        - Featured products
GET    /api/v1/products/new-arrivals    - New arrivals
GET    /api/v1/products/search          - Search products

# Categories/Collections
GET    /api/v1/categories               - List categories
GET    /api/v1/collections              - List collections
GET    /api/v1/categories/tree          - Category tree
GET    /api/v1/categories/{id}          - Get category
GET    /api/v1/categories/slug/{slug}   - Get by slug

# Cart (Authenticated)
GET    /api/v1/cart                     - Get cart
POST   /api/v1/cart/items               - Add item
PUT    /api/v1/cart/items/{productId}   - Update item
DELETE /api/v1/cart/items/{productId}   - Remove item
DELETE /api/v1/cart                     - Clear cart
POST   /api/v1/cart/coupon              - Apply coupon
DELETE /api/v1/cart/coupon              - Remove coupon

# Orders (Authenticated)
POST   /api/v1/orders                   - Create order
GET    /api/v1/orders                   - List orders
GET    /api/v1/orders/{id}              - Get order
POST   /api/v1/orders/{id}/cancel       - Cancel order
GET    /api/v1/orders/{id}/tracking     - Track order

# Addresses (Authenticated)
GET    /api/v1/addresses                - List addresses
POST   /api/v1/addresses                - Create address
GET    /api/v1/addresses/{id}           - Get address
PUT    /api/v1/addresses/{id}           - Update address
DELETE /api/v1/addresses/{id}           - Delete address
PUT    /api/v1/addresses/{id}/default   - Set default

# Wishlist (Authenticated)
GET    /api/v1/wishlist                 - Get wishlist
POST   /api/v1/wishlist/items           - Add item
DELETE /api/v1/wishlist/items/{productId} - Remove item

# Returns (Authenticated)
POST   /api/v1/returns                  - Create return
GET    /api/v1/returns                  - List returns
GET    /api/v1/returns/{id}             - Get return
POST   /api/v1/returns/{id}/cancel      - Cancel return

# Reviews
GET    /api/v1/products/{id}/reviews    - List reviews
POST   /api/v1/products/{id}/reviews    - Create review
```

### Key Implementation Details

#### Cart Service (Redis-based)

```python
# Cart stored in Redis with user_id as key
# Key format: cart:user:{user_id}

# Cart structure in Redis
{
    "items": [
        {
            "product_id": 1,
            "variant_id": 2,
            "quantity": 2,
            "price": 999.00
        }
    ],
    "coupon_code": "SAVE10",
    "subtotal": 1998.00,
    "discount": 199.80,
    "total": 1798.20
}
```

#### Stock Reservation

```python
# In stock_reservation.py
# Prevents overselling during checkout

class StockReservation:
    async def reserve(self, inventory_id: int, quantity: int, order_id: int):
        # Reserve stock for 15 minutes during checkout
        # Key: reservation:{inventory_id}:{order_id}
        pass
    
    async def confirm(self, inventory_id: int, order_id: int):
        # Confirm reservation after payment
        # Deduct from inventory.quantity
        pass
    
    async def release(self, inventory_id: int, order_id: int):
        # Release reservation on payment failure/timeout
        pass
```

## 5.4 Payment Service (Port 5003)

**Location**: `services/payment/`

### API Endpoints

```
# Payment
GET    /api/v1/payments/config              - Get Razorpay config
GET    /api/v1/payments/methods             - Get payment methods
POST   /api/v1/payments/razorpay/create-order - Create payment order
POST   /api/v1/payments/razorpay/verify     - Verify payment
POST   /api/v1/payments/razorpay/refund     - Process refund

# Webhooks
POST   /api/v1/webhooks/razorpay            - Razorpay webhook
```

### Payment Flow

```
1. Frontend calls /api/v1/payments/razorpay/create-order
2. Payment Service creates Razorpay order
3. Returns order_id to frontend
4. Frontend opens Razorpay checkout
5. User completes payment
6. Razorpay sends webhook to /api/v1/webhooks/razorpay
7. Payment Service verifies and updates order status
8. Commerce Service receives order confirmation
```

## 5.5 Admin Service (Port 5004)

**Location**: `services/admin/`

### API Endpoints

```
# Dashboard
GET    /api/v1/admin/dashboard/overview     - Dashboard stats
GET    /api/v1/admin/analytics/revenue      - Revenue analytics
GET    /api/v1/admin/analytics/customers    - Customer analytics
GET    /api/v1/admin/analytics/products/top-selling - Top products

# Products (Admin)
GET    /api/v1/admin/products               - List products
POST   /api/v1/admin/products               - Create product
PATCH  /api/v1/admin/products/{id}          - Update product
DELETE /api/v1/admin/products/{id}          - Delete product
POST   /api/v1/admin/products/{id}/images   - Upload image
POST   /api/v1/admin/products/bulk/price    - Bulk price update
POST   /api/v1/admin/products/bulk/status   - Bulk status update

# Orders (Admin)
GET    /api/v1/admin/orders                 - List orders
GET    /api/v1/admin/orders/{id}            - Get order
PUT    /api/v1/admin/orders/{id}/status     - Update status
POST   /api/v1/admin/orders/bulk-update     - Bulk update

# Collections (Admin)
POST   /api/v1/admin/collections            - Create collection
PATCH  /api/v1/admin/collections/{id}       - Update collection
DELETE /api/v1/admin/collections/{id}       - Delete collection

# Inventory (Admin)
GET    /api/v1/admin/inventory              - List inventory
GET    /api/v1/admin/inventory/low-stock    - Low stock items
POST   /api/v1/admin/inventory/adjust       - Adjust stock

# Returns (Admin)
GET    /api/v1/admin/returns                - List returns
POST   /api/v1/admin/returns/{id}/approve   - Approve return
POST   /api/v1/admin/returns/{id}/reject    - Reject return
POST   /api/v1/admin/returns/{id}/receive   - Mark received
POST   /api/v1/admin/returns/{id}/refund    - Process refund

# Landing CMS
GET    /api/v1/admin/landing/config         - Get config
PUT    /api/v1/admin/landing/config/{section} - Update section
GET    /api/v1/admin/landing/images         - List images
POST   /api/v1/admin/landing/images         - Add image
DELETE /api/v1/admin/landing/images/{id}    - Delete image

# Site Config
GET    /api/v1/admin/site/config            - Get site config
PUT    /api/v1/admin/site/config            - Update site config

# Chat
GET    /api/v1/admin/chat/rooms             - List chat rooms
GET    /api/v1/admin/chat/rooms/{id}/messages - Get messages
POST   /api/v1/admin/chat/rooms/{id}/messages - Send message
PUT    /api/v1/admin/chat/rooms/{id}/assign - Assign room
PUT    /api/v1/admin/chat/rooms/{id}/close  - Close room

# Staff
GET    /api/v1/staff/dashboard              - Staff dashboard
GET    /api/v1/staff/orders/pending         - Pending orders
PUT    /api/v1/staff/orders/{id}/process    - Process order
PUT    /api/v1/staff/orders/{id}/ship       - Ship order

# Public Landing
GET    /api/v1/landing/all                  - Get all landing data
GET    /api/v1/site/config                  - Public site config
```

---

# 6. FRONTEND LAYER

## 6.1 Next.js Application Structure

**Location**: `frontend_new/`

### Directory Structure

```
frontend_new/
├── app/                          # Next.js App Router
│   ├── layout.js                 # Root layout with providers
│   ├── page.js                   # Homepage (/)
│   ├── globals.css               # Global styles
│   ├── not-found.js              # 404 page
│   │
│   ├── about/                    # About page
│   │   └── page.js
│   │
│   ├── products/                 # Products
│   │   ├── page.js               # Product listing
│   │   └── [id]/page.js          # Product detail
│   │
│   ├── collections/
│   │   └── [slug]/page.js        # Collection page
│   │
│   ├── new-arrivals/
│   │   └── page.js
│   │
│   ├── cart/
│   │   └── page.js
│   │
│   ├── checkout/
│   │   ├── layout.js
│   │   ├── page.js               # Address selection
│   │   ├── payment/page.js       # Payment
│   │   └── confirm/page.js       # Confirmation
│   │
│   ├── auth/
│   │   ├── layout.js
│   │   ├── login/page.js
│   │   ├── register/page.js
│   │   ├── forgot-password/page.js
│   │   ├── reset-password/page.js
│   │   ├── verify-email/page.js
│   │   └── check-email/page.js
│   │
│   ├── profile/                  # Protected routes
│   │   ├── layout.js
│   │   ├── page.js               # Profile overview
│   │   ├── addresses/page.js
│   │   ├── orders/page.js
│   │   ├── wishlist/page.js
│   │   ├── returns/
│   │   │   ├── page.js
│   │   │   ├── [id]/page.js
│   │   │   └── create/page.js
│   │   └── settings/page.js
│   │
│   └── admin/                    # Admin routes
│       ├── layout.js
│       ├── page.js               # Dashboard
│       ├── products/
│       │   ├── page.js
│       │   ├── create/page.js
│       │   └── [id]/edit/page.js
│       ├── orders/
│       │   ├── page.js
│       │   └── [id]/page.js
│       ├── collections/page.js
│       ├── customers/page.js
│       ├── returns/
│       │   ├── page.js
│       │   └── [id]/page.js
│       ├── analytics/page.js
│       ├── chat/page.js
│       ├── landing/page.js
│       └── settings/page.js
│
├── components/
│   ├── ErrorBoundary.jsx
│   ├── PageTransition.js
│   ├── SilkBackground.js
│   │
│   ├── admin/
│   │   ├── layout/
│   │   │   ├── AdminHeader.jsx
│   │   │   ├── AdminLayout.jsx
│   │   │   └── AdminSidebar.jsx
│   │   └── shared/
│   │       ├── DataTable.jsx
│   │       ├── StatCard.jsx
│   │       └── StatusBadge.jsx
│   │
│   ├── cart/
│   │   ├── CartAnimation.jsx
│   │   └── CartDrawer.jsx
│   │
│   ├── checkout/
│   │   └── CheckoutProgress.jsx
│   │
│   ├── common/
│   │   ├── CategoryCard.jsx
│   │   └── ProductCard.jsx
│   │
│   ├── landing/
│   │   ├── AboutSection.jsx
│   │   ├── Collections.jsx
│   │   ├── EnhancedHeader.jsx
│   │   ├── Footer.jsx
│   │   ├── HeroSection.jsx
│   │   ├── IntroVideo.jsx
│   │   └── NewArrivals.jsx
│   │
│   └── ui/
│       ├── button.jsx
│       ├── card.jsx
│       ├── Carousel.jsx
│       ├── input.jsx
│       ├── label.jsx
│       ├── Modal.jsx
│       ├── OptimizedImage.jsx
│       ├── ParallaxContainer.jsx
│       ├── SearchDropdown.jsx
│       ├── Skeleton.jsx
│       ├── SmoothScroll.jsx
│       └── Toast.jsx
│
├── lib/
│   ├── baseApi.js                # Base API client
│   ├── api.js                    # Core APIs
│   ├── customerApi.js            # Customer APIs
│   ├── adminApi.js               # Admin APIs
│   ├── authContext.js            # Auth state
│   ├── cartContext.js            # Cart state
│   ├── siteConfigContext.js      # Site config
│   ├── authValidation.js
│   ├── errorTracking.js
│   ├── gsapConfig.js
│   ├── logger.js
│   ├── returnConstants.js
│   └── utils.js
│
├── public/
│   ├── logo.png
│   ├── hero/
│   ├── products/
│   └── collections/
│
├── middleware.js                 # Route protection
├── next.config.js
├── tailwind.config.js
└── package.json
```

## 6.2 Route Protection (middleware.js)

```javascript
// Public routes (no login required)
const PUBLIC_ROUTES = ['/', '/products', '/collections', '/new-arrivals', '/about'];

// Auth routes (redirect if logged in)
const AUTH_ROUTES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/change-password',
];

// Protected routes (require login)
const PROTECTED_ROUTES = ['/cart', '/checkout', '/profile'];

// Admin routes (require admin/staff role)
// All routes starting with /admin

export function middleware(request) {
  const { pathname } = request.nextUrl;
  
  // Get token from cookie
  const accessToken = request.cookies.get('access_token')?.value;
  const decodedToken = parseJwt(accessToken);
  
  const isAuthenticated = decodedToken && decodedToken.exp * 1000 > Date.now();
  const userRole = decodedToken?.role;
  const isStaff = userRole === 'admin' || userRole === 'staff';
  
  // Admin routes
  if (pathname.startsWith('/admin')) {
    if (!isAuthenticated) {
      return redirect('/auth/login');
    }
    if (!isStaff) {
      return redirect('/');
    }
  }
  
  // Profile routes
  if (pathname.startsWith('/profile')) {
    if (!isAuthenticated) {
      return redirect('/auth/login');
    }
  }
  
  // Protected routes
  if (PROTECTED_ROUTES.some(route => pathname.startsWith(route))) {
    if (!isAuthenticated) {
      return redirect('/auth/login');
    }
  }
  
  // Auth routes (redirect if logged in)
  if (AUTH_ROUTES.some(route => pathname.startsWith(route))) {
    if (isAuthenticated) {
      return redirect(isStaff ? '/admin' : '/');
    }
  }
}
```

## 6.3 API Clients

### baseApi.js

```javascript
export class BaseApiClient {
  constructor(baseUrl, options = {}) {
    this.baseUrl = baseUrl;
    this.includeCredentials = options.includeCredentials !== false;
  }

  async fetch(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    
    const response = await fetch(url, {
      ...options,
      credentials: this.includeCredentials ? 'include' : 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.detail || `Request failed: ${response.status}`);
    }
    
    return data;
  }

  get(path, params = {}) { /* ... */ }
  post(path, data = {}) { /* ... */ }
  put(path, data = {}) { /* ... */ }
  patch(path, data = {}) { /* ... */ }
  delete(path) { /* ... */ }
  uploadFile(path, file, params = {}) { /* ... */ }
}

// Pre-configured clients
export const coreClient = new BaseApiClient(getCoreBaseUrl());
export const commerceClient = new BaseApiClient(getCommerceBaseUrl());
export const adminClient = new BaseApiClient(getAdminBaseUrl());
export const paymentClient = new BaseApiClient(getPaymentBaseUrl());
```

### customerApi.js

```javascript
// Products
export const productsApi = {
  list: (params) => commerceClient.get('/api/v1/products', params),
  get: (id) => commerceClient.get(`/api/v1/products/${id}`),
  getBySlug: (slug) => commerceClient.get(`/api/v1/products/slug/${slug}`),
  getFeatured: () => commerceClient.get('/api/v1/products/featured'),
  getNewArrivals: () => commerceClient.get('/api/v1/products/new-arrivals'),
  search: (query) => commerceClient.get('/api/v1/products/search', { q: query }),
};

// Cart
export const cartApi = {
  get: () => commerceClient.get('/api/v1/cart'),
  addItem: (productId, quantity, variantId) => 
    commerceClient.post('/api/v1/cart/items', { product_id: productId, quantity, variant_id: variantId }),
  updateItem: (productId, quantity, variantId) =>
    commerceClient.put(`/api/v1/cart/items/${productId}`, { quantity, variant_id: variantId }),
  removeItem: (productId, variantId) =>
    commerceClient.delete(`/api/v1/cart/items/${productId}?variant_id=${variantId || ''}`),
  clear: () => commerceClient.delete('/api/v1/cart'),
  applyCoupon: (code) => commerceClient.post('/api/v1/cart/coupon', { code }),
  removeCoupon: () => commerceClient.delete('/api/v1/cart/coupon'),
};

// Orders
export const ordersApi = {
  create: (data) => commerceClient.post('/api/v1/orders', data),
  list: (params) => commerceClient.get('/api/v1/orders', params),
  get: (id) => commerceClient.get(`/api/v1/orders/${id}`),
  cancel: (id) => commerceClient.post(`/api/v1/orders/${id}/cancel`),
  track: (id) => commerceClient.get(`/api/v1/orders/${id}/tracking`),
};

// Addresses
export const addressesApi = {
  list: () => commerceClient.get('/api/v1/addresses'),
  get: (id) => commerceClient.get(`/api/v1/addresses/${id}`),
  create: (data) => commerceClient.post('/api/v1/addresses', data),
  update: (id, data) => commerceClient.put(`/api/v1/addresses/${id}`, data),
  delete: (id) => commerceClient.delete(`/api/v1/addresses/${id}`),
  setDefault: (id) => commerceClient.put(`/api/v1/addresses/${id}/default`),
};

// Wishlist
export const wishlistApi = {
  get: () => commerceClient.get('/api/v1/wishlist'),
  add: (productId) => commerceClient.post('/api/v1/wishlist/items', { product_id: productId }),
  remove: (productId) => commerceClient.delete(`/api/v1/wishlist/items/${productId}`),
};

// Returns
export const returnsApi = {
  create: (data) => commerceClient.post('/api/v1/returns', data),
  list: () => commerceClient.get('/api/v1/returns'),
  get: (id) => commerceClient.get(`/api/v1/returns/${id}`),
  cancel: (id) => commerceClient.post(`/api/v1/returns/${id}/cancel`),
};
```

### adminApi.js

```javascript
// Dashboard
export const dashboardApi = {
  getOverview: () => adminClient.get('/api/v1/admin/dashboard/overview'),
  getRevenueAnalytics: (period) => adminClient.get('/api/v1/admin/analytics/revenue', { period }),
  getCustomerAnalytics: () => adminClient.get('/api/v1/admin/analytics/customers'),
  getTopProducts: (period, limit) => adminClient.get('/api/v1/admin/analytics/products/top-selling', { period, limit }),
};

// Products (Admin)
export const productsApi = {
  list: (params) => adminClient.get('/api/v1/admin/products', params),
  get: (id) => commerceClient.get(`/api/v1/products/${id}`),
  create: (data) => adminClient.post('/api/v1/admin/products', data),
  update: (id, data) => adminClient.patch(`/api/v1/admin/products/${id}`, data),
  delete: (id) => adminClient.delete(`/api/v1/admin/products/${id}`),
  uploadImage: (id, formData) => adminClient.uploadFile(`/api/v1/admin/products/${id}/images`, formData),
  deleteImage: (id, imageId) => adminClient.delete(`/api/v1/admin/products/${id}/images/${imageId}`),
  
  // Variants
  getVariants: (id) => adminClient.get(`/api/v1/admin/products/${id}/variants`),
  createVariant: (id, data) => adminClient.post(`/api/v1/admin/products/${id}/variants`, data),
  updateVariant: (id, variantId, data) => adminClient.patch(`/api/v1/admin/products/${id}/variants/${variantId}`, data),
  deleteVariant: (id, variantId) => adminClient.delete(`/api/v1/admin/products/${id}/variants/${variantId}`),
  
  // Bulk operations
  bulkPrice: (data) => adminClient.post('/api/v1/admin/products/bulk/price', data),
  bulkStatus: (data) => adminClient.post('/api/v1/admin/products/bulk/status', data),
  bulkDelete: (ids) => adminClient.post('/api/v1/admin/products/bulk/delete', { ids }),
};

// Collections
export const collectionsApi = {
  list: () => commerceClient.get('/api/v1/collections'),
  get: (id) => commerceClient.get(`/api/v1/collections/${id}`),
  getBySlug: (slug) => commerceClient.get(`/api/v1/collections/slug/${slug}`),
  create: (data) => adminClient.post('/api/v1/admin/collections', data),
  update: (id, data) => adminClient.patch(`/api/v1/admin/collections/${id}`, data),
  delete: (id) => adminClient.delete(`/api/v1/admin/collections/${id}`),
  uploadImage: (id, formData) => adminClient.uploadFile(`/api/v1/admin/categories/${id}/image`, formData),
};

// Orders (Admin)
export const ordersApi = {
  list: (params) => adminClient.get('/api/v1/admin/orders', params),
  get: (id) => adminClient.get(`/api/v1/admin/orders/${id}`),
  updateStatus: (id, status) => adminClient.put(`/api/v1/admin/orders/${id}/status`, { status }),
  bulkUpdate: (data) => adminClient.post('/api/v1/admin/orders/bulk-update', data),
};

// Returns (Admin)
export const returnsApi = {
  list: (params) => adminClient.get('/api/v1/admin/returns', params),
  get: (id) => commerceClient.get(`/api/v1/returns/${id}`),
  approve: (id) => adminClient.post(`/api/v1/admin/returns/${id}/approve`),
  reject: (id, reason) => adminClient.post(`/api/v1/admin/returns/${id}/reject`, { reason }),
  markReceived: (id) => adminClient.post(`/api/v1/admin/returns/${id}/receive`),
  processRefund: (id) => adminClient.post(`/api/v1/admin/returns/${id}/refund`),
};

// Landing CMS
export const landingApi = {
  getConfig: () => adminClient.get('/api/v1/admin/landing/config'),
  updateSection: (section, data) => adminClient.put(`/api/v1/admin/landing/config/${section}`, data),
  getImages: () => adminClient.get('/api/v1/admin/landing/images'),
  addImage: (data) => adminClient.post('/api/v1/admin/landing/images', data),
  uploadImage: (formData) => adminClient.uploadFile('/api/v1/admin/landing/images/upload', formData),
  updateImage: (id, data) => adminClient.patch(`/api/v1/admin/landing/images/${id}`, data),
  deleteImage: (id) => adminClient.delete(`/api/v1/admin/landing/images/${id}`),
};

// Chat
export const chatApi = {
  getRooms: () => adminClient.get('/api/v1/admin/chat/rooms'),
  getMessages: (roomId) => adminClient.get(`/api/v1/admin/chat/rooms/${roomId}/messages`),
  sendMessage: (roomId, message) => adminClient.post(`/api/v1/admin/chat/rooms/${roomId}/messages`, { message }),
  assignRoom: (roomId, userId) => adminClient.put(`/api/v1/admin/chat/rooms/${roomId}/assign`, { user_id: userId }),
  closeRoom: (roomId) => adminClient.put(`/api/v1/admin/chat/rooms/${roomId}/close`),
};
```

## 6.4 State Management (React Context)

### AuthContext

```javascript
// lib/authContext.js
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const userData = await apiFetch('/api/v1/users/me');
      setUser(userData);
      setIsAuthenticated(true);
    } catch (err) {
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (credentials) => {
    const response = await apiFetch('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    setUser(response.user);
    setIsAuthenticated(true);
    return response;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/api/v1/auth/logout', { method: 'POST' });
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  const hasRole = useCallback((role) => {
    if (!user?.role) return false;
    return Array.isArray(role) ? role.includes(user.role) : user.role === role;
  }, [user]);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      isAuthenticated,
      login,
      logout,
      checkAuth,
      hasRole,
      isAdmin: () => hasRole('admin'),
      isStaff: () => hasRole(['admin', 'staff']),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
```

### CartContext

```javascript
// lib/cartContext.js
export function CartProvider({ children }) {
  const [cart, setCart] = useState({ items: [], subtotal: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  
  const { isAuthenticated } = useAuth();

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated) return;
    const data = await cartApi.get();
    setCart(data);
  }, [isAuthenticated]);

  const addItem = useCallback(async (productId, quantity, variant) => {
    const data = await cartApi.addItem(productId, quantity, variant?.id);
    setCart(data);
    setIsOpen(true); // Open cart drawer
    return data;
  }, []);

  const updateQuantity = useCallback(async (productId, quantity, variantId) => {
    const data = await cartApi.updateItem(productId, quantity, variantId);
    setCart(data);
    return data;
  }, []);

  const removeItem = useCallback(async (productId, variantId) => {
    const data = await cartApi.removeItem(productId, variantId);
    setCart(data);
    return data;
  }, []);

  return (
    <CartContext.Provider value={{
      cart,
      loading,
      isOpen,
      itemCount: cart?.item_count || 0,
      addItem,
      updateQuantity,
      removeItem,
      openCart: () => setIsOpen(true),
      closeCart: () => setIsOpen(false),
      toggleCart: () => setIsOpen(prev => !prev),
      refreshCart: fetchCart,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
```

## 6.5 Root Layout

```javascript
// app/layout.js
import { AuthProvider } from '../lib/authContext';
import { CartProvider } from '../lib/cartContext';
import { SiteConfigProvider } from '../lib/siteConfigContext';
import CartDrawer from '../components/cart/CartDrawer';
import SilkBackground from '../components/SilkBackground';
import { ToastProvider } from '../components/ui/Toast';
import ErrorBoundary from '../components/ErrorBoundary';

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SilkBackground />
        <div className="fixed inset-0 z-0 bg-gradient-to-b from-[#050203]/40 via-transparent to-[#050203]/90" />
        
        <ErrorBoundary>
          <AuthProvider>
            <CartProvider>
              <SiteConfigProvider>
                <ToastProvider>
                  {children}
                  <CartDrawer />
                </ToastProvider>
              </SiteConfigProvider>
            </CartProvider>
          </AuthProvider>
        </ErrorBoundary>
        
        <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />
      </body>
    </html>
  );
}
```

---

# 7. AUTHENTICATION & SECURITY

## 7.1 Authentication Flow

### Registration Flow

```
1. User fills registration form (email, password, name, phone)
2. Frontend POST /api/v1/auth/register
3. Core Service:
   - Validates email uniqueness
   - Hashes password with bcrypt
   - Creates user in users table
   - Creates profile in user_profiles table
   - Creates security record in user_security table
   - Generates email verification token
   - Sends verification email
4. Returns: { user, tokens }
5. Frontend stores tokens in HttpOnly cookies (via backend Set-Cookie)
6. Redirects to /auth/check-email
```

### Login Flow

```
1. User enters email + password
2. Frontend POST /api/v1/auth/login
3. Core Service:
   - Validates credentials
   - Checks account lock status
   - Generates JWT tokens
   - Creates session
   - Sets HttpOnly cookies
4. Returns: { user, tokens, session_id }
5. Frontend stores user in localStorage (for UI state only)
6. Redirects based on role:
   - admin/staff → /admin
   - customer → / or redirect param
```

### Token Refresh Flow

```
1. Access token expires (30 min)
2. Frontend detects 401 response
3. Frontend POST /api/v1/auth/refresh
4. Core Service:
   - Validates refresh token from cookie
   - Generates new access token
   - Sets new cookie
5. Returns: { access_token }
6. Original request retried with new token
```

### Logout Flow

```
1. User clicks logout
2. Frontend POST /api/v1/auth/logout
3. Core Service:
   - Invalidates session
   - Clears cookies
4. Frontend clears localStorage
5. Redirects to /
```

## 7.2 JWT Token Structure

```javascript
// Access Token Payload
{
  "user_id": 1,
  "email": "user@example.com",
  "role": "customer",
  "exp": 1704067200,  // Expiration timestamp
  "iat": 1704065400   // Issued at timestamp
}

// Token Headers
{
  "alg": "HS256",
  "typ": "JWT"
}
```

## 7.3 Cookie Configuration

```python
# Cookie settings
COOKIE_HTTPONLY = True      # Not accessible via JavaScript
COOKIE_SECURE = True        # HTTPS only (False in development)
COOKIE_SAMESITE = "Lax"     # CSRF protection

# Token expiration
ACCESS_TOKEN_EXPIRE_MINUTES = 30
REFRESH_TOKEN_EXPIRE_MINUTES = 1440  # 24 hours
SESSION_EXPIRE_MINUTES = 1440        # 24 hours
```

## 7.4 Role-Based Access Control

### Roles

| Role | Access Level |
|------|--------------|
| `admin` | Full access to all admin endpoints |
| `staff` | Access to staff endpoints, limited admin |
| `customer` | Access to customer endpoints only |

### Middleware Usage

```python
# In backend
from shared.auth_middleware import require_admin, require_staff, get_current_user

# Admin only
@app.delete("/api/v1/admin/products/{id}")
async def delete_product(user: dict = Depends(require_admin)):
    pass

# Staff or admin
@app.put("/api/v1/admin/orders/{id}/status")
async def update_order(user: dict = Depends(require_staff)):
    pass

# Any authenticated user
@app.get("/api/v1/users/me")
async def get_profile(user: dict = Depends(get_current_user)):
    pass
```

---

# 8. DATA FLOW PATTERNS

## 8.1 Product Browsing Flow

```
User visits /products
       ↓
Frontend: productsApi.list({ category, sort, page })
       ↓
Nginx routes to Commerce Service
       ↓
Commerce Service:
  1. Check Redis cache
  2. If miss, query PostgreSQL
  3. Join products + product_images + inventory
  4. Apply filters and sorting
  5. Cache result in Redis (5 min)
       ↓
Return paginated products
       ↓
Frontend renders ProductCard components
```

## 8.2 Add to Cart Flow

```
User clicks "Add to Cart"
       ↓
Frontend: useCart().addItem(productId, quantity, variant)
       ↓
Frontend: cartApi.addItem(productId, quantity, variantId)
       ↓
Nginx routes to Commerce Service
       ↓
Commerce Service:
  1. Validate product exists
  2. Check inventory availability
  3. Get or create cart in Redis
  4. Add/update cart item
  5. Calculate totals
  6. Apply coupon if exists
       ↓
Return updated cart
       ↓
Frontend: setCart(data)
       ↓
Frontend: openCart() - shows cart drawer
```

## 8.3 Checkout Flow

```
User clicks "Checkout"
       ↓
Frontend: Navigate to /checkout
       ↓
Frontend: addressesApi.list()
       ↓
User selects/creates address
       ↓
Frontend: Navigate to /checkout/payment
       ↓
Frontend: paymentApi.createOrder(orderData)
       ↓
Payment Service:
  1. Create Razorpay order
  2. Return order_id
       ↓
Frontend: Open Razorpay checkout
       ↓
User completes payment
       ↓
Razorpay webhook → Payment Service
       ↓
Payment Service:
  1. Verify signature
  2. Update payment_transactions
  3. Call Commerce Service to update order
       ↓
Commerce Service:
  1. Update order status to "confirmed"
  2. Deduct inventory
  3. Clear cart
  4. Send confirmation email
       ↓
Frontend: Navigate to /checkout/confirm
```

## 8.4 Admin Product Creation Flow

```
Admin fills product form
       ↓
Frontend: productsApi.create(productData)
       ↓
Admin Service:
  1. Validate data
  2. Create product in PostgreSQL
  3. Create variants in inventory table
  4. Index in Meilisearch
       ↓
Admin uploads images
       ↓
Frontend: productsApi.uploadImage(productId, formData)
       ↓
Admin Service:
  1. Upload to R2
  2. Create record in product_images
       ↓
Return updated product
```

---

# 9. IMPLEMENTATION GUIDELINES

## 9.1 Adding a New Feature

### Step 1: Database Changes
1. Add table/columns to `docker/postgres/init.sql`
2. Create SQLAlchemy model in appropriate service
3. Create Pydantic schemas for request/response

### Step 2: Backend Implementation
1. Add endpoint to appropriate service's `main.py`
2. Implement business logic in service layer
3. Add proper authentication middleware
4. Add error handling

### Step 3: Frontend Implementation
1. Add API function to appropriate API client
2. Create/update page component
3. Connect to context if needed
4. Add route protection if needed

### Step 4: Testing
1. Test API endpoint directly
2. Test frontend integration
3. Test error scenarios
4. Test authentication/authorization

## 9.2 Code Style Guidelines

### Backend (Python)

```python
# Use dependency injection
@app.get("/api/v1/products")
async def list_products(
    db: Session = Depends(get_db),
    user: dict = Depends(get_current_user)
):
    pass

# Use Pydantic schemas
class ProductCreate(BaseModel):
    name: str
    price: float
    category_id: int

# Use service layer for business logic
# In service/product_service.py
def create_product(db: Session, product_data: ProductCreate):
    product = Product(**product_data.model_dump())
    db.add(product)
    db.commit()
    return product
```

### Frontend (JavaScript/React)

```javascript
// Use async/await
const handleSubmit = async (data) => {
  try {
    const result = await productsApi.create(data);
    toast.success('Product created');
    router.push('/admin/products');
  } catch (error) {
    toast.error(error.message);
  }
};

// Use React hooks
const { user, isAuthenticated } = useAuth();
const { cart, addItem } = useCart();

// Use dynamic imports for code splitting
const AdminDashboard = dynamic(() => import('@/components/AdminDashboard'), {
  loading: () => <Skeleton />,
  ssr: false,
});
```

## 9.3 Error Handling

### Backend

```python
from fastapi import HTTPException

# Raise appropriate HTTP exceptions
if not product:
    raise HTTPException(status_code=404, detail="Product not found")

# Use exception handlers
from core.exception_handler import ValidationException

if quantity < 0:
    raise ValidationException("Quantity must be positive")
```

### Frontend

```javascript
try {
  const result = await apiCall();
} catch (error) {
  if (error.status === 401) {
    // Handle unauthorized
    router.push('/auth/login');
  } else if (error.status === 403) {
    // Handle forbidden
    toast.error('You do not have permission');
  } else {
    // Generic error
    toast.error(error.message || 'An error occurred');
  }
}
```

---

# 10. QUICK REFERENCE

## 10.1 File Paths

### Frontend Key Files
| File | Purpose |
|------|---------|
| `frontend_new/app/layout.js` | Root layout with providers |
| `frontend_new/middleware.js` | Route protection |
| `frontend_new/lib/baseApi.js` | API client base |
| `frontend_new/lib/api.js` | Core APIs |
| `frontend_new/lib/customerApi.js` | Customer APIs |
| `frontend_new/lib/adminApi.js` | Admin APIs |
| `frontend_new/lib/authContext.js` | Auth state |
| `frontend_new/lib/cartContext.js` | Cart state |

### Backend Key Files
| File | Purpose |
|------|---------|
| `services/core/main.py` | Core service entry |
| `services/commerce/main.py` | Commerce service entry |
| `services/payment/main.py` | Payment service entry |
| `services/admin/main.py` | Admin service entry |
| `shared/auth_middleware.py` | JWT authentication |
| `shared/base_schemas.py` | Pydantic base classes |

### Infrastructure Files
| File | Purpose |
|------|---------|
| `docker-compose.yml` | All services configuration |
| `docker/nginx/nginx.conf` | Nginx routing |
| `docker/postgres/init.sql` | Database schema |

## 10.2 URLs

| Service | URL |
|---------|-----|
| Frontend | http://localhost:6004 |
| API Gateway | http://localhost:6005 |
| Core API | http://localhost:5001 |
| Commerce API | http://localhost:5002 |
| Payment API | http://localhost:5003 |
| Admin API | http://localhost:5004 |

## 10.3 Test Users

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@aarya.com | admin123 |
| Staff | staff@aarya.com | staff123 |
| Customer | customer@aarya.com | customer123 |

## 10.4 Common Commands

```bash
# Start all services
docker-compose up -d

# Rebuild services
docker-compose up -d --build

# View logs
docker-compose logs -f [service_name]

# Stop all services
docker-compose down

# Reset database
docker-compose down -v
docker-compose up -d

# Run frontend locally
cd frontend_new && npm run dev

# Run backend service locally
cd services/core && python main.py
```

---

*Document Version: 1.0*
*Last Updated: 2026-02-23*
*Purpose: Comprehensive system documentation for AI implementation reference*
