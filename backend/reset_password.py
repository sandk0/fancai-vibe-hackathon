"""
Скрипт для сброса пароля пользователя.

Usage:
    python reset_password.py <email> <new_password>
"""

import asyncio
import sys
from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.services.auth_service import auth_service


async def reset_user_password(email: str, new_password: str):
    """Сброс пароля пользователя."""
    async with AsyncSessionLocal() as db:
        # Найти пользователя
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalar_one_or_none()

        if not user:
            print(f"❌ Пользователь с email '{email}' не найден!")
            return False

        # Создать новый хеш пароля
        new_hash = auth_service.get_password_hash(new_password)

        print(f"👤 Пользователь: {user.email}")
        print(f"🔑 Старый хеш: {user.password_hash[:30]}...")
        print(f"🔑 Новый хеш: {new_hash[:30]}...")

        # Обновить пароль
        user.password_hash = new_hash
        await db.commit()

        print(f"✅ Пароль для {email} успешно обновлен!")

        # Проверить что новый пароль работает
        is_valid = auth_service.verify_password(new_password, user.password_hash)
        print(f"🔍 Проверка нового пароля: {'✅ OK' if is_valid else '❌ FAILED'}")

        return True


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print("Usage: python reset_password.py <email> <new_password>")
        sys.exit(1)

    email = sys.argv[1]
    new_password = sys.argv[2]

    asyncio.run(reset_user_password(email, new_password))
