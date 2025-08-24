#!/usr/bin/env python3
"""
Тестирование API flow для проверки отображения описаний.
"""

import sys
import os
import asyncio
import httpx
import json

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.description import Description
from app.models.image import GeneratedImage
from app.models.book import Book
from app.models.chapter import Chapter
from app.models.user import User
from sqlalchemy import select
from uuid import UUID

async def test_api_flow():
    """Тестирует весь API flow от базы данных до HTTP ответа."""
    
    print("🔍 ТЕСТИРОВАНИЕ API FLOW")
    print("=" * 50)
    
    async with AsyncSessionLocal() as db:
        # 1. Проверяем базу данных
        print("1. Проверка базы данных...")
        
        # Получаем книгу с описаниями (Witcher book)
        witcher_book_id = UUID("c1347ad0-9a13-4564-8e08-2dad21408dc4")
        book_result = await db.execute(select(Book).where(Book.id == witcher_book_id))
        book = book_result.scalar_one_or_none()
        if not book:
            print("❌ Книга не найдена")
            return
        
        print(f"   Книга: {book.title[:50]}...")
        print(f"   ID: {book.id}")
        
        # Получаем первую главу этой книги
        chapter_result = await db.execute(
            select(Chapter)
            .where(Chapter.book_id == book.id)
            .order_by(Chapter.chapter_number)
            .limit(1)
        )
        chapter = chapter_result.scalar_one_or_none()
        if not chapter:
            print("❌ Глава не найдена")
            return
        
        print(f"   Глава: #{chapter.chapter_number} - {chapter.title[:50] if chapter.title else 'Без названия'}...")
        print(f"   ID: {chapter.id}")
        
        # Проверяем описания для этой главы
        descriptions_result = await db.execute(
            select(Description, GeneratedImage)
            .outerjoin(GeneratedImage, Description.id == GeneratedImage.description_id)
            .where(Description.chapter_id == chapter.id)
            .order_by(Description.priority_score.desc())
        )
        
        descriptions_data = descriptions_result.all()
        print(f"   Описания в БД: {len(descriptions_data)}")
        
        if descriptions_data:
            for i, (desc, img) in enumerate(descriptions_data[:3], 1):
                print(f"     {i}. {desc.type.value}: {desc.content[:50]}... (приоритет: {desc.priority_score})")
                if img:
                    print(f"        📷 Изображение: {img.image_url[:60]}...")
        
        # 2. Тестируем API напрямую
        print(f"\n2. Тестирование API /api/v1/books/{book.id}/chapters/{chapter.chapter_number}")
        
        try:
            async with httpx.AsyncClient() as client:
                # Без аутентификации
                response = await client.get(
                    f"http://localhost:8000/api/v1/books/{book.id}/chapters/{chapter.chapter_number}"
                )
                
                print(f"   Status Code: {response.status_code}")
                
                if response.status_code == 200:
                    data = response.json()
                    
                    print(f"   Ответ содержит:")
                    print(f"     - id: {data.get('id', 'НЕТ')}")
                    print(f"     - chapter_number: {data.get('chapter_number', 'НЕТ')}")
                    print(f"     - title: {data.get('title', 'НЕТ')}")
                    print(f"     - content длина: {len(data.get('content', ''))}")
                    
                    # Главное - проверяем descriptions
                    descriptions = data.get('descriptions', [])
                    print(f"     - descriptions: {len(descriptions)} элементов")
                    
                    if descriptions:
                        print("   🎉 ОПИСАНИЯ НАЙДЕНЫ В API ОТВЕТЕ!")
                        for i, desc in enumerate(descriptions[:3], 1):
                            print(f"     {i}. {desc.get('type')}: {desc.get('content', '')[:50]}...")
                            if desc.get('generated_image'):
                                print(f"        📷 Изображение: {desc['generated_image'].get('image_url', '')[:60]}...")
                    else:
                        print("   ❌ ОПИСАНИЯ НЕ НАЙДЕНЫ В API ОТВЕТЕ!")
                        print("   Полный ответ:")
                        print(json.dumps(data, ensure_ascii=False, indent=2)[:1000])
                
                elif response.status_code == 401:
                    print("   ❌ 401 - Требуется аутентификация")
                    print("   Возможно, эндпоинт требует JWT токен")
                
                elif response.status_code == 404:
                    print("   ❌ 404 - Эндпоинт не найден")
                    
                else:
                    print(f"   ❌ Ошибка: {response.status_code}")
                    print(f"   Ответ: {response.text}")
        
        except Exception as e:
            print(f"   ❌ Ошибка запроса: {str(e)}")
        
        # 3. Проверяем аутентификацию
        print(f"\n3. Тестирование с аутентификацией...")
        
        # Получаем тестового пользователя
        user_result = await db.execute(select(User).where(User.email == "test@example.com"))
        user = user_result.scalar_one_or_none()
        if user:
            print(f"   Пользователь: {user.email}")
            
            try:
                async with httpx.AsyncClient() as client:
                    # Попытка логина для получения токена
                    login_response = await client.post(
                        "http://localhost:8000/api/v1/auth/login",
                        json={"email": user.email, "password": "testpassword123"}
                    )
                    
                    print(f"   Логин - Status: {login_response.status_code}")
                    if login_response.status_code == 200:
                        token_data = login_response.json()
                        print(f"   Ответ логина: {token_data}")
                        access_token = token_data.get("tokens", {}).get("access_token")
                        
                        if access_token:
                            print(f"   ✅ Токен получен")
                            
                            # Повторяем запрос с токеном
                            headers = {"Authorization": f"Bearer {access_token}"}
                            auth_response = await client.get(
                                f"http://localhost:8000/api/v1/books/{book.id}/chapters/{chapter.chapter_number}",
                                headers=headers
                            )
                            
                            print(f"   С токеном - Status: {auth_response.status_code}")
                            
                            if auth_response.status_code == 200:
                                auth_data = auth_response.json()
                                auth_descriptions = auth_data.get('descriptions', [])
                                print(f"   С токеном - descriptions: {len(auth_descriptions)} элементов")
                                
                                if auth_descriptions:
                                    print("   🎉 С АУТЕНТИФИКАЦИЕЙ ОПИСАНИЯ РАБОТАЮТ!")
                                else:
                                    print("   ❌ Даже с токеном описания пустые")
                        else:
                            print("   ❌ Токен не найден в ответе")
                    else:
                        print(f"   ❌ Логин неудачен: {login_response.status_code}")
                        print(f"   Ответ: {login_response.text}")
                        
            except Exception as e:
                print(f"   ❌ Ошибка аутентификации: {str(e)}")
        
        else:
            print("   ❌ Пользователь не найден")

if __name__ == "__main__":
    asyncio.run(test_api_flow())