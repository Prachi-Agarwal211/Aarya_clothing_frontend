#!/bin/bash

# Mobile Performance Testing Script
# Aarya Clothing - Performance Verification

set -e

echo "======================================"
echo "Aarya Clothing - Performance Testing"
echo "======================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
URL="${1:-http://localhost:3000}"
OUTPUT_DIR="./performance-reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "Testing URL: $URL"
echo "Output Directory: $OUTPUT_DIR"
echo ""

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Check if lighthouse is installed
if ! command -v lighthouse &> /dev/null
then
    echo -e "${YELLOW}Lighthouse not found. Installing...${NC}"
    npm install -g lighthouse
fi

# Check if Chrome is available
if ! command -v google-chrome &> /dev/null && ! command -v chromium-browser &> /dev/null
then
    echo -e "${RED}Chrome/Chromium not found. Please install Chrome for testing.${NC}"
    exit 1
fi

echo "======================================"
echo "1. Running Lighthouse Mobile Audit"
echo "======================================"

lighthouse "$URL" \
  --preset=performance \
  --form-factor=mobile \
  --screenEmulation.disabled=false \
  --throttling.cpuSlowdownMultiplier=4 \
  --throttling.rttMs=150 \
  --throttling.throughputKbps=1638.4 \
  --output=html \
  --output-path="$OUTPUT_DIR/lighthouse-mobile-$TIMESTAMP.html" \
  --output=json \
  --output-path="$OUTPUT_DIR/lighthouse-mobile-$TIMESTAMP.json" \
  --quiet

echo -e "${GREEN}✓ Lighthouse Mobile audit complete${NC}"
echo "  Report: $OUTPUT_DIR/lighthouse-mobile-$TIMESTAMP.html"
echo ""

echo "======================================"
echo "2. Running Lighthouse Desktop Audit"
echo "======================================"

lighthouse "$URL" \
  --preset=performance \
  --form-factor=desktop \
  --screenEmulation.disabled=false \
  --throttling.cpuSlowdownMultiplier=1 \
  --output=html \
  --output-path="$OUTPUT_DIR/lighthouse-desktop-$TIMESTAMP.html" \
  --output=json \
  --output-path="$OUTPUT_DIR/lighthouse-desktop-$TIMESTAMP.json" \
  --quiet

echo -e "${GREEN}✓ Lighthouse Desktop audit complete${NC}"
echo "  Report: $OUTPUT_DIR/lighthouse-desktop-$TIMESTAMP.html"
echo ""

echo "======================================"
echo "3. Extracting Key Metrics"
echo "======================================"

# Extract metrics from JSON (requires jq)
if command -v jq &> /dev/null; then
    MOBILE_JSON="$OUTPUT_DIR/lighthouse-mobile-$TIMESTAMP.json"
    
    if [ -f "$MOBILE_JSON" ]; then
        echo ""
        echo "Mobile Performance Metrics:"
        echo "---------------------------"
        
        # Extract scores
        PERFORMANCE_SCORE=$(jq '.categories.performance.score * 100' "$MOBILE_JSON" 2>/dev/null || echo "N/A")
        ACCESSIBILITY_SCORE=$(jq '.categories.accessibility.score * 100' "$MOBILE_JSON" 2>/dev/null || echo "N/A")
        BEST_PRACTICES_SCORE=$(jq '.categories.best-practices.score * 100' "$MOBILE_JSON" 2>/dev/null || echo "N/A")
        SEO_SCORE=$(jq '.categories.seo.score * 100' "$MOBILE_JSON" 2>/dev/null || echo "N/A")
        
        echo -e "Performance:      ${PERFORMANCE_SCORE}%"
        echo -e "Accessibility:    ${ACCESSIBILITY_SCORE}%"
        echo -e "Best Practices:   ${BEST_PRACTICES_SCORE}%"
        echo -e "SEO:              ${SEO_SCORE}%"
        echo ""
        
        # Extract Core Web Vitals
        echo "Core Web Vitals:"
        echo "----------------"
        
        LCP=$(jq '.audits["largest-contentful-paint"].displayValue' "$MOBILE_JSON" 2>/dev/null || echo "N/A")
        FID=$(jq '.audits["max-potential-fid"].displayValue' "$MOBILE_JSON" 2>/dev/null || echo "N/A")
        CLS=$(jq '.audits["cumulative-layout-shift"].displayValue' "$MOBILE_JSON" 2>/dev/null || echo "N/A")
        TBT=$(jq '.audits["total-blocking-time"].displayValue' "$MOBILE_JSON" 2>/dev/null || echo "N/A")
        TTI=$(jq '.audits["interactive"].displayValue' "$MOBILE_JSON" 2>/dev/null || echo "N/A")
        
        echo -e "LCP (Largest Contentful Paint):     $LCP"
        echo -e "FID (First Input Delay):            $FID"
        echo -e "CLS (Cumulative Layout Shift):      $CLS"
        echo -e "TBT (Total Blocking Time):          $TBT"
        echo -e "TTI (Time to Interactive):          $TTI"
        echo ""
        
        # Check if targets are met
        echo "Performance Targets:"
        echo "--------------------"
        
        if (( $(echo "$PERFORMANCE_SCORE >= 90" | bc -l 2>/dev/null || echo "0") )); then
            echo -e "${GREEN}✓ Lighthouse Score: $PERFORMANCE_SCORE% (Target: 90%+)${NC}"
        else
            echo -e "${RED}✗ Lighthouse Score: $PERFORMANCE_SCORE% (Target: 90%+)${NC}"
        fi
        
        # Additional checks would require parsing numeric values
        echo ""
    fi
