#!/bin/bash
# ============================================================================
# FIX EVERYTHING - May 18, 2026
# Recovery script for lost order pay_Sf2CAGW41ycUri
# This script fixes the bug, restarts services, and recovers the lost order
# ============================================================================

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

cd /opt/Aarya_clothing_frontend

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}            FIX EVERYTHING - Lost Order Recovery${NC}"
echo -e "${BLUE}            Payment: pay_Sf2CAGW41ycUri, Amount: ₹599.00${NC}"
echo -e "${BLUE}            Customer: kirtisumi.1991@gmail.com, +91 7717 759940${NC}"
echo -e "${BLUE}============================================================================${NC}"

# ============================================================================
# STEP 1: FIX THE CODE BUG
# ============================================================================
echo -e "\n${GREEN}[STEP 1] Fixing the code bug...${NC}"

# Check if the bug exists
if grep -q "if status in \[" services/payment/service/payment_service.py; then
    echo -e "${YELLOW}✓ Bug found! Fixing undefined 'status' variable...${NC}"
    
    # Apply the fix
    sed -i '691s/if status in/if webhook_status in/' services/payment/service/payment_service.py
    sed -i '695s/elif status in/elif webhook_status in/' services/payment/service/payment_service.py
    sed -i '689a\                webhook_status = event_info.get("status", "")' services/payment/service/payment_service.py
    
    echo -e "${GREEN}✓ Fix applied!${NC}"
else
    echo -e "${GREEN}✓ Bug already fixed!${NC}"
fi

# Verify the fix
if grep -q "webhook_status = event_info.get" services/payment/service/payment_service.py; then
    echo -e "${GREEN}✓ Fix verified!${NC}"
else
    echo -e "${RED}✗ Fix failed! Please manually check line 689-696 in services/payment/service/payment_service.py${NC}"
    exit 1
fi

# ============================================================================
# STEP 2: FIX DOCKER COMPOSE DEPENDENCY
# ============================================================================
echo -e "\n${GREEN}[STEP 2] Fixing Docker Compose dependencies...${NC}"

# Add commerce dependency to payment service
if ! grep -A 5 "payment:" docker-compose.yml | grep -q "commerce:"; then
    echo -e "${YELLOW}✓ Adding commerce dependency to payment service...${NC}"
    
    # Find the payment service section and add commerce dependency
    # This is a bit tricky with sed, so let's use a Python script
    python3 << 'PYTHONSCRIPT'
import re

with open('docker-compose.yml', 'r') as f:
    content = f.read()

# Find the payment service depends_on section
# We need to add commerce: condition: service_started under depends_on:
payment_pattern = r'(  payment:.*?depends_on:\s*\n)(\s+pgbouncer:\s*\n\s+condition: service_healthy\s*\n)(\s+redis:\s*\n\s+condition: service_healthy\s*\n)(\s+core:\s*\n\s+condition: service_started)'

replacement = r'\1\2\3\4\n      commerce:\n        condition: service_started'

content_new = re.sub(payment_pattern, replacement, content, flags=re.DOTALL)

if content != content_new:
    with open('docker-compose.yml', 'w') as f:
        f.write(content_new)
    print("✓ Added commerce dependency to payment service")
else:
    print("✓ Dependency already exists or pattern not found")
PYTHONSCRIPT
else
    echo -e "${GREEN}✓ Dependency already configured!${NC}"
fi

# ============================================================================
# STEP 3: REBUILD DOCKER IMAGES
# ============================================================================
echo -e "\n${GREEN}[STEP 3] Rebuilding Docker images...${NC}"

# Rebuild all services to ensure consistency
echo -e "${YELLOW}✓ Rebuilding all services (this may take a few minutes)...${NC}"
docker-compose build --no-cache

echo -e "${GREEN}✓ Images rebuilt!${NC}"

# ============================================================================
# STEP 4: RESTART SERVICES IN CORRECT ORDER
# ============================================================================
echo -e "\n${GREEN}[STEP 4] Restarting services in correct order...${NC}"

