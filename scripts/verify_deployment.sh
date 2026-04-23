#!/bin/bash

# ============================================================================
# Aarya Clothing - Razorpay Deployment Verification Script
# ============================================================================
# This script verifies that Razorpay is properly configured
# and all Docker images are up to date.
# ============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# ============================================================================
# CONFIGURATION
# ============================================================================

PROJECT_NAME="aarya"
COMPOSE_FILE="docker-compose.yml"
FRONTEND_DIR="frontend_new"
PAYMENT_SERVICE_DIR="services/payment"
COMMERCE_SERVICE_DIR="services/commerce"

# ============================================================================
# HELPER FUNCTIONS
# ============================================================================

print_header() {
    echo -e "\n${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

check_env_variable() {
    local var_name=$1
    local var_value="${!var_name}"
    
    if [ -z "$var_value" ] || [ "$var_value" = "your_"* ]; then
        print_warning "$var_name is not configured"
        return 1
    else
        print_success "$var_name is configured"
        return 0
    fi
}

# ============================================================================
# VERIFICATION STEPS
# ============================================================================

print_header "STEP 1: Checking Environment Variables"

# Source .env file if it exists
if [ -f .env ]; then
    set -a
    source .env
    set +a
    print_success ".env file loaded"
else
    print_warning ".env file not found - using default values"
fi

# Check Razorpay configuration
print_info "Checking Razorpay configuration..."
check_env_variable "RAZORPAY_KEY_ID"
check_env_variable "RAZORPAY_KEY_SECRET"
check_env_variable "RAZORPAY_WEBHOOK_SECRET"

print_header "STEP 2: Checking Docker Images"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop or Docker daemon."
    exit 1
fi
print_success "Docker is running"

# Check existing images
print_info "Checking existing Docker images..."

IMAGES_TO_CHECK=(
    "python:3.11-slim"
    "node:18-alpine"
    "nginx:alpine"
    "pgvector/pgvector:pg15"
    "redis:7-alpine"
    "getmeili/meilisearch:v1.6"
)

for image in "${IMAGES_TO_CHECK[@]}"; do
    if docker image inspect "$image" > /dev/null 2>&1; then
        print_success "Image $image exists"
    else
        print_warning "Image $image not found - will be pulled during build"
    fi
done

# ============================================================================

print_header "STEP 3: Checking for Uncommitted Changes"

# Check for uncommitted changes in payment service
if [ -d "$PAYMENT_SERVICE_DIR" ]; then
    CHANGES=$(git status --porcelain "$PAYMENT_SERVICE_DIR" 2>/dev/null | wc -l)
    if [ "$CHANGES" -gt 0 ]; then
        print_warning "Uncommitted changes in payment service ($CHANGES files)"
        git status --porcelain "$PAYMENT_SERVICE_DIR" 2>/dev/null
    else
        print_success "Payment service has no uncommitted changes"
    fi
fi

# Check for uncommitted changes in commerce service
if [ -d "$COMMERCE_SERVICE_DIR" ]; then
    CHANGES=$(git status --porcelain "$COMMERCE_SERVICE_DIR" 2>/dev/null | wc -l)
    if [ "$CHANGES" -gt 0 ]; then
        print_warning "Uncommitted changes in commerce service ($CHANGES files)"
        git status --porcelain "$COMMERCE_SERVICE_DIR" 2>/dev/null
    else
        print_success "Commerce service has no uncommitted changes"
    fi
fi

# Check for uncommitted changes in frontend
if [ -d "$FRONTEND_DIR" ]; then
    CHANGES=$(git status --porcelain "$FRONTEND_DIR" 2>/dev/null | wc -l)
    if [ "$CHANGES" -gt 0 ]; then
        print_warning "Uncommitted changes in frontend ($CHANGES files)"
        git status --porcelain "$FRONTEND_DIR" 2>/dev/null
    else
        print_success "Frontend has no uncommitted changes"
    fi
fi

# ============================================================================

print_header "STEP 4: Checking Dockerfile Integrity"

# Check if Dockerfiles exist
DOCKERFILES=(
    "services/payment/Dockerfile"
    "services/commerce/Dockerfile"
    "services/core/Dockerfile"
    "services/admin/Dockerfile"
    "frontend_new/Dockerfile"
)

for dockerfile in "${DOCKERFILES[@]}"; do
    if [ -f "$dockerfile" ]; then
        print_success "$dockerfile exists"
    else
        print_error "$dockerfile not found!"
        exit 1
    fi
done

# ============================================================================

print_header "STEP 5: Building Docker Images"

# Build payment service
print_info "Building payment service image..."
if docker-compose -f "$COMPOSE_FILE" build payment; then
    print_success "Payment service built successfully"
else
    print_error "Failed to build payment service"
    exit 1
fi

# Build commerce service
print_info "Building commerce service image..."
if docker-compose -f "$COMPOSE_FILE" build commerce; then
    print_success "Commerce service built successfully"
else
    print_error "Failed to build commerce service"
    exit 1
fi

# Build frontend
print_info "Building frontend image..."
if docker-compose -f "$COMPOSE_FILE" build frontend; then
    print_success "Frontend built successfully"
else
    print_error "Failed to build frontend"
    exit 1
fi

# ============================================================================

print_header "STEP 6: Checking Container Health"

# Start services (if not already running)
print_info "Starting services..."
docker-compose -f "$COMPOSE_FILE" up -d postgres redis meilisearch core commerce payment admin frontend nginx

# Wait for services to be healthy
print_info "Waiting for services to be healthy (30 seconds)..."
sleep 30

# Check container status
print_info "Checking container status..."
docker-compose -f "$COMPOSE_FILE" ps

# ============================================================================

print_header "STEP 7: Testing Payment Service Endpoints"

# Wait for payment service to be ready
sleep 10

# Test payment service health
print_info "Testing payment service health endpoint..."
if curl -f http://localhost:5003/health > /dev/null 2>&1; then
    print_success "Payment service is healthy"
    
    # Get health response
    HEALTH_RESPONSE=$(curl -s http://localhost:5003/health)
    print_info "Health response: $HEALTH_RESPONSE"
else
    print_error "Payment service health check failed"
    docker-compose -f "$COMPOSE_FILE" logs payment
fi

# Test payment config endpoint
print_info "Testing payment config endpoint..."
if curl -f http://localhost:5003/api/v1/payment/config > /dev/null 2>&1; then
    print_success "Payment config endpoint is accessible"
    
    # Get config response
    CONFIG_RESPONSE=$(curl -s http://localhost:5003/api/v1/payment/config)
    print_info "Config response: $CONFIG_RESPONSE"
else
    print_error "Payment config endpoint failed"
fi

# ============================================================================

print_header "STEP 8: Testing Commerce Service Endpoints"

# Wait for commerce service to be ready
sleep 5

# Test commerce service health
print_info "Testing commerce service health endpoint..."
if curl -f http://localhost:5002/health > /dev/null 2>&1; then
    print_success "Commerce service is healthy"
else
    print_error "Commerce service health check failed"
    docker-compose -f "$COMPOSE_FILE" logs commerce
fi

# ============================================================================

print_header "STEP 9: Testing Frontend"

# Wait for frontend to be ready
sleep 10

# Test frontend
print_info "Testing frontend..."
if curl -f http://localhost:6004 > /dev/null 2>&1; then
    print_success "Frontend is accessible"
else
    print_warning "Frontend not accessible yet - may still be starting"
fi

# ============================================================================

print_header "DEPLOYMENT VERIFICATION COMPLETE"

echo -e "${GREEN}✓ All checks completed!${NC}"
echo ""
print_info "Next steps:"
print_info "1. Verify payment gateway credentials in .env file"
print_info "2. Configure webhooks in Razorpay dashboard"
print_info "3. Test a payment with Razorpay"
print_info "4. Verify orders are created in database"
echo ""
print_info "Useful commands:"
print_info "  docker-compose logs -f payment    # View payment service logs"
print_info "  docker-compose logs -f commerce   # View commerce service logs"
print_info "  docker-compose logs -f frontend   # View frontend logs"
print_info "  docker-compose ps                 # Check container status"
echo ""

# ============================================================================
# END OF SCRIPT
# ============================================================================
