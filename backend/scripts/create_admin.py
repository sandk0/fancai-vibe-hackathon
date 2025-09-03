"""
Скрипт для создания администратора в системе.
"""

import asyncio
import sys
import os
from pathlib import Path

# Добавляем путь к проекту в sys.path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.core.database import get_database_session
from app.services.auth_service import auth_service
from app.models.user import User, SubscriptionPlan
from sqlalchemy.ext.asyncio import AsyncSession

async def create_admin_user():
    """Создает администратора с заданными учетными данными."""
    
    email = "admin@fancai.ru"
    password = "Tre21bgU"
    
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
    
    try:
        admin_user = await create_admin_user()
        print(f"\n🎉 Администратор готов к использованию!")
        print(f"📧 Email: {admin_user.email}")
        print(f"🔑 Пароль: Tre21bgU")
        print(f"🔗 Доступ к админ-панели: http://localhost:3000/admin")
        
    except Exception as e:
        print(f"\n💥 Критическая ошибка: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())