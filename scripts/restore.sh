#!/bin/bash

# System Recovery Script
# Restores the intelligent bid system from backups

set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$PROJECT_ROOT/backups}"

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

# Display usage
usage() {
    echo "Usage: $0 [backup-timestamp] [options]"
    echo ""
    echo "Options:"
    echo "  --database-only     Restore database only"
    echo "  --config-only       Restore configuration only"
    echo "  --no-confirm        Skip confirmation prompts"
    echo "  --from-s3           Download backup from S3"
    echo ""
    echo "Examples:"
    echo "  $0 20241201_143000"
    echo "  $0 20241201_143000 --database-only"
    echo "  $0 latest --from-s3"
}

# List available backups
list_backups() {
    log "Available backups:"
    
    if [[ -d "$BACKUP_DIR" ]]; then
        ls -la "$BACKUP_DIR" | grep "^d" | grep "20" | awk '{print $9, $6, $7, $8}' | while read -r backup date time size; do
            echo "  $backup ($date $time)"
        done
    else
        warning "No local backups found in $BACKUP_DIR"
    fi
    
    # List S3 backups if configured
    if [[ -n "$S3_BACKUP_BUCKET" && -n "$AWS_ACCESS_KEY_ID" ]]; then
        log "S3 backups:"
        aws s3 ls "s3://${S3_BACKUP_BUCKET}/backups/" | while read -r line; do
            echo "  $(echo "$line" | awk '{print $4}')"
        done
    fi
}

# Download backup from S3
download_from_s3() {
    local backup_timestamp="$1"
    log "Downloading backup from S3..."
    
    if [[ -z "$S3_BACKUP_BUCKET" ]]; then
        error "S3_BACKUP_BUCKET not configured"
        exit 1
    fi
    
    local s3_file="${backup_timestamp}.tar.gz"
    local local_file="${BACKUP_DIR}/${s3_file}"
    
    # Download from S3
    aws s3 cp "s3://${S3_BACKUP_BUCKET}/backups/${s3_file}" "$local_file"
    
    # Extract
    tar -xzf "$local_file" -C "$BACKUP_DIR"
    rm -f "$local_file"
    
    success "Backup downloaded and extracted from S3"
}

