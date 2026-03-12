# PRODUCTION VALIDATION PROTOCOL – DOCKER & RUNTIME VERIFICATION MODE

You are operating in Production-Safe Validation Mode.

All code changes MUST be validated through Docker and Nginx before considered complete.

No change is complete until runtime validation passes.

--------------------------------------------
RULE 0 — LOCAL PORT TESTING IS FORBIDDEN
--------------------------------------------

You MUST NOT validate services by calling:
- http://localhost:5001
- http://localhost:5002
- http://localhost:5003
- http://localhost:5004

All API testing MUST go through:

http://localhost:6005

This ensures:
- Nginx routing validation
- CORS validation
- Gateway rules validation
- Rate limiting validation
- Header validation

--------------------------------------------
STAGE 1 — DETERMINE IF DOCKER REBUILD IS REQUIRED
--------------------------------------------

Rebuild is REQUIRED if change touches:

- Any backend service file
- requirements.txt
- Dockerfile
- docker-compose.yml
- shared/
- nginx.conf
- Environment variables
- Database schema
- Models or schemas
- ServiceClient logic
- Meilisearch integration
- Redis logic

Frontend-only UI changes:
→ Rebuild frontend container only.

--------------------------------------------
STAGE 2 — FULL CLEAN REBUILD PROCEDURE
--------------------------------------------

When rebuild required:

1) Stop containers
   docker compose down

2) Remove volumes IF schema changed
   docker compose down -v

3) Rebuild images
   docker compose build --no-cache

4) Start fresh
   docker compose up -d

5) Wait for:
   - postgres healthy
   - redis ready
   - meilisearch ready
   - all services responding to /health

--------------------------------------------
STAGE 3 — SERVICE HEALTH VALIDATION
--------------------------------------------

Validate:

GET http://localhost:6005/api/v1/auth/health
GET http://localhost:6005/api/v1/products
GET http://localhost:6005/api/v1/admin/dashboard/overview

If any 502 → nginx misrouting.
If any 500 → service error.
If timeout → container not healthy.

--------------------------------------------
STAGE 4 — DATABASE VALIDATION
--------------------------------------------

If schema changed:

- Verify new columns exist
- Verify constraints
- Verify enums
- Verify foreign keys
- Verify migration did not wipe critical data

Confirm:
- No missing columns
- No unexpected null violations
- No broken joins

--------------------------------------------
STAGE 5 — REDIS VALIDATION
--------------------------------------------

If change affects:
- cart
- auth sessions
- caching
- search

Validate:
- Keys are being created
- No namespace collisions
- TTL works
- Cache invalidation works

--------------------------------------------
STAGE 6 — MEILISEARCH VALIDATION
--------------------------------------------

If change affects:
- products
- search
- filters
- indexing

Validate:
- Index exists
- Search returns results
- Filters work
- No schema mismatch

--------------------------------------------
STAGE 7 — FRONTEND VALIDATION (MCP BROWSER REQUIRED)
--------------------------------------------

Use MCP browser to validate:

1) Homepage loads
2) Products page loads
3) Login works
4) Cart works
5) Checkout works
6) Admin dashboard loads
7) No console errors
8) No CORS errors
9) No 404 on API calls
10) Network tab shows requests routed via port 6005

If frontend makes request to 5001/5002 directly → configuration error.

--------------------------------------------
STAGE 8 — END-TO-END FLOW TESTING
--------------------------------------------

Test at least:

1) Register user
2) Login
3) Add product to cart
4) Create order
5) Payment flow (mock if needed)
6) Admin sees order
7) Status update reflects in user panel

All through Nginx gateway.

--------------------------------------------
STAGE 9 — NGINX ROUTE VALIDATION
--------------------------------------------

If new endpoint added:

- Ensure nginx.conf includes route
- Ensure correct upstream
- Rebuild nginx container
- Validate via gateway

--------------------------------------------
STAGE 10 — FAILURE HANDLING
--------------------------------------------

If any stage fails:

1) Identify root cause
2) Identify which layer failed:
   - Code
   - Schema
   - Nginx
   - Docker
   - Env variable
3) Fix systematically
4) Re-run full validation

Never partially validate.

--------------------------------------------
COMPLETION CRITERIA
--------------------------------------------

A change is considered COMPLETE only if:

- Docker rebuild passes
- All containers healthy
- Nginx routing verified
- Database validated
- Redis validated (if used)
- Meilisearch validated (if used)
- MCP frontend validated
- End-to-end flow passes
- No console errors
- No 500 errors
- No 502 errors

--------------------------------------------
STRICT MODE
--------------------------------------------

If user requests skipping validation:

You MUST refuse and state:

"Change requires Docker-level runtime validation before completion."

--------------------------------------------
OPERATING PRINCIPLE
--------------------------------------------

You are validating a production-grade distributed architecture.

The system must function as a unified deployed environment,
not as isolated services.

Never assume success.
Always verify through gateway.
Always rebuild when architecture changes.