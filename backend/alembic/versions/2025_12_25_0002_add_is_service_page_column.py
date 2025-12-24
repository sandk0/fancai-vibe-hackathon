"""Add is_service_page column to chapters table.

Revision ID: 2025_12_25_0002
Revises: 2025_12_25_0001
Create Date: 2025-12-25

P1.1 Optimization: Cache service page detection result.
Previously: SERVICE_PAGE_KEYWORDS check on every request.
Now: One-time check, cached in database.

Expected improvement: -5ms per chapter request.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2025_12_25_0002"
down_revision = "2025_12_25_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add is_service_page column."""
    op.add_column(
        "chapters",
        sa.Column("is_service_page", sa.Boolean(), nullable=True, default=None),
    )

    # Optionally pre-compute for existing chapters (data migration)
    # This updates all existing chapters based on word_count heuristic
    # (chapters with <100 words are likely service pages)
    op.execute("""
        UPDATE chapters
        SET is_service_page = CASE
            WHEN word_count < 100 THEN true
            ELSE NULL  -- Will be computed on first access
        END
        WHERE is_service_page IS NULL
    """)


def downgrade() -> None:
    """Remove is_service_page column."""
    op.drop_column("chapters", "is_service_page")
