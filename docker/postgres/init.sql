-- Aarya Clothing - Clean Consolidated Schema
-- Single source of truth for fresh installs. Existing DBs use migrations/0001_clean_product_model.sql.
-- Postgres 15 + pgvector. All timestamps in Asia/Kolkata (set below).

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

SET timezone = 'Asia/Kolkata';
-- Persist Asia/Kolkata for every future connection so func.now() / NOW()
-- defaults emit IST. Without this the SET only affects the init script.
ALTER DATABASE aarya_clothing SET timezone TO 'Asia/Kolkata';

-- ============================================
-- ENUMS
-- ============================================
CREATE TYPE user_role AS ENUM ('admin', 'staff', 'customer', 'super_admin');
CREATE TYPE order_status AS ENUM ('confirmed', 'shipped', 'delivered', 'cancelled');
CREATE TYPE address_type AS ENUM ('shipping', 'billing', 'both');
CREATE TYPE discount_type AS ENUM ('percentage', 'fixed');
CREATE TYPE return_reason AS ENUM ('defective', 'wrong_item', 'not_as_described', 'size_issue', 'color_issue', 'changed_mind', 'other');
CREATE TYPE return_status AS ENUM ('requested', 'approved', 'rejected', 'received', 'refunded', 'completed');
CREATE TYPE return_type AS ENUM ('return', 'exchange');
CREATE TYPE chat_status AS ENUM ('open', 'assigned', 'resolved', 'closed');
CREATE TYPE sender_type AS ENUM ('customer', 'staff', 'admin', 'system', 'ai');

-- ============================================
-- USERS
-- ============================================
CREATE TABLE users (
    id                    SERIAL PRIMARY KEY,
    email                 VARCHAR(255) NOT NULL UNIQUE,
    username              VARCHAR(50)  NOT NULL UNIQUE,
    hashed_password       VARCHAR(255) NOT NULL,
    role                  user_role DEFAULT 'customer',
    is_active             BOOLEAN DEFAULT TRUE,
    email_verified        BOOLEAN DEFAULT FALSE,
    phone                 VARCHAR(20)  NOT NULL,
    first_name            VARCHAR(50),
    last_name             VARCHAR(50),
    full_name             VARCHAR(100) GENERATED ALWAYS AS (TRIM(BOTH ' ' FROM COALESCE(first_name,'') || ' ' || COALESCE(last_name,''))) STORED,
    avatar_url            VARCHAR(500),
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until          TIMESTAMP,
    last_login_at         TIMESTAMP,
    last_login_ip         VARCHAR(45),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_email_check     CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
    CONSTRAINT users_username_length CHECK (LENGTH(username) >= 3),
    CONSTRAINT users_password_length CHECK (LENGTH(hashed_password) >= 60)
);

