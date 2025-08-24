#!/usr/bin/env python3
"""
Генерация нескольких изображений для тестирования.
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.description import Description
from app.models.image import GeneratedImage
from app.models.user import User
from app.services.image_generator import image_generator_service
from sqlalchemy import select

async def generate_multiple_images():
    """Генерирует изображения для нескольких описаний."""
    
    async with AsyncSessionLocal() as db:
        # Получаем первого пользователя
        user_result = await db.execute(select(User).limit(1))
        user = user_result.scalar_one_or_none()
        if not user:
            print("❌ Пользователь не найден")
            return
        
        # Получаем топ-5 описаний без изображений
        result = await db.execute(
            select(Description)
            .where(Description.is_suitable_for_generation == True)
            .where(~Description.id.in_(
                select(GeneratedImage.description_id)
            ))
            .order_by(Description.priority_score.desc())
            .limit(5)
        )
        
        descriptions = result.scalars().all()
        if not descriptions:
            print("❌ Нет описаний для генерации")
            return
        
        print(f"🎨 Найдено {len(descriptions)} описаний для генерации")
        
        generated_count = 0
        
        for i, description in enumerate(descriptions, 1):
            print(f"\n[{i}/{len(descriptions)}] Генерируем изображение...")
            print(f"   Тип: {description.type.value}")
            print(f"   Текст: {description.content[:80]}...")
            print(f"   Приоритет: {description.priority_score}")
            
            try:
                # Генерируем изображение
                result = await image_generator_service.generate_image_for_description(
                    description=description,
                    user_id=str(user.id)
                )
                
                if result.success:
                    print(f"   ✅ Сгенерировано за {result.generation_time_seconds:.1f}с")
                    
                    # Сохраняем в базе данных
                    generated_image = GeneratedImage(
                        description_id=description.id,
                        user_id=user.id,
                        service_used="pollinations.ai",
                        image_url=result.image_url,
                        local_path=result.local_path,
                        prompt_used=f"Generated for {description.type.value}",
                        generation_time_seconds=result.generation_time_seconds
                    )
                    
                    db.add(generated_image)
                    await db.commit()
                    generated_count += 1
                    print(f"   💾 Сохранено в БД")
                    
                else:
                    print(f"   ❌ Ошибка: {result.error_message}")
                    
            except Exception as e:
                print(f"   ❌ Исключение: {str(e)}")
        
        print(f"\n🎉 Генерация завершена! Создано {generated_count} изображений")

if __name__ == "__main__":
    print("=" * 60)
    print("ГЕНЕРАЦИЯ МНОЖЕСТВЕННЫХ ИЗОБРАЖЕНИЙ")
    print("=" * 60)
    
    asyncio.run(generate_multiple_images())