-- ============================================================================
-- PostgreSQL Database Initialization Script
-- ============================================================================
-- Purpose: Setup extensions and initial configuration for BookReader AI
-- Target Database: bookreader
-- Last Updated: 2025-11-15
-- ============================================================================

-- Switch to the target database
\c bookreader

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- pg_stat_statements: Query performance monitoring
-- Provides detailed statistics about all SQL statements executed
-- Usage: SELECT query, calls, total_exec_time FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 10;
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- pg_trgm: Trigram matching for text search
-- Enables fast LIKE/ILIKE queries and similarity searches
-- Usage: CREATE INDEX idx_books_title_trgm ON books USING gin (title gin_trgm_ops);
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- btree_gin: GIN indexes for B-tree datatypes
-- Allows composite GIN indexes (better performance для multi-column searches)
-- Usage: CREATE INDEX idx_composite ON table USING gin (col1, col2);
CREATE EXTENSION IF NOT EXISTS btree_gin;

-- uuid-ossp: UUID generation functions
-- Required for generating UUIDs in database (if not using Python uuid4)
-- Usage: DEFAULT uuid_generate_v4()
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DATABASE SETTINGS
-- ============================================================================

-- Optimize для SSD storage (random page cost)
-- Default is 4.0 (HDD), 1.1 для SSD
ALTER DATABASE bookreader SET random_page_cost = 1.1;

-- Set default text search configuration для Russian language
-- Enables proper full-text search для Russian text
ALTER DATABASE bookreader SET default_text_search_config = 'pg_catalog.russian';

-- Set timezone to UTC for consistency
ALTER DATABASE bookreader SET timezone = 'UTC';

-- ============================================================================
-- MONITORING USER (read-only access for monitoring tools)
-- ============================================================================

-- Create monitoring user with read-only access to pg_stat views
-- This user can be used by monitoring tools (Prometheus, Grafana, etc.)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'monitoring') THEN
        CREATE USER monitoring WITH PASSWORD 'change_in_production_monitoring';
    END IF;
END
$$;

-- Grant pg_monitor role (built-in role for monitoring)
-- Provides access to pg_stat_* views and functions
GRANT pg_monitor TO monitoring;

-- Grant CONNECT privilege to database
GRANT CONNECT ON DATABASE bookreader TO monitoring;

-- Grant USAGE on public schema
GRANT USAGE ON SCHEMA public TO monitoring;

-- Grant SELECT on all future tables in public schema
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO monitoring;

-- ============================================================================
-- CUSTOM FUNCTIONS
-- ============================================================================

