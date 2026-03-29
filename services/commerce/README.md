# Commerce Service - Product & Order Management

The Commerce Service handles all product catalog, inventory management, shopping cart, and order processing for the Aarya Clothing e-commerce platform. Built with FastAPI and PostgreSQL, it provides comprehensive e-commerce functionality.

## 🚀 Overview

### Features
- **Product Catalog** - Complete product management with categories and variants
- **Inventory Management** - Stock tracking and variant management
- **Shopping Cart** - Real-time cart management with Redis persistence
- **Order Processing** - Complete order lifecycle management
- **Category Management** - Hierarchical category organization
- **Search & Filtering** - Advanced product search capabilities
- **Price Management** - Dynamic pricing and discount handling
- **Product Analytics** - Sales tracking and reporting

### Service Details
- **Port**: 8010
- **Framework**: FastAPI 0.109.0
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Authentication**: JWT integration with Core Service

## 🏗️ Architecture

```
Commerce Service (Port 8010)
├── Product Management
│   ├── Product Catalog
│   ├── Category Management
│   ├── Inventory Tracking
│   └── Price Management
├── Shopping Cart
│   ├── Cart Operations
│   ├── Redis Persistence
│   └── Guest Cart Support
├── Order Processing
│   ├── Order Creation
│   ├── Order Management
│   ├── Order Status Tracking
│   └── Order History
├── Search & Discovery
│   ├── Product Search
│   ├── Category Filtering
│   └── Recommendation Engine
└── API Layer
    ├── RESTful Endpoints
    ├── Request Validation
    └── Error Handling
```

## 📁 Project Structure

```
services/commerce/
├── main.py                     # FastAPI application entry point
├── requirements.txt            # Python dependencies
├── Dockerfile                  # Docker container configuration
├── MIGRATION.md              # Database migration guide
├── core/
│   ├── config.py              # Service configuration
│   ├── redis_client.py        # Redis connection and utilities
│   └── database.py          # Database connection and session
├── models/
│   ├── product.py            # Product model
│   ├── category.py           # Category model
│   ├── inventory.py          # Inventory model
│   ├── cart.py              # Cart model
│   └── order.py             # Order model
├── schemas/
│   ├── product.py            # Product request/response schemas
│   ├── category.py           # Category schemas
│   ├── inventory.py          # Inventory schemas
│   ├── cart.py              # Cart schemas
│   └── order.py             # Order schemas
├── service/
│   ├── product_service.py    # Product business logic
│   ├── category_service.py   # Category management logic
│   ├── inventory_service.py  # Inventory management logic
│   ├── cart_service.py       # Cart operations logic
│   └── order_service.py     # Order processing logic
├── api/
│   ├── v1/
│   │   ├── products.py       # Product endpoints
│   │   ├── categories.py    # Category endpoints
│   │   ├── cart.py          # Cart endpoints
│   │   └── orders.py        # Order endpoints
│   └── dependencies.py      # FastAPI dependencies
└── utils/
    ├── search.py            # Search utilities
    ├── validators.py        # Input validation
    └── helpers.py          # Helper functions
```

## 🔧 Configuration

### Environment Variables

```bash
# Database Configuration
DATABASE_URL=postgresql://postgres:password@localhost:5432/aarya_clothing

# Redis Configuration
REDIS_URL=redis://localhost:6379/0

# Core Service Integration
CORE_SERVICE_URL=http://localhost:8001
JWT_SECRET_KEY=shared-jwt-secret-key

# Payment Service Integration
PAYMENT_SERVICE_URL=http://localhost:8020

# File Storage (AWS S3 or Cloudflare R2)
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=aarya-clothing-products

# Cloudflare R2 (Alternative)
R2_ACCOUNT_ID=your-r2-account-id
R2_ACCESS_KEY_ID=your-r2-access-key
R2_SECRET_ACCESS_KEY=your-r2-secret-key
R2_BUCKET_NAME=your-r2-bucket

# Application Settings
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO

# CORS Settings
ALLOWED_ORIGINS=["http://localhost:3000","http://localhost:8001"]

# Search Configuration
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_INDEX=products

# Cart Settings
CART_EXPIRE_MINUTES=10080  # 7 days
GUEST_CART_EXPIRE_MINUTES=1440  # 24 hours

# Order Settings
ORDER_TIMEOUT_MINUTES=30  # Payment timeout
ORDER_CONFIRMATION_EMAIL=true
ORDER_SHIPPING_EMAIL=true
```

## 🚀 API Endpoints

### Product Endpoints

#### List Products
```http
GET /api/v1/products?page=1&limit=20&category=dresses&sort=price_asc&search=summer
```

#### Get Product Details
```http
GET /api/v1/products/{product_id}
```

#### Create Product (Admin)
```http
POST /api/v1/products
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "name": "Summer Dress",
  "description": "Beautiful summer dress",
  "price": 2999.00,
  "mrp": 3999.00,
  "category_id": 1,
  "sku": "DRESS-001",
  "inventory": [
    {
      "size": "M",
      "color": "Blue",
      "stock": 50,
      "price": 2999.00
    }
  ],
  "images": [
    "https://example.com/image1.jpg",
    "https://example.com/image2.jpg"
  ],
  "tags": ["summer", "dress", "casual"],
  "is_active": true
}
```

