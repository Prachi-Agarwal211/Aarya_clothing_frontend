# Aarya Clothing - System Architecture & Security Rules

**Document Version:** 1.0  
**Last Updated:** April 2, 2026  
**Purpose:** Define clear architectural structure, security rules, and communication patterns

---

## 📐 **SYSTEM ARCHITECTURE OVERVIEW**

### **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         INTERNET / CLIENT SIDE                          │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │   Browser   │     │   Mobile    │     │  Search     │               │
│  │  (React/    │     │   App       │     │  Engines    │               │
│  │   Next.js)  │     │  (Future)   │     │  (SEO)      │               │
│  └──────┬──────┘     └──────┬──────┘     └──────┬──────┘               │
│         │                   │                    │                       │
│         └───────────────────┼────────────────────┘                       │
│                             │                                            │
│                      HTTPS (443)                                         │
│                      HTTP  (80)  ──→ Redirect to HTTPS                  │
└─────────────────────────────┼────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      NGINX REVERSE PROXY (Gateway)                      │
│                    Port 80 (HTTP) / 443 (HTTPS)                         │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  • SSL Termination (Let's Encrypt)                               │  │
│  │  • Content Security Policy (CSP) Headers                         │  │
│  │  • Rate Limiting                                                 │  │
│  │  • Request Routing:                                              │  │
│  │    - /              → Frontend (3000)                            │  │
│  │    - /api/v1/*      → Backend Services (5001-5004)               │  │
│  │    - /static/*      → Static Assets                              │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│   FRONTEND      │ │   COMMERCE      │ │     CORE        │
│   Next.js 15    │ │   FastAPI       │ │   FastAPI       │
│   Port 3000     │ │   Port 5002     │ │   Port 5001     │
│   (Internal)    │ │   (Internal)    │ │   (Internal)    │
│                 │ │                 │ │                 │
│  • SSR/SSG      │ │  • Products     │ │  • Auth         │
│  • React        │ │  • Cart         │ │  • Users        │
│  • Static       │ │  • Orders       │ │  • OTP          │
│  • AI Chat      │ │  • Inventory    │ │  • Email        │
└─────────────────┘ └─────────────────┘ └─────────────────┘
         │                    │                    │
         └────────────────────┼────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│    PAYMENT      │ │     ADMIN       │ │   MEILISEARCH   │
│   FastAPI       │ │   FastAPI       │ │   Search        │
│   Port 5003     │ │   Port 5004     │ │   Port 7700     │
│                 │ │                 │ │                 │
│  • Razorpay     │ │  • Dashboard    │ │  • Product      │
│  • Orders       │ │  • Analytics    │ │    Search       │
│  • Webhooks     │ │  • Inventory    │ │  • Typo-tolerant│
└─────────────────┘ └─────────────────┘ └─────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         DATA LAYER                                      │
│  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│  │  PostgreSQL │     │    Redis    │     │ Cloudflare  │               │
│  │   Port 5432 │     │   Port 6379 │     │     R2      │               │
│  │             │     │             │     │  (External) │               │
│  │  • Users    │     │  • Sessions │     │             │               │
│  │  • Products │     │  • Cache    │     │  • Images   │               │
│  │  • Orders   │     │  • Cart     │     │  • Videos   │               │
│  └─────────────┘     └─────────────┘     └─────────────┘               │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 **SECURITY RULES**

### **Rule #1: Content Security Policy (CSP)**

**PURPOSE:** Prevent XSS, CSRF, and injection attacks by controlling which resources the browser can load.

**CURRENT CSP (nginx.conf line ~193):**
```nginx
add_header Content-Security-Policy "
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' 
    https://checkout.razorpay.com 
    https://api.razorpay.com 
    https://lumberjack.razorpay.com 
    https://cdn.razorpay.com 
    https://www.google.com 
    https://www.gstatic.com;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  img-src 'self' data: https: blob:;
  font-src 'self' data: https://fonts.gstatic.com;
  connect-src 'self' 
    https://aaryaclothing.in 
    https://www.aaryaclothing.in 
    https://checkout.razorpay.com 
    https://api.razorpay.com 
    https://lumberjack.razorpay.com 
    https://cdn.razorpay.com 
    wss://api.razorpay.com 
    wss://checkout.razorpay.com 
    wss://aaryaclothing.in 
    https://www.google-analytics.com;
  frame-src 'self' https://checkout.razorpay.com https://api.razorpay.com;
  worker-src 'self' blob: https://checkout.razorpay.com https://api.razorpay.com https://cdn.razorpay.com;
  form-action 'self' https://api.razorpay.com;
  frame-ancestors 'self';
  media-src 'self' https://*.r2.dev https://pub-7846c786f7154610b57735df47899fa0.r2.dev https://*.r2.cloudflarestorage.com blob:;
" always;
```

**CSP DIRECTIVE BREAKDOWN:**

| Directive | Purpose | Allowed Sources |
|-----------|---------|-----------------|
| `default-src` | Fallback for all | `'self'` |
| `script-src` | JavaScript | `'self'`, Razorpay, Google |
| `style-src` | CSS | `'self'`, Google Fonts |
| `img-src` | Images | `'self'`, data:, blob:, HTTPS |
| `font-src` | Fonts | `'self'`, Google Fonts |
| **`connect-src`** | **Fetch/XHR/WebSocket** | **`'self'`, Razorpay, Analytics** |
| `frame-src` | iframes | Razorpay |
| `worker-src` | Service Workers | Razorpay |
| `form-action` | Form submissions | `'self'`, Razorpay |
| `media-src` | Video/Audio | R2 (Cloudflare) |

**⚠️ CRITICAL CSP RULES:**

1. **`connect-src` MUST include ALL API endpoints**
   - ✅ `https://aaryaclothing.in` (production domain)
   - ✅ `https://www.aaryaclothing.in` (www subdomain)
   - ❌ `http://nginx` (internal Docker hostname - NEVER use in browser)
   
2. **Frontend MUST use relative URLs or public domains**
   - ✅ `/api/v1/products` (relative - goes through nginx)
   - ✅ `https://aaryaclothing.in/api/v1/products` (public domain)
   - ❌ `http://nginx:80/api/v1/products` (internal - blocked by CSP)

3. **Image sources MUST be in `img-src` or `media-src`**
   - ✅ Cloudflare R2: `https://pub-7846c786f7154610b57735df47899fa0.r2.dev`
   - ✅ Wildcard: `https://*.r2.dev`

---

### **Rule #2: Environment Variable Separation**

**PURPOSE:** Prevent internal Docker URLs from leaking to client-side code.

**ENVIRONMENT VARIABLE TYPES:**

| Variable | Scope | Usage | Example |
|----------|-------|-------|---------|
| `NEXT_PUBLIC_*` | **Client + Server** | Exposed to browser | `NEXT_PUBLIC_API_URL` |
| `INTERNAL_*` | **Server Only** | Docker internal | `NEXT_PUBLIC_INTERNAL_COMMERCE_URL` |
| Private vars | **Server Only** | Secrets | `DATABASE_URL`, `SECRET_KEY` |

**✅ CORRECT USAGE:**

```javascript
// frontend_new/lib/baseApi.js

export function getCoreBaseUrl() {
  // 1. Server-side (SSR): Use internal Docker URL
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_INTERNAL_API_URL) {
    return process.env.NEXT_PUBLIC_INTERNAL_API_URL;  // http://core:5001
  }
  
  // 2. Client-side: Use public domain
  if (typeof window !== 'undefined') {
    return window.location.origin;  // https://aaryaclothing.in
  }
  
  // 3. Fallback: Relative URL
  return '';
}
```

**❌ WRONG USAGE:**

```javascript
// NEVER do this - leaks internal URL to browser
const API_URL = 'http://nginx:80';  // Browser can't resolve 'nginx'

// NEVER do this - CSP violation
fetch('http://nginx:80/api/v1/products');  // Blocked by CSP
```

---

### **Rule #3: Docker Network Isolation**

**PURPOSE:** Separate internal service communication from external traffic.

**NETWORK ARCHITECTURE:**

```
┌─────────────────────────────────────────────────────────────┐
│                    DOCKER NETWORKS                          │
├─────────────────────┬───────────────────────────────────────┤
│   frontend_network  │          backend_network              │
│   (External-facing) │      (Internal services only)         │
├─────────────────────┼───────────────────────────────────────┤
│  • Nginx            │  • Core (5001)                        │
│  • Frontend (3000)  │  • Commerce (5002)                    │
│  • Public access    │  • Payment (5003)                     │
│                     │  • Admin (5004)                       │
│                     │  • Postgres (5432)                    │
│                     │  • Redis (6379)                       │
│                     │  • Meilisearch (7700)                 │
└─────────────────────┴───────────────────────────────────────┘
```

**COMMUNICATION RULES:**

| Source | Destination | Allowed? | Method |
|--------|-------------|----------|--------|
| Browser → Nginx | ✅ Yes | HTTPS (443) |
| Browser → Frontend (direct) | ❌ No | Blocked by network |
| Nginx → Backend | ✅ Yes | HTTP (internal) |
| Frontend → Backend (internal) | ✅ Yes | HTTP (`http://core:5001`) |
| Frontend → Backend (browser) | ❌ No | Must go through nginx |

---

## 📋 **API COMMUNICATION PATTERNS**

### **Pattern 1: Server-Side Rendering (SSR)**

**FLOW:** Browser → Nginx → Frontend (SSR) → Backend → Frontend → Browser

```javascript
// frontend_new/app/products/[id]/page.js (Server Component)

export default async function ProductPage({ params }) {
  const { id } = await params;
  
  // ✅ CORRECT: Server-side uses internal URL
  const product = await fetch('http://commerce:5002/api/v1/products/' + id, {
    cache: 'no-store'
  });
  
  return <div>{product.name}</div>;
}
```

**WHY:** Server-side code runs inside Docker, can access internal hostnames.

---

### **Pattern 2: Client-Side Fetching**

**FLOW:** Browser → Nginx → Backend → Browser

```javascript
// frontend_new/app/products/[id]/ProductDetailClient.js (Client Component)
'use client';

export default function ProductDetailClient() {
  const [product, setProduct] = useState(null);
  
  useEffect(() => {
    // ✅ CORRECT: Uses relative URL, goes through nginx
    fetch('/api/v1/products/' + id)
      .then(res => res.json())
      .then(data => setProduct(data));
  }, [id]);
  
  return <div>{product?.name}</div>;
}
```

**WHY:** Browser can't resolve `http://nginx`, must use relative URLs or public domain.

---

### **Pattern 3: API Client Library**

**FLOW:** Component → API Client → URL Resolver → Fetch

```javascript
// frontend_new/lib/customerApi.js
import { commerceClient } from './baseApi';

export const productsApi = {
  list: (params = {}) => {
    // ✅ CORRECT: Lazy URL resolution at call time
    return commerceClient.get('/api/v1/products/browse', params);
  },
};

// frontend_new/lib/baseApi.js
export const commerceClient = new Proxy({}, {
  get: (_, prop) => {
    // ✅ Resolves URL when method is called, not at module load
    const client = new BaseApiClient(getCommerceBaseUrl());
    return client[prop]?.bind(client);
  }
});

export function getCommerceBaseUrl() {
  // Server: internal URL, Client: relative/public
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_INTERNAL_COMMERCE_URL) {
    return process.env.NEXT_PUBLIC_INTERNAL_COMMERCE_URL;
  }
  return getCoreBaseUrl();  // Falls back to window.location.origin
}
```

---

## 🚨 **CURRENT ISSUES & ROOT CAUSES**

### **Issue: CSP Blocking API Calls**

**ERROR:**
```
Fetch API cannot load http://nginx/api/v1/site/config.
Refused to connect because it violates CSP directive: connect-src 'self' ...
```

**ROOT CAUSE:**

1. **Frontend using internal Docker hostname in client-side code**
   - `http://nginx` is only resolvable inside Docker network
   - Browser receives this URL and tries to fetch it
   - DNS fails + CSP blocks it

2. **CSP `connect-src` missing required domains**
   - Current: `'self' https://aaryaclothing.in ...`
   - Missing: Relative URL support (implicit via `'self'`)

**SOLUTION:**

```javascript
// frontend_new/lib/baseApi.js - FIX NEEDED

export function getCoreBaseUrl() {
  // ❌ REMOVE: This leaks internal URL to client
  if (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_INTERNAL_API_URL) {
    return process.env.NEXT_PUBLIC_INTERNAL_API_URL;  // http://nginx:80
  }
  
  // ✅ KEEP: Server-side only
  if (typeof process !== 'undefined' && process.env.NEXT_PUBLIC_API_URL) {
    const url = process.env.NEXT_PUBLIC_API_URL.trim();
    if (url && url.length > 0) {
      try {
        new URL(url);
        return url;  // Should be public URL, not internal
      } catch (error) {
        console.warn('[baseApi] Invalid NEXT_PUBLIC_API_URL format:', url);
      }
    }
  }
  
  // ✅ KEEP: Client-side uses current origin
  if (typeof window !== 'undefined') {
    return window.location.origin;  // https://aaryaclothing.in
  }
  
  // ✅ KEEP: Relative URL fallback
  return '';
}
```

**docker-compose.yml - FIX NEEDED:**

```yaml
frontend:
  environment:
    # ❌ WRONG: Internal Docker URL exposed to browser
    - NEXT_PUBLIC_API_URL=http://nginx:80
    
    # ✅ CORRECT: Public URL
    - NEXT_PUBLIC_API_URL=https://aaryaclothing.in
    
    # ✅ CORRECT: Internal URL for SSR only (rename variable)
    - NEXT_PUBLIC_INTERNAL_API_URL=http://core:5001
```

---

## 📐 **CODING STANDARDS**

### **Rule #1: Never Hardcode Internal Hostnames**

```javascript
// ❌ WRONG
const API = 'http://nginx:80';
const API = 'http://core:5001';
const API = 'http://commerce:5002';

// ✅ CORRECT
import { getCoreBaseUrl } from '@/lib/baseApi';
const API = getCoreBaseUrl();  // Resolves correctly based on context
```

### **Rule #2: Always Use API Client Library**

```javascript
// ❌ WRONG
fetch('http://nginx:80/api/v1/products');

// ✅ CORRECT
import { productsApi } from '@/lib/customerApi';
const products = await productsApi.list();
```

### **Rule #3: Server Components Use Internal URLs**

```javascript
// ✅ CORRECT: Server Component (app/products/page.js)
export default async function ProductsPage() {
  const res = await fetch('http://commerce:5002/api/v1/products');
  // Server can resolve 'commerce' hostname
}

// ✅ CORRECT: Client Component (app/products/ProductList.js)
'use client';
export default function ProductList() {
  useEffect(() => {
    fetch('/api/v1/products');  // Relative URL through nginx
  }, []);
}
```

---

## 🔧 **DEPLOYMENT CONFIGURATION**

### **docker-compose.yml - Environment Variables**

```yaml
services:
  frontend:
    build:
      args:
        # ✅ Build-time: Public URL for static generation
        - NEXT_PUBLIC_API_URL=https://aaryaclothing.in
        - NEXT_PUBLIC_INTERNAL_COMMERCE_URL=http://commerce:5002
    environment:
      # ✅ Runtime: Public URL for client-side
      - NEXT_PUBLIC_API_URL=https://aaryaclothing.in
      # ✅ Runtime: Internal URL for SSR (server-only)
      - NEXT_PUBLIC_INTERNAL_COMMERCE_URL=http://commerce:5002
```

### **nginx.conf - CSP Configuration**

```nginx
# ✅ CORRECT: CSP allows public domain
add_header Content-Security-Policy "
  connect-src 'self' 
    https://aaryaclothing.in 
    https://www.aaryaclothing.in
    https://checkout.razorpay.com
    ...;
" always;

# ✅ CORRECT: Proxy passes API requests to backend
location /api/v1/ {
  proxy_pass http://$core_backend;  # Resolves to core:5001
  proxy_set_header Host $host;
  proxy_set_header X-Real-IP $remote_addr;
}
```

---

## ✅ **CHECKLIST FOR DEVELOPERS**

### **Before Committing Code:**

- [ ] No hardcoded internal hostnames (`http://nginx`, `http://core`, etc.)
- [ ] All API calls use `customerApi.js` or `baseApi.js`
- [ ] Client components use relative URLs (`/api/v1/...`)
- [ ] Server components can use internal URLs (`http://commerce:5002`)
- [ ] No `NEXT_PUBLIC_*` variables contain internal Docker URLs
- [ ] CSP allows all required external domains

### **Before Deploying:**

- [ ] `docker-compose.yml` sets `NEXT_PUBLIC_API_URL` to public domain
- [ ] `docker-compose.yml` sets `NEXT_PUBLIC_INTERNAL_*` for SSR
- [ ] nginx CSP includes production domain in `connect-src`
- [ ] nginx CSP includes all third-party services (Razorpay, R2, etc.)

---

## 📖 **GLOSSARY**

| Term | Definition |
|------|------------|
| **SSR** | Server-Side Rendering - React rendered on server |
| **SSG** | Static Site Generation - Pre-built HTML at build time |
| **CSP** | Content Security Policy - Browser security header |
| **R2** | Cloudflare R2 - Object storage (S3-compatible) |
| **HttpOnly Cookie** | Cookie inaccessible to JavaScript (security) |
| **Relative URL** | `/api/v1/products` - Uses current domain |
| **Absolute URL** | `https://aaryaclothing.in/api/v1/products` |
| **Internal Hostname** | `http://nginx` - Only works inside Docker |

---

**END OF DOCUMENT**
