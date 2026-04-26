#!/bin/bash

# Setup Maintenance Mode for Aarya Clothing
# This script modifies nginx configuration to enable maintenance mode

set -e

NGINX_CONF="docker/nginx/nginx.conf"
MAINTENANCE_CONF="docker/nginx/snippets/maintenance.conf"
MAINTENANCE_HTML="docker/nginx/maintenance.html"

# Step 1: Verify files exist
echo "Checking files..."
[ -f "$MAINTENANCE_CONF" ] || { echo "ERROR: $MAINTENANCE_CONF not found"; exit 1; }
[ -f "$MAINTENANCE_HTML" ] || { echo "ERROR: $MAINTENANCE_HTML not found"; exit 1; }
[ -f "$NGINX_CONF" ] || { echo "ERROR: $NGINX_CONF not found"; exit 1; }

# Step 2: Backup nginx.conf
echo "Backing up nginx.conf..."
cp "$NGINX_CONF" "$NGINX_CONF.bak"

# Step 3: Add include for maintenance.conf in http block
# Find line with "http {" and add include after mime.types include
echo "Adding maintenance.conf include..."
sed -i '/include.*mime.types/a\    # ==========================================\n    # MAINTENANCE MODE INCLUSION\n    # ==========================================\n    include /etc/nginx/snippets/maintenance.conf;\n' "$NGINX_CONF"

# Step 4: Modify HTTP server (listen 80) location / block
# We need to add maintenance check before the redirect logic
echo "Modifying HTTP server location /..."

# Create a temporary file for the HTTP server block modification
# Find the HTTP server block (listen 80) and modify its location /

# Use awk to find and modify the HTTP server block
awk '
/^    server \{/,/^    \}$/ {
    if ($0 ~ /listen 80/) {
        in_http_server = 1
    }
    if (in_http_server && $0 ~ /location \/ \{/) {
        print
        print "            if (\$serve_maintenance = 1) {"
        print "                rewrite ^ /maintenance.html break;"
        print "            }"
        print "            "
        in_location = 1
        next
    }
    if (in_location && $0 ~ /^        \}$/) {
        print
        print "        # Serve maintenance page - HTTP Server"
        print "        location = /maintenance.html {"
        print "            root /etc/nginx/html;"
        print "            internal;"
        print "        }"
        print ""
        in_location = 0
        in_http_server = 0
        next
    }
    print
    next
}
{ print }
' "$NGINX_CONF" > "$NGINX_CONF.tmp" && mv "$NGINX_CONF.tmp" "$NGINX_CONF"

# Step 5: Modify HTTPS server (listen 443) location / block
echo "Modifying HTTPS server location /..."

# Use awk to find and modify the HTTPS server block
awk '
/^    server \{/,/^    \}$/ {
    if ($0 ~ /listen 443 ssl/) {
        in_https_server = 1
    }
    if (in_https_server && $0 ~ /# FRONTEND/ && !modified_https) {
        print
        print "        # =========================================="
        print "        # MAINTENANCE MODE HANDLER - HTTPS Server"
        print "        # =========================================="
        modified_https = 1
        next
    }
    if (modified_https && $0 ~ /location \/ \{/) {
        print
        print "            if (\$serve_maintenance = 1) {"
        print "                rewrite ^ /maintenance.html break;"
        print "            }"
        print "            "
        in_location_https = 1
        modified_https = 0
        next
    }
    if (in_location_https && $0 ~ /^        \}$/ && !added_maintenance_html) {
        print
        print "        # Serve maintenance page - HTTPS Server"
        print "        location = /maintenance.html {"
        print "            root /etc/nginx/html;"
        print "            internal;"
        print "        }"
        added_maintenance_html = 1
        in_location_https = 0
        next
    }
    print
    next
}
{ print }
' "$NGINX_CONF" > "$NGINX_CONF.tmp" && mv "$NGINX_CONF.tmp" "$NGINX_CONF"

echo "nginx.conf modified successfully!"
echo ""
echo "To enable maintenance mode:"
echo "1. Edit $MAINTENANCE_CONF and change: set \$maintenance_mode on;"
echo "2. Run: docker compose up -d --no-deps nginx"
echo ""
echo "To disable maintenance mode:"
echo "1. Edit $MAINTENANCE_CONF and change: set \$maintenance_mode off;"
echo "2. Run: docker compose up -d --no-deps nginx"
