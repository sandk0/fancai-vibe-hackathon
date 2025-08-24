#!/usr/bin/env python3
"""
Назначает книгу тестовому пользователю для проверки API.
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.models.book import Book
from sqlalchemy import select

async def assign_book_to_test_user():
    """Назначает первую книгу тестовому пользователю."""
    
    print("🔧 НАЗНАЧЕНИЕ КНИГИ ТЕСТОВОМУ ПОЛЬЗОВАТЕЛЮ")
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
        
        # Получаем первую книгу
        book_result = await db.execute(select(Book).limit(1))
        book = book_result.scalar_one_or_none()
        
        if not book:
            print("❌ Книги не найдены в системе")
            return
        
        print(f"📚 Книга найдена: {book.title}")
        print(f"   ID: {book.id}")
        print(f"   Текущий владелец: {book.user_id}")
        
        # Меняем владельца книги
        book.user_id = test_user.id
        await db.commit()
        await db.refresh(book)
        
        print(f"✅ Книга назначена тестовому пользователю!")
        print(f"   Новый владелец: {book.user_id}")
        print(f"\n🎯 ГОТОВО! Теперь API должно работать:")
        print(f"   Book ID: {book.id}")
        print(f"   Test User: {test_user.email}")
        print(f"   Password: testpassword123")

if __name__ == "__main__":
    asyncio.run(assign_book_to_test_user())