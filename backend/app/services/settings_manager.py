"""
Сервис для управления настройками администратора.

Обеспечивает централизованное управление конфигурацией системы
с сохранением в базе данных и кэшированием в Redis.
"""

import json
import os
from typing import Dict, Any, Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update, delete
import redis.asyncio as redis

from ..models.admin_settings import AdminSettings
from ..core.database import AsyncSessionLocal


class SettingsManager:
    """
    Менеджер настроек системы с поддержкой кэширования и персистентности.
    """
    
    def __init__(self):
        self.redis_client = None
        self._cache_prefix = "bookreader:settings:"
        self._cache_ttl = 3600  # 1 час
        
    async def _get_redis_client(self):
        """Получает Redis клиент для кэширования."""
        if self.redis_client is None:
            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
            self.redis_client = redis.from_url(redis_url)
        return self.redis_client
    
    async def get_setting(self, category: str, key: str, default: Any = None) -> Any:
        """
        Получает настройку из кэша или базы данных.
        
        Args:
            category: Категория настройки
            key: Ключ настройки
            default: Значение по умолчанию
            
        Returns:
            Значение настройки или default если не найдено
        """
        cache_key = f"{self._cache_prefix}{category}:{key}"
        
        try:
            # Сначала проверяем кэш
            redis_client = await self._get_redis_client()
            cached_value = await redis_client.get(cache_key)
            
            if cached_value is not None:
                return json.loads(cached_value)
                
        except Exception:
            # Если кэш недоступен, продолжаем с базой данных
            pass
        
        # Если в кэше нет, ищем в базе данных
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AdminSettings)
                .where(
                    AdminSettings.category == category,
                    AdminSettings.key == key,
                    AdminSettings.is_active == True
                )
            )
            setting = result.scalar_one_or_none()
            
            if setting:
                value = setting.get_value()
                
                # Кэшируем результат
                try:
                    redis_client = await self._get_redis_client()
                    await redis_client.setex(
                        cache_key, 
                        self._cache_ttl, 
                        json.dumps(value)
                    )
                except Exception:
                    pass  # Игнорируем ошибки кэширования
                
                return value
        
        return default
    
    async def set_setting(self, category: str, key: str, value: Any, description: str = None) -> bool:
        """
        Устанавливает настройку в базе данных и обновляет кэш.
        
        Args:
            category: Категория настройки
            key: Ключ настройки
            value: Значение настройки
            description: Описание настройки
            
        Returns:
            True если настройка была успешно сохранена
        """
        async with AsyncSessionLocal() as db:
            try:
                # Ищем существующую настройку
                result = await db.execute(
                    select(AdminSettings)
                    .where(
                        AdminSettings.category == category,
                        AdminSettings.key == key
                    )
                )
                setting = result.scalar_one_or_none()
                
                if setting:
                    # Обновляем существующую
                    setting.set_value(value)
                    if description:
                        setting.description = description
                    setting.is_active = True
                else:
                    # Создаем новую
                    setting = AdminSettings(
                        category=category,
                        key=key,
                        description=description,
                        is_active=True
                    )
                    setting.set_value(value)
                    db.add(setting)
                
                await db.commit()
                
                # Обновляем кэш
                try:
                    cache_key = f"{self._cache_prefix}{category}:{key}"
                    redis_client = await self._get_redis_client()
                    await redis_client.setex(
                        cache_key,
                        self._cache_ttl,
                        json.dumps(value)
                    )
                except Exception:
                    pass  # Игнорируем ошибки кэширования
                
                return True
                
            except Exception as e:
                await db.rollback()
                print(f"Ошибка сохранения настройки {category}:{key}: {e}")
                return False
    
    async def get_category_settings(self, category: str) -> Dict[str, Any]:
        """
        Получает все настройки для указанной категории.
        
        Args:
            category: Категория настроек
            
        Returns:
            Словарь настроек {key: value}
        """
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AdminSettings)
                .where(
                    AdminSettings.category == category,
                    AdminSettings.is_active == True
                )
            )
            settings = result.scalars().all()
            
            return {
                setting.key: setting.get_value()
                for setting in settings
            }
    
    async def get_all_settings(self) -> Dict[str, Dict[str, Any]]:
        """
        Получает все настройки, сгруппированные по категориям.
        
        Returns:
            Словарь {category: {key: value}}
        """
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(AdminSettings)
                .where(AdminSettings.is_active == True)
            )
            settings = result.scalars().all()
            
            grouped = {}
            for setting in settings:
                if setting.category not in grouped:
                    grouped[setting.category] = {}
                grouped[setting.category][setting.key] = setting.get_value()
            
            return grouped
    
    async def delete_setting(self, category: str, key: str) -> bool:
        """
        Удаляет настройку (помечает как неактивную).
        
        Args:
            category: Категория настройки
            key: Ключ настройки
            
        Returns:
            True если настройка была удалена
        """
        async with AsyncSessionLocal() as db:
            try:
                result = await db.execute(
                    update(AdminSettings)
                    .where(
                        AdminSettings.category == category,
                        AdminSettings.key == key
                    )
                    .values(is_active=False)
                )
                
                await db.commit()
                
                # Удаляем из кэша
                try:
                    cache_key = f"{self._cache_prefix}{category}:{key}"
                    redis_client = await self._get_redis_client()
                    await redis_client.delete(cache_key)
                except Exception:
                    pass
                
                return result.rowcount > 0
                
            except Exception as e:
                await db.rollback()
                print(f"Ошибка удаления настройки {category}:{key}: {e}")
                return False
    
    async def clear_cache(self, category: str = None, key: str = None):
        """
        Очищает кэш настроек.
        
        Args:
            category: Очистить только указанную категорию
            key: Очистить только указанный ключ (требует category)
        """
        try:
            redis_client = await self._get_redis_client()
            
            if category and key:
                # Очищаем конкретную настройку
                cache_key = f"{self._cache_prefix}{category}:{key}"
                await redis_client.delete(cache_key)
            elif category:
                # Очищаем всю категорию
                pattern = f"{self._cache_prefix}{category}:*"
                keys = await redis_client.keys(pattern)
                if keys:
                    await redis_client.delete(*keys)
            else:
                # Очищаем весь кэш настроек
                pattern = f"{self._cache_prefix}*"
                keys = await redis_client.keys(pattern)
                if keys:
                    await redis_client.delete(*keys)
                    
        except Exception as e:
            print(f"Ошибка очистки кэша настроек: {e}")
    
    async def initialize_default_settings(self, force: bool = False) -> bool:
        """
        Инициализирует настройки по умолчанию.
        
        Args:
            force: Перезаписывать существующие настройки
            
        Returns:
            True если инициализация прошла успешно
        """
        async with AsyncSessionLocal() as db:
            try:
                # Проверяем, есть ли уже настройки
                if not force:
                    result = await db.execute(select(AdminSettings).limit(1))
                    if result.scalar_one_or_none():
                        return True  # Настройки уже есть
                
                # Создаем настройки по умолчанию
                default_settings = AdminSettings.create_default_settings(db)
                
                for setting_data in default_settings:
                    # Проверяем, существует ли настройка
                    if not force:
                        result = await db.execute(
                            select(AdminSettings)
                            .where(
                                AdminSettings.category == setting_data['category'],
                                AdminSettings.key == setting_data['key']
                            )
                        )
                        existing = result.scalar_one_or_none()
                        if existing:
                            continue  # Пропускаем существующие
                    
                    # Создаем новую настройку
                    setting = AdminSettings(**setting_data)
                    setting.set_value(
                        setting_data.get('value') or
                        setting_data.get('value_string') or
                        setting_data.get('value_int') or
                        setting_data.get('value_float') or
                        setting_data.get('value_bool')
                    )
                    
                    db.add(setting)
                
                await db.commit()
                
                # Очищаем кэш для обновления
                await self.clear_cache()
                
                return True
                
            except Exception as e:
                await db.rollback()
                print(f"Ошибка инициализации настроек по умолчанию: {e}")
                return False


# Создаем глобальный экземпляр менеджера настроек
settings_manager = SettingsManager()


# Вспомогательные функции для быстрого доступа к настройкам
async def get_nlp_settings() -> Dict[str, Any]:
    """Получает настройки NLP модуля."""
    return await settings_manager.get_category_settings('nlp')


async def get_parsing_settings() -> Dict[str, Any]:
    """Получает настройки парсинга."""
    return await settings_manager.get_category_settings('parsing')


async def get_image_generation_settings() -> Dict[str, Any]:
    """Получает настройки генерации изображений."""
    return await settings_manager.get_category_settings('image_generation')


async def get_system_settings() -> Dict[str, Any]:
    """Получает системные настройки."""
    return await settings_manager.get_category_settings('system')