# 🔧 DATABASE ISSUES & FIXES

**Status:** Analysis Complete | Ready for Implementation
**Priority:** 1 Critical + 3 Medium + 2 Low = 6 Total Issues

---

## ISSUE #1: ORPHANED MODEL ❌ (CRITICAL)

### Problem
Model exists but table is deleted from database.

```
File:      /backend/app/models/admin_settings.py
Table:     admin_settings (DELETED in migration 8ca7de033db9)
Usage:     GREP found 0 references in code
Status:    ❌ ORPHANED - Not used anywhere
```

### Impact
- Confusing for developers
- Import errors if used elsewhere
- Dead code in codebase

### Solution

**RECOMMENDED: Delete the model file**

```bash
# Step 1: Verify no usage
grep -r "admin_settings" /backend --include="*.py"
# Result: Only migration file references it

# Step 2: Check imports
grep -r "AdminSettings" /backend --include="*.py"
# Result: No imports found

# Step 3: Remove the file
rm /backend/app/models/admin_settings.py

# Step 4: Update __init__.py if it imports it
# Check: /backend/app/models/__init__.py
# Remove: AdminSettings from imports/exports
```

**Alternative: Keep if planning future feature**
If admin settings may be needed later, create a migration to RECREATE the table.

### Status
✅ Ready for deletion (no breaking changes)

---

## ISSUE #2: MISSING CASCADE CASCADES ⚠️ (MEDIUM)

### Problem
Foreign keys on reading_sessions don't cascade delete.

```sql
-- Current state (will FAIL on user/book deletion)
reading_sessions.user_id → users.id (NO CASCADE)
reading_sessions.book_id → books.id (NO CASCADE)
```

### Impact
**Scenario 1: Delete User**
```
DELETE FROM users WHERE id = 'xxx'
→ ERROR: foreign key violation
→ reading_sessions records prevent deletion
```

**Scenario 2: Delete Book**
```
DELETE FROM books WHERE id = 'yyy'
→ ERROR: foreign key violation
→ reading_sessions records prevent deletion
```

### Options

#### Option A: Add CASCADE (Recommended)
```sql
ALTER TABLE reading_sessions
DROP CONSTRAINT reading_sessions_user_id_fkey;
ALTER TABLE reading_sessions
ADD CONSTRAINT reading_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE reading_sessions
DROP CONSTRAINT reading_sessions_book_id_fkey;
ALTER TABLE reading_sessions
ADD CONSTRAINT reading_sessions_book_id_fkey
  FOREIGN KEY (book_id) REFERENCES books(id) ON DELETE CASCADE;
```

**Consequence:** Deleting user/book also deletes reading sessions
**Good for:** Simplicity, automatic cleanup

#### Option B: Add SET NULL
```sql
-- Same process but use ON DELETE SET NULL
-- Consequence: Keep history but orphaned records
-- Good for: Audit trails, analytics preservation
```

#### Option C: Keep as-is
**Consequence:** Explicit deletion needed
**Good for:** Preventing accidental deletions

### Solution (Migration)

**File:** `backend/alembic/versions/2025_11_03_xxxx_fix_reading_sessions_cascade.py`

```python
"""Fix reading_sessions cascade constraints."""

from alembic import op
import sqlalchemy as sa

revision = 'reading_sessions_cascade'
down_revision = 'enum_checks_2025'

def upgrade():
    # Drop existing constraints
    op.drop_constraint('reading_sessions_user_id_fkey', 'reading_sessions')
    op.drop_constraint('reading_sessions_book_id_fkey', 'reading_sessions')

    # Add new constraints with CASCADE
    op.create_foreign_key(
        'reading_sessions_user_id_fkey',
        'reading_sessions', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_foreign_key(
        'reading_sessions_book_id_fkey',
        'reading_sessions', 'books',
        ['book_id'], ['id'],
        ondelete='CASCADE'
    )

def downgrade():
    op.drop_constraint('reading_sessions_user_id_fkey', 'reading_sessions')
    op.drop_constraint('reading_sessions_book_id_fkey', 'reading_sessions')

    op.create_foreign_key(
        'reading_sessions_user_id_fkey',
        'reading_sessions', 'users',
        ['user_id'], ['id']
    )
    op.create_foreign_key(
        'reading_sessions_book_id_fkey',
        'reading_sessions', 'books',
        ['book_id'], ['id']
    )
```

### Implementation Steps
```bash
# 1. Decide on cascade policy (CASCADE vs SET NULL vs keep)
# 2. Create migration
alembic revision --message "Fix reading_sessions cascade"

# 3. Edit migration file (see above)

# 4. Test
docker-compose exec backend alembic upgrade head
docker-compose exec backend alembic downgrade -1
docker-compose exec backend alembic upgrade head

# 5. Verify constraints
psql -c "
SELECT constraint_name, delete_rule
FROM information_schema.referential_constraints
WHERE table_name = 'reading_sessions';"

# Expected output:
# reading_sessions_user_id_fkey | CASCADE
# reading_sessions_book_id_fkey | CASCADE
```

