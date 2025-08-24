#!/usr/bin/env python3
"""
Ручной запуск обработки книги
"""

import sys
import os
import asyncio
from uuid import UUID

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.book import Book
from app.core.tasks import process_book_task
from sqlalchemy import select

async def main():
    print("=" * 60)
    print("РУЧНАЯ ОБРАБОТКА КНИГ")
    print("=" * 60)
    
    async with AsyncSessionLocal() as db:
        # Получаем все книги
        result = await db.execute(select(Book))
        books = result.scalars().all()
        
        if not books:
            print("❌ Книги не найдены в базе данных")
            return
        
        print(f"\n✅ Найдено книг: {len(books)}")
        print("-" * 60)
        
        for i, book in enumerate(books, 1):
            print(f"{i}. {book.title} by {book.author}")
            print(f"   ID: {book.id}")
            print(f"   Глав: {len(book.chapters)}")
            print(f"   Обработано: {'✅' if book.is_parsed else '❌'}")
            
            if not book.is_parsed:
                print(f"   🔄 Запускаем обработку...")
                try:
                    # Запускаем Celery задачу
                    task = process_book_task.delay(str(book.id))
                    print(f"   ✅ Задача запущена: {task.id}")
                except Exception as e:
                    print(f"   ❌ Ошибка запуска: {e}")
                    # Альтернатива - прямой вызов без Celery
                    print(f"   🔄 Пробуем прямую обработку...")
                    from app.core.tasks import _process_book_async
                    result = await _process_book_async(book.id)
                    print(f"   ✅ Обработано: {result['descriptions_found']} описаний найдено")
    
    print("\n" + "=" * 60)
    print("ОБРАБОТКА ЗАВЕРШЕНА")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())