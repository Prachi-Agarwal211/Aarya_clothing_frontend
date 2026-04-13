# Monitoring Stack Setup Guide — Aarya Clothing

Complete Prometheus + Grafana monitoring for the Aarya Clothing e-commerce platform.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │           Grafana (UI)               │
                    │  http://aaryaclothing.in/grafana     │
                    │  admin:3000 (behind nginx proxy)     │
                    └──────────────┬──────────────────────┘
                                   │ reads
                    ┌──────────────▼──────────────────────┐
                    │         Prometheus (TSDB)            │
                    │  prometheus:9090                     │
                    │  Scrapes every 15s, retains 15 days  │
                    └──┬──┬──┬──┬──┬──┬──┬────────────────┘
                       │  │  │  │  │  │  │
              ┌────────┘  │  │  │  │  │  └──────┐
              │     ┌─────┘  │  │  │  └──────┐  │
              │     │  ┌─────┘  │  └──────┐  │  │
              ▼     ▼  ▼        ▼         ▼  ▼  ▼
            core  commerce payment admin  nginx pg  redis
            :5001  :5002    :5003   :5004  :80  :5432 :6379
            /metrics  /metrics /metrics /metrics  │   │
                                                 │   │
              ┌──────────────────────────────────┘   │
              │                                      │
         node-exporter:9100              postgres-exporter:9187
         (host metrics)                 (DB metrics)
              │                           │
         cadvisor:8080               redis-exporter:9121
         (container metrics)          (cache metrics)
```

## Resource Budget

| Service | Memory | CPU | Purpose |
|---------|--------|-----|---------|
| Prometheus | 512MB | 0.5 | Metrics collection & storage |
| Grafana | 256MB | 0.5 | Dashboard visualization |
| node-exporter | 128MB | 0.25 | VPS hardware metrics |
| postgres-exporter | 128MB | 0.25 | PostgreSQL metrics |
| redis-exporter | 128MB | 0.25 | Redis metrics |
| cAdvisor | 256MB | 0.5 | Container resource metrics |
| **TOTAL** | **~1.4GB** | **2.0** | Well within 16GB VPS budget |

---

## Quick Start

### 1. Prerequisites

Ensure your `.env` file has these variables (they should already exist):
```bash
POSTGRES_PASSWORD=your_secure_password
REDIS_PASSWORD=your_redis_password
GRAFANA_ADMIN_PASSWORD=CHANGE_ME_TO_SECURE_PASSWORD
```

> **IMPORTANT:** Change the default Grafana password (`aarya_grafana_2024`) before deploying to production!

### 2. Install Dependencies (FastAPI Services)

The `prometheus_client==0.19.0` package has been added to all 4 services:
- `services/core/requirements.txt`
- `services/commerce/requirements.txt`
- `services/payment/requirements.txt`
- `services/admin/requirements.txt`

Rebuild the services to install the package:
```bash
docker compose build core commerce payment admin
```

### 3. Start the Monitoring Stack

All monitoring services are already defined in `docker-compose.yml`. Just rebuild and restart:
```bash
# Rebuild services with new prometheus_client dependency
docker compose build core commerce payment admin

# Restart the full stack (monitoring services included)
docker compose up -d

# Or restart only monitoring services
docker compose up -d prometheus grafana node-exporter postgres-exporter redis-exporter cadvisor
```

### 4. Verify Everything is Running

```bash
# Check all monitoring containers
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml ps

# Verify Prometheus is scraping targets
curl http://localhost:9090/api/v1/targets | python3 -m json.tool

