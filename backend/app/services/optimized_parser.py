"""
Optimized Book Parser with Batching and Resource Management
Implements efficient parsing strategies to reduce memory usage and improve performance
"""

import asyncio
import gc
import logging
import time
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from contextlib import asynccontextmanager
import psutil

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import insert

from ..models.description import Description
from ..models.chapter import Chapter
from ..services.multi_nlp_manager import multi_nlp_manager

logger = logging.getLogger(__name__)


class BatchProcessor:
    """Handles batch processing of descriptions for efficient DB operations"""

    def __init__(self, batch_size: int = 100, flush_interval: float = 5.0):
        self.batch_size = batch_size
        self.flush_interval = flush_interval
        self.buffer: List[Dict[str, Any]] = []
        self.last_flush = time.time()
        self.total_processed = 0
        self.total_saved = 0

    async def add_descriptions(
        self,
        descriptions: List[Dict[str, Any]],
        db: AsyncSession,
        force_flush: bool = False,
    ) -> int:
        """Add descriptions to buffer and flush if needed"""
        self.buffer.extend(descriptions)

        should_flush = (
            len(self.buffer) >= self.batch_size
            or time.time() - self.last_flush > self.flush_interval
            or force_flush
        )

        if should_flush:
            return await self._flush_buffer(db)
        return 0

    async def _flush_buffer(self, db: AsyncSession) -> int:
        """Flush buffer to database using efficient bulk insert"""
        if not self.buffer:
            return 0

        try:
            # Use PostgreSQL COPY for maximum efficiency
            count = await self._bulk_insert_descriptions(db, self.buffer)

            self.total_saved += count
            logger.info(
                f"✅ Batch saved: {count} descriptions (Total: {self.total_saved})"
            )

            self.buffer.clear()
            self.last_flush = time.time()

            return count

        except Exception as e:
            logger.error(f"❌ Error flushing batch: {str(e)}")
            # Keep buffer for retry
            raise

    async def _bulk_insert_descriptions(
        self, db: AsyncSession, descriptions: List[Dict[str, Any]]
    ) -> int:
        """Perform bulk insert using PostgreSQL's efficient methods"""
        if not descriptions:
            return 0

        # Prepare data for bulk insert
        stmt = insert(Description).values(descriptions)

        # Use ON CONFLICT DO NOTHING to handle duplicates
        stmt = stmt.on_conflict_do_nothing(index_elements=["id"])

        result = await db.execute(stmt)
        await db.commit()

        return result.rowcount


class ResourceMonitor:
    """Monitor system resources during parsing"""

    def __init__(self, max_memory_mb: int = 1500, max_cpu_percent: int = 80):
        self.max_memory_mb = max_memory_mb
        self.max_cpu_percent = max_cpu_percent
        self.start_time = time.time()
        self.check_interval = 10  # Check every 10 seconds
        self.last_check = 0

    def should_pause(self) -> Tuple[bool, str]:
        """Check if parsing should pause due to resource constraints"""
        current_time = time.time()

        if current_time - self.last_check < self.check_interval:
            return False, ""

        self.last_check = current_time

        # Check memory
        memory = psutil.virtual_memory()
        process = psutil.Process()
        process_memory_mb = process.memory_info().rss / 1024 / 1024

        if process_memory_mb > self.max_memory_mb:
            return (
                True,
                f"Process memory ({process_memory_mb:.0f}MB) exceeds limit ({self.max_memory_mb}MB)",
            )

        if memory.percent > 90:
            return True, f"System memory critical: {memory.percent}%"

        # Check CPU
        cpu_percent = psutil.cpu_percent(interval=0.1)
        if cpu_percent > self.max_cpu_percent:
            return True, f"CPU usage high: {cpu_percent}%"

        return False, ""

    def get_stats(self) -> Dict[str, Any]:
        """Get current resource statistics"""
        process = psutil.Process()
        return {
            "memory_mb": process.memory_info().rss / 1024 / 1024,
            "cpu_percent": process.cpu_percent(),
            "runtime_seconds": time.time() - self.start_time,
            "system_memory_percent": psutil.virtual_memory().percent,
            "system_cpu_percent": psutil.cpu_percent(interval=0.1),
        }


