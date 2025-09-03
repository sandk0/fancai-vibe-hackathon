"""
Модель для хранения настроек администратора в базе данных.
"""

from sqlalchemy import Column, String, Integer, Float, JSON, Boolean, DateTime, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from ..core.database import Base


class AdminSettings(Base):
    """
    Модель для хранения настроек системы администратором.
    
    Позволяет сохранять различные конфигурации системы в базе данных
    и применять их при запуске приложения.
    """
    __tablename__ = "admin_settings"
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    
    # Категория настроек (nlp, parsing, image_generation, etc.)
    category = Column(String(50), nullable=False, index=True)
    
    # Ключ настройки
    key = Column(String(100), nullable=False, index=True)
    
    # Значение настройки (JSON для сложных структур)
    value = Column(JSON, nullable=True)
    
    # Строковое значение (для простых настроек)
    value_string = Column(Text, nullable=True)
    
    # Числовые значения
    value_int = Column(Integer, nullable=True)
    value_float = Column(Float, nullable=True)
    value_bool = Column(Boolean, nullable=True)
    
    # Описание настройки
    description = Column(Text, nullable=True)
    
    # Является ли настройка активной
    is_active = Column(Boolean, default=True, nullable=False)
    
    # Автоматические поля
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    # Составной индекс для быстрого поиска
    __table_args__ = (
        {'comment': 'Настройки администратора системы BookReader AI'}
    )
    
    @classmethod
    def create_default_settings(cls, db_session):
        """
        Создает настройки по умолчанию для всех модулей системы.
        """
        default_settings = [
            # NLP настройки
            {
                'category': 'nlp',
                'key': 'processor_type',
                'value_string': 'spacy',
                'description': 'Тип NLP процессора (spacy, natasha, hybrid)'
            },
            {
                'category': 'nlp',
                'key': 'spacy_model',
                'value_string': 'ru_core_news_lg',
                'description': 'Модель spaCy для обработки русского языка'
            },
            {
                'category': 'nlp',
                'key': 'min_description_length',
                'value_int': 50,
                'description': 'Минимальная длина описания в символах'
            },
            {
                'category': 'nlp',
                'key': 'max_description_length', 
                'value_int': 1000,
                'description': 'Максимальная длина описания в символах'
            },
            {
                'category': 'nlp',
                'key': 'min_word_count',
                'value_int': 10,
                'description': 'Минимальное количество слов в описании'
            },
            {
                'category': 'nlp',
                'key': 'confidence_threshold',
                'value_float': 0.3,
                'description': 'Порог уверенности для классификации'
            },
            {
                'category': 'nlp',
                'key': 'enable_location_extraction',
                'value_bool': True,
                'description': 'Включить извлечение описаний локаций'
            },
            {
                'category': 'nlp',
                'key': 'enable_character_extraction',
                'value_bool': True,
                'description': 'Включить извлечение описаний персонажей'
            },
            {
                'category': 'nlp',
                'key': 'enable_atmosphere_extraction',
                'value_bool': True,
                'description': 'Включить извлечение атмосферных описаний'
            },
            
            # Настройки парсинга
            {
                'category': 'parsing',
                'key': 'max_concurrent_tasks',
                'value_int': 1,
                'description': 'Максимальное количество одновременных задач парсинга'
            },
            {
                'category': 'parsing',
                'key': 'task_timeout_minutes',
                'value_int': 30,
                'description': 'Тайм-аут задачи парсинга в минутах'
            },
            {
                'category': 'parsing',
                'key': 'retry_attempts',
                'value_int': 3,
                'description': 'Количество попыток повтора при ошибке'
            },
            {
                'category': 'parsing',
                'key': 'priority_weights',
                'value': {'free': 1, 'premium': 5, 'ultimate': 10},
                'description': 'Веса приоритетов для разных планов подписки'
            },
            
            # Настройки генерации изображений
            {
                'category': 'image_generation',
                'key': 'primary_service',
                'value_string': 'pollinations',
                'description': 'Основной сервис генерации изображений'
            },
            {
                'category': 'image_generation',
                'key': 'fallback_services',
                'value': ['stable_diffusion', 'openai_dalle'],
                'description': 'Резервные сервисы генерации изображений'
            },
            {
                'category': 'image_generation',
                'key': 'enable_caching',
                'value_bool': True,
                'description': 'Включить кэширование сгенерированных изображений'
            },
            {
                'category': 'image_generation',
                'key': 'image_quality',
                'value_string': 'high',
                'description': 'Качество генерируемых изображений (low, medium, high)'
            },
            {
                'category': 'image_generation',
                'key': 'max_generation_time',
                'value_int': 60,
                'description': 'Максимальное время генерации изображения в секундах'
            },
            
            # Настройки базы данных
            {
                'category': 'database',
                'key': 'connection_pool_size',
                'value_int': 20,
                'description': 'Размер пула соединений к базе данных'
            },
            {
                'category': 'database',
                'key': 'query_timeout_seconds',
                'value_int': 30,
                'description': 'Тайм-аут запросов к базе данных в секундах'
            },
            {
                'category': 'database',
                'key': 'enable_sql_logging',
                'value_bool': False,
                'description': 'Включить логирование SQL запросов'
            },
            
            # Настройки кэширования (Redis)
            {
                'category': 'caching',
                'key': 'default_ttl_seconds',
                'value_int': 3600,
                'description': 'TTL по умолчанию для кэша в секундах'
            },
            {
                'category': 'caching',
                'key': 'enable_query_caching',
                'value_bool': True,
                'description': 'Включить кэширование запросов к базе данных'
            },
            {
                'category': 'caching',
                'key': 'enable_api_response_caching',
                'value_bool': True,
                'description': 'Включить кэширование ответов API'
            },
            
            # Системные настройки
            {
                'category': 'system',
                'key': 'maintenance_mode',
                'value_bool': False,
                'description': 'Режим технического обслуживания'
            },
            {
                'category': 'system',
                'key': 'max_upload_size_mb',
                'value_int': 50,
                'description': 'Максимальный размер загружаемого файла в МБ'
            },
            {
                'category': 'system',
                'key': 'supported_book_formats',
                'value': ['epub', 'fb2'],
                'description': 'Поддерживаемые форматы книг'
            },
            {
                'category': 'system',
                'key': 'enable_debug_mode',
                'value_bool': False,
                'description': 'Включить режим отладки'
            },
            
            # Настройки уведомлений
            {
                'category': 'notifications',
                'key': 'enable_email_notifications',
                'value_bool': True,
                'description': 'Включить email уведомления'
            },
            {
                'category': 'notifications',
                'key': 'admin_email',
                'value_string': 'admin@bookreader.ai',
                'description': 'Email администратора для уведомлений'
            },
            {
                'category': 'notifications',
                'key': 'notify_on_errors',
                'value_bool': True,
                'description': 'Уведомлять администратора об ошибках'
            }
        ]
        
        return default_settings
    
    def __repr__(self):
        return f"<AdminSettings(category='{self.category}', key='{self.key}', value='{self.get_value()}')>"
    
    def get_value(self):
        """
        Возвращает значение настройки в зависимости от типа.
        """
        if self.value is not None:
            return self.value
        elif self.value_string is not None:
            return self.value_string
        elif self.value_int is not None:
            return self.value_int
        elif self.value_float is not None:
            return self.value_float
        elif self.value_bool is not None:
            return self.value_bool
        else:
            return None
    
    def set_value(self, value):
        """
        Устанавливает значение настройки, автоматически определяя тип.
        """
        # Сбрасываем все типы
        self.value = None
        self.value_string = None
        self.value_int = None
        self.value_float = None
        self.value_bool = None
        
        # Устанавливаем правильный тип
        if isinstance(value, bool):
            self.value_bool = value
        elif isinstance(value, int):
            self.value_int = value
        elif isinstance(value, float):
            self.value_float = value
        elif isinstance(value, str):
            self.value_string = value
        elif isinstance(value, (dict, list)):
            self.value = value
        else:
            self.value_string = str(value)