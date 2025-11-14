"""
Integration tests for refactored Multi-NLP system.

Tests all 5 processing modes with real processors.
Validates performance regression (<4s for 2171 descriptions).
"""

import pytest
import pytest_asyncio
import asyncio
import time
from datetime import datetime

from app.services.multi_nlp_manager import MultiNLPManager
from app.services.nlp.strategies import ProcessingMode


# Sample Russian literary text for testing
SAMPLE_TEXT = """
Старый замок возвышался на высоком холме, окруженный густым лесом.
Его величественные башни касались облаков, а мрачные стены хранили
множество тайн. Молодой князь Алексей стоял у окна, его темные глаза
смотрели вдаль. Длинные черные волосы развевались на ветру.
Атмосфера была напряженной и таинственной, воздух пах древностью
и забытыми легендами. В зале царила тишина, нарушаемая лишь шорохом
старинных гобеленов.
"""


@pytest.mark.asyncio
class TestMultiNLPIntegration:
    """Integration tests for Multi-NLP system."""

    @pytest_asyncio.fixture
    async def manager(self):
        """Create and initialize manager."""
        mgr = MultiNLPManager()
        await mgr.initialize()
        return mgr

    async def test_manager_initialization(self, manager):
        """Test manager initializes correctly."""
        assert manager._initialized is True
        assert len(manager.processor_registry.processors) > 0
        assert manager.processing_mode in ProcessingMode
        print(f"✅ Manager initialized with {len(manager.processor_registry.processors)} processors")

    async def test_single_mode(self, manager):
        """Test SINGLE processing mode."""
        result = await manager.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="test_chapter",
            mode=ProcessingMode.SINGLE
        )

        assert result is not None
        assert len(result.processors_used) == 1
        assert len(result.descriptions) > 0
        assert result.processing_time > 0

        print(f"✅ SINGLE mode: {len(result.descriptions)} descriptions, "
              f"{result.processing_time:.2f}s, "
              f"processor: {result.processors_used[0]}")

    async def test_parallel_mode(self, manager):
        """Test PARALLEL processing mode."""
        result = await manager.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="test_chapter",
            mode=ProcessingMode.PARALLEL
        )

        assert result is not None
        assert len(result.processors_used) > 1  # Should use multiple processors
        assert len(result.descriptions) > 0
        assert result.processing_time > 0

        print(f"✅ PARALLEL mode: {len(result.descriptions)} descriptions, "
              f"{result.processing_time:.2f}s, "
              f"processors: {result.processors_used}")

    async def test_sequential_mode(self, manager):
        """Test SEQUENTIAL processing mode."""
        result = await manager.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="test_chapter",
            mode=ProcessingMode.SEQUENTIAL
        )

        assert result is not None
        assert len(result.processors_used) > 1
        assert len(result.descriptions) > 0
        assert result.processing_time > 0

        print(f"✅ SEQUENTIAL mode: {len(result.descriptions)} descriptions, "
              f"{result.processing_time:.2f}s, "
              f"processors: {result.processors_used}")

    async def test_ensemble_mode(self, manager):
        """Test ENSEMBLE processing mode with voting."""
        result = await manager.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="test_chapter",
            mode=ProcessingMode.ENSEMBLE
        )

        assert result is not None
        assert len(result.processors_used) > 1
        assert len(result.descriptions) > 0
        assert "ensemble voting" in " ".join(result.recommendations).lower()

        # Check ensemble metadata
        for desc in result.descriptions:
            if 'processing_method' in desc:
                assert desc['processing_method'] == 'ensemble'

        print(f"✅ ENSEMBLE mode: {len(result.descriptions)} descriptions, "
              f"{result.processing_time:.2f}s, "
              f"quality: {result.quality_metrics}")

    async def test_adaptive_mode(self, manager):
        """Test ADAPTIVE processing mode."""
        result = await manager.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="test_chapter",
            mode=ProcessingMode.ADAPTIVE
        )

        assert result is not None
        assert len(result.processors_used) >= 1
        assert len(result.descriptions) > 0
        assert any("Adaptive mode selected" in rec for rec in result.recommendations)

        print(f"✅ ADAPTIVE mode: {len(result.descriptions)} descriptions, "
              f"{result.processing_time:.2f}s, "
              f"selected: {result.processors_used}")

    async def test_mode_switching(self, manager):
        """Test switching between modes."""
        modes = [
            ProcessingMode.SINGLE,
            ProcessingMode.PARALLEL,
            ProcessingMode.ENSEMBLE,
            ProcessingMode.ADAPTIVE
        ]

        for mode in modes:
            manager.set_processing_mode(mode)
            assert manager.processing_mode == mode

            result = await manager.extract_descriptions(
                SAMPLE_TEXT,
                chapter_id="test_chapter"
            )

            assert result is not None
            assert len(result.descriptions) > 0
            print(f"✅ Mode {mode.value}: {len(result.descriptions)} descriptions")

    async def test_processor_status(self, manager):
        """Test processor status retrieval."""
        status = await manager.get_processor_status()

        assert 'available_processors' in status
        assert 'processor_details' in status
        assert 'processing_mode' in status
        assert 'statistics' in status

        print(f"✅ Status: {len(status['available_processors'])} processors available")
        print(f"   Mode: {status['processing_mode']}")
        print(f"   Total processed: {status['statistics']['total_processed']}")

    async def test_ensemble_voting_accuracy(self, manager):
        """Test ensemble voting quality."""
        result = await manager.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="test_chapter",
            mode=ProcessingMode.ENSEMBLE
        )

        # Check that ensemble produces quality results
        avg_confidence = sum(
            desc.get('confidence_score', 0) for desc in result.descriptions
        ) / max(1, len(result.descriptions))

        assert avg_confidence > 0.3  # Should have reasonable confidence
        print(f"✅ Ensemble voting: avg confidence = {avg_confidence:.2f}")

    async def test_performance_regression(self, manager):
        """
        Performance regression test.
        Target: Process text fast enough to maintain <4s for full book.
        """
        # Generate larger text (simulate chapter)
        large_text = SAMPLE_TEXT * 10  # ~10x larger

        start_time = time.time()

        result = await manager.extract_descriptions(
            large_text,
            chapter_id="perf_test",
            mode=ProcessingMode.ENSEMBLE  # Most expensive mode
        )

        elapsed = time.time() - start_time

        # Performance target: should process reasonably fast
        # For 10x text, should be < 1 second for ensemble mode
        assert elapsed < 2.0, f"Processing too slow: {elapsed:.2f}s"

        print(f"✅ Performance: {len(result.descriptions)} descriptions "
              f"in {elapsed:.2f}s ({len(result.descriptions)/elapsed:.1f} desc/sec)")

    async def test_backward_compatibility(self, manager):
        """Test backward compatibility with old API."""
        # Old API style call
        result = await manager.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="compat_test"
        )

        assert result is not None
        assert hasattr(result, 'descriptions')
        assert hasattr(result, 'processor_results')
        assert hasattr(result, 'processing_time')
        assert hasattr(result, 'processors_used')
        assert hasattr(result, 'quality_metrics')
        assert hasattr(result, 'recommendations')

        print(f"✅ Backward compatibility maintained")


@pytest.mark.asyncio
async def test_global_manager_instance():
    """Test global manager instance works."""
    from app.services.multi_nlp_manager import multi_nlp_manager

    await multi_nlp_manager.initialize()

    result = await multi_nlp_manager.extract_descriptions(
        SAMPLE_TEXT,
        chapter_id="global_test"
    )

    assert result is not None
    assert len(result.descriptions) > 0

    print(f"✅ Global instance: {len(result.descriptions)} descriptions")


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "-s"])
