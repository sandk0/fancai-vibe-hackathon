"""add reading_goals table for user reading goals tracking

Revision ID: 2025_11_29_0002
Revises: 2025_11_23_0001
Create Date: 2025-11-29 00:00:00.000000

Adds reading_goals table for tracking user reading goals.

Features:
- 4 goal types: books, minutes, pages, streak
- 4 goal periods: daily, weekly, monthly, yearly
- Progress tracking with current_value and target_value
- Period management with start_date and end_date
- Status tracking: is_active, is_completed, completed_at
- 6 optimized indexes for common queries
- 5 CHECK constraints for data integrity
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision = '2025_11_29_0002'
down_revision = '2025_11_23_0001'  # NLP rollout config migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create reading_goals table with indexes and constraints."""
    # Create table
    op.create_table(
        'reading_goals',
        sa.Column(
            'id',
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            nullable=False,
            comment='Уникальный идентификатор цели'
        ),
        sa.Column(
            'user_id',
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'),
            nullable=False,
            comment='ID пользователя (внешний ключ)'
        ),
        sa.Column(
            'goal_type',
            sa.String(20),
            nullable=False,
            comment="Тип цели: 'books', 'minutes', 'pages', 'streak'"
        ),
        sa.Column(
            'goal_period',
            sa.String(20),
            nullable=False,
            comment="Период цели: 'daily', 'weekly', 'monthly', 'yearly'"
        ),
        sa.Column(
            'target_value',
            sa.Float(),
            nullable=False,
            comment='Целевое значение (N книг, N минут, N страниц, N дней)'
        ),
        sa.Column(
            'current_value',
            sa.Float(),
            nullable=False,
            server_default='0.0',
            comment='Текущее значение (прогресс)'
        ),
        sa.Column(
            'start_date',
            sa.DateTime(timezone=True),
            nullable=False,
            comment='Дата начала периода цели'
        ),
        sa.Column(
            'end_date',
            sa.DateTime(timezone=True),
            nullable=False,
            comment='Дата окончания периода цели'
        ),
        sa.Column(
            'is_active',
            sa.Boolean(),
            nullable=False,
            server_default='true',
            comment='Активна ли цель в данный момент'
        ),
        sa.Column(
            'is_completed',
            sa.Boolean(),
            nullable=False,
            server_default='false',
            comment='Выполнена ли цель'
        ),
        sa.Column(
            'completed_at',
            sa.DateTime(timezone=True),
            nullable=True,
            comment='Когда была выполнена цель'
        ),
        sa.Column(
            'last_progress_update',
            sa.DateTime(timezone=True),
            nullable=True,
            comment='Когда последний раз обновлялся прогресс'
        ),
        sa.Column(
            'created_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment='Дата создания цели'
        ),
        sa.Column(
            'updated_at',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
            comment='Дата последнего обновления'
        )
    )

    # Add CHECK constraints
    op.create_check_constraint(
        'ck_reading_goals_goal_type',
        'reading_goals',
        "goal_type IN ('books', 'minutes', 'pages', 'streak')"
    )

    op.create_check_constraint(
        'ck_reading_goals_goal_period',
        'reading_goals',
        "goal_period IN ('daily', 'weekly', 'monthly', 'yearly')"
    )

    op.create_check_constraint(
        'ck_reading_goals_target_value_positive',
        'reading_goals',
        'target_value > 0'
    )

    op.create_check_constraint(
        'ck_reading_goals_current_value_nonnegative',
        'reading_goals',
        'current_value >= 0'
    )

    op.create_check_constraint(
        'ck_reading_goals_end_after_start',
        'reading_goals',
        'end_date >= start_date'
    )

    # Create indexes

    # 1. Primary key index (id) - created automatically
    op.create_index(
        'ix_reading_goals_id',
        'reading_goals',
        ['id'],
        unique=False
    )

    # 2. Foreign key index (user_id)
    op.create_index(
        'ix_reading_goals_user_id',
        'reading_goals',
        ['user_id'],
        unique=False
    )

    # 3. Goal type index
    op.create_index(
        'ix_reading_goals_goal_type',
        'reading_goals',
        ['goal_type'],
        unique=False
    )

    # 4. Goal period index
    op.create_index(
        'ix_reading_goals_goal_period',
        'reading_goals',
        ['goal_period'],
        unique=False
    )

    # 5. Start date index
    op.create_index(
        'ix_reading_goals_start_date',
        'reading_goals',
        ['start_date'],
        unique=False
    )

    # 6. End date index
    op.create_index(
        'ix_reading_goals_end_date',
        'reading_goals',
        ['end_date'],
        unique=False
    )

    # 7. Is active index
    op.create_index(
        'ix_reading_goals_is_active',
        'reading_goals',
        ['is_active'],
        unique=False
    )

    # 8. Is completed index
    op.create_index(
        'ix_reading_goals_is_completed',
        'reading_goals',
        ['is_completed'],
        unique=False
    )

    # 9. Composite index: user + active + start_date (для поиска активных целей пользователя)
    op.create_index(
        'idx_reading_goals_user_active',
        'reading_goals',
        ['user_id', 'is_active', 'start_date'],
        unique=False
    )

    # 10. Composite index: type + period (для группировки по типу и периоду)
    op.create_index(
        'idx_reading_goals_type_period',
        'reading_goals',
        ['goal_type', 'goal_period'],
        unique=False
    )

    # 11. Partial index: активные цели (для фильтрации только активных)
    op.create_index(
        'idx_reading_goals_active_only',
        'reading_goals',
        ['user_id', 'is_active'],
        unique=False,
        postgresql_where=sa.text('is_active = true')
    )

    # 12. Partial index: завершенные цели (для истории)
    op.create_index(
        'idx_reading_goals_completed_only',
        'reading_goals',
        ['user_id', 'is_completed', 'completed_at'],
        unique=False,
        postgresql_where=sa.text('is_completed = true')
    )

    # 13. Composite index: period range (start_date, end_date)
    op.create_index(
        'idx_reading_goals_period_range',
        'reading_goals',
        ['user_id', 'start_date', 'end_date'],
        unique=False
    )

    # 14. Composite index: progress updates
    op.create_index(
        'idx_reading_goals_progress_update',
        'reading_goals',
        ['user_id', 'last_progress_update', 'is_active'],
        unique=False
    )


