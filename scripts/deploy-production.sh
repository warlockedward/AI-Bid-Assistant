#!/bin/bash

# Production Deployment Script for Intelligent Bid System
# This script handles the complete production deployment process

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
NAMESPACE="intelligent-bid-system"
REGISTRY="ghcr.io"
IMAGE_PREFIX="${REGISTRY}/your-org/intelligent-bid-system"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if kubectl is installed and configured
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl is not installed or not in PATH"
        exit 1
    fi
    
    # Check if docker is installed
    if ! command -v docker &> /dev/null; then
        log_error "docker is not installed or not in PATH"
        exit 1
    fi
    
    # Check if we can connect to the cluster
    if ! kubectl cluster-info &> /dev/null; then
        log_error "Cannot connect to Kubernetes cluster. Please check your kubeconfig."
        exit 1
    fi
    
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        log_warning "Namespace $NAMESPACE does not exist. Creating it..."
        kubectl apply -f "$PROJECT_ROOT/k8s/namespace.yaml"
    fi
    
    log_success "Prerequisites check passed"
}

# Build and push Docker images
build_and_push_images() {
    local version="${1:-latest}"
    
    log_info "Building and pushing Docker images with version: $version"
    
    # Build frontend image
    log_info "Building frontend image..."
    docker build -t "${IMAGE_PREFIX}/frontend:${version}" \
        --target frontend-production \
        "$PROJECT_ROOT"
    
    # Build backend image
    log_info "Building backend image..."
    docker build -t "${IMAGE_PREFIX}/backend:${version}" \
        --target backend-production \
        "$PROJECT_ROOT"
    
    # Push images
    log_info "Pushing images to registry..."
    docker push "${IMAGE_PREFIX}/frontend:${version}"
    docker push "${IMAGE_PREFIX}/backend:${version}"
    
    log_success "Images built and pushed successfully"
}

# Update Kubernetes manifests with new image versions
update_manifests() {
    local version="${1:-latest}"
    local temp_dir
    temp_dir=$(mktemp -d)
    
    log_info "Updating Kubernetes manifests with version: $version"
    
    # Copy manifests to temp directory
    cp -r "$PROJECT_ROOT/k8s" "$temp_dir/"
    
    # Update image tags in deployment manifest
    sed -i.bak "s|image: intelligent-bid-system/frontend:latest|image: ${IMAGE_PREFIX}/frontend:${version}|g" \
        "$temp_dir/k8s/deployment.yaml"
    sed -i.bak "s|image: intelligent-bid-system/backend:latest|image: ${IMAGE_PREFIX}/backend:${version}|g" \
        "$temp_dir/k8s/deployment.yaml"
    
    echo "$temp_dir"
}

# Deploy to Kubernetes
deploy_to_kubernetes() {
    local manifests_dir="$1"
    
    log_info "Deploying to Kubernetes cluster..."
    
    # Apply configurations in order
    log_info "Applying namespace configuration..."
    kubectl apply -f "$manifests_dir/k8s/namespace.yaml"
    
    log_info "Applying ConfigMaps..."
    kubectl apply -f "$manifests_dir/k8s/configmap.yaml"
    
    log_info "Applying Secrets..."
    kubectl apply -f "$manifests_dir/k8s/secrets.yaml"
    
    log_info "Applying Persistent Volumes..."
    kubectl apply -f "$manifests_dir/k8s/persistent-volumes.yaml"
    
    log_info "Applying Services..."
    kubectl apply -f "$manifests_dir/k8s/services.yaml"
    
    log_info "Applying Deployments..."
    kubectl apply -f "$manifests_dir/k8s/deployment.yaml"
    
    log_info "Applying Ingress..."
    kubectl apply -f "$manifests_dir/k8s/ingress.yaml"
    
    log_success "Kubernetes manifests applied successfully"
}

# Wait for deployment to complete
wait_for_deployment() {
    log_info "Waiting for deployments to be ready..."
    
    # Wait for frontend deployment
    log_info "Waiting for frontend deployment..."
    kubectl rollout status deployment/intelligent-bid-frontend -n "$NAMESPACE" --timeout=600s
    
    # Wait for backend deployment
    log_info "Waiting for backend deployment..."
    kubectl rollout status deployment/intelligent-bid-backend -n "$NAMESPACE" --timeout=600s
    
    # Wait for database deployment
    log_info "Waiting for database deployment..."
    kubectl rollout status deployment/postgres -n "$NAMESPACE" --timeout=300s
    
    # Wait for redis deployment
    log_info "Waiting for redis deployment..."
    kubectl rollout status deployment/redis -n "$NAMESPACE" --timeout=300s
    
    log_success "All deployments are ready"
}

