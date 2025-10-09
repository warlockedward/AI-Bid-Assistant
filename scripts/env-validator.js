#!/usr/bin/env node

/**
 * Environment Variable Validator
 * Validates required environment variables for production deployment
 */

const fs = require('fs');
const path = require('path');

// Required environment variables for production
const REQUIRED_VARS = {
  // Core Application
  'NODE_ENV': { required: true, values: ['production'] },
  'NEXTAUTH_URL': { required: true, pattern: /^https:\/\/.+/ },
  'NEXTAUTH_SECRET': { required: true, minLength: 32 },
  'JWT_SECRET': { required: true, minLength: 32 },
  
  // Database
  'DATABASE_URL': { required: true, pattern: /^postgresql:\/\/.+/ },
  'POSTGRES_DB': { required: true },
  'POSTGRES_USER': { required: true },
  'POSTGRES_PASSWORD': { required: true, minLength: 12 },
  
  // Redis
  'REDIS_URL': { required: true, pattern: /^redis:\/\/.+/ },
  'REDIS_PASSWORD': { required: true, minLength: 8 },
  
  // AI Services
  'OPENAI_API_KEY': { required: true, pattern: /^sk-.+/ },
  
  // Domain Configuration
  'DOMAIN': { required: true },
  'FRONTEND_DOMAIN': { required: true },
  'BACKEND_DOMAIN': { required: true },
  'ACME_EMAIL': { required: true, pattern: /^.+@.+\..+$/ },
};

// Optional but recommended variables
const RECOMMENDED_VARS = {
  'FASTGPT_URL': { pattern: /^https?:\/\/.+/ },
  'FASTGPT_API_KEY': {},
  'AUTH0_CLIENT_ID': {},
  'AUTH0_CLIENT_SECRET': {},
  'AZURE_AD_CLIENT_ID': {},
  'AZURE_AD_CLIENT_SECRET': {},
  'GRAFANA_PASSWORD': { minLength: 8 },
  'BACKUP_SCHEDULE': {},
  'SMTP_HOST': {},
};

class EnvironmentValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validateRequired() {
    console.log('🔍 Validating required environment variables...\n');
    
    for (const [varName, config] of Object.entries(REQUIRED_VARS)) {
      const value = process.env[varName];
      
      if (!value) {
        this.errors.push(`❌ ${varName} is required but not set`);
        continue;
      }
      
      // Validate specific values
      if (config.values && !config.values.includes(value)) {
        this.errors.push(`❌ ${varName} must be one of: ${config.values.join(', ')}`);
        continue;
      }
      
      // Validate pattern
      if (config.pattern && !config.pattern.test(value)) {
        this.errors.push(`❌ ${varName} format is invalid`);
        continue;
      }
      
      // Validate minimum length
      if (config.minLength && value.length < config.minLength) {
        this.errors.push(`❌ ${varName} must be at least ${config.minLength} characters`);
        continue;
      }
      
      console.log(`✅ ${varName}`);
    }
  }

  validateRecommended() {
    console.log('\n🔍 Checking recommended environment variables...\n');
    
    for (const [varName, config] of Object.entries(RECOMMENDED_VARS)) {
      const value = process.env[varName];
      
      if (!value) {
        this.warnings.push(`⚠️  ${varName} is not set (recommended for production)`);
        continue;
      }
      
      // Validate pattern if provided
      if (config.pattern && !config.pattern.test(value)) {
        this.warnings.push(`⚠️  ${varName} format may be invalid`);
        continue;
      }
      
      // Validate minimum length if provided
      if (config.minLength && value.length < config.minLength) {
        this.warnings.push(`⚠️  ${varName} should be at least ${config.minLength} characters`);
        continue;
      }
      
      console.log(`✅ ${varName}`);
    }
  }

  validateSecurity() {
    console.log('\n🔒 Performing security checks...\n');
    
    // Check for default/weak passwords
    const weakPasswords = ['password', '123456', 'admin', 'root', 'test'];
    const passwordVars = ['POSTGRES_PASSWORD', 'REDIS_PASSWORD', 'GRAFANA_PASSWORD'];
    
    for (const varName of passwordVars) {
      const value = process.env[varName];
      if (value && weakPasswords.some(weak => value.toLowerCase().includes(weak))) {
        this.errors.push(`❌ ${varName} appears to use a weak password`);
      }
    }
    
    // Check for development secrets in production
    const secrets = ['NEXTAUTH_SECRET', 'JWT_SECRET'];
    for (const varName of secrets) {
      const value = process.env[varName];
      if (value && (value.includes('development') || value.includes('test'))) {
        this.errors.push(`❌ ${varName} appears to be a development secret`);
      }
    }
    
    // Check HTTPS enforcement
    const httpsVars = ['NEXTAUTH_URL', 'FASTGPT_URL'];
    for (const varName of httpsVars) {
      const value = process.env[varName];
      if (value && !value.startsWith('https://')) {
        this.warnings.push(`⚠️  ${varName} should use HTTPS in production`);
      }
    }
    
    console.log('✅ Security checks completed');
  }

  validateTenantConfiguration() {
    console.log('\n🏢 Validating tenant configuration...\n');
    
    const tenantIsolation = process.env.TENANT_ISOLATION_ENABLED;
    if (tenantIsolation !== 'true') {
      this.warnings.push('⚠️  TENANT_ISOLATION_ENABLED should be true in production');
    }
    
    const maxWorkflows = process.env.MAX_CONCURRENT_WORKFLOWS;
    if (maxWorkflows && (isNaN(maxWorkflows) || parseInt(maxWorkflows) < 1)) {
      this.errors.push('❌ MAX_CONCURRENT_WORKFLOWS must be a positive number');
    }
    
    console.log('✅ Tenant configuration validated');
  }

  generateReport() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 ENVIRONMENT VALIDATION REPORT');
    console.log('='.repeat(60));
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('🎉 All environment variables are properly configured!');
      return true;
    }
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS (must be fixed):');
      this.errors.forEach(error => console.log(`   ${error}`));
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (recommended to fix):');
      this.warnings.forEach(warning => console.log(`   ${warning}`));
    }
    
    console.log('\n' + '='.repeat(60));
    
    return this.errors.length === 0;
  }

  static loadEnvironment(envFile = '.env.production') {
    if (fs.existsSync(envFile)) {
      const envContent = fs.readFileSync(envFile, 'utf8');
      const lines = envContent.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
          const [key, ...valueParts] = trimmed.split('=');
          if (key && valueParts.length > 0) {
            process.env[key] = valueParts.join('=');
          }
        }
      }
      
      console.log(`📁 Loaded environment from ${envFile}\n`);
    } else {
      console.log(`⚠️  Environment file ${envFile} not found, using system environment\n`);
    }
  }
}

// Main execution
function main() {
  const envFile = process.argv[2] || '.env.production';
  
  console.log('🚀 Production Environment Validator');
  console.log('='.repeat(60));
  
  // Load environment file if provided
  EnvironmentValidator.loadEnvironment(envFile);
  
  const validator = new EnvironmentValidator();
  
  // Run all validations
  validator.validateRequired();
  validator.validateRecommended();
  validator.validateSecurity();
  validator.validateTenantConfiguration();
  
  // Generate report and exit with appropriate code
  const isValid = validator.generateReport();
  process.exit(isValid ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = EnvironmentValidator;