#!/bin/bash

# Production Setup Script
# Initializes the production environment for the intelligent bid system

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    local missing_tools=()
    
    # Check required tools
    local required_tools=("docker" "docker-compose" "node" "npm" "python3" "pip3" "psql")
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [[ ${#missing_tools[@]} -gt 0 ]]; then
        error "Missing required tools: ${missing_tools[*]}"
        log "Please install the missing tools and run this script again"
        exit 1
    fi
    
    # Check Docker daemon
    if ! docker info &> /dev/null; then
        error "Docker daemon is not running"
        exit 1
    fi
    
    success "All prerequisites satisfied"
}

# Setup environment files
setup_environment() {
    log "Setting up environment configuration..."
    
    if [[ ! -f "$PROJECT_ROOT/.env.production" ]]; then
        if [[ -f "$PROJECT_ROOT/.env.production.example" ]]; then
            cp "$PROJECT_ROOT/.env.production.example" "$PROJECT_ROOT/.env.production"
            log "Created .env.production from example"
            warning "Please update .env.production with your actual values"
        else
            error ".env.production.example not found"
            exit 1
        fi
    else
        log ".env.production already exists"
    fi
    
    success "Environment configuration ready"
}

# Generate secure secrets
generate_secrets() {
    log "Generating secure secrets..."
    
    # Generate random secrets
    local nextauth_secret=$(openssl rand -base64 32)
    local jwt_secret=$(openssl rand -base64 32)
    local postgres_password=$(openssl rand -base64 16)
    local redis_password=$(openssl rand -base64 16)
    local grafana_password=$(openssl rand -base64 12)
    local webhook_secret=$(openssl rand -base64 24)
    
    # Update .env.production with generated secrets
    sed -i.bak \
        -e "s/your-nextauth-secret-key-change-in-production-min-32-chars/$nextauth_secret/" \
        -e "s/your-jwt-secret-key-change-in-production-min-32-chars/$jwt_secret/" \
        -e "s/secure_password_change_me/$postgres_password/" \
        -e "s/redis_password_change_me/$redis_password/" \
        -e "s/secure_grafana_password_change_me/$grafana_password/" \
        -e "s/your_webhook_secret_change_me/$webhook_secret/" \
        "$PROJECT_ROOT/.env.production"
    
    # Update database URL with new password
    sed -i.bak \
        "s|postgresql://biduser:secure_password_change_me@|postgresql://biduser:$postgres_password@|g" \
        "$PROJECT_ROOT/.env.production"
    
    # Update Redis URL with new password
    sed -i.bak \
        "s|redis://:redis_password_change_me@|redis://:$redis_password@|g" \
        "$PROJECT_ROOT/.env.production"
    
    success "Secure secrets generated and configured"
    warning "Backup of original .env.production saved as .env.production.bak"
}

# Setup SSL certificates directory
setup_ssl() {
    log "Setting up SSL certificates directory..."
    
    mkdir -p "$PROJECT_ROOT/ssl"
    
    # Create self-signed certificates for development/testing
    if [[ ! -f "$PROJECT_ROOT/ssl/cert.pem" ]]; then
        openssl req -x509 -newkey rsa:4096 -keyout "$PROJECT_ROOT/ssl/key.pem" \
            -out "$PROJECT_ROOT/ssl/cert.pem" -days 365 -nodes \
            -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost"
        
        log "Self-signed SSL certificates created for development"
        warning "Replace with proper certificates for production use"
    fi
    
    success "SSL setup completed"
}

# Setup monitoring directories
setup_monitoring() {
    log "Setting up monitoring directories..."
    
    # Create monitoring data directories
    mkdir -p "$PROJECT_ROOT/monitoring/prometheus/data"
    mkdir -p "$PROJECT_ROOT/monitoring/grafana/data"
    mkdir -p "$PROJECT_ROOT/logs"
    
    # Set proper permissions
    chmod 755 "$PROJECT_ROOT/monitoring/prometheus/data"
    chmod 755 "$PROJECT_ROOT/monitoring/grafana/data"
    chmod 755 "$PROJECT_ROOT/logs"
    
    success "Monitoring directories created"
}

# Setup database initialization
setup_database() {
    log "Setting up database initialization..."
    
    # Ensure database init directory exists
    mkdir -p "$PROJECT_ROOT/database/init"
    
    # Make migration script executable
    if [[ -f "$SCRIPT_DIR/migrate-database.sh" ]]; then
        chmod +x "$SCRIPT_DIR/migrate-database.sh"
    fi
    
    success "Database setup completed"
}

# Install dependencies
install_dependencies() {
    log "Installing dependencies..."
    
    # Install Node.js dependencies
    cd "$PROJECT_ROOT"
    npm ci --only=production
    
    # Install Python dependencies
    cd "$PROJECT_ROOT/python-backend"
    if [[ ! -d "venv" ]]; then
        python3 -m venv venv
    fi
    
    source venv/bin/activate
    pip install -r requirements.txt
    
    success "Dependencies installed"
}

# Build application
build_application() {
    log "Building application..."
    
    cd "$PROJECT_ROOT"
    
    # Build Next.js application
    npm run build
    
    success "Application built successfully"
}

# Setup systemd services (for Linux)
setup_systemd() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        log "Setting up systemd services..."
        
        # Create systemd service file
        cat > "/tmp/intelligent-bid-system.service" << EOF
[Unit]
Description=Intelligent Bid System
After=network.target
Requires=docker.service
After=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
WorkingDirectory=$PROJECT_ROOT
ExecStart=/usr/bin/docker-compose -f docker-compose.prod.yml up -d
ExecStop=/usr/bin/docker-compose -f docker-compose.prod.yml down
TimeoutStartSec=0

[Install]
WantedBy=multi-user.target
EOF
        
        log "Systemd service file created at /tmp/intelligent-bid-system.service"
        warning "To install: sudo mv /tmp/intelligent-bid-system.service /etc/systemd/system/"
        warning "Then run: sudo systemctl enable intelligent-bid-system"
    fi
}

# Setup cron jobs
setup_cron() {
    log "Setting up cron jobs..."
    
    # Create cron job for backups
    local cron_job="0 2 * * * $SCRIPT_DIR/backup.sh >> $PROJECT_ROOT/logs/backup.log 2>&1"
    
    # Add to crontab if not already present
    if ! crontab -l 2>/dev/null | grep -q "$SCRIPT_DIR/backup.sh"; then
        (crontab -l 2>/dev/null; echo "$cron_job") | crontab -
        success "Backup cron job added"
    else
        log "Backup cron job already exists"
    fi
}

# Validate configuration
validate_configuration() {
    log "Validating configuration..."
    
    # Run environment validator
    if [[ -f "$SCRIPT_DIR/env-validator.js" ]]; then
        node "$SCRIPT_DIR/env-validator.js" ".env.production"
    fi
    
    success "Configuration validation completed"
}

# Create production checklist
create_checklist() {
    log "Creating production checklist..."
    
    cat > "$PROJECT_ROOT/PRODUCTION_CHECKLIST.md" << 'EOF'
# Production Deployment Checklist

## Pre-Deployment
- [ ] Update `.env.production` with actual values
- [ ] Replace self-signed SSL certificates with proper ones
- [ ] Configure DNS records for your domain
- [ ] Set up monitoring alerts (email/Slack)
- [ ] Configure backup storage (S3 or similar)
- [ ] Review security settings

## Environment Variables to Update
- [ ] `DOMAIN` - Your actual domain
- [ ] `FRONTEND_DOMAIN` - Frontend subdomain
- [ ] `BACKEND_DOMAIN` - API subdomain
- [ ] `ACME_EMAIL` - Email for Let's Encrypt
- [ ] `OPENAI_API_KEY` - Your OpenAI API key
- [ ] `FASTGPT_URL` - Your FastGPT instance URL
- [ ] `FASTGPT_API_KEY` - Your FastGPT API key

## SSO Configuration (Choose one or more)
- [ ] Auth0: Set `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, `AUTH0_DOMAIN`
- [ ] Azure AD: Set `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`
- [ ] Okta: Set `OKTA_CLIENT_ID`, `OKTA_CLIENT_SECRET`, `OKTA_DOMAIN`

## Backup Configuration
- [ ] Set `S3_BACKUP_BUCKET` for automated backups
- [ ] Configure AWS credentials for S3 access
- [ ] Test backup and restore procedures

## Monitoring Setup
- [ ] Configure Grafana dashboards
- [ ] Set up Prometheus alerts
- [ ] Configure notification channels

## Security Checklist
- [ ] Change all default passwords
- [ ] Enable firewall rules
- [ ] Configure rate limiting
- [ ] Set up SSL/TLS certificates
- [ ] Review CORS settings
- [ ] Enable audit logging

## Deployment Steps
1. Run: `./scripts/setup-production.sh`
2. Update environment variables in `.env.production`
3. Run: `./scripts/deploy.sh docker-compose production`
4. Verify all services are running
5. Run health checks
6. Test critical workflows

## Post-Deployment
- [ ] Monitor system performance
- [ ] Verify backup schedule
- [ ] Test disaster recovery
- [ ] Document operational procedures
- [ ] Train operations team
EOF
    
    success "Production checklist created: PRODUCTION_CHECKLIST.md"
}

# Main setup process
main() {
    log "Starting production environment setup..."
    
    check_prerequisites
    setup_environment
    generate_secrets
    setup_ssl
    setup_monitoring
    setup_database
    install_dependencies
    build_application
    setup_systemd
    setup_cron
    validate_configuration
    create_checklist
    
    success "Production environment setup completed!"
    
    echo ""
    log "Next steps:"
    echo "1. Review and update .env.production with your actual values"
    echo "2. Check PRODUCTION_CHECKLIST.md for deployment checklist"
    echo "3. Run: ./scripts/deploy.sh docker-compose production"
    echo ""
    warning "Important: Update all placeholder values in .env.production before deployment!"
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        echo "Usage: $0"
        echo "Sets up the production environment for the intelligent bid system"
        exit 0
        ;;
    *)
        main
        ;;
esac