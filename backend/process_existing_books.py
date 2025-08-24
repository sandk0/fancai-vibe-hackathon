#!/usr/bin/env python3
"""
Скрипт для обработки существующих книг и извлечения описаний.
"""

import sys
import os
import asyncio
from uuid import UUID
from typing import List

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.book import Book
from app.models.chapter import Chapter
from app.models.description import Description
from app.services.nlp_processor import nlp_processor
from sqlalchemy import select
from sqlalchemy.orm import selectinload

async def process_book_descriptions(book_id: UUID) -> int:
    """Обрабатывает описания для одной книги."""
    descriptions_count = 0
    
    async with AsyncSessionLocal() as db:
        # Получаем книгу с главами
        result = await db.execute(
            select(Book)
            .options(selectinload(Book.chapters))
            .where(Book.id == book_id)
        )
        book = result.scalar_one_or_none()
        
        if not book:
            print(f"❌ Книга {book_id} не найдена")
            return 0
            
        print(f"📖 Обрабатываем: {book.title}")
        print(f"   Глав: {len(book.chapters)}")
        
        for chapter in book.chapters:
            if chapter.is_description_parsed:
                print(f"   ⏭️  Глава {chapter.chapter_number} уже обработана")
                continue
                
            print(f"   🔄 Обрабатываем главу {chapter.chapter_number}: {chapter.title}")
            
            # Извлекаем описания с помощью NLP
            try:
                descriptions_data = nlp_processor.extract_descriptions_from_text(
                    text=chapter.content,
                    chapter_id=str(chapter.id)
                )
                
                print(f"      Найдено описаний: {len(descriptions_data)}")
                
                # Создаём объекты описаний
                for desc_data in descriptions_data:
                    description = Description(
                        chapter_id=chapter.id,
                        type=desc_data["type"],
                        content=desc_data["content"],
                        context=desc_data.get("context", ""),
                        confidence_score=desc_data["confidence_score"],
                        priority_score=desc_data["priority_score"],
                        position_in_chapter=desc_data.get("position_in_chapter", 0),
                        word_count=len(desc_data["content"].split()),
                        entities_mentioned=desc_data.get("entities_mentioned", []),
                        emotional_tone=desc_data.get("emotional_tone", "neutral"),
                        complexity_level=desc_data.get("complexity_level", "medium"),
                        is_suitable_for_generation=desc_data.get("confidence_score", 0) >= 0.3
                    )
                    db.add(description)
                    descriptions_count += 1
                
                # Обновляем статус главы
                chapter.is_description_parsed = True
                chapter.descriptions_found = len(descriptions_data)
                chapter.parsing_progress = 100.0
                
                print(f"      ✅ Сохранено {len(descriptions_data)} описаний")
                
            except Exception as e:
                print(f"      ❌ Ошибка обработки: {str(e)}")
                continue
        
        # Сохраняем изменения
        await db.commit()
        
        # Обновляем статус книги
        book.is_parsed = True
        await db.commit()
        
    return descriptions_count

async def main():
    print("=" * 60)
    print("ОБРАБОТКА СУЩЕСТВУЮЩИХ КНИГ")
    print("=" * 60)
    
    if not nlp_processor.is_available():
        print("❌ NLP процессор не доступен!")
        print("Загружаем модели...")
        nlp_processor.load_models()
    
    print("✅ NLP процессор готов")
    
    async with AsyncSessionLocal() as db:
        # Получаем все книги
        result = await db.execute(select(Book))
        books = result.scalars().all()
        
        if not books:
            print("❌ Книги не найдены в базе данных")
            return
        
        print(f"\n✅ Найдено книг: {len(books)}")
        print("-" * 60)
        
        total_descriptions = 0
        processed_books = 0
        
        for book in books:
            try:
                descriptions_count = await process_book_descriptions(book.id)
                total_descriptions += descriptions_count
                processed_books += 1
                print(f"✅ Книга обработана: {descriptions_count} описаний")
                
            except Exception as e:
                print(f"❌ Ошибка обработки книги {book.title}: {str(e)}")
                continue
    
    print("\n" + "=" * 60)
    print("ОБРАБОТКА ЗАВЕРШЕНА")
    print(f"Обработано книг: {processed_books}")
    print(f"Всего описаний: {total_descriptions}")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())