#### Update Product (Admin)
```http
PUT /api/v1/products/{product_id}
Content-Type: application/json
Authorization: Bearer <admin_token>
```

#### Delete Product (Admin)
```http
DELETE /api/v1/products/{product_id}
Authorization: Bearer <admin_token>
```

#### Search Products
```http
GET /api/v1/products/search?q=dress&category=clothing&price_min=1000&price_max=5000
```

### Category Endpoints

#### List Categories
```http
GET /api/v1/categories
```

#### Get Category Tree
```http
GET /api/v1/categories/tree
```

#### Get Category Details
```http
GET /api/v1/categories/{category_id}
```

#### Create Category (Admin)
```http
POST /api/v1/categories
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "name": "Dresses",
  "description": "Women's dresses",
  "parent_id": null,
  "image_url": "https://example.com/category.jpg",
  "is_active": true,
  "sort_order": 1
}
```

#### Update Category (Admin)
```http
PUT /api/v1/categories/{category_id}
Content-Type: application/json
Authorization: Bearer <admin_token>
```

### Cart Endpoints

#### Get User Cart
```http
GET /api/v1/cart/{user_id}
Authorization: Bearer <access_token>
```

#### Add to Cart
```http
POST /api/v1/cart/{user_id}/add
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "product_id": 123,
  "variant_id": 456,
  "quantity": 2
}
```

#### Update Cart Item
```http
PUT /api/v1/cart/{user_id}/item/{item_id}
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "quantity": 3
}
```

#### Remove from Cart
```http
DELETE /api/v1/cart/{user_id}/item/{item_id}
Authorization: Bearer <access_token>
```

#### Clear Cart
```http
DELETE /api/v1/cart/{user_id}
Authorization: Bearer <access_token>
```

#### Get Guest Cart
```http
GET /api/v1/cart/guest/{cart_id}
```

#### Add to Guest Cart
```http
POST /api/v1/cart/guest/{cart_id}/add
Content-Type: application/json

{
  "product_id": 123,
  "variant_id": 456,
  "quantity": 1
}
```

### Order Endpoints

#### Create Order
```http
POST /api/v1/orders
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "user_id": 123,
  "items": [
    {
      "product_id": 123,
      "variant_id": 456,
      "quantity": 2,
      "price": 2999.00
    }
  ],
  "shipping_address": {
    "name": "John Doe",
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400001",
    "country": "India",
    "phone": "+919876543210"
  },
  "billing_address": {
    "name": "John Doe",
    "address": "123 Main St",
    "city": "Mumbai",
    "state": "Maharashtra",
    "postal_code": "400001",
    "country": "India",
    "phone": "+919876543210"
  },
  "payment_method": "razorpay",
  "shipping_method": "standard"
}
```

#### Get User Orders
```http
GET /api/v1/orders/{user_id}?page=1&limit=10&status=pending
Authorization: Bearer <access_token>
```

#### Get Order Details
```http
GET /api/v1/orders/{order_id}
Authorization: Bearer <access_token>
```

#### Update Order Status (Admin)
```http
PATCH /api/v1/orders/{order_id}/status
Content-Type: application/json
Authorization: Bearer <admin_token>

{
  "status": "shipped",
  "tracking_number": "TRACK123456",
  "notes": "Order shipped via Express Delivery"
}
```

#### Cancel Order
```http
POST /api/v1/orders/{order_id}/cancel
Content-Type: application/json
Authorization: Bearer <access_token>

{
  "reason": "Customer requested cancellation",
  "refund_requested": true
}
```

## 🗄️ Database Schema

### Products Table
```sql
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    mrp DECIMAL(10,2),
    sku VARCHAR(100) UNIQUE NOT NULL,
    category_id INTEGER REFERENCES categories(id),
    images JSONB DEFAULT '[]',
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    is_featured BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Categories Table
```sql
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    parent_id INTEGER REFERENCES categories(id),
    image_url VARCHAR(500),
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Inventory Table
```sql
CREATE TABLE inventory (
    id SERIAL PRIMARY KEY,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    size VARCHAR(50),
    color VARCHAR(50),
    stock INTEGER DEFAULT 0,
    price DECIMAL(10,2),
    weight DECIMAL(10,3),
    barcode VARCHAR(100),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(product_id, size, color)
);
```

### Orders Table
```sql
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    order_number VARCHAR(50) UNIQUE NOT NULL,
    user_id INTEGER NOT NULL,
    status VARCHAR(50) DEFAULT 'pending',
    total_amount DECIMAL(10,2) NOT NULL,
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    shipping_amount DECIMAL(10,2) DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50) DEFAULT 'pending',
    shipping_address JSONB NOT NULL,
    billing_address JSONB NOT NULL,
    tracking_number VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

### Order Items Table
```sql
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id),
    variant_id INTEGER REFERENCES inventory(id),
    quantity INTEGER NOT NULL,
    price DECIMAL(10,2) NOT NULL,
    total DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);
