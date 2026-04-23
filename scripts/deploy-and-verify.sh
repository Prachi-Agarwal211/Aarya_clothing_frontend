#!/bin/bash
# Aarya Clothing - Docker Deployment & Health Verification Script
# This script handles production deployment with health checks

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
COMPOSE_FILE="docker-compose.yml"
PROJECT_NAME="aarya_clothing"
MAX_RETRIES=3
RETRY_DELAY=10

# Services to verify (in order of dependency)
SERVICES=("postgres" "redis" "meilisearch" "pgbouncer" "core" "commerce" "payment" "admin" "frontend" "nginx")

echo -e "${BLUE}==========================================${NC}"
echo -e "${BLUE}  Aarya Clothing Docker Deployment${NC}"
echo -e "${BLUE}==========================================${NC}"
echo ""

# Function to check if Docker is running
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}ERROR: Docker is not installed. Please install Docker first.${NC}"
        exit 1
    fi
    
    if ! docker info &> /dev/null; then
        echo -e "${RED}ERROR: Docker daemon is not running. Please start Docker.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✓ Docker is running${NC}"
}

# Function to check if .env file exists
check_env() {
    if [ ! -f ".env" ]; then
        echo -e "${RED}ERROR: .env file not found. Please copy .env.example to .env and configure.${NC}"
        exit 1
    fi
    
    # Check for required env vars
    REQUIRED_VARS=("POSTGRES_PASSWORD" "REDIS_PASSWORD" "SECRET_KEY" "INTERNAL_SERVICE_SECRET" "MEILI_MASTER_KEY")
    for var in "${REQUIRED_VARS[@]}"; do
        if ! grep -q "^$var=" .env; then
            echo -e "${RED}ERROR: Required environment variable $var not set in .env${NC}"
            exit 1
        fi
    done
    
    echo -e "${GREEN}✓ Environment configuration is valid${NC}"
}

# Function to rebuild with cache
rebuild_containers() {
    echo -e "${YELLOW}Rebuilding frontend container with changes...${NC}"
    docker-compose -p ${PROJECT_NAME} build --no-cache frontend
    echo -e "${GREEN}✓ Frontend container rebuilt${NC}"
}

# Function to start containers
start_containers() {
    echo -e "${YELLOW}Starting all containers...${NC}"
    docker-compose -p ${PROJECT_NAME} up -d
    echo -e "${GREEN}✓ Containers started${NC}"
}

# Function to check container health
check_service_health() {
    local service_name=$1
    local retry_count=0
    
    echo -n "  Waiting for ${service_name} to be healthy..."
    
    while [ $retry_count -lt $MAX_RETRIES ]; do
        local status=$(docker inspect --format='{{.State.Health.Status}}' ${PROJECT_NAME}_${service_name} 2>/dev/null || echo "unhealthy")
        
        if [ "$status" = "healthy" ]; then
            echo -e "${GREEN} ✓${NC}"
            return 0
        fi
        
        echo -n "."
        sleep $RETRY_DELAY
        retry_count=$((retry_count + 1))
    done
    
    echo -e "\n${RED}✗ ${service_name} failed to become healthy after ${MAX_RETRIES} attempts${NC}"
    docker logs ${PROJECT_NAME}_${service_name} --tail 50
    return 1
}

# Function to verify all services
verify_services() {
    echo ""
    echo -e "${BLUE}==========================================${NC}"
    echo -e "${BLUE}  Verifying Container Health${NC}"
    echo -e "${BLUE}==========================================${NC}"
    
    for service in "${SERVICES[@]}"; do
        if [ "$service" = "frontend" ]; then
            # Frontend doesn't have a service_healthy check initially in older compose
            # Check if container is running
            echo -n "  Checking ${service}..."
            if docker inspect --format='{{.State.Running}}' ${PROJECT_NAME}_${service} 2>/dev/null | grep -q "true"; then
                echo -e "${GREEN} ✓${NC}"
            else
                echo -e "${RED} ✗ ${service} is not running${NC}"
                return 1
            fi
        elif [ "$service" = "nginx" ]; then
            # Nginx doesn't have healthcheck but we can check if it's running
            echo -n "  Checking ${service}..."
            if docker inspect --format='{{.State.Running}}' ${PROJECT_NAME}_${service} 2>/dev/null | grep -q "true"; then
                echo -e "${GREEN} ✓${NC}"
            else
                echo -e "${RED} ✗ ${service} is not running${NC}"
                return 1
            fi
        else
            check_service_health $service || return 1
        fi
    done
    
    echo ""
    echo -e "${GREEN}✓ All services are healthy and running${NC}"
}