### Recommendation
✅ **ADD CASCADE** - Simplifies user/book deletion, matches pattern of other tables

---

## ISSUE #3: VARCHAR vs ENUM TYPE SAFETY ⚠️ (MEDIUM)

### Problem
Book and GeneratedImage use VARCHAR instead of PostgreSQL ENUM.

```python
# Model defines enums
class BookGenre(enum.Enum):
    FANTASY = "fantasy"
    DETECTIVE = "detective"
    # ... 9 values total

# But DB uses VARCHAR
books.genre → VARCHAR(50) (not ENUM)
books.file_format → VARCHAR(10) (not ENUM)
generated_images.service_used → VARCHAR(50) (not ENUM)
generated_images.status → VARCHAR(20) (not ENUM)
```

### Impact

**Negative:**
- ❌ No DB-level type enforcement
- ❌ Can insert invalid values via raw SQL
- ❌ More storage than ENUM (4 bytes)

**Positive:**
- ✅ Easier migrations (add new value without ALTER TYPE)
- ✅ Backward compatibility
- ✅ CHECK constraints provide validation
- ✅ Intentional architectural decision (Phase 3)

### Current Mitigation
✅ CHECK constraints validate values at DB level
✅ Python Enum provides application validation
✅ Type hints prevent invalid values in code

### Check Constraints in Place
```sql
✅ books.check_book_format
   CHECK (file_format IN ('epub', 'fb2'))

✅ books.check_book_genre
   CHECK (genre IN ('fantasy', 'detective', 'science_fiction', 'historical',
                    'romance', 'thriller', 'horror', 'classic', 'other'))

✅ generated_images.check_image_service
   CHECK (service_used IN ('pollinations', 'openai_dalle', 'midjourney', 'stable_diffusion'))

✅ generated_images.check_image_status
   CHECK (status IN ('pending', 'generating', 'completed', 'failed', 'moderated'))
```

### Options

#### Option A: Keep as-is (Current)
**Recommendation:** ✅ KEEP
- CHECK constraints enforce values
- Easier to add new values
- Matches Phase 3 architecture decision
- No migration cost

**Action:** Document as architectural decision

#### Option B: Migrate to PostgreSQL ENUM
```sql
-- Create enum type
CREATE TYPE book_genre AS ENUM ('fantasy', 'detective', ...);

-- Migrate data
ALTER TABLE books ALTER COLUMN genre TYPE book_genre USING genre::book_genre;

-- Drop CHECK constraint
ALTER TABLE books DROP CONSTRAINT check_book_genre;
```

**Cost:** Migration complexity, ALTER TYPE is expensive on large tables
**Benefit:** DB-level type safety

### Solution
✅ **KEEP VARCHAR with CHECK constraints**
- Document in database-schema.md
- Ensure CHECK constraints always enforced
- Monitor application validation

---

## ISSUE #4: READING SESSIONS HISTORY LOSS ⚠️ (MEDIUM)

