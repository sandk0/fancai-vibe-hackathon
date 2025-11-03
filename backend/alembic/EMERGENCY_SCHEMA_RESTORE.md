# Emergency Schema Restore Guide

**Purpose:** Direct SQL schema creation if Alembic migrations fail
**Last Updated:** 2025-11-03
**Schema Version:** enum_checks_2025 (latest)

---

## When to Use This Guide

Use this emergency restore **ONLY IF:**
- ❌ Alembic migrations completely broken
- ❌ Migration chain cannot be repaired
- ❌ Need immediate database setup for production
- ❌ Corrupted alembic_version table

**⚠️ WARNING:** This bypasses Alembic version tracking. Use as last resort!

---

## Quick Restore (Recommended Method)

### Method 1: Use Schema Backup SQL

```bash
# 1. Drop existing database (DESTRUCTIVE!)
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -c "DROP DATABASE IF EXISTS bookreader_dev;"

# 2. Create fresh database
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -c "CREATE DATABASE bookreader_dev;"

# 3. Enable required extensions
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "CREATE EXTENSION IF NOT EXISTS \"uuid-ossp\";"
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"

# 4. Restore schema from backup
docker exec -i fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev < /app/alembic/schema_backup.sql

# 5. Set Alembic version to HEAD
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev \
  -c "INSERT INTO alembic_version (version_num) VALUES ('enum_checks_2025');"
```

### Method 2: Use Alembic (After Fix)

```bash
# After fixing migration chain (as done in this fix)
docker exec fancai-vibe-hackathon-backend-1 alembic upgrade head
```

---

## Manual Schema Creation

If `schema_backup.sql` is unavailable, create schema manually:

### Step 1: Extensions

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Step 2: Enums

```sql
-- Description Types
CREATE TYPE descriptiontype AS ENUM (
    'LOCATION',
    'CHARACTER',
    'ATMOSPHERE',
    'OBJECT',
    'ACTION'
);

-- Subscription Plans
CREATE TYPE subscriptionplan AS ENUM (
    'FREE',
    'PREMIUM',
    'ULTIMATE'
);

-- Subscription Status
CREATE TYPE subscriptionstatus AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'CANCELLED',
    'PENDING'
);
```

### Step 3: Core Tables

