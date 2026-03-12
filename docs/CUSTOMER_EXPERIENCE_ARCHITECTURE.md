# Customer Experience Architecture - Aarya Clothing

## 🎯 Customer Journey Overview

This document provides a comprehensive analysis of the customer experience architecture, covering all public and authenticated pages, data flow, schema alignment, and calculations across the Aarya Clothing e-commerce platform.

---

## 🌐 **Public Pages (No Authentication Required)**

### **1. Homepage (/)**
**File**: `frontend_new/app/page.js`
**Data Source**: Admin Landing CMS → Backend API → Frontend
**Service**: Admin Service → Commerce Service (for product data)

#### **Data Flow**:
```
Frontend (getLandingAll) → Admin Service (/api/v1/admin/landing/all) → 
├── Landing Config (DB: landing_config, landing_images, landing_products)
├── Featured Products (Commerce Service: /api/v1/products/featured)
├── New Arrivals (Commerce Service: /api/v1/products/new-arrivals)
└── Collections (Commerce Service: /api/v1/categories)
```

#### **Schema Dependencies**:
- `landing_config` - Hero sections, taglines, CTAs
- `landing_images` - Background images, banners
- `landing_products` - Admin-selected featured products
- `products` - Product details, pricing, images
- `categories` - Collection information

#### **Calculations**:
- **Product Pricing**: Backend calculates discounts, MRP comparisons
- **Image URLs**: Backend constructs full R2 URLs via `_r2_url()`
- **Stock Status**: Backend checks inventory availability

---

### **2. Products Listing (/products)**
**File**: `frontend_new/app/products/page.js`
**Data Source**: Commerce Service API
**Service**: Commerce Service

#### **Data Flow**:
```
Frontend (productsApi.list) → Commerce Service (/api/v1/products) →
├── Products (DB: products + product_images + inventory)
├── Categories (DB: categories)
├── Filters (price, category, search)
└── Sorting (newest, price, popularity, rating)
```

#### **Schema Dependencies**:
- `products` - Product information, SEO, status
- `product_images` - Image galleries, primary images
- `inventory` - Stock levels, variants, SKUs
- `categories` - Filtering categories

#### **Calculations**:
- **Price Ranges**: Min/max calculations for filters
- **Stock Availability**: Real-time inventory checks
- **Rating Averages**: From reviews table
- **Discount Percentages**: `(mrp - price) / mrp * 100`

---

### **3. Product Detail (/products/[id])**
**File**: `frontend_new/app/products/[id]/page.js`
**Data Source**: Commerce Service API
**Service**: Commerce Service

#### **Data Flow**:
```
Frontend (productsApi.get/getBySlug) → Commerce Service (/api/v1/products/{id}) →
├── Product Details (DB: products)
├── Product Images (DB: product_images)
├── Inventory/Variants (DB: inventory)
├── Reviews (DB: reviews)
└── Related Products (Commerce Service algorithm)
```

#### **Schema Dependencies**:
- `products` - Full product details
- `product_images` - Complete image gallery
- `inventory` - Size/color variants, stock
- `reviews` - Customer reviews and ratings

#### **Calculations**:
- **Variant Pricing**: Different prices for sizes/colors
- **Stock Status**: Per-variant availability
- **Rating Summary**: Average from reviews table
- **Related Products**: Based on category/tags

---

### **4. Collections (/collections/[slug])**
**File**: `frontend_new/app/collections/[slug]/page.js`
**Data Source**: Commerce Service API
**Service**: Commerce Service

#### **Data Flow**:
```
Frontend (categoriesApi.getBySlug) → Commerce Service (/api/v1/categories/slug/{slug}) →
├── Category Details (DB: categories)
├── Category Products (DB: products + inventory)
├── Subcategories (DB: categories - parent/child)
└── Breadcrumbs (Category hierarchy)
```

#### **Schema Dependencies**:
- `categories` - Category information, hierarchy
- `products` - Products in this category
- `inventory` - Stock for category products

---

### **5. New Arrivals (/new-arrivals)**
**File**: `frontend_new/app/new-arrivals/page.js`
**Data Source**: Commerce Service API
**Service**: Commerce Service

