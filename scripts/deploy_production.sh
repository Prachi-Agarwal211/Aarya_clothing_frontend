#!/bin/bash
# =============================================================================
# Aarya Clothing - Production Deployment Script
# =============================================================================
# This script automates the complete production deployment process
# Run with: bash scripts/deploy_production.sh
# =============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/opt/Aarya_clothing_frontend"
DOMAIN="aaryaclothing.in"
EMAIL="admin@aaryaclothing.in"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_root() {
    if [ "$EUID" -ne 0 ]; then
        log_error "Please run as root or with sudo"
        exit 1
    fi
}

check_command() {
    if ! command -v $1 &> /dev/null; then
        log_error "$1 is required but not installed."
        exit 1
    fi
}

confirm() {
    read -p "$1 (y/n): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_warning "Operation cancelled by user"
        exit 0
    fi
}

# =============================================================================
# Pre-Deployment Checks
# =============================================================================

pre_deployment_checks() {
    log_info "Running pre-deployment checks..."
    
    # Check if running as root
    check_root
    
    # Check required commands
    check_command docker
    check_command docker-compose
    check_command git
    check_command curl
    
    # Navigate to project directory
    cd "$PROJECT_DIR" || exit 1
    
    # Check .env file
    if [ ! -f .env ]; then
        log_warning ".env file not found. Creating from template..."
        cp .env.example .env
        log_warning "Please update .env with production values before continuing"
        exit 1
    fi
    
    # Check nginx.conf
    if [ ! -f docker/nginx/nginx.conf ]; then
        log_error "nginx.conf not found"
        exit 1
    fi
    
    # Check disk space (need at least 5GB)
    DISK_AVAILABLE=$(df -P /opt | awk 'NR==2 {print $4}')
    if [ "$DISK_AVAILABLE" -lt 5242880 ]; then
        log_error "Insufficient disk space. Need at least 5GB free."
        exit 1
    fi
    
    # Check memory (need at least 2GB free)
    MEM_AVAILABLE=$(free -m | awk 'NR==2 {print $7}')
    if [ "$MEM_AVAILABLE" -lt 2048 ]; then
        log_warning "Low memory available (< 2GB). Deployment may fail."
        confirm "Continue with low memory?"
    fi
    
    log_success "Pre-deployment checks passed"
}

# =============================================================================
# Security Setup
# =============================================================================

setup_security() {
    log_info "Setting up security configurations..."
    
    # Generate secure SECRET_KEY if not set
    if grep -q "your_secret_key_here" .env || grep -q "dev_secret_key" .env; then
        log_info "Generating secure SECRET_KEY..."
        SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(48))")
        sed -i "s|SECRET_KEY=.*|SECRET_KEY=$SECRET_KEY|" .env
        log_success "SECRET_KEY generated"
    fi
    
    # Generate secure POSTGRES_PASSWORD if not set
    if grep -q "your_secure_password_here" .env || grep -q "postgres123" .env; then
        log_info "Generating secure PostgreSQL password..."
        PG_PASSWORD=$(openssl rand -base64 32)
        sed -i "s|POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$PG_PASSWORD|g" .env
        sed -i "s|DATABASE_URL=postgresql://postgres:.*@|DATABASE_URL=postgresql://postgres:$PG_PASSWORD@|g" .env
        log_success "PostgreSQL password generated"
    fi
    
    # Generate secure REDIS_PASSWORD if not set
    if grep -q "your_redis_password_here" .env || grep -q "aarya_clothing_redis_password_2024" .env; then
        log_info "Generating secure Redis password..."
        REDIS_PASSWORD=$(openssl rand -base64 32)
        sed -i "s|REDIS_PASSWORD=.*|REDIS_PASSWORD=$REDIS_PASSWORD|g" .env
        sed -i "s|redis://:.*@|redis://:$REDIS_PASSWORD@|g" .env
        log_success "Redis password generated"
    fi
    
    # Generate secure MEILI_MASTER_KEY if not set
    if grep -q "your_meili_master_key_here" .env || grep -q "dev_master_key" .env; then
        log_info "Generating secure Meilisearch key..."
        MEILI_KEY=$(openssl rand -base64 32)
        sed -i "s|MEILI_MASTER_KEY=.*|MEILI_MASTER_KEY=$MEILI_KEY|g" .env
        sed -i "s|MEILISEARCH_API_KEY=.*|MEILISEARCH_API_KEY=$MEILI_KEY|g" .env
        log_success "Meilisearch key generated"
    fi
    
    # Set production environment
    sed -i 's/ENVIRONMENT=development/ENVIRONMENT=production/g' .env
    sed -i 's/DEBUG=true/DEBUG=false/g' .env
    sed -i 's/LOG_LEVEL=DEBUG/LOG_LEVEL=INFO/g' .env
    
    # Update URLs for production
    sed -i 's|NEXT_PUBLIC_API_URL=http://localhost:6005|NEXT_PUBLIC_API_URL=https://aaryaclothing.in|g' .env
    sed -i 's|PAYMENT_SUCCESS_URL=http://localhost:6005|PAYMENT_SUCCESS_URL=https://aaryaclothing.in|g' .env
    sed -i 's|PAYMENT_FAILURE_URL=http://localhost:6005|PAYMENT_FAILURE_URL=https://aaryaclothing.in|g' .env
    
    # Update ALLOWED_ORIGINS
    sed -i 's|ALLOWED_ORIGINS=\[.*\]|ALLOWED_ORIGINS=["https://aaryaclothing.in","https://www.aaryaclothing.in"]|g' .env
    
    # Enable cookie security
    sed -i 's/COOKIE_SECURE=false/COOKIE_SECURE=true/g' .env
    
    # Set secure file permissions
    chmod 600 .env
    chown root:root .env
    
    log_success "Security configurations applied"
}

