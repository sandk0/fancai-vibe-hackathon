"""Add composite unique index on reading_progress (user_id, book_id).

Revision ID: 2025_12_28_0001
Revises: 2025_12_25_0002
Create Date: 2025-12-28

Performance optimization: Composite index for N+1 query prevention.
This index optimizes the common query pattern: find reading progress for a user and book.

Benefits:
- Faster lookups when checking user's progress for a specific book
- Enforces uniqueness: one progress record per user per book
- Supports efficient JOINs with eager loading

Expected improvement: -10-20ms on book list queries with progress.
"""

from alembic import op


# revision identifiers, used by Alembic.
revision = "2025_12_28_0001"
down_revision = "2025_12_25_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add composite unique index on reading_progress (user_id, book_id)."""
    # Create unique composite index for efficient lookups and constraint
    op.create_index(
        "idx_reading_progress_user_book",
        "reading_progress",
        ["user_id", "book_id"],
        unique=True,
    )


def downgrade() -> None:
    """Remove composite index."""
    op.drop_index("idx_reading_progress_user_book", table_name="reading_progress")
