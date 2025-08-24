#!/usr/bin/env python3
"""
Находит книгу с описаниями и назначает её тестовому пользователю.
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.book import Book
from app.models.chapter import Chapter
from app.models.description import Description
from sqlalchemy import select, func

async def find_and_assign_book_with_descriptions():
    """Находит книгу с описаниями и назначает её тестовому пользователю."""
    
    print("🔧 ПОИСК КНИГИ С ОПИСАНИЯМИ")
    print("=" * 50)
    
    test_email = "test@example.com"
    
    async with AsyncSessionLocal() as db:
        # Получаем тестового пользователя
        user_result = await db.execute(
            select(User).where(User.email == test_email)
        )
        test_user = user_result.scalar_one_or_none()
        
        if not test_user:
            print(f"❌ Тестовый пользователь {test_email} не найден")
            return
        
        print(f"✅ Тестовый пользователь найден: {test_user.email}")
        print(f"   ID: {test_user.id}")
        
        # Ищем книги с описаниями
        result = await db.execute(
            select(Book, func.count(Description.id))
            .join(Chapter, Book.id == Chapter.book_id)
            .join(Description, Chapter.id == Description.chapter_id)
            .group_by(Book.id)
            .order_by(func.count(Description.id).desc())
        )
        
        books_with_descriptions = result.fetchall()
        
        print(f"\n📊 НАЙДЕНО КНИГ С ОПИСАНИЯМИ: {len(books_with_descriptions)}")
        
        if not books_with_descriptions:
            print("❌ Нет книг с описаниями")
            return
        
        for book, desc_count in books_with_descriptions:
            print(f"   📚 {book.title[:50]}... - {desc_count} описаний")
        
        # Берём книгу с наибольшим количеством описаний
        best_book, desc_count = books_with_descriptions[0]
        print(f"\n🎯 ВЫБИРАЕМ КНИГУ: {best_book.title}")
        print(f"   ID: {best_book.id}")
        print(f"   Описаний: {desc_count}")
        print(f"   Текущий владелец: {best_book.user_id}")
        
        # Назначаем тестовому пользователю
        best_book.user_id = test_user.id
        await db.commit()
        await db.refresh(best_book)
        
        print(f"✅ Книга назначена тестовому пользователю!")
        print(f"   Новый владелец: {best_book.user_id}")
        
        # Проверяем первую главу
        chapter_result = await db.execute(
            select(Chapter)
            .where(Chapter.book_id == best_book.id)
            .order_by(Chapter.chapter_number)
            .limit(1)
        )
        first_chapter = chapter_result.scalar_one_or_none()
        
        if first_chapter:
            # Считаем описания в первой главе
            desc_result = await db.execute(
                select(func.count(Description.id))
                .where(Description.chapter_id == first_chapter.id)
            )
            desc_count_chapter = desc_result.scalar()
            
            print(f"\n📄 ПЕРВАЯ ГЛАВА:")
            print(f"   Номер: {first_chapter.chapter_number}")
            print(f"   ID: {first_chapter.id}")
            print(f"   Описаний: {desc_count_chapter}")
        
        print(f"\n🎉 ГОТОВО! Теперь можно тестировать API:")
        print(f"   Book ID: {best_book.id}")
        print(f"   Chapter: 1")
        print(f"   User: {test_user.email}")
        print(f"   Password: testpassword123")

if __name__ == "__main__":
    asyncio.run(find_and_assign_book_with_descriptions())