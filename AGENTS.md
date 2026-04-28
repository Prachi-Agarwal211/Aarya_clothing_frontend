# Aarya Clothing - Agent Guidelines

## Project Context

Aarya Clothing is an e-commerce platform with a microservices architecture consisting of:
- **Core Service**: User authentication, authorization, and profile management  
- **Commerce Service**: Product catalog, inventory, pricing, and variants
- **Payment Service**: Payment processing, orders, and transactions
- **Frontend**: Customer-facing web application (frontend_new/)

## Architecture Overview

### Services
```
services/
├── core/          # User auth, profiles, OTP, verification
├── commerce/      # Products, variants, inventory, categories
└── payment/       # Orders, payments, refunds
```

### Technology Stack
- **Backend**: Python (Django/Flask)
- **Frontend**: Modern JavaScript framework (React/Vue)
- **Database**: PostgreSQL/MySQL
- **Cache**: Redis
- **Message Queue**: RabbitMQ/Celery
- **Containerization**: Docker, Docker Compose

## Key Business Rules

### 1. Authentication & User Journey
- **Account Not Found**: "Account not found. Please create an account first."
- **Incorrect Password**: "Incorrect password. Please try again."
- **Not Verified**: "Account not verified. Please complete your registration verification."
- **OTP Expiry**: Exactly 600 seconds (10 minutes)
- **Password Policy**: Minimum 5 characters (no complexity requirements)

### 2. User Roles & Redirection
- **Admin/Super Admin** → `/admin`
- **Staff** → `/admin/staff`
- **Customers** → `/products`

### 3. Session Management
- Long-lived cookies (90-365 days)
- Silent token refresh every 25 minutes
- Proactive session maintenance

### 4. CSRF Exempt Routes
These routes MUST remain exempt from CSRF protection:
- `login`, `logout`, `register`
- `login-otp-request`, `login-otp-verify`
- `send-verification-otp`, `verify-otp-registration`, `resend-verification`
- `forgot-password-otp`, `verify-reset-otp`

### 5. CSRF Header
The `X-CSRF-Token` header must be automatically included by `baseApi.js` for all non-GET requests if a `csrf_token` cookie exists.

### 6. UPI QR Expiry
- Exactly 300 seconds (5 minutes)
- Must be synchronized between backend `close_by` logic and frontend countdown

### 7. Localization
- **Timezone**: IST (Indian Standard Time) for all database timestamps
- **Color Variants**: Case-insensitive grouping (merge "Black" and "black")
- **Color Display**: Use `display_name` (snake_case) for frontend labels
- **Variant Matching**: Fall back to color-name if hex is missing

### 8. Registration Resume
If a user signs up with an email that is already registered but **unverified** (`is_active=False`):
- Update their account with the new data
- Send a fresh OTP
- Move them to the OTP verification screen
- **Do NOT** show "Registration failed"

## Engineering Standards

### Code Quality
- **DRY, KISS, YAGNI**: Keep it simple and reusable
- **File Limit**: No single source file should exceed 600 lines
- **Scalability**: Must support 5000+ concurrent users on a 16GB VPS
- **Docker First**: Every code change must be synchronized and verified in Docker containers

### File Structure
```
Aarya_Clothing/
├── services/
│   ├── core/          # Authentication service
│   ├── commerce/      # Product catalog service
│   └── payment/       # Payment service
├── frontend_new/      # Customer-facing application
├── database/          # Database schemas and migrations
├── docker/            # Docker configurations
├── docker-compose.yml
└── kilo.json          # Kilo CLI configuration with MCP servers
```

## MCP Servers Available

The following MCP servers are configured for enhanced AI capabilities:

1. **Docker** - Container and image management
2. **Filesystem** - Safe file operations with search/diff/patch
3. **Git** - Version control operations (28+ tools)
4. **Playwright** - Browser automation and testing
5. **Fetch** - HTTP request capabilities

## Development Workflow

### Making Changes
1. Create a feature branch
2. Implement changes in services/
3. Test with Docker containers
4. Verify against GEMINI.md requirements
5. Update tests/
6. Document changes

### Testing
- Run tests in isolated Docker environment
- Use pytest for Python services
- Test authentication flows thoroughly
- Verify OTP timing and expiry
- Check CSRF exemptions

### Database Migrations
- Create migrations for schema changes
- Test rollback procedures
- Ensure data integrity
- Document breaking changes

## Important Notes

- All timestamps must use IST timezone
- Never expose sensitive data in logs
- Validate all user inputs
- Implement proper error handling
- Use prepared statements to prevent SQL injection
- Hash passwords properly (bcrypt/argon2)
- Rate limit authentication endpoints
- Log security-relevant events

## Resources

- [GEMINI.md](GEMINI.md) - Foundational mandates and requirements
- [kilo.json](kilo.json) - Kilo CLI configuration with MCP servers
- [MCP_SETUP.md](MCP_SETUP.md) - MCP server setup and usage guide