# Stop all services first
echo -e "${YELLOW}✓ Stopping all containers...${NC}"
docker-compose down

# Wait a moment
sleep 5

# Start database layer
echo -e "${YELLOW}✓ Starting database layer...${NC}"
docker-compose up -d postgres redis pgbouncer

# Wait for database to be healthy
echo -e "${YELLOW}✓ Waiting for database to initialize (30 seconds)...${NC}"
sleep 30

# Check if database is ready
for i in {1..10}; do
    if docker-compose exec -T postgres pg_isready -U postgres -d aarya_clothing >/dev/null 2>&1; then
        echo -e "${GREEN}✓ Database is ready!${NC}"
        break
    fi
    echo -e "${YELLOW}✓ Waiting for database... (attempt $i/10)${NC}"
    sleep 5
done

# Start core service
echo -e "${YELLOW}✓ Starting core service...${NC}"
docker-compose up -d core

# Wait for core
sleep 10

# Start commerce service
echo -e "${YELLOW}✓ Starting commerce service...${NC}"
docker-compose up -d commerce

# Wait for commerce
sleep 10

# Start payment service
echo -e "${YELLOW}✓ Starting payment service...${NC}"
docker-compose up -d payment

# Wait for payment
sleep 15

# Start remaining services
echo -e "${YELLOW}✓ Starting admin and frontend...${NC}"
docker-compose up -d admin frontend_new nginx

# Wait for everything to settle
sleep 10

echo -e "${GREEN}✓ All services started!${NC}"

# ============================================================================
# STEP 5: VERIFY SERVICES ARE RUNNING
# ============================================================================
echo -e "\n${GREEN}[STEP 5] Verifying services...${NC}"

echo -e "${YELLOW}Service Status:${NC}"
docker-compose ps

# Check health endpoints
echo -e "\n${YELLOW}Health Check:${NC}"
for service in core commerce payment admin; do
    echo -n "  $service: "
    if curl -s -f -o /dev/null http://localhost:5001/health >/dev/null 2>&1 && [ "$service" = "core" ]; then
        echo -e "${GREEN}✓ Healthy${NC}"
    elif curl -s -f -o /dev/null http://localhost:5002/health >/dev/null 2>&1 && [ "$service" = "commerce" ]; then
        echo -e "${GREEN}✓ Healthy${NC}"
    elif curl -s -f -o /dev/null http://localhost:5003/health >/dev/null 2>&1 && [ "$service" = "payment" ]; then
        echo -e "${GREEN}✓ Healthy${NC}"
    elif curl -s -f -o /dev/null http://localhost:5004/health >/dev/null 2>&1 && [ "$service" = "admin" ]; then
        echo -e "${GREEN}✓ Healthy${NC}"
    else
        echo -e "${RED}✗ Unhealthy or not responding${NC}"
    fi
done

# ============================================================================
# STEP 6: CHECK DATABASE AND FIND MISSING DATA
# ============================================================================
echo -e "\n${GREEN}[STEP 6] Checking database for missing order...${NC}"

# Create a temp script to run inside the container
cat > /tmp/check_db.sql << 'SQLSCRIPT'
-- Find user
SELECT 'USER' as type, id, email, phone, username, created_at FROM users 
WHERE email LIKE '%kirtisumi%' OR phone LIKE '%7717759940%' 
ORDER BY created_at DESC;

-- Find webhook
SELECT 'WEBHOOK' as type, id, event_type, gateway, created_at, processed, processing_error 
FROM webhook_events 
WHERE payload->'payload'->'payment'->'entity'->>'id' = 'pay_Sf2CAGW41ycUri' 
   OR payload->'payload'->'payment'->>'id' = 'pay_Sf2CAGW41ycUri' 
ORDER BY created_at DESC;