#### **Data Flow**:
```
Frontend (productsApi.getNewArrivals) → Commerce Service (/api/v1/products/new-arrivals) →
├── Products (DB: products WHERE is_new_arrival = true)
├── Product Images (DB: product_images)
└── Inventory (DB: inventory)
```

#### **Schema Dependencies**:
- `products` - Filtered by `is_new_arrival = true`
- `product_images` - Product galleries
- `inventory` - Stock levels

---

### **6. About Page (/about)**
**File**: `frontend_new/app/about/page.js`
**Data Source**: Static content
**Service**: None (Static page)

---

## 🔐 **Authenticated Pages (Login Required)**

### **1. Customer Profile (/profile)**
**File**: `frontend_new/app/profile/page.js`
**Data Source**: Core Service API
**Service**: Core Service

#### **Data Flow**:
```
Frontend (AuthContext) → Core Service (/api/v1/users/me) →
├── User Profile (DB: users + user_profiles)
├── Order Statistics (Commerce Service: /api/v1/orders/stats)
├── Wishlist Count (Commerce Service: /api/v1/wishlist)
└── Return Requests (Commerce Service: /api/v1/returns)
```

#### **Schema Dependencies**:
- `users` - Basic user information, email, role
- `user_profiles` - Extended profile data, phone, avatar
- `orders` - Order history for statistics
- `wishlist` - Saved items count

#### **Calculations**:
- **Order Statistics**: Total orders, total spent, average order value
- **Profile Completion**: Based on filled fields
- **Account Age**: From `created_at` timestamp

---

### **2. Address Management (/profile/addresses)**
**File**: `frontend_new/app/profile/addresses/page.js`
**Data Source**: Commerce Service API
**Service**: Commerce Service

#### **Data Flow**:
```
Frontend (customerApi.addresses) → Commerce Service (/api/v1/addresses) →
├── Addresses (DB: address)
├── Default Address Detection
└── Address Validation (Pincode API)
```

#### **Schema Dependencies**:
- `address` - All user addresses
- `users` - Address ownership via `user_id`

#### **Calculations**:
- **Default Address**: First address or explicitly marked default
- **Address Type**: shipping/billing/both
- **Geolocation**: Lat/lng for delivery radius

---

### **3. Order History (/profile/orders)**
**File**: `frontend_new/app/profile/orders/page.js`
**Data Source**: Commerce Service API
**Service**: Commerce Service

#### **Data Flow**:
```
Frontend (ordersApi.list) → Commerce Service (/api/v1/orders) →
├── Orders (DB: orders + order_items + order_tracking)
├── Order Items (DB: order_items + products + inventory)
├── Tracking Info (DB: order_tracking)
└── Return Eligibility (Business logic)
```

#### **Schema Dependencies**:
- `orders` - Order header information
- `order_items` - Products in each order
- `order_tracking` - Status updates and tracking
- `products` - Product details for ordered items
- `inventory` - Variant information

#### **Calculations**:
- **Order Total**: `subtotal + shipping - discount`
- **Delivery Date**: Based on shipping method and processing time
- **Return Window**: From delivery date + return policy days
- **Loyalty Points**: Based on order value

---

### **4. Wishlist (/profile/wishlist)**
**File**: `frontend_new/app/profile/wishlist/page.js`
**Data Source**: Commerce Service API
**Service**: Commerce Service

#### **Data Flow**:
```
Frontend (wishlistApi.list) → Commerce Service (/api/v1/wishlist) →
├── Wishlist Items (DB: wishlist + products)
├── Product Details (DB: products + product_images)
├── Stock Status (DB: inventory)
└── Price Changes (Historical tracking)
```

#### **Schema Dependencies**:
- `wishlist` - Saved product references
- `products` - Product information
- `product_images` - Product galleries
- `inventory` - Current stock levels

#### **Calculations**:
- **Price Alerts**: Notify when wishlist items go on sale
- **Stock Alerts**: Notify when wishlist items are back in stock
- **Wishlist Value**: Total value of all saved items

---

