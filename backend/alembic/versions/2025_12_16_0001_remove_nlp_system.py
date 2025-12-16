"""Remove NLP system - December 2025 optimization.

This migration:
1. Adds new columns to generated_images (chapter_id, description_text, description_type)
2. Makes description_id nullable (for backwards compatibility)
3. Drops the descriptions table (NLP data no longer stored)
4. Drops the nlp_rollout_config table (NLP feature flags)
5. Removes foreign key from generated_images to descriptions

After this migration:
- Descriptions are extracted on-demand via LLM API (LangExtract)
- Images are linked directly to chapters
- Description text/type stored in generated_images table

RAM reduction: 10-12 GB → 2-3 GB
Docker image: 2.5 GB → 800 MB

Revision ID: remove_nlp_20251216
Revises: 2025_12_13_0001_add_imagen_to_service_enum
Create Date: 2025-12-16
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'remove_nlp_20251216'
down_revision = 'add_imagen_2025'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Remove NLP system:
    1. Add new columns to generated_images
    2. Make description_id nullable
    3. Drop FK constraint to descriptions
    4. Drop descriptions table
    5. Drop nlp_rollout_config table
    """

    # Step 1: Add new columns to generated_images
    op.add_column(
        'generated_images',
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.add_column(
        'generated_images',
        sa.Column('description_text', sa.Text(), nullable=True)
    )
    op.add_column(
        'generated_images',
        sa.Column('description_type', sa.String(50), nullable=True)
    )

    # Create index on chapter_id
    op.create_index(
        'ix_generated_images_chapter_id',
        'generated_images',
        ['chapter_id']
    )

    # Create FK to chapters
    op.create_foreign_key(
        'fk_generated_images_chapter_id',
        'generated_images', 'chapters',
        ['chapter_id'], ['id'],
        ondelete='CASCADE'
    )

    # Step 2: Migrate existing data - copy description content to generated_images
    # This preserves the description text for existing images
    op.execute("""
        UPDATE generated_images gi
        SET
            description_text = d.content,
            description_type = d.type,
            chapter_id = d.chapter_id
        FROM descriptions d
        WHERE gi.description_id = d.id
    """)

    # Step 3: Drop FK constraint from generated_images to descriptions
    # First, find and drop the constraint
    op.execute("""
        ALTER TABLE generated_images
        DROP CONSTRAINT IF EXISTS generated_images_description_id_fkey
    """)

    # Make description_id nullable (for backwards compatibility)
    op.alter_column(
        'generated_images',
        'description_id',
        existing_type=postgresql.UUID(),
        nullable=True
    )

    # Step 4: Drop descriptions table
    op.drop_table('descriptions')

    # Step 5: Drop nlp_rollout_config table
    op.drop_table('nlp_rollout_config')

    print("✅ NLP system removed successfully")
    print("   - descriptions table dropped")
    print("   - nlp_rollout_config table dropped")
    print("   - generated_images updated with chapter_id, description_text, description_type")


def downgrade() -> None:
    """
    Restore NLP system:
    1. Recreate descriptions table
    2. Recreate nlp_rollout_config table
    3. Restore FK constraint
    4. Remove new columns from generated_images

    WARNING: Data in descriptions table will be lost!
    """

    # Step 1: Recreate descriptions table
    op.create_table(
        'descriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('type', sa.String(50), nullable=False),
        sa.Column('confidence_score', sa.Float(), nullable=True),
        sa.Column('priority_score', sa.Float(), nullable=True),
        sa.Column('entities_mentioned', postgresql.JSONB(), nullable=True),
        sa.Column('text_position_start', sa.Integer(), nullable=True),
        sa.Column('text_position_end', sa.Integer(), nullable=True),
        sa.Column('source_sentence', sa.Text(), nullable=True),
        sa.Column('nlp_metadata', postgresql.JSONB(), nullable=True),
        sa.Column('is_processed', sa.Boolean(), default=False),
        sa.Column('is_valid', sa.Boolean(), default=True),
        sa.Column('validation_notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
    )

    op.create_index('ix_descriptions_chapter_id', 'descriptions', ['chapter_id'])
    op.create_index('ix_descriptions_type', 'descriptions', ['type'])
    op.create_index('ix_descriptions_priority_score', 'descriptions', ['priority_score'])

    # Step 2: Recreate nlp_rollout_config table
    op.create_table(
        'nlp_rollout_config',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('config_name', sa.String(100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('canary_percentage', sa.Integer(), default=0),
        sa.Column('is_active', sa.Boolean(), default=False),
        sa.Column('target_user_ids', postgresql.ARRAY(postgresql.UUID()), nullable=True),
        sa.Column('excluded_user_ids', postgresql.ARRAY(postgresql.UUID()), nullable=True),
        sa.Column('min_book_count', sa.Integer(), default=0),
        sa.Column('processor_weights', postgresql.JSONB(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )

    # Step 3: Make description_id not nullable again
    op.alter_column(
        'generated_images',
        'description_id',
        existing_type=postgresql.UUID(),
        nullable=False
    )

    # Recreate FK constraint
    op.create_foreign_key(
        'generated_images_description_id_fkey',
        'generated_images', 'descriptions',
        ['description_id'], ['id'],
        ondelete='CASCADE'
    )

    # Step 4: Remove new columns from generated_images
    op.drop_constraint('fk_generated_images_chapter_id', 'generated_images', type_='foreignkey')
    op.drop_index('ix_generated_images_chapter_id', 'generated_images')
    op.drop_column('generated_images', 'description_type')
    op.drop_column('generated_images', 'description_text')
    op.drop_column('generated_images', 'chapter_id')

    print("⚠️ NLP system restored (data in descriptions was lost)")
