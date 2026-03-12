# Aarya Clothing - Complete Project Documentation

> **⚠️ IMPORTANT: This document was generated from actual source code.** 
> - AI should verify details against actual source files when making changes
> - File paths in this document point to real source files
> - Database schemas are from `docker/postgres/init.sql`
> - API endpoints are from service `main.py` files
> - If something seems wrong, check the actual source code first

This document provides comprehensive information about the Aarya Clothing e-commerce platform for AI systems to understand the full architecture and make changes.

---

# PART 1: FRONTEND DOCUMENTATION

## 1. Frontend Overview

The frontend is a Next.js 15 application located in `frontend_new/` directory. It uses:
- Next.js 15 with App Router
- React 18
- Tailwind CSS for styling
- GSAP for animations
- React Context for state management

### Frontend Directory Structure

```
frontend_new/
├── app/                          # Next.js App Router pages
│   ├── layout.js                 # Root layout with providers
│   ├── page.js                   # Homepage (/)
│   ├── globals.css              # Global styles
│   ├── not-found.js             # 404 page
│   │
│   ├── about/                   # About page (/about)
│   │   └── page.js
│   │
│   ├── new-arrivals/            # New arrivals (/new-arrivals)
│   │   └── page.js
│   │
│   ├── products/                 # Product listing (/products)
│   │   ├── page.js              # Products list page
│   │   └── [id]/
│   │       └── page.js         # Product detail page
│   │
│   ├── collections/              # Collections (/collections)
│   │   └── [slug]/
│   │       └── page.js         # Collection page
│   │
│   ├── cart/                     # Shopping cart (/cart)
│   │   └── page.js
│   │
│   ├── checkout/                 # Checkout flow
│   │   ├── layout.js
│   │   ├── page.js             # Address selection
│   │   ├── payment/
│   │   │   └── page.js         # Payment page
│   │   └── confirm/
│   │       └── page.js         # Order confirmation
│   │
│   ├── auth/                     # Authentication pages
│   │   ├── layout.js
│   │   ├── login/
│   │   │   └── page.js         # /auth/login
│   │   ├── register/
│   │   │   └── page.js         # /auth/register
│   │   ├── forgot-password/
│   │   │   └── page.js         # /auth/forgot-password
│   │   ├── reset-password/
│   │   │   └── page.js         # /auth/reset-password
│   │   ├── change-password/
│   │   │   └── page.js         # /auth/change-password
│   │   ├── verify-email/
│   │   │   └── page.js         # /auth/verify-email
│   │   └── check-email/
│   │       └── page.js         # /auth/check-email
│   │
│   ├── profile/                  # User profile (protected)
│   │   ├── layout.js
│   │   ├── page.js             # Profile overview
│   │   ├── addresses/
│   │   │   └── page.js         # Address management
│   │   ├── orders/
│   │   │   └── page.js         # Order history
│   │   ├── returns/
│   │   │   ├── page.js         # Returns list
│   │   │   ├── [id]/
│   │   │   │   └── page.js    # Return detail
│   │   │   └── create/
│   │   │       └── page.js     # Create return
│   │   ├── wishlist/
│   │   │   └── page.js         # Wishlist
│   │   └── settings/
│   │       └── page.js         # Account settings
│   │
│   └── admin/                    # Admin dashboard (protected)
│       ├── layout.js
│       ├── page.js              # Dashboard
│       ├── analytics/
│       │   └── page.js         # Analytics
│       ├── chat/
│       │   └── page.js         # Customer chat
│       ├── collections/
│       │   └── page.js         # Collections management
│       ├── customers/
│       │   └── page.js         # Customer management
│       ├── inventory/
│       ├── landing/
│       │   └── page.js         # Landing CMS
│       ├── orders/
│       │   ├── page.js         # Orders list
│       │   └── [id]/
│       │       └── page.js     # Order detail
│       ├── products/
│       │   ├── page.js         # Products list
│       │   └── create/
│       │       └── page.js     # Create product
│       ├── returns/
│       │   ├── page.js         # Returns list
│       │   └── [id]/
│       │       └── page.js     # Return detail
│       └── settings/
│           └── page.js         # Admin settings
│
├── components/                   # React components
│   ├── ErrorBoundary.jsx       # Error boundary wrapper
│   ├── PageTransition.js       # Page transition
│   ├── SilkBackground.js       # Animated background
│   │
│   ├── admin/                  # Admin components
│   │   ├── layout/
│   │   │   ├── AdminHeader.jsx
│   │   │   ├── AdminLayout.jsx
│   │   │   └── AdminSidebar.jsx
│   │   └── shared/
│   │       ├── DataTable.jsx
│   │       ├── StatCard.jsx
│   │       └── StatusBadge.jsx
│   │
│   ├── cart/                   # Cart components
│   │   ├── CartAnimation.jsx
│   │   └── CartDrawer.jsx
│   │
│   ├── checkout/               # Checkout components
│   │   └── CheckoutProgress.jsx
│   │
│   ├── common/                 # Common components
│   │   ├── CategoryCard.jsx
│   │   └── ProductCard.jsx
│   │
│   ├── landing/               # Landing page components
│   │   ├── AboutSection.jsx
│   │   ├── Collections.jsx
│   │   ├── EnhancedHeader.jsx
│   │   ├── Footer.jsx
│   │   ├── HeroSection.jsx
│   │   ├── IntroVideo.jsx
│   │   └── NewArrivals.jsx
│   │
│   └── ui/                     # UI components
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
├── lib/                        # Utility libraries
│   ├── baseApi.js             # BaseApiClient class
│   ├── api.js                 # Core API functions
│   ├── adminApi.js            # Admin API functions
│   ├── customerApi.js         # Customer API functions
│   ├── authContext.js         # Authentication context
│   ├── cartContext.js         # Cart context
│   ├── siteConfigContext.js   # Site config context
│   ├── authValidation.js      # Auth validation
│   ├── errorTracking.js       # Error tracking
│   ├── gsapConfig.js          # GSAP configuration
│   ├── logger.js              # Logging utility
│   ├── returnConstants.js     # Return constants
│   └── utils.js               # General utilities
│
├── public/                     # Static assets
│   ├── logo.png
│   ├── noise.png
│   ├── hero/                  # Hero images (hero1.png, hero2.png, hero3.png)
│   ├── products/              # Product images (product1-7.jpeg)
│   ├── collections/           # Collection images (collection1-7.jpeg)
│   └── about/                # About page images (kurti1.jpg, kurti2.jpg)
│
├── middleware.js              # Next.js middleware for route protection
├── next.config.js            # Next.js configuration
├── tailwind.config.js        # Tailwind configuration
├── package.json              # Dependencies
└── postcss.config.js         # PostCSS configuration
```

---

## 2. Frontend Configuration Files

### 2.1 package.json

```json
{
  "name": "frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "@radix-ui/react-label": "^2.1.8",
    "@radix-ui/react-slot": "^1.2.4",
    "@tailwindcss/postcss": "^4.1.18",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "gsap": "^3.14.2",
    "lucide-react": "^0.563.0",
    "next": "^15.5.12",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "tailwind-merge": "^3.4.0",
    "tailwindcss-animate": "^1.0.7"
  }
}
```

### 2.2 next.config.js Key Configuration

- Image optimization with Cloudflare R2
- Security headers
- Static asset caching
- AVIF/WebP formats
- Device sizes: [640, 750, 828, 1080, 1200, 1920]
- Image sizes: [16, 32, 48, 64, 96, 128, 256, 384]

### 2.3 middleware.js

The middleware handles route protection:
- Public routes: `/`, `/products`, `/collections`, `/new-arrivals`, `/about`
- Auth routes (redirect authenticated): `/auth/login`, `/auth/register`, etc.
- Protected (requires login): `/cart`, `/checkout`, `/profile`, `/profile/*`
- Admin routes (requires admin/staff): `/admin`, `/admin/*`

---

## 3. Frontend API Clients

### 3.1 baseApi.js - BaseApiClient Class

**File:** `frontend_new/lib/baseApi.js`

This is the core API client used by all other API modules. Key features:
- HTTP methods: get, post, put, patch, delete
- File upload support
- Token handling
- Error handling
- Response parsing

**Key Exports:**
```javascript
class BaseApiClient
// Singleton instances:
coreClient      // For Core Service
commerceClient  // For Commerce Service  
adminClient     // For Admin Service
paymentClient    // For Payment Service
// Helper functions:
getCoreBaseUrl()
getCommerceBaseUrl()
getAdminBaseUrl()
getPaymentBaseUrl()
buildQuery(params)
```

### 3.2 api.js - Core & Landing APIs

**File:** `frontend_new/lib/api.js`

