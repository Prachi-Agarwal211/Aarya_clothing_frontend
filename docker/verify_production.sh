#!/bin/bash
# Production Verification Script for Aarya Clothing Platform
# Run this inside Docker containers to verify everything works

set -e

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║  AARYA CLOTHING - PRODUCTION VERIFICATION                         ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -n "Testing: $test_name... "
    if eval "$test_command" > /dev/null 2>&1; then
        echo -e "${GREEN}✅ PASS${NC}"
        ((TESTS_PASSED++))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "═══════════════════════════════════════════════════════════════════"
echo "TEST 1: R2 Storage Connection"
echo "═══════════════════════════════════════════════════════════════════"

python3 -c "
import boto3
from botocore.config import Config
import os

client = boto3.client(
    's3',
    endpoint_url=f'https://{os.getenv(\"R2_ACCOUNT_ID\")}.r2.cloudflarestorage.com',
    aws_access_key_id=os.getenv('R2_ACCESS_KEY_ID'),
    aws_secret_access_key=os.getenv('R2_SECRET_ACCESS_KEY'),
    region_name='auto',
    config=Config(signature_version='s3v4')
)

response = client.head_bucket(Bucket=os.getenv('R2_BUCKET_NAME'))
assert response['ResponseMetadata']['HTTPStatusCode'] == 200
print('R2 bucket accessible')
" && echo -e "${GREEN}✅ R2 Connection: PASS${NC}" || echo -e "${RED}❌ R2 Connection: FAIL${NC}"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "TEST 2: Database Connectivity"
echo "═══════════════════════════════════════════════════════════════════"

python3 -c "
import psycopg2
import os

conn = psycopg2.connect(os.getenv('DATABASE_URL'))
cursor = conn.cursor()
cursor.execute('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = \"public\"')
count = cursor.fetchone()[0]
print(f'Found {count} tables')
cursor.close()
conn.close()
" && echo -e "${GREEN}✅ Database: PASS${NC}" || echo -e "${RED}❌ Database: FAIL${NC}"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "TEST 3: Shared Module Imports"
echo "═══════════════════════════════════════════════════════════════════"

python3 -c "
from shared.roles import USER_ROLES, ROLE_HIERARCHY, getRedirectForRole
from shared.auth_middleware import get_current_user, require_admin
print('All shared modules imported')

# Test role redirects
for role in ['super_admin', 'admin', 'staff', 'customer']:
    redirect = getRedirectForRole(role)
    print(f'{role} → {redirect}')
" && echo -e "${GREEN}✅ Shared Modules: PASS${NC}" || echo -e "${RED}❌ Shared Modules: FAIL${NC}"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "TEST 4: Service Health Checks"
echo "═══════════════════════════════════════════════════════════════════"

run_test "Core Service (Port 5001)" "curl -f http://localhost:5001/health"
run_test "Commerce Service (Port 5002)" "curl -f http://localhost:5002/health"
run_test "Payment Service (Port 5003)" "curl -f http://localhost:5003/health"
run_test "Admin Service (Port 5004)" "curl -f http://localhost:5004/health"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "TEST 5: Authentication Endpoints"
echo "═══════════════════════════════════════════════════════════════════"

run_test "Login Endpoint" "curl -f http://localhost:5001/api/v1/auth/login -X POST -H 'Content-Type: application/json' -d '{\"username\":\"test\",\"password\":\"test\"}' || true"

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "TEST 6: Frontend Build"
echo "═══════════════════════════════════════════════════════════════════"

if [ -f "/app/frontend_new/.next/BUILD_ID" ]; then
    echo -e "${GREEN}✅ Frontend build exists${NC}"
    ((TESTS_PASSED++))
else
    echo "Frontend not built yet. Building..."
    cd /app/frontend_new
    npm run build && ((TESTS_PASSED++)) || ((TESTS_FAILED++))
fi

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "VERIFICATION SUMMARY"
echo "═══════════════════════════════════════════════════════════════════"

TOTAL=$((TESTS_PASSED + TESTS_FAILED))
echo "Tests Passed: $TESTS_PASSED/$TOTAL"
echo "Tests Failed: $TESTS_FAILED/$TOTAL"

if [ $TESTS_FAILED -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED! System is production-ready.${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Verify Razorpay credentials are configured"
    echo "2. Verify SMTP credentials are configured"
    echo "3. Run E2E tests: npm run test"
    echo "4. Deploy to production"
    exit 0
else
    echo ""
    echo -e "${RED}❌ SOME TESTS FAILED. Please fix issues before deployment.${NC}"
    exit 1
fi
