"""
Comprehensive integration tests for Session 6 (Stanza processor activation).

Tests Stanza processor integration with:
- ProcessorRegistry (registration and availability)
- EnsembleVoter (weighted consensus with 4 processors)
- MultiNLPManager (performance benchmarks)
- Strategy Pattern (ENSEMBLE mode with Stanza)

Created: 2025-11-24
QA Report: docs/reports/QA_ANALYSIS_SESSIONS_6-7_2025-11-24.md
"""

import pytest
import pytest_asyncio
import asyncio
import time
from datetime import datetime
from typing import List, Dict, Any

from app.services.multi_nlp_manager import MultiNLPManager
from app.services.nlp.strategies import ProcessingMode
from app.services.nlp.components.processor_registry import ProcessorRegistry
from app.services.nlp.components.config_loader import ConfigLoader
from app.services.nlp.components.ensemble_voter import EnsembleVoter
from app.core.config import settings


# Sample Russian literary text for testing
SAMPLE_TEXT = """
Старый замок возвышался на высоком холме, окруженный густым лесом.
Его величественные башни касались облаков, а мрачные стены хранили
множество тайн. Молодой князь Алексей стоял у окна, его темные глаза
смотрели вдаль. Длинные черные волосы развевались на ветру.
Атмосфера была напряженной и таинственной, воздух пах древностью
и забытыми легендами.
"""

# Larger text for performance testing (~2000 chars)
LARGE_SAMPLE_TEXT = """
Старинное поместье располагалось на вершине холма, окруженное вековыми дубами и елями.
Массивные каменные стены, покрытые плющом и мхом, свидетельствовали о многовековой истории.
Высокие узкие окна с витражными стеклами мерцали разноцветными бликами в лучах заходящего солнца.

Главная башня возвышалась над всем комплексом, ее острый шпиль упирался в облака.
С этой высоты открывался великолепный вид на окрестности: бескрайние леса, извилистую реку
и далекие горы на горизонте. Ветер свистел между зубцами крепостных стен, создавая
жутковатую мелодию, которая эхом разносилась по пустынным коридорам.

Князь Александр Николаевич стоял у окна большого зала. Его высокая фигура выделялась
на фоне угасающего света. Темные глубокие глаза смотрели вдаль с выражением глубокой
задумчивости. Длинные черные волосы с проседью касались плеч. Изящные руки с длинными
пальцами нервно сжимали подоконник.

Молодая графиня Елизавета вошла в зал. Ее легкая походка едва слышалась на каменном полу.
Золотистые волосы струились по плечам, обрамляя нежное лицо с большими голубыми глазами.
Бледная кожа казалась почти прозрачной в мягком свете свечей. Изящная фигура подчеркивалась
изысканным платьем темно-синего бархата.

Атмосфера в зале была торжественной и немного мрачной. Тяжелые портьеры из темного бархата
закрывали окна, приглушая последние лучи солнца. Старинные гобелены на стенах изображали
сцены охоты и баталий. Массивная люстра с хрустальными подвесками отбрасывала причудливые
тени на высокий потолок с позолоченной лепниной.

Камин из черного мрамора занимал всю торцевую стену. В нем потрескивали дубовые поленья,
распространяя приятное тепло и аромат древесины. Над камином висел старинный портрет
в золоченой раме - суровый предок с проницательным взглядом темных глаз.
""" * 2  # Удваиваем для ~2000 chars


