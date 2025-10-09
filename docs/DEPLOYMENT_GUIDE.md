# Production Deployment Guide

This guide covers the complete deployment process for the Intelligent Bid System in production environments.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Setup](#environment-setup)
3. [Docker Compose Deployment](#docker-compose-deployment)
4. [Kubernetes Deployment](#kubernetes-deployment)
5. [Database Migration](#database-migration)
6. [Monitoring Setup](#monitoring-setup)
7. [Backup and Recovery](#backup-and-recovery)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu 20.04+ recommended) or macOS
- **Memory**: Minimum 8GB RAM (16GB+ recommended for production)
- **Storage**: Minimum 50GB free space
- **CPU**: 4+ cores recommended

### Required Software

- Docker 20.10+
- Docker Compose 2.0+
- Node.js 18+
- Python 3.11+
- PostgreSQL client tools
- Git

### Network Requirements

- Ports 80, 443 (HTTP/HTTPS)
- Port 3000 (Frontend)
- Port 8000 (Backend API)
- Port 5432 (PostgreSQL)
- Port 6379 (Redis)

## Environment Setup

### 1. Initial Setup

```bash
# Clone the repository
git clone <repository-url>
cd intelligent-bid-system

# Run the production setup script
./scripts/setup-production.sh
```

### 2. Configure Environment Variables

Edit `.env.production` with your actual values:

```bash
# Domain Configuration
DOMAIN=yourdomain.com
FRONTEND_DOMAIN=app.yourdomain.com
BACKEND_DOMAIN=api.yourdomain.com
ACME_EMAIL=admin@yourdomain.com

# Database Configuration
POSTGRES_PASSWORD=your_secure_database_password
DATABASE_URL=postgresql://biduser:your_secure_database_password@db:5432/bid_system_prod

# AI Services
OPENAI_API_KEY=your_openai_api_key_here
FASTGPT_URL=https://your-fastgpt-instance.com
FASTGPT_API_KEY=your_fastgpt_api_key_here

# Authentication
NEXTAUTH_SECRET=your_generated_nextauth_secret
JWT_SECRET=your_generated_jwt_secret
```

### 3. Validate Configuration

```bash
# Validate environment configuration
node scripts/env-validator.js .env.production
```

## Docker Compose Deployment

### 1. Build and Deploy

```bash
# Deploy with Docker Compose
./scripts/deploy.sh docker-compose production
```

### 2. Manual Deployment Steps

```bash
# Build images
docker build -t intelligent-bid-system/frontend:latest --target frontend-production .
docker build -t intelligent-bid-system/backend:latest --target backend-production .

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps
```

### 3. Verify Deployment

```bash
# Check frontend health
curl http://localhost:3000/api/monitoring/health

# Check backend health
curl http://localhost:8000/health

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Kubernetes Deployment

### 1. Prerequisites

- Kubernetes cluster (1.20+)
- kubectl configured
- Ingress controller (nginx recommended)
- cert-manager for SSL certificates

### 2. Deploy to Kubernetes

```bash
# Deploy using the deployment script
./scripts/deploy.sh kubernetes production
```

### 3. Manual Kubernetes Deployment

```bash
# Apply manifests in order
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/postgres.yaml
kubectl apply -f k8s/redis.yaml
kubectl apply -f k8s/backend.yaml
kubectl apply -f k8s/frontend.yaml
kubectl apply -f k8s/ingress.yaml

# Check deployment status
kubectl get pods -n intelligent-bid-system
kubectl get services -n intelligent-bid-system
```

### 4. Configure Ingress

Update `k8s/ingress.yaml` with your domain:

```yaml
spec:
  tls:
  - hosts:
    - app.yourdomain.com
    - api.yourdomain.com
    secretName: app-tls-secret
  rules:
  - host: app.yourdomain.com
    # ... rest of configuration
```

## Database Migration

### 1. Automatic Migration

Database migrations run automatically during deployment. To run manually:

```bash
./scripts/migrate-database.sh
```

### 2. Manual Migration Steps

```bash
# Navigate to backend directory
cd python-backend

# Run Alembic migrations
python -m alembic upgrade head

# Verify migration
python -m alembic current
```

### 3. Backup Before Migration

```bash
# Create backup before migration
./scripts/migrate-database.sh backup-only
```

## Monitoring Setup

### 1. Access Monitoring Dashboards

- **Grafana**: http://localhost:3001 (admin/your_grafana_password)
- **Prometheus**: http://localhost:9090

### 2. Configure Alerts

Edit `monitoring/alert_rules.yml` to customize alert thresholds:

```yaml
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.1
  for: 2m
  labels:
    severity: warning
```

### 3. Set Up Notifications

Configure Slack/email notifications in Grafana:

1. Go to Alerting > Notification channels
2. Add your Slack webhook or SMTP settings
3. Test the notification

## Backup and Recovery

### 1. Automated Backups

Backups run automatically via cron job (daily at 2 AM):

```bash
# Check cron job
crontab -l

# Manual backup
./scripts/backup.sh
```

### 2. Backup to S3

Configure S3 backup in `.env.production`:

```bash
S3_BACKUP_BUCKET=your-backup-bucket
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
```

### 3. Restore from Backup

```bash
# List available backups
./scripts/restore.sh list

# Restore from specific backup
./scripts/restore.sh 20241201_143000

# Restore from S3
./scripts/restore.sh latest --from-s3
```

## SSL/TLS Configuration

### 1. Let's Encrypt (Recommended)

SSL certificates are automatically managed by Traefik with Let's Encrypt:

```yaml
# In docker-compose.prod.yml
- "--certificatesresolvers.letsencrypt.acme.tlschallenge=true"
- "--certificatesresolvers.letsencrypt.acme.email=${ACME_EMAIL}"
```

### 2. Custom Certificates

Place your certificates in the `ssl/` directory:

```bash
ssl/
├── cert.pem
└── key.pem
```

## Health Checks and Monitoring

### 1. Health Check Endpoints

- **Frontend**: `/api/monitoring/health`
- **Backend**: `/health` (comprehensive), `/health/quick` (basic)
- **Readiness**: `/health/readiness`
- **Liveness**: `/health/liveness`

### 2. Monitoring Metrics

Key metrics to monitor:

- Response time and error rates
- Database connection pool usage
- Memory and CPU utilization
- Workflow success/failure rates
- Tenant isolation violations

### 3. Log Aggregation

Logs are collected in the `logs/` directory:

```bash
logs/
├── application.log
├── error.log
├── access.log
└── backup.log
```

## Troubleshooting

### Common Issues

#### 1. Database Connection Failed

```bash
# Check database status
docker-compose -f docker-compose.prod.yml logs db

# Test connection
PGPASSWORD=your_password psql -h localhost -U biduser -d bid_system_prod
```

#### 2. Frontend Build Errors

```bash
# Check Node.js version
node --version  # Should be 18+

# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

#### 3. SSL Certificate Issues

```bash
# Check certificate status
docker-compose -f docker-compose.prod.yml logs traefik

# Force certificate renewal
docker-compose -f docker-compose.prod.yml restart traefik
```

#### 4. High Memory Usage

```bash
# Check container resource usage
docker stats

# Adjust memory limits in docker-compose.prod.yml
services:
  backend:
    deploy:
      resources:
        limits:
          memory: 2G
```

### Performance Optimization

#### 1. Database Optimization

```sql
-- Check slow queries
SELECT query, mean_time, calls 
FROM pg_stat_statements 
ORDER BY mean_time DESC 
LIMIT 10;

-- Analyze table statistics
ANALYZE;
```

#### 2. Redis Optimization

```bash
# Check Redis memory usage
docker exec redis redis-cli info memory

# Configure memory policy
docker exec redis redis-cli config set maxmemory-policy allkeys-lru
```

#### 3. Application Optimization

- Enable gzip compression
- Configure CDN for static assets
- Implement database connection pooling
- Use Redis for session storage

### Scaling Considerations

#### 1. Horizontal Scaling

```yaml
# Scale services in docker-compose.prod.yml
services:
  backend:
    deploy:
      replicas: 3
  frontend:
    deploy:
      replicas: 2
```

#### 2. Database Scaling

- Configure read replicas
- Implement connection pooling
- Consider database sharding for multi-tenant data

#### 3. Load Balancing

- Use Traefik for automatic load balancing
- Configure health checks
- Implement circuit breakers

## Security Checklist

- [ ] Change all default passwords
- [ ] Enable firewall rules
- [ ] Configure rate limiting
- [ ] Set up SSL/TLS certificates
- [ ] Review CORS settings
- [ ] Enable audit logging
- [ ] Implement proper authentication
- [ ] Configure tenant isolation
- [ ] Set up monitoring alerts
- [ ] Regular security updates

## Maintenance

### Regular Tasks

- Monitor system performance
- Review and rotate logs
- Update dependencies
- Test backup and restore procedures
- Review security configurations
- Monitor SSL certificate expiration

### Updates and Patches

```bash
# Update application
git pull origin main
./scripts/deploy.sh docker-compose production

# Update system packages
sudo apt update && sudo apt upgrade

# Update Docker images
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

## Support

For additional support:

1. Check the troubleshooting section
2. Review application logs
3. Check monitoring dashboards
4. Consult the API documentation
5. Contact the development team

---

**Note**: This guide assumes a production environment. For development or staging deployments, adjust the configuration accordingly.