### **5. Shopping Cart (/cart)**
**File**: `frontend_new/app/cart/page.js`
**Data Source**: Cart Context + Commerce Service API
**Service**: Commerce Service

#### **Data Flow**:
```
Frontend (CartContext) → Commerce Service (/api/v1/cart) →
├── Cart Items (Session/DB: cart_items)
├── Product Details (DB: products + inventory)
├── Pricing Calculations
└── Coupon Validation
```

#### **Schema Dependencies**:
- **Session Cart**: Redis-based for guests
- **DB Cart**: Persistent for logged-in users
- `products` - Product information
- `inventory` - Stock and variant data

#### **Calculations**:
- **Subtotal**: Sum of all item prices
- **Discount**: Coupon calculations
- **Shipping**: Based on weight, location, method
- **Taxes**: GST calculations based on product category
- **Total**: `subtotal + shipping + taxes - discount`

---

### **6. Checkout Flow (/checkout)**
**File**: `frontend_new/app/checkout/page.js`
**Data Source**: Multiple Services
**Services**: Commerce + Payment + Core

#### **Data Flow**:
```
Frontend → Commerce Service (/api/v1/checkout) →
├── Address Validation (DB: address)
├── Inventory Lock (DB: inventory)
├── Order Creation (DB: orders + order_items)
└── Payment Processing (Payment Service)
```

#### **Schema Dependencies**:
- `address` - Delivery addresses
- `inventory` - Stock reservation
- `orders` - Order creation
- `order_items` - Order line items
- `payments` - Payment processing

#### **Calculations**:
- **Final Total**: Including all fees and taxes
- **Delivery Estimate**: Based on location and shipping method
- **Payment Processing**: Razorpay integration
- **Order Confirmation**: Unique order ID generation

---

## 🔄 **Data Flow Architecture**

### **Frontend API Clients**
```javascript
// customerApi.js - All customer-facing API calls
productsApi: {
  list, get, getBySlug, getFeatured, getNewArrivals, search
}
cartApi: {
  get, addItem, updateItem, removeItem, clear, applyCoupon
}
ordersApi: {
  create, list, get, cancel, track
}
wishlistApi: {
  list, add, remove, check
}
```

### **Service Responsibilities**
- **Core Service**: Authentication, user profiles, security
- **Commerce Service**: Products, cart, orders, inventory, reviews
- **Payment Service**: Payment processing, refunds
- **Admin Service**: CMS, analytics, customer support

### **Database Schema Alignment**
```sql
-- Core Tables (Core Service)
users, user_profiles, user_security, email_verifications, otps

-- Commerce Tables (Commerce Service)
products, product_images, inventory, categories, orders, order_items, 
order_tracking, wishlist, reviews, return_requests, address

-- Admin Tables (Admin Service)
landing_config, landing_images, landing_products, analytics_cache,
chat_rooms, chat_messages, inventory_movements
```

---

## 🧮 **Critical Calculations & Business Logic**

### **1. Pricing Calculations**
```javascript
// Backend (Commerce Service)
const calculateDiscount = (product) => {
  if (product.mrp && product.mrp > product.price) {
    return Math.round(((product.mrp - product.price) / product.mrp) * 100);
  }
  return 0;
};

const calculateFinalPrice = (product, quantity, coupon) => {
  let subtotal = product.price * quantity;
  let discount = 0;
  
  if (coupon) {
    if (coupon.type === 'percentage') {
      discount = subtotal * (coupon.value / 100);
    } else {
      discount = coupon.value;
    }
  }
  
  return Math.max(0, subtotal - discount);
};
```

### **2. Inventory Management**
```javascript
// Backend (Commerce Service)
const checkStockAvailability = (inventoryId, quantity) => {
  const inventory = db.inventory.find(inv => inv.id === inventoryId);
  return inventory && inventory.quantity >= quantity;
};

const reserveInventory = (orderId, items) => {
  items.forEach(item => {
    db.inventory.update(
      { quantity: db.inventory.quantity - item.quantity },
      { where: { id: item.inventory_id } }
    );
  });
};
```

