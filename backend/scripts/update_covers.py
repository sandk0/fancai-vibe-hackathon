#!/usr/bin/env python3
"""
Скрипт для обновления обложек существующих книг.
"""

import asyncio
import sys
import os
from pathlib import Path

# Add the project root to the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import AsyncSessionLocal
from app.models.book import Book
from app.services.book_parser import book_parser
from app.services.book import BookService
from sqlalchemy import select


async def update_book_covers():
    """Обновляет обложки для существующих книг без обложек."""
    
    book_service = BookService()
    
    async with AsyncSessionLocal() as db:
        # Получаем книги без обложек
        result = await db.execute(
            select(Book).where(Book.cover_image.is_(None) | (Book.cover_image == ''))
        )
        books = result.scalars().all()
        
        print(f"Найдено {len(books)} книг без обложек")
        
        for book in books:
            try:
                print(f"Обрабатываем книгу: {book.title}")
                
                # Парсим книгу заново для получения обложки
                if os.path.exists(book.file_path):
                    parsed_book = book_parser.parse_book(book.file_path)
                    
                    # Сохраняем обложку если есть
                    if parsed_book.metadata.cover_image_data:
                        cover_path = await book_service._save_book_cover(
                            book.id,
                            parsed_book.metadata.cover_image_data,
                            parsed_book.metadata.cover_image_type
                        )
                        book.cover_image = str(cover_path)
                        
                        # Обновляем метаданные
                        if book.book_metadata:
                            book.book_metadata["has_cover"] = True
                        else:
                            book.book_metadata = {"has_cover": True}
                        
                        print(f"  ✓ Обложка сохранена: {cover_path}")
                    else:
                        print(f"  × Обложка не найдена")
                else:
                    print(f"  × Файл не найден: {book.file_path}")
                    
            except Exception as e:
                print(f"  × Ошибка: {e}")
        
        await db.commit()
        print("Обновление завершено")


if __name__ == "__main__":
    asyncio.run(update_book_covers())