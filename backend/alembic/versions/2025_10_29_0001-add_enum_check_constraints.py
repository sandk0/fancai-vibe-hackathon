"""add CHECK constraints for enum validation

Revision ID: enum_checks_2025
Revises: json_to_jsonb_2025
Create Date: 2025-10-29 00:01:00.000000

Changes:
- Add CHECK constraint for books.genre (validates BookGenre enum values)
- Add CHECK constraint for books.file_format (validates BookFormat enum values)
- Add CHECK constraint for generated_images.service_used (validates ImageService enum values)
- Add CHECK constraint for generated_images.status (validates ImageStatus enum values)

Purpose:
- Data integrity at database level (prevents invalid enum values)
- Catches programming errors early
- Documents valid values in database schema
- Complements SQLAlchemy enum validation

Note: SQLAlchemy defines enums in Python, but columns use String type.
These constraints enforce validation at the database level.
"""

from alembic import op
import sqlalchemy as sa

# Revision identifiers, used by Alembic.
revision = 'enum_checks_2025'
down_revision = 'json_to_jsonb_2025'
branch_labels = None
depends_on = None


def upgrade():
    """
    Add CHECK constraints for enum columns.

    These constraints ensure that only valid enum values can be stored
    in the database, providing an additional layer of data integrity
    beyond SQLAlchemy's Python-level validation.

    Benefits:
    - Prevents invalid data from external sources (direct DB access, migrations, etc.)
    - Self-documenting schema (shows valid values in DB)
    - Catches bugs early (at INSERT/UPDATE time)
    - Database-level validation (language-agnostic)
    """

    print("\n" + "="*70)
    print("🔒 Adding CHECK Constraints for Enum Validation")
    print("="*70 + "\n")

    # ========================================================================
    # CONSTRAINT 1: books.genre
    # ========================================================================

    print("📚 Step 1/4: Adding CHECK constraint for books.genre...")

    op.execute("""
        ALTER TABLE books
        ADD CONSTRAINT check_book_genre
        CHECK (
            genre IN (
                'fantasy',           -- BookGenre.FANTASY
                'detective',         -- BookGenre.DETECTIVE
                'science_fiction',   -- BookGenre.SCIFI
                'historical',        -- BookGenre.HISTORICAL
                'romance',           -- BookGenre.ROMANCE
                'thriller',          -- BookGenre.THRILLER
                'horror',            -- BookGenre.HORROR
                'classic',           -- BookGenre.CLASSIC
                'other'              -- BookGenre.OTHER
            )
        )
    """)

    print("   ✅ books.genre CHECK constraint added")
    print("   📋 Valid values: fantasy, detective, science_fiction, historical,")
    print("                    romance, thriller, horror, classic, other\n")

    # ========================================================================
    # CONSTRAINT 2: books.file_format
    # ========================================================================

    print("📄 Step 2/4: Adding CHECK constraint for books.file_format...")

    op.execute("""
        ALTER TABLE books
        ADD CONSTRAINT check_book_format
        CHECK (
            file_format IN (
                'epub',  -- BookFormat.EPUB
                'fb2'    -- BookFormat.FB2
            )
        )
    """)

    print("   ✅ books.file_format CHECK constraint added")
    print("   📋 Valid values: epub, fb2\n")

    # ========================================================================
    # CONSTRAINT 3: generated_images.service_used
    # ========================================================================

    print("🎨 Step 3/4: Adding CHECK constraint for generated_images.service_used...")

    op.execute("""
        ALTER TABLE generated_images
        ADD CONSTRAINT check_image_service
        CHECK (
            service_used IN (
                'pollinations',      -- ImageService.POLLINATIONS
                'openai_dalle',      -- ImageService.OPENAI_DALLE
                'midjourney',        -- ImageService.MIDJOURNEY
                'stable_diffusion'   -- ImageService.STABLE_DIFFUSION
            )
        )
    """)

    print("   ✅ generated_images.service_used CHECK constraint added")
    print("   📋 Valid values: pollinations, openai_dalle, midjourney, stable_diffusion\n")

    # ========================================================================
    # CONSTRAINT 4: generated_images.status
    # ========================================================================

    print("📊 Step 4/4: Adding CHECK constraint for generated_images.status...")

    op.execute("""
        ALTER TABLE generated_images
        ADD CONSTRAINT check_image_status
        CHECK (
            status IN (
                'pending',      -- ImageStatus.PENDING
                'generating',   -- ImageStatus.GENERATING
                'completed',    -- ImageStatus.COMPLETED
                'failed',       -- ImageStatus.FAILED
                'moderated'     -- ImageStatus.MODERATED
            )
        )
    """)

    print("   ✅ generated_images.status CHECK constraint added")
    print("   📋 Valid values: pending, generating, completed, failed, moderated\n")

    # ========================================================================
    # VERIFICATION
    # ========================================================================

    print("🔍 Verifying existing data against new constraints...")

    # Verify books.genre
    op.execute("""
        DO $$
        DECLARE
            invalid_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO invalid_count
            FROM books
            WHERE genre NOT IN (
                'fantasy', 'detective', 'science_fiction', 'historical',
                'romance', 'thriller', 'horror', 'classic', 'other'
            );

            IF invalid_count > 0 THEN
                RAISE WARNING 'Found % books with invalid genre values', invalid_count;
            ELSE
                RAISE NOTICE 'All book genres are valid ✓';
            END IF;
        END $$;
    """)

    # Verify books.file_format
    op.execute("""
        DO $$
        DECLARE
            invalid_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO invalid_count
            FROM books
            WHERE file_format NOT IN ('epub', 'fb2');

            IF invalid_count > 0 THEN
                RAISE WARNING 'Found % books with invalid file_format values', invalid_count;
            ELSE
                RAISE NOTICE 'All book file_formats are valid ✓';
            END IF;
        END $$;
    """)

    # Verify generated_images.service_used
    op.execute("""
        DO $$
        DECLARE
            invalid_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO invalid_count
            FROM generated_images
            WHERE service_used NOT IN (
                'pollinations', 'openai_dalle', 'midjourney', 'stable_diffusion'
            );

            IF invalid_count > 0 THEN
                RAISE WARNING 'Found % images with invalid service_used values', invalid_count;
            ELSE
                RAISE NOTICE 'All image service_used values are valid ✓';
            END IF;
        END $$;
    """)

    # Verify generated_images.status
    op.execute("""
        DO $$
        DECLARE
            invalid_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO invalid_count
            FROM generated_images
            WHERE status NOT IN ('pending', 'generating', 'completed', 'failed', 'moderated');

            IF invalid_count > 0 THEN
                RAISE WARNING 'Found % images with invalid status values', invalid_count;
            ELSE
                RAISE NOTICE 'All image status values are valid ✓';
            END IF;
        END $$;
    """)

    # ========================================================================
    # COMPLETION
    # ========================================================================

    print("\n" + "="*70)
    print("✅ All CHECK Constraints Added Successfully!")
    print("="*70)
    print("\n📊 Summary:")
    print("   - 4 CHECK constraints created")
    print("   - books.genre (9 valid values)")
    print("   - books.file_format (2 valid values)")
    print("   - generated_images.service_used (4 valid values)")
    print("   - generated_images.status (5 valid values)")
    print("\n💡 Benefits:")
    print("   - Invalid enum values rejected at database level")
    print("   - Self-documenting schema")
    print("   - Catches bugs early")
    print("   - Data integrity guaranteed")
    print("\n⚠️  Note: If you add new enum values in Python code,")
    print("   remember to update these constraints in a new migration!")
    print("="*70 + "\n")


def downgrade():
    """
    Remove CHECK constraints.

    Warning: Removing these constraints removes database-level validation.
    Only recommended if you're certain you don't need this protection.
    """

    print("\n" + "="*70)
    print("⚠️  Removing CHECK Constraints")
    print("="*70 + "\n")

    # Drop constraints in reverse order
    print("🗑️  Dropping CHECK constraints...")

    op.execute("ALTER TABLE generated_images DROP CONSTRAINT IF EXISTS check_image_status")
    print("   ✓ check_image_status dropped")

    op.execute("ALTER TABLE generated_images DROP CONSTRAINT IF EXISTS check_image_service")
    print("   ✓ check_image_service dropped")

    op.execute("ALTER TABLE books DROP CONSTRAINT IF EXISTS check_book_format")
    print("   ✓ check_book_format dropped")

    op.execute("ALTER TABLE books DROP CONSTRAINT IF EXISTS check_book_genre")
    print("   ✓ check_book_genre dropped")

    print("\n" + "="*70)
    print("✅ All CHECK Constraints Removed")
    print("="*70)
    print("\n⚠️  WARNING: Database-level enum validation is now disabled.")
    print("   Consider re-applying these constraints for data integrity.")
    print("="*70 + "\n")
