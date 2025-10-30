#!/usr/bin/env python3
"""
Создание тестового пользователя для проверки API.

⚠️  SECURITY WARNING: This script is for DEVELOPMENT and TESTING ONLY!
⚠️  NEVER run this script in production environment!

Usage:
    # Using environment variables (recommended)
    TEST_USER_EMAIL=test@example.com TEST_USER_PASSWORD=your_password python create_test_user.py

    # Using defaults (development only)
    python create_test_user.py

Environment Variables:
    ENVIRONMENT - must NOT be 'production' (safety check)
    TEST_USER_EMAIL - email тестового пользователя (default: test@example.com)
    TEST_USER_PASSWORD - пароль (default: auto-generated secure password)
"""

import sys
import os
import asyncio
import secrets

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.services.auth_service import auth_service
from sqlalchemy import select

async def create_test_user():
    """
    Создает тестового пользователя для тестирования API.

    Security checks:
    - Blocks execution in production environment
    - Uses environment variables for credentials
    - Generates secure password if not provided
    """

    # CRITICAL SECURITY CHECK: Block execution in production
    environment = os.getenv("ENVIRONMENT", "development").lower()
    if environment == "production":
        print("🚨 КРИТИЧЕСКАЯ ОШИБКА БЕЗОПАСНОСТИ!")
        print("=" * 60)
        print("❌ Этот скрипт НЕ МОЖЕТ быть запущен в production окружении!")
        print("   ENVIRONMENT='production' обнаружен.")
        print("\n💡 Используйте этот скрипт только в development/staging.")
        print("   Для production используйте admin панель или API.")
        print("=" * 60)
        sys.exit(1)

    print("🔧 СОЗДАНИЕ ТЕСТОВОГО ПОЛЬЗОВАТЕЛЯ")
    print("=" * 40)
    print(f"🔒 Environment: {environment}")

    # Читаем credentials из environment variables
    test_email = os.getenv("TEST_USER_EMAIL", "test@example.com")
    test_password = os.getenv("TEST_USER_PASSWORD")

    # Генерируем безопасный пароль если не задан
    if not test_password:
        test_password = secrets.token_urlsafe(24)
        print(f"🎲 Пароль не задан, сгенерирован случайный: {test_password}")
        print("   Сохраните его для дальнейшего использования!")
    else:
        print(f"🔑 Используется пароль из TEST_USER_PASSWORD")
    
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
            print(f"   🔑 Пароль обновлен")
            
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

        print("\n📋 ДАННЫЕ ДЛЯ ВХОДА:")
        print(f"   Email: {test_email}")
        print(f"   Password: {test_password}")
        print("\n⚠️  ВАЖНО: Сохраните пароль в надежном месте!")
        print(f"   Environment: {environment} (test only)")

if __name__ == "__main__":
    asyncio.run(create_test_user())