"""add nlp_rollout_config table for canary deployment

Revision ID: 2025_11_23_0001
Revises: 2025_11_22_2137
Create Date: 2025-11-23 00:00:00.000000

Adds nlp_rollout_config table for managing gradual rollout of new Multi-NLP
architecture with canary deployment strategy.

Features:
- Track rollout stage (0-4) and percentage (0-100%)
- Audit trail with updated_at and updated_by
- Support for rollback and advance operations
- History of all configuration changes
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2025_11_23_0001'
down_revision = '72f14c0d1a64'  # Feature flags migration (2025_11_22_2137)
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create nlp_rollout_config table."""
    # Create table
    op.create_table(
        'nlp_rollout_config',
        sa.Column(
            'id',
            sa.Integer(),
            primary_key=True,
            autoincrement=True,
            comment='Unique identifier'
        ),
        sa.Column(
            'current_stage',
            sa.Integer(),
            nullable=False,
            default=0,
            comment='Current rollout stage (0-4)'
        ),
        sa.Column(
            'rollout_percentage',
            sa.Integer(),
            nullable=False,
            default=0,
            comment='Percentage of users on new architecture (0-100)'
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment='Timestamp of configuration change'
        ),
        sa.Column(
            'updated_by',
            sa.String(255),
            nullable=True,
            comment='Email of admin who made the change'
        ),
        sa.Column(
            'notes',
            sa.Text(),
            nullable=True,
            comment='Notes about the configuration change'
        )
    )

    # Create indexes
    op.create_index(
        'ix_nlp_rollout_config_updated_at',
        'nlp_rollout_config',
        ['updated_at'],
        unique=False
    )

    # Insert initial configuration (100% - new architecture already in production)
    op.execute("""
        INSERT INTO nlp_rollout_config (current_stage, rollout_percentage, updated_by, notes)
        VALUES (4, 100, 'system', 'Initial state: new Multi-NLP architecture already at 100% in production (2025-11-18)');
    """)


def downgrade() -> None:
    """Drop nlp_rollout_config table."""
    op.drop_index('ix_nlp_rollout_config_updated_at', table_name='nlp_rollout_config')
    op.drop_table('nlp_rollout_config')
