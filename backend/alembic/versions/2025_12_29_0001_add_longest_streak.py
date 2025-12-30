"""Add longest_streak_days to users table.

Revision ID: 2025_12_29_0001
Revises: 2025_12_28_0001
Create Date: 2025-12-29

Adds longest_streak_days column to track user's best reading streak.
This field stores the maximum number of consecutive days the user has read.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = "2025_12_29_0001"
down_revision = "2025_12_28_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add longest_streak_days column to users table."""
    op.add_column(
        "users",
        sa.Column("longest_streak_days", sa.Integer(), nullable=True, server_default="0"),
    )
    # Set default for existing records
    op.execute("UPDATE users SET longest_streak_days = 0 WHERE longest_streak_days IS NULL")
    # Make NOT NULL after populating
    op.alter_column("users", "longest_streak_days", nullable=False)


def downgrade() -> None:
    """Remove longest_streak_days column from users table."""
    op.drop_column("users", "longest_streak_days")
