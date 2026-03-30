#!/bin/bash
# Quick System Health Check
# Run this to verify all systems are operational

echo "🏥 Aarya Clothing - Quick Health Check"
echo "======================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check Docker containers
echo "1. Docker Containers"
echo "--------------------"
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Health}}" || \
  docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Status}}"
echo ""

# Check admin service
echo "2. Admin Service Health"
echo "-----------------------"
curl -s http://localhost:5004/health | jq -r '.status // "Unknown"' && \
  echo -e "${GREEN}✅ Admin service healthy${NC}" || \
  echo -e "${RED}❌ Admin service unhealthy${NC}"
echo ""

# Check frontend
echo "3. Frontend Health"
echo "------------------"
curl -s -o /dev/null -w "%{http_code}" http://localhost:6004/admin && \
  echo -e "${GREEN}✅ Frontend accessible${NC}" || \
  echo -e "${RED}❌ Frontend not accessible${NC}"
echo ""

# Check AI rotation
echo "4. AI Provider Status"
echo "---------------------"
docker exec aarya_admin python3 -c "
from service.ai_service import _get_active_provider
try:
    p = _get_active_provider()
    print(f'✅ Provider: {p[\"name\"]}')
    print(f'   Model: {p[\"model\"]}')
    print(f'   Base URL: {p[\"base_url\"]}')
except Exception as e:
    print(f'❌ Error: {e}')
" 2>/dev/null || echo -e "${YELLOW}⚠️  Could not check AI provider${NC}"
echo ""

# Check database
echo "5. Database Health"
echo "------------------"
docker exec aarya_postgres pg_isready -U postgres && \
  echo -e "${GREEN}✅ PostgreSQL ready${NC}" || \
  echo -e "${RED}❌ PostgreSQL not ready${NC}"
echo ""

# Check Redis
echo "6. Redis Health"
echo "---------------"
docker exec aarya_redis redis-cli ping 2>/dev/null | grep -q "PONG" && \
  echo -e "${GREEN}✅ Redis responding${NC}" || \
  echo -e "${YELLOW}⚠️  Redis auth required${NC}"
echo ""

# Summary
echo "======================================="
echo "Health Check Complete!"
echo ""
echo "For detailed report:"
echo "  cat COMPREHENSIVE_TEST_REPORT.md"
echo ""
echo "To test AI rotation:"
echo "  ./scripts/test-ai-rotation.sh"
echo ""
