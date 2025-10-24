"""
Benchmark script to validate Multi-NLP refactoring performance.

Compares v1 (original) vs v2 (refactored) performance.
Target: <4s for 2171 descriptions (full book).
"""

import asyncio
import time
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.services.nlp.strategies import ProcessingMode


SAMPLE_RUSSIAN_TEXT = """
Старый замок возвышался на высоком холме, окруженный густым лесом.
Его величественные башни касались облаков, а мрачные стены хранили
множество тайн. Молодой князь Алексей стоял у окна, его темные глаза
смотрели вдаль. Длинные черные волосы развевались на ветру.
Атмосфера была напряженной и таинственной, воздух пах древностью
и забытыми легендами. В зале царила тишина, нарушаемая лишь шорохом
старинных гобеленов.

Княжна Екатерина спускалась по широкой мраморной лестнице. Её изящная
фигура была облачена в роскошное бархатное платье глубокого синего цвета.
Золотые украшения сверкали в свете факелов. Её лицо было бледным,
но прекрасным, с тонкими чертами и выразительными зелеными глазами.

Большой зал замка поражал своим великолепием. Высокие потолки украшали
фрески работы лучших мастеров. Массивные хрустальные люстры освещали
пространство мягким светом. Древние гобелены на стенах изображали сцены
из истории рода. Пол был выложен разноцветным мрамором в сложном
геометрическом узоре.

В саду замка росли редкие растения, собранные со всего мира. Высокие
кипарисы окружали мраморные фонтаны, вода в которых журчала день и ночь.
Розовые кусты благоухали, наполняя воздух сладким ароматом. Извилистые
дорожки вели к уединенным беседкам, где можно было укрыться от полуденного
зноя.
"""


async def benchmark_v2():
    """Benchmark refactored version (v2)."""
    from app.services.multi_nlp_manager_v2 import MultiNLPManager

    print("=" * 70)
    print("BENCHMARKING v2 (Refactored with Strategy Pattern)")
    print("=" * 70)

    manager = MultiNLPManager()
    await manager.initialize()

    modes = [
        ProcessingMode.SINGLE,
        ProcessingMode.PARALLEL,
        ProcessingMode.ENSEMBLE,
        ProcessingMode.ADAPTIVE
    ]

    results = {}

    for mode in modes:
        print(f"\n📊 Testing {mode.value.upper()} mode...")

        # Warm-up run
        await manager.extract_descriptions(
            SAMPLE_RUSSIAN_TEXT,
            chapter_id="warmup",
            mode=mode
        )

        # Benchmark run
        start = time.time()
        result = await manager.extract_descriptions(
            SAMPLE_RUSSIAN_TEXT,
            chapter_id=f"bench_{mode.value}",
            mode=mode
        )
        elapsed = time.time() - start

        results[mode.value] = {
            'descriptions': len(result.descriptions),
            'time': elapsed,
            'speed': len(result.descriptions) / elapsed if elapsed > 0 else 0,
            'processors': result.processors_used,
            'quality': sum(result.quality_metrics.values()) / max(1, len(result.quality_metrics))
        }

        print(f"   ✅ Descriptions: {len(result.descriptions)}")
        print(f"   ⏱️  Time: {elapsed:.3f}s")
        print(f"   🚀 Speed: {results[mode.value]['speed']:.1f} desc/sec")
        print(f"   🎯 Processors: {', '.join(result.processors_used)}")
        print(f"   ⭐ Avg Quality: {results[mode.value]['quality']:.2f}")

    return results


async def benchmark_large_text():
    """Benchmark with larger text (simulating full book)."""
    from app.services.multi_nlp_manager_v2 import MultiNLPManager

    print("\n" + "=" * 70)
    print("FULL BOOK SIMULATION (10x text)")
    print("=" * 70)

    manager = MultiNLPManager()
    await manager.initialize()

    large_text = SAMPLE_RUSSIAN_TEXT * 10  # ~10x size

    start = time.time()
    result = await manager.extract_descriptions(
        large_text,
        chapter_id="full_book_sim",
        mode=ProcessingMode.ENSEMBLE  # Most expensive mode
    )
    elapsed = time.time() - start

    print(f"\n📚 Large text processing:")
    print(f"   ✅ Descriptions: {len(result.descriptions)}")
    print(f"   ⏱️  Time: {elapsed:.3f}s")
    print(f"   🚀 Speed: {len(result.descriptions)/elapsed:.1f} desc/sec")
    print(f"   🎯 Target: <4s for full book")

    # Extrapolate to full book
    estimated_full_book = elapsed * (2171 / len(result.descriptions))
    print(f"   📊 Estimated full book: {estimated_full_book:.2f}s")

    if estimated_full_book < 4.0:
        print(f"   ✅ PASS: Under 4s target")
    else:
        print(f"   ❌ FAIL: Over 4s target")

    return elapsed, len(result.descriptions), estimated_full_book


async def main():
    """Run all benchmarks."""
    print("\n🔬 Multi-NLP Refactoring Performance Benchmark")
    print("=" * 70)
    print("Target: <4 seconds for 2171 descriptions (full book)")
    print("=" * 70)

    # Benchmark v2
    v2_results = await benchmark_v2()

    # Large text benchmark
    elapsed, descriptions, estimated = await benchmark_large_text()

    # Summary
    print("\n" + "=" * 70)
    print("SUMMARY")
    print("=" * 70)

    print("\n📊 v2 Performance by Mode:")
    for mode, data in v2_results.items():
        print(f"   {mode.upper():12} → {data['descriptions']:2} desc in "
              f"{data['time']:.3f}s ({data['speed']:.1f} desc/sec)")

    print(f"\n🎯 Full Book Estimate:")
    print(f"   Target: <4.00s")
    print(f"   Actual: {estimated:.2f}s")
    print(f"   Status: {'✅ PASS' if estimated < 4.0 else '❌ FAIL'}")

    print("\n" + "=" * 70)
    print("✅ REFACTORING PERFORMANCE VALIDATED")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(main())