### **3. Order Calculations**
```javascript
// Backend (Commerce Service)
const calculateOrderTotals = (order) => {
  const subtotal = order.items.reduce((sum, item) => 
    sum + (item.price * item.quantity), 0
  );
  
  const shipping = calculateShipping(order.address, order.items);
  const taxes = calculateTaxes(subtotal, order.items);
  const discount = order.coupon ? calculateDiscount(subtotal, order.coupon) : 0;
  
  return {
    subtotal,
    shipping,
    taxes,
    discount,
    total: subtotal + shipping + taxes - discount
  };
};
```

### **4. Rating Calculations**
```javascript
// Backend (Commerce Service)
const calculateProductRating = (productId) => {
  const reviews = db.reviews.filter(r => r.product_id === productId);
  if (reviews.length === 0) return 0;
  
  const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
  return Math.round((totalRating / reviews.length) * 10) / 10;
};
```

---

## 🚨 **Identified Issues & Gaps**

### **1. Missing Cart Table**
**Issue**: No dedicated cart table in database schema
**Current**: Session-based cart in Redis
**Needed**: Persistent cart table for logged-in users
**Solution**: Add `cart` and `cart_items` tables

### **2. Inconsistent Address Schema**
**Issue**: Address table exists but not fully integrated
**Current**: Basic address fields
**Needed**: Address validation, geocoding, default management
**Solution**: Enhance address table with validation logic

### **3. Missing Customer Analytics**
**Issue**: No customer behavior tracking
**Current**: Basic order history
**Needed**: Customer lifetime value, segmentation, preferences
**Solution**: Add customer analytics tables and tracking

### **4. Incomplete Return System**
**Issue**: Return requests table exists but workflow incomplete
**Current**: Basic return request storage
**Needed**: Return processing, refund tracking, exchange logic
**Solution**: Complete return management workflow

---

## 📋 **Implementation Priorities**

### **Phase 1: Schema Alignment**
1. **Add Cart Tables**: Persistent cart storage
2. **Enhance Address Table**: Validation and geocoding
3. **Customer Analytics**: Behavior tracking tables
4. **Return Workflow**: Complete return processing

### **Phase 2: API Enhancement**
1. **Cart API**: Full CRUD operations
2. **Address API**: Validation and management
3. **Analytics API**: Customer insights
4. **Return API**: Complete workflow

### **Phase 3: Frontend Integration**
1. **Cart Persistence**: Cross-session cart
2. **Address Management**: Full CRUD interface
3. **Customer Dashboard**: Analytics and insights
4. **Return Portal**: Self-service returns

---

## 🔧 **Technical Implementation Details**

### **State Management**
- **Cart Context**: Centralized cart state with backend sync
- **Auth Context**: User authentication and profile data
- **Site Config**: Global configuration and settings

### **Error Handling**
- **API Errors**: Consistent error responses
- **Network Issues**: Offline support and retry logic
- **Validation**: Client-side and server-side validation

### **Performance Optimization**
- **Lazy Loading**: Below-fold components loaded dynamically
- **Image Optimization**: Next.js Image with R2 CDN
- **Caching**: Redis for session data, API responses
- **Database Indexing**: Optimized queries for customer data

---

## 📊 **Success Metrics**

### **Customer Experience**
- **Page Load Speed**: < 2 seconds for all pages
- **Cart Abandonment**: < 60% industry average
- **Checkout Conversion**: > 25% industry average
- **Customer Satisfaction**: > 4.0/5 rating

### **Technical Performance**
- **API Response Time**: < 500ms for all endpoints
- **Database Query Time**: < 100ms for customer queries
- **Error Rate**: < 1% for all customer operations
- **Uptime**: > 99.5% availability

---

## 🎯 **Next Steps**

1. **Audit Current Implementation**: Verify all data flows and calculations
2. **Schema Updates**: Implement missing tables and enhancements
3. **API Development**: Complete missing endpoints and validation
4. **Frontend Integration**: Update components to use new APIs
5. **Testing**: Comprehensive testing of all customer journeys
6. **Documentation**: Update API documentation and user guides

This architecture provides the foundation for a robust, scalable, and customer-friendly e-commerce experience that aligns with modern best practices and business requirements.