| Function | HTTP | Endpoint | Service |
|----------|------|----------|---------|
| login | POST | /api/v1/auth/login | Core |
| logout | POST | /api/v1/auth/logout | Core |
| register | POST | /api/v1/auth/register | Core |
| refreshToken | POST | /api/v1/auth/refresh | Core |
| sendOtp | POST | /api/v1/auth/send-otp | Core |
| verifyOtp | POST | /api/v1/auth/verify-otp | Core |
| forgotPassword | POST | /api/v1/auth/forgot-password | Core |
| resetPassword | POST | /api/v1/auth/reset-password | Core |
| getCurrentUser | GET | /api/v1/users/me | Core |
| updateProfile | PATCH | /api/v1/users/me | Core |
| changePassword | POST | /api/v1/auth/change-password | Core |
| getLandingConfig | GET | /api/v1/landing/config | Admin |
| getLandingImages | GET | /api/v1/landing/images | Admin |
| getLandingAll | GET | /api/v1/landing/all | Admin |
| getSiteConfig | GET | /api/v1/site/config | Admin |

### 3.3 customerApi.js - Customer APIs

**File:** `frontend_new/lib/customerApi.js`

**Products:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| productsApi.list | GET | /api/v1/products |
| productsApi.get | GET | /api/v1/products/{id} |
| productsApi.getBySlug | GET | /api/v1/products/slug/{slug} |
| productsApi.getFeatured | GET | /api/v1/products/featured |
| productsApi.getNewArrivals | GET | /api/v1/products/new-arrivals |
| productsApi.search | GET | /api/v1/products/search |

**Categories:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| categoriesApi.list | GET | /api/v1/categories |
| categoriesApi.get | GET | /api/v1/categories/{id} |
| categoriesApi.getBySlug | GET | /api/v1/categories/slug/{slug} |
| categoriesApi.getTree | GET | /api/v1/categories/tree |

**Cart:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| cartApi.get | GET | /api/v1/cart |
| cartApi.addItem | POST | /api/v1/cart/items |
| cartApi.updateItem | PUT | /api/v1/cart/items/{productId} |
| cartApi.removeItem | DELETE | /api/v1/cart/items/{productId} |
| cartApi.clear | DELETE | /api/v1/cart |
| cartApi.applyCoupon | POST | /api/v1/cart/coupon |
| cartApi.removeCoupon | DELETE | /api/v1/cart/coupon |

**Orders:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| ordersApi.create | POST | /api/v1/orders |
| ordersApi.list | GET | /api/v1/orders |
| ordersApi.get | GET | /api/v1/orders/{id} |
| ordersApi.cancel | POST | /api/v1/orders/{id}/cancel |
| ordersApi.track | GET | /api/v1/orders/{id}/tracking |

**Addresses:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| addressesApi.list | GET | /api/v1/addresses |
| addressesApi.get | GET | /api/v1/addresses/{id} |
| addressesApi.create | POST | /api/v1/addresses |
| addressesApi.update | PATCH | /api/v1/addresses/{id} |
| addressesApi.delete | DELETE | /api/v1/addresses/{id} |
| addressesApi.setDefault | PATCH | /api/v1/addresses/{id} |

**Wishlist:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| wishlistApi.get | GET | /api/v1/wishlist |
| wishlistApi.add | POST | /api/v1/wishlist/items |
| wishlistApi.remove | DELETE | /api/v1/wishlist/items/{productId} |
| wishlistApi.check | GET | /api/v1/wishlist/check/{productId} |

**Reviews:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| reviewsApi.list | GET | /api/v1/products/{id}/reviews |
| reviewsApi.create | POST | /api/v1/reviews |
| reviewsApi.update | N/A | Not supported by current backend |
| reviewsApi.delete | DELETE | /api/v1/reviews/{id} |

**Payment:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| paymentApi.getConfig | GET | /api/v1/payments/config |
| paymentApi.createOrder | POST | /api/v1/payments/razorpay/create-order |
| paymentApi.verify | POST | /api/v1/payments/razorpay/verify |
| paymentApi.getMethods | GET | /api/v1/payments/methods |

**Returns:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| returnsApi.create | POST | /api/v1/returns |
| returnsApi.list | GET | /api/v1/returns |
| returnsApi.get | GET | /api/v1/returns/{id} |
| returnsApi.cancel | POST | /api/v1/returns/{id}/cancel |

### 3.4 adminApi.js - Admin APIs

**File:** `frontend_new/lib/adminApi.js`

**Dashboard:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| dashboardApi.getOverview | GET | /api/v1/admin/dashboard/overview |
| dashboardApi.getRevenueAnalytics | GET | /api/v1/admin/analytics/revenue |
| dashboardApi.getCustomerAnalytics | GET | /api/v1/admin/analytics/customers |
| dashboardApi.getTopProducts | GET | /api/v1/admin/analytics/products/top-selling |
| dashboardApi.getProductPerformance | GET | /api/v1/admin/analytics/products/performance |

**Orders (Admin):**
| Function | HTTP | Endpoint |
|----------|------|----------|
| ordersApi.list | GET | /api/v1/admin/orders |
| ordersApi.get | GET | /api/v1/admin/orders/{id} |
| ordersApi.updateStatus | PATCH | /api/v1/admin/orders/{id}/status |
| ordersApi.bulkUpdate | PATCH | /api/v1/admin/orders/bulk-status |
| ordersApi.getTracking | GET | /api/v1/admin/orders/{id}/tracking |

**Products (Admin):**
| Function | HTTP | Endpoint |
|----------|------|----------|
| productsApi.list | GET | /api/v1/admin/products |
| productsApi.get | GET | /api/v1/products/{id} |
| productsApi.create | POST | /api/v1/admin/products |
| productsApi.update | PATCH | /api/v1/admin/products/{id} |
| productsApi.delete | DELETE | /api/v1/admin/products/{id} |
| productsApi.uploadImage | POST | /api/v1/admin/products/{id}/images |
| productsApi.deleteImage | DELETE | /api/v1/admin/products/{id}/images/{imageId} |
| productsApi.getVariants | GET | /api/v1/admin/products/{id}/variants |
| productsApi.createVariant | POST | /api/v1/admin/products/{id}/variants |
| productsApi.updateVariant | PATCH | /api/v1/admin/products/{id}/variants/{variantId} |
| productsApi.deleteVariant | DELETE | /api/v1/admin/products/{id}/variants/{variantId} |
| productsApi.adjustVariantStock | POST | /api/v1/admin/products/{id}/variants/{variantId}/adjust-stock |
| productsApi.bulkPrice | POST | /api/v1/admin/products/bulk/price |
| productsApi.bulkStatus | POST | /api/v1/admin/products/bulk/status |
| productsApi.bulkAssignCollection | POST | /api/v1/admin/products/bulk/collection |
| productsApi.bulkInventory | POST | /api/v1/admin/products/bulk/inventory |
| productsApi.bulkDelete | POST | /api/v1/admin/products/bulk/delete |

**Collections:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| collectionsApi.list | GET | /api/v1/admin/collections |
| collectionsApi.create | POST | /api/v1/admin/collections |
| collectionsApi.update | PATCH | /api/v1/admin/collections/{id} |
| collectionsApi.delete | DELETE | /api/v1/admin/collections/{id} |
| collectionsApi.uploadImage | POST | /api/v1/admin/categories/{id}/image |
| collectionsApi.bulkStatus | POST | /api/v1/admin/collections/bulk/status |
| collectionsApi.bulkReorder | POST | /api/v1/admin/collections/bulk/reorder |

**Inventory:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| inventoryApi.list | GET | /api/v1/admin/inventory |
| inventoryApi.getLowStock | GET | /api/v1/admin/inventory/low-stock |
| inventoryApi.getOutOfStock | GET | /api/v1/admin/inventory/out-of-stock |
| inventoryApi.create | POST | /api/v1/admin/inventory |
| inventoryApi.update | PATCH | /api/v1/admin/inventory/{id} |
| inventoryApi.adjustStock | POST | /api/v1/admin/inventory/adjust |
| inventoryApi.getMovements | GET | /api/v1/admin/inventory/movements |

**Chat:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| chatApi.getRooms | GET | /api/v1/admin/chat/rooms |
| chatApi.getMessages | GET | /api/v1/admin/chat/rooms/{id}/messages |
| chatApi.sendMessage | POST | /api/v1/admin/chat/rooms/{id}/messages |
| chatApi.assignRoom | PUT | /api/v1/admin/chat/rooms/{id}/assign |
| chatApi.closeRoom | PUT | /api/v1/admin/chat/rooms/{id}/close |

**Landing:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| landingApi.getConfig | GET | /api/v1/admin/landing/config |
| landingApi.updateSection | PUT | /api/v1/admin/landing/config/{section} |
| landingApi.getImages | GET | /api/v1/admin/landing/images |
| landingApi.addImage | POST | /api/v1/admin/landing/images |
| landingApi.uploadImage | POST | /api/v1/admin/landing/images/upload |
| landingApi.updateImage | PATCH | /api/v1/admin/landing/images/{id} |
| landingApi.deleteImage | DELETE | /api/v1/admin/landing/images/{id} |
| landingApi.getLandingProducts | GET | /api/v1/admin/landing/products |
| landingApi.addLandingProduct | POST | /api/v1/admin/landing/products |
| landingApi.updateLandingProduct | PATCH | /api/v1/admin/landing/products/{id} |
| landingApi.deleteLandingProduct | DELETE | /api/v1/admin/landing/products/{id} |

