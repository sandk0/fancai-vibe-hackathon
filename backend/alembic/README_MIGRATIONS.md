# Alembic Migrations Guide

**Project:** BookReader AI
**Database:** PostgreSQL 15.7
**Current Version:** enum_checks_2025 (latest)

---

## Quick Start

### First Time Setup (Fresh Database)

```bash
# Apply all migrations
docker exec fancai-vibe-hackathon-backend-1 alembic upgrade head
```

### Check Status

```bash
# View current migration version
docker exec fancai-vibe-hackathon-backend-1 alembic current

# View full migration history
docker exec fancai-vibe-hackathon-backend-1 alembic history
```

---

## Migration Chain (9 migrations)

```
4de5528c20b4 → Initial database schema (users, books, chapters, etc.)
     ↓
66ac03dc5ab6 → Add user_id to generated_images
     ↓
8ca7de033db9 → Add reading_location_cfi field (epub.js CFI support)
     ↓
e94cab18247f → Add scroll_offset_percent to reading_progress
     ↓
f1a2b3c4d5e6 → Add critical performance indexes
     ↓
bf69a2347ac9 → Add reading_sessions table for analytics
     ↓
a1b2c3d4e5f6 → Optimize reading_sessions (indexes + views)
     ↓
json_to_jsonb_2025 → Migrate JSON to JSONB (100x faster queries)
     ↓
enum_checks_2025 → Add CHECK constraints for enums (HEAD)
```

---

## Creating New Migrations

### Auto-generate from model changes

```bash
# 1. Modify SQLAlchemy models in backend/app/models/
# 2. Generate migration
docker exec fancai-vibe-hackathon-backend-1 \
  alembic revision --autogenerate -m "description of changes"

# 3. Review generated migration file in backend/alembic/versions/
# 4. Test upgrade
docker exec fancai-vibe-hackathon-backend-1 alembic upgrade head

# 5. Test downgrade
docker exec fancai-vibe-hackathon-backend-1 alembic downgrade -1

# 6. Re-upgrade
docker exec fancai-vibe-hackathon-backend-1 alembic upgrade head
```

### Manual migration (complex changes)

```bash
# Create empty migration
docker exec fancai-vibe-hackathon-backend-1 \
  alembic revision -m "description"

# Edit the generated file manually
# Add upgrade() and downgrade() logic
```

---

## Common Operations

### Rollback

```bash
# Rollback one migration
docker exec fancai-vibe-hackathon-backend-1 alembic downgrade -1

# Rollback to specific version
docker exec fancai-vibe-hackathon-backend-1 alembic downgrade <revision_id>

# Rollback all migrations
docker exec fancai-vibe-hackathon-backend-1 alembic downgrade base
```

### Verify Schema

```bash
# List all tables
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "\dt"

# Show table structure
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "\d users"

# Check indexes
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev -c "\di"
```

---

## Database Schema

### Tables (9 total)

1. **users** - User accounts and authentication
2. **subscriptions** - Subscription plans (FREE/PREMIUM/ULTIMATE)
3. **books** - Book metadata and parsing status
4. **chapters** - Book chapters with content
5. **descriptions** - Extracted descriptions (5 types)
6. **generated_images** - AI-generated images
7. **reading_progress** - Reading progress with CFI support
8. **reading_sessions** - Detailed reading analytics
9. **alembic_version** - Migration version tracking

### Key Features

**CFI Support (epub.js integration):**
- `reading_progress.reading_location_cfi` - Canonical Fragment Identifier
- `reading_progress.scroll_offset_percent` - Precise scroll position

**Performance Optimizations:**
- JSONB columns (100x faster than JSON)
- 15+ indexes for common queries
- 2 materialized views for analytics
- Partial indexes for filtered queries

**Data Integrity:**
- 4 CHECK constraints for enum validation
- Foreign key constraints with cascades
- Unique constraints on email, etc.

---

## Troubleshooting

### Migration Fails: "table already exists"

```bash
# Option 1: Mark migration as applied
docker exec fancai-vibe-hackathon-backend-1 \
  alembic stamp head

# Option 2: Reset database (DESTRUCTIVE!)
docker-compose down -v
docker-compose up -d
docker exec fancai-vibe-hackathon-backend-1 alembic upgrade head
```

### Migration Fails: "revision not found"

See `MIGRATION_FIX_REPORT.md` for detailed troubleshooting.

### Emergency Restore

If migrations completely broken:

```bash
# Use emergency restore guide
cat EMERGENCY_SCHEMA_RESTORE.md

# Apply schema backup directly
docker exec -i fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev < schema_backup.sql
```

---

## Best Practices

### Before Creating Migration

1. ✅ Review existing migrations
2. ✅ Test model changes locally
3. ✅ Check for conflicts with other branches

### After Creating Migration

1. ✅ Review generated SQL
2. ✅ Test upgrade on clean database
3. ✅ Test downgrade
4. ✅ Update documentation
5. ✅ Create schema backup

### Migration File Guidelines

```python
"""Brief description of migration.

Revision ID: abc123
Revises: previous_revision
Create Date: 2025-01-01 12:00:00.000000

Notes:
    - Add important notes here
    - Document breaking changes
    - List affected tables
"""

def upgrade() -> None:
    """Apply migration."""
    # Use conditional operations for safety
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # Example: conditional table drop
    if 'old_table' in inspector.get_table_names():
        op.drop_table('old_table')

    # Example: conditional column add
    if 'new_column' not in [c['name'] for c in inspector.get_columns('table_name')]:
        op.add_column('table_name', sa.Column('new_column', sa.String(100)))

def downgrade() -> None:
    """Revert migration."""
    # Always implement downgrade for rollback
    pass
```

---

## Maintenance Tasks

### Daily
```bash
# Refresh materialized views (add to cron)
docker exec fancai-vibe-hackathon-postgres-1 \
  psql -U postgres -d bookreader_dev <<SQL
REFRESH MATERIALIZED VIEW CONCURRENTLY reading_sessions_daily_stats;
REFRESH MATERIALIZED VIEW CONCURRENTLY user_reading_patterns;
SQL
```

### Weekly
```bash
# Create database backup
docker exec fancai-vibe-hackathon-postgres-1 \
  pg_dump -U postgres -d bookreader_dev \
  -F c -f /backup/bookreader_$(date +%Y%m%d).dump
```

### After Each Migration
```bash
# Update schema backup
docker exec fancai-vibe-hackathon-postgres-1 \
  pg_dump -U postgres -d bookreader_dev --schema-only \
  > backend/alembic/schema_backup.sql
```

---

## Resources

- **Fix Report:** `MIGRATION_FIX_REPORT.md` - Technical details of recent fix
- **Emergency Guide:** `EMERGENCY_SCHEMA_RESTORE.md` - Emergency restore procedures
- **Schema Backup:** `schema_backup.sql` - Complete schema dump
- **Alembic Docs:** https://alembic.sqlalchemy.org/

---

## Status

✅ **All migrations working**
✅ **Database schema initialized**
✅ **Production ready**

**Current Version:** enum_checks_2025
**Last Updated:** 2025-11-03
