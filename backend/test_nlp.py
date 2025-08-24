#!/usr/bin/env python3
"""
Тестовый скрипт для проверки NLP процессора
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.services.nlp_processor import nlp_processor

# Тестовый текст с описаниями
test_text = """
Глава 1. Начало путешествия

Старый замок возвышался на холме, окруженный густым туманом. Его серые каменные стены, покрытые плющом, 
хранили множество тайн. В главной башне горел одинокий огонек, бросая тусклый свет на мрачные окрестности.

Рыцарь в сияющих доспехах медленно поднимался по извилистой тропе. Его лицо было скрыто под тяжелым шлемом, 
а в руке он держал меч с рубиновой рукоятью. За его спиной развевался алый плащ.

В воздухе витал запах дождя и мокрой земли. Атмосфера была пропитана тревогой и ожиданием. 
Где-то вдали раздавался вой волков, эхом отражаясь от скал.

Внезапно из тумана появилась фигура в черном капюшоне. Таинственный незнакомец медленно приближался, 
его шаги не издавали ни звука на влажной траве.
"""

# Проверяем доступность NLP процессора
print("=" * 60)
print("ТЕСТИРОВАНИЕ NLP ПРОЦЕССОРА")
print("=" * 60)

if not nlp_processor.is_available():
    print("❌ NLP процессор не доступен!")
    print("Загрузка моделей...")
    nlp_processor.load_models()
    
print(f"✅ NLP процессор готов")

# Извлекаем описания
print("\n" + "=" * 60)
print("ИЗВЛЕЧЕНИЕ ОПИСАНИЙ")
print("=" * 60)

descriptions = nlp_processor.extract_descriptions_from_text(test_text, "test_chapter")

print(f"\nНайдено описаний: {len(descriptions)}")
print("-" * 60)

for i, desc in enumerate(descriptions, 1):
    print(f"\n{i}. Тип: {desc['type'].value}")
    print(f"   Текст: {desc['content'][:100]}...")
    print(f"   Уверенность: {desc['confidence_score']:.2f}")
    print(f"   Приоритет: {desc['priority_score']:.2f}")
    if desc['entities_mentioned']:
        print(f"   Сущности: {', '.join(desc['entities_mentioned'])}")

print("\n" + "=" * 60)
print("ТЕСТ ЗАВЕРШЕН")
print("=" * 60)