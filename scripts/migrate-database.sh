#!/bin/bash

# Database Migration Script for Production
# This script handles database migrations safely in production environment

set -e  # Exit on any error

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_ROOT}/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
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

# Check if required environment variables are set
check_environment() {
    log "Checking environment variables..."
    
    local required_vars=("DATABASE_URL" "POSTGRES_USER" "POSTGRES_PASSWORD" "POSTGRES_DB")
    local missing_vars=()
    
    for var in "${required_vars[@]}"; do
        if [[ -z "${!var}" ]]; then
            missing_vars+=("$var")
        fi
    done
    
    if [[ ${#missing_vars[@]} -gt 0 ]]; then
        error "Missing required environment variables: ${missing_vars[*]}"
        exit 1
    fi
    
    success "Environment variables validated"
}

# Create backup directory
create_backup_dir() {
    if [[ ! -d "$BACKUP_DIR" ]]; then
        mkdir -p "$BACKUP_DIR"
        log "Created backup directory: $BACKUP_DIR"
    fi
}

# Backup database before migration
backup_database() {
    log "Creating database backup..."
    
    local backup_file="${BACKUP_DIR}/backup_${POSTGRES_DB}_${TIMESTAMP}.sql"
    
    # Extract connection details from DATABASE_URL
    local db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    # Create backup
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$db_host" \
        -p "$db_port" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB" \
        --verbose \
        --no-owner \
        --no-privileges \
        > "$backup_file"
    
    if [[ $? -eq 0 ]]; then
        success "Database backup created: $backup_file"
        
        # Compress backup
        gzip "$backup_file"
        success "Backup compressed: ${backup_file}.gz"
    else
        error "Failed to create database backup"
        exit 1
    fi
}

# Check database connectivity
check_database_connection() {
    log "Testing database connection..."
    
    local db_host=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
    local db_port=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
    
    PGPASSWORD="$POSTGRES_PASSWORD" pg_isready \
        -h "$db_host" \
        -p "$db_port" \
        -U "$POSTGRES_USER" \
        -d "$POSTGRES_DB"
    
    if [[ $? -eq 0 ]]; then
        success "Database connection successful"
    else
        error "Cannot connect to database"
        exit 1
    fi
}

# Run Alembic migrations
run_migrations() {
    log "Running database migrations..."
    
    cd "$PROJECT_ROOT/python-backend"
    
    # Check current migration status
    python -m alembic current
    
    # Show pending migrations
    log "Checking for pending migrations..."
    python -m alembic show
    
    # Run migrations
    python -m alembic upgrade head
    
    if [[ $? -eq 0 ]]; then
        success "Database migrations completed successfully"
    else
        error "Database migration failed"
        exit 1
    fi
}

# Verify migration success
verify_migrations() {
    log "Verifying migration success..."
    
    cd "$PROJECT_ROOT/python-backend"
    
    # Check final migration status
    python -m alembic current
    
    # Run basic connectivity test
    python -c "
import sys
sys.path.append('.')
from database.database import get_database
from sqlalchemy import text

try:
    db = next(get_database())
    result = db.execute(text('SELECT 1 as test')).fetchone()
    if result and result.test == 1:
        print('✅ Database verification successful')
    else:
        print('❌ Database verification failed')
        sys.exit(1)
except Exception as e:
    print(f'❌ Database verification error: {e}')
    sys.exit(1)
"
    
    if [[ $? -eq 0 ]]; then
        success "Migration verification completed"
    else
        error "Migration verification failed"
        exit 1
    fi
}

# Cleanup old backups (keep last 10)
cleanup_old_backups() {
    log "Cleaning up old backups..."
    
    local backup_count=$(ls -1 "$BACKUP_DIR"/backup_*.sql.gz 2>/dev/null | wc -l)
    
    if [[ $backup_count -gt 10 ]]; then
        ls -1t "$BACKUP_DIR"/backup_*.sql.gz | tail -n +11 | xargs rm -f
        success "Cleaned up old backups (kept latest 10)"
    else
        log "No cleanup needed (${backup_count} backups found)"
    fi
}

# Main migration process
main() {
    log "Starting database migration process..."
    
    # Load environment if .env.production exists
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        log "Loading production environment..."
        set -a
        source "$PROJECT_ROOT/.env.production"
        set +a
    fi
    
    # Run migration steps
    check_environment
    create_backup_dir
    check_database_connection
    backup_database
    run_migrations
    verify_migrations
    cleanup_old_backups
    
    success "Database migration completed successfully!"
    log "Backup location: ${BACKUP_DIR}/backup_${POSTGRES_DB}_${TIMESTAMP}.sql.gz"
}

# Handle script arguments
case "${1:-}" in
    "backup-only")
        log "Running backup only..."
        check_environment
        create_backup_dir
        check_database_connection
        backup_database
        ;;
    "migrate-only")
        log "Running migrations only (no backup)..."
        check_environment
        check_database_connection
        run_migrations
        verify_migrations
        ;;
    "verify")
        log "Running verification only..."
        check_environment
        verify_migrations
        ;;
    *)
        main
        ;;
esac