```sql
-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_verified BOOLEAN NOT NULL DEFAULT false,
    is_admin BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX ix_users_id ON users(id);
CREATE UNIQUE INDEX ix_users_email ON users(email);

-- Books
CREATE TABLE books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    title VARCHAR(500) NOT NULL,
    author VARCHAR(255),
    genre VARCHAR(50) NOT NULL,
    language VARCHAR(10) NOT NULL,
    file_path VARCHAR(1000) NOT NULL,
    file_format VARCHAR(10) NOT NULL,
    file_size INTEGER NOT NULL,
    cover_image VARCHAR(1000),
    description TEXT,
    total_pages INTEGER NOT NULL,
    estimated_reading_time INTEGER NOT NULL,
    is_parsed BOOLEAN NOT NULL DEFAULT false,
    parsing_progress INTEGER NOT NULL DEFAULT 0,
    parsing_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_accessed TIMESTAMPTZ,
    book_metadata JSONB
);

-- Books Indexes
CREATE INDEX ix_books_id ON books(id);
CREATE INDEX ix_books_user_id ON books(user_id);
CREATE INDEX ix_books_title ON books(title);
CREATE INDEX ix_books_author ON books(author);
CREATE INDEX idx_books_user_created ON books(user_id, created_at);
CREATE INDEX idx_books_user_unparsed ON books(user_id, is_parsed) WHERE is_parsed = false;
CREATE INDEX idx_books_metadata_gin ON books USING gin(book_metadata);

-- Books CHECK Constraints
ALTER TABLE books ADD CONSTRAINT check_book_genre
    CHECK (genre IN ('fantasy', 'detective', 'science_fiction', 'historical',
                     'romance', 'thriller', 'horror', 'classic', 'other'));

ALTER TABLE books ADD CONSTRAINT check_book_format
    CHECK (file_format IN ('epub', 'fb2'));

-- Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    plan subscriptionplan NOT NULL,
    status subscriptionstatus NOT NULL,
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ,
    auto_renew BOOLEAN NOT NULL DEFAULT true,
    payment_method VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_subscriptions_id ON subscriptions(id);
CREATE INDEX ix_subscriptions_user_id ON subscriptions(user_id);

-- Chapters
CREATE TABLE chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id),
    chapter_number INTEGER NOT NULL,
    title VARCHAR(500),
    content TEXT NOT NULL,
    word_count INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_chapters_id ON chapters(id);
CREATE INDEX ix_chapters_book_id ON chapters(book_id);
CREATE INDEX idx_chapters_book_number ON chapters(book_id, chapter_number);

-- Descriptions
CREATE TABLE descriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapters(id),
    description_type descriptiontype NOT NULL,
    original_text TEXT NOT NULL,
    processed_prompt TEXT,
    position_in_chapter INTEGER NOT NULL,
    context_before TEXT,
    context_after TEXT,
    confidence_score DOUBLE PRECISION NOT NULL,
    metadata JSONB,
    is_approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_descriptions_id ON descriptions(id);
CREATE INDEX ix_descriptions_chapter_id ON descriptions(chapter_id);
CREATE INDEX idx_descriptions_type ON descriptions(description_type);
CREATE INDEX idx_descriptions_confidence ON descriptions(confidence_score);

-- Generated Images
CREATE TABLE generated_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    description_id UUID NOT NULL REFERENCES descriptions(id),
    user_id UUID NOT NULL REFERENCES users(id),
    service_used VARCHAR(50) NOT NULL,
    image_url VARCHAR(1000),
    local_path VARCHAR(1000),
    prompt_used TEXT NOT NULL,
    generation_parameters JSONB,
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    moderation_result JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    generated_at TIMESTAMPTZ
);

CREATE INDEX ix_generated_images_id ON generated_images(id);
CREATE INDEX ix_generated_images_description_id ON generated_images(description_id);
CREATE INDEX ix_generated_images_user_id ON generated_images(user_id);
CREATE INDEX idx_generated_images_status ON generated_images(status);
CREATE INDEX idx_generated_images_service ON generated_images(service_used);

-- Generated Images CHECK Constraints
ALTER TABLE generated_images ADD CONSTRAINT check_image_service
    CHECK (service_used IN ('pollinations', 'openai_dalle', 'midjourney', 'stable_diffusion'));

ALTER TABLE generated_images ADD CONSTRAINT check_image_status
    CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'moderated'));

-- Reading Progress
CREATE TABLE reading_progress (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id),
    book_id UUID NOT NULL REFERENCES books(id),
    current_chapter INTEGER NOT NULL,
    current_page INTEGER NOT NULL,
    current_position INTEGER NOT NULL,
    reading_time_minutes INTEGER NOT NULL DEFAULT 0,
    reading_speed_wpm DOUBLE PRECISION NOT NULL DEFAULT 200.0,
    reading_location_cfi VARCHAR(500),
    scroll_offset_percent DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_read_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_reading_progress_id ON reading_progress(id);
CREATE INDEX ix_reading_progress_user_id ON reading_progress(user_id);
CREATE INDEX ix_reading_progress_book_id ON reading_progress(book_id);
CREATE INDEX idx_reading_progress_user_book ON reading_progress(user_id, book_id);
CREATE INDEX idx_reading_progress_last_read ON reading_progress(user_id, last_read_at);

-- Reading Sessions
CREATE TABLE reading_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    duration_seconds INTEGER,
    start_chapter INTEGER NOT NULL,
    end_chapter INTEGER,
    start_position INTEGER NOT NULL,
    end_position INTEGER,
    pages_read INTEGER,
    words_read INTEGER,
    average_wpm DOUBLE PRECISION,
    device_type VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_reading_sessions_id ON reading_sessions(id);
CREATE INDEX ix_reading_sessions_user_id ON reading_sessions(user_id);
CREATE INDEX ix_reading_sessions_book_id ON reading_sessions(book_id);
CREATE INDEX idx_reading_sessions_user_time ON reading_sessions(user_id, start_time);
CREATE INDEX idx_reading_sessions_book_time ON reading_sessions(book_id, start_time);
CREATE INDEX idx_reading_sessions_duration ON reading_sessions(duration_seconds) WHERE duration_seconds IS NOT NULL;
```

### Step 4: Materialized Views

