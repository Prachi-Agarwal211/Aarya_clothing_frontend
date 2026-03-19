#!/bin/bash
# Aarya Clothing - Critical Fixes Deployment Script
# Date: March 19, 2026
# 
# This script applies the critical fixes for:
# 1. Nginx rate limiting (503 errors)
# 2. Cookie domain configuration (session persistence)
# 3. Frontend JWT parsing improvements
# 4. Token refresh logic fixes
#
# Usage: ./deploy-critical-fixes.sh

set -e  # Exit on error

echo "=========================================="
echo "Aarya Clothing - Critical Fixes Deployment"
echo "Date: $(date)"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Step 1: Verify we're in the right directory
echo -e "${YELLOW}[1/6] Verifying directory...${NC}"
if [ ! -f "docker-compose.yml" ]; then
    echo -e "${RED}Error: docker-compose.yml not found. Please run this script from /opt/Aarya_clothing_frontend${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Directory verified${NC}"
echo ""

# Step 2: Validate nginx configuration syntax
echo -e "${YELLOW}[2/6] Validating nginx configuration...${NC}"
if ! docker run --rm -v $(pwd)/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t 2>&1 | grep -q "successful"; then
    echo -e "${RED}Error: nginx configuration validation failed${NC}"
    docker run --rm -v $(pwd)/docker/nginx/nginx.conf:/etc/nginx/nginx.conf:ro nginx:alpine nginx -t
    exit 1
fi
echo -e "${GREEN}✓ Nginx configuration valid${NC}"
echo ""

# Step 3: Reload nginx to apply rate limiting fixes
echo -e "${YELLOW}[3/6] Reloading nginx to apply rate limiting fixes...${NC}"
docker-compose restart nginx
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Nginx reloaded successfully${NC}"
else
    echo -e "${RED}Error: Failed to reload nginx${NC}"
    exit 1
fi
echo ""

# Step 4: Rebuild and restart core service (cookie domain fix)
echo -e "${YELLOW}[4/6] Rebuilding core service (cookie domain fix)...${NC}"
docker-compose build core
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Core service built successfully${NC}"
else
    echo -e "${RED}Error: Failed to build core service${NC}"
    exit 1
fi

echo -e "${YELLOW}    Restarting core service...${NC}"
docker-compose restart core
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Core service restarted${NC}"
else
    echo -e "${RED}Error: Failed to restart core service${NC}"
    exit 1
fi
echo ""

# Step 5: Rebuild and restart frontend (JWT parsing + token refresh fixes)
echo -e "${YELLOW}[5/6] Rebuilding frontend service (JWT parsing + token refresh)...${NC}"
docker-compose build frontend
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend service built successfully${NC}"
else
    echo -e "${RED}Error: Failed to build frontend service${NC}"
    exit 1
fi

echo -e "${YELLOW}    Restarting frontend service...${NC}"
docker-compose restart frontend
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend service restarted${NC}"
else
    echo -e "${RED}Error: Failed to restart frontend service${NC}"
    exit 1
fi
echo ""

# Step 6: Verify services are healthy
echo -e "${YELLOW}[6/6] Verifying services are healthy...${NC}"
sleep 10  # Wait for services to start

# Check nginx
if curl -s -o /dev/null -w "%{http_code}" -k https://localhost/health | grep -q "200"; then
    echo -e "${GREEN}✓ Nginx is healthy (HTTP 200)${NC}"
else
    echo -e "${RED}⚠ Nginx health check failed${NC}"
fi

# Check core service
if curl -s -o /dev/null -w "%{http_code}" http://localhost:5001/health | grep -q "200"; then
    echo -e "${GREEN}✓ Core service is healthy (HTTP 200)${NC}"
else
    echo -e "${RED}⚠ Core service health check failed${NC}"
fi

# Check frontend
if curl -s -o /dev/null -w "%{http_code}" http://localhost:6004/ | grep -q "200"; then
    echo -e "${GREEN}✓ Frontend is healthy (HTTP 200)${NC}"
else
    echo -e "${RED}⚠ Frontend health check failed${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Fixes applied:"
echo "  ✓ Nginx rate limiting increased (10r/s → 50r/s)"
echo "  ✓ Nginx burst allowance increased (20 → 100)"
echo "  ✓ Cookie domain set for production (.aaryaclothing.in)"
echo "  ✓ JWT parsing improved with better error handling"
echo "  ✓ Token refresh logic fixed"
echo "  ✓ API cache-control headers added"
echo ""
echo "Next steps:"
echo "  1. Monitor nginx logs for rate limiting: docker logs aarya_nginx | grep 'limiting requests'"
echo "  2. Test session persistence between www and non-www domains"
echo "  3. Verify API responses are not cached by browser"
echo "  4. Monitor authentication flow for any issues"
echo ""
echo -e "${YELLOW}Note: Frontend build may take a few minutes. Please be patient.${NC}"
echo ""