class OptimizedBookParser:
    """Optimized parser with batching and resource management"""

    def __init__(self):
        self.batch_processor = BatchProcessor(batch_size=100)
        self.resource_monitor = ResourceMonitor()
        self.nlp_cache = {}  # Cache for NLP models
        self._nlp_model = None

    @asynccontextmanager
    async def get_nlp_model(self):
        """Get or create cached NLP model"""
        if self._nlp_model is None:
            logger.info("🔄 Loading NLP model...")
            self._nlp_model = await self._load_nlp_model()

        try:
            yield self._nlp_model
        finally:
            # Keep model in memory for reuse
            pass

    async def _load_nlp_model(self):
        """Load NLP model with optimizations"""
        # Initialize the multi-NLP manager
        await multi_nlp_manager.initialize()
        return multi_nlp_manager

    async def process_book_optimized(
        self,
        book_id: str,
        chapters: List[Chapter],
        db: AsyncSession,
        progress_callback: Optional[callable] = None,
    ) -> Dict[str, Any]:
        """Process book with optimizations"""

        logger.info(f"📚 Starting optimized processing for book {book_id}")
        start_time = time.time()

        total_descriptions = 0
        processed_chapters = 0
        errors = []

        async with self.get_nlp_model() as nlp_model:
            for i, chapter in enumerate(chapters):
                try:
                    # Check resources before processing
                    should_pause, reason = self.resource_monitor.should_pause()
                    if should_pause:
                        logger.warning(f"⏸️ Pausing due to: {reason}")
                        await asyncio.sleep(5)  # Wait 5 seconds
                        gc.collect()  # Force garbage collection

                    # Process chapter
                    descriptions = await self._process_chapter_optimized(
                        chapter, nlp_model
                    )

                    # Add to batch
                    if descriptions:
                        await self.batch_processor.add_descriptions(
                            descriptions,
                            db,
                            force_flush=(
                                i == len(chapters) - 1
                            ),  # Flush on last chapter
                        )
                        total_descriptions += len(descriptions)

                    # Update chapter status
                    await self._update_chapter_status(db, chapter.id, len(descriptions))

                    processed_chapters += 1

                    # Progress callback
                    if progress_callback:
                        await progress_callback(
                            {
                                "chapter": i + 1,
                                "total_chapters": len(chapters),
                                "descriptions_found": total_descriptions,
                                "progress_percent": ((i + 1) / len(chapters)) * 100,
                            }
                        )

                    # Periodic cleanup
                    if i % 5 == 0:
                        gc.collect()
                        logger.info(
                            f"📊 Progress: {i+1}/{len(chapters)} chapters, "
                            f"{total_descriptions} descriptions, "
                            f"Memory: {self.resource_monitor.get_stats()['memory_mb']:.0f}MB"
                        )

                except Exception as e:
                    logger.error(
                        f"❌ Error processing chapter {chapter.chapter_number}: {str(e)}"
                    )
                    errors.append({"chapter": chapter.chapter_number, "error": str(e)})
                    continue

        # Final flush
        await self.batch_processor.add_descriptions([], db, force_flush=True)

        # Final stats
        duration = time.time() - start_time
        stats = self.resource_monitor.get_stats()

        result = {
            "book_id": book_id,
            "processed_chapters": processed_chapters,
            "total_chapters": len(chapters),
            "total_descriptions": self.batch_processor.total_saved,
            "duration_seconds": duration,
            "avg_time_per_chapter": duration / len(chapters) if chapters else 0,
            "errors": errors,
            "resource_stats": stats,
            "success": len(errors) == 0,
        }

        logger.info(
            f"✅ Completed processing book {book_id}: "
            f"{processed_chapters} chapters, "
            f"{self.batch_processor.total_saved} descriptions, "
            f"{duration:.1f}s"
        )

        return result

    async def _process_chapter_optimized(
        self, chapter: Chapter, nlp_model
    ) -> List[Dict[str, Any]]:
        """Process single chapter with optimizations"""

        if not chapter.content:
            return []

        # Split into smaller chunks for processing
        chunks = self._split_text_intelligently(chapter.content, max_chunk_size=5000)
        all_descriptions = []

        for chunk in chunks:
            # Process chunk using multi-NLP manager
            result = await nlp_model.extract_descriptions(
                text=chunk, chapter_id=str(chapter.id)
            )
            descriptions = result.descriptions

            # Convert to dict format for batch insert
            for desc in descriptions:
                # Handle entities_mentioned properly
                entities_list = desc.get("entities_mentioned", [])
                if isinstance(entities_list, str):
                    entities_str = entities_list
                elif isinstance(entities_list, list):
                    entities_str = ", ".join(entities_list)
                else:
                    entities_str = ""

                all_descriptions.append(
                    {
                        "chapter_id": chapter.id,
                        "type": desc["type"],
                        "content": desc["content"][:1000],  # Limit content size
                        "context": desc.get("context", "")[:500]
                        if desc.get("context")
                        else None,
                        "confidence_score": desc["confidence_score"],
                        "position_in_chapter": desc.get("position", 0),
                        "word_count": desc["word_count"],
                        "is_suitable_for_generation": desc["confidence_score"] > 0.3,
                        "priority_score": desc["priority_score"],
                        "entities_mentioned": entities_str[:200]
                        if entities_str
                        else None,
                        "created_at": datetime.utcnow(),
                        "updated_at": datetime.utcnow(),
                    }
                )

        return all_descriptions

    def _split_text_intelligently(
        self, text: str, max_chunk_size: int = 5000
    ) -> List[str]:
        """Split text into chunks at sentence boundaries"""
        if len(text) <= max_chunk_size:
            return [text]

        # Simple sentence-aware splitting
        sentences = text.replace("\n\n", "\n").split(". ")
        chunks = []
        current_chunk = []
        current_size = 0

        for sentence in sentences:
            sentence_size = len(sentence)

            if current_size + sentence_size > max_chunk_size and current_chunk:
                chunks.append(". ".join(current_chunk) + ".")
                current_chunk = [sentence]
                current_size = sentence_size
            else:
                current_chunk.append(sentence)
                current_size += sentence_size

        if current_chunk:
            chunks.append(". ".join(current_chunk))

        return chunks

    async def _update_chapter_status(
        self, db: AsyncSession, chapter_id: str, descriptions_count: int
    ):
        """Update chapter parsing status"""
        query = text(
            """
            UPDATE chapters
            SET is_description_parsed = true,
                descriptions_found = :count,
                parsing_progress = 100,
                parsed_at = CURRENT_TIMESTAMP,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = :chapter_id
        """
        )

        await db.execute(query, {"chapter_id": chapter_id, "count": descriptions_count})
        await db.commit()


# Singleton instance
optimized_parser = OptimizedBookParser()

# Export for use
__all__ = [
    "optimized_parser",
    "OptimizedBookParser",
    "BatchProcessor",
    "ResourceMonitor",
]