def downgrade() -> None:
    """Drop reading_goals table with all indexes and constraints."""
    # Drop indexes (in reverse order)
    op.drop_index('idx_reading_goals_progress_update', table_name='reading_goals')
    op.drop_index('idx_reading_goals_period_range', table_name='reading_goals')
    op.drop_index('idx_reading_goals_completed_only', table_name='reading_goals')
    op.drop_index('idx_reading_goals_active_only', table_name='reading_goals')
    op.drop_index('idx_reading_goals_type_period', table_name='reading_goals')
    op.drop_index('idx_reading_goals_user_active', table_name='reading_goals')
    op.drop_index('ix_reading_goals_is_completed', table_name='reading_goals')
    op.drop_index('ix_reading_goals_is_active', table_name='reading_goals')
    op.drop_index('ix_reading_goals_end_date', table_name='reading_goals')
    op.drop_index('ix_reading_goals_start_date', table_name='reading_goals')
    op.drop_index('ix_reading_goals_goal_period', table_name='reading_goals')
    op.drop_index('ix_reading_goals_goal_type', table_name='reading_goals')
    op.drop_index('ix_reading_goals_user_id', table_name='reading_goals')
    op.drop_index('ix_reading_goals_id', table_name='reading_goals')

    # Drop CHECK constraints
    op.drop_constraint('ck_reading_goals_end_after_start', 'reading_goals', type_='check')
    op.drop_constraint('ck_reading_goals_current_value_nonnegative', 'reading_goals', type_='check')
    op.drop_constraint('ck_reading_goals_target_value_positive', 'reading_goals', type_='check')
    op.drop_constraint('ck_reading_goals_goal_period', 'reading_goals', type_='check')
    op.drop_constraint('ck_reading_goals_goal_type', 'reading_goals', type_='check')

    # Drop table
    op.drop_table('reading_goals')