# Validate backup
validate_backup() {
    local backup_path="$1"
    log "Validating backup at $backup_path..."
    
    if [[ ! -d "$backup_path" ]]; then
        error "Backup directory not found: $backup_path"
        exit 1
    fi
    
    # Check for required files
    local required_files=("backup_report.txt")
    for file in "${required_files[@]}"; do
        if [[ ! -f "$backup_path/$file" ]]; then
            warning "Missing backup file: $file"
        fi
    done
    
    # Check database backup
    if [[ -f "$backup_path"/*.dump || -f "$backup_path"/*.sql ]]; then
        success "Database backup found"
    else
        warning "No database backup found"
    fi
    
    success "Backup validation completed"
}

# Restore database
restore_database() {
    local backup_path="$1"
    log "Restoring database..."
    
    # Load environment
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        set -a
        source "$PROJECT_ROOT/.env.production"
        set +a
    fi
    
    local db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    # Find database backup file
    local dump_file=$(find "$backup_path" -name "*.dump" | head -1)
    local sql_file=$(find "$backup_path" -name "*.sql" | head -1)
    
    if [[ -n "$dump_file" ]]; then
        log "Restoring from custom format dump: $dump_file"
        
        # Drop existing database and recreate
        PGPASSWORD="$POSTGRES_PASSWORD" dropdb \
            -h "$db_host" \
            -p "$db_port" \
            -U "$POSTGRES_USER" \
            --if-exists \
            "$POSTGRES_DB"
        
        PGPASSWORD="$POSTGRES_PASSWORD" createdb \
            -h "$db_host" \
            -p "$db_port" \
            -U "$POSTGRES_USER" \
            "$POSTGRES_DB"
        
        # Restore from dump
        PGPASSWORD="$POSTGRES_PASSWORD" pg_restore \
            -h "$db_host" \
            -p "$db_port" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            --verbose \
            --no-owner \
            --no-privileges \
            "$dump_file"
            
    elif [[ -n "$sql_file" ]]; then
        log "Restoring from SQL file: $sql_file"
        
        # Drop existing database and recreate
        PGPASSWORD="$POSTGRES_PASSWORD" dropdb \
            -h "$db_host" \
            -p "$db_port" \
            -U "$POSTGRES_USER" \
            --if-exists \
            "$POSTGRES_DB"
        
        PGPASSWORD="$POSTGRES_PASSWORD" createdb \
            -h "$db_host" \
            -p "$db_port" \
            -U "$POSTGRES_USER" \
            "$POSTGRES_DB"
        
        # Restore from SQL
        PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$db_host" \
            -p "$db_port" \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            -f "$sql_file"
    else
        error "No database backup file found"
        exit 1
    fi
    
    success "Database restoration completed"
}

# Restore Redis data
restore_redis() {
    local backup_path="$1"
    log "Restoring Redis data..."
    
    local redis_file=$(find "$backup_path" -name "*.rdb" | head -1)
    
    if [[ -n "$redis_file" ]]; then
        if docker ps --format "table {{.Names}}" | grep -q redis; then
            # Stop Redis, copy file, restart
            docker stop redis
            docker cp "$redis_file" redis:/data/dump.rdb
            docker start redis
            success "Redis data restored"
        else
            warning "Redis container not found, skipping Redis restore"
        fi
    else
        warning "No Redis backup file found"
    fi
}

# Restore configuration
restore_configuration() {
    local backup_path="$1"
    log "Restoring configuration files..."
    
    local config_path="$backup_path/config"
    
    if [[ -d "$config_path" ]]; then
        # Restore environment files
        if [[ -f "$config_path/.env.production" ]]; then
            cp "$config_path/.env.production" "$PROJECT_ROOT/"
            log "Restored .env.production"
        fi
        
        # Restore Docker configurations
        if [[ -f "$config_path/docker-compose.prod.yml" ]]; then
            cp "$config_path/docker-compose.prod.yml" "$PROJECT_ROOT/"
            log "Restored docker-compose.prod.yml"
        fi
        
        # Restore Kubernetes configurations
        if [[ -d "$config_path/k8s" ]]; then
            cp -r "$config_path/k8s" "$PROJECT_ROOT/"
            log "Restored Kubernetes configurations"
        fi
        
        # Restore monitoring configurations
        if [[ -d "$config_path/monitoring" ]]; then
            cp -r "$config_path/monitoring" "$PROJECT_ROOT/"
            log "Restored monitoring configurations"
        fi
        
        success "Configuration restoration completed"
    else
        warning "No configuration backup found"
    fi
}

# Restore application files
restore_application() {
    local backup_path="$1"
    log "Restoring application files..."
    
    local app_file=$(find "$backup_path" -name "application_*.tar.gz" | head -1)
    
    if [[ -n "$app_file" ]]; then
        # Create backup of current application
        local current_backup="$PROJECT_ROOT/current_backup_$(date +%Y%m%d_%H%M%S)"
        mkdir -p "$current_backup"
        
        # Backup current state
        tar -czf "$current_backup/current_application.tar.gz" \
            --exclude=backups \
            --exclude=.git \
            -C "$PROJECT_ROOT" .
        
        log "Current application backed up to $current_backup"
        
        # Extract application backup
        tar -xzf "$app_file" -C "$PROJECT_ROOT"
        
        success "Application files restored"
        log "Previous application backed up to: $current_backup"
    else
        warning "No application backup file found"
    fi
}

# Verify restoration
verify_restoration() {
    log "Verifying restoration..."
    
    # Check database connectivity
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        set -a
        source "$PROJECT_ROOT/.env.production"
        set +a
        
        local db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
        local db_port=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
        
        if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$db_host" -p "$db_port" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" &>/dev/null; then
            success "Database connectivity verified"
        else
            error "Database connectivity check failed"
        fi
    fi
    
    # Check application files
    if [[ -f "$PROJECT_ROOT/package.json" && -f "$PROJECT_ROOT/python-backend/main.py" ]]; then
        success "Application files verified"
    else
        warning "Some application files may be missing"
    fi
    
    success "Restoration verification completed"
}

# Main restoration process
main() {
    local backup_timestamp="$1"
    local database_only=false
    local config_only=false
    local no_confirm=false
    local from_s3=false
    
    # Parse arguments
    shift
    while [[ $# -gt 0 ]]; do
        case $1 in
            --database-only)
                database_only=true
                shift
                ;;
            --config-only)
                config_only=true
                shift
                ;;
            --no-confirm)
                no_confirm=true
                shift
                ;;
            --from-s3)
                from_s3=true
                shift
                ;;
            *)
                error "Unknown option: $1"
                usage
                exit 1
                ;;
        esac
    done
    
    # Validate backup timestamp
    if [[ -z "$backup_timestamp" ]]; then
        error "Backup timestamp is required"
        usage
        exit 1
    fi
    
    # Handle 'latest' keyword
    if [[ "$backup_timestamp" == "latest" ]]; then
        if [[ "$from_s3" == "true" ]]; then
            backup_timestamp=$(aws s3 ls "s3://${S3_BACKUP_BUCKET}/backups/" | tail -1 | awk '{print $4}' | sed 's/.tar.gz//')
        else
            backup_timestamp=$(ls -1 "$BACKUP_DIR" | grep "^20" | tail -1)
        fi
        
        if [[ -z "$backup_timestamp" ]]; then
            error "No backups found"
            exit 1
        fi
        
        log "Using latest backup: $backup_timestamp"
    fi
    
    # Download from S3 if requested
    if [[ "$from_s3" == "true" ]]; then
        download_from_s3 "$backup_timestamp"
    fi
    
    local backup_path="$BACKUP_DIR/$backup_timestamp"
    
    # Validate backup
    validate_backup "$backup_path"
    
    # Confirmation
    if [[ "$no_confirm" == "false" ]]; then
        echo ""
        warning "This will restore the system from backup: $backup_timestamp"
        warning "Current data may be overwritten!"
        echo ""
        read -p "Are you sure you want to continue? (yes/no): " confirm
        
        if [[ "$confirm" != "yes" ]]; then
            log "Restoration cancelled by user"
            exit 0
        fi
    fi
    
    log "Starting restoration process..."
    
    # Load environment
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        set -a
        source "$PROJECT_ROOT/.env.production"
        set +a
    fi
    
    # Perform restoration based on options
    if [[ "$config_only" == "true" ]]; then
        restore_configuration "$backup_path"
    elif [[ "$database_only" == "true" ]]; then
        restore_database "$backup_path"
    else
        # Full restoration
        restore_configuration "$backup_path"
        restore_database "$backup_path"
        restore_redis "$backup_path"
        restore_application "$backup_path"
    fi
    
    # Verify restoration
    verify_restoration
    
    success "Restoration completed successfully!"
    log "System restored from backup: $backup_timestamp"
}

# Handle script arguments
case "${1:-}" in
    "help"|"-h"|"--help")
        usage
        exit 0
        ;;
    "list")
        list_backups
        exit 0
        ;;
    "")
        error "Backup timestamp is required"
        usage
        exit 1
        ;;
    *)
        main "$@"
        ;;
esac