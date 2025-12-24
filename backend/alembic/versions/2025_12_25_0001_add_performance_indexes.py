"""Add performance indexes for reader cycle optimization.

Revision ID: 2025_12_25_0001
Revises: 2025_12_20_0001_add_is_processing_column
Create Date: 2025-12-25

P0 Performance Optimization:
- Composite index on chapters (book_id, chapter_number) for efficient chapter lookup
- Composite index on reading_progress (user_id, book_id) for progress retrieval
- Index on descriptions (chapter_id, position_in_chapter) for ordered retrieval

Expected improvements:
- Chapter lookup: O(n) -> O(log n)
- Progress retrieval: faster JOIN elimination
- Description ordering: eliminate sort operation
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2025_12_25_0001"
down_revision = "2025_12_20_0001_add_is_processing_column"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add composite indexes for performance optimization."""

    # 1. Composite unique index on chapters (book_id, chapter_number)
    # Optimizes: WHERE book_id = X AND chapter_number = Y queries
    # Also enforces uniqueness constraint
    op.create_index(
        "idx_chapters_book_chapter_unique",
        "chapters",
        ["book_id", "chapter_number"],
        unique=True,
    )

    # 2. Composite index on reading_progress (user_id, book_id)
    # Optimizes: User's progress for a specific book lookup
    op.create_index(
        "idx_reading_progress_user_book",
        "reading_progress",
        ["user_id", "book_id"],
        unique=True,  # Each user has one progress record per book
    )

    # 3. Composite index on descriptions (chapter_id, position_in_chapter)
    # Optimizes: SELECT * FROM descriptions WHERE chapter_id = X ORDER BY position_in_chapter
    op.create_index(
        "idx_descriptions_chapter_position",
        "descriptions",
        ["chapter_id", "position_in_chapter"],
    )

    # 4. Index on descriptions chapter_id for IN queries (batch loading)
    # Already exists as individual index, but verify
    # No action needed - already covered

    # 5. Partial index on chapters for parsed chapters only
    # Optimizes: queries that filter on is_description_parsed = true
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_chapters_parsed
        ON chapters (book_id, chapter_number)
        WHERE is_description_parsed = true
    """)


def downgrade() -> None:
    """Remove composite indexes."""

    op.execute("DROP INDEX IF EXISTS idx_chapters_parsed")
    op.drop_index("idx_descriptions_chapter_position", table_name="descriptions")
    op.drop_index("idx_reading_progress_user_book", table_name="reading_progress")
    op.drop_index("idx_chapters_book_chapter_unique", table_name="chapters")
