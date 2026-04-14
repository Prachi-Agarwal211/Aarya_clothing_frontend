# Core Service — Authentication & Users

**Port:** 5001 (internal Docker) | **Exposed via nginx:** `/api/v1/auth/`, `/api/v1/users/`, `/api/v1/site/`

## Responsibilities
- User registration, login, password reset
- OTP-based email verification
- Session management (JWT tokens in httpOnly cookies)
- Email delivery (SMTP / Amazon SES)
- Site configuration (logo, settings)

## Technology Stack
- **Framework:** FastAPI
- **Database:** PostgreSQL 15 (via PgBouncer)
- **Cache:** Redis (DB 0)
- **ORM:** SQLAlchemy 2.0
- **Auth:** python-jose (JWT HS256)
- **Password Hashing:** passlib[bcrypt]

## Environment Variables

See `.env` at project root. Key variables for this service:

```env
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_MINUTES=1440
SESSION_EXPIRE_MINUTES=1440
DATABASE_URL=postgresql://postgres:PASSWORD@pgbouncer:6432/aarya_clothing
REDIS_URL=redis://:REDIS_PASSWORD@redis:6379/0

# Email (SMTP or SES)
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_USER=noreply@aaryaclothing.in
SMTP_PASSWORD=your-password
SMTP_TLS=true
EMAIL_FROM=noreply@aaryaclothing.in
EMAIL_FROM_NAME=Aarya Clothing

# MSG91 SMS
MSG91_AUTH_KEY=...
MSG91_TEMPLATE_ID=...
MSG91_SENDER_ID=...

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBER=true

# Rate Limiting
LOGIN_RATE_LIMIT=10
LOGIN_RATE_WINDOW=300
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_MINUTES=15

# Cookie Settings
COOKIE_SECURE=false
COOKIE_HTTPONLY=true
COOKIE_SAMESITE=lax
```

## Running Locally

```bash
# From project root (uses Docker Compose)
docker-compose up -d core

# Or standalone (after setting .env)
cd services/core
uvicorn main:app --reload --host 0.0.0.0 --port 5001
```

## API Endpoints (via nginx)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register new user |
| POST | `/api/v1/auth/login` | Login with email/password |
| POST | `/api/v1/auth/send-verification-otp` | Send email verification OTP |
| POST | `/api/v1/auth/verify-email` | Verify email with OTP |
| POST | `/api/v1/auth/forgot-password-otp` | Request password reset OTP |
| POST | `/api/v1/auth/reset-password` | Reset password with OTP |
| GET  | `/api/v1/users/me` | Get current user profile |
| GET  | `/api/v1/site/config` | Get site configuration (logo, etc.) |
| GET  | `/api/v1/health` | Health check |

## Running the Service

```bash
# Docker (recommended)
cd /opt/Aarya_clothing_frontend
docker-compose up -d core

# Standalone development
cd services/core
uvicorn main:app --reload --host 0.0.0.0 --port 5001

# Production (6 workers)
uvicorn main:app --host 0.0.0.0 --port 5001 --workers 6
```

## API Documentation

When running locally:
- **Swagger UI:** http://localhost:5001/docs
- **ReDoc:** http://localhost:5001/redoc

## Troubleshooting

### Email not sending
- Check SMTP credentials in `.env`
- Verify `SMTP_HOST`, `SMTP_PORT`, `SMTP_TLS` settings
- Check logs: `docker logs aarya_core --tail 100 | grep -i email`
- Hostinger SMTP has rate limits — consider switching to Amazon SES

### Redis connection failed
- Ensure Redis container is running: `docker exec aarya_redis redis-cli ping`
- Check `REDIS_URL` in `.env`

### Database connection failed
- Ensure PostgreSQL and PgBouncer are healthy
- Check `DATABASE_URL` in `.env`

### Token validation fails
- Check `SECRET_KEY` is consistent across all 4 services
- Verify token hasn't expired

## Contributing

See the main project `AGENTS.md` and `.qwen/skills/` for development workflows.