CREATE TABLE verification_tokens (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token       VARCHAR(255) NOT NULL UNIQUE,
    token_type  VARCHAR(20) DEFAULT 'email_verification'
        CHECK (token_type IN ('email_verification', 'password_reset', 'phone_verification')),
    expires_at  TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    ip_address  VARCHAR(45),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Devices the user has explicitly verified via OTP. When a login arrives
-- with a fingerprint already trusted by that user, the backend skips the
-- second-factor OTP challenge ("re-prompt OTP only on new devices").
CREATE TABLE trusted_devices (
    id            SERIAL PRIMARY KEY,
    user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    fingerprint   VARCHAR(128) NOT NULL,
    device_name   VARCHAR(120),
    last_ip       VARCHAR(64),
    user_agent    VARCHAR(512),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_seen_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    revoked_at    TIMESTAMP,
    UNIQUE (user_id, fingerprint)
);
CREATE INDEX idx_trusted_devices_user ON trusted_devices(user_id);
CREATE INDEX idx_trusted_devices_fp   ON trusted_devices(fingerprint);

-- ============================================
-- COMMERCE - clean nested product model
-- ============================================
-- Hierarchy:
--   Collection 1 -> N  Product
--   Product    1 -> N  ProductImage      (gallery, optional extras)
--   Product    1 -> N  ProductVariant    (size + color + qty + image)
--   Variant    1 -> N  InventoryMovement (audit trail)

CREATE TABLE collections (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(100) NOT NULL,
    slug          VARCHAR(100) UNIQUE NOT NULL,
    description   TEXT,
    image_url     VARCHAR(500),
    display_order INTEGER DEFAULT 0,
    is_active     BOOLEAN DEFAULT TRUE,
    is_featured   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE products (
    id            SERIAL PRIMARY KEY,
    name          VARCHAR(255) NOT NULL,
    slug          VARCHAR(255) UNIQUE NOT NULL,
    description   TEXT NOT NULL,
    price         DECIMAL(10, 2) NOT NULL CHECK (price >= 0),
    collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE RESTRICT,
    primary_image VARCHAR(500) NOT NULL,
    is_active     BOOLEAN DEFAULT TRUE,
    is_featured   BOOLEAN DEFAULT FALSE,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_images (
    id            SERIAL PRIMARY KEY,
    product_id    INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    image_url     VARCHAR(500) NOT NULL,
    display_order INTEGER DEFAULT 0,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE product_variants (
    id                  SERIAL PRIMARY KEY,
    product_id          INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    sku                 VARCHAR(64)  NOT NULL UNIQUE,
    size                VARCHAR(16)  NOT NULL,
    color               VARCHAR(32)  NOT NULL,
    color_hex           VARCHAR(7),
    image_url           VARCHAR(500) NOT NULL,
    quantity            INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reserved_quantity   INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
    low_stock_threshold INTEGER NOT NULL DEFAULT 5  CHECK (low_stock_threshold >= 0),
    is_active           BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_id, size, color)
);

-- Backwards-compatibility view: legacy code paths still query "inventory".
-- It's a simple updatable view over product_variants so reads, INSERTs,
-- UPDATEs and DELETEs all work transparently while we finish migrating
-- callers off the old name.
CREATE OR REPLACE VIEW inventory AS
SELECT
    id,
    product_id,
    sku,
    size,
    color,
    color_hex,
    image_url,
    quantity,
    reserved_quantity,
    low_stock_threshold,
    NULL::DECIMAL(10, 2) AS variant_price,
    is_active,
    created_at,
    updated_at
FROM product_variants;

CREATE TABLE inventory_movements (
    id           SERIAL PRIMARY KEY,
    variant_id   INTEGER NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
    delta        INTEGER NOT NULL,
    reason       VARCHAR(32) NOT NULL,  -- 'order' | 'restock' | 'manual' | 'return' | 'correction'
    notes        TEXT,
    performed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- ADDRESSES, ORDERS, ORDER ITEMS
-- ============================================
CREATE TABLE addresses (
    id             SERIAL PRIMARY KEY,
    user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    address_type   address_type DEFAULT 'shipping',
    full_name      VARCHAR(100) NOT NULL,
    phone          VARCHAR(20)  NOT NULL,
    email          VARCHAR(255),
    address_line1  VARCHAR(255) NOT NULL,
    address_line2  VARCHAR(255),
    city           VARCHAR(100) NOT NULL,
    state          VARCHAR(100) NOT NULL,
    postal_code    VARCHAR(20)  NOT NULL,
    country        VARCHAR(100) DEFAULT 'India',
    landmark       VARCHAR(255),
    is_default     BOOLEAN DEFAULT FALSE,
    is_active      BOOLEAN DEFAULT TRUE,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE orders (
    id                  SERIAL PRIMARY KEY,
    user_id             INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    invoice_number      VARCHAR(50) UNIQUE,
    subtotal            DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount_applied    DECIMAL(10, 2) DEFAULT 0,
    promo_code          VARCHAR(50),
    shipping_cost       DECIMAL(10, 2) DEFAULT 0,
    total_amount        DECIMAL(10, 2) NOT NULL,
    payment_method      VARCHAR(50),
    status              order_status DEFAULT 'confirmed',
    shipping_address_id INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
    shipping_address    TEXT,
    billing_address_id  INTEGER REFERENCES addresses(id) ON DELETE SET NULL,
    shipping_method     VARCHAR(50),
    tracking_number     VARCHAR(100),
    order_notes         TEXT,
    transaction_id      VARCHAR(255),
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    cancelled_at        TIMESTAMP,
    cancellation_reason TEXT,
    shipped_at          TIMESTAMP,
    delivered_at        TIMESTAMP
);

CREATE TABLE order_items (
    id            SERIAL PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    variant_id    INTEGER NOT NULL REFERENCES product_variants(id),
    product_id    INTEGER NOT NULL REFERENCES products(id),
    product_name  VARCHAR(255) NOT NULL,
    sku           VARCHAR(64)  NOT NULL,
    size          VARCHAR(16),
    color         VARCHAR(32),
    image_url     VARCHAR(500),
    quantity      INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price    DECIMAL(10, 2) NOT NULL,
    line_total    DECIMAL(10, 2) NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE wishlist (
    id         SERIAL PRIMARY KEY,
    user_id    INTEGER NOT NULL REFERENCES users(id)    ON DELETE CASCADE,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_wishlist_user_product UNIQUE (user_id, product_id)
);

-- Stock reservations: temporarily holds variant stock during checkout/payment so
-- two customers can't oversell the same SKU. Reaped by a background job once
-- expires_at passes (see Phase 4 for the cron worker).
CREATE TABLE stock_reservations (
    id              SERIAL PRIMARY KEY,
    reservation_id  VARCHAR(100) NOT NULL UNIQUE,
    user_id         INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sku             VARCHAR(64)  NOT NULL,
    quantity        INTEGER      NOT NULL CHECK (quantity > 0),
    status          VARCHAR(20)  NOT NULL DEFAULT 'pending',
    expires_at      TIMESTAMP    NOT NULL,
    order_id        INTEGER REFERENCES orders(id) ON DELETE SET NULL,
    payment_ref     VARCHAR(255),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- PAYMENTS
-- ============================================
CREATE TABLE payment_transactions (
    id                  SERIAL PRIMARY KEY,
    order_id            INTEGER NOT NULL,
    user_id             INTEGER NOT NULL,
    amount              DECIMAL(10, 2) NOT NULL,
    currency            VARCHAR(10) DEFAULT 'INR',
    payment_method      VARCHAR(50),
    razorpay_order_id   VARCHAR(255),
    razorpay_payment_id VARCHAR(255),
    razorpay_signature  VARCHAR(500),
    transaction_id      VARCHAR(255) UNIQUE,
    status              VARCHAR(50) DEFAULT 'pending',
    gateway_response    JSONB,
    description         TEXT,
    customer_email      VARCHAR(255),
    customer_phone      VARCHAR(20),
    refund_amount       DECIMAL(10, 2),
    refund_id           VARCHAR(255),
    refund_status       VARCHAR(50),
    refund_reason       TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at        TIMESTAMP
);

-- ============================================
-- REVIEWS, PROMOTIONS, RETURNS, CHAT
-- ============================================
CREATE TABLE reviews (
    id                   SERIAL PRIMARY KEY,
    product_id           INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    user_id              INTEGER NOT NULL REFERENCES users(id)    ON DELETE SET NULL,
    order_id             INTEGER REFERENCES orders(id)            ON DELETE SET NULL,
    rating               INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title                VARCHAR(255),
    comment              TEXT,
    image_urls           TEXT[] DEFAULT '{}',
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    is_approved          BOOLEAN DEFAULT FALSE,
    helpful_count        INTEGER DEFAULT 0,
    created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promotions (
    id                  SERIAL PRIMARY KEY,
    code                VARCHAR(50) NOT NULL UNIQUE,
    description         TEXT,
    discount_type       discount_type NOT NULL,
    discount_value      DECIMAL(10, 2) NOT NULL,
    min_order_value     DECIMAL(10, 2) DEFAULT 0,
    max_discount_amount DECIMAL(10, 2),
    max_uses            INTEGER,
    used_count          INTEGER DEFAULT 0,
    max_uses_per_user   INTEGER DEFAULT 1,
    is_active           BOOLEAN DEFAULT TRUE,
    valid_from          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_until         TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE promotion_usage (
    id              SERIAL PRIMARY KEY,
    promotion_id    INTEGER NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    user_id         INTEGER NOT NULL,
    order_id        INTEGER REFERENCES orders(id),
    discount_amount DECIMAL(10, 2) NOT NULL,
    used_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE return_requests (
    id                     SERIAL PRIMARY KEY,
    order_id               INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    user_id                INTEGER NOT NULL,
    reason                 return_reason NOT NULL,
    type                   return_type DEFAULT 'return',
    items                  JSONB DEFAULT '[]'::jsonb,
    description            TEXT,
    status                 return_status DEFAULT 'requested',
    exchange_preference    VARCHAR(255),
    video_url              TEXT,
    refund_amount          DECIMAL(10, 2),
    refund_transaction_id  VARCHAR(255),
    approved_by            INTEGER,
    rejection_reason       TEXT,
    return_tracking_number VARCHAR(100),
    is_item_received       BOOLEAN DEFAULT FALSE,
    requested_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_at            TIMESTAMP,
    received_at            TIMESTAMP,
    refunded_at            TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE chat_rooms (
    id             SERIAL PRIMARY KEY,
    customer_id    INTEGER NOT NULL,
    customer_name  VARCHAR(100),
    customer_email VARCHAR(255),
    assigned_to    INTEGER,
    subject        VARCHAR(255),
    status         chat_status DEFAULT 'open',
    priority       VARCHAR(20) DEFAULT 'medium',
    order_id       INTEGER,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    closed_at      TIMESTAMP
);

CREATE TABLE chat_messages (
    id          SERIAL PRIMARY KEY,
    room_id     INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
    sender_id   INTEGER,
    sender_type sender_type DEFAULT 'customer',
    message     TEXT NOT NULL,
    is_read     BOOLEAN DEFAULT FALSE,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX idx_users_email           ON users(email);
CREATE INDEX idx_users_username        ON users(username);
CREATE INDEX idx_users_phone           ON users(phone);
CREATE INDEX idx_users_role            ON users(role);
CREATE INDEX idx_users_active          ON users(is_active);

CREATE INDEX idx_products_slug         ON products(slug);
CREATE INDEX idx_products_collection   ON products(collection_id);
CREATE INDEX idx_products_active       ON products(is_active);
CREATE INDEX idx_products_price        ON products(price);
CREATE INDEX idx_products_featured     ON products(is_featured) WHERE is_featured;

CREATE INDEX idx_variants_product      ON product_variants(product_id);
CREATE INDEX idx_variants_active       ON product_variants(is_active);
CREATE INDEX idx_variants_low_stock    ON product_variants(product_id) WHERE quantity <= low_stock_threshold;

CREATE INDEX idx_product_images_product ON product_images(product_id);

CREATE INDEX idx_inventory_movements_variant ON inventory_movements(variant_id);
CREATE INDEX idx_inventory_movements_created ON inventory_movements(created_at DESC);

CREATE INDEX idx_orders_user           ON orders(user_id);
CREATE INDEX idx_orders_status         ON orders(status);
CREATE INDEX idx_orders_created        ON orders(created_at DESC);
CREATE INDEX idx_orders_invoice        ON orders(invoice_number);

CREATE INDEX idx_order_items_order     ON order_items(order_id);
CREATE INDEX idx_order_items_variant   ON order_items(variant_id);

CREATE INDEX idx_wishlist_user         ON wishlist(user_id);

CREATE INDEX idx_stock_reservations_user    ON stock_reservations(user_id);
CREATE INDEX idx_stock_reservations_sku     ON stock_reservations(sku);
CREATE INDEX idx_stock_reservations_expires ON stock_reservations(expires_at);
CREATE INDEX idx_stock_reservations_status  ON stock_reservations(status);
CREATE INDEX idx_reviews_product       ON reviews(product_id);
CREATE INDEX idx_promotions_code       ON promotions(code);
CREATE INDEX idx_payment_order         ON payment_transactions(order_id);
CREATE INDEX idx_chat_rooms_customer   ON chat_rooms(customer_id);

-- ============================================
-- TRIGGERS - updated_at maintenance
-- ============================================
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_touch              BEFORE UPDATE ON users              FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_collections_touch        BEFORE UPDATE ON collections        FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_products_touch           BEFORE UPDATE ON products           FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_variants_touch           BEFORE UPDATE ON product_variants   FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_addresses_touch          BEFORE UPDATE ON addresses          FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_orders_touch             BEFORE UPDATE ON orders             FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_payments_touch           BEFORE UPDATE ON payment_transactions FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_reviews_touch            BEFORE UPDATE ON reviews            FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_promotions_touch         BEFORE UPDATE ON promotions         FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_returns_touch            BEFORE UPDATE ON return_requests    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_chat_rooms_touch         BEFORE UPDATE ON chat_rooms         FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

-- ============================================
-- SEED DATA
-- ============================================
INSERT INTO users (email, username, hashed_password, role, email_verified, phone, first_name, last_name)
VALUES (
    'admin@aarya.com',
    'admin',
    '$2b$12$1jw6vTostduYzRG5u/ry..LlgJrs9W/LAYdV763lPwE4ERzJ6JxO.', -- admin123
    'admin', TRUE, '9999999999', 'System', 'Administrator'
) ON CONFLICT (email) DO NOTHING;

INSERT INTO collections (name, slug, description, image_url, is_featured, display_order) VALUES
    ('Kurtis',      'kurtis',     'Elegant kurtis for every occasion',  'collections/kurtis.jpg', TRUE, 1),
    ('Sarees',      'sarees',     'Traditional and designer sarees',    'collections/sarees.jpg', TRUE, 2),
    ('Suits & Sets','suits-sets', 'Coordinated suits and sets',         'collections/suits.jpg',  TRUE, 3)
ON CONFLICT (slug) DO NOTHING;
