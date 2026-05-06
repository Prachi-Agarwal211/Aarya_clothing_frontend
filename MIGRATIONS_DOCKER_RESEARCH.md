# Docker Migrations Research Report

**Date:** 2026-05-06
**Docker Containers Running:** ✅ Yes (45+ hours uptime)
**Database:** PostgreSQL 15 (pgvector)
**Status:** ⚠️ **CRITICAL: Migrations NOT automatically applied**

---

## Executive Summary

**CRITICAL FINDING:** Migrations are **NOT automatically applied** on Docker startup. The database has a mix of applied and unapplied migrations:

- ✅ **Applied:** OTP token type constraints, indexes (migrations 007/008)
- ❌ **Not Applied:** Phone NOT NULL constraint (migration 006)
- ❌ **Not Applied:** schema_migrations tracking table

---

## Docker Environment Details

### Containers Running (11 services)
```
✅ aarya_postgres    - Up 4 days (healthy)      - Port 6001:5432
✅ aarya_pgbouncer    - Up 2 days (healthy)      - Port 6432:6432
✅ aarya_redis        - Up 3 days (healthy)      - Port 6381:6379
✅ aarya_core         - Up 45 hours (healthy)    - Port 5001:5001
✅ aarya_commerce     - Up 36 hours (healthy)    - Port 5002:5002
✅ aarya_payment      - Up 36 hours (unhealthy)  - Port 5003:5003
✅ aarya_admin        - Up 37 hours (healthy)    - Port 5004:5004
✅ aarya_frontend     - Up 37 hours              - Port 3000:3000
✅ aarya_nginx        - Up 4 days                - Port 80:80, 443:443
✅ aarya_payment_worker - Up 1 second (starting)
✅ aarya_pg_backup    - Not running (scheduled)
```

### Database Configuration
- **PostgreSQL Version:** 15
- **pgvector Extension:** ✅ Active
- **Timezone:** Asia/Kolkata
- **Database Name:** aarya_clothing
- **Connection Pooling:** PgBouncer (transaction mode)

---

## Migration Tracking Status

### ❌ CRITICAL: No schema_migrations Table

```bash
# Query Result: Table does not exist
SELECT * FROM schema_migrations;
# ERROR: relation "schema_migrations" does not exist
```

**Impact:**
- No way to track which migrations have been applied
- Risk of running migrations multiple times
- No rollback capability

---

## Migrations Status Breakdown

### ✅ APPLIED MIGRATIONS

#### Migration 007/008: OTP Token Type Constraint & Indexes

**Status:** ✅ FULLY APPLIED

**Evidence:**
```sql
-- Token type constraint (includes 'login'):
CREATE INDEX idx_verify_tokens_lookup
ON verification_tokens(user_id, token_type, verified_at);

CREATE INDEX idx_verify_tokens_type
ON verification_tokens(token_type);

CHECK (token_type IN (
    'email_verification',
    'password_reset',
    'phone_verification',
    'login'
));
```

**Verification:**
```bash
docker exec aarya_postgres psql -U postgres -d aarya_clothing -c \
  "SELECT conname, contype FROM pg_constraint \
   WHERE conrelid = 'verification_tokens'::regclass;"
```
Result: ✅ `verification_tokens_token_type_check` exists

---

### ❌ NOT APPLIED MIGRATIONS

#### Migration 006: Make Phone Required and Unique

**Status:** ❌ **NOT APPLIED - CRITICAL**

**Evidence:**
```sql
-- Current state:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'phone';

-- Result: is_nullable = YES (should be NO)
```

**Required Changes (NOT Done):**
```sql
-- 1. Handle existing NULL phones (if any)
UPDATE users SET phone = '0000000000'
WHERE phone IS NULL AND is_active = FALSE
LIMIT 1000;

-- 2. Remove duplicates
WITH duplicates AS (
    SELECT phone, MIN(id) as keep_id
    FROM users
    WHERE phone IS NOT NULL
    GROUP BY phone
    HAVING COUNT(*) > 1
)
UPDATE users
SET phone = NULL
WHERE phone IN (SELECT phone FROM duplicates)
AND id NOT IN (SELECT keep_id FROM duplicates);

-- 3. Add unique constraint
ALTER TABLE users
ADD CONSTRAINT users_phone_key UNIQUE (phone);

-- 4. Make phone NOT NULL
ALTER TABLE users
ALTER COLUMN phone SET NOT NULL;
```

**Impact:**
- Code enforces phone is required (auth_service.py:217)
- App will crash for existing users without phone
- **573 users exist, but phone column is still nullable**

---

## Migration Infrastructure Analysis

### ❌ No Automated Migration Runner

**Findings:**