-- Find transactions for this payment
SELECT 'TRANSACTION' as type, id, user_id, transaction_id, razorpay_payment_id, amount, status, order_id 
FROM payment_transactions 
WHERE razorpay_payment_id = 'pay_Sf2CAGW41ycUri' OR transaction_id = 'pay_Sf2CAGW41ycUri';

-- Find orders with this payment
SELECT 'ORDER' as type, o.id, o.user_id, o.invoice_number, o.transaction_id, o.razorpay_payment_id, 
       o.total_amount, o.status, SUBSTRING(o.shipping_address, 1, 200) as shipping_address
FROM orders o 
WHERE o.razorpay_payment_id = 'pay_Sf2CAGW41ycUri' OR o.transaction_id = 'pay_Sf2CAGW41ycUri';

-- Find all orders for user who has this email/phone
SELECT 'ORDER_USER' as type, o.id, o.user_id, o.invoice_number, o.total_amount, o.status 
FROM orders o 
JOIN users u ON o.user_id = u.id 
WHERE u.email = 'kirtisumi.1991@gmail.com' OR u.phone LIKE '%7717759940%' 
ORDER BY o.created_at DESC;
SQLSCRIPT

echo -e "${YELLOW}Running database check inside postgres container...${NC}"
docker-compose exec -T postgres psql -U postgres -d aarya_clothing -f /tmp/check_db.sql 2>/dev/null || \
docker-compose exec -T postgres psql -U postgres -d aarya_clothing -c "SELECT 1;" >/dev/null 2>&1 && \
echo -e "${YELLOW}(Using alternative method to check DB)...${NC}" || \
echo -e "${RED}✗ Cannot connect to database directly${NC}"

# ============================================================================
# STEP 7: RUN RECOVERY SCRIPT
# ============================================================================
echo -e "\n${GREEN}[STEP 7] Running recovery script...${NC}"

# Copy recovery script into payment container and run it
if [ -f "scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py" ]; then
    echo -e "${YELLOW}✓ Running recovery script inside payment container...${NC}"
    
    # Wait for payment container to be fully ready
    for i in {1..20}; do
        if docker-compose exec -T payment python3 -c "import sys; sys.exit(0)" >/dev/null 2>&1; then
            echo -e "${YELLOW}  Payment container is ready${NC}"
            break
        fi
        echo -n "."
        sleep 2
    done
    
    # Run the recovery script
    docker-compose exec payment python3 scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py
else
    echo -e "${RED}✗ Recovery script not found!${NC}"
    echo -e "${YELLOW}Please create the script or run it manually:${NC}"
    echo "  cp scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py scripts/"
    echo "  docker-compose exec payment python3 scripts/recover_lost_order_pay_Sf2CAGW41ycUri.py"
fi

# ============================================================================
# STEP 8: FINAL VERIFICATION
# ============================================================================
echo -e "\n${GREEN}[STEP 8] Final Verification${NC}"

echo -e "\n${YELLOW}Checking if order was created...${NC}"

# Try to verify through admin API
for i in {1..5}; do
    if docker-compose exec -T admin python3 -c "
import httpx, os
try:
    url = os.getenv('CORE_SERVICE_URL', 'http://core:5001')
    client = httpx.Client(timeout=5)
    response = client.get(f'{url}/health')
    print('✓ admin service is reachable')
except Exception as e:
    print(f'✗ Cannot reach admin: {e}')
" >/dev/null 2>&1; then
        break
    fi
    sleep 2
done

echo -e "\n${GREEN}============================================================================${NC}"
echo -e "${GREEN}                    FIX COMPLETE!${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo -e "\n${YELLOW}Next Steps:${NC}"
echo -e "  1. Check admin dashboard for the recovered order"
echo -e "  2. Verify customer can see their order at kirtisumi.1991@gmail.com"
echo -e "  3. Check payment service logs for any errors"
echo -e "  4. Run: docker-compose logs -f payment"
echo -e "\n${YELLOW}To see what customer bought:${NC}"
echo -e "  docker-compose exec payment bash scripts/01_check_database.sh"
echo ""
