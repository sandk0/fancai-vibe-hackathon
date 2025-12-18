"""Restore descriptions table.

This migration restores the descriptions table that was removed in
the NLP removal migration. The descriptions table is needed for:
- Storing extracted descriptions from books
- Building character/location context over time
- Linking images to specific descriptions

Revision ID: restore_descriptions_20251218
Revises: remove_nlp_20251216
Create Date: 2025-12-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'restore_descriptions_20251218'
down_revision = 'remove_nlp_20251216'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """
    Restore descriptions table and related structures:
    1. Recreate descriptions table
    2. Recreate indexes
    3. Restore FK from generated_images to descriptions
    4. Make description_id NOT NULL again
    """

    # Step 1: Create descriptions table
    op.create_table(
        'descriptions',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('chapter_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('type', sa.Enum('LOCATION', 'CHARACTER', 'ATMOSPHERE', 'OBJECT', 'ACTION', name='descriptiontype'), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('context', sa.Text(), nullable=True),
        sa.Column('confidence_score', sa.Float(), nullable=False, default=0.0),
        sa.Column('position_in_chapter', sa.Integer(), nullable=False),
        sa.Column('word_count', sa.Integer(), nullable=False, default=0),
        sa.Column('is_suitable_for_generation', sa.Boolean(), nullable=False, default=True),
        sa.Column('priority_score', sa.Float(), nullable=False, default=0.0),
        sa.Column('entities_mentioned', sa.Text(), nullable=True),
        sa.Column('emotional_tone', sa.String(50), nullable=True),
        sa.Column('complexity_level', sa.String(20), nullable=True),
        sa.Column('image_generated', sa.Boolean(), nullable=False, default=False),
        sa.Column('generation_requested', sa.Boolean(), nullable=False, default=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.ForeignKeyConstraint(['chapter_id'], ['chapters.id'], ondelete='CASCADE'),
    )

    # Step 2: Create indexes
    op.create_index('ix_descriptions_id', 'descriptions', ['id'])
    op.create_index('ix_descriptions_chapter_id', 'descriptions', ['chapter_id'])
    op.create_index('ix_descriptions_type', 'descriptions', ['type'])
    op.create_index('ix_descriptions_priority_score', 'descriptions', ['priority_score'])

    # Step 3: For existing images, we need to create placeholder descriptions
    # This is necessary because description_id will be NOT NULL
    # We'll migrate existing data from description_text/description_type columns
    op.execute("""
        INSERT INTO descriptions (id, chapter_id, type, content, confidence_score, position_in_chapter, word_count, is_suitable_for_generation, priority_score, image_generated)
        SELECT
            gi.description_id,
            gi.chapter_id,
            COALESCE(gi.description_type, 'LOCATION')::descriptiontype,
            COALESCE(gi.description_text, 'Migrated description'),
            0.8,
            0,
            0,
            true,
            0.5,
            true
        FROM generated_images gi
        WHERE gi.description_id IS NOT NULL
          AND gi.chapter_id IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM descriptions d WHERE d.id = gi.description_id)
    """)

    # Step 4: Create FK constraint from generated_images to descriptions
    op.create_foreign_key(
        'generated_images_description_id_fkey',
        'generated_images', 'descriptions',
        ['description_id'], ['id'],
        ondelete='CASCADE'
    )

    # Step 5: Remove temporary columns from generated_images
    # (Keep them for now as they might have useful data, can be removed later)
    # op.drop_column('generated_images', 'description_text')
    # op.drop_column('generated_images', 'description_type')

    print("✅ Descriptions table restored successfully")
    print("   - descriptions table created")
    print("   - indexes created")
    print("   - FK constraint restored")


def downgrade() -> None:
    """
    Remove descriptions table again (revert to NLP removal state)
    """
    # Drop FK constraint
    op.drop_constraint('generated_images_description_id_fkey', 'generated_images', type_='foreignkey')

    # Make description_id nullable again
    op.alter_column(
        'generated_images',
        'description_id',
        existing_type=postgresql.UUID(),
        nullable=True
    )

    # Drop indexes
    op.drop_index('ix_descriptions_priority_score', 'descriptions')
    op.drop_index('ix_descriptions_type', 'descriptions')
    op.drop_index('ix_descriptions_chapter_id', 'descriptions')
    op.drop_index('ix_descriptions_id', 'descriptions')

    # Drop descriptions table
    op.drop_table('descriptions')

    # Drop enum type
    op.execute("DROP TYPE IF EXISTS descriptiontype")

    print("⚠️ Descriptions table removed")
