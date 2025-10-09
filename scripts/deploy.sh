#!/bin/bash

# Production Deployment Script
# This script handles the complete deployment process for the intelligent bid system

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" >&2
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Configuration variables
DEPLOYMENT_TYPE="${1:-docker-compose}"  # docker-compose or kubernetes
ENVIRONMENT="${2:-production}"
BUILD_IMAGES="${BUILD_IMAGES:-true}"
RUN_MIGRATIONS="${RUN_MIGRATIONS:-true}"
VALIDATE_ENV="${VALIDATE_ENV:-true}"

# Display usage information
usage() {
    echo "Usage: $0 [deployment-type] [environment]"
    echo ""
    echo "Deployment Types:"
    echo "  docker-compose  Deploy using Docker Compose (default)"
    echo "  kubernetes      Deploy to Kubernetes cluster"
    echo ""
    echo "Environments:"
    echo "  production      Production environment (default)"
    echo "  staging         Staging environment"
    echo ""
    echo "Environment Variables:"
    echo "  BUILD_IMAGES=true|false     Build Docker images (default: true)"
    echo "  RUN_MIGRATIONS=true|false   Run database migrations (default: true)"
    echo "  VALIDATE_ENV=true|false     Validate environment (default: true)"
    echo ""
    echo "Examples:"
    echo "  $0 docker-compose production"
    echo "  BUILD_IMAGES=false $0 kubernetes staging"
}

# Validate environment
validate_environment() {
    if [[ "$VALIDATE_ENV" == "true" ]]; then
        log "Validating environment configuration..."
        
        if [[ -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]]; then
            node "$SCRIPT_DIR/env-validator.js" ".env.$ENVIRONMENT"
            if [[ $? -ne 0 ]]; then
                error "Environment validation failed"
                exit 1
            fi
        else
            warning "Environment file .env.$ENVIRONMENT not found, using system environment"
        fi
        
        success "Environment validation completed"
    fi
}

# Build Docker images
build_images() {
    if [[ "$BUILD_IMAGES" == "true" ]]; then
        log "Building Docker images..."
        
        cd "$PROJECT_ROOT"
        
        # Build frontend image
        log "Building frontend image..."
        docker build -t intelligent-bid-system/frontend:latest --target frontend-production .
        
        # Build backend image
        log "Building backend image..."
        docker build -t intelligent-bid-system/backend:latest --target backend-production .
        
        success "Docker images built successfully"
    else
        log "Skipping image build (BUILD_IMAGES=false)"
    fi
}

# Run database migrations
run_migrations() {
    if [[ "$RUN_MIGRATIONS" == "true" ]]; then
        log "Running database migrations..."
        
        # Load environment
        if [[ -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]]; then
            set -a
            source "$PROJECT_ROOT/.env.$ENVIRONMENT"
            set +a
        fi
        
        # Run migration script
        "$SCRIPT_DIR/migrate-database.sh"
        
        success "Database migrations completed"
    else
        log "Skipping database migrations (RUN_MIGRATIONS=false)"
    fi
}

# Deploy with Docker Compose
deploy_docker_compose() {
    log "Deploying with Docker Compose..."
    
    cd "$PROJECT_ROOT"
    
    # Load environment
    if [[ -f ".env.$ENVIRONMENT" ]]; then
        cp ".env.$ENVIRONMENT" .env
        log "Loaded environment from .env.$ENVIRONMENT"
    fi
    
    # Stop existing containers
    log "Stopping existing containers..."
    docker-compose -f docker-compose.prod.yml down
    
    # Start services
    log "Starting services..."
    docker-compose -f docker-compose.prod.yml up -d
    
    # Wait for services to be ready
    log "Waiting for services to be ready..."
    sleep 30
    
    # Health check
    check_service_health
    
    success "Docker Compose deployment completed"
}

# Deploy to Kubernetes
deploy_kubernetes() {
    log "Deploying to Kubernetes..."
    
    cd "$PROJECT_ROOT"
    
    # Check kubectl connectivity
    if ! kubectl cluster-info &> /dev/null; then
        error "Cannot connect to Kubernetes cluster"
        exit 1
    fi
    
    # Apply Kubernetes manifests
    log "Applying Kubernetes manifests..."
    
    kubectl apply -f k8s/namespace.yaml
    kubectl apply -f k8s/configmap.yaml
    kubectl apply -f k8s/secrets.yaml
    kubectl apply -f k8s/postgres.yaml
    kubectl apply -f k8s/redis.yaml
    
    # Wait for database to be ready
    log "Waiting for database to be ready..."
    kubectl wait --for=condition=ready pod -l app=postgres -n intelligent-bid-system --timeout=300s
    
    # Deploy applications
    kubectl apply -f k8s/backend.yaml
    kubectl apply -f k8s/frontend.yaml
    kubectl apply -f k8s/ingress.yaml
    
    # Wait for deployments to be ready
    log "Waiting for deployments to be ready..."
    kubectl wait --for=condition=available deployment/backend -n intelligent-bid-system --timeout=300s
    kubectl wait --for=condition=available deployment/frontend -n intelligent-bid-system --timeout=300s
    
    # Health check
    check_kubernetes_health
    
    success "Kubernetes deployment completed"
}

# Check service health
check_service_health() {
    log "Performing health checks..."
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        log "Health check attempt $attempt/$max_attempts"
        
        # Check frontend
        if curl -f http://localhost:3000/api/monitoring/health &> /dev/null; then
            success "Frontend is healthy"
            break
        fi
        
        # Check backend
        if curl -f http://localhost:8000/health &> /dev/null; then
            success "Backend is healthy"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            error "Health check failed after $max_attempts attempts"
            return 1
        fi
        
        sleep 10
        ((attempt++))
    done
    
    success "All services are healthy"
}

# Check Kubernetes health
check_kubernetes_health() {
    log "Checking Kubernetes deployment health..."
    
    # Get pod status
    kubectl get pods -n intelligent-bid-system
    
    # Check service endpoints
    kubectl get services -n intelligent-bid-system
    
    # Check ingress
    kubectl get ingress -n intelligent-bid-system
    
    success "Kubernetes health check completed"
}

# Cleanup function
cleanup() {
    log "Performing cleanup..."
    
    # Remove temporary files
    if [[ -f "$PROJECT_ROOT/.env" && -f "$PROJECT_ROOT/.env.$ENVIRONMENT" ]]; then
        rm -f "$PROJECT_ROOT/.env"
    fi
    
    success "Cleanup completed"
}

# Main deployment process
main() {
    log "Starting deployment process..."
    log "Deployment type: $DEPLOYMENT_TYPE"
    log "Environment: $ENVIRONMENT"
    log "Timestamp: $TIMESTAMP"
    
    # Validate inputs
    if [[ "$DEPLOYMENT_TYPE" != "docker-compose" && "$DEPLOYMENT_TYPE" != "kubernetes" ]]; then
        error "Invalid deployment type: $DEPLOYMENT_TYPE"
        usage
        exit 1
    fi
    
    # Set trap for cleanup
    trap cleanup EXIT
    
    # Run deployment steps
    validate_environment
    build_images
    run_migrations
    
    case "$DEPLOYMENT_TYPE" in
        "docker-compose")
            deploy_docker_compose
            ;;
        "kubernetes")
            deploy_kubernetes
            ;;
    esac
    
    success "Deployment completed successfully!"
    log "Deployment timestamp: $TIMESTAMP"
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        usage
        exit 0
        ;;
    *)
        main
        ;;
esac