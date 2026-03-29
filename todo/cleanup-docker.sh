#!/bin/bash

# Docker Cleanup Script for Aarya Clothing
# Run this to reclaim disk space safely
# Generated: 2026-03-26

set -e

echo "========================================"
echo "Docker Cleanup Script"
echo "========================================"
echo ""

# Show current disk usage
echo "📊 Current Docker Disk Usage:"
docker system df
echo ""

# Count what will be removed
DANGLING_IMAGES=$(docker images -f "dangling=true" -q | wc -l)
STOPPED_CONTAINERS=$(docker ps -a -f "status=exited" -q | wc -l)

echo "🔍 Resources to Clean:"
echo "   - Dangling Images: $DANGLING_IMAGES"
echo "   - Stopped Containers: $STOPPED_CONTAINERS"
echo ""

# Confirm before proceeding
read -p "⚠️  Proceed with cleanup? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Cleanup cancelled"
    exit 0
fi

echo ""
echo "🧹 Starting cleanup..."
echo ""

# Step 1: Remove dangling images
if [ "$DANGLING_IMAGES" -gt 0 ]; then
    echo "1️⃣  Removing dangling images..."
    docker image prune -f
    echo "   ✅ Done"
else
    echo "1️⃣  No dangling images to remove"
fi
echo ""

# Step 2: Remove stopped containers
if [ "$STOPPED_CONTAINERS" -gt 0 ]; then
    echo "2️⃣  Removing stopped containers..."
    docker container prune -f
    echo "   ✅ Done"
else
    echo "2️⃣  No stopped containers to remove"
fi
echo ""

# Step 3: Show new disk usage
echo "📊 New Docker Disk Usage:"
docker system df
echo ""

# Step 4: Show system disk space
echo "💾 System Disk Space:"
df -h / | grep -E "Filesystem|/dev/"
echo ""

echo "========================================"
echo "✅ Cleanup Complete!"
echo "========================================"
