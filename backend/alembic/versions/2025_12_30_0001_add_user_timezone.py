"""Add timezone field to users table.

Revision ID: 2025_12_30_0001
Revises: 2025_12_29_0001
Create Date: 2025-12-30

Adds timezone column to store user's IANA timezone name for proper
date aggregation in statistics (e.g., reading streak calculation).
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2025_12_30_0001"
down_revision = "2025_12_29_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add timezone column to users table."""
    op.add_column(
        "users",
        sa.Column("timezone", sa.String(50), nullable=True, server_default="UTC"),
    )
    # Set default for existing records
    op.execute("UPDATE users SET timezone = 'UTC' WHERE timezone IS NULL")
    # Make NOT NULL after populating
    op.alter_column("users", "timezone", nullable=False)


def downgrade() -> None:
    """Remove timezone column from users table."""
    op.drop_column("users", "timezone")
