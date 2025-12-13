"""Add imagen to image_service CHECK constraint

Revision ID: add_imagen_2025
Revises: add_reading_goals_2025
Create Date: 2025-12-13

Changes:
- Update CHECK constraint for generated_images.service_used to include 'imagen'
- Required for Google Imagen 4 integration

Purpose:
- Allow Google Imagen 4 as image generation service
- Replace pollinations.ai as primary image generator
"""

from alembic import op

# Revision identifiers, used by Alembic.
revision = 'add_imagen_2025'
down_revision = '2025_11_29_0002'
branch_labels = None
depends_on = None


def upgrade():
    """
    Update CHECK constraint to include 'imagen' service.
    """

    print("\n" + "="*70)
    print("Adding 'imagen' to image_service CHECK constraint")
    print("="*70 + "\n")

    # Drop old constraint
    print("Step 1/2: Dropping old check_image_service constraint...")
    op.execute("ALTER TABLE generated_images DROP CONSTRAINT IF EXISTS check_image_service")
    print("   Done")

    # Create new constraint with 'imagen' added
    print("Step 2/2: Creating new check_image_service constraint...")
    op.execute("""
        ALTER TABLE generated_images
        ADD CONSTRAINT check_image_service
        CHECK (
            service_used IN (
                'pollinations',      -- ImageService.POLLINATIONS (legacy)
                'openai_dalle',      -- ImageService.OPENAI_DALLE
                'midjourney',        -- ImageService.MIDJOURNEY
                'stable_diffusion',  -- ImageService.STABLE_DIFFUSION
                'imagen'             -- ImageService.IMAGEN (Google Imagen 4)
            )
        )
    """)
    print("   Done")

    print("\n" + "="*70)
    print("CHECK constraint updated successfully!")
    print("Valid values: pollinations, openai_dalle, midjourney, stable_diffusion, imagen")
    print("="*70 + "\n")


def downgrade():
    """
    Revert CHECK constraint to exclude 'imagen' service.
    """

    print("\n" + "="*70)
    print("Removing 'imagen' from image_service CHECK constraint")
    print("="*70 + "\n")

    # Drop new constraint
    op.execute("ALTER TABLE generated_images DROP CONSTRAINT IF EXISTS check_image_service")

    # Recreate old constraint without 'imagen'
    op.execute("""
        ALTER TABLE generated_images
        ADD CONSTRAINT check_image_service
        CHECK (
            service_used IN (
                'pollinations',
                'openai_dalle',
                'midjourney',
                'stable_diffusion'
            )
        )
    """)

    print("CHECK constraint reverted (imagen removed)")
    print("="*70 + "\n")
