#!/usr/bin/env python3
"""
Тест для проверки всех 3 NLP процессоров после исправления Dockerfile.
Ожидаемый результат: SpaCy, Natasha, Stanza все работают.
"""

import asyncio
import sys
from app.services.multi_nlp_manager import multi_nlp_manager


async def test_processors():
    """Тест всех процессоров Multi-NLP системы."""

    print("=" * 70)
    print("TESTING MULTI-NLP PROCESSORS")
    print("=" * 70)
    print()

    # 1. Инициализация
    print("1️⃣  Initializing Multi-NLP Manager...")
    try:
        await multi_nlp_manager.initialize()
        print("   ✅ Initialization successful\n")
    except Exception as e:
        print(f"   ❌ Initialization failed: {e}\n")
        sys.exit(1)

    # 2. Проверка статуса
    print("2️⃣  Checking processor status...")
    status = await multi_nlp_manager.get_processor_status()

    available_processors = status.get('available_processors', [])
    processor_details = status.get('processor_details', {})

    print(f"   Mode: {status.get('processing_mode')}")
    print(f"   Available processors: {available_processors}")
    print(f"   Total: {len(available_processors)}/3\n")

    # 3. Детальная проверка каждого процессора
    print("3️⃣  Detailed processor status:")
    print()

    expected_processors = ['spacy', 'natasha', 'stanza']
    all_working = True

    for proc_name in expected_processors:
        if proc_name in processor_details:
            details = processor_details[proc_name]
            loaded = details.get('loaded', False)
            available = details.get('available', False)

            status_icon = "✅" if (loaded and available) else "❌"
            status_text = "WORKING" if (loaded and available) else "FAILED"

            print(f"   {status_icon} {proc_name.upper()}: {status_text}")
            print(f"      Loaded: {loaded}")
            print(f"      Available: {available}")

            if not (loaded and available):
                all_working = False
        else:
            print(f"   ❌ {proc_name.upper()}: NOT FOUND")
            all_working = False

        print()

    # 4. Тест обработки текста
    print("4️⃣  Testing description extraction...")
    print()

    test_text = """
    Темный дремучий лес окружал старую каменную крепость.
    Высокий воин в серебряных доспехах стоял на страже у ворот.
    Воздух был наполнен таинственным туманом и запахом сосен.
    """

    try:
        result = await multi_nlp_manager.extract_descriptions(
            text=test_text,
            mode=None  # Используем дефолтный режим
        )

        descriptions = result.descriptions if hasattr(result, 'descriptions') else result

        print(f"   Extracted {len(descriptions)} descriptions")
        print(f"   Processors used: {result.processors_used if hasattr(result, 'processors_used') else 'N/A'}")
        print()

        if len(descriptions) > 0:
            print("   Sample descriptions:")
            for i, desc in enumerate(descriptions[:3], 1):
                content = desc.get('content', desc.get('text', 'N/A'))
                desc_type = desc.get('type', 'unknown')
                confidence = desc.get('confidence_score', 0.0)

                print(f"   {i}. [{desc_type}] {content[:60]}...")
                print(f"      Confidence: {confidence:.2f}")
                print()
    except Exception as e:
        print(f"   ❌ Description extraction failed: {e}\n")
        all_working = False

    # 5. Итоговая оценка
    print("=" * 70)
    print("FINAL RESULT")
    print("=" * 70)
    print()

    if all_working and len(available_processors) == 3:
        print("   ✅ ALL TESTS PASSED!")
        print("   ✅ All 3 processors (SpaCy, Natasha, Stanza) are working")
        print("   ✅ Multi-NLP system is FIXED!")
        print()
        print("   Expected precision: 80%+")
        print("   Expected descriptions: 2000+ per book")
        return 0
    else:
        print("   ❌ SOME TESTS FAILED")
        print(f"   ❌ Working processors: {len(available_processors)}/3")
        print("   ❌ Multi-NLP system needs more fixes")
        print()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(test_processors())
    sys.exit(exit_code)
