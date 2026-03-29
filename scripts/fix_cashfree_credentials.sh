#!/bin/bash

# Cashfree Credentials Fix Script
# Swaps CASHFREE_APP_ID and CASHFREE_SECRET_KEY

set -e

ENV_FILE="/opt/Aarya_clothing_frontend/.env"

echo "======================================================"
echo "🔧 CASHFREE CREDENTIALS FIX SCRIPT"
echo "======================================================"
echo ""

# Check if .env exists
if [ ! -f "$ENV_FILE" ]; then
    echo "❌ Error: .env file not found at $ENV_FILE"
    exit 1
fi

# Backup current .env
BACKUP_FILE="${ENV_FILE}.backup.$(date +%Y%m%d_%H%M%S)"
cp "$ENV_FILE" "$BACKUP_FILE"
echo "✅ Backup created: $BACKUP_FILE"
echo ""

# Extract current values
CURRENT_APP_ID=$(grep "^CASHFREE_APP_ID=" "$ENV_FILE" | cut -d'=' -f2)
CURRENT_SECRET=$(grep "^CASHFREE_SECRET_KEY=" "$ENV_FILE" | cut -d'=' -f2)

echo "📋 CURRENT VALUES (INCORRECT):"
echo "   CASHFREE_APP_ID: ${CURRENT_APP_ID:0:30}..."
echo "   CASHFREE_SECRET_KEY: ${CURRENT_SECRET:0:30}..."
echo ""

# Check if values look swapped
if [[ $CURRENT_APP_ID == cfsk_* ]]; then
    echo "⚠️  DETECTED: APP_ID starts with 'cfsk_' (should be SECRET_KEY)"
fi
if [[ $CURRENT_SECRET =~ ^[0-9]+$ ]] || [[ ! $CURRENT_SECRET == cfsk_* ]]; then
    echo "⚠️  DETECTED: SECRET_KEY looks like App ID (numeric/short)"
fi
echo ""

# Confirm swap
echo "🤔 Do you want to swap these values? (y/n)"
read -r CONFIRM
if [ "$CONFIRM" != "y" ]; then
    echo "❌ Cancelled by user"
    exit 0
fi

echo ""
echo "🔄 Swapping credentials..."

# Swap them using temporary variables
TEMP=$CURRENT_APP_ID
sed -i "s|^CASHFREE_APP_ID=.*|CASHFREE_APP_ID=${CURRENT_SECRET}|" "$ENV_FILE"
sed -i "s|^CASHFREE_SECRET_KEY=.*|CASHFREE_SECRET_KEY=${TEMP}|" "$ENV_FILE"

echo "✅ Credentials swapped!"
echo ""

# Verify
NEW_APP_ID=$(grep "^CASHFREE_APP_ID=" "$ENV_FILE" | cut -d'=' -f2)
NEW_SECRET=$(grep "^CASHFREE_SECRET_KEY=" "$ENV_FILE" | cut -d'=' -f2)

echo "📋 NEW VALUES (CORRECT):"
echo "   CASHFREE_APP_ID: ${NEW_APP_ID:0:30}..."
echo "   CASHFREE_SECRET_KEY: ${NEW_SECRET:0:30}..."
echo ""

# Validate format
echo "🔍 Validating credential format..."
if [[ $NEW_APP_ID =~ ^[0-9]+$ ]] || [[ ! $NEW_APP_ID == cfsk_* ]]; then
    echo "✅ APP_ID format looks correct (numeric)"
else
    echo "⚠️  APP_ID format may be incorrect (should be numeric)"
fi

if [[ $NEW_SECRET == cfsk_* ]]; then
    echo "✅ SECRET_KEY format looks correct (starts with cfsk_)"
else
    echo "⚠️  SECRET_KEY format may be incorrect (should start with cfsk_)"
fi
echo ""

# Restart payment service
echo "🔄 Restarting payment service..."
cd /opt/Aarya_clothing_frontend

# Check if docker-compose is available
if command -v docker-compose &> /dev/null; then
    docker-compose restart payment
    echo "✅ Payment service restarted!"
elif command -v docker &> /dev/null && docker compose version &> /dev/null; then
    docker compose restart payment
    echo "✅ Payment service restarted!"
else
    echo "⚠️  Docker not available. Please restart manually:"
    echo "   cd /opt/Aarya_clothing_frontend"
    echo "   docker-compose restart payment"
fi

echo ""
echo "======================================================"
echo "✅ FIX COMPLETE!"
echo "======================================================"
echo ""
echo "📝 NEXT STEPS:"
echo "   1. Check logs: docker logs aarya_payment --tail 30"
echo "   2. Test payment config: curl http://localhost:5003/api/v1/payments/config"
echo "   3. Try creating a Cashfree order from the frontend"
echo ""
echo "📄 Documentation: /opt/Aarya_clothing_frontend/docs/CASHFREE_NOT_WORKING_DIAGNOSIS.md"
echo ""
