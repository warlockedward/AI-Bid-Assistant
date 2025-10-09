#!/bin/bash

# System Backup Script
# Creates comprehensive backups of the intelligent bid system

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
RETENTION_DAYS="${RETENTION_DAYS:-30}"

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

# Create backup directory
create_backup_dir() {
    local backup_path="${BACKUP_DIR}/${TIMESTAMP}"
    mkdir -p "$backup_path"
    echo "$backup_path"
}

# Backup database
backup_database() {
    local backup_path="$1"
    log "Backing up PostgreSQL database..."
    
    # Load environment
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        set -a
        source "$PROJECT_ROOT/.env.production"
        set +a
    fi
    
    local db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$db_host" \
        -p "$db_port" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-owner \
        --no-privileges \
        --format=custom \
        > "${backup_path}/database_${TIMESTAMP}.dump"
    
    # Create SQL backup as well
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$db_host" \
        -p "$db_port" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-owner \
        --no-privileges \
        > "${backup_path}/database_${TIMESTAMP}.sql"
    
    success "Database backup completed"
}

# Backup Redis data
backup_redis() {
    local backup_path="$1"
    log "Backing up Redis data..."
    
    # Copy Redis RDB file if available
    if docker ps --format "table {{.Names}}" | grep -q redis; then
        docker exec redis redis-cli BGSAVE
        sleep 5  # Wait for background save to complete
        docker cp redis:/data/dump.rdb "${backup_path}/redis_${TIMESTAMP}.rdb"
        success "Redis backup completed"
    else
        warning "Redis container not found, skipping Redis backup"
    fi
}

# Backup application files
backup_application() {
    local backup_path="$1"
    log "Backing up application files..."
    
    # Create application backup
    tar -czf "${backup_path}/application_${TIMESTAMP}.tar.gz" \
        --exclude=node_modules \
        --exclude=.next \
        --exclude=venv \
        --exclude=__pycache__ \
        --exclude=.git \
        --exclude=backups \
        -C "$PROJECT_ROOT" .
    
    success "Application backup completed"
}

# Backup configuration files
backup_configuration() {
    local backup_path="$1"
    log "Backing up configuration files..."
    
    mkdir -p "${backup_path}/config"
    
    # Copy environment files
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        cp "$PROJECT_ROOT/.env.production" "${backup_path}/config/"
    fi
    
    # Copy Docker configurations
    cp "$PROJECT_ROOT/docker-compose.prod.yml" "${backup_path}/config/" 2>/dev/null || true
    cp "$PROJECT_ROOT/Dockerfile" "${backup_path}/config/" 2>/dev/null || true
    
    # Copy Kubernetes configurations
    if [[ -d "$PROJECT_ROOT/k8s" ]]; then
        cp -r "$PROJECT_ROOT/k8s" "${backup_path}/config/"
    fi
    
    # Copy monitoring configurations
    if [[ -d "$PROJECT_ROOT/monitoring" ]]; then
        cp -r "$PROJECT_ROOT/monitoring" "${backup_path}/config/"
    fi
    
    success "Configuration backup completed"
}

# Upload to S3 (if configured)
upload_to_s3() {
    local backup_path="$1"
    
    if [[ -n "$S3_BACKUP_BUCKET" && -n "$AWS_ACCESS_KEY_ID" ]]; then
        log "Uploading backup to S3..."
        
        # Create compressed archive
        tar -czf "${backup_path}.tar.gz" -C "$(dirname "$backup_path")" "$(basename "$backup_path")"
        
        # Upload to S3
        aws s3 cp "${backup_path}.tar.gz" "s3://${S3_BACKUP_BUCKET}/backups/$(basename "${backup_path}.tar.gz")"
        
        # Remove local compressed file
        rm -f "${backup_path}.tar.gz"
        
        success "Backup uploaded to S3"
    else
        log "S3 configuration not found, skipping upload"
    fi
}

# Cleanup old backups
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    find "$BACKUP_DIR" -type d -name "20*" -mtime +$RETENTION_DAYS -exec rm -rf {} + 2>/dev/null || true
    
    # Cleanup S3 backups if configured
    if [[ -n "$S3_BACKUP_BUCKET" && -n "$AWS_ACCESS_KEY_ID" ]]; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y%m%d)
        aws s3 ls "s3://${S3_BACKUP_BUCKET}/backups/" | while read -r line; do
            local backup_date=$(echo "$line" | awk '{print $4}' | sed -n 's/.*_\([0-9]\{8\}\)_.*/\1/p')
            if [[ "$backup_date" < "$cutoff_date" ]]; then
                local backup_file=$(echo "$line" | awk '{print $4}')
                aws s3 rm "s3://${S3_BACKUP_BUCKET}/backups/$backup_file"
                log "Removed old S3 backup: $backup_file"
            fi
        done
    fi
    
    success "Old backups cleaned up"
}

# Generate backup report
generate_report() {
    local backup_path="$1"
    log "Generating backup report..."
    
    cat > "${backup_path}/backup_report.txt" << EOF
Intelligent Bid System Backup Report
====================================

Backup Timestamp: $TIMESTAMP
Backup Location: $backup_path
Retention Policy: $RETENTION_DAYS days

Files Included:
$(ls -la "$backup_path")

Backup Sizes:
$(du -sh "$backup_path"/*)

System Information:
Hostname: $(hostname)
OS: $(uname -a)
Disk Usage: $(df -h /)

Database Information:
$(PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$db_host" -p "$db_port" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT version();" 2>/dev/null || echo "Database connection failed")

Backup completed at: $(date)
EOF
    
    success "Backup report generated"
}

# Main backup process
main() {
    log "Starting system backup process..."
    
    # Load environment
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        set -a
        source "$PROJECT_ROOT/.env.production"
        set +a
    fi
    
    # Create backup directory
    local backup_path=$(create_backup_dir)
    log "Backup location: $backup_path"
    
    # Perform backups
    backup_database "$backup_path"
    backup_redis "$backup_path"
    backup_application "$backup_path"
    backup_configuration "$backup_path"
    
    # Generate report
    generate_report "$backup_path"
    
    # Upload to S3 if configured
    upload_to_s3 "$backup_path"
    
    # Cleanup old backups
    cleanup_old_backups
    
    success "Backup process completed successfully!"
    log "Backup location: $backup_path"
}

# Handle arguments
case "${1:-}" in
    "database-only")
        log "Running database backup only..."
        backup_path=$(create_backup_dir)
        backup_database "$backup_path"
        ;;
    "config-only")
        log "Running configuration backup only..."
        backup_path=$(create_backup_dir)
        backup_configuration "$backup_path"
        ;;
    *)
        main
        ;;
esac