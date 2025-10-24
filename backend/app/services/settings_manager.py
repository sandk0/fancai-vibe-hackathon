"""
Settings Manager для управления настройками приложения.

ВАЖНО: Это STUB реализация, которая использует in-memory хранилище вместо БД.
Оригинальная реализация зависела от orphaned AdminSettings модели (таблица удалена из БД).

TODO: Implement Redis-based persistence or create new DB model for settings.
"""

import logging
from typing import Any, Dict
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)


@dataclass
class SettingsManager:
    """
    Менеджер настроек приложения (stub implementation).

    Хранит настройки в памяти. Настройки НЕ персистентны между перезапусками.
    """

    _settings: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    _initialized: bool = False

    async def initialize_default_settings(self, force: bool = False) -> bool:
        """
        Инициализирует настройки по умолчанию.

        Args:
            force: Принудительная переинициализация

        Returns:
            True если успешно
        """
        if self._initialized and not force:
            logger.info("Settings already initialized, skipping")
            return True

        logger.info("Initializing default settings (in-memory)")

        # NLP Global settings
        self._settings["nlp_global"] = {
            "processing_mode": "single",
            "default_processor": "spacy",
            "max_parallel_processors": 3,
            "ensemble_voting_threshold": 0.6,
        }

        # SpaCy settings
        self._settings["nlp_spacy"] = {
            "enabled": True,
            "weight": 1.0,
            "confidence_threshold": 0.3,
            "model_name": "ru_core_news_lg",
            "literary_patterns": True,
            "character_detection_boost": 1.2,
            "location_detection_boost": 1.1,
            "atmosphere_keywords": [],
        }

        # Natasha settings
        self._settings["nlp_natasha"] = {
            "enabled": True,
            "weight": 1.2,
            "confidence_threshold": 0.4,
            "literary_boost": 1.3,
            "enable_morphology": True,
            "enable_syntax": True,
            "enable_ner": True,
            "person_patterns": [],
            "location_patterns": [],
            "atmosphere_indicators": [],
        }

        # Stanza settings
        self._settings["nlp_stanza"] = {
            "enabled": False,
            "weight": 0.8,
            "confidence_threshold": 0.5,
            "model_name": "ru",
            "processors": "tokenize,pos,lemma,depparse,ner",
            "complex_syntax_analysis": True,
            "dependency_parsing": True,
        }

        # Parsing settings
        self._settings["parsing"] = {
            "max_concurrent_parsing": 1,
            "priority_free": 1,
            "priority_premium": 5,
            "priority_ultimate": 10,
            "timeout_minutes": 30,
            "retry_attempts": 3,
        }

        # Image generation settings
        self._settings["image_generation"] = {
            "primary_service": "pollinations",
            "fallback_services": [],
            "enable_caching": True,
            "image_quality": "high",
            "max_generation_time": 30,
        }

        # System settings
        self._settings["system"] = {
            "maintenance_mode": False,
            "max_upload_size_mb": 50,
            "supported_book_formats": ["epub", "fb2"],
            "enable_debug_mode": False,
        }

        self._initialized = True
        logger.info(f"Initialized {len(self._settings)} setting categories")
        return True

    async def get_setting(self, category: str, key: str, default: Any = None) -> Any:
        """
        Получить значение настройки.

        Args:
            category: Категория настроек (например, 'nlp_spacy')
            key: Ключ настройки
            default: Значение по умолчанию

        Returns:
            Значение настройки или default
        """
        if not self._initialized:
            await self.initialize_default_settings()

        category_settings = self._settings.get(category, {})
        return category_settings.get(key, default)

    async def set_setting(self, category: str, key: str, value: Any) -> bool:
        """
        Установить значение настройки.

        Args:
            category: Категория настроек
            key: Ключ настройки
            value: Новое значение

        Returns:
            True если успешно
        """
        if not self._initialized:
            await self.initialize_default_settings()

        if category not in self._settings:
            self._settings[category] = {}

        self._settings[category][key] = value
        logger.debug(f"Set {category}.{key} = {value}")
        return True

    async def get_category_settings(self, category: str) -> Dict[str, Any]:
        """
        Получить все настройки категории.

        Args:
            category: Категория настроек

        Returns:
            Словарь с настройками категории
        """
        if not self._initialized:
            await self.initialize_default_settings()

        return self._settings.get(category, {}).copy()

    async def set_category_settings(
        self, category: str, settings: Dict[str, Any]
    ) -> bool:
        """
        Установить все настройки категории.

        Args:
            category: Категория настроек
            settings: Словарь с настройками

        Returns:
            True если успешно
        """
        if not self._initialized:
            await self.initialize_default_settings()

        self._settings[category] = settings.copy()
        logger.info(f"Updated {category} settings with {len(settings)} keys")
        return True

    async def get_processor_config(self, processor_name: str) -> Dict[str, Any]:
        """
        Получить конфигурацию процессора.

        Args:
            processor_name: Название процессора (spacy, natasha, stanza)

        Returns:
            Конфигурация процессора
        """
        category = f"nlp_{processor_name}"
        return await self.get_category_settings(category)

    async def reset_to_defaults(self) -> bool:
        """
        Сбросить все настройки к значениям по умолчанию.

        Returns:
            True если успешно
        """
        self._settings.clear()
        self._initialized = False
        return await self.initialize_default_settings(force=True)


# Global singleton instance
settings_manager = SettingsManager()