### Problem
If CASCADE is added (Issue #2), deleting user/book also deletes all reading session history.

```
User deleted → ALL their reading sessions deleted
             → LOSS of reading analytics
             → LOSS of learning patterns
```

### Impact
- Lost historical data for analytics
- Can't compute long-term patterns
- No audit trail

### Alternative Solution
Instead of CASCADE, use **SET NULL**:

```sql
ALTER TABLE reading_sessions
ADD CONSTRAINT reading_sessions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL;
```

**Consequence:** Orphaned records (user_id = NULL) but data preserved

### Recommendation
**For Analytics Platform:** Use SET NULL
**For Simple App:** Use CASCADE

**Decision:** Depends on business requirements

```markdown
RECOMMEND: SET NULL
Reason: Preserve reading analytics even if user deleted
Result: Orphaned sessions but data preserved for insights
```

### Implementation
Modify migration from Issue #2:
```python
def upgrade():
    # ... drop constraints ...
    op.create_foreign_key(
        'reading_sessions_user_id_fkey',
        'reading_sessions', 'users',
        ['user_id'], ['id'],
        ondelete='SET NULL'  # ← Change to SET NULL
    )
```

---

## ISSUE #5: MISSING FULL-TEXT SEARCH INDEX ℹ️ (LOW)

### Problem
Book search uses basic index on title, not full-text search.

```sql
-- Current
ix_books_title → Simple BTREE index

-- Better for search
CREATE INDEX idx_books_title_fulltext
ON books USING gin(to_tsvector('russian', title));
```

### Impact
- 🔍 Search finds exact matches only
- 😞 Can't find "fantasy" when searching "fantasi"
- 📊 No ranking by relevance

### Solution
```sql
-- Russian language full-text search
CREATE INDEX idx_books_fulltext
ON books USING gin(
  to_tsvector('russian', title) ||
  to_tsvector('russian', COALESCE(author, ''))
);
```

### Implementation
```python
# Migration file
def upgrade():
    op.create_index(
        'idx_books_fulltext',
        'books',
        [sa.text("to_tsvector('russian', title) || to_tsvector('russian', COALESCE(author, ''))")],
        postgresql_using='gin'
    )

def downgrade():
    op.drop_index('idx_books_fulltext', table_name='books')
```

### Status
✅ Low priority, nice-to-have for future search feature

---

## ISSUE #6: NO JSONB VALIDATION ℹ️ (LOW)

### Problem
JSONB columns accept any JSON structure.

```python
# This is accepted (but may break code)
book.book_metadata = {"invalid": "structure"}

# Should validate schema like:
{
    "author": "string",
    "cover_url": "string",
    "total_pages": "integer"
}
```

### Solution
```python
# Add Pydantic schema validation in models
from pydantic import BaseModel

class BookMetadata(BaseModel):
    author: str
    cover_url: Optional[str] = None
    total_pages: int
    language: str = "ru"

# In Book model
def set_book_metadata(self, metadata: dict):
    """Validate and set metadata."""
    validated = BookMetadata(**metadata)
    self.book_metadata = validated.dict()
```

### Status
✅ Future enhancement, not critical now

---

## PRIORITY MATRIX

```
           Impact
           High │ Med │ Low
Priority   ─────┼─────┼─────
High       │ #1 │     │
           ├─────┼─────┼─────
Medium     │     │#2,3,4
           ├─────┼─────┼─────
Low        │     │     │#5,6

#1: ORPHANED MODEL - Delete admin_settings.py
#2: MISSING CASCADES - Add to reading_sessions
#3: VARCHAR vs ENUM - Keep as-is, document
#4: HISTORY LOSS - Use SET NULL instead of CASCADE
#5: FTS INDEX - Future feature
#6: JSONB SCHEMA - Future enhancement
```

---

## QUICK FIX CHECKLIST

### This Week
- [ ] Delete admin_settings.py model
- [ ] Document VARCHAR vs ENUM decision
- [ ] Verify CASCADE behavior requirement
- [ ] Create migration for reading_sessions FK

### Next Week
- [ ] Apply migration for reading_sessions CASCADE/SET NULL
- [ ] Test cascade behavior
- [ ] Update database-schema.md

### Next Month
- [ ] Implement full-text search index (if needed)
- [ ] Add JSONB schema validation (if needed)
- [ ] Performance monitoring

---

## VALIDATION AFTER FIXES

### Test Reading Sessions Cascade
```bash
# Create test data
docker-compose exec backend python -c "
from app.models import User, Book, ReadingSession
from app.core.database import AsyncSession
import asyncio

async def test():
    async with AsyncSession() as db:
        # Create test user and book
        user = User(email='test@example.com', password_hash='xxx')
        db.add(user)
        await db.commit()

        book = Book(user_id=user.id, title='Test', file_path='xxx')
        db.add(book)
        await db.commit()

        session = ReadingSession(user_id=user.id, book_id=book.id)
        db.add(session)
        await db.commit()

        # Delete user - should cascade if fixed
        await db.delete(user)
        await db.commit()

        # Verify reading_session is deleted
        result = await db.execute(
            select(ReadingSession).filter(ReadingSession.user_id == user.id)
        )
        assert result.scalars().first() is None
        print('✅ CASCADE working correctly')

asyncio.run(test())
"
```

### Verify Constraints
```sql
-- Check foreign key constraints
SELECT constraint_name, delete_rule
FROM information_schema.referential_constraints
WHERE table_name = 'reading_sessions'
ORDER BY constraint_name;

-- Expected:
-- reading_sessions_book_id_fkey | CASCADE
-- reading_sessions_user_id_fkey | CASCADE (or SET NULL)
```

### Verify Model Deletion
```bash
# Check admin_settings is deleted
ls -la /backend/app/models/admin_settings.py
# Should show: No such file or directory

# Check imports
grep -r "admin_settings" /backend --include="*.py"
# Should show: No results (except migrations)
```

---

## SUMMARY OF ACTIONS

| # | Issue | Severity | Action | Effort | Status |
|---|-------|----------|--------|--------|--------|
| 1 | Orphaned admin_settings | 🔴 CRITICAL | Delete model file | 5 min | Ready |
| 2 | Missing CASCADE FKs | 🟠 MEDIUM | Create migration | 30 min | Ready |
| 3 | VARCHAR vs ENUM | 🟠 MEDIUM | Document decision | 15 min | Ready |
| 4 | History loss on delete | 🟠 MEDIUM | Use SET NULL | 10 min | Ready |
| 5 | No FTS index | 🟡 LOW | Future feature | 1 hr | Scheduled |
| 6 | No JSONB validation | 🟡 LOW | Future enhancement | 2 hrs | Scheduled |

**Total Effort:** ~2 hours for immediate fixes + 3 hours for future enhancements

---

## NEXT STEPS

1. **Immediate (Today)**
   - Review this analysis with team
   - Decide on CASCADE vs SET NULL for reading_sessions

2. **This Sprint**
   - Delete admin_settings.py model
   - Create and test migration for reading_sessions FK
   - Update documentation

3. **Next Sprint**
   - Apply migration to production
   - Monitor for cascade behavior issues
   - Implement FTS if search feature planned

---

**Status:** ✅ Analysis Complete | Ready for Implementation
**Last Updated:** 2025-11-03