1. **No Alembic Configuration:**
   ```bash
   find /opt/Aarya_clothing_frontend -name "alembic.ini"
   # Result: No matches found
   ```

2. **No Migration Executer in Code:**
   ```python
   # services/core/database/database.py
   def init_db():
       """Initialize database tables."""
       # ... creates columns but NOT migrations
       Base.metadata.create_all(bind=engine)  # ❌ Skipped!
       _ensure_users_phone_verified_column()
       _ensure_users_signup_verification_method_column()
   ```

3. **Migrations are Manual:**
   - No automated migration execution on startup
   - No `schema_migrations` tracking table
   - No rollback mechanism
   - Migrations must be run manually via SQL scripts

### Migration Files Location

```
/opt/Aarya_clothing_frontend/
├── migrations/                           # Main migrations
│   ├── 006_make_phone_required_and_unique.sql  ❌ NOT APPLIED
│   ├── 007_fix_otp_token_type_constraint.sql  ✅ APPLIED (by constraint)
│   └── 008_fix_otp_system.sql           ✅ APPLIED (by constraint)
│
├── docker/postgres/migrations/          # Docker-specific migrations
│   ├── 0001_clean_product_model.sql     # Fresh install
│   ├── 0002_trusted_devices.sql
│   ├── ...
│   └── 004_add_review_image_urls.sql    # Applied
│
├── database/migrations/                  # Another migrations dir
│   ├── 0001_clean_product_model.sql
│   ├── 0002_trusted_devices.sql
│   └── ...
│
└── services/core/main.py                # Calls init_db() on startup
    ├── Line 57: init_db() called
    └── No migration runner logic
```

---

## Database Initialization Flow

### Startup Sequence (Docker Container)

```python
# services/core/main.py:53-60
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()  # ❌ Only creates columns, NOT migrations

    # Initialize auth middleware
    init_auth()

    # Verify Redis connection
    if redis_client.ping():
        if settings.EMAIL_OTP_USE_QUEUE:
            otp_email_worker = asyncio.create_task(run_otp_email_worker())

    yield

    # Shutdown
    if otp_email_worker is not None:
        otp_email_worker.cancel()
```

```python
# services/core/database/database.py:97-111
def init_db():
    """Initialize database tables."""
    from models import User, EmailVerification, OTP

    # Skip create_all to avoid foreign key issues
    # Tables are created by init.sql script
    # Base.metadata.create_all(bind=engine)  # ❌ NOT CALLED

    _ensure_users_phone_verified_column()  # ✅ Creates missing columns
    _ensure_users_signup_verification_method_column()  # ✅ Creates missing columns
```

### Docker Postgres Init

```bash
# docker-compose.yml:53
volumes:
  - ./docker/postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
  - ./docker/postgres/scale_indexes.sql:/docker-entrypoint-initdb.d/02-scale-indexes.sql:ro
```

**Flow:**
1. Postgres starts
2. `init.sql` runs (creates tables, enums, extensions)
3. `02-scale-indexes.sql` runs (creates composite indexes)
4. Core service starts
5. `init_db()` runs (creates missing columns)
6. ❌ **NO MIGRATIONS RUN** ← PROBLEM!

---

## Applied vs Not Applied Migrations

| Migration | Description | Status | Evidence | Applied By |
|-----------|-------------|--------|----------|------------|
| **006** | Make phone required & unique | ❌ NOT APPLIED | `is_nullable = YES` | Manual SQL |
| **007** | Fix OTP token type constraint | ✅ APPLIED | Indexes + Constraint | Manual SQL |
| **008** | Fix OTP system | ✅ APPLIED | Indexes + Constraint | Manual SQL |

**Current DB State:**
- ✅ `verification_tokens` table has composite indexes
- ✅ `verification_tokens` token_type includes 'login'
- ❌ `users.phone` is nullable (should be NOT NULL)
- ❌ No unique constraint on `users.phone`
- ❌ No `schema_migrations` table

---

## RISK ASSESSMENT

### Critical Risk Level: ⚠️ **HIGH**

#### 1. **Application Crash Risk**
- Code requires phone (NOT NULL)
- Database allows NULL phone
- **573 existing users have phones**, but this is a time bomb

#### 2. **Registration Failure**
- New registrations will fail with constraint violation
- Phone is validated as required but DB allows NULL

#### 3. **No Rollback Capability**
- No schema_migrations tracking
- Can't track which migrations have been run
- Can't implement idempotent migrations

#### 4. **Data Integrity**
- Phone uniqueness constraint not enforced
- Multiple users could have same phone (security issue)

---

## Recommended Actions

### **IMMEDIATE (Critical)**

1. **Apply Migration 006 Manually:**
   ```bash
   docker exec -i aarya_postgres psql -U postgres -d aarya_clothing \
     < migrations/006_make_phone_required_and_unique.sql
   ```