# Verify Grafana is accessible
curl http://localhost:3000/api/health
```

---

## Accessing Grafana

### Via Nginx (Recommended - HTTPS)
```
URL: https://aaryaclothing.in/monitoring/
Username: admin
Password: (your GRAFANA_ADMIN_PASSWORD, default: aarya_grafana_2024)
```

### Direct (HTTP - for local/debugging)
```
URL: http://<VPS_IP>:3000
Username: admin
Password: (your GRAFANA_ADMIN_PASSWORD)
```

> **Security Note:** Grafana is accessible through nginx at `/monitoring/` with Grafana's own login.
> The `/nginx_status` endpoint is restricted to internal Docker networks only.

---

## Dashboards

All 6 dashboards are auto-loaded via Grafana provisioning:

### 1. System Overview (`system-overview.json`)
**What it shows:** VPS-level hardware metrics
- CPU usage per core and overall
- Memory usage breakdown (used, available, cached, buffers)
- Disk usage and I/O rates
- Network RX/TX rates
- Load average
- Filesystem utilization table

**When to use:** "Is the server itself under pressure?"

### 2. Services Overview (`services-overview.json`)
**What it shows:** All 4 FastAPI microservices health
- Service UP/DOWN status indicators
- Total requests per minute and error rates
- p50/p95/p99 latency per service (using recording rules)
- HTTP status code distribution
- Top 10 endpoints by traffic
- Business metrics (orders, active requests, errors)

**When to use:** "Which service is slow or broken?"

### 3. Database Overview (`database-overview.json`)
**What it shows:** PostgreSQL database internals
- Active connections vs max connections
- Cache hit ratio (should be >95%)
- Database size
- Transactions/sec (commits vs rollbacks)
- Dead tuple count (bloat indicator)
- Connections by state (idle, active, etc.)
- Tuple operations (inserts, updates, deletes)
- Block I/O (cache hits vs disk reads)
- Lock types and counts
- Temp file creation (query spillover to disk)

**When to use:** "Is the database the bottleneck?"

### 4. Redis Overview (`redis-overview.json`)
**What it shows:** Redis cache performance
- Memory used vs max memory (with gauge)
- Connected clients and blocked clients
- Total keys across all databases
- Commands/sec rate
- Cache hit/miss rates
- Key expiration and eviction rates
- RDB save status and AOF status
- Redis uptime

**When to use:** "Is the cache working efficiently?"

### 5. Containers Overview (`containers-overview.json`)
**What it shows:** Per-Docker-container resource usage
- CPU usage % and cores per container
- Memory working set per container
- Memory usage % of container limits
- Network RX/TX per container
- Summary table of all containers

**When to use:** "Which container is consuming the most resources?"

### 6. Business Metrics (`business-metrics.json`)
**What it shows:** E-commerce KPIs and their technical correlates
- Total orders and orders/hour
- Order value percentiles (p50, p95)
- Request rate by service
- Error impact by type
- Database and cache health at a glance

**When to use:** "How is the business performing technically?"

---

## Alert Rules

Alerts are defined in `docker/prometheus/rules/alerts.yml` and are automatically loaded by Prometheus.

### Alert Categories

| Category | Alerts | Severity |
|----------|--------|----------|
| Service Health | ServiceDown, HighErrorRate, CriticalErrorRate, HighLatency, CriticalLatency | critical/warning |
| Database | PostgresConnectionsHigh, PostgresLongRunningQuery, PostgresDeadTuplesHigh, PostgresCacheHitRatioLow | warning |
| Redis | RedisMemoryHigh, RedisMemoryCritical, RedisClientsHigh, RedisEvictions | warning/critical |
| Host | DiskSpaceWarning/Critical, HostMemoryWarning/Critical, HostCPUWarning/Critical, HostLoadAverageHigh | warning/critical |
| Container | ContainerMemoryHigh | warning |
| Exporters | NodeExporterDown, CadvisorDown, PostgresExporterDown, RedisExporterDown | warning |

### Recording Rules (for dashboard performance)

These pre-computed queries make dashboards faster:
- `job:http_requests_total:rate5m` — request rate per service
- `job:http_errors_total:rate5m` — error rate per service
- `job:http_error_ratio:rate5m` — error ratio
- `job:http_request_duration_seconds:p50/p95/p99` — latency percentiles
- `instance:container_cpu_usage:percent` — container CPU %
- `instance:container_memory_usage:bytes` — container memory

### Setting Up Alert Notifications

To add Slack/email notifications, uncomment the Alertmanager section in `prometheus.yml` and deploy Alertmanager:

```yaml
alerting:
  alertmanagers:
    - static_configs:
        - targets: ['alertmanager:9093']