```sql
-- Daily Reading Statistics
CREATE MATERIALIZED VIEW reading_sessions_daily_stats AS
SELECT
    DATE(start_time) as reading_date,
    user_id,
    COUNT(*) as sessions_count,
    SUM(duration_seconds) as total_duration_seconds,
    SUM(pages_read) as total_pages_read,
    SUM(words_read) as total_words_read,
    AVG(average_wpm) as avg_reading_speed_wpm
FROM reading_sessions
WHERE duration_seconds IS NOT NULL
GROUP BY DATE(start_time), user_id;

CREATE INDEX idx_daily_stats_user_date ON reading_sessions_daily_stats(user_id, reading_date);

-- User Reading Patterns
CREATE MATERIALIZED VIEW user_reading_patterns AS
SELECT
    user_id,
    COUNT(DISTINCT book_id) as unique_books_read,
    AVG(duration_seconds) as avg_session_duration,
    MAX(duration_seconds) as max_session_duration,
    SUM(pages_read) as total_pages_read,
    AVG(average_wpm) as avg_reading_speed
FROM reading_sessions
WHERE duration_seconds IS NOT NULL
GROUP BY user_id;

CREATE INDEX idx_patterns_user ON user_reading_patterns(user_id);
```

### Step 5: Alembic Version Tracking

```sql
-- Create Alembic version table
CREATE TABLE alembic_version (
    version_num VARCHAR(32) NOT NULL PRIMARY KEY
);

-- Set to latest version
INSERT INTO alembic_version (version_num) VALUES ('enum_checks_2025');
```

---

## Verification Checklist

After schema creation, verify:

```bash
# 1. Check all tables exist
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "\dt"

# Expected output: 9 tables
# ✅ alembic_version
# ✅ users
# ✅ subscriptions
# ✅ books
# ✅ chapters
# ✅ descriptions
# ✅ generated_images
# ✅ reading_progress
# ✅ reading_sessions

# 2. Check indexes
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "\di"

# 3. Check constraints
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "
SELECT
    conname,
    contype,
    conrelid::regclass AS table_name
FROM pg_constraint
WHERE contype = 'c'
ORDER BY conrelid::regclass::text;
"

# Expected: 4 CHECK constraints
# ✅ check_book_genre
# ✅ check_book_format
# ✅ check_image_service
# ✅ check_image_status

# 4. Check Alembic version
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "SELECT * FROM alembic_version;"

# Expected: version_num = 'enum_checks_2025'
```

---

## Troubleshooting

### Problem: Extensions Missing

```bash
# Install PostgreSQL extensions
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev <<SQL
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;
SQL
```

### Problem: Permission Denied

```bash
# Grant permissions to application user
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
"
```

### Problem: Alembic Still Broken

```bash
# Completely reset Alembic tracking
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev <<SQL
DELETE FROM alembic_version;
INSERT INTO alembic_version (version_num) VALUES ('enum_checks_2025');
SQL
```

---

## Maintenance

### Refresh Materialized Views

Set up cron job to refresh views daily:

```sql
-- Refresh reading statistics (run daily at 00:00)
REFRESH MATERIALIZED VIEW CONCURRENTLY reading_sessions_daily_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_reading_patterns;
```

### Create Backup

```bash
# Full database backup
docker exec fancai-vibe-hackathon-postgres-1 \
  pg_dump -U postgres -d bookreader_dev -F c -f /backup/bookreader_$(date +%Y%m%d).dump

# Schema-only backup
docker exec fancai-vibe-hackathon-postgres-1 \
  pg_dump -U postgres -d bookreader_dev --schema-only > schema_$(date +%Y%m%d).sql
```

---

## Return to Normal Alembic Workflow

After emergency restore:

```bash
# 1. Verify Alembic version matches schema
docker exec fancai-vibe-hackathon-backend-1 alembic current

# Should show: enum_checks_2025 (head)

# 2. Future migrations work normally
docker exec fancai-vibe-hackathon-backend-1 alembic upgrade head
```

---

## File Locations

- **Schema Backup:** `/Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/alembic/schema_backup.sql`
- **Migration Files:** `/Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/alembic/versions/`
- **This Guide:** `/Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend/alembic/EMERGENCY_SCHEMA_RESTORE.md`

---

## Prevention

To avoid needing emergency restore:

1. ✅ **Test migrations on clean DB** before committing
2. ✅ **Keep schema_backup.sql updated** after each migration
3. ✅ **Use version control** for migration files
4. ✅ **Document breaking changes** in migration docstrings
5. ✅ **Regular database backups** (automated)

---

**Status:** TESTED ✅
**Last Verified:** 2025-11-03
**Database Version:** PostgreSQL 15.7
**Schema Version:** enum_checks_2025