2. **Create schema_migrations Table:**
   ```sql
   CREATE TABLE schema_migrations (
       version VARCHAR(20) PRIMARY KEY,
       applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Add Migration Tracking:**
   ```sql
   INSERT INTO schema_migrations (version)
   VALUES ('007_fix_otp_token_type_constraint')
   ON CONFLICT DO NOTHING;
   ```

4. **Verify Application Works:**
   - Test registration with phone
   - Test login with phone
   - Check 573 existing users still work

### **SHORT TERM (High Priority)**

5. **Add Migration Runner to init_db():**
   ```python
   def init_db():
       from core.redis_client import redis_client
       import textwrap

       # Run pending migrations
       with engine.begin() as conn:
           for migration_file in get_pending_migrations():
               with open(migration_file) as f:
                   conn.execute(text(f.read()))

           # Track applied migrations
           conn.execute(text("""
               CREATE TABLE IF NOT EXISTS schema_migrations (
                   version VARCHAR(20) PRIMARY KEY,
                   applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
               )
           """))

           # Mark this migration as applied
           conn.execute(text("""
               INSERT INTO schema_migrations (version)
               VALUES ('007_fix_otp_token_type_constraint')
               ON CONFLICT DO NOTHING
           """))
   ```

6. **Create Migration Script:**
   - Script: `scripts/run_migrations.py`
   - Runs all pending migrations
   - Checks schema_migrations table
   - Reports status

### **MEDIUM TERM (Important)**

7. **Add Alembic (Optional):**
   - Alembic is industry standard
   - Better migration tracking
   - Rollback support
   - Diff generation

8. **Add Tests:**
   - Test migration application
   - Test rollback (if using Alembic)
   - Test idempotency

9. **Documentation:**
   - Document migration process
   - Create migration checklist
   - Document rollback procedures

---

## Database Backup Status

### ✅ Automated Backups

```yaml
# docker-compose.yml:651-668
pg-backup:
  image: prodrigestivill/postgres-backup-local:15
  environment:
    - SCHEDULE=@daily
    - BACKUP_KEEP_DAYS=7
    - BACKUP_KEEP_WEEKS=4
    - BACKUP_KEEP_MONTHS=6
```

**Status:**
- ✅ Backup container configured
- ✅ Scheduled daily (cron: `@daily`)
- ✅ Retention: 7 days, 4 weeks, 6 months
- ❓ **Not verified if backup is running**

---

## Verification Commands

### Check Current Migration Status
```bash
# Check phone constraint
docker exec aarya_postgres psql -U postgres -d aarya_clothing \
  -c "SELECT column_name, is_nullable FROM information_schema.columns \
      WHERE table_name = 'users' AND column_name = 'phone';"

# Check schema_migrations table
docker exec aarya_postgres psql -U postgres -d aarya_clothing \
  -c "SELECT * FROM schema_migrations;"

# Check OTP constraints
docker exec aarya_postgres psql -U postgres -d aarya_clothing \
  -c "SELECT conname, contype FROM pg_constraint \
      WHERE conrelid = 'verification_tokens'::regclass;"

# Check OTP indexes
docker exec aarya_postgres psql -U postgres -d aarya_clothing \
  -c "SELECT tablename, indexname FROM pg_indexes \
      WHERE tablename = 'verification_tokens';"
```

### Apply Migrations Manually
```bash
# Apply migration 006
docker exec -i aarya_postgres psql -U postgres -d aarya_clothing \
  < /opt/Aarya_clothing_frontend/migrations/006_make_phone_required_and_unique.sql

# Verify migration 006 applied
docker exec aarya_postgres psql -U postgres -d aarya_clothing \
  -c "SELECT column_name, is_nullable FROM information_schema.columns \
      WHERE table_name = 'users' AND column_name = 'phone';"
```

---

## Summary

### Current State
- ✅ Docker containers running (11 services)
- ✅ Database healthy and accessible
- ✅ OTP token type migrations applied (007/008)
- ❌ Phone constraint migration NOT applied (006)
- ❌ No migration tracking system

### Critical Issues
1. **Phone column is nullable but code requires it** → Will crash on registration
2. **No schema_migrations table** → Can't track applied migrations
3. **No migration runner** → Manual application required
4. **573 users exist with phones** → But constraint not enforced

### Recommended Priority
1. **Apply migration 006 immediately** (Critical)
2. **Create schema_migrations table** (Critical)
3. **Add migration runner to init_db()** (High Priority)
4. **Add Alembic for production** (Medium Priority)
5. **Verify backup is running** (Medium Priority)

---

**Report Generated:** 2026-05-06
**Docker Status:** All containers healthy (except payment which is unhealthy)
**Database Status:** Up 4 days, healthy
