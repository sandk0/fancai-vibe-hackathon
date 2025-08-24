#!/usr/bin/env python3
"""
Создание тестового пользователя для проверки API.
"""

import sys
import os
import asyncio

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.services.auth_service import auth_service
from sqlalchemy import select

async def create_test_user():
    """Создает тестового пользователя с известным паролем."""
    
    print("🔧 СОЗДАНИЕ ТЕСТОВОГО ПОЛЬЗОВАТЕЛЯ")
    print("=" * 40)
    
    test_email = "test@example.com"
    test_password = "testpassword123"
    
    async with AsyncSessionLocal() as db:
        # Проверяем, существует ли уже пользователь
        existing_user_result = await db.execute(
            select(User).where(User.email == test_email)
        )
        existing_user = existing_user_result.scalar_one_or_none()
        
        if existing_user:
            print(f"✅ Пользователь {test_email} уже существует")
            print(f"   ID: {existing_user.id}")
            print(f"   Активен: {existing_user.is_active}")
            
            # Обновляем пароль на всякий случай
            existing_user.password_hash = auth_service.get_password_hash(test_password)
            await db.commit()
            print(f"   🔑 Пароль обновлен на: {test_password}")
            
        else:
            print(f"➕ Создаем нового пользователя: {test_email}")
            
            # Создаем нового пользователя
            test_user = User(
                email=test_email,
                password_hash=auth_service.get_password_hash(test_password),
                full_name="Test User",
                is_active=True,
                is_verified=True,
                is_admin=False
            )
            
            db.add(test_user)
            await db.commit()
            await db.refresh(test_user)
            
            print(f"✅ Пользователь создан успешно!")
            print(f"   ID: {test_user.id}")
            print(f"   Email: {test_user.email}")
            print(f"   Password: {test_password}")
        
        print("\n📋 ДАННЫЕ ДЛЯ ВХОДА:")
        print(f"   Email: {test_email}")
        print(f"   Password: {test_password}")

if __name__ == "__main__":
    asyncio.run(create_test_user())