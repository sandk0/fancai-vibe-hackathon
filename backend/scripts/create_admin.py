"""
Скрипт для создания администратора в системе.

SECURITY: Использует environment variables для credentials.
Никогда не хардкодить пароли в коде!

Usage:
    ADMIN_EMAIL=admin@fancai.ru ADMIN_PASSWORD=your_secure_password python create_admin.py

Environment Variables:
    ADMIN_EMAIL - email администратора (default: admin@bookreader.local)
    ADMIN_PASSWORD - пароль администратора (REQUIRED, minimum 12 chars)
"""

import asyncio
import sys
import os
import secrets
from pathlib import Path

# Добавляем путь к проекту в sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.core.database import get_database_session
from app.services.auth_service import auth_service
from app.models.user import User, SubscriptionPlan
from sqlalchemy.ext.asyncio import AsyncSession

async def create_admin_user():
    """
    Создает администратора с заданными учетными данными из environment variables.

    Security requirements:
    - ADMIN_PASSWORD must be at least 12 characters
    - Password must not be hardcoded
    - Production deployment requires strong password
    """

    # Читаем credentials из environment variables
    email = os.getenv("ADMIN_EMAIL", "admin@bookreader.local")
    password = os.getenv("ADMIN_PASSWORD")

    # SECURITY CHECK: Password is required
    if not password:
        print("❌ ОШИБКА: ADMIN_PASSWORD environment variable не задана!")
        print("📝 Использование:")
        print("   ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=your_secure_password python create_admin.py")
        print("\n💡 Генерация безопасного пароля:")
        print("   python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
        print(f"\n🎲 Случайный пароль (пример): {secrets.token_urlsafe(32)}")
        sys.exit(1)

    # SECURITY CHECK: Password strength
    if len(password) < 12:
        print("❌ ОШИБКА: Пароль должен быть минимум 12 символов!")
        print(f"   Текущая длина: {len(password)}")
        print("\n💡 Сгенерируйте безопасный пароль:")
        print("   python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
        sys.exit(1)

    # SECURITY CHECK: Warn about weak passwords
    if password in ["password", "admin", "12345678", "qwerty", "admin123"]:
        print("❌ ОШИБКА: Слабый пароль! Используйте криптографически стойкий пароль.")
        print("\n💡 Сгенерируйте безопасный пароль:")
        print("   python -c \"import secrets; print(secrets.token_urlsafe(32))\"")
        sys.exit(1)
    
    print(f"🔐 Создание администратора с email: {email}")
    
    # Получаем сессию базы данных
    async for db_session in get_database_session():
        db: AsyncSession = db_session
        
        try:
            # Проверяем, существует ли уже пользователь с таким email
            existing_user = await auth_service.get_user_by_email(db, email)
            
            if existing_user:
                if existing_user.is_admin:
                    print(f"✅ Администратор с email {email} уже существует")
                    return existing_user
                else:
                    # Обновляем существующего пользователя до администратора
                    existing_user.is_admin = True
                    existing_user.subscription_plan = SubscriptionPlan.ULTIMATE
                    await db.commit()
                    print(f"✅ Пользователь {email} обновлен до администратора")
                    return existing_user
            
            # Создаем нового администратора
            admin_user = await auth_service.create_user(
                db=db,
                email=email,
                password=password,
                full_name="System Administrator"
            )
            
            # Обновляем пользователя до администратора
            admin_user.is_admin = True
            admin_user.is_verified = True  # Администратор не требует подтверждения email
            await db.commit()
            
            print(f"✅ Администратор создан успешно:")
            print(f"   Email: {admin_user.email}")
            print(f"   Full Name: {admin_user.full_name}")
            print(f"   ID: {admin_user.id}")
            print(f"   Is Admin: {admin_user.is_admin}")
            print(f"   Is Verified: {admin_user.is_verified}")
            
            return admin_user
            
        except Exception as e:
            print(f"❌ Ошибка создания администратора: {str(e)}")
            await db.rollback()
            raise
        finally:
            await db.close()

async def main():
    """Главная функция скрипта."""
    print("🚀 Запуск скрипта создания администратора...")
    print(f"🔒 Environment: {os.getenv('ENVIRONMENT', 'unknown')}")

    try:
        admin_user = await create_admin_user()
        print(f"\n🎉 Администратор готов к использованию!")
        print(f"📧 Email: {admin_user.email}")
        print(f"🔗 Доступ к админ-панели: http://localhost:3000/admin")
        print("\n⚠️  ВАЖНО: Сохраните пароль в надежном месте!")
        print("   Пароль НЕ отображается в целях безопасности.")

    except Exception as e:
        print(f"\n💥 Критическая ошибка: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())