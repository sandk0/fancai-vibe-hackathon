#!/bin/bash

# ==============================================
# BookReader AI - Production Deployment Script
# ==============================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="bookreader-ai"
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.prod"
BACKUP_DIR="./backups"
LOG_FILE="./logs/deploy.log"

# Functions
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    echo "[ERROR] $1" >> "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
    echo "[WARNING] $1" >> "$LOG_FILE"
}

info() {
    echo -e "${BLUE}[INFO] $1${NC}"
    echo "[INFO] $1" >> "$LOG_FILE"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   error "This script should not be run as root for security reasons"
   exit 1
fi

# Check if Docker and Docker Compose are installed
if ! command -v docker &> /dev/null; then
    error "Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Create necessary directories
log "Creating necessary directories..."
mkdir -p logs backups uploads monitoring/grafana/dashboards nginx/ssl

# Check if environment file exists
if [[ ! -f "$ENV_FILE" ]]; then
    error "Environment file $ENV_FILE not found!"
    info "Please copy .env.prod.example to $ENV_FILE and configure it:"
    info "cp .env.prod.example $ENV_FILE"
    info "nano $ENV_FILE"
    exit 1
fi

# Load environment variables
source "$ENV_FILE"

# Validate required environment variables
required_vars=(
    "DATABASE_PASSWORD"
    "REDIS_PASSWORD"
    "SECRET_KEY"
    "JWT_SECRET_KEY"
)

for var in "${required_vars[@]}"; do
    if [[ -z "${!var}" ]]; then
        error "Required environment variable $var is not set in $ENV_FILE"
        exit 1
    fi
done

log "Starting deployment for $PROJECT_NAME..."

# Backup database if it exists
if docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
    log "Creating database backup..."
    if ! docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump -U "$DATABASE_USER" "$DATABASE_NAME" > "$BACKUP_DIR/backup-$(date +%Y%m%d-%H%M%S).sql"; then
        warning "Database backup failed, but continuing with deployment"
    else
        log "Database backup created successfully"
    fi
fi

# Pull latest images
log "Pulling latest images..."
docker-compose -f "$COMPOSE_FILE" pull

# Build custom images
log "Building application images..."
docker-compose -f "$COMPOSE_FILE" build --no-cache

# Stop existing containers
log "Stopping existing containers..."
docker-compose -f "$COMPOSE_FILE" down --remove-orphans

# Start services in proper order
log "Starting database and Redis..."
docker-compose -f "$COMPOSE_FILE" up -d postgres redis

# Wait for database to be ready
log "Waiting for database to be ready..."
timeout=60
while ! docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$DATABASE_USER" > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout-2))
    if [[ $timeout -le 0 ]]; then
        error "Database failed to start within 60 seconds"
        exit 1
    fi
done

# Run database migrations
log "Running database migrations..."
if ! docker-compose -f "$COMPOSE_FILE" run --rm backend alembic upgrade head; then
    error "Database migrations failed"
    exit 1
fi

# Start backend services
log "Starting backend services..."
docker-compose -f "$COMPOSE_FILE" up -d backend celery-worker celery-beat

# Wait for backend to be ready
log "Waiting for backend to be ready..."
timeout=60
while ! curl -f http://localhost:8000/health > /dev/null 2>&1; do
    sleep 2
    timeout=$((timeout-2))
    if [[ $timeout -le 0 ]]; then
        error "Backend failed to start within 60 seconds"
        exit 1
    fi
done

# Start frontend and nginx
log "Starting frontend and nginx..."
docker-compose -f "$COMPOSE_FILE" up -d frontend nginx

# Verify all services are running
log "Verifying services..."
sleep 10

services=(
    "postgres"
    "redis"
    "backend"
    "celery-worker"
    "celery-beat"
    "frontend"
    "nginx"
)

all_healthy=true
for service in "${services[@]}"; do
    if ! docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
        error "Service $service is not running"
        all_healthy=false
    else
        info "✓ Service $service is running"
    fi
done

if [[ "$all_healthy" != true ]]; then
    error "Some services failed to start. Check logs with: docker-compose -f $COMPOSE_FILE logs"
    exit 1
fi

# Final health check
log "Performing final health check..."
if curl -f http://localhost/health > /dev/null 2>&1; then
    log "✓ Application is accessible at http://localhost"
else
    warning "Application health check failed. It might still be starting up."
fi

# Clean up old images
log "Cleaning up old Docker images..."
docker image prune -f

# Display deployment summary
log "=== DEPLOYMENT SUMMARY ==="
info "Project: $PROJECT_NAME"
info "Environment: Production"
info "Services: ${#services[@]}"
info "URL: http://localhost (or your configured domain)"
info "Logs: docker-compose -f $COMPOSE_FILE logs -f"
info "Status: docker-compose -f $COMPOSE_FILE ps"

# Optional: Start monitoring services
if [[ "$1" == "--with-monitoring" ]]; then
    log "Starting monitoring services..."
    docker-compose -f "$COMPOSE_FILE" --profile monitoring up -d
    info "Grafana available at: http://localhost:3001"
    info "Prometheus available at: http://localhost:9090"
fi

log "🎉 Deployment completed successfully!"
info "To view logs: docker-compose -f $COMPOSE_FILE logs -f"
info "To stop services: docker-compose -f $COMPOSE_FILE down"