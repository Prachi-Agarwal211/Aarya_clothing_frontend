-- Aarya Clothing - PostgreSQL Initialization
-- Creates all necessary tables and indexes
-- Synced with SQLAlchemy models across core, commerce, payment, and admin services

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector for semantic search and AI embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- ENUM TYPES
-- ============================================
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('admin', 'staff', 'customer', 'super_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('confirmed', 'shipped', 'delivered', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE address_type AS ENUM ('shipping', 'billing', 'both');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE return_reason AS ENUM ('defective', 'wrong_item', 'not_as_described', 'size_issue', 'color_issue', 'changed_mind', 'other');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $ BEGIN
    CREATE TYPE return_status AS ENUM ('requested', 'approved', 'rejected', 'received', 'refunded', 'completed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $;

DO $ BEGIN
    CREATE TYPE return_type AS ENUM ('return', 'exchange');
EXCEPTION WHEN duplicate_object THEN NULL;
END $;

DO $ BEGIN
    CREATE TYPE chat_status AS ENUM ('open', 'assigned', 'resolved', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE sender_type AS ENUM ('customer', 'staff', 'admin', 'system', 'ai');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================
-- USERS TABLE (Core Service)
-- Optimized: Minimal authentication fields only
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    username VARCHAR(50) NOT NULL UNIQUE,
    hashed_password VARCHAR(255) NOT NULL,
    role user_role DEFAULT 'customer',
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT users_email_check CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_username_length CHECK (LENGTH(username) >= 3),
    -- Password security: minimum 8 characters (application layer enforces stronger requirements)
    CONSTRAINT users_password_length CHECK (LENGTH(hashed_password) >= 60)
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);


-- ============================================
-- USER PROFILES TABLE (Core Service)
-- Personal information separated from auth
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
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


-- ============================================
-- USER SECURITY TABLE (Core Service)
-- Security tracking separated from auth
-- ============================================
CREATE TABLE IF NOT EXISTS user_security (
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


-- ============================================
-- EMAIL VERIFICATIONS TABLE (Core Service)
-- Email verification and password reset tokens
-- ============================================
CREATE TABLE IF NOT EXISTS email_verifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    token_type VARCHAR(20) DEFAULT 'email_verification' 
        CHECK (token_type IN ('email_verification', 'password_reset')),
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_token ON email_verifications(token);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user ON email_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verifications_expires ON email_verifications(expires_at);


-- ============================================
-- OTP TABLE (Core Service)
-- ============================================
CREATE TABLE IF NOT EXISTS otps (
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

CREATE INDEX IF NOT EXISTS idx_otps_code ON otps(otp_code);
CREATE INDEX IF NOT EXISTS idx_otps_user ON otps(user_id);
CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);
CREATE INDEX IF NOT EXISTS idx_otps_phone ON otps(phone);
CREATE INDEX IF NOT EXISTS idx_otps_type ON otps(otp_type);
CREATE INDEX IF NOT EXISTS idx_otps_expires ON otps(expires_at);
CREATE INDEX IF NOT EXISTS idx_otps_used ON otps(is_used) WHERE NOT is_used;


-- ============================================
-- COLLECTIONS TABLE (Commerce Service)
-- Unified: categories = collections (same thing)
-- ============================================
CREATE TABLE IF NOT EXISTS collections (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE,
    description TEXT,
    image_url VARCHAR(500),       -- R2 relative path e.g. collections/kurti.jpg
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collections_slug ON collections(slug);
CREATE INDEX IF NOT EXISTS idx_collections_active ON collections(is_active);
CREATE INDEX IF NOT EXISTS idx_collections_featured ON collections(is_featured) WHERE is_featured;
CREATE INDEX IF NOT EXISTS idx_collections_order ON collections(display_order);

-- Backward-compat view so any old queries on 'categories' still work
CREATE OR REPLACE VIEW categories AS SELECT * FROM collections;


-- ============================================
-- PRODUCTS TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) UNIQUE,
    description TEXT,
    short_description VARCHAR(500),
    base_price DECIMAL(10, 2) NOT NULL,
    mrp DECIMAL(10, 2),
    category_id INTEGER REFERENCES collections(id) ON DELETE SET NULL,
    brand VARCHAR(100),
    
    -- GST / Tax compliance
    hsn_code VARCHAR(10),
    gst_rate DECIMAL(5, 2),
    is_taxable BOOLEAN DEFAULT TRUE,
    
    -- Rating aggregation
    average_rating DECIMAL(3, 2) DEFAULT 0,
    review_count INTEGER DEFAULT 0,
    total_stock INTEGER DEFAULT 0,
    
    -- Flags
    is_active BOOLEAN DEFAULT TRUE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_new_arrival BOOLEAN DEFAULT FALSE,
    
    -- SEO
    meta_title VARCHAR(255),
    meta_description VARCHAR(500),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- pgvector: 768-dim Gemini text-embedding-004 for semantic search
    embedding vector(768)
);

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_price ON products(base_price);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured;
CREATE INDEX IF NOT EXISTS idx_products_new_arrival ON products(is_new_arrival) WHERE is_new_arrival;
CREATE INDEX IF NOT EXISTS idx_products_listings ON products(is_active, category_id, created_at DESC);
-- HNSW index for fast approximate nearest-neighbor vector search (cosine similarity)
CREATE INDEX IF NOT EXISTS idx_products_embedding ON products USING hnsw (embedding vector_cosine_ops);


-- ============================================
-- PRODUCT IMAGES TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS product_images (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    alt_text VARCHAR(255),
    is_primary BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_product_images_product ON product_images(product_id);


-- ============================================
-- PRODUCT VARIANTS TABLE (Commerce Service)
-- ============================================
-- ============================================
-- INVENTORY TABLE (Commerce Service)
-- Unified: product variants + stock tracking in one table
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
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

-- Backward-compat view so any old queries on 'product_variants' still work
CREATE OR REPLACE VIEW product_variants AS
    SELECT id, product_id, size, color, sku, quantity AS inventory_count,
           created_at, updated_at FROM inventory;

CREATE INDEX IF NOT EXISTS idx_inventory_product ON inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_sku ON inventory(sku);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(quantity) WHERE quantity <= 10;


-- ============================================
-- ADDRESSES TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS addresses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_addresses_user ON addresses(user_id);


-- ============================================
-- ORDERS TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    invoice_number VARCHAR(50) UNIQUE,
    subtotal DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount_applied DECIMAL(10, 2) DEFAULT 0,
    promo_code VARCHAR(50),
    shipping_cost DECIMAL(10, 2) DEFAULT 0,
    gst_amount DECIMAL(10, 2) DEFAULT 0,
    cgst_amount DECIMAL(10, 2) DEFAULT 0,
    sgst_amount DECIMAL(10, 2) DEFAULT 0,
    igst_amount DECIMAL(10, 2) DEFAULT 0,
    place_of_supply VARCHAR(50),
    customer_gstin VARCHAR(15),
    total_amount DECIMAL(10, 2) NOT NULL,
    payment_method VARCHAR(50),
    status order_status DEFAULT 'confirmed',
    shipping_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
    shipping_address TEXT,
    billing_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
    shipping_method VARCHAR(50),
    tracking_number VARCHAR(100),
    order_notes TEXT,
    transaction_id VARCHAR(255),
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at TIMESTAMP,
    cancellation_reason TEXT,
    shipped_at TIMESTAMP,
    delivered_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_transaction ON orders(transaction_id);
-- Composite index for dashboard overview (filters by status + aggregates by date)
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
-- Partial index for active new arrivals (landing page query)
CREATE INDEX IF NOT EXISTS idx_products_active_new_arrivals ON products(updated_at DESC) WHERE is_active = true AND is_new_arrival = true;


-- ============================================
-- ORDER ITEMS TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    inventory_id INTEGER NOT NULL REFERENCES inventory(id),
    product_id INTEGER,
    product_name VARCHAR(255),
    sku VARCHAR(100),
    size VARCHAR(50),
    color VARCHAR(50),
    hsn_code VARCHAR(10),
    gst_rate DECIMAL(5, 2),
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10, 2) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_orders_invoice ON orders(invoice_number);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_inventory ON order_items(inventory_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);


-- ============================================
-- ORDER TRACKING TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS order_tracking (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    status order_status NOT NULL,
    notes TEXT,
    location VARCHAR(255),
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_tracking_order ON order_tracking(order_id);


-- ============================================
-- WISHLIST TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_product ON wishlist(product_id);


-- ============================================
-- REVIEWS TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
    id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    order_id INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    title VARCHAR(255),
    comment TEXT,
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    is_approved BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_approved ON reviews(is_approved) WHERE is_approved;


-- ============================================
-- PROMOTIONS TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS promotions (
    id SERIAL PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_type discount_type NOT NULL,
    discount_value DECIMAL(10, 2) NOT NULL,
    min_order_value DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2),
    max_uses INTEGER,
    used_count INTEGER DEFAULT 0,
    max_uses_per_user INTEGER DEFAULT 1,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotions_code ON promotions(code);
CREATE INDEX IF NOT EXISTS idx_promotions_active ON promotions(is_active) WHERE is_active;


-- ============================================
-- PROMOTION USAGE TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS promotion_usage (
    id SERIAL PRIMARY KEY,
    promotion_id INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    order_id INTEGER REFERENCES orders(id),
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promotion_usage_promotion ON promotion_usage(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_user ON promotion_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_usage_order ON promotion_usage(order_id);


-- ============================================
-- RETURN REQUESTS TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS return_requests (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL,
    
    -- Return details
    reason return_reason NOT NULL,
    type return_type DEFAULT 'return',
    items JSONB DEFAULT '[]'::jsonb,
    description TEXT,
    status return_status DEFAULT 'requested',
    
    -- Enhanced return fields
    exchange_preference VARCHAR(255),
    video_url TEXT,
    
    -- Financial
    refund_amount DECIMAL(10, 2),
    refund_transaction_id VARCHAR(255),
    
    -- Processing
    approved_by INTEGER,
    rejection_reason TEXT,
    
    -- Return shipping
    return_tracking_number VARCHAR(100),
    is_item_received BOOLEAN DEFAULT FALSE,
    
    -- Timestamps
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at TIMESTAMP,
    received_at TIMESTAMP,
    refunded_at TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_return_requests_order ON return_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_user ON return_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_return_requests_status ON return_requests(status);
CREATE INDEX IF NOT EXISTS idx_return_requests_type ON return_requests(type);
CREATE INDEX IF NOT EXISTS idx_return_requests_video ON return_requests(video_url) WHERE video_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_return_requests_requested_at ON return_requests(requested_at);


-- ============================================
-- AUDIT LOGS TABLE (Commerce Service)
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id INTEGER,
    changes JSONB,
    description TEXT,
    ip_address VARCHAR(45),
    user_agent VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);


-- ============================================
-- PAYMENT TRANSACTIONS TABLE (Payment Service)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_transactions (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    
    -- Payment details
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    payment_method VARCHAR(50),
    
    -- Cashfree specific
    cashfree_order_id VARCHAR(255),
    cashfree_payment_id VARCHAR(255),
    cf_payment_session_id VARCHAR(500),

    -- Razorpay specific (legacy)
    razorpay_order_id VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    razorpay_signature VARCHAR(500),
    
    -- Transaction tracking
    transaction_id VARCHAR(255) UNIQUE,
    status VARCHAR(50) DEFAULT 'pending',
    gateway_response JSONB,
    
    -- Metadata
    description TEXT,
    customer_email VARCHAR(255),
    customer_phone VARCHAR(20),
    
    -- Refund details
    refund_amount DECIMAL(10, 2),
    refund_id VARCHAR(255),
    refund_status VARCHAR(50),
    refund_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_order ON payment_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_user ON payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_payment_cashfree ON payment_transactions(cashfree_order_id);
CREATE INDEX IF NOT EXISTS idx_payment_razorpay ON payment_transactions(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_transactions(status);


-- ============================================
-- PAYMENT METHODS TABLE (Payment Service)
-- ============================================
CREATE TABLE IF NOT EXISTS payment_methods (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- WEBHOOK EVENTS TABLE (Payment Service)
-- ============================================
CREATE TABLE IF NOT EXISTS webhook_events (
    id SERIAL PRIMARY KEY,
    gateway VARCHAR(50) NOT NULL DEFAULT 'razorpay',
    event_type VARCHAR(100) NOT NULL,
    event_id VARCHAR(255) UNIQUE,
    payload JSONB NOT NULL,
    processed BOOLEAN DEFAULT FALSE,
    processing_error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_webhook_event_id ON webhook_events(event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_processed ON webhook_events(processed);


-- ============================================
-- CHAT ROOMS TABLE (Admin Service)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_rooms (
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

CREATE INDEX IF NOT EXISTS idx_chat_rooms_customer ON chat_rooms(customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_assigned ON chat_rooms(assigned_to);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_status ON chat_rooms(status);


-- ============================================
-- CHAT MESSAGES TABLE (Admin Service)
-- ============================================
CREATE TABLE IF NOT EXISTS chat_messages (
    id SERIAL PRIMARY KEY,
    room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id INTEGER,
    sender_type sender_type DEFAULT 'customer',
    message TEXT NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);


-- ============================================
-- LANDING CONFIG TABLE (Admin Service)
-- ============================================
CREATE TABLE IF NOT EXISTS landing_config (
    id SERIAL PRIMARY KEY,
    section VARCHAR(100) NOT NULL UNIQUE,
    config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    updated_by INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- LANDING IMAGES TABLE (Admin Service)
-- ============================================
CREATE TABLE IF NOT EXISTS landing_images (
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

CREATE INDEX IF NOT EXISTS idx_landing_images_section ON landing_images(section);


-- ============================================
-- ANALYTICS CACHE TABLE (Admin Service)
-- ============================================
CREATE TABLE IF NOT EXISTS analytics_cache (
    id SERIAL PRIMARY KEY,
    cache_key VARCHAR(255) NOT NULL UNIQUE,
    data JSONB NOT NULL,
    period_start TIMESTAMP,
    period_end TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_cache_key ON analytics_cache(cache_key);


-- ============================================
-- STAFF TASKS TABLE (Admin Service)
-- ============================================
CREATE TABLE IF NOT EXISTS staff_tasks (
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

CREATE INDEX IF NOT EXISTS idx_staff_tasks_assigned ON staff_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_staff_tasks_status ON staff_tasks(status);


-- ============================================
-- STAFF NOTIFICATIONS TABLE (Admin Service)
-- ============================================
CREATE TABLE IF NOT EXISTS staff_notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    notification_type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_notifications_user ON staff_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_staff_notifications_unread ON staff_notifications(is_read) WHERE NOT is_read;


-- ============================================
-- INVENTORY MOVEMENTS TABLE (Admin/Staff)
-- ============================================
CREATE TABLE IF NOT EXISTS inventory_movements (
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

CREATE INDEX IF NOT EXISTS idx_inventory_movements_inventory ON inventory_movements(inventory_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_product ON inventory_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_created ON inventory_movements(created_at DESC);


-- ============================================
-- NOTIFICATIONS TABLE (Legacy)
-- ============================================
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(user_id, is_read) WHERE NOT is_read;


-- ============================================
-- SESSIONS TABLE (Legacy — Redis preferred)
-- ============================================
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id INTEGER NOT NULL REFERENCES users(id),
    user_agent TEXT,
    ip_address VARCHAR(45),
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);


-- ============================================
-- BRANDS TABLE (Legacy)
-- ============================================
CREATE TABLE IF NOT EXISTS brands (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    logo_url VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


-- ============================================
-- FUNCTIONS
-- ============================================

-- Updated at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at trigger to relevant tables
DO $$ BEGIN
    CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_user_security_updated_at BEFORE UPDATE ON user_security
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON collections
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================
-- CLEANUP FUNCTION
-- ============================================

-- Function to clean expired OTPs (run periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_otps()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM otps WHERE expires_at < CURRENT_TIMESTAMP;
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- MIGRATION: Handle existing NULL phone numbers
-- ============================================

-- Update existing NULL phone numbers with placeholder
UPDATE user_profiles 
SET phone = '0000000000', updated_at = CURRENT_TIMESTAMP 
WHERE phone IS NULL;

-- Add constraint after handling NULL values
DO $$ BEGIN
    ALTER TABLE user_profiles 
    ADD CONSTRAINT chk_user_profiles_phone_not_null 
    CHECK (phone IS NOT NULL AND LENGTH(TRIM(phone)) >= 10);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================
-- must_change_password COLUMN (Security)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT FALSE;


-- ============================================
-- INITIAL DATA
-- ⚠️  SECURITY NOTICE: Default passwords below are FOR DEVELOPMENT ONLY.
-- BEFORE GOING TO PRODUCTION:
--   1. Change all default passwords via the admin panel.
--   2. Set must_change_password = TRUE for all seeded accounts.
--   3. Remove or disable the customer@aarya.com test account.
--   4. Rotate GEMINI_API_KEY, RAZORPAY_KEY_SECRET, and SECRET_KEY.
-- ============================================

-- Insert a default admin user (password: admin123 — CHANGE BEFORE PRODUCTION)
INSERT INTO users (email, username, hashed_password, role, email_verified, must_change_password)
VALUES (
    'admin@aarya.com',
    'admin',
    '$2b$12$1jw6vTostduYzRG5u/ry..LlgJrs9W/LAYdV763lPwE4ERzJ6JxO.', -- admin123
    'admin',
    TRUE,
    TRUE  -- Force password change on first login in production
) ON CONFLICT (email) DO NOTHING;

-- Insert a test staff user (password: admin123 — CHANGE BEFORE PRODUCTION)
INSERT INTO users (email, username, hashed_password, role, email_verified, must_change_password)
VALUES (
    'staff@aarya.com',
    'staff',
    '$2b$12$1jw6vTostduYzRG5u/ry..LlgJrs9W/LAYdV763lPwE4ERzJ6JxO.', -- admin123
    'staff',
    TRUE,
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Insert a test customer user (password: admin123 — REMOVE BEFORE PRODUCTION)
INSERT INTO users (email, username, hashed_password, role, email_verified, must_change_password)
VALUES (
    'customer@aarya.com',
    'customer',
    '$2b$12$1jw6vTostduYzRG5u/ry..LlgJrs9W/LAYdV763lPwE4ERzJ6JxO.', -- admin123
    'customer',
    TRUE,
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Insert default collections (with R2 relative image paths)
INSERT INTO collections (name, slug, description, image_url, is_featured, display_order) VALUES
    ('Kurtis', 'kurtis', 'Elegant kurtis for every occasion', 'collections/kurtis.jpg', true, 1),
    ('Sarees', 'sarees', 'Traditional and designer sarees', 'collections/sarees.jpg', true, 2),
    ('Suits & Sets', 'suits-sets', 'Coordinated suits and sets', 'collections/suits.jpg', true, 3),
    ('Lehengas', 'lehengas', 'Bridal and festive lehengas', 'collections/lehengas.jpg', true, 4),
    ('Dupattas', 'dupattas', 'Dupattas and stoles', 'collections/dupattas.jpg', false, 5),
    ('Accessories', 'accessories', 'Bags, jewellery and accessories', 'collections/accessories.jpg', false, 6)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample products with R2 relative image paths (Removed SKU as it is in inventory)
INSERT INTO products (name, slug, description, short_description, base_price, mrp, category_id, is_active, is_featured, is_new_arrival) VALUES
    ('Floral Printed Kurti', 'floral-printed-kurti', 'Beautiful floral printed kurti in soft cotton fabric. Perfect for casual and semi-formal occasions.', 'Floral cotton kurti for everyday elegance', 899.00, 1299.00, 1, true, true, true),
    ('Silk Banarasi Saree', 'silk-banarasi-saree', 'Authentic Banarasi silk saree with intricate zari work. A timeless piece for special occasions.', 'Authentic Banarasi silk saree with zari work', 4999.00, 7500.00, 2, true, true, true),
    ('Embroidered Anarkali Suit', 'embroidered-anarkali-suit', 'Elegant Anarkali suit with heavy embroidery work. Includes dupatta.', 'Embroidered Anarkali suit with dupatta', 2499.00, 3500.00, 3, true, false, true),
    ('Chanderi Silk Kurti', 'chanderi-silk-kurti', 'Lightweight Chanderi silk kurti with delicate prints. Perfect for summer occasions.', 'Chanderi silk kurti with delicate prints', 1299.00, 1800.00, 1, true, true, false),
    ('Designer Lehenga Choli', 'designer-lehenga-choli', 'Stunning designer lehenga choli with mirror work and embroidery. Perfect for weddings and festive occasions.', 'Designer lehenga with mirror work', 8999.00, 14000.00, 4, true, true, false)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample inventory for products
INSERT INTO inventory (product_id, sku, size, color, quantity, low_stock_threshold, variant_price)
SELECT id, 'FPK-S-RED', 'S', 'Red', 50, 5, 899.00 FROM products WHERE slug = 'floral-printed-kurti'
UNION ALL
SELECT id, 'FPK-M-RED', 'M', 'Red', 50, 5, 899.00 FROM products WHERE slug = 'floral-printed-kurti'
UNION ALL
SELECT id, 'SBS-FREE-GOLD', 'FREE', 'Gold', 20, 2, 4999.00 FROM products WHERE slug = 'silk-banarasi-saree'
UNION ALL
SELECT id, 'EAS-L-BLUE', 'L', 'Blue', 30, 5, 2499.00 FROM products WHERE slug = 'embroidered-anarkali-suit'
ON CONFLICT DO NOTHING;

-- Insert admin profile
INSERT INTO user_profiles (user_id, full_name, phone)
SELECT id, 'System Administrator', '9999999999' FROM users WHERE email = 'admin@aarya.com'
ON CONFLICT DO NOTHING;

-- Insert staff profile
INSERT INTO user_profiles (user_id, full_name, phone)
SELECT id, 'Store Manager', '8888888888' FROM users WHERE email = 'staff@aarya.com'
ON CONFLICT DO NOTHING;

-- Insert customer profile
INSERT INTO user_profiles (user_id, full_name, phone)
SELECT id, 'John Doe', '7777777777' FROM users WHERE email = 'customer@aarya.com'
ON CONFLICT DO NOTHING;


-- Insert default landing page configuration
-- These serve as the single source of truth for default values
-- Backend uses these when available, falls back to hardcoded defaults if empty
INSERT INTO landing_config (section, config) VALUES
    ('hero', '{"tagline": "Designed with Elegance, Worn with Confidence", "button1_text": "Shop New Arrivals", "button1_link": "/products", "button2_text": "Explore Collections", "button2_link": "/collections"}'),
    ('newArrivals', '{"title": "New Arrivals", "subtitle": "Discover our latest collection of timeless pieces, crafted for the modern individual who values elegance and comfort.", "max_display": 8}'),
    ('collections', '{"title": "Curated Collections", "max_display": 6}'),
    ('about', '{"title": "The Art of Elegance", "description": "Aarya Clothing is a Jaipur-based fashion brand founded in 2020, created with a simple vision — to offer stylish, high-quality clothing at reasonable prices, just a click away.\\n\\nWhat began with a few live sessions on Facebook soon grew into a trusted independent brand, powered by customer love and support. Rooted in Jaipur''s rich textile heritage and inspired by modern fashion trends, our collections blend style, comfort, and affordability.\\n\\nAt Aarya Clothing, we make it easy for every woman to discover fashion she truly loves — updated, accessible, and confidently chosen."}'),
    ('featured_categories', '{"title": "Shop by Category", "max_display": 6}'),
    ('promotions', '{"title": "Special Offers", "enabled": true}')
ON CONFLICT (section) DO NOTHING;

-- Insert default hero images (R2 URLs)
INSERT INTO landing_images (section, image_url, title, subtitle, link_url, display_order) VALUES
    ('hero', 'hero/hero1.png', NULL, NULL, NULL, 1),
    ('hero', 'hero/hero2.png', NULL, NULL, NULL, 2),
    ('hero', 'hero/hero3.png', NULL, NULL, NULL, 3)
ON CONFLICT DO NOTHING;

-- Insert default about section images (R2 URLs)
INSERT INTO landing_images (section, image_url, display_order) VALUES
    ('about', 'about/kurti1.jpg', 1),
    ('about', 'about/kurti2.jpg', 2)
ON CONFLICT DO NOTHING;

-- ============================================
-- LANDING PRODUCTS TABLE (Admin Service)
-- Admin-selected products for landing page sections
-- ============================================
CREATE TABLE IF NOT EXISTS landing_products (
    id SERIAL PRIMARY KEY,
    section VARCHAR(50) NOT NULL,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_landing_product_section UNIQUE (section, product_id)
);

CREATE INDEX IF NOT EXISTS idx_landing_products_section ON landing_products(section, display_order, is_active);

-- Seed: auto-select first 8 active products for newArrivals
INSERT INTO landing_products (section, product_id, display_order, is_active)
SELECT 
    'newArrivals' AS section,
    p.id AS product_id,
    (ROW_NUMBER() OVER (ORDER BY p.created_at DESC) - 1) AS display_order,
    TRUE AS is_active
FROM products p
WHERE p.is_active = true
LIMIT 8
ON CONFLICT DO NOTHING;

-- Insert default payment methods
INSERT INTO payment_methods (name, display_name, is_active, config) VALUES
    ('razorpay', 'Razorpay', true, '{"supports": ["upi", "cards", "netbanking", "wallets"]}')
ON CONFLICT DO NOTHING;


-- ============================================
-- SITE CONFIG TABLE (Core Service)
-- General site settings
-- ============================================
CREATE TABLE IF NOT EXISTS site_config (
    key VARCHAR(100) PRIMARY KEY,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed initial config
INSERT INTO site_config (key, value, description) VALUES
    ('site_name', 'Aarya Clothing', 'The name of the store'),
    ('contact_email', 'contact@aaryaclothing.com', 'Primary contact email'),
    ('contact_phone', '+91 99999 99999', 'Primary contact phone'),
    ('address', 'Jaipur, Rajasthan, India', 'Physical address of the store'),
    ('currency', 'INR', 'Default store currency'),
    ('free_shipping_threshold', '1000', 'Amount above which shipping is free'),
    ('intro_video_url', 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/Create_a_video_202602141450_ub9p5.mp4', 'URL of the intro video'),
    ('intro_video_enabled', 'true', 'Whether to show the intro video'),
    ('logo_url', 'https://pub-7846c786f7154610b57735df47899fa0.r2.dev/logo.png', 'URL of the brand logo')
ON CONFLICT (key) DO NOTHING;


-- ============================================
-- ADDITIONAL FOREIGN KEY CONSTRAINTS
-- ============================================

-- Order items table constraints
ALTER TABLE order_items 
DROP CONSTRAINT IF EXISTS fk_order_items_inventory_id;
ALTER TABLE order_items 
ADD CONSTRAINT fk_order_items_inventory_id 
FOREIGN KEY (inventory_id) REFERENCES inventory(id) ON DELETE SET NULL;

-- Addresses table - add FK to users
ALTER TABLE addresses 
ADD CONSTRAINT fk_addresses_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Reviews table - add FKs
ALTER TABLE reviews 
ADD CONSTRAINT fk_reviews_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Wishlist table - add FKs
ALTER TABLE wishlist 
ADD CONSTRAINT fk_wishlist_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Return requests table - add user_id FK
ALTER TABLE return_requests 
ADD CONSTRAINT fk_return_requests_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Payment transactions table - add FKs
ALTER TABLE payment_transactions 
ADD CONSTRAINT fk_payment_transactions_order_id 
FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE RESTRICT;

ALTER TABLE payment_transactions 
ADD CONSTRAINT fk_payment_transactions_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Chat rooms table
ALTER TABLE chat_rooms 
ADD CONSTRAINT fk_chat_rooms_customer_id 
FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE chat_rooms 
ADD CONSTRAINT fk_chat_rooms_assigned_to 
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- Chat messages table
ALTER TABLE chat_messages 
ADD CONSTRAINT fk_chat_messages_sender_id 
FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL;

-- Promotion usage
ALTER TABLE promotion_usage 
ADD CONSTRAINT fk_promotion_usage_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Staff tasks
ALTER TABLE staff_tasks 
ADD CONSTRAINT fk_staff_tasks_assigned_to 
FOREIGN KEY (assigned_to) REFERENCES users(id) ON DELETE SET NULL;

-- Staff notifications
ALTER TABLE staff_notifications 
ADD CONSTRAINT fk_staff_notifications_user_id 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

-- Landing config
ALTER TABLE landing_config 
ADD CONSTRAINT fk_landing_config_updated_by 
FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL;

-- Inventory movements
ALTER TABLE inventory_movements 
ADD CONSTRAINT fk_inventory_movements_performed_by 
FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL;


-- ============================================
-- ADDITIONAL PERFORMANCE INDEXES
-- ============================================

-- User-related indexes
CREATE INDEX IF NOT EXISTS idx_users_email_verified ON users(email_verified);
CREATE INDEX IF NOT EXISTS idx_users_role_active ON users(role, is_active);

-- Order-related indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);

-- Product-related indexes
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_name_gin ON products USING GIN(to_tsvector('english', name));
CREATE INDEX IF NOT EXISTS idx_products_description_gin ON products USING GIN(to_tsvector('english', COALESCE(description, '')));

-- Inventory indexes
CREATE INDEX IF NOT EXISTS idx_inventory_quantity ON inventory(quantity);
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(quantity, low_stock_threshold) WHERE quantity <= low_stock_threshold;

-- Review indexes
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_product_approved_rating ON reviews(product_id, is_approved, rating DESC, created_at DESC);

-- Chat indexes
CREATE INDEX IF NOT EXISTS idx_chat_rooms_customer_id ON chat_rooms(customer_id);
CREATE INDEX IF NOT EXISTS idx_chat_rooms_assigned_to ON chat_rooms(assigned_to);

-- Promotion indexes
CREATE INDEX IF NOT EXISTS idx_promotions_valid_from ON promotions(valid_from);
CREATE INDEX IF NOT EXISTS idx_promotions_valid_until ON promotions(valid_until);
CREATE INDEX IF NOT EXISTS idx_promotions_active_dates ON promotions(is_active, valid_from, valid_until) WHERE is_active = true;


-- ============================================
-- CHECK CONSTRAINTS FOR DATA INTEGRITY
-- ============================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_price_non_negative') THEN
        ALTER TABLE products ADD CONSTRAINT chk_products_price_non_negative CHECK (base_price >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_items_price_non_negative') THEN
        ALTER TABLE order_items ADD CONSTRAINT chk_order_items_price_non_negative CHECK (unit_price >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_order_items_quantity_positive') THEN
        ALTER TABLE order_items ADD CONSTRAINT chk_order_items_quantity_positive CHECK (quantity > 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_inventory_quantity_non_negative') THEN
        ALTER TABLE inventory ADD CONSTRAINT chk_inventory_quantity_non_negative CHECK (quantity >= 0);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_total_amount_non_negative') THEN
        ALTER TABLE orders ADD CONSTRAINT chk_orders_total_amount_non_negative CHECK (total_amount >= 0);
    END IF;
END $$;


-- ============================================
-- TRIGGERS FOR DATA CONSISTENCY
-- ============================================

-- Trigger to update product total_stock when inventory changes
CREATE OR REPLACE FUNCTION update_product_total_stock()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE products 
        SET total_stock = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM inventory 
            WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
        )
        WHERE id = COALESCE(NEW.product_id, OLD.product_id);
        RETURN COALESCE(NEW, OLD);
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE products 
        SET total_stock = (
            SELECT COALESCE(SUM(quantity), 0) 
            FROM inventory 
            WHERE product_id = OLD.product_id
        )
        WHERE id = OLD.product_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_total_stock ON inventory;
CREATE TRIGGER trigger_update_product_total_stock
    AFTER INSERT OR UPDATE OR DELETE ON inventory
    FOR EACH ROW EXECUTE FUNCTION update_product_total_stock();

-- Trigger to update product average rating when reviews change
CREATE OR REPLACE FUNCTION update_product_rating()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE products 
    SET average_rating = (
        SELECT COALESCE(AVG(rating)::DECIMAL(3,2), 0) 
        FROM reviews 
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true
    ),
    review_count = (
        SELECT COUNT(*) 
        FROM reviews 
        WHERE product_id = COALESCE(NEW.product_id, OLD.product_id) AND is_approved = true
    )
    WHERE id = COALESCE(NEW.product_id, OLD.product_id);
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_product_rating ON reviews;
CREATE TRIGGER trigger_update_product_rating
    AFTER INSERT OR UPDATE OR DELETE ON reviews
    FOR EACH ROW EXECUTE FUNCTION update_product_rating();


-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- View for product details with inventory
DROP VIEW IF EXISTS product_details_view;
CREATE VIEW product_details_view AS
SELECT 
    p.id,
    p.name,
    p.slug,
    p.description,
    p.base_price,
    p.average_rating,
    p.review_count,
    p.total_stock,
    p.is_active,
    p.created_at,
    p.updated_at,
    c.name as category_name,
    c.slug as category_slug,
    COALESCE(SUM(inv.quantity), 0) as available_quantity,
    MIN(inv.low_stock_threshold) as low_stock_threshold
FROM products p
LEFT JOIN collections c ON p.category_id = c.id
LEFT JOIN inventory inv ON p.id = inv.product_id
GROUP BY p.id, p.name, p.slug, p.description, p.base_price, p.average_rating, 
         p.review_count, p.total_stock, p.is_active, p.created_at, p.updated_at,
         c.name, c.slug;

-- View for order details with customer info
DROP VIEW IF EXISTS order_details_view;
CREATE VIEW order_details_view AS
SELECT 
    o.id,
    o.user_id,
    u.email as customer_email,
    u.username as customer_username,
    up.full_name as customer_name,
    o.total_amount,
    o.status,
    o.created_at,
    o.shipped_at,
    o.delivered_at,
    o.cancelled_at,
    COUNT(oi.id) as item_count
FROM orders o
JOIN users u ON o.user_id = u.id
LEFT JOIN user_profiles up ON u.id = up.user_id
LEFT JOIN order_items oi ON o.id = oi.order_id
GROUP BY o.id, u.email, u.username, up.full_name;

-- View for low stock products
DROP VIEW IF EXISTS low_stock_view;
CREATE VIEW low_stock_view AS
SELECT 
    p.id,
    p.name,
    inv.sku,
    inv.quantity,
    inv.low_stock_threshold,
    (inv.low_stock_threshold - inv.quantity) as shortage_amount
FROM products p
JOIN inventory inv ON p.id = inv.product_id
WHERE inv.quantity <= inv.low_stock_threshold
AND p.is_active = true;


-- ============================================
-- SCHEMA MIGRATIONS (Additive — safe to re-run)
-- ============================================

-- Add updated_at to product_images (missing from original schema)
ALTER TABLE product_images ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Add composite index on product_images for ordered fetches
CREATE INDEX IF NOT EXISTS idx_product_images_product_order ON product_images(product_id, display_order, is_primary);

-- Composite index: active products by category + creation date (admin listing optimization)
CREATE INDEX IF NOT EXISTS idx_products_active_category_created ON products(is_active, category_id, created_at DESC);

-- Composite index: category + featured flag for landing page queries  
CREATE INDEX IF NOT EXISTS idx_products_featured_category ON products(is_featured, category_id) WHERE is_featured = true;

-- Composite index: new arrivals by creation date
CREATE INDEX IF NOT EXISTS idx_products_new_arrival_created ON products(is_new_arrival, created_at DESC) WHERE is_new_arrival = true;

-- Add CHECK constraint on landing_products.section to only allow known values
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_landing_products_section') THEN
        ALTER TABLE landing_products ADD CONSTRAINT chk_landing_products_section
            CHECK (section IN ('hero', 'featured', 'newArrivals', 'trending', 'collections', 'sale'));
    END IF;
END $$;

-- Add CHECK constraint: mrp must be >= base_price when both are set
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_products_mrp_gte_base_price') THEN
        ALTER TABLE products ADD CONSTRAINT chk_products_mrp_gte_base_price
            CHECK (mrp IS NULL OR mrp >= base_price);
    END IF;
END $$;


-- ============================================
-- UPDATED_AT AUTO-TRIGGER FUNCTION (generic)
-- ============================================

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to products
DROP TRIGGER IF EXISTS trigger_products_updated_at ON products;
CREATE TRIGGER trigger_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to product_images
DROP TRIGGER IF EXISTS trigger_product_images_updated_at ON product_images;
CREATE TRIGGER trigger_product_images_updated_at
    BEFORE UPDATE ON product_images
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to inventory
DROP TRIGGER IF EXISTS trigger_inventory_updated_at ON inventory;
CREATE TRIGGER trigger_inventory_updated_at
    BEFORE UPDATE ON inventory
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to orders
DROP TRIGGER IF EXISTS trigger_orders_updated_at ON orders;
CREATE TRIGGER trigger_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to collections
DROP TRIGGER IF EXISTS trigger_collections_updated_at ON collections;
CREATE TRIGGER trigger_collections_updated_at
    BEFORE UPDATE ON collections
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to users
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Apply to landing_products
DROP TRIGGER IF EXISTS trigger_landing_products_updated_at ON landing_products;
CREATE TRIGGER trigger_landing_products_updated_at
    BEFORE UPDATE ON landing_products
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ============================================
-- AI SESSIONS TABLE
-- Tracks customer and admin AI conversations + cost
-- ============================================
CREATE TABLE IF NOT EXISTS ai_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL UNIQUE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'customer',  -- 'customer' | 'admin'
    total_tokens_in INTEGER DEFAULT 0,
    total_tokens_out INTEGER DEFAULT 0,
    total_cost DECIMAL(12, 8) DEFAULT 0,
    message_count INTEGER DEFAULT 0,
    context_summary TEXT,  -- compressed history for long sessions
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_sessions_user ON ai_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_role ON ai_sessions(role);
CREATE INDEX IF NOT EXISTS idx_ai_sessions_activity ON ai_sessions(last_activity DESC);


-- ============================================
-- AI MESSAGES TABLE
-- Individual messages with token/cost breakdown
-- ============================================
CREATE TABLE IF NOT EXISTS ai_messages (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR(100) NOT NULL REFERENCES ai_sessions(session_id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,  -- 'user' | 'assistant' | 'tool'
    content TEXT,
    image_urls JSONB,           -- for multimodal messages
    tool_calls JSONB,           -- tool call requests by assistant
    tool_results JSONB,         -- tool call responses
    tokens_in INTEGER DEFAULT 0,
    tokens_out INTEGER DEFAULT 0,
    cost DECIMAL(12, 8) DEFAULT 0,
    model_used VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_messages_session ON ai_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_messages_created ON ai_messages(created_at DESC);


-- ============================================
-- AI SETTINGS TABLE
-- Stores API keys, model config, cost limits
-- ============================================
CREATE TABLE IF NOT EXISTS ai_settings (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    is_secret BOOLEAN DEFAULT FALSE,
    category VARCHAR(50) DEFAULT 'general',  -- 'api_keys' | 'models' | 'limits' | 'language' | 'general'
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_settings_key ON ai_settings(key);
CREATE INDEX IF NOT EXISTS idx_ai_settings_category ON ai_settings(category);

-- Default settings (DO UPDATE ensures keys are refreshed on re-init)
INSERT INTO ai_settings (key, value, description, is_secret, category) VALUES
    ('CUSTOMER_MODEL',     'gemini-2.0-flash-lite',  'Gemini model for customer AI (Aarya)',           FALSE, 'models'),
    ('ADMIN_MODEL',        'gemini-2.0-flash',        'Gemini model for admin AI (Aria)',               FALSE, 'models'),
    ('CUSTOMER_MAX_TOKENS','512',                     'Max output tokens for customer chat',            FALSE, 'models'),
    ('ADMIN_MAX_TOKENS',   '2048',                    'Max output tokens for admin chat',               FALSE, 'models'),
    ('CUSTOMER_HISTORY',   '6',                       'Message history length for customer',            FALSE, 'models'),
    ('ADMIN_HISTORY',      '10',                      'Message history length for admin',               FALSE, 'models'),
    ('MONTHLY_COST_LIMIT', '10.00',                   'Monthly cost limit in USD (alert)',              FALSE, 'limits'),
    ('DAILY_COST_LIMIT',   '1.00',                    'Daily cost limit in USD (alert)',                FALSE, 'limits'),
    ('HINDI_SUPPORT',      'true',                    'Enable Hindi/bilingual support',                 FALSE, 'language'),
    ('CUSTOMER_LANGUAGE',  'auto',                    'Customer AI language: auto/en/hi',               FALSE, 'language'),
    ('AI_PROVIDER',        'gemini',                  'Admin AI provider: gemini|openai|anthropic|groq',FALSE, 'models'),
    ('OPENAI_API_KEY',     '',                        'OpenAI API key (sk-...)',                         TRUE,  'api_keys'),
    ('GROQ_API_KEY',       '',                        'Groq API key (gsk_...) - free tier available',   TRUE,  'api_keys'),
    ('ANTHROPIC_API_KEY',  '',                        'Anthropic API key (sk-ant-...)',                  TRUE,  'api_keys'),
    ('OPENAI_DEFAULT_MODEL', 'gpt-4o-mini',            'Default OpenAI model (text-only)',               FALSE, 'models'),
    ('GROQ_DEFAULT_MODEL',   'llama-3.3-70b-versatile',   'Default Groq model (free)',                      FALSE, 'models'),
    ('ANTHROPIC_DEFAULT_MODEL', 'claude-3-haiku-20240307','Default Anthropic model (budget)',               FALSE, 'models')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- SEED OPENAI KEY FROM ENV (run after first init via psql or migration)
-- Admin can update this via the AI Settings page in the dashboard
-- ============================================
-- To manually seed the OpenAI key after container start, run:
-- UPDATE ai_settings SET value = 'sk-proj-YOUR_KEY_HERE' WHERE key = 'OPENAI_API_KEY';


-- ============================================
-- SUPERADMIN FLAG (additive column)
-- ============================================
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_superadmin BOOLEAN DEFAULT FALSE;

-- ============================================
-- PAYMENT METHOD MIGRATION: Add Cashfree support
-- ============================================

-- Keep both online and direct payment methods supported by the app.
ALTER TABLE orders ALTER COLUMN status SET DEFAULT 'confirmed';

-- Drop old razorpay-only constraints if they exist
DO $$ BEGIN
    ALTER TABLE orders DROP CONSTRAINT IF EXISTS chk_orders_payment_method;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE payment_transactions DROP CONSTRAINT IF EXISTS chk_payment_transactions_payment_method;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Add new constraint: support both online and direct payment methods used by the app.
DO $$ BEGIN
    ALTER TABLE orders ADD CONSTRAINT chk_orders_payment_method
        CHECK (payment_method IS NULL OR payment_method IN ('cashfree', 'razorpay', 'easebuzz', 'upi', 'bank_transfer', 'wallet', 'cod'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE payment_transactions ADD CONSTRAINT chk_payment_transactions_payment_method
        CHECK (payment_method IS NULL OR payment_method IN ('cashfree', 'razorpay', 'easebuzz', 'upi', 'bank_transfer', 'wallet', 'cod'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Ensure key payment methods exist for existing and fresh deployments.
INSERT INTO payment_methods (name, display_name, is_active, config)
SELECT 'cashfree', 'Cashfree (UPI/Cards/NetBanking)', TRUE, '{}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM payment_methods WHERE name = 'cashfree'
);

INSERT INTO payment_methods (name, display_name, is_active, config)
SELECT 'cod', 'Cash on Delivery', TRUE, '{}'::jsonb
WHERE NOT EXISTS (
    SELECT 1 FROM payment_methods WHERE name = 'cod'
);

-- Update Razorpay to inactive (Cashfree is now primary)
UPDATE payment_methods SET is_active = FALSE WHERE name = 'razorpay';

-- Add indexes for payment_method query performance
CREATE INDEX IF NOT EXISTS idx_orders_payment_method ON orders(payment_method);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_payment_method ON payment_transactions(payment_method);
CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_sku ON inventory(sku);

-- Sequence for race-free invoice number generation
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START 1 INCREMENT 1;

-- Performance indexes for order queries (prevents N+1 and slow dashboard)
CREATE INDEX IF NOT EXISTS idx_order_items_order_status ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order_user ON payment_transactions(order_id, user_id);
CREATE INDEX IF NOT EXISTS idx_order_tracking_status ON order_tracking(status);
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- ============================================
-- HIGH-PERFORMANCE INDEXES FOR 100K+ USERS
-- ============================================

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_orders_user_status_created ON orders(user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created ON orders(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON orders(payment_method, status) WHERE payment_method IS NOT NULL;

-- Products: category + active + created (for listing pages)
CREATE INDEX IF NOT EXISTS idx_products_category_active_created ON products(category_id, is_active, created_at DESC) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_products_category_featured ON products(category_id, is_featured) WHERE is_active = true AND is_featured = true;
CREATE INDEX IF NOT EXISTS idx_products_active_new ON products(id, created_at DESC) WHERE is_active = true AND is_new_arrival = true;
CREATE INDEX IF NOT EXISTS idx_products_search_active ON products(name, category_id, is_active) WHERE is_active = true;

-- Inventory: product + availability
CREATE INDEX IF NOT EXISTS idx_inventory_product_available ON inventory(product_id, quantity, reserved_quantity) WHERE quantity > 0;
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(product_id, quantity) WHERE quantity <= low_stock_threshold;
CREATE INDEX IF NOT EXISTS idx_inventory_sku_available ON inventory(sku, quantity) WHERE quantity > 0;

-- Order Items: fast order detail retrieval
CREATE INDEX IF NOT EXISTS idx_order_items_order_product ON order_items(order_id, product_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Cart Reservations: active reservations
CREATE INDEX IF NOT EXISTS idx_cart_reservations_user_status ON cart_reservations(user_id, status, expires_at);
CREATE INDEX IF NOT EXISTS idx_cart_reservations_pending ON cart_reservations(status, expires_at) WHERE status = 'pending';

-- Partial indexes for boolean filters (smaller, faster)
CREATE INDEX IF NOT EXISTS idx_products_active_only ON products(id, name, created_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_users_active_customers ON users(id, email, created_at) WHERE role = 'customer' AND is_active = true;
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(id, user_id, created_at) WHERE status = 'confirmed';

-- Full-text search support (will be populated by trigger)
ALTER TABLE products ADD COLUMN IF NOT EXISTS search_vector tsvector;
CREATE INDEX IF NOT EXISTS idx_products_search_vector ON products USING GIN(search_vector);

-- Create trigger for auto-updating search vector
CREATE OR REPLACE FUNCTION products_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(NEW.short_description, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_search_vector_trigger
    BEFORE INSERT OR UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION products_search_vector_update();

-- Populate existing products
UPDATE products SET search_vector =
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(short_description, '')), 'C');

-- Index for cart lookups
CREATE INDEX IF NOT EXISTS idx_inventory_sku_product ON inventory(sku, product_id);