# =============================================================================
# SSL Certificate Setup
# =============================================================================

setup_ssl() {
    log_info "Setting up SSL certificate with Let's Encrypt..."
    
    # Install certbot if not installed
    if ! command -v certbot &> /dev/null; then
        log_info "Installing certbot..."
        apt update
        apt install -y certbot
    fi
    
    # Stop nginx to free port 80
    log_info "Stopping nginx temporarily..."
    docker stop aarya_nginx || true
    
    # Get SSL certificate
    log_info "Requesting SSL certificate from Let's Encrypt..."
    certbot certonly --standalone \
        -d "$DOMAIN" \
        -d "www.$DOMAIN" \
        --email "$EMAIL" \
        --agree-tos \
        --non-interactive \
        --force-renewal
    
    # Verify certificate
    if [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        log_success "SSL certificate obtained successfully"
    else
        log_error "Failed to obtain SSL certificate"
        docker start aarya_nginx || true
        exit 1
    fi
    
    # Restart nginx
    docker start aarya_nginx
    log_success "SSL certificate setup complete"
}

# =============================================================================
# Firewall Setup
# =============================================================================

setup_firewall() {
    log_info "Configuring firewall (UFW)..."
    
    # Check if UFW is installed
    if ! command -v ufw &> /dev/null; then
        log_warning "UFW not installed. Skipping firewall setup."
        return
    fi
    
    # Enable UFW with default policies
    ufw --force enable
    ufw default deny incoming
    ufw default allow outgoing
    
    # Allow SSH
    ufw allow 22/tcp comment 'SSH'
    
    # Allow HTTP (for Let's Encrypt)
    ufw allow 80/tcp comment 'HTTP'
    
    # Allow HTTPS
    ufw allow 443/tcp comment 'HTTPS'
    
    # Reload UFW
    ufw --force reload
    
    log_success "Firewall configured"
    ufw status verbose
}

# =============================================================================
# Database Setup
# =============================================================================

setup_database() {
    log_info "Setting up database..."
    
    # Start PostgreSQL
    docker-compose up -d postgres
    
    # Wait for PostgreSQL to be ready
    log_info "Waiting for PostgreSQL to be ready..."
    sleep 10
    
    # Check if database is initialized
    if docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "SELECT 1" &> /dev/null; then
        log_success "Database is ready"
    else
        log_warning "Database not initialized. Running init.sql..."
        docker-compose restart postgres
        sleep 15
    fi
    
    # Add performance indexes
    log_info "Adding performance indexes..."
    docker exec aarya_postgres psql -U postgres -d aarya_clothing << 'EOF'
-- Composite indexes
CREATE INDEX IF NOT EXISTS idx_orders_user_status ON orders(user_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_category_active ON products(category_id, is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_inventory_product_active ON inventory(product_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_payment_transactions_order ON payment_transactions(order_id, status);

-- Partial indexes
CREATE INDEX IF NOT EXISTS idx_orders_pending ON orders(status) WHERE status = 'confirmed';
CREATE INDEX IF NOT EXISTS idx_inventory_low_stock ON inventory(product_id) WHERE quantity <= low_stock_threshold;
CREATE INDEX IF NOT EXISTS idx_promotions_active_valid ON promotions(code) WHERE is_active = true AND valid_until > NOW();
EOF
    
    log_success "Database setup complete"
}

# =============================================================================
# Deployment
# =============================================================================

deploy() {
    log_info "Starting deployment..."
    
    # Pull latest code (if using git)
    if [ -d .git ]; then
        log_info "Pulling latest code from git..."
        git pull origin main || log_warning "Git pull failed. Continuing with current code."
    fi
    
    # Stop old containers
    log_info "Stopping old containers..."
    docker-compose down
    
    # Remove old images (optional)
    log_info "Cleaning up old images..."
    docker image prune -f --filter "until=24h"
    
    # Build new images
    log_info "Building new images (this may take 10-15 minutes)..."
    docker-compose build --no-cache
    
    # Start new containers
    log_info "Starting new containers..."
    docker-compose up -d
    
    # Wait for services to start
    log_info "Waiting for services to start..."
    sleep 30
    
    # Check container status
    log_info "Checking container status..."
    docker-compose ps
    
    log_success "Deployment complete"
}

# =============================================================================
# Verification
# =============================================================================

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check all containers are running
    RUNNING=$(docker-compose ps | grep -c "Up" || true)
    if [ "$RUNNING" -lt 9 ]; then
        log_error "Not all containers are running. Expected 9, found $RUNNING"
        docker-compose ps
        exit 1
    fi
    
    # Test health endpoint
    log_info "Testing health endpoint..."
    HEALTH_RESPONSE=$(curl -s https://$DOMAIN/health || echo "failed")
    if [[ "$HEALTH_RESPONSE" == *"healthy"* ]]; then
        log_success "Health check passed"
    else
        log_error "Health check failed"
        echo "Response: $HEALTH_RESPONSE"
        exit 1
    fi
    
    # Test HTTPS
    log_info "Testing HTTPS..."
    HTTPS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" https://$DOMAIN)
    if [ "$HTTPS_RESPONSE" -eq 200 ]; then
        log_success "HTTPS is working"
    else
        log_error "HTTPS test failed (HTTP $HTTPS_RESPONSE)"
        exit 1
    fi
    
    # Test HTTP redirect
    log_info "Testing HTTP to HTTPS redirect..."
    REDIRECT_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://$DOMAIN)
    if [ "$REDIRECT_RESPONSE" -eq 301 ]; then
        log_success "HTTP redirect is working"
    else
        log_warning "HTTP redirect may not be working (HTTP $REDIRECT_RESPONSE)"
    fi
    
    # Test API
    log_info "Testing API..."
    API_RESPONSE=$(curl -s https://$DOMAIN/api/v1/products?limit=1 || echo "failed")
    if [[ "$API_RESPONSE" == *"hits"* ]] || [[ "$API_RESPONSE" == *"products"* ]]; then
        log_success "API is responding"
    else
        log_warning "API test returned unexpected response"
    fi
    
    # Check security headers
    log_info "Checking security headers..."
    HEADERS=$(curl -s -I https://$DOMAIN)
    if [[ "$HEADERS" == *"Strict-Transport-Security"* ]]; then
        log_success "HSTS header present"
    else
        log_warning "HSTS header missing"
    fi
    
    if [[ "$HEADERS" == *"X-Frame-Options"* ]]; then
        log_success "X-Frame-Options header present"
    else
        log_warning "X-Frame-Options header missing"
    fi
    
    if [[ "$HEADERS" == *"X-Content-Type-Options"* ]]; then
        log_success "X-Content-Type-Options header present"
    else
        log_warning "X-Content-Type-Options header missing"
    fi
    
    log_success "Deployment verification complete"
}

# =============================================================================
# Main Execution
# =============================================================================

main() {
    echo "=============================================="
    echo "Aarya Clothing Production Deployment"
    echo "=============================================="
    echo ""
    
    confirm "Start production deployment?"
    
    pre_deployment_checks
    setup_security
    setup_ssl
    setup_firewall
    setup_database
    deploy
    verify_deployment
    
    echo ""
    echo "=============================================="
    log_success "Production deployment completed successfully!"
    echo "=============================================="
    echo ""
    echo "Next steps:"
    echo "1. Update payment gateway credentials in .env"
    echo "2. Update email/SMTP credentials in .env"
    echo "3. Update Cloudflare R2 credentials in .env"
    echo "4. Change admin user passwords via admin panel"
    echo "5. Set up automated backups"
    echo ""
    echo "Domain: https://$DOMAIN"
    echo "Admin Panel: https://$DOMAIN/admin"
    echo ""
}

# Run main function
main "$@"
