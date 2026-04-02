# Products Page API 404 Error - Root Cause Analysis

## Issue Summary
The products page at `/products` shows "Loading..." forever because API calls are failing with 404 errors.

## Root Cause
**The frontend is being accessed directly on port 6004, bypassing nginx.**

When you access `http://localhost:6004/products`:
- The browser loads the Next.js app from the frontend container ✅
- The client-side JavaScript tries to fetch from `/api/v1/products/browse` 
- This request goes to `http://localhost:6004/api/v1/products/browse`
- The frontend container doesn't have an API server → **404 Not Found** ❌

## How It Should Work
The application is designed to be accessed **through nginx** (port 80 or production domain):

```
Browser → nginx (port 80) → Frontend (for HTML/JS/CSS)
                          → Commerce Service (for /api/v1/products/*)
                          → Core Service (for /api/v1/auth/*)
```

When accessed through nginx:
- Browser loads Next.js app from frontend via nginx ✅
- Client-side JavaScript fetches from `/api/v1/products/browse`
- This request goes to `http://localhost/api/v1/products/browse`
- nginx proxies the request to the commerce service ✅
- API responds with product data ✅

## Verification

### ❌ Direct Frontend Access (BROKEN)
```bash
# This FAILS because frontend container doesn't serve API
curl http://localhost:6004/api/v1/products/browse?page=1
# Result: 404 Not Found
```

### ✅ Through Nginx (WORKS)
```bash
# This WORKS because nginx routes API to commerce service
curl http://localhost:80/api/v1/products/browse?page=1
# Result: 200 OK with product data
```

## Solution

### Option 1: Access Through Nginx (RECOMMENDED)
**Use port 80 (or production domain) instead of port 6004:**

- **Local Development:** `http://localhost` or `http://localhost:80`
- **Production:** `https://aaryaclothing.in`

**DO NOT use:** `http://localhost:6004` (this bypasses nginx)

### Option 2: Update Docker Compose for Local Development
If you need to access the frontend directly during development, modify `docker-compose.yml`:

```yaml
# Remove the direct frontend port exposure
# ports:
#   - "6004:3000"  # Comment out or remove this line

# Keep only nginx exposed
nginx:
  ports:
    - "80:80"
    - "443:443"
```

Then access the site ONLY through nginx on port 80.

### Option 3: Add API Proxy to Frontend (NOT RECOMMENDED)
You could add a custom server to the Next.js app to proxy API requests, but this:
- Duplicates nginx functionality
- Adds complexity
- Goes against the architecture design

## Testing

### Verify API Works Through Nginx
```bash
# Test products API
curl -s "http://localhost/api/v1/products/browse?page=1&limit=24" | jq '.total'
# Expected: 7

# Test collections API  
curl -s "http://localhost/api/v1/collections" | jq 'length'
# Expected: number of collections
```

### Verify Frontend Loads Products
1. Open browser to `http://localhost/products` (NOT :6004)
2. Check browser console - should see no API errors
3. Products should load and display

## Additional Issue: Collections Redirect Loop

There's a secondary issue with redirect loops on `/api/v1/collections`:

```
GET /api/v1/collections => 301 Moved Permanently
GET /api/v1/collections/ => 307 Temporary Redirect
(repeats in loop)
```

This is caused by the commerce service redirecting between trailing and non-trailing slashes. The products API works fine because it doesn't have this issue.

**Fix:** The commerce service should be updated to not redirect, or nginx should handle trailing slashes consistently.

## Architecture Reference

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────┐
│         nginx (Port 80)         │
│  - Routes / to frontend:3000    │
│  - Routes /api/v1/* to services │
└─────────┬───────────────────────┘
          │
    ┌─────┴─────┬──────────┬──────────┐
    ▼           ▼          ▼          ▼
┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐
│Frontend│ │ Core   │ │Commerce│ │Payment │
│:3000   │ │:5001   │ │:5002   │ │:5003   │
└────────┘ └────────┘ └────────┘ └────────┘
```

## Key Takeaway
**Always access the application through nginx (port 80/443), never directly to the frontend container (port 6004).**

The frontend container is designed to serve Next.js SSR/SSG content only, NOT API requests. All API routing is handled by nginx.
