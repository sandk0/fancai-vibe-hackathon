#!/usr/bin/env python3
"""
Финальная проверка всех систем fancai.
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.description import Description
from app.models.image import GeneratedImage
from app.models.book import Book
from app.models.chapter import Chapter
from app.models.user import User
from sqlalchemy import select

async def final_system_test():
    """Проводит финальную проверку всех систем."""
    
    print("🔍 ФИНАЛЬНАЯ ПРОВЕРКА СИСТЕМЫ")
    print("=" * 50)
    
    async with AsyncSessionLocal() as db:
        # 1. Проверяем пользователей
        users_result = await db.execute(select(User))
        users_count = len(users_result.scalars().all())
        print(f"👤 Пользователи: {users_count}")
        
        # 2. Проверяем книги
        books_result = await db.execute(select(Book))
        books = books_result.scalars().all()
        books_count = len(books)
        print(f"📚 Книги: {books_count}")
        
        # 3. Проверяем главы
        chapters_result = await db.execute(select(Chapter))
        chapters_count = len(chapters_result.scalars().all())
        print(f"📄 Главы: {chapters_count}")
        
        # 4. Проверяем описания
        descriptions_result = await db.execute(select(Description))
        descriptions = descriptions_result.scalars().all()
        descriptions_count = len(descriptions)
        print(f"📝 Описания: {descriptions_count}")
        
        # 5. Проверяем изображения
        images_result = await db.execute(select(GeneratedImage))
        images = images_result.scalars().all()
        images_count = len(images)
        print(f"🎨 Изображения: {images_count}")
        
        # 6. Детальная статистика по описаниям
        print("\n📊 СТАТИСТИКА ОПИСАНИЙ:")
        print("-" * 30)
        type_stats = {}
        for desc in descriptions:
            desc_type = desc.type.value
            if desc_type not in type_stats:
                type_stats[desc_type] = {'total': 0, 'with_images': 0}
            type_stats[desc_type]['total'] += 1
        
        # Подсчитываем изображения по типам
        for img in images:
            # Получаем описание для этого изображения
            for desc in descriptions:
                if desc.id == img.description_id:
                    desc_type = desc.type.value
                    type_stats[desc_type]['with_images'] += 1
                    break
        
        for desc_type, stats in type_stats.items():
            print(f"  {desc_type.upper():12}: {stats['total']:2} описаний, {stats['with_images']:2} с изображениями")
        
        # 7. Информация о книгах с описаниями
        print(f"\n📖 КНИГИ С ОПИСАНИЯМИ:")
        print("-" * 30)
        books_with_descriptions = {}
        for desc in descriptions:
            chapter_result = await db.execute(
                select(Chapter).where(Chapter.id == desc.chapter_id)
            )
            chapter = chapter_result.scalar_one_or_none()
            if chapter:
                book_result = await db.execute(
                    select(Book).where(Book.id == chapter.book_id)
                )
                book = book_result.scalar_one_or_none()
                if book:
                    book_title = book.title[:30] + "..." if len(book.title) > 30 else book.title
                    if book_title not in books_with_descriptions:
                        books_with_descriptions[book_title] = {'descriptions': 0, 'images': 0}
                    books_with_descriptions[book_title]['descriptions'] += 1
                    
                    # Подсчитываем изображения для этой книги
                    for img in images:
                        if img.description_id == desc.id:
                            books_with_descriptions[book_title]['images'] += 1
        
        for book_title, stats in books_with_descriptions.items():
            print(f"  {book_title}")
            print(f"    Описаний: {stats['descriptions']}, Изображений: {stats['images']}")
        
        # 8. Примеры изображений
        print(f"\n🖼️  ПРИМЕРЫ СГЕНЕРИРОВАННЫХ ИЗОБРАЖЕНИЙ:")
        print("-" * 50)
        for i, img in enumerate(images[:3], 1):
            # Получаем описание
            desc_result = await db.execute(
                select(Description).where(Description.id == img.description_id)
            )
            desc = desc_result.scalar_one_or_none()
            if desc:
                print(f"{i}. Тип: {desc.type.value}")
                print(f"   Описание: {desc.content[:60]}...")
                print(f"   URL: {img.image_url[:80]}...")
                print(f"   Время генерации: {img.generation_time_seconds:.1f}с")
                print()
        
        # 9. Проверка готовности системы
        print("✅ ГОТОВНОСТЬ СИСТЕМЫ:")
        print("-" * 30)
        print(f"  {'✅' if users_count > 0 else '❌'} Пользователи созданы")
        print(f"  {'✅' if books_count > 0 else '❌'} Книги загружены")
        print(f"  {'✅' if chapters_count > 0 else '❌'} Главы парсированы")
        print(f"  {'✅' if descriptions_count > 0 else '❌'} Описания извлечены")
        print(f"  {'✅' if images_count > 0 else '❌'} Изображения сгенерированы")
        
        coverage_percent = (images_count / descriptions_count * 100) if descriptions_count > 0 else 0
        print(f"  📈 Покрытие изображениями: {coverage_percent:.1f}%")
        
        if all([users_count > 0, books_count > 0, chapters_count > 0, descriptions_count > 0, images_count > 0]):
            print("\n🎉 СИСТЕМА ПОЛНОСТЬЮ ГОТОВА К ИСПОЛЬЗОВАНИЮ!")
            print("   Перейдите на http://localhost:3000 для тестирования")
        else:
            print("\n⚠️  Система требует дополнительной настройки")

if __name__ == "__main__":
    asyncio.run(final_system_test())