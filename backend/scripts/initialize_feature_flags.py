#!/usr/bin/env python3
"""
Скрипт для инициализации дефолтных feature flags в БД.

Запускает FeatureFlagManager.initialize() для создания стандартных флагов.
"""

import asyncio
import sys
from pathlib import Path

# Добавляем путь к app для импорта
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.core.database import get_database_session
from app.services.feature_flag_manager import FeatureFlagManager


async def main():
    """Инициализация feature flags."""
    print("🚀 Инициализация feature flags...")

    try:
        async for db in get_database_session():
            # Создаем менеджер
            flag_manager = FeatureFlagManager(db)

            # Инициализируем дефолтные флаги
            await flag_manager.initialize()

            # Получаем все флаги
            all_flags = await flag_manager.get_all_flags()

            print(f"\n✅ Инициализация завершена!")
            print(f"Всего флагов: {len(all_flags)}\n")

            # Выводим список
            print("📋 Созданные feature flags:")
            print("-" * 80)
            for flag in all_flags:
                status = "🟢 ON" if flag.enabled else "🔴 OFF"
                print(
                    f"{status}  {flag.name:40s} [{flag.category:12s}] - {flag.description}"
                )

            print("-" * 80)
            print("\n🎉 Feature flags готовы к использованию!")

            # Показываем как проверить
            print("\n💡 Проверить через API:")
            print("   curl http://localhost:8000/api/v1/admin/feature-flags")

            break  # Завершаем после первой итерации

    except Exception as e:
        print(f"\n❌ Ошибка при инициализации: {e}")
        import traceback

        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
