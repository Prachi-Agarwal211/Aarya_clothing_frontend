# CLAUDE.md - AI System Context for Aarya Clothing VPS

## WHO I AM
You are an expert full-stack AI coding assistant running on a production VPS (srv1324470, Ubuntu 24.04 LTS).
Model: GLM-5.1-FP8 via Modal API. You have 200K context window. Use it fully.

## THIS PROJECT: AARYA CLOTHING
- **Type**: E-commerce platform (clothing brand)
- **Codebase**: `/opt/Aarya_clothing_frontend/` - LARGE monorepo
- **Server IP**: 72.61.255.8
- **Stack**: Next.js frontend, microservices backend

## RUNNING DOCKER SERVICES (NEVER TOUCH WITHOUT CHECKING)
Always run `docker ps` before any infra changes.
| Service | Port | Purpose |
|---|---|---|
| aarya_frontend | 3000 | Next.js frontend |
| aarya_commerce | 5002 | Commerce API |
| aarya_payment | 5003 | Payment service |
| aarya_admin | 5004 | Admin panel |
| aarya_core | 5001 | Core API |
| aarya_redis | 6379 | Cache |
| aarya_pgbouncer | 5432,6432 | DB connection pool |
| aarya_postgres | 5432 | PostgreSQL DB |
| aarya_grafana | 3000 | Monitoring |
| aarya_meilisearch | 7700 | Search engine |
| aarya_prometheus | 9090 | Metrics |
| aarya_nginx | 80,443 | Reverse proxy (LIVE) |
| aarya_dozzle | 8080 | Log viewer |
| aarya_portainer | 9000,9443 | Docker UI |
| pg_backup | - | DB backups |
| aarya_payment_worker | 5003 | Payment worker |

## SAFETY RULES (CRITICAL)
1. NEVER `docker stop`, `docker rm`, or `docker-compose down` without explicit user confirmation
2. ALWAYS check `git status` and `git diff` before committing anything
3. NEVER modify database directly - use migrations
4. ALWAYS backup before destructive operations: `cp -r /opt/Aarya_clothing_frontend /opt/backups/$(date +%Y%m%d_%H%M%S)/`
5. NEVER delete files without confirmation
6. When editing nginx config, always `nginx -t` first
7. For DB changes, always check pgbouncer is routing correctly

## MEMORY & KNOWLEDGE GRAPH SKILLS
- Use `memory` MCP to store: architecture decisions, bug patterns, API endpoints, env vars (non-secret), deployment notes
- Always save important findings: `remember [entity] [relation] [value]`
- Check memory before asking user for context

## CODING SKILLS & PATTERNS
### For this codebase:
- Next.js 14+ App Router patterns
- TypeScript strict mode
- Tailwind CSS for styling
- PostgreSQL with proper migrations
- Redis for caching patterns
- Docker multi-stage builds
- Microservices communication patterns

### Debug workflow:
1. Check logs: `docker logs [container] --tail 100`
2. Check health: `docker ps` (look for unhealthy)
3. Check resources: `df -h && free -h && top -bn1`
4. Sequential thinking for complex bugs
5. Use fetch MCP to check docs when needed

### Git workflow:
```bash
git status          # always first
git diff            # see changes
git add -p          # interactive add (never git add .)
git commit -m "feat/fix/refactor: description"
git push origin main --dry-run  # check before push
```

## MCP TOOLS AVAILABLE
- **memory**: Knowledge graph - store/recall project facts across sessions
- **filesystem**: Full access to /root, /opt/Aarya_clothing_frontend, /opt, /tmp
- **sequential-thinking**: Step-by-step reasoning for complex problems
- **fetch**: Read web pages, docs, API references
- **sqlite**: Structured data storage at /root/claude-memory.db
- **postgres**: Direct DB queries at postgresql://localhost:5432/aarya_clothing
- **playwright**: Browser automation for E2E testing
- **github**: GitHub integration (set GITHUB_PERSONAL_ACCESS_TOKEN)

## PERFORMANCE & OPTIMIZATION REMINDERS
- VPS has 192GB disk, 34% memory usage
- PostgreSQL + Redis already optimized
- Grafana + Prometheus for metrics (check before performance work)
- MeiliSearch for full-text search (already integrated)

## FIRST ACTIONS IN EVERY SESSION
1. Check memory MCP for stored context
2. Run `docker ps` to verify services
3. Check git log for recent changes: `cd /opt/Aarya_clothing_frontend && git log --oneline -10`
4. Ask user what they want to work on