```

### Cart Table (Redis)
```
cart:{user_id} -> {
    "items": [
        {
            "product_id": 123,
            "variant_id": 456,
            "quantity": 2,
            "price": 2999.00,
            "added_at": "2024-01-01T00:00:00Z"
        }
    ],
    "total": 5998.00,
    "updated_at": "2024-01-01T00:00:00Z"
}
```

## 🚀 Deployment

### Docker Deployment
```bash
# Build commerce service image
docker build -t aarya-clothing-commerce .

# Run container
docker run -p 8010:8010 \
  -e DATABASE_URL=postgresql://... \
  -e REDIS_URL=redis://... \
  -e CORE_SERVICE_URL=http://... \
  aarya-clothing-commerce
```

### Local Development
```bash
# Create virtual environment
python -m venv venv_commerce
source venv_commerce/bin/activate  # Linux/Mac
# or
venv_commerce\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Run service
uvicorn main:app --host 0.0.0.0 --port 8010 --reload
```

## 🧪 Testing

### Health Check
```bash
curl http://localhost:8010/health
```

### API Testing
```bash
# Test product listing
curl -X GET "http://localhost:8010/api/v1/products?page=1&limit=10"

# Test product creation (admin)
curl -X POST "http://localhost:8010/api/v1/products" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "name": "Test Product",
    "price": 999.00,
    "sku": "TEST-001",
    "category_id": 1
  }'

# Test cart operations
curl -X POST "http://localhost:8010/api/v1/cart/123/add" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "product_id": 1,
    "variant_id": 1,
    "quantity": 2
  }'
```

## 🔍 Monitoring & Logging

### Health Endpoint
```json
{
  "status": "healthy",
  "service": "commerce",
  "version": "1.0.0",
  "timestamp": "2024-01-01T00:00:00Z",
  "dependencies": {
    "database": "healthy",
    "redis": "healthy",
    "core_service": "healthy"
  }
}
```

### Metrics to Monitor
- Product catalog performance
- Cart abandonment rates
- Order conversion rates
- Inventory levels
- Search query performance
- API response times
- Error rates by endpoint

## 🐛 Troubleshooting

### Common Issues

#### 1. Database Connection Failed
```bash
# Check database connectivity
docker-compose exec postgres pg_isready -U postgres

# Verify connection string
echo $DATABASE_URL
```

#### 2. Redis Connection Failed
```bash
# Check Redis connectivity
docker-compose exec redis redis-cli ping

# Test Redis from service
python -c "import redis; r=redis.from_url('redis://localhost:6379'); print(r.ping())"
```

#### 3. Core Service Integration Issues
```bash
# Test Core Service connectivity
curl http://localhost:8001/health

# Verify JWT secret matches
echo $JWT_SECRET_KEY
```

#### 4. Image Upload Issues
```bash
# Test S3 connectivity
python -c "import boto3; s3 = boto3.client('s3'); print(s3.list_buckets())"

# Verify S3 credentials
echo $AWS_ACCESS_KEY_ID
echo $AWS_SECRET_ACCESS_KEY
```

### Debug Mode
```bash
# Enable debug logging
export DEBUG=true
export LOG_LEVEL=DEBUG

# Run with verbose output
uvicorn main:app --host 0.0.0.0 --port 8010 --reload --log-level debug
```

## 📚 Dependencies

### Core Dependencies
- **fastapi==0.109.0** - Web framework
- **uvicorn[standard]==0.27.0** - ASGI server
- **sqlalchemy==2.0.25** - ORM
- **psycopg2==2.9.11** - PostgreSQL driver
- **redis==5.0.1** - Redis client
- **pydantic==2.12.5** - Data validation
- **pydantic-settings==2.1.0** - Settings management
- **python-multipart==0.0.6** - Form data handling

### Additional Dependencies
- **python-jose[cryptography]==3.3.0** - JWT handling
- **python-dotenv==1.2.1** - Environment variables
- **httpx==0.26.0** - HTTP client for service communication
- **boto3==1.34.34** - AWS SDK for S3
- **email-validator==2.1.0** - Email validation

## 🔄 Version History

### v2.0.0 (Current)
- Enhanced product search capabilities
- Added inventory variant management
- Improved cart persistence
- Enhanced order management
- Added category hierarchy support

### v1.0.0
- Initial release
- Basic product management
- Shopping cart functionality
- Order processing

## 🤝 Contributing

1. Follow existing code patterns and conventions
2. Add proper error handling and logging
3. Write tests for new features
4. Update documentation for API changes
5. Ensure data consistency and integrity

## 📄 License

This service is licensed under the MIT License - see the main project LICENSE file for details.

---

**Version**: 2.0.0  
**Last Updated**: February 2026  
**Port**: 8010  
**Framework**: FastAPI 0.109.0
