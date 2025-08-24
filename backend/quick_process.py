#!/usr/bin/env python3
"""
Быстрая обработка одной главы для теста.
"""

import sys
import os
import asyncio
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.book import Book
from app.models.chapter import Chapter
from app.models.description import Description, DescriptionType
from app.services.nlp_processor import nlp_processor
from sqlalchemy import select

async def process_single_chapter():
    """Обрабатывает одну главу для быстрого теста."""
    
    async with AsyncSessionLocal() as db:
        # Получаем первую главу первой книги
        result = await db.execute(
            select(Chapter)
            .join(Book)
            .where(Book.title.like('%Ведьмак%'))
            .where(Chapter.chapter_number == 1)
            .limit(1)
        )
        
        chapter = result.scalar_one_or_none()
        if not chapter:
            print("❌ Глава не найдена")
            return
        
        print(f"🔄 Обрабатываем главу: {chapter.title}")
        print(f"   Контент: {len(chapter.content)} символов")
        
        # Извлекаем описания с помощью NLP
        try:
            descriptions_data = nlp_processor.extract_descriptions_from_text(
                text=chapter.content[:5000],  # Берём только первые 5000 символов для быстрого теста
                chapter_id=str(chapter.id)
            )
            
            print(f"✅ Найдено описаний: {len(descriptions_data)}")
            
            # Создаём объекты описаний
            for desc_data in descriptions_data:
                description = Description(
                    chapter_id=chapter.id,
                    type=desc_data["type"],
                    content=desc_data["content"],
                    confidence_score=desc_data["confidence_score"],
                    priority_score=desc_data["priority_score"],
                    position_in_chapter=0,
                    word_count=len(desc_data["content"].split()),
                    entities_mentioned=json.dumps(desc_data.get("entities_mentioned", []), ensure_ascii=False),
                    is_suitable_for_generation=desc_data.get("confidence_score", 0) >= 0.3
                )
                db.add(description)
            
            # Обновляем статус главы
            chapter.is_description_parsed = True
            chapter.descriptions_found = len(descriptions_data)
            
            await db.commit()
            print(f"✅ Сохранено {len(descriptions_data)} описаний")
            
            # Показываем несколько примеров
            for i, desc in enumerate(descriptions_data[:3]):
                print(f"   {i+1}. {desc['type'].value}: {desc['content'][:80]}...")
                
        except Exception as e:
            print(f"❌ Ошибка: {str(e)}")
            await db.rollback()

if __name__ == "__main__":
    print("=" * 60)
    print("БЫСТРАЯ ОБРАБОТКА ОДНОЙ ГЛАВЫ")
    print("=" * 60)
    
    if not nlp_processor.is_available():
        print("Загружаем NLP модели...")
        nlp_processor.load_models()
    
    print("✅ NLP готов")
    asyncio.run(process_single_chapter())