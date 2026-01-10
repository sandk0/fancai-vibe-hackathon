"""Add push_subscriptions table for PWA push notifications.

Revision ID: 2026_01_09_0001
Revises: 2025_12_30_0001
Create Date: 2026-01-09

Adds table for storing Web Push subscriptions, enabling PWA
push notifications for book parsing completion, image generation,
and other real-time events.
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = "2026_01_09_0001"
down_revision = "2025_12_30_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create push_subscriptions table."""
    op.create_table(
        "push_subscriptions",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Unique identifier for the subscription",
        ),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            comment="Foreign key to user who owns this subscription",
        ),
        sa.Column(
            "endpoint",
            sa.String(length=500),
            nullable=False,
            comment="Push service endpoint URL (unique per device)",
        ),
        sa.Column(
            "p256dh_key",
            sa.String(length=200),
            nullable=False,
            comment="Client P-256 ECDH public key for encryption",
        ),
        sa.Column(
            "auth_key",
            sa.String(length=50),
            nullable=False,
            comment="Authentication secret for the subscription",
        ),
        sa.Column(
            "is_active",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("true"),
            comment="Whether the subscription is still valid",
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="When the subscription was created",
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
            comment="When the subscription was last updated",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
            ondelete="CASCADE",
        ),
    )

    # Create indexes
    op.create_index(
        op.f("ix_push_subscriptions_id"),
        "push_subscriptions",
        ["id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_push_subscriptions_user_id"),
        "push_subscriptions",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_push_subscriptions_endpoint"),
        "push_subscriptions",
        ["endpoint"],
        unique=True,
    )
    op.create_index(
        "idx_push_subscriptions_user_active",
        "push_subscriptions",
        ["user_id", "is_active"],
        unique=False,
    )


def downgrade() -> None:
    """Drop push_subscriptions table."""
    op.drop_index(
        "idx_push_subscriptions_user_active",
        table_name="push_subscriptions",
    )
    op.drop_index(
        op.f("ix_push_subscriptions_endpoint"),
        table_name="push_subscriptions",
    )
    op.drop_index(
        op.f("ix_push_subscriptions_user_id"),
        table_name="push_subscriptions",
    )
    op.drop_index(
        op.f("ix_push_subscriptions_id"),
        table_name="push_subscriptions",
    )
    op.drop_table("push_subscriptions")