**Site Config:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| siteConfigApi.getConfig | GET | /api/v1/admin/site/config |
| siteConfigApi.updateConfig | PUT | /api/v1/admin/site/config |

**Staff:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| staffApi.getDashboard | GET | /api/v1/staff/dashboard |
| staffApi.getPendingOrders | GET | /api/v1/staff/orders/pending |
| staffApi.getProcessingOrders | GET | /api/v1/staff/orders/processing |
| staffApi.processOrder | PUT | /api/v1/staff/orders/{id}/process |
| staffApi.shipOrder | PUT | /api/v1/staff/orders/{id}/ship |
| staffApi.bulkProcessOrders | POST | /api/v1/staff/orders/bulk-process |
| staffApi.getTasks | GET | /api/v1/staff/tasks |
| staffApi.completeTask | POST | /api/v1/staff/tasks/{id}/complete |
| staffApi.getNotifications | GET | /api/v1/staff/notifications |
| staffApi.getQuickActions | GET | /api/v1/staff/quick-actions |
| staffApi.getInventorySummary | GET | /api/v1/staff/reports/inventory/summary |
| staffApi.getProcessedOrdersReport | GET | /api/v1/staff/reports/orders/processed |

**Returns (Admin):**
| Function | HTTP | Endpoint |
|----------|------|----------|
| returnsApi.list | GET | /api/v1/admin/returns |
| returnsApi.get | GET | /api/v1/admin/returns/{id} |
| returnsApi.updateStatus | POST | Status-specific admin return action endpoint |
| returnsApi.approve | POST | /api/v1/admin/returns/{id}/approve |
| returnsApi.reject | POST | /api/v1/admin/returns/{id}/reject |
| returnsApi.markReceived | POST | /api/v1/admin/returns/{id}/receive |
| returnsApi.processRefund | POST | /api/v1/admin/returns/{id}/refund |

**Users (Admin):**
| Function | HTTP | Endpoint |
|----------|------|----------|
| usersApi.list | GET | /api/v1/admin/users |
| usersApi.get | GET | /api/v1/admin/users/{id} |
| usersApi.updateStatus | PUT | /api/v1/admin/users/{id}/status |

---

## 4. Frontend State Management

### 4.1 AuthContext

**File:** `frontend_new/lib/authContext.js`

Provides authentication state across the app.

**Context Value:**
```javascript
{
  user,              // User object or null
  loading,           // Boolean - initial load state
  isAuthenticated,  // Boolean - login status
  authError,         // Error message string
  login(credentials),
  logout(),
  checkAuth(),
  updateUser(userData),
  hasRole(role),
  isAdmin(),
  isStaff()
}
```

**Usage:**
```javascript
import { useAuth } from '@/lib/authContext';
const { user, isAuthenticated, login, logout } = useAuth();
```

### 4.2 CartContext

**File:** `frontend_new/lib/cartContext.js`

Provides cart state management with backend sync.

**Context Value:**
```javascript
{
  cart,              // Cart object
  loading,           // Boolean
  error,             // Error string
  isOpen,           // Cart drawer state
  itemCount,        // Total items
  isAuthenticated,
  addItem(productId, quantity, variant),
  updateQuantity(productId, quantity, variantId),
  removeItem(productId, variantId),
  clearCart(),
  applyCoupon(code),
  removeCoupon(),
  openCart(),
  closeCart(),
  toggleCart(),
  refreshCart(),
  clearError()
}
```

**Usage:**
```javascript
import { useCart } from '@/lib/cartContext';
const { cart, addItem, removeItem } = useCart();
```

### 4.3 SiteConfigContext

**File:** `frontend_new/lib/siteConfigContext.js`

Provides global site configuration.

**Context Value:**
```javascript
{
  config,           // Site configuration object
  logoUrl,         // Current logo URL
  loading,         // Boolean
  refreshConfig()  // Function to refresh config
}
```

---

## 5. Frontend Routes

### 5.1 Public Routes (No Auth Required)

| Route | Page File | Description |
|-------|-----------|-------------|
| `/` | app/page.js | Homepage |
| `/about` | app/about/page.js | About page |
| `/products` | app/products/page.js | Product listing |
| `/products/[id]` | app/products/[id]/page.js | Product detail |
| `/collections/[slug]` | app/collections/[slug]/page.js | Collection page |
| `/new-arrivals` | app/new-arrivals/page.js | New arrivals |

### 5.2 Auth Routes (Redirect if Logged In)

| Route | Page File |
|-------|-----------|
| `/auth/login` | app/auth/login/page.js |
| `/auth/register` | app/auth/register/page.js |
| `/auth/forgot-password` | app/auth/forgot-password/page.js |
| `/auth/reset-password` | app/auth/reset-password/page.js |
| `/auth/change-password` | app/auth/change-password/page.js |
| `/auth/verify-email` | app/auth/verify-email/page.js |
| `/auth/check-email` | app/auth/check-email/page.js |

### 5.3 Protected Routes (Requires Login)

| Route | Page File |
|-------|-----------|
| `/cart` | app/cart/page.js |
| `/checkout` | app/checkout/page.js |
| `/checkout/payment` | app/checkout/payment/page.js |
| `/checkout/confirm` | app/checkout/confirm/page.js |
| `/profile` | app/profile/page.js |
| `/profile/orders` | app/profile/orders/page.js |
| `/profile/addresses` | app/profile/addresses/page.js |
| `/profile/wishlist` | app/profile/wishlist/page.js |
| `/profile/returns` | app/profile/returns/page.js |
| `/profile/returns/[id]` | app/profile/returns/[id]/page.js |
| `/profile/returns/create` | app/profile/returns/create/page.js |
| `/profile/settings` | app/profile/settings/page.js |

### 5.4 Admin Routes (Requires Admin/Staff Role)

| Route | Page File |
|-------|-----------|
| `/admin` | app/admin/page.js |
| `/admin/analytics` | app/admin/analytics/page.js |
| `/admin/chat` | app/admin/chat/page.js |
| `/admin/collections` | app/admin/collections/page.js |
| `/admin/customers` | app/admin/customers/page.js |
| `/admin/inventory` | app/admin/inventory/page.js |
| `/admin/landing` | app/admin/landing/page.js |
| `/admin/orders` | app/admin/orders/page.js |
| `/admin/orders/[id]` | app/admin/orders/[id]/page.js |
| `/admin/products` | app/admin/products/page.js |
| `/admin/products/create` | app/admin/products/create/page.js |
| `/admin/returns` | app/admin/returns/page.js |
| `/admin/returns/[id]` | app/admin/returns/[id]/page.js |
| `/admin/settings` | app/admin/settings/page.js |

---

# PART 2: BACKEND MICROSERVICES

## 6. Backend Services Overview

The backend consists of 4 FastAPI microservices:

| Service | Port | Purpose |
|---------|------|---------|
| Core | 5001 | Authentication, User Management |
| Commerce | 5002 | Products, Cart, Orders, Inventory |
| Payment | 5003 | Razorpay Integration |
| Admin | 5004 | Dashboard, CMS, Chat |

---

## 7. Core Service (Port 5001)

**Location:** `services/core/`

### 7.1 Directory Structure

```
services/core/
├── main.py                  # FastAPI app entry point
├── requirements.txt
├── Dockerfile
├── README.md
├── exception_handler.py     # Exception handling
├── api/
│   └── __init__.py
├── core/
│   ├── __init__.py
│   ├── config.py           # Settings
│   └── redis_client.py     # Redis connection
├── middleware/
│   ├── auth_middleware.py  # JWT validation
│   └── csrf_middleware.py  # CSRF protection
├── models/
│   ├── __init__.py
│   ├── user.py             # User model
│   ├── user_profile.py     # Profile model
│   ├── user_security.py    # Security model
│   ├── email_verification.py # Email verification
│   └── otp.py              # OTP model
├── schemas/
│   ├── __init__.py
│   ├── auth.py             # Auth schemas
│   └── otp.py              # OTP schemas
└── service/
    ├── __init__.py
    ├── auth_service.py     # Auth logic
    ├── email_service.py    # Email sending
    ├── otp_service.py      # OTP handling
    └── whatsapp_service.py # WhatsApp notifications
```

### 7.2 Core Service API Endpoints

```
# Authentication
POST   /api/v1/auth/login              - User login
POST   /api/v1/auth/register          - User registration
POST   /api/v1/auth/logout            - User logout
POST   /api/v1/auth/refresh           - Refresh token
POST   /api/v1/auth/send-otp           - Send OTP
POST   /api/v1/auth/verify-otp        - Verify OTP
POST   /api/v1/auth/forgot-password    - Request password reset
POST   /api/v1/auth/reset-password     - Reset password
POST   /api/v1/auth/verify-email       - Verify email

# Users
GET    /api/v1/users/me                - Get current user
PUT    /api/v1/users/me                - Update profile
PUT    /api/v1/users/me/password       - Change password

# Health
GET    /health                         - Health check
```

