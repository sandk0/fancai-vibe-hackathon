#!/usr/bin/env python3
"""
Manual test for Celery task execution to debug the NLP processing pipeline.
"""

import asyncio
import sys
import os
import logging
from uuid import UUID

# Add the backend to the path
sys.path.append('/Users/sandk/Documents/GitHub/fancai-vibe-hackathon/backend')

from app.core.celery_app import celery_app

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_health_check():
    """Test basic Celery connectivity."""
    try:
        logger.info("🔄 Testing Celery health check task...")
        result = celery_app.send_task('health_check')
        response = result.get(timeout=10)
        logger.info(f"✅ Health check result: {response}")
        return True
    except Exception as e:
        logger.error(f"❌ Health check failed: {str(e)}")
        return False

def test_book_processing():
    """Test book processing task for the uploaded book."""
    book_id = "795c2eb7-3da2-496b-9a02-451a568b9623"  # Most recent "Ученик убийцы"
    
    try:
        logger.info(f"🔄 Testing process_book task for book {book_id}...")
        result = celery_app.send_task('process_book', args=[book_id])
        logger.info(f"📤 Task sent, task_id: {result.id}")
        
        # Wait for result (up to 60 seconds)
        response = result.get(timeout=60)
        logger.info(f"✅ Book processing result: {response}")
        return response
        
    except Exception as e:
        logger.error(f"❌ Book processing test failed: {str(e)}")
        return None

def main():
    """Run manual Celery tests."""
    logger.info("🚀 Starting manual Celery tests...")
    
    # Test basic connectivity
    if not test_health_check():
        logger.error("❌ Health check failed - Celery is not working properly")
        return
    
    # Test book processing
    result = test_book_processing()
    
    if result:
        logger.info(f"🎉 SUCCESS - Found {result.get('descriptions_found', 0)} descriptions")
    else:
        logger.error("❌ Book processing failed")

if __name__ == "__main__":
    main()