-- Function: Get database size in human-readable format
CREATE OR REPLACE FUNCTION public.get_database_size()
RETURNS TABLE (
    database_name TEXT,
    size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        datname::TEXT,
        pg_size_pretty(pg_database_size(datname))
    FROM pg_database
    WHERE datname = current_database();
END;
$$ LANGUAGE plpgsql;

-- Function: Get table sizes with indexes
CREATE OR REPLACE FUNCTION public.get_table_sizes()
RETURNS TABLE (
    schema_name TEXT,
    table_name TEXT,
    row_count BIGINT,
    total_size TEXT,
    table_size TEXT,
    indexes_size TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname::TEXT,
        tablename::TEXT,
        n_live_tup,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
        pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS indexes_size
    FROM pg_stat_user_tables
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
END;
$$ LANGUAGE plpgsql;

-- Function: Get slow queries (requires pg_stat_statements)
CREATE OR REPLACE FUNCTION public.get_slow_queries(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
    query TEXT,
    calls BIGINT,
    total_time_ms NUMERIC,
    mean_time_ms NUMERIC,
    max_time_ms NUMERIC,
    stddev_time_ms NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        LEFT(query, 200)::TEXT,
        calls,
        ROUND(total_exec_time::NUMERIC, 2) AS total_time_ms,
        ROUND(mean_exec_time::NUMERIC, 2) AS mean_time_ms,
        ROUND(max_exec_time::NUMERIC, 2) AS max_time_ms,
        ROUND(stddev_exec_time::NUMERIC, 2) AS stddev_time_ms
    FROM pg_stat_statements
    ORDER BY mean_exec_time DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Get active connections
CREATE OR REPLACE FUNCTION public.get_active_connections()
RETURNS TABLE (
    database_name TEXT,
    username TEXT,
    application_name TEXT,
    client_addr TEXT,
    state TEXT,
    query TEXT,
    duration INTERVAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        datname::TEXT,
        usename::TEXT,
        application_name::TEXT,
        client_addr::TEXT,
        state::TEXT,
        LEFT(query, 200)::TEXT,
        NOW() - query_start AS duration
    FROM pg_stat_activity
    WHERE datname = current_database()
      AND state != 'idle'
    ORDER BY query_start;
END;
$$ LANGUAGE plpgsql;

-- Function: Get table bloat estimate
CREATE OR REPLACE FUNCTION public.get_table_bloat()
RETURNS TABLE (
    schema_name TEXT,
    table_name TEXT,
    bloat_ratio NUMERIC,
    wasted_space TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        schemaname::TEXT,
        tablename::TEXT,
        ROUND(
            CASE
                WHEN pg_relation_size(schemaname||'.'||tablename) > 0
                THEN (pg_total_relation_size(schemaname||'.'||tablename)::NUMERIC / pg_relation_size(schemaname||'.'||tablename)) - 1
                ELSE 0
            END,
            2
        ) AS bloat_ratio,
        pg_size_pretty(
            pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)
        ) AS wasted_space
    FROM pg_stat_user_tables
    WHERE pg_relation_size(schemaname||'.'||tablename) > 0
    ORDER BY bloat_ratio DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANTS (for application users)
-- ============================================================================

-- Note: Application users will be created by SQLAlchemy/Alembic
-- These grants will be applied automatically when tables are created

-- Grant default privileges to future application users
-- This ensures new tables are accessible by the application
DO $$
BEGIN
    -- Grant privileges on all existing tables
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO ' || current_user;
    EXECUTE 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO ' || current_user;

    -- Grant privileges on future tables
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO ' || current_user;
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO ' || current_user;
END
$$;

-- ============================================================================
-- LOGGING AND NOTIFICATIONS
-- ============================================================================

-- Log successful initialization
DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'BookReader AI Database Initialization Complete';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Database: %', current_database();
    RAISE NOTICE 'Extensions: pg_stat_statements, pg_trgm, btree_gin, uuid-ossp';
    RAISE NOTICE 'Monitoring user: monitoring (password: change_in_production_monitoring)';
    RAISE NOTICE 'Custom functions: get_database_size(), get_table_sizes(), get_slow_queries()';
    RAISE NOTICE '                 get_active_connections(), get_table_bloat()';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Run Alembic migrations: alembic upgrade head';
    RAISE NOTICE '2. Change monitoring user password: ALTER USER monitoring PASSWORD ''new_password'';';
    RAISE NOTICE '3. Configure backups using scripts/backup-database.sh';
    RAISE NOTICE '4. Monitor performance with: SELECT * FROM get_slow_queries(10);';
    RAISE NOTICE '============================================================================';
END
$$;

-- ============================================================================
-- USEFUL MONITORING QUERIES (for reference)
-- ============================================================================

/*

-- 1. Database size
SELECT * FROM get_database_size();

-- 2. Table sizes with row counts
SELECT * FROM get_table_sizes();

-- 3. Top 10 slow queries
SELECT * FROM get_slow_queries(10);

-- 4. Active connections
SELECT * FROM get_active_connections();

-- 5. Table bloat estimate
SELECT * FROM get_table_bloat();

-- 6. Current connection count
SELECT count(*) as total_connections, state
FROM pg_stat_activity
WHERE datname = 'bookreader'
GROUP BY state;

-- 7. Cache hit ratio (should be >99% for good performance)
SELECT
    sum(heap_blks_read) as heap_read,
    sum(heap_blks_hit)  as heap_hit,
    ROUND(sum(heap_blks_hit)::NUMERIC / nullif(sum(heap_blks_hit) + sum(heap_blks_read), 0) * 100, 2) as cache_hit_ratio
FROM pg_statio_user_tables;

-- 8. Locks waiting
SELECT
    locktype,
    relation::regclass,
    mode,
    pid,
    granted
FROM pg_locks
WHERE NOT granted;

-- 9. Long-running queries (>1 second)
SELECT
    pid,
    now() - query_start as duration,
    state,
    LEFT(query, 100) as query
FROM pg_stat_activity
WHERE state != 'idle'
  AND now() - query_start > interval '1 second'
ORDER BY duration DESC;

-- 10. Index usage statistics
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan ASC, pg_relation_size(indexrelid) DESC;

*/