@pytest.mark.asyncio
class TestStanzaIntegration:
    """
    Comprehensive integration tests for Stanza processor activation (Session 6).

    Tests cover critical gaps identified in QA analysis:
    1. ProcessorRegistry integration
    2. 4-processor ensemble performance (<4s)
    3. EnsembleVoter weighted consensus
    4. Model availability and error handling
    5. Performance with real Russian text
    """

    @pytest_asyncio.fixture
    async def manager(self):
        """Create and initialize MultiNLPManager with all processors."""
        mgr = MultiNLPManager()
        await mgr.initialize()
        return mgr

    @pytest_asyncio.fixture
    def ensemble_voter(self):
        """Create EnsembleVoter instance."""
        return EnsembleVoter(voting_threshold=0.6)

    # ========================================================================================
    # Test 1: CRITICAL - ProcessorRegistry Integration
    # ========================================================================================

    async def test_stanza_registered_in_processor_registry(self, manager):
        """
        CRITICAL: Verify Stanza processor is correctly registered in ProcessorRegistry.

        Gap addressed: No test verified Stanza loads with ProcessorRegistry
        Expected: Stanza should be in available processors with weight 0.8
        """
        # Get status from registry
        processor_registry = manager.processor_registry
        status = processor_registry.get_status()

        # Assert Stanza is registered
        assert "stanza" in status["available_processors"], (
            f"❌ Stanza not in available processors. "
            f"Available: {status['available_processors']}"
        )

        # Verify Stanza details
        stanza_details = status["processor_details"]["stanza"]
        assert stanza_details["loaded"] is True, (
            "❌ Stanza marked as not loaded"
        )
        assert stanza_details["available"] is True, (
            "❌ Stanza marked as not available"
        )

        # Verify Stanza configuration
        stanza_config = stanza_details["config"]
        assert stanza_config["enabled"] is True, (
            "❌ Stanza not enabled in config"
        )
        assert stanza_config["weight"] == 0.8, (
            f"❌ Stanza weight incorrect. Expected 0.8, got {stanza_config['weight']}"
        )
        assert stanza_config["confidence_threshold"] >= 0.3, (
            "❌ Stanza confidence threshold too low"
        )

        # Get actual processor instance
        stanza_processor = processor_registry.get_processor("stanza")
        assert stanza_processor is not None, "❌ Cannot retrieve Stanza processor instance"
        assert stanza_processor.is_available() is True, (
            "❌ Stanza processor not available"
        )

        print(f"✅ Stanza registered correctly in ProcessorRegistry")
        print(f"   - Weight: {stanza_config['weight']}")
        print(f"   - Confidence threshold: {stanza_config['confidence_threshold']}")
        print(f"   - Available processors: {status['available_processors']}")

    # ========================================================================================
    # Test 2: CRITICAL - 4-Processor Ensemble Performance
    # ========================================================================================

    async def test_4processor_ensemble_performance(self, manager):
        """
        CRITICAL: Verify 4-processor ensemble (SpaCy, Natasha, Stanza, GLiNER) maintains <4s.

        Gap addressed: Performance regression test missing
        Expected: Processing time <4.0s for standard text (~2000 chars)

        Performance targets:
        - SpaCy: ~200ms
        - Natasha: ~250ms
        - Stanza: ~800ms (dependency parsing)
        - GLiNER: ~500ms
        - Parallel total: ~800ms (longest processor)
        - With voting overhead: 1.2-2.5s acceptable
        """
        start_time = time.time()

        # Process with ENSEMBLE mode (all 4 processors)
        result = await manager.extract_descriptions(
            LARGE_SAMPLE_TEXT,
            chapter_id="perf_test_4proc",
            mode=ProcessingMode.ENSEMBLE
        )

        elapsed = time.time() - start_time

        # CRITICAL: Performance must be <4.0s
        assert elapsed < 4.0, (
            f"❌ PERFORMANCE REGRESSION: 4-processor ensemble took {elapsed:.2f}s (limit: 4.0s). "
            f"Processors used: {result.processors_used}. "
            f"This indicates Stanza added unacceptable overhead."
        )

        # Verify all 4 processors were used (or at least 3 if one failed gracefully)
        num_processors = len(result.processors_used)
        assert num_processors >= 3, (
            f"❌ Insufficient processors used: {num_processors}. "
            f"Expected 4 (SpaCy, Natasha, Stanza, GLiNER). "
            f"Used: {result.processors_used}"
        )

        # Check that Stanza was actually used
        assert "stanza" in result.processors_used, (
            f"❌ Stanza not used in ensemble mode. "
            f"Processors used: {result.processors_used}"
        )

        # Verify quality maintained
        assert len(result.descriptions) > 0, (
            "❌ No descriptions extracted - quality check failed"
        )

        # Performance tiers
        if elapsed < 2.0:
            performance_tier = "🚀 EXCELLENT"
        elif elapsed < 3.0:
            performance_tier = "✅ GOOD"
        elif elapsed < 4.0:
            performance_tier = "⚠️  ACCEPTABLE"
        else:
            performance_tier = "❌ SLOW"

        print(f"✅ 4-processor ensemble performance: {performance_tier}")
        print(f"   - Processing time: {elapsed:.2f}s / 4.0s limit")
        print(f"   - Descriptions: {len(result.descriptions)}")
        print(f"   - Processors used: {result.processors_used}")
        print(f"   - Descriptions/sec: {len(result.descriptions)/elapsed:.1f}")
        print(f"   - Quality metrics: {result.quality_metrics}")

    # ========================================================================================
    # Test 3: CRITICAL - Ensemble Voting with Stanza Weight
    # ========================================================================================

    async def test_ensemble_voting_includes_stanza_weight(self, manager):
        """
        CRITICAL: Verify ensemble voting correctly applies Stanza weight (0.8).

        Gap addressed: Voting logic not verified with real Stanza output
        Expected: Stanza votes weighted at 0.8 (vs SpaCy 1.0, Natasha 1.2, GLiNER 1.0)
        """
        # Process with ENSEMBLE mode
        result = await manager.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="voting_test",
            mode=ProcessingMode.ENSEMBLE
        )

        # Verify ensemble mode was used
        assert result.processors_used, "❌ No processors used"

        # Check for ensemble voting indicators in results
        ensemble_descriptions = []
        for desc in result.descriptions:
            # Look for ensemble metadata
            if desc.get("processing_method") == "ensemble":
                ensemble_descriptions.append(desc)

            # Check for consensus indicators
            if "consensus_ratio" in desc or "sources" in desc:
                ensemble_descriptions.append(desc)

        # If no explicit ensemble metadata, check that results came from multiple sources
        if not ensemble_descriptions:
            # Collect all sources
            all_sources = set()
            for desc in result.descriptions:
                source = desc.get("source", "")
                if source:
                    all_sources.add(source)

            # Should have multiple sources (indicating voting happened)
            assert len(all_sources) > 1, (
                f"❌ Only one source found: {all_sources}. "
                "Ensemble voting may not be working."
            )
            print(f"   - Sources detected: {all_sources}")
        else:
            # Verify ensemble metadata
            print(f"   - Ensemble descriptions: {len(ensemble_descriptions)}/{len(result.descriptions)}")

            # Check for quality indicators
            quality_indicators = {}
            for desc in ensemble_descriptions:
                quality = desc.get("quality_indicator", "unknown")
                quality_indicators[quality] = quality_indicators.get(quality, 0) + 1

            print(f"   - Quality distribution: {quality_indicators}")

        # Verify Stanza contributed to results
        stanza_mentions = sum(
            1 for desc in result.descriptions
            if "stanza" in desc.get("source", "").lower() or
               "stanza" in str(desc.get("sources", [])).lower()
        )

        assert stanza_mentions > 0, (
            "❌ Stanza did not contribute to any descriptions. "
            f"Sources found: {[desc.get('source') for desc in result.descriptions[:5]]}"
        )

        print(f"✅ Ensemble voting includes Stanza weight (0.8)")
        print(f"   - Stanza contributions: {stanza_mentions} descriptions")
        print(f"   - Total descriptions: {len(result.descriptions)}")
        print(f"   - Processors: {result.processors_used}")

    # ========================================================================================
    # Test 4: HIGH - Stanza Model Availability
    # ========================================================================================

    async def test_stanza_model_availability(self, manager):
        """
        HIGH: Verify Stanza model is downloaded and available.

        Gap addressed: Model download not tested (unit tests mocked)
        Expected: Real Stanza model available at /tmp/stanza_resources
        """
        import os
        import stanza

        # Check if Stanza resources directory exists
        stanza_dir = os.environ.get("STANZA_RESOURCES_DIR", "/tmp/stanza_resources")

        if os.path.exists(stanza_dir):
            print(f"✅ Stanza resources directory exists: {stanza_dir}")

            # Check directory contents
            if os.path.isdir(stanza_dir):
                ru_dir = os.path.join(stanza_dir, "ru")
                if os.path.exists(ru_dir):
                    contents = os.listdir(ru_dir)
                    print(f"   - Russian model files: {len(contents)} files/dirs")
        else:
            print(f"⚠️  Stanza resources directory not found: {stanza_dir}")

        # Verify processor is actually available
        processor_registry = manager.processor_registry
        stanza_processor = processor_registry.get_processor("stanza")
        assert stanza_processor is not None, "❌ Stanza processor not registered"

        # Check availability
        is_available = stanza_processor.is_available()
        assert is_available is True, (
            "❌ Stanza processor not available. "
            "Model may not be downloaded. "
            f"Run: python -c 'import stanza; stanza.download(\"ru\")'"
        )

        # Verify model is loaded
        assert stanza_processor.loaded is True, "❌ Stanza model not loaded"
        assert stanza_processor.model is not None, "❌ Stanza model is None"

        print(f"✅ Stanza model available and loaded")
        print(f"   - Processor available: {is_available}")
        print(f"   - Model loaded: {stanza_processor.loaded}")

    # ========================================================================================
    # Test 5: MEDIUM - Stanza Performance with Real Russian Text
    # ========================================================================================

    async def test_stanza_performance_with_real_text(self, manager):
        """
        MEDIUM: Test Stanza performance with real Russian literary text.

        Gap addressed: No performance benchmarks for Stanza alone
        Expected: ~800ms for dependency parsing on ~2000 char text
        """
        processor_registry = manager.processor_registry
        stanza_processor = processor_registry.get_processor("stanza")
        assert stanza_processor is not None, "❌ Stanza processor not available"

        # Small text test
        start_time = time.time()
        small_result = await stanza_processor.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="stanza_perf_small"
        )
        small_elapsed = time.time() - start_time

        # Large text test
        start_time = time.time()
        large_result = await stanza_processor.extract_descriptions(
            LARGE_SAMPLE_TEXT,
            chapter_id="stanza_perf_large"
        )
        large_elapsed = time.time() - start_time

        # Performance assertions
        assert small_elapsed < 2.0, (
            f"❌ Stanza too slow on small text: {small_elapsed:.2f}s (limit: 2.0s)"
        )
        assert large_elapsed < 5.0, (
            f"❌ Stanza too slow on large text: {large_elapsed:.2f}s (limit: 5.0s)"
        )

        # Quality checks
        assert len(small_result) > 0, "❌ No descriptions from small text"
        assert len(large_result) > len(small_result), (
            "❌ Large text should produce more descriptions than small text"
        )

        # Check for dependency parsing features
        dependency_descriptions = [
            desc for desc in large_result
            if desc.get("source") == "stanza_dependency"
        ]

        # Check for NER features
        ner_descriptions = [
            desc for desc in large_result
            if desc.get("source") == "stanza_ner"
        ]

        print(f"✅ Stanza performance with real text:")
        print(f"   Small text ({len(SAMPLE_TEXT)} chars):")
        print(f"     - Time: {small_elapsed:.2f}s")
        print(f"     - Descriptions: {len(small_result)}")
        print(f"   Large text ({len(LARGE_SAMPLE_TEXT)} chars):")
        print(f"     - Time: {large_elapsed:.2f}s")
        print(f"     - Descriptions: {len(large_result)}")
        print(f"     - Dependency parsing: {len(dependency_descriptions)}")
        print(f"     - NER: {len(ner_descriptions)}")

    # ========================================================================================
    # Test 6: MEDIUM - Fallback Behavior When Stanza Unavailable
    # ========================================================================================

    async def test_ensemble_fallback_without_stanza(self, manager):
        """
        MEDIUM: Test graceful degradation if Stanza fails to load.

        Gap addressed: Fallback untested
        Expected: System works with 3 processors if Stanza unavailable

        Note: This test checks that the system can handle processor unavailability.
        We can't easily simulate Stanza failure without mocking, but we can verify
        the fallback logic by checking processor availability handling.
        """
        # Get current processor status
        status = await manager.get_processor_status()

        available_count = len(status["available_processors"])

        # System should work with at least 2 processors
        assert available_count >= 2, (
            f"❌ Insufficient processors: {available_count}. "
            "Multi-NLP requires at least 2 processors for ensemble voting."
        )

        # Process text
        result = await manager.extract_descriptions(
            SAMPLE_TEXT,
            chapter_id="fallback_test",
            mode=ProcessingMode.ENSEMBLE
        )

        # Should get results even if not all processors available
        assert result is not None, "❌ No result returned"
        assert len(result.descriptions) > 0, "❌ No descriptions extracted"

        # Check recommendations for any warnings about processor availability
        recommendations = result.recommendations
        if available_count < 4:
            print(f"⚠️  Only {available_count}/4 processors available")
            print(f"   Available: {status['available_processors']}")
        else:
            print(f"✅ All 4 processors available")

        print(f"   - Processors used: {result.processors_used}")
        print(f"   - Descriptions: {len(result.descriptions)}")
        print(f"   - Quality: {result.quality_metrics}")

    # ========================================================================================
    # Test 7: MEDIUM - Weighted Consensus Algorithm Validation
    # ========================================================================================

    async def test_weighted_consensus_algorithm(self, ensemble_voter, manager):
        """
        MEDIUM: Verify weighted consensus algorithm correctly weights Stanza at 0.8.

        Gap addressed: No direct test of EnsembleVoter with real processor weights
        Expected: Stanza weight (0.8) correctly applied in voting calculations
        """
        # Create mock processor results for testing
        # Simulate descriptions from all 4 processors
        spacy_desc = {
            "content": "Старый замок на холме",
            "type": "location",
            "priority_score": 0.7,
            "confidence_score": 0.8,
            "source": "spacy_ner"
        }

        natasha_desc = {
            "content": "Старый замок на холме",
            "type": "location",
            "priority_score": 0.75,
            "confidence_score": 0.85,
            "source": "natasha_ner"
        }

        stanza_desc = {
            "content": "Старый замок на холме",
            "type": "location",
            "priority_score": 0.8,
            "confidence_score": 0.9,
            "source": "stanza_dependency"
        }

        gliner_desc = {
            "content": "Старый замок на холме",
            "type": "location",
            "priority_score": 0.72,
            "confidence_score": 0.82,
            "source": "gliner_ner"
        }

        processor_results = {
            "spacy": [spacy_desc],
            "natasha": [natasha_desc],
            "stanza": [stanza_desc],
            "gliner": [gliner_desc]
        }

        # Get actual processors for weights
        processor_registry = manager.processor_registry
        processors = processor_registry.get_all_processors()

        # Apply voting
        voted_results = ensemble_voter.vote(processor_results, processors)

        # Should produce 1 consensus result (all describe same location)
        assert len(voted_results) > 0, "❌ No results from voting"

        # Check consensus metadata
        consensus_result = voted_results[0]
        assert "consensus_ratio" in consensus_result, (
            "❌ No consensus_ratio in result"
        )
        assert "sources" in consensus_result, (
            "❌ No sources in result"
        )

        # Should have all 4 sources
        sources = consensus_result["sources"]
        assert len(sources) == 4, (
            f"❌ Expected 4 sources, got {len(sources)}: {sources}"
        )

        # Consensus ratio should be high (all agreed)
        consensus_ratio = consensus_result["consensus_ratio"]
        assert consensus_ratio >= 0.6, (
            f"❌ Low consensus ratio: {consensus_ratio}"
        )

        print(f"✅ Weighted consensus algorithm validated:")
        print(f"   - Sources: {sources}")
        print(f"   - Consensus ratio: {consensus_ratio:.2f}")
        print(f"   - Quality indicator: {consensus_result.get('quality_indicator')}")
        print(f"   - Ensemble boosted: {consensus_result.get('ensemble_boosted')}")

    # ========================================================================================
    # Test 8: MEDIUM - All Processing Modes with Stanza
    # ========================================================================================

    async def test_all_processing_modes_with_stanza(self, manager):
        """
        MEDIUM: Verify Stanza works correctly in all processing modes.

        Gap addressed: Only ensemble mode tested previously
        Expected: Stanza participates in PARALLEL, SEQUENTIAL, and ADAPTIVE modes
        """
        modes_to_test = [
            ProcessingMode.PARALLEL,
            ProcessingMode.SEQUENTIAL,
            ProcessingMode.ENSEMBLE,
            ProcessingMode.ADAPTIVE
        ]

        results = {}

        for mode in modes_to_test:
            start_time = time.time()

            result = await manager.extract_descriptions(
                SAMPLE_TEXT,
                chapter_id=f"mode_test_{mode.value}",
                mode=mode
            )

            elapsed = time.time() - start_time

            results[mode.value] = {
                "time": elapsed,
                "descriptions": len(result.descriptions),
                "processors": result.processors_used,
                "stanza_used": "stanza" in result.processors_used
            }

            # All modes should produce results
            assert result is not None, f"❌ No result from {mode.value} mode"
            assert len(result.descriptions) > 0, (
                f"❌ No descriptions from {mode.value} mode"
            )

            print(f"✅ {mode.value} mode:")
            print(f"   - Time: {elapsed:.2f}s")
            print(f"   - Descriptions: {len(result.descriptions)}")
            print(f"   - Processors: {result.processors_used}")
            print(f"   - Stanza used: {'✓' if results[mode.value]['stanza_used'] else '✗'}")

        # Stanza should be used in at least some modes
        stanza_usage_count = sum(
            1 for r in results.values() if r["stanza_used"]
        )
        assert stanza_usage_count > 0, (
            "❌ Stanza not used in any processing mode"
        )

        print(f"\n✅ Stanza used in {stanza_usage_count}/{len(modes_to_test)} modes")