# Run health checks
run_health_checks() {
    log_info "Running health checks..."
    
    # Wait for pods to be ready
    log_info "Waiting for pods to be ready..."
    kubectl wait --for=condition=ready pod -l app=intelligent-bid-frontend -n "$NAMESPACE" --timeout=300s
    kubectl wait --for=condition=ready pod -l app=intelligent-bid-backend -n "$NAMESPACE" --timeout=300s
    kubectl wait --for=condition=ready pod -l app=postgres -n "$NAMESPACE" --timeout=300s
    kubectl wait --for=condition=ready pod -l app=redis -n "$NAMESPACE" --timeout=300s
    
    # Test frontend health endpoint
    log_info "Testing frontend health endpoint..."
    if kubectl exec -n "$NAMESPACE" deployment/intelligent-bid-frontend -- \
        curl -f http://localhost:3000/api/monitoring/health > /dev/null 2>&1; then
        log_success "Frontend health check passed"
    else
        log_error "Frontend health check failed"
        return 1
    fi
    
    # Test backend health endpoint
    log_info "Testing backend health endpoint..."
    if kubectl exec -n "$NAMESPACE" deployment/intelligent-bid-backend -- \
        curl -f http://localhost:8000/api/health > /dev/null 2>&1; then
        log_success "Backend health check passed"
    else
        log_error "Backend health check failed"
        return 1
    fi
    
    # Test database connectivity
    log_info "Testing database connectivity..."
    if kubectl exec -n "$NAMESPACE" deployment/postgres -- \
        pg_isready -U postgres > /dev/null 2>&1; then
        log_success "Database connectivity check passed"
    else
        log_error "Database connectivity check failed"
        return 1
    fi
    
    # Test redis connectivity
    log_info "Testing redis connectivity..."
    if kubectl exec -n "$NAMESPACE" deployment/redis -- \
        redis-cli ping > /dev/null 2>&1; then
        log_success "Redis connectivity check passed"
    else
        log_error "Redis connectivity check failed"
        return 1
    fi
    
    log_success "All health checks passed"
}

# Rollback deployment
rollback_deployment() {
    log_warning "Rolling back deployment..."
    
    kubectl rollout undo deployment/intelligent-bid-frontend -n "$NAMESPACE"
    kubectl rollout undo deployment/intelligent-bid-backend -n "$NAMESPACE"
    
    # Wait for rollback to complete
    kubectl rollout status deployment/intelligent-bid-frontend -n "$NAMESPACE" --timeout=300s
    kubectl rollout status deployment/intelligent-bid-backend -n "$NAMESPACE" --timeout=300s
    
    log_success "Rollback completed"
}

# Get deployment status
get_deployment_status() {
    log_info "Current deployment status:"
    
    echo "Deployments:"
    kubectl get deployments -n "$NAMESPACE"
    
    echo -e "\nPods:"
    kubectl get pods -n "$NAMESPACE"
    
    echo -e "\nServices:"
    kubectl get services -n "$NAMESPACE"
    
    echo -e "\nIngress:"
    kubectl get ingress -n "$NAMESPACE"
}

# Main deployment function
main() {
    local version="${1:-$(date +%Y%m%d-%H%M%S)}"
    local skip_build="${2:-false}"
    local temp_dir
    
    log_info "Starting production deployment of Intelligent Bid System"
    log_info "Version: $version"
    
    # Check prerequisites
    check_prerequisites
    
    # Build and push images (unless skipped)
    if [[ "$skip_build" != "true" ]]; then
        build_and_push_images "$version"
    else
        log_info "Skipping image build (using existing images)"
    fi
    
    # Update manifests
    temp_dir=$(update_manifests "$version")
    
    # Deploy to Kubernetes
    deploy_to_kubernetes "$temp_dir"
    
    # Wait for deployment
    if wait_for_deployment; then
        # Run health checks
        if run_health_checks; then
            log_success "🚀 Production deployment completed successfully!"
            log_info "Version deployed: $version"
            get_deployment_status
        else
            log_error "Health checks failed. Consider rolling back."
            read -p "Do you want to rollback? (y/N): " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                rollback_deployment
            fi
            exit 1
        fi
    else
        log_error "Deployment failed. Rolling back..."
        rollback_deployment
        exit 1
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
}

# Script usage
usage() {
    echo "Usage: $0 [VERSION] [SKIP_BUILD]"
    echo ""
    echo "Arguments:"
    echo "  VERSION     Version tag for the deployment (default: timestamp)"
    echo "  SKIP_BUILD  Skip building images, use existing ones (true/false, default: false)"
    echo ""
    echo "Examples:"
    echo "  $0                    # Deploy with timestamp version, build images"
    echo "  $0 v1.2.3            # Deploy version v1.2.3, build images"
    echo "  $0 v1.2.3 true       # Deploy version v1.2.3, skip building images"
    echo ""
    echo "Environment variables:"
    echo "  KUBECONFIG           Path to kubeconfig file"
    echo "  DOCKER_REGISTRY      Docker registry URL (default: ghcr.io)"
}

# Handle command line arguments
case "${1:-}" in
    -h|--help)
        usage
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac