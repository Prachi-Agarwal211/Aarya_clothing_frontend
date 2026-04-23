# Aarya Clothing - Docker Deployment Guide

## Overview

This guide covers deploying the Aarya Clothing application using Docker. The application consists of:

- **Frontend**: Next.js application (port 3000)
- **Backend Services**: 4 microservices (core, commerce, payment, admin)
- **Database**: PostgreSQL with PgBouncer connection pooler
- **Cache**: Redis
- **Search**: Meilisearch
- **Gateway**: Nginx reverse proxy (ports 80/443)

## Quick Start

### Prerequisites

1. **Docker** and **Docker Compose** must be installed
2. Git cloned this repository
3. Linux/macOS (Windows WSL2 works but may need adjustments)

### First-Time Setup

1. **Configure Environment**
   ```bash
   cp .env.example .env
   # Edit .env and set all required variables
   nano .env
   ```

   Required variables:
   - `POSTGRES_PASSWORD` - PostgreSQL password
   - `REDIS_PASSWORD` - Redis password
   - `SECRET_KEY` - JWT secret (min 32 chars)
   - `INTERNAL_SERVICE_SECRET` - Service-to-service auth
   - `MEILI_MASTER_KEY` - Meilisearch admin key

2. **Start All Services**
   ```bash
   docker-compose -p aarya_clothing up -d --build
   ```

3. **Wait for Health Checks** (3-5 minutes)
   ```bash
   docker-compose -p aarya_clothing ps
   ```

4. **Verify Deployment**
   ```bash
   # Check all containers are healthy
   docker-compose -p aarya_clothing ps
   
   # Access the application
   curl http://localhost
   ```

5. **Open in Browser**
   - Frontend: http://localhost
   - Admin: http://localhost/admin

## Using the Deployment Script

A comprehensive deployment script is provided:

```bash
# Make executable (one-time)
chmod +x scripts/deploy-and-verify.sh

# Run full deployment with health verification
./scripts/deploy-and-verify.sh
```

This script:
- ✓ Checks Docker and environment
- ✓ Rebuilds frontend with changes
- ✓ Starts all containers
- ✓ Verifies health of each service
- ✓ Tests API endpoints

## Development Mode

For development with hot-reload:

```bash
# Use the dev compose file alongside main
 trava -f docker-compose.yml -f docker-compose.dev.yml up -d
```

This mode:
- Mounts source code as volumes
- Enables hot-reload for Python (Uvicorn --reload)
- Uses npm run dev for Next.js

Note: Hot-reload may not work perfectly with Next.js in Docker. For best results, develop outside Docker and only use Docker for backend services.

## Service Architecture

### Network Topology

```
┌─────────────────────────────────────────────────────────┐
│                      Internet                            │
└─────────────────────────────────┬───────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────┐
│                    nginx:80/443                          │
│  ┌─────────────────────────────────────────────────────┐│
│  │  /                  → frontend:3000 (Next.js)          ││
│  │  /api/v1/auth/*    → core:5001                       ││
│  │  /api/v1/users/*   → core:5001                       ││
│  │  /api/v1/products/* → commerce:5002                   ││
│  │  /api/v1/cart/*    → commerce:5002                   ││
│  │  /api/v1/orders/*  → commerce:5002                   ││
│  │  /api/v1/payments/*→ payment:5003                    ││
│  │  /api/v1/admin/*   → admin:5004                      ││
│  └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│  frontend   │ │    core     │ │  commerce   │ │   payment   │
│   (Next.js) │ │ (Auth/Users)│ │ (Products)  │ │ (Payments)  │
└─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘
      │               │               │               │
      └───────────────┼───────────────┼───────────────┘
                      │               │
                      ▼               ▼
              ┌─────────────────────────┐
              │        pgbouncer         │
              │     (Connection Pool)    │
              └─────────────┬───────────┘
                        │
                        ▼
              ┌─────────────────────────┐
              │        PostgreSQL         │
              │   (Primary Database)     │
              └─────────────────────────┘
```

### Port Mapping

| Service | Internal Port | External Port | Health Check |
|---------|--------------|---------------|--------------|
| nginx | 80/443 | 80/443 | N/A |
| frontend | 3000 | - | /_next/data/build-id |
| core | 5001 | - | /health |
| commerce | 5002 | - | /health |
| payment | 5003 | - | /health |
| admin | 5004 | - | /health |
| postgres | 5432 | - | pg_isready |
| pgbouncer | 6432 | - | pg_isready |
| redis | 6379 | - | ping |
| meilisearch | 7700 | - | /health |

## Common Commands

### Build and Start
```bash
# Full rebuild (use for production)
docker-compose -p aarya_clothing up -d --build

# Start without rebuild (use after code changes)
docker-compose -p aarya_clothing up -d

# Stop all services
docker-compose -p aarya_clothing down

# Stop and remove volumes (WARNING: deletes all data)
docker-compose -p aarya_clothing down -v
```

### Logs and Debugging
```bash
# View all logs
docker-compose -p aarya_clothing logs -f

# View specific service logs
docker-compose -p aarya_clothing logs -f frontend

# Check service status
docker-compose -p aarya_clothing ps

# View resource usage
docker stats aarya_clothing_frontend
```

### Database Management
```bash
# Access PostgreSQL
PSQL_PASSWORD=$(grep POSTGRES_PASSWORD .env | cut -d= -f2) \
  docker exec -it aarya_postgres psql -U postgres aarya_clothing

# Run database migrations
# Note: Migrations are handled by services on startup
```

## Health Checks

All services have health checks configured with appropriate timeouts:

- **Database services**: 30-45s start period (PostgreSQL, Redis, Meilisearch)
- **API services**: 30s start period, 10s timeout (core, commerce, payment, admin)
- **Frontend**: 45s start period (Next.js needs time to build)

### Manual Health Check
```bash
# Check PostgreSQL
curl -f http://localhost:5432/health  # Won't work, use docker

# Check API services (via nginx)
curl -f http://localhost/api/v1/health

# Check frontend
curl -f http://localhost/_next/data/build-id
```

## Container Resource Limits

| Service | Memory | CPU |
|---------|--------|-----|
| postgres | 4GB | 1.5 |
| pgbouncer | 128MB | 0.25 |
| redis | 1GB | 0.75 |
| meilisearch | 256MB | 0.5 |
| core | 1.5GB | 0.75 |
| commerce | 2GB | 0.75 |
| payment | 1GB | 0.75 |
| admin | 1.5GB | 0.75 |
| frontend | 2GB | 2.0 |
| nginx | 128MB | 0.25 |

## Troubleshooting

### Containers Won't Start

**Symptom**: Containers crash immediately

**Solution**:
```bash
# Check logs for errors
docker-compose -p aarya_clothing logs --tail=100

# Check specific container
docker logs aarya_clothing_frontend

# Common issues:
# 1. Missing environment variables in .env
# 2. Port conflicts (check `docker ps`)
# 3. Insufficient memory (increase Docker limits)
```

### Database Connection Issues

**Symptom**: API services fail with database connection errors

**Solution**:
```bash
# Check if PostgreSQL is healthy
docker inspect aarya_clothing_postgres --format='{{.State.Health.Status}}'

# Check pgbouncer
docker inspect aarya_clothing_pgbouncer --format='{{.State.Health.Status}}'

# Common issues:
# 1. PgBouncer not waiting for PostgreSQL
# 2. Wrong password in .env
# 3. Database migrations not run
```

### Services Depend on Each Other

The services have proper dependency ordering:

1. **postgres** → starts first
2. **redis**, **meilisearch** → start in parallel
3. **pgbouncer** → waits for postgres
4. **core**, **commerce**, **payment**, **admin** → wait for postgres, redis, pgbouncer
5. **frontend** → waits for core, commerce
6. **nginx** → waits for all services to be healthy

### Building Frontend Without Cache

To ensure a clean build:
```bash
docker-compose -p aarya_clothing build --no-cache frontend
```

## Production Considerations

### SSL/TLS

The nginx configuration supports both:
- Let's Encrypt (production)
- Self-signed certificates (development)

Mount your certificates to: `docker/nginx/ssl/`

### Scaling

For production scaling, consider:

```yaml
# In docker-compose.yml, add deploy.replicas
default:
  deploy:
    replicas: 2
```

Use Docker Swarm or Kubernetes for proper orchestration.

### Backups

```bash
# Backup PostgreSQL
./scripts/backup-db.sh

# Backup Redis
# (Add custom script for Redis backups)
```

### Monitoring

The compose file includes optional monitoring services (commented out by default):
- Prometheus
- Grafana
- Portainer

Enable them by uncommenting in `docker-compose.monitoring.yml`

## Recent Fixes (2024)

### Frontend Issues Fixed

1. **Mobile Scroll Problem**
   - **Issue**: Users couldn't vertically scroll over product images on mobile
   - **Root Cause**: `swipe-x` class applied `touch-action: pan-x` which blocked vertical scrolling
   - **Fix**: Removed `swipe-x` class from product image container in `frontend_new/app/products/[id]/page.js`
   - **Result**: Vertical scrolling now works while horizontal swipe still functions via touch handlers

2. **First Product Large Scale Problem**
   - **Issue**: First product opened at wrong scale
   - **Root Cause**: Canonical redirect (numeric ID → slug) happened after initial render, causing layout shift
   - **Fix**: Moved redirect logic before `setProduct()` and added early return in `frontend_new/app/products/[id]/page.js`
   - **Result**: Redirect happens before rendering, eliminating layout flash

### Docker Improvements

1. **Frontend Health Check**
   - Added health check to frontend service: `curl -f http://localhost:3000/_next/data/build-id`
   - Start period: 45s (Next.js needs time to build)
   - Interval: 15s, Timeout: 10s, Retries: 3

2. **Dependency Management**
   - Changed `depends_on` to use `condition: service_healthy` for critical services
   - nginx now waits for all services to be healthy before starting
   - Frontend waits for core and commerce to be healthy

3. **Deployment Script**
   - Created `scripts/deploy-and-verify.sh` for automated deployment verification
   - Validates Docker, environment, health checks, and endpoints

## Version History

- **v1.0**: Initial Docker setup
- **v1.1**: Added health checks to all services
- **v1.2**: Improved frontend build caching
- **v1.3**: Fixed mobile scrolling and first product load issues
- **v1.4**: Added comprehensive deployment script

## Support

For issues:
1. Check logs: `docker-compose -p aarya_clothing logs -f`
2. Verify health: `docker-compose -p aarya_clothing ps`
3. Review this guide for troubleshooting

## License

Private - Aarya Clothing
