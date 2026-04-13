#!/bin/bash
# Test script to verify the EMAIL_NOT_VERIFIED login flow
# Usage: ./test_email_verification_login.sh

set -e

API_URL="http://localhost"
EMAIL="15anuragsingh2003@gmail.com"
PASSWORD="testpassword"  # Replace with actual password or use a test account

echo "======================================"
echo "Testing EMAIL_NOT_VERIFIED Login Flow"
echo "======================================"
echo ""

# Step 1: Check user status in database
echo "Step 1: Checking user status in database..."
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c "
SELECT 
  id,
  email,
  is_active,
  email_verified,
  phone_verified,
  signup_verification_method,
  created_at
FROM users 
WHERE email = '$EMAIL';
" 2>&1 | grep -v "^$" || echo "User not found in database"

echo ""
echo "Step 2: Attempting login (expecting 403 EMAIL_NOT_VERIFIED)..."

# Step 2: Try to login
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$EMAIL\",\"password\":\"$PASSWORD\",\"remember_me\":false}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"

echo ""
if [ "$HTTP_CODE" = "403" ]; then
  echo "✅ Got expected 403 status"
  
  # Check if response contains EMAIL_NOT_VERIFIED
  if echo "$BODY" | grep -q "EMAIL_NOT_VERIFIED"; then
    echo "✅ Response contains EMAIL_NOT_VERIFIED error code"
    
    # Extract email and method from response
    ERROR_EMAIL=$(echo "$BODY" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('detail', {}).get('email', 'N/A'))" 2>/dev/null || echo "N/A")
    METHOD=$(echo "$BODY" | python3 -c "import sys, json; data = json.load(sys.stdin); print(data.get('detail', {}).get('signup_verification_method', 'N/A'))" 2>/dev/null || echo "N/A")
    
    echo "   Email from response: $ERROR_EMAIL"
    echo "   Method from response: $METHOD"
    echo ""
    echo "✅ Frontend should redirect to:"
    echo "   /auth/register?step=verify&email=$ERROR_EMAIL&method=$METHOD"
  else
    echo "❌ Response does NOT contain EMAIL_NOT_VERIFIED"
    echo "   This might mean:"
    echo "   - Wrong password (check credentials)"
    echo "   - Account is actually disabled (is_active = false)"
    echo "   - Account is already verified (check database)"
  fi
elif [ "$HTTP_CODE" = "400" ]; then
  echo "❌ Got 400 Bad Request"
  echo "   Possible reasons:"
  echo "   - Wrong password"
  echo "   - Account locked due to too many attempts"
  echo "   - Account is deactivated (is_active = false)"
elif [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Login successful - user is already verified!"
  echo "   This means the user has already verified their account."
else
  echo "⚠️  Unexpected HTTP status: $HTTP_CODE"
fi

echo ""
echo "======================================"
echo "Test Complete"
echo "======================================"