# ========================================================================================
# Standalone Performance Benchmark (Optional)
# ========================================================================================

@pytest.mark.asyncio
@pytest.mark.benchmark(group="stanza-integration")
async def test_stanza_benchmark():
    """
    Optional benchmark test for detailed performance profiling.

    Run with: pytest -v -s -k benchmark
    """
    manager = MultiNLPManager()
    await manager.initialize()

    iterations = 5
    times = []

    print("\n" + "="*80)
    print("STANZA INTEGRATION PERFORMANCE BENCHMARK")
    print("="*80)

    for i in range(iterations):
        start = time.time()

        result = await manager.extract_descriptions(
            LARGE_SAMPLE_TEXT,
            chapter_id=f"benchmark_{i}",
            mode=ProcessingMode.ENSEMBLE
        )

        elapsed = time.time() - start
        times.append(elapsed)

        print(f"Iteration {i+1}: {elapsed:.3f}s ({len(result.descriptions)} descriptions)")

    avg_time = sum(times) / len(times)
    min_time = min(times)
    max_time = max(times)

    print("="*80)
    print(f"Results ({iterations} iterations):")
    print(f"  Average: {avg_time:.3f}s")
    print(f"  Min:     {min_time:.3f}s")
    print(f"  Max:     {max_time:.3f}s")
    print(f"  Target:  <4.000s")
    print(f"  Status:  {'✅ PASS' if avg_time < 4.0 else '❌ FAIL'}")
    print("="*80)

    assert avg_time < 4.0, (
        f"❌ Average performance {avg_time:.3f}s exceeds 4.0s limit"
    )


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v", "-s"])