### 7.3 Core Service Database Tables

**users**
- id (SERIAL, PK)
- email (VARCHAR 255, UNIQUE)
- username (VARCHAR 50, UNIQUE)
- hashed_password (VARCHAR 255)
- role (ENUM: admin, staff, customer)
- is_active (BOOLEAN)
- email_verified (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**user_profiles**
- user_id (INTEGER, FK -> users.id, PK)
- full_name (VARCHAR 100)
- phone (VARCHAR 20)
- avatar_url (VARCHAR 500)
- bio (TEXT)
- date_of_birth (DATE)
- gender (VARCHAR 20)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**user_security**
- user_id (INTEGER, FK -> users.id, PK)
- failed_login_attempts (INTEGER)
- locked_until (TIMESTAMP)
- last_login_at (TIMESTAMP)
- last_login_ip (VARCHAR 45)
- password_history (JSONB)
- last_password_change (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**email_verifications**
- id (SERIAL, PK)
- user_id (INTEGER, FK -> users.id)
- token (VARCHAR 255, UNIQUE)
- token_type (VARCHAR 20)
- expires_at (TIMESTAMP)
- verified_at (TIMESTAMP)
- ip_address (VARCHAR 45)
- created_at (TIMESTAMP)

**otps**
- id (SERIAL, PK)
- otp_code (VARCHAR 10)
- user_id (INTEGER, FK -> users.id)
- email (VARCHAR 255)
- phone (VARCHAR 20)
- otp_type (VARCHAR 20)
- purpose (VARCHAR 50)
- is_used (BOOLEAN)
- attempts (INTEGER)
- max_attempts (INTEGER)
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- used_at (TIMESTAMP)
- ip_address (VARCHAR 45)
- user_agent (TEXT)

---

## 8. Commerce Service (Port 5002)

**Location:** `services/commerce/`

### 8.1 Directory Structure

```
services/commerce/
├── main.py                  # FastAPI app entry point
├── requirements.txt
├── Dockerfile
├── MIGRATION.md
├── README.md
├── exception_handler.py     # Exception handling
├── core/
│   ├── cart_lock.py        # Cart concurrency
│   └── config.py          # Settings
├── database/
│   ├── __init__.py
│   └── database.py         # DB connection
├── middleware/
│   └── __init__.py
├── models/
│   ├── __init__.py
│   ├── address.py         # Address model
│   ├── audit_log.py       # Audit log model
│   ├── category.py        # Category model
│   ├── inventory.py       # Inventory model
│   ├── order.py           # Order model
│   ├── order_tracking.py  # Tracking model
│   ├── product.py         # Product model
│   ├── product_image.py   # Image model
│   ├── promotion.py       # Promotion model
│   ├── return_request.py  # Return model
│   ├── review.py          # Review model
│   └── wishlist.py        # Wishlist model
├── schemas/
│   ├── __init__.py
│   ├── address.py
│   ├── category.py
│   ├── error.py
│   ├── inventory.py
│   ├── order.py
│   ├── order_tracking.py
│   ├── product.py
│   ├── product_image.py
│   ├── promotion.py
│   ├── return_request.py
│   ├── review.py
│   └── wishlist.py
├── search/
│   ├── __init__.py
│   └── meilisearch_client.py
└── service/
    ├── __init__.py
    ├── address_service.py
    ├── admin_analytics_service.py
    ├── admin_customer_service.py
    ├── cart_service.py
    ├── category_service.py
    ├── inventory_service.py
    ├── order_service.py
    ├── order_tracking_service.py
    ├── product_service.py
    ├── promotion_service.py
    ├── r2_service.py
    ├── return_service.py
    ├── review_service.py
    └── wishlist_service.py
```

### 8.2 Commerce Service API Endpoints

```
# Products
GET    /api/v1/products                    - List products
GET    /api/v1/products/{id}              - Get product
GET    /api/v1/products/slug/{slug}       - Get by slug
GET    /api/v1/products/featured           - Featured products
GET    /api/v1/products/new-arrivals      - New arrivals
GET    /api/v1/products/search            - Search products
POST   /api/v1/products/{id}/reviews      - Create review

# Categories/Collections
GET    /api/v1/categories                  - List categories
GET    /api/v1/collections                 - List collections
GET    /api/v1/categories/tree            - Category tree
GET    /api/v1/categories/{id}           - Get category
GET    /api/v1/categories/slug/{slug}    - Get by slug

# Cart
GET    /api/v1/cart                        - Get cart
POST   /api/v1/cart/items                 - Add item
PUT    /api/v1/cart/items/{productId}    - Update item
DELETE /api/v1/cart/items/{productId}    - Remove item
DELETE /api/v1/cart                       - Clear cart
POST   /api/v1/cart/coupon               - Apply coupon
DELETE /api/v1/cart/coupon               - Remove coupon

# Orders
POST   /api/v1/orders                     - Create order
GET    /api/v1/orders                     - List orders
GET    /api/v1/orders/{id}               - Get order
POST   /api/v1/orders/{id}/cancel        - Cancel order
GET    /api/v1/orders/{id}/tracking      - Track order

# Addresses
GET    /api/v1/addresses                   - List addresses
POST   /api/v1/addresses                   - Create address
GET    /api/v1/addresses/{id}            - Get address
PUT    /api/v1/addresses/{id}            - Update address
DELETE /api/v1/addresses/{id}            - Delete address
PUT    /api/v1/addresses/{id}/default    - Set default

# Wishlist
GET    /api/v1/wishlist                   - Get wishlist
POST   /api/v1/wishlist/items            - Add item
DELETE /api/v1/wishlist/items/{productId} - Remove item
GET    /api/v1/wishlist/check/{productId} - Check if wishlisted

# Returns
POST   /api/v1/returns                    - Create return
GET    /api/v1/returns                    - List returns
GET    /api/v1/returns/{id}              - Get return
POST   /api/v1/returns/{id}/cancel       - Cancel return

# Promotions
POST   /api/v1/promotions/validate       - Validate coupon
```

### 8.3 Commerce Service Database Tables

**collections** (also view as "categories")
- id (SERIAL, PK)
- name (VARCHAR 100)
- slug (VARCHAR 100, UNIQUE)
- description (TEXT)
- image_url (VARCHAR 500)
- is_active (BOOLEAN)
- is_featured (BOOLEAN)
- display_order (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**products**
- id (SERIAL, PK)
- name (VARCHAR 255)
- slug (VARCHAR 255, UNIQUE)
- description (TEXT)
- short_description (VARCHAR 500)
- base_price (DECIMAL 10,2)
- mrp (DECIMAL 10,2)
- category_id (INTEGER, FK -> collections.id)
- brand (VARCHAR 100)
- average_rating (DECIMAL 3,2)
- review_count (INTEGER)
- total_stock (INTEGER)
- is_active (BOOLEAN)
- is_featured (BOOLEAN)
- is_new_arrival (BOOLEAN)
- meta_title (VARCHAR 255)
- meta_description (VARCHAR 500)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**product_images**
- id (SERIAL, PK)
- product_id (INTEGER, FK -> products.id)
- image_url (VARCHAR 500)
- alt_text (VARCHAR 255)
- is_primary (BOOLEAN)
- display_order (INTEGER)
- created_at (TIMESTAMP)

**inventory** (also view as "product_variants")
- id (SERIAL, PK)
- product_id (INTEGER, FK -> products.id)
- sku (VARCHAR 100)
- size (VARCHAR 50)
- color (VARCHAR 50)
- quantity (INTEGER)
- reserved_quantity (INTEGER)
- low_stock_threshold (INTEGER)
- cost_price (DECIMAL 10,2)
- variant_price (DECIMAL 10,2)
- description (TEXT)
- weight (DECIMAL 10,3)
- location (VARCHAR 100)
- barcode (VARCHAR 100)
- image_url (VARCHAR 500)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**addresses**
- id (SERIAL, PK)
- user_id (INTEGER)
- address_type (ENUM: shipping, billing, both)
- full_name (VARCHAR 100)
- phone (VARCHAR 20)
- email (VARCHAR 255)
- address_line1 (VARCHAR 255)
- address_line2 (VARCHAR 255)
- city (VARCHAR 100)
- state (VARCHAR 100)
- postal_code (VARCHAR 20)
- country (VARCHAR 100)
- landmark (VARCHAR 255)
- is_default (BOOLEAN)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**orders**
- id (SERIAL, PK)
- user_id (INTEGER, FK -> users.id)
- subtotal (DECIMAL 10,2)
- discount_applied (DECIMAL 10,2)
- promo_code (VARCHAR 50)
- shipping_cost (DECIMAL 10,2)
- total_amount (DECIMAL 10,2)
- payment_method (VARCHAR 50)
- status (ENUM: pending, confirmed, processing, shipped, delivered, cancelled, returned, refunded)
- shipping_address_id (INTEGER, FK -> addresses.id)
- shipping_address (TEXT)
- billing_address_id (INTEGER, FK -> addresses.id)
- shipping_method (VARCHAR 50)
- tracking_number (VARCHAR 100)
- order_notes (TEXT)
- transaction_id (VARCHAR 255)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- cancelled_at (TIMESTAMP)
- cancellation_reason (TEXT)
- shipped_at (TIMESTAMP)
- delivered_at (TIMESTAMP)

**order_items**
- id (SERIAL, PK)
- order_id (INTEGER, FK -> orders.id)
- inventory_id (INTEGER, FK -> inventory.id)
- product_id (INTEGER)
- product_name (VARCHAR 255)
- sku (VARCHAR 100)
- size (VARCHAR 50)
- color (VARCHAR 50)
- quantity (INTEGER)
- unit_price (DECIMAL 10,2)
- price (DECIMAL 10,2)
- created_at (TIMESTAMP)

**order_tracking**
- id (SERIAL, PK)
- order_id (INTEGER, FK -> orders.id)
- status (ENUM: pending, confirmed, processing, shipped, delivered, cancelled, returned, refunded)
- notes (TEXT)
- location (VARCHAR 255)
- updated_by (INTEGER)
- created_at (TIMESTAMP)

**wishlist**
- id (SERIAL, PK)
- user_id (INTEGER)
- product_id (INTEGER, FK -> products.id)
- added_at (TIMESTAMP)
- created_at (TIMESTAMP)

**reviews**
- id (SERIAL, PK)
- product_id (INTEGER, FK -> products.id)
- user_id (INTEGER)
- rating (INTEGER, 1-5)
- title (VARCHAR 255)
- review_text (TEXT)
- is_verified_purchase (BOOLEAN)
- is_approved (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**promotions**
- id (SERIAL, PK)
- code (VARCHAR 50, UNIQUE)
- description (TEXT)
- discount_type (ENUM: percentage, fixed)
- discount_value (DECIMAL 10,2)
- min_order_amount (DECIMAL 10,2)
- max_discount_amount (DECIMAL 10,2)
- max_uses (INTEGER)
- used_count (INTEGER)
- max_uses_per_user (INTEGER)
- is_active (BOOLEAN)
- starts_at (TIMESTAMP)
- expires_at (TIMESTAMP)
- applicable_categories (TEXT)
- applicable_products (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**promotion_usage**
- id (SERIAL, PK)
- promotion_id (INTEGER, FK -> promotions.id)
- user_id (INTEGER)
- order_id (INTEGER, FK -> orders.id)
- discount_amount (DECIMAL 10,2)
- used_at (TIMESTAMP)

**return_requests**
- id (SERIAL, PK)
- order_id (INTEGER, FK -> orders.id)
- user_id (INTEGER)
- reason (ENUM: defective, wrong_item, not_as_described, size_issue, changed_mind, other)
- description (TEXT)
- status (ENUM: requested, approved, rejected, received, refunded, completed)
- refund_amount (DECIMAL 10,2)
- refund_transaction_id (VARCHAR 255)
- approved_by (INTEGER)
- rejection_reason (TEXT)
- return_tracking_number (VARCHAR 100)
- is_item_received (BOOLEAN)
- requested_at (TIMESTAMP)
- approved_at (TIMESTAMP)
- received_at (TIMESTAMP)
- refunded_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**audit_logs**
- id (SERIAL, PK)
- entity_type (VARCHAR 50)
- entity_id (INTEGER)
- action (VARCHAR 50)
- user_id (INTEGER)
- changes (JSONB)
- ip_address (VARCHAR 45)
- created_at (TIMESTAMP)

**brands**
- id (SERIAL, PK)
- name (VARCHAR 100, UNIQUE)
- slug (VARCHAR 100, UNIQUE)
- description (TEXT)
- logo_url (VARCHAR 500)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**notifications**
- id (SERIAL, PK)
- user_id (INTEGER, FK -> users.id)
- type (VARCHAR 50)
- title (VARCHAR 255)
- message (TEXT)
- data (JSONB)
- is_read (BOOLEAN)
- created_at (TIMESTAMP)

**sessions**
- id (SERIAL, PK)
- user_id (INTEGER, FK -> users.id)
- session_token (VARCHAR 255, UNIQUE)
- expires_at (TIMESTAMP)
- ip_address (VARCHAR 45)
- user_agent (TEXT)
- created_at (TIMESTAMP)

---

## 9. Payment Service (Port 5003)

**Location:** `services/payment/`

### 9.1 Directory Structure

```
services/payment/
├── main.py                  # FastAPI app entry point
├── requirements.txt
├── Dockerfile
├── README.md
├── service/
│   ├── __init__.py
│   └── payment_service.py  # Payment logic
```

### 9.2 Payment Service API Endpoints

```
GET    /api/v1/payments/config               - Get payment config
GET    /api/v1/payments/methods             - Get payment methods
POST   /api/v1/payments/razorpay/create-order  - Create payment order
POST   /api/v1/payments/razorpay/verify     - Verify payment
POST   /api/v1/payments/razorpay/refund     - Process refund

POST   /api/v1/webhooks/razorpay           - Razorpay webhook
```

### 9.3 Payment Service Database Tables

**payment_transactions**
- id (SERIAL, PK)
- order_id (INTEGER)
- user_id (INTEGER)
- razorpay_order_id (VARCHAR 255)
- razorpay_payment_id (VARCHAR 255)
- razorpay_signature (VARCHAR 500)
- amount (DECIMAL 10,2)
- currency (VARCHAR 10)
- status (VARCHAR 50)
- payment_method (VARCHAR 50)
- error_code (VARCHAR 100)
- error_description (TEXT)
- refund_id (VARCHAR 255)
- refund_amount (DECIMAL 10,2)
- refund_status (VARCHAR 50)
- metadata (JSONB)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**payment_methods**
- id (SERIAL, PK)
- name (VARCHAR 50)
- display_name (VARCHAR 100)
- is_active (BOOLEAN)
- config (JSONB)
- created_at (TIMESTAMP)

**webhook_events**
- id (SERIAL, PK)
- event_id (VARCHAR 255, UNIQUE)
- event_type (VARCHAR 100)
- payload (JSONB)
- status (VARCHAR 50)
- processed_at (TIMESTAMP)
- error_message (TEXT)
- retry_count (INTEGER)
- created_at (TIMESTAMP)

---

## 10. Admin Service (Port 5004)

**Location:** `services/admin/`

### 10.1 Directory Structure

```
services/admin/
├── main.py                  # FastAPI app entry point
├── requirements.txt
├── Dockerfile
├── core/
│   ├── __init__.py
│   ├── cache_lock.py       # Cache locking
│   ├── config.py           # Settings
│   ├── exception_handler.py # Exception handling
│   ├── redis_client.py     # Redis connection
│   └── validation.py       # Input validation
├── database/
│   ├── __init__.py
│   └── database.py         # DB connection
├── middleware/
│   └── __init__.py
├── models/
│   ├── __init__.py
│   ├── analytics.py        # Analytics models
│   ├── chat.py             # Chat models
│   ├── landing_config.py   # Landing config models
│   └── shared.py           # Shared models
├── schemas/
│   ├── __init__.py
│   └── admin.py            # Admin schemas
└── service/
    ├── __init__.py
    └── r2_service.py       # R2 upload service
```

### 10.2 Admin Service API Endpoints

```
# Dashboard
GET    /api/v1/admin/dashboard/overview      - Dashboard overview
GET    /api/v1/admin/analytics/revenue        - Revenue analytics
GET    /api/v1/admin/analytics/customers      - Customer analytics
GET    /api/v1/admin/analytics/products/top-selling  - Top products
GET    /api/v1/admin/analytics/products/performance   - Product performance

# Products (Admin)
GET    /api/v1/admin/products                 - List products
POST   /api/v1/admin/products                 - Create product
PATCH  /api/v1/admin/products/{id}            - Update product
DELETE /api/v1/admin/products/{id}            - Delete product
POST   /api/v1/admin/products/{id}/images     - Upload image
DELETE /api/v1/admin/products/{id}/images/{imageId} - Delete image
POST   /api/v1/admin/products/{id}/variants   - Create variant
PATCH  /api/v1/admin/products/{id}/variants/{variantId} - Update variant
DELETE /api/v1/admin/products/{id}/variants/{variantId} - Delete variant
POST   /api/v1/admin/products/{id}/variants/{variantId}/adjust-stock - Adjust stock
POST   /api/v1/admin/products/bulk/price      - Bulk price update
POST   /api/v1/admin/products/bulk/status      - Bulk status update
POST   /api/v1/admin/products/bulk/collection - Bulk assign collection
POST   /api/v1/admin/products/bulk/inventory   - Bulk inventory update
POST   /api/v1/admin/products/bulk/delete      - Bulk delete

# Orders (Admin)
GET    /api/v1/admin/orders                   - List orders
GET    /api/v1/admin/orders/{id}              - Get order
PUT    /api/v1/admin/orders/{id}/status       - Update status
POST   /api/v1/admin/orders/bulk-update       - Bulk update

# Users (Admin)
GET    /api/v1/admin/users                     - List users
GET    /api/v1/admin/users/{id}               - Get user
PUT    /api/v1/admin/users/{id}/status         - Update status

# Collections (Admin)
POST   /api/v1/admin/collections               - Create collection
PATCH  /api/v1/admin/collections/{id}         - Update collection
DELETE /api/v1/admin/collections/{id}         - Delete collection
POST   /api/v1/admin/collections/bulk/status  - Bulk status
POST   /api/v1/admin/collections/bulk/reorder  - Bulk reorder

# Inventory (Admin)
GET    /api/v1/admin/inventory                 - List inventory
GET    /api/v1/admin/inventory/low-stock      - Low stock items

# Landing CMS
GET    /api/v1/admin/landing/config            - Get config
PUT    /api/v1/admin/landing/config/{section} - Update section
GET    /api/v1/admin/landing/images            - List images
POST   /api/v1/admin/landing/images            - Add image
PATCH  /api/v1/admin/landing/images/{id}      - Update image
DELETE /api/v1/admin/landing/images/{id}       - Delete image
GET    /api/v1/admin/landing/products          - Landing products
POST   /api/v1/admin/landing/products         - Add landing product
PATCH  /api/v1/admin/landing/products/{id}   - Update landing product
DELETE /api/v1/admin/landing/products/{id}   - Delete landing product

# Site Config
GET    /api/v1/admin/site/config              - Get site config
PUT    /api/v1/admin/site/config              - Update site config

# Chat
GET    /api/v1/admin/chat/rooms               - List chat rooms
GET    /api/v1/admin/chat/rooms/{id}/messages - Get messages
POST   /api/v1/admin/chat/rooms/{id}/messages - Send message
PUT    /api/v1/admin/chat/rooms/{id}/assign   - Assign room
PUT    /api/v1/admin/chat/rooms/{id}/close     - Close room

# Returns (Admin)
GET    /api/v1/admin/returns                  - List returns
POST   /api/v1/admin/returns/{id}/approve     - Approve return
POST   /api/v1/admin/returns/{id}/reject      - Reject return
POST   /api/v1/admin/returns/{id}/receive      - Mark received
POST   /api/v1/admin/returns/{id}/refund      - Process refund

# Staff
GET    /api/v1/staff/dashboard               - Staff dashboard
GET    /api/v1/staff/orders/pending         - Pending orders
GET    /api/v1/staff/orders/processing       - Processing orders
PUT    /api/v1/staff/orders/{id}/process    - Process order
PUT    /api/v1/staff/orders/{id}/ship        - Ship order
POST   /api/v1/staff/orders/bulk-process     - Bulk process
GET    /api/v1/staff/tasks                   - Get tasks
POST   /api/v1/staff/tasks/{id}/complete     - Complete task
GET    /api/v1/staff/notifications           - Get notifications
GET    /api/v1/staff/quick-actions           - Quick actions
GET    /api/v1/staff/reports/inventory/summary - Inventory summary
GET    /api/v1/staff/reports/orders/processed - Processed orders

# Landing (Public)
GET    /api/v1/landing/all                   - Get all landing data
GET    /api/v1/site/config                    - Public site config
```

### 10.3 Admin Service Database Tables

**chat_rooms**
- id (SERIAL, PK)
- customer_id (INTEGER)
- customer_name (VARCHAR 100)
- customer_email (VARCHAR 255)
- assigned_to (INTEGER)
- subject (VARCHAR 255)
- status (ENUM: open, assigned, resolved, closed)
- priority (VARCHAR 20)
- order_id (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- closed_at (TIMESTAMP)

**chat_messages**
- id (SERIAL, PK)
- room_id (INTEGER, FK -> chat_rooms.id)
- sender_id (INTEGER)
- sender_type (ENUM: customer, staff, admin, system)
- message (TEXT)
- is_read (BOOLEAN)
- created_at (TIMESTAMP)

**landing_config**
- id (SERIAL, PK)
- section (VARCHAR 100, UNIQUE)
- config (JSONB)
- is_active (BOOLEAN)
- updated_by (INTEGER)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**landing_images**
- id (SERIAL, PK)
- section (VARCHAR 100)
- image_url (VARCHAR 500)
- title (VARCHAR 255)
- subtitle (VARCHAR 255)
- link_url (VARCHAR 500)
- display_order (INTEGER)
- device_variant (VARCHAR 20)
- is_active (BOOLEAN)
- created_at (TIMESTAMP)

**analytics_cache**
- id (SERIAL, PK)
- cache_key (VARCHAR 255, UNIQUE)
- data (JSONB)
- period_start (TIMESTAMP)
- period_end (TIMESTAMP)
- created_at (TIMESTAMP)
- expires_at (TIMESTAMP)

**staff_tasks**
- id (SERIAL, PK)
- assigned_to (INTEGER)
- task_type (VARCHAR 50)
- title (VARCHAR 255)
- description (TEXT)
- priority (VARCHAR 20)
- status (VARCHAR 20)
- due_time (TIMESTAMP)
- completed_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)

**staff_notifications**
- id (SERIAL, PK)
- user_id (INTEGER)
- notification_type (VARCHAR 50)
- message (TEXT)
- data (JSONB)
- is_read (BOOLEAN)
- created_at (TIMESTAMP)

**inventory_movements**
- id (SERIAL, PK)
- inventory_id (INTEGER, FK -> inventory.id)
- product_id (INTEGER, FK -> products.id)
- adjustment (INTEGER)
- reason (VARCHAR 50)
- notes (TEXT)
- supplier (VARCHAR 255)
- cost_price (DECIMAL 10,2)
- performed_by (INTEGER)
- created_at (TIMESTAMP)

---

# PART 3: INFRASTRUCTURE

## 11. Docker Compose Configuration

### 11.1 Complete docker-compose.yml

**File:** `docker-compose.yml`

```yaml
# Aarya Clothing - Unified Docker Compose
# Single configuration for local development and testing

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
    networks:
      - backend_network
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: aarya_redis
    ports:
      - "6002:6379"
    volumes:
      - redis_data:/data
    networks:
      - backend_network
    restart: unless-stopped

  meilisearch:
    image: getmeili/meilisearch:v1.6
    container_name: aarya_meilisearch
    environment:
      - MEILI_MASTER_KEY=${MEILI_MASTER_KEY:-dev_master_key}
    ports:
      - "6003:7700"
    networks:
      - backend_network
    restart: unless-stopped

  # CORE SERVICE (Port 5001)
  core:
    build:
      context: .
      dockerfile: services/core/Dockerfile
    container_name: aarya_core
    environment:
      - SERVICE_NAME=core
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD:-postgres123}@postgres:5432/aarya_clothing
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=${SECRET_KEY:-dev_secret_key}
      - ACCESS_TOKEN_EXPIRE_MINUTES=30
      - REFRESH_TOKEN_EXPIRE_MINUTES=1440
    ports:
      - "5001:5001"
    networks:
      - backend_network
    restart: unless-stopped

  # COMMERCE SERVICE (Port 5002)
  commerce:
    build:
      context: .
      dockerfile: services/commerce/Dockerfile
    container_name: aarya_commerce
    environment:
      - SERVICE_NAME=commerce
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD:-postgres123}@postgres:5432/aarya_clothing
      - REDIS_URL=redis://redis:6379/1
      - CORE_SERVICE_URL=http://core:5001
      - MEILISEARCH_URL=http://meilisearch:7700
    ports:
      - "5002:5002"
    networks:
      - backend_network
    restart: unless-stopped

  # PAYMENT SERVICE (Port 5003)
  payment:
    build:
      context: .
      dockerfile: services/payment/Dockerfile
    container_name: aarya_payment
    environment:
      - SERVICE_NAME=payment
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD:-postgres123}@postgres:5432/aarya_clothing
      - REDIS_URL=redis://redis:6379/2
      - CORE_SERVICE_URL=http://core:5001
      - RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID:-}
      - RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET:-}
    ports:
      - "5003:5003"
    networks:
      - backend_network
    restart: unless-stopped

  # ADMIN SERVICE (Port 5004)
  admin:
    build:
      context: .
      dockerfile: services/admin/Dockerfile
    container_name: aarya_admin
    environment:
      - SERVICE_NAME=admin
      - DATABASE_URL=postgresql://postgres:${POSTGRES_PASSWORD:-postgres123}@postgres:5432/aarya_clothing
      - REDIS_URL=redis://redis:6379/3
      - CORE_SERVICE_URL=http://core:5001
      - COMMERCE_SERVICE_URL=http://commerce:5002
    ports:
      - "5004:5004"
    networks:
      - backend_network
    restart: unless-stopped

  # FRONTEND (Next.js - Port 6004)
  frontend:
    build:
      context: ./frontend_new
      dockerfile: Dockerfile
    container_name: aarya_frontend
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:6005
    ports:
      - "6004:3000"
    networks:
      - frontend_network
      - backend_network
    restart: unless-stopped

  # NGINX REVERSE PROXY (Port 6005)
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
    networks:
      - frontend_network
      - backend_network
    restart: unless-stopped

networks:
  frontend_network:
    driver: bridge
  backend_network:
    driver: bridge

volumes:
  postgres_data:
  redis_data:
  meilisearch_data:
```

### 11.2 Complete nginx.conf

**File:** `docker/nginx/nginx.conf` (483 lines - full config above)

Key sections:
- Worker connections: 1024
- Docker DNS resolver: 127.0.0.11
- Gzip compression enabled
- Rate limiting: api zone (10r/s), login zone (1r/s)
- Client max body size: 50M
- Security headers: X-Frame-Options, X-Content-Type-Options

Upstream definitions:
- frontend_upstream: frontend:3000
- core_upstream: core:5001
- commerce_upstream: commerce:5002
- payment_upstream: payment:5003
- admin_upstream: admin:5004

### 11.3 Port Mappings

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

### 11.2 Environment Variables

**Core Service:**
- DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/aarya_clothing
- REDIS_URL=redis://redis:6379/0
- SECRET_KEY=your_secret_key
- ACCESS_TOKEN_EXPIRE_MINUTES=30
- REFRESH_TOKEN_EXPIRE_MINUTES=1440
- ALLOWED_ORIGINS=["http://localhost:6004","http://localhost:6005"]

**Commerce Service:**
- DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/aarya_clothing
- REDIS_URL=redis://redis:6379/1
- CORE_SERVICE_URL=http://core:5001
- MEILISEARCH_URL=http://meilisearch:7700
- R2_BUCKET_NAME=aarya-clothing-images

**Payment Service:**
- DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/aarya_clothing
- REDIS_URL=redis://redis:6379/2
- CORE_SERVICE_URL=http://core:5001
- RAZORPAY_KEY_ID=your_key
- RAZORPAY_KEY_SECRET=your_secret

**Admin Service:**
- DATABASE_URL=postgresql://postgres:postgres123@postgres:5432/aarya_clothing
- REDIS_URL=redis://redis:6379/3
- CORE_SERVICE_URL=http://core:5001
- COMMERCE_SERVICE_URL=http://commerce:5002
- PAYMENT_SERVICE_URL=http://payment:5003

### 11.3 Nginx Route Configuration

| Path Pattern | Upstream | Service |
|--------------|----------|---------|
| / | frontend:3000 | Next.js |
| /_next/* | frontend:3000 | Next.js |
| /api/v1/auth/* | core:5001 | Core |
| /api/v1/users/* | core:5001 | Core |
| /api/v1/site/* | core:5001 | Core |
| /api/v1/products* | commerce:5002 | Commerce |
| /api/v1/categories* | commerce:5002 | Commerce |
| /api/v1/collections* | commerce:5002 | Commerce |
| /api/v1/cart* | commerce:5002 | Commerce |
| /api/v1/orders* | commerce:5002 | Commerce |
| /api/v1/addresses* | commerce:5002 | Commerce |
| /api/v1/wishlist* | commerce:5002 | Commerce |
| /api/v1/returns* | commerce:5002 | Commerce |
| /api/v1/promotions* | commerce:5002 | Commerce |
| /api/v1/reviews* | commerce:5002 | Commerce |
| /api/v1/payment* | payment:5003 | Payment |
| /api/v1/payments/* | payment:5003 | Payment |
| /api/v1/webhooks/* | payment:5003 | Payment |
| /api/v1/admin/* | admin:5004 | Admin |
| /api/v1/landing/* | admin:5004 | Admin |
| /api/v1/chat/* | admin:5004 | Admin |
| /api/v1/staff/* | admin:5004 | Admin |

---

# PART 4: DATA FLOW EXAMPLES

## 12. Common User Flows

### 12.1 Add to Cart Flow

1. User clicks "Add to Cart" on product page
2. Frontend calls `cartApi.addItem(productId, quantity, variantId)`
3. Request goes to Nginx (port 6005)
4. Nginx routes to Commerce Service (5002)
5. Commerce validates product and inventory
6. Cart updated in Redis
7. Response returns updated cart
8. CartContext updates state
9. Cart drawer opens showing updated cart

### 12.2 Checkout Flow

1. User proceeds to /checkout
2. Frontend calls `addressesApi.list()` to get saved addresses
3. User selects address and continues
4. Frontend calls `ordersApi.create(orderData)` 
5. Commerce creates order with "pending" status
6. Frontend redirects to /checkout/payment
7. User completes Razorpay payment
8. Payment webhook updates order status to "confirmed"
9. Inventory is reserved/updated
10. Cart is cleared

### 12.3 Admin Product Creation

1. Admin navigates to /admin/products
2. Fills product form with details
3. Uploads product images
4. Frontend calls `productsApi.create(productData)` 
5. Admin Service receives request
6. Images uploaded to R2
7. Product created in PostgreSQL
8. Product indexed in Meilisearch
9. Frontend shows success

---

# PART 5: SHARED UTILITIES

## 13. Shared Utilities Documentation

The `shared/` directory contains common utilities used across all microservices.

### 13.1 Shared Directory Structure

```
shared/
├── __init__.py              # Package initialization
├── auth_middleware.py       # JWT authentication middleware
├── background_tasks.py       # Background task utilities
├── base_config.py          # Base configuration
├── base_schemas.py         # Pydantic base schemas
├── cache_decorator.py      # Caching decorators
├── event_bus.py            # Event bus for inter-service communication
├── health_check.py         # Health check utilities
├── monitoring_middleware.py # Request monitoring
├── query_optimizations.py   # Database query optimizations
├── request_id_middleware.py # Request ID tracking
├── response_schemas.py     # Standard response schemas
├── service_client.py       # HTTP client for service-to-service calls
├── smart_cache.py          # Advanced caching utilities
├── token_validator.py      # JWT token validation
└── unified_redis_client.py # Redis client wrapper
```

### 13.2 Base Schemas (shared/base_schemas.py)

Provides shared Pydantic base classes for all services:

```python
from shared.base_schemas import BaseSchema, TimestampMixin, PaginatedResponse

# Base schema with common config
class ProductSchema(BaseSchema):
    name: str
    price: float

# With timestamps
class ProductWithTimestamps(BaseSchema, TimestampMixin):
    name: str
    price: float

# Paginated response
@app.get("/products")
async def list_products() -> PaginatedResponse[ProductSchema]:
    ...
```

**Key Exports:**
- `BaseSchema` - Base Pydantic model with common config
- `TimestampMixin` - Adds created_at, updated_at fields
- `IDMixin` - Adds id field
- `ActiveMixin` - Adds is_active field
- `PaginatedResponse[T]` - Generic paginated response
- `ErrorResponse` - Standard error response
- `SuccessResponse` - Standard success response
- `HealthCheckResponse` - Health check response
- `ValidationErrorResponse` - Validation error response

### 13.3 Authentication Middleware (shared/auth_middleware.py)

JWT token validation and user authentication:

```python
from shared.auth_middleware import (
    get_current_user,
    require_admin,
    require_staff,
    require_customer
)

# Get current authenticated user
@app.get("/profile")
async def get_profile(current_user = Depends(get_current_user)):
    return {"user_id": current_user["user_id"]}

# Require admin role
@app.delete("/admin/products/{id}")
async def delete_product(current_user = Depends(require_admin)):
    ...

# Require staff or admin
@app.put("/admin/orders/{id}/status")
async def update_order(current_user = Depends(require_staff)):
    ...
```

**Key Exports:**
- `AuthMiddleware` - JWT validation class
- `TokenManager` - Token creation/verification
- `get_current_user` - Get authenticated user
- `get_current_user_optional` - Optional auth
- `require_admin` - Admin only
- `require_staff` - Staff or admin
- `require_customer` - Customer only
- `check_user_ownership` - Resource ownership check

### 13.4 Service Client (shared/service_client.py)

HTTP client for inter-service communication:

```python
from shared.service_client import ServiceClient

# Initialize client
commerce_client = ServiceClient(
    base_url="http://commerce:5002",
    service_name="commerce"
)

# Make requests
response = await commerce_client.get("/api/v1/products")
response = await commerce_client.post("/api/v1/orders", data=order_data)
```

### 13.5 Smart Cache (shared/smart_cache.py)

Advanced caching with Redis:

```python
from shared.smart_cache import SmartCache

cache = SmartCache(prefix="product:")

# Cache with TTL
await cache.set("product:1", product_data, ttl=3600)

# Get or compute
data = await cache.get_or_compute("product:1", fetch_from_db, ttl=3600)

# Invalidate patterns
await cache.invalidate_pattern("product:*")
```

### 13.6 Event Bus (shared/event_bus.py)

Event-driven communication between services:

```python
from shared.event_bus import EventBus, Event

# Define events
class OrderCreatedEvent(Event):
    type = "order.created"
    
# Publish event
event_bus = EventBus()
event_bus.publish(OrderCreatedEvent(order_id=123, user_id=456))

# Subscribe to events
@event_bus.subscribe("order.created")
async def handle_order_created(event):
    ...
```

---

# PART 6: ADDITIONAL DATA FLOWS

## 14. Extended User Flows

### 14.1 User Registration Flow

1. User visits `/auth/register`
2. Fills form: email, password, first_name, last_name, phone
3. Frontend calls `POST /api/v1/auth/register`
4. Core Service:
   - Validates email not already registered
   - Hashes password with bcrypt
   - Creates user in `users` table
   - Creates user profile in `user_profiles` table
   - Generates email verification token
   - Sends verification email
5. Returns tokens + user data
6. Frontend stores tokens in localStorage/cookies
7. Redirects to `/auth/check-email` prompting verification

### 14.2 Password Reset Flow

1. User visits `/auth/forgot-password`
2. Enters email address
3. Frontend calls `POST /api/v1/auth/forgot-password`
4. Core Service:
   - Finds user by email
   - Generates password reset token
   - Sends reset email with link
5. User clicks link in email → `/auth/reset-password?token=xxx`
6. User enters new password
7. Frontend calls `POST /api/v1/auth/reset-password`
8. Core Service:
   - Validates token
   - Updates password hash in `users` table
   - Invalidates old sessions
9. Redirects to `/auth/login`

### 14.3 Return Request Flow

**Customer Side:**
1. User visits `/profile/orders`
2. Clicks "Return" on an order item
3. Navigates to `/profile/returns/create`
4. Selects items, reason (defective, wrong_item, etc.), description
5. Frontend calls `POST /api/v1/returns`
6. Commerce Service creates return request with "requested" status
7. User redirected to return detail page

**Admin Side:**
1. Admin visits `/admin/returns`
2. Reviews return request
3. Can approve, reject, or mark as received:
   - `POST /api/v1/admin/returns/{id}/approve` - Approves return
   - `POST /api/v1/admin/returns/{id}/reject` - Rejects with reason
   - `POST /api/v1/admin/returns/{id}/receive` - Marks item received
4. Once item received, processes refund:
   - `POST /api/v1/admin/returns/{id}/refund`
5. Payment Service processes Razorpay refund
6. Return status updated to "refunded" or "completed"

### 14.4 Order Tracking Flow

1. User visits `/profile/orders/{id}`
2. Frontend calls `GET /api/v1/orders/{id}`
3. Commerce Service returns order with status + tracking
4. Frontend also calls `GET /api/v1/orders/{id}/tracking`
5. Returns order tracking history:
   - Each status change creates entry in `order_tracking`
   - Shows: pending → confirmed → processing → shipped → delivered
6. If shipped, shows tracking number + carrier info

### 14.5 Product Search Flow

1. User types in search bar
2. Frontend debounces input (300ms)
3. Calls `GET /api/v1/products/search?q=query`
4. Commerce Service:
   - Checks Redis cache first
   - If miss, queries Meilisearch
   - Returns ranked results
5. Results cached in Redis for 5 minutes
6. Frontend displays results with highlighting

---

# AI Tools Setup

## Superpowers for OpenCode

Superpowers is a plugin that injects specialized skills into OpenCode sessions.

### Installation

**Method 1:** Tell OpenCode to fetch instructions:
```
Fetch and follow instructions from https://raw.githubusercontent.com/obra/superpowers/refs/heads/main/.opencode/INSTALL.md
```

**Method 2 (Quick Install):**
```
Clone https://github.com/obra/superpowers to ~/.config/opencode/superpowers
Create directory ~/.config/opencode/plugins
Symlink ~/.config/opencode/superpowers/.opencode/plugins/superpowers.js to ~/.config/opencode/plugins/superpowers.js
Symlink ~/.config/opencode/superpowers/skills to ~/.config/opencode/skills/superpowers
Restart OpenCode
```

### Usage

- **List available skills:** Use OpenCode's native skill tool: `use skill tool to list skills`
- **Load a specific skill:** `use skill tool to load superpowers/brainstorming`

### Windsurf Support

Superpowers is not officially supported in Windsurf. The supported platforms are Claude Code, Cursor, Codex, and OpenCode.

---

# QUICK REFERENCE

## File Path Reference

### Frontend Key Files
- `frontend_new/app/layout.js` - Root layout with providers
- `frontend_new/middleware.js` - Route protection
- `frontend_new/lib/baseApi.js` - API client base
- `frontend_new/lib/api.js` - Core APIs
- `frontend_new/lib/customerApi.js` - Customer APIs
- `frontend_new/lib/adminApi.js` - Admin APIs
- `frontend_new/lib/authContext.js` - Auth state
- `frontend_new/lib/cartContext.js` - Cart state

### Backend Key Files
- `services/core/main.py` - Core service entry
- `services/commerce/main.py` - Commerce service entry
- `services/payment/main.py` - Payment service entry
- `services/admin/main.py` - Admin service entry

### Infrastructure Files
- `docker-compose.yml` - All services configuration
- `docker/nginx/nginx.conf` - Nginx routing
- `docker/postgres/init.sql` - Database schema
- `shared/auth_middleware.py` - JWT authentication
- `shared/base_schemas.py` - Pydantic base classes
- `shared/service_client.py` - Service-to-service HTTP client

## Key URLs
- Frontend: http://localhost:6004
- API Gateway: http://localhost:6005
- Core API: http://localhost:5001
- Commerce API: http://localhost:5002
- Payment API: http://localhost:5003
- Admin API: http://localhost:5004

---

## Authentication Status (Completed)

- **Scope**: Registration, email verification, login, refresh, logout, password reset, and protected route enforcement across Core, Frontend (Next.js), and Nginx gateway.
- **Backend fixes**:
  - Restored verification and password-reset email sending in `services/core/main.py` and `services/core/service/auth_service.py`.
  - Corrected JWT error handling to use `jwt.PyJWTError` in `shared/auth_middleware.py`.
  - Resolved admin service indentation error preventing startup.
- **Database alignment**: Reviews table now matches the commerce model (columns: `order_id`, `comment`, `helpful_count`) and uses database `aarya_clothing`.
- **Frontend fixes**: Product detail reviews render safely (no React minified error; handles null/empty review data).
- **Validation**: Docker rebuild performed; services healthy via Nginx (`http://localhost:6005`). Frontend flows operate end-to-end with the updated auth pipeline.

---

## Wave 1 Stabilization Status (Completed)
 
 - **Shared frontend client alignment**: `frontend_new/lib/baseApi.js` now supports request params/options consistently across `post`, `put`, `patch`, and `delete`, which removes wrapper drift and preserves multipart upload behavior.
 - **Frontend contract fixes**:
   - `frontend_new/lib/api.js` now uses `PATCH /api/v1/users/me` and `POST /api/v1/auth/change-password`.
   - `frontend_new/lib/customerApi.js` aligns cart, addresses, reviews, and returns calls with the current backend.
   - `frontend_new/lib/adminApi.js` aligns admin orders, collections, returns, upload helpers, and pagination/filter mapping with the current backend.
   - `frontend_new/app/admin/orders/[id]/page.js` derives payment method/status from real order data instead of fixed placeholders.
   - `frontend_new/app/checkout/payment/page.js` uses the stabilized nested auth profile shape for Razorpay prefill data.
   - `frontend_new/app/admin/staff/orders/page.js` now uses the live admin orders contract for search refresh, totals, payment state, and returned/refunded filtering.
 - **Admin backend parity**:
   - Added `PATCH /api/v1/admin/orders/bulk-status`.
   - Added `GET /api/v1/admin/orders/{order_id}/tracking`.
   - Admin order detail responses now include `order`, `items`, `tracking`, and `customer` blocks expected by the admin order detail page.
   - Admin return detail responses now include normalized timeline/item/refund metadata used by the admin return detail page.
   - Admin order list now supports backend `search` filtering, matching the existing orders page search UI.
   - Admin users list now supports validated `sort_by` / `sort_order` query params, matching the customer table sorting UI.
 - **Payment hardening**:
   - Removed commerce-side mock payment/refund responses when payment integration is unavailable.
   - Razorpay verification in payment service now correctly awaits the async verification flow.
- **Page-level stabilization**:
  - Profile and address pages now send backend-supported field names and no longer rely on fake success fallbacks.
  - Admin return detail flow now reflects real backend actions instead of mock status/refund success.
  - Profile settings page now surfaces real password errors and explicitly marks notification toggles as session-local until a backend preference endpoint exists.
- **Validation**:
  - Python syntax validation passed for modified backend files via `python -m py_compile`.
  - Frontend syntax validation passed for modified JS files via `node --check`.

---

*Document generated for AI reference*
*All endpoints, schemas, configurations, and flows documented for making changes to the Aarya Clothing platform*
*Expanded with complete nginx.conf, docker-compose.yml, shared utilities, and additional data flows*
