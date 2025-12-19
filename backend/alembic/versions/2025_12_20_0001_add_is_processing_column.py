"""Add is_processing column to books table.

Revision ID: add_is_processing_20251220
Revises: restore_descriptions_20251218
Create Date: 2025-12-20

This migration adds the is_processing column to track when a book
is being processed by Celery (parsing, etc.). This allows proper
display of processing overlay in the frontend.
"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'add_is_processing_20251220'
down_revision = 'restore_descriptions_20251218'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add is_processing column to books table."""
    # Add column with default False (since existing books are already processed)
    op.add_column(
        'books',
        sa.Column('is_processing', sa.Boolean(), nullable=False, server_default='false')
    )
    print("✅ Added is_processing column to books table")


def downgrade() -> None:
    """Remove is_processing column from books table."""
    op.drop_column('books', 'is_processing')
    print("⚠️ Removed is_processing column from books table")