# Function to display service status
display_status() {
    echo ""
    echo -e "${BLUE}==========================================${NC}"
    echo -e "${BLUE}  Service Status${NC}"
    echo -e "${BLUE}==========================================${NC}"
    
    docker-compose -p ${PROJECT_NAME} ps
    
    echo ""
    echo -e "${BLUE}==========================================${NC}"
    echo -e "${BLUE}  Container Health Details${NC}"
    echo -e "${BLUE}==========================================${NC}"
    
    for service in "${SERVICES[@]}"; do
        local container_name=${PROJECT_NAME}_${service}
        if docker inspect $container_name &> /dev/null; then
            local status=$(docker inspect --format='{{.State.Status}}' $container_name)
            local health=$(docker inspect --format='{{.State.Health.Status}}' $container_name 2>/dev/null || echo "N/A")
            local ip=$(docker inspect --format='{{.NetworkSettings.IPAddress}}' $container_name)
            
            if [ "$health" = "healthy" ]; then
                printf "  ${GREEN}%-20s${NC} Status: %-12s Health: %-10s IP: %s\n" "$service" "$status" "$health" "$ip"
            elif [ "$status" = "running" ]; then
                printf "  ${GREEN}%-20s${NC} Status: %-12s Health: %-10s IP: %s\n" "$service" "$status" "$health" "$ip"
            else
                printf "  ${RED}%-20s${NC} Status: %-12s Health: %-10s IP: %s\n" "$service" "$status" "$health" "$ip"
            fi
        else
            printf "  ${RED}%-20s${NC} Status: Not Found\n" "$service"
        fi
    done
}

# Function to test API endpoints
test_endpoints() {
    echo ""
    echo -e "${BLUE}==========================================${NC}"
    echo -e "${BLUE}  Testing API Endpoints${NC}"
    echo -e "${BLUE}==========================================${NC}"
    
    # Wait for nginx to be ready
    sleep 5
    
    local endpoints=(
        "http://localhost/api/v1/health"
        "http://localhost/products"
        "http://localhost"
    )
    
    for endpoint in "${endpoints[@]}"; do
        echo -n "  Testing ${endpoint}..."
        if curl -s -f -o /dev/null --max-time 10 "$endpoint"; then
            echo -e "${GREEN} ✓${NC}"
        else
            echo -e "${RED} ✗${NC}"
            echo "    Response: $(curl -s --max-time 5 "$endpoint" | head -c 100)"
        fi
    done
}

# Main deployment flow
main() {
    # Step 1: Check prerequisites
    echo -e "${BLUE}[Step 1/5] Checking prerequisites...${NC}"
    check_docker
    check_env
    
    # Step 2: Rebuild with changes
    echo ""
    echo -e "${BLUE}[Step 2/5] Rebuilding containers with changes...${NC}"
    rebuild_containers
    
    # Step 3: Start containers
    echo ""
    echo -e "${BLUE}[Step 3/5] Starting containers...${NC}"
    start_containers
    
    # Step 4: Verify health
    echo ""
    echo -e "${BLUE}[Step 4/5] Verifying container health...${NC}"
    if ! verify_services; then
        echo ""
        echo -e "${RED}ERROR: Some services failed to start properly${NC}"
        echo ""
        display_status
        exit 1
    fi
    
    # Step 5: Test endpoints
    echo ""
    echo -e "${BLUE}[Step 5/5] Testing API endpoints...${NC}"
    test_endpoints
    
    # Final summary
    echo ""
    echo -e "${GREEN}==========================================${NC}"
    echo -e "${GREEN}  ✓ Deployment Successful!${NC}"
    echo -e "${GREEN}==========================================${NC}"
    echo ""
    echo -e "Frontend should now be accessible at: ${BLUE}http://localhost${NC}"
    echo -e "Admin dashboard at: ${BLUE}http://localhost/admin${NC}"
    echo ""
    
    display_status
}

# Run main
main