```

---

## Prometheus Configuration

### Scrape Targets

| Job | Target | Metrics Path |
|-----|--------|-------------|
| prometheus | localhost:9090 | /metrics |
| core | core:5001 | /metrics |
| commerce | commerce:5002 | /metrics |
| payment | payment:5003 | /metrics |
| admin | admin:5004 | /metrics |
| grafana | grafana:3000 | /metrics |
| node | node-exporter:9100 | /metrics |
| postgres | postgres-exporter:9187 | /metrics |
| redis | redis-exporter:9121 | /metrics |
| cadvisor | cadvisor:8080 | /metrics |
| nginx | nginx:80 | /nginx_status |
| meilisearch | meilisearch:7700 | /health |

### Reloading Prometheus Config

After editing `prometheus.yml` or alert rules:
```bash
curl -X POST http://localhost:9090/-/reload
```

Or restart the container:
```bash
docker restart aarya_prometheus
```

---

## Nginx Integration

### Grafana Access
```
https://aaryaclothing.in/grafana → Grafana UI
```

### Nginx Status (Internal Only)
```
/nginx_status → stub_status (restricted to Docker networks)
```

The `/nginx_status` endpoint is only accessible from:
- `172.16.0.0/12` (Docker internal)
- `10.0.0.0/8` (Docker internal)
- `127.0.0.1` (localhost)

External access is denied.

---

## Monitoring Middleware

Each FastAPI service uses `shared/monitoring_middleware.py` which provides:

### HTTP Metrics
- `http_requests_total{method, endpoint, status, service}` — request counter
- `http_request_duration_seconds{method, endpoint, service}` — latency histogram
- `http_requests_in_progress{method, service}` — active requests gauge

### Business Metrics
- `orders_total{status, service}` — order counter
- `order_value_rupees{service}` — order value histogram

### Error Tracking
- `errors_total{error_type, endpoint, service}` — error counter

### Service Info
- `service_info{service, version}` — service metadata

### Using the Middleware

In each service's `main.py`:
```python
from shared.monitoring_middleware import setup_monitoring

app = FastAPI()
query_tracker, cache_metrics, business_metrics = setup_monitoring(
    app,
    service_name="core",  # or "commerce", "payment", "admin"
)

# Track business events in your code:
business_metrics.track_order(status="completed", value=1999.0)
cache_metrics.track_hit("redis")
```

---

## Troubleshooting

### Grafana Not Loading
```bash
# Check Grafana logs
docker logs aarya_grafana

# Check if Grafana is healthy
docker compose -f docker-compose.monitoring.yml ps grafana

# Verify Grafana can reach Prometheus
docker exec aarya_grafana wget -qO- http://prometheus:9090/api/v1/status/config
```

### No Metrics Showing in Dashboards
1. **Check Prometheus targets:**
   ```bash
   curl http://localhost:9090/api/v1/targets | python3 -m json.tool | grep -A2 '"health"'
   ```
   All targets should show `"health": "up"`.

2. **Check if services expose /metrics:**
   ```bash
   curl http://localhost:5001/metrics  # core
   curl http://localhost:5002/metrics  # commerce
   curl http://localhost:5003/metrics  # payment
   curl http://localhost:5004/metrics  # admin
   ```

3. **Verify prometheus_client is installed:**
   ```bash
   docker exec aarya_core pip list | grep prometheus
   ```

4. **Rebuild services if needed:**
   ```bash
   docker compose build core commerce payment admin
   docker compose up -d
   ```

### Prometheus Running Out of Disk
```bash
# Check Prometheus disk usage
docker exec aarya_prometheus du -sh /prometheus