else
    echo -e "${YELLOW}jq not installed. Install with: sudo apt install jq${NC}"
    echo "Skipping metric extraction."
fi

echo "======================================"
echo "4. Bundle Analysis"
echo "======================================"

# Check if build exists
if [ -d ".next" ]; then
    echo "Analyzing build artifacts..."
    echo ""
    
    # Calculate total build size
    TOTAL_SIZE=$(du -sh .next/static 2>/dev/null | cut -f1 || echo "N/A")
    echo "Static Assets Size: $TOTAL_SIZE"
    
    # List largest files
    echo ""
    echo "Largest Static Files:"
    find .next/static -type f -size +100k -exec ls -lh {} \; 2>/dev/null | sort -k5 -hr | head -10 || echo "No large files found"
    
    echo ""
else
    echo -e "${YELLOW}No .next directory found. Run 'npm run build' first.${NC}"
fi

echo "======================================"
echo "5. Service Worker Check"
echo "======================================"

# Check if service worker exists
if [ -f "public/sw.js" ]; then
    echo -e "${GREEN}✓ Service Worker found${NC}"
    
    # Get file size
    SW_SIZE=$(ls -lh public/sw.js | awk '{print $5}')
    echo "  Size: $SW_SIZE"
    
    # Check for key features
    echo ""
    echo "Service Worker Features:"
    
    grep -q "CACHE_NAME" public/sw.js && echo -e "  ${GREEN}✓${NC} Cache versioning" || echo -e "  ${RED}✗${NC} Cache versioning"
    grep -q "install" public/sw.js && echo -e "  ${GREEN}✓${NC} Install event" || echo -e "  ${RED}✗${NC} Install event"
    grep -q "fetch" public/sw.js && echo -e "  ${GREEN}✓${NC} Fetch handler" || echo -e "  ${RED}✗${NC} Fetch handler"
    grep -q "activate" public/sw.js && echo -e "  ${GREEN}✓${NC} Activate event" || echo -e "  ${RED}✗${NC} Activate event"
    grep -q "caches.open" public/sw.js && echo -e "  ${GREEN}✓${NC} Cache API" || echo -e "  ${RED}✗${NC} Cache API"
else
    echo -e "${RED}✗ Service Worker not found${NC}"
fi

echo ""

echo "======================================"
echo "6. PWA Manifest Check"
echo "======================================"

if [ -f "public/manifest.json" ]; then
    echo -e "${GREEN}✓ PWA Manifest found${NC}"
    
    # Validate JSON
    if jq . public/manifest.json > /dev/null 2>&1; then
        echo "  Valid JSON format"
        
        # Check required fields
        NAME=$(jq -r '.name' public/manifest.json 2>/dev/null)
        SHORT_NAME=$(jq -r '.short_name' public/manifest.json 2>/dev/null)
        START_URL=$(jq -r '.start_url' public/manifest.json 2>/dev/null)
        DISPLAY=$(jq -r '.display' public/manifest.json 2>/dev/null)
        
        echo ""
        echo "Manifest Details:"
        echo "  Name: $NAME"
        echo "  Short Name: $SHORT_NAME"
        echo "  Start URL: $START_URL"
        echo "  Display: $DISPLAY"
    else
        echo -e "${RED}✗ Invalid JSON format${NC}"
    fi
else
    echo -e "${RED}✗ PWA Manifest not found${NC}"
fi

echo ""
echo "======================================"
echo "Testing Complete!"
echo "======================================"
echo ""
echo "Reports saved to: $OUTPUT_DIR"
echo ""
echo "Next Steps:"
echo "1. Open Lighthouse reports in browser"
echo "2. Review Core Web Vitals metrics"
echo "3. Check for performance regressions"
echo "4. Test on real mobile devices"
echo ""
echo "To view Lighthouse report:"
echo "  open $OUTPUT_DIR/lighthouse-mobile-$TIMESTAMP.html"
echo ""
