#!/bin/bash
# Commit and Rebuild Script for Aarya Clothing
# This script commits all changes and rebuilds Docker containers

set -e

echo "=========================================="
echo "🔒 Commit and Rebuild - Aarya Clothing"
echo "=========================================="
echo ""

# Check if git has changes
if [[ -z $(git status --porcelain) ]]; then
    echo "✅ No uncommitted changes found!"
else
    echo "📝 Found uncommitted changes:"
    git status --short
    echo ""
    
    echo "Committing all changes..."
    git add .
    git commit -m "feat: Update email to Hostinger, admin UI improvements, Razorpay integration"
    echo "✅ Changes committed!"
fi

echo ""
echo "=========================================="
echo "🏗️  Rebuilding Docker Images"
echo "=========================================="
echo ""

# Stop containers
echo "⏹️  Stopping containers..."
docker-compose down

# Rebuild affected services
echo "🔨 Rebuilding core service..."
docker-compose build core

echo "🔨 Rebuilding commerce service..."
docker-compose build commerce

echo "🔨 Rebuilding frontend..."
docker-compose build frontend

echo ""
echo "=========================================="
echo "🚀 Starting Services"
echo "=========================================="
echo ""

# Start all services
docker-compose up -d

echo "⏳ Waiting for services to start (30 seconds)..."
sleep 30

echo ""
echo "=========================================="
echo "✅ Verifying Deployment"
echo "=========================================="
echo ""

# Check container status
echo "Container Status:"
docker-compose ps

echo ""
echo "Checking email configuration..."
SMTP_HOST=$(docker exec aarya_core python -c "from core.config import settings; print(settings.SMTP_HOST)" 2>/dev/null || echo "ERROR")
echo "SMTP Host: $SMTP_HOST"

if [[ "$SMTP_HOST" == "smtp.hostinger.com" ]]; then
    echo "✅ Email configuration is CORRECT!"
else
    echo "⚠️  Email configuration may need attention"
fi

echo ""
echo "Checking contact page..."
CONTACT_EMAIL=$(docker exec aarya_frontend cat /app/app/contact/page.js 2>/dev/null | grep "info@aaryaclothing.in" || echo "")
if [[ -n "$CONTACT_EMAIL" ]]; then
    echo "✅ Contact page has correct email: info@aaryaclothing.in"
else
    echo "⚠️  Contact page may need verification"
fi

echo ""
echo "=========================================="
echo "🎉 Deployment Complete!"
echo "=========================================="
echo ""
echo "Next steps:"
echo "1. Check logs: docker-compose logs -f core"
echo "2. Test email: python3 test_email_config.py"
echo "3. Visit site: http://localhost:6004"
echo ""