# Reduce retention period (edit docker-compose.monitoring.yml):
# --storage.tsdb.retention.time=7d
# --storage.tsdb.retention.size=1GB

# Then restart
docker restart aarya_prometheus
```

### High Memory Usage
```bash
# Check container memory usage
docker stats --no-stream

# cAdvisor shows per-container breakdown
# Check the Containers Overview dashboard in Grafana
```

### Exporter Can't Connect to Database
```bash
# Check postgres-exporter logs
docker logs aarya_postgres_exporter

# Verify POSTGRES_PASSWORD in .env matches
# Test connection manually
docker exec aarya_postgres_exporter sh -c \
  'PGPASSWORD=$POSTGRES_PASSWORD psql -h postgres -U postgres -d aarya_clothing -c "SELECT 1"'
```

### Redis Exporter Authentication Failed
```bash
# Check redis-exporter logs
docker logs aarya_redis_exporter

# Verify REDIS_PASSWORD in .env matches
```

### Nginx /grafana Returns 502
```bash
# Check if Grafana is on frontend_network
docker inspect aarya_grafana | grep -A5 Networks

# Check nginx error logs
docker logs aarya_nginx 2>&1 | tail -50

# Restart nginx if needed
docker restart aarya_nginx
```

---

## Stopping the Monitoring Stack

```bash
# Stop specific monitoring services
docker compose stop prometheus grafana node-exporter postgres-exporter redis-exporter cadvisor

# Stop everything
docker compose down

# Stop and remove monitoring data (WARNING: deletes all metrics history)
docker compose down -v prometheus_data grafana_data
```

---

## Future Enhancements

1. **Alertmanager** — Deploy for Slack/Email/PagerDuty notifications
2. **Log Aggregation** — Add Loki + Promtail for log-based alerting
3. **Tracing** — Add Jaeger for distributed request tracing
4. **Synthetic Monitoring** — Add Blackbox exporter for uptime checks
5. **Custom Business Dashboards** — Add more order funnel metrics
6. **Auto-scaling Alerts** — Integrate with Docker Swarm/K8s HPA

---

## File Structure

```
Aarya_clothing_frontend/
├── docker-compose.yml                          # Main services
├── docker-compose.monitoring.yml               # Monitoring stack (NEW)
├── .env.monitoring.example                     # Monitoring env template (NEW)
├── MONITORING_SETUP.md                         # This file (NEW)
├── services/
│   ├── core/requirements.txt                   # + prometheus_client (NEW)
│   ├── commerce/requirements.txt               # + prometheus_client (NEW)
│   ├── payment/requirements.txt                # + prometheus_client (NEW)
│   └── admin/requirements.txt                  # + prometheus_client (NEW)
├── shared/monitoring_middleware.py              # Already existed
├── docker/
│   ├── prometheus/
│   │   ├── prometheus.yml                      # Updated with all targets
│   │   └── rules/
│   │       └── alerts.yml                      # Comprehensive alerts + recording rules
│   ├── grafana/
│   │   ├── dashboards/
│   │   │   ├── system-overview.json            # VPS hardware metrics
│   │   │   ├── services-overview.json          # Microservice health
│   │   │   ├── database-overview.json          # PostgreSQL metrics
│   │   │   ├── redis-overview.json             # Redis cache metrics
│   │   │   ├── containers-overview.json        # Docker container metrics
│   │   │   └── business-metrics.json           # E-commerce KPIs
│   │   └── provisioning/
│   │       ├── datasources/prometheus.yml      # Auto-configured datasource
│   │       └── dashboards/dashboards.yml       # Auto-loaded dashboards
│   └── nginx/
│       └── nginx.conf                          # + /grafana + /nginx_status
```
