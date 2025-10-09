-- Production database initialization script
-- This script creates the necessary databases and users for the production environment

-- Create application database if it doesn't exist
SELECT 'CREATE DATABASE bid_system_prod'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bid_system_prod')\gexec

-- Create dedicated user for the application
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'biduser') THEN
        CREATE USER biduser WITH PASSWORD 'secure_password_change_me';
    END IF;
END
$$;

-- Grant necessary permissions
GRANT ALL PRIVILEGES ON DATABASE bid_system_prod TO biduser;

-- Connect to the application database
\c bid_system_prod;

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO biduser;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO biduser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO biduser;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO biduser;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO biduser;