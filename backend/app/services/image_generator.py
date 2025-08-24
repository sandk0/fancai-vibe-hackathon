"""
Сервис для генерации изображений по описаниям из книг.

Интегрируется с pollinations.ai API для создания изображений
на основе NLP описаний, извлеченных из текста книг.
"""

import asyncio
import aiohttp
import hashlib
import json
from typing import Dict, Any, Optional, List
from pathlib import Path
from datetime import datetime
from urllib.parse import quote
from dataclasses import dataclass
import logging

from ..models.description import Description, DescriptionType
from ..models.image import GeneratedImage

logger = logging.getLogger(__name__)


@dataclass
class ImageGenerationRequest:
    """Запрос на генерацию изображения."""
    description_content: str
    description_type: DescriptionType
    chapter_id: str
    user_id: str
    style_prompt: Optional[str] = None
    negative_prompt: Optional[str] = None


@dataclass
class ImageGenerationResult:
    """Результат генерации изображения."""
    success: bool
    image_url: Optional[str] = None
    local_path: Optional[str] = None
    error_message: Optional[str] = None
    generation_time_seconds: Optional[float] = None


class PromptEngineer:
    """Класс для создания и оптимизации промптов для генерации изображений."""
    
    def __init__(self):
        self.style_templates = {
            DescriptionType.LOCATION: {
                "prefix": "Beautiful detailed landscape, cinematic lighting,",
                "suffix": ", high quality, 8k resolution, artistic masterpiece",
                "style": "fantasy art style, atmospheric"
            },
            DescriptionType.CHARACTER: {
                "prefix": "Portrait of character, detailed face, expressive eyes,",
                "suffix": ", professional artwork, high detail, fantasy illustration",
                "style": "character art style, realistic proportions"
            },
            DescriptionType.ATMOSPHERE: {
                "prefix": "Atmospheric scene, mood lighting, emotional ambiance,",
                "suffix": ", cinematic composition, artistic interpretation",
                "style": "impressionistic style, evocative"
            },
            DescriptionType.OBJECT: {
                "prefix": "Detailed object study, clear focus, artistic presentation,",
                "suffix": ", high quality render, professional photography",
                "style": "still life style, realistic"
            },
            DescriptionType.ACTION: {
                "prefix": "Dynamic action scene, movement captured, energy and motion,",
                "suffix": ", cinematic moment, dramatic composition",
                "style": "action art style, dynamic"
            }
        }
        
        self.negative_prompts = {
            "default": "blurry, low quality, distorted, ugly, bad anatomy, extra limbs, duplicate, watermark, text, signature, deformed",
            "character": "bad face, extra arms, extra legs, malformed hands, bad proportions, duplicate person",
            "location": "blurry background, low resolution, oversaturated, cartoon style"
        }
    
    def create_prompt(self, description: str, description_type: DescriptionType, 
                     custom_style: Optional[str] = None) -> Dict[str, str]:
        """
        Создает оптимизированный промпт для генерации изображения.
        
        Args:
            description: Исходное описание из текста
            description_type: Тип описания
            custom_style: Дополнительные стилевые инструкции
            
        Returns:
            Словарь с положительным и отрицательным промптами
        """
        template = self.style_templates.get(description_type, self.style_templates[DescriptionType.LOCATION])
        
        # Очищаем и оптимизируем исходное описание
        cleaned_description = self._clean_description(description)
        
        # Формируем основной промпт
        main_prompt = f"{template['prefix']} {cleaned_description}"
        
        # Добавляем стилевые элементы
        if custom_style:
            main_prompt += f", {custom_style}"
        else:
            main_prompt += f", {template['style']}"
        
        main_prompt += f" {template['suffix']}"
        
        # Выбираем подходящий негативный промпт
        negative_key = "character" if description_type == DescriptionType.CHARACTER else "default"
        negative_prompt = self.negative_prompts.get(negative_key, self.negative_prompts["default"])
        
        return {
            "positive": main_prompt,
            "negative": negative_prompt
        }
    
    def _clean_description(self, description: str) -> str:
        """
        Очищает и оптимизирует описание для лучшей генерации.
        
        Args:
            description: Исходное описание
            
        Returns:
            Очищенное описание
        """
        # Убираем лишние символы и приводим к единому формату
        cleaned = description.strip()
        
        # Ограничиваем длину (API имеет лимиты)
        max_length = 200
        if len(cleaned) > max_length:
            cleaned = cleaned[:max_length].rsplit(' ', 1)[0] + "..."
        
        # Заменяем специфичные для русского языка термины на более универсальные
        replacements = {
            "избушка": "wooden hut",
            "терем": "wooden tower house", 
            "богатырь": "knight warrior",
            "царевна": "princess",
            "дремучий лес": "dense dark forest"
        }
        
        for ru_term, en_term in replacements.items():
            cleaned = cleaned.replace(ru_term, en_term)
        
        return cleaned


class PollinationsImageGenerator:
    """Клиент для работы с Pollinations.ai API."""
    
    def __init__(self):
        self.base_url = "https://image.pollinations.ai/prompt"
        self.timeout = aiohttp.ClientTimeout(total=60)
        self.max_retries = 3
        
        # Настройки по умолчанию для качества изображений
        self.default_params = {
            "width": 1024,
            "height": 768,
            "seed": None,  # Для воспроизводимости можно задать фиксированный seed
            "model": "flux",  # Используем flux модель для лучшего качества
            "enhance": True
        }
    
    async def generate_image(self, prompt: str, **kwargs) -> ImageGenerationResult:
        """
        Генерирует изображение по промпту.
        
        Args:
            prompt: Текстовый промпт для генерации
            **kwargs: Дополнительные параметры (width, height, seed, etc.)
            
        Returns:
            Результат генерации изображения
        """
        start_time = datetime.now()
        
        # Объединяем параметры по умолчанию с переданными
        params = {**self.default_params, **kwargs}
        
        # Кодируем промпт для URL
        encoded_prompt = quote(prompt)
        
        # Формируем URL для генерации
        url = f"{self.base_url}/{encoded_prompt}"
        
        # Добавляем параметры к URL
        url_params = []
        for key, value in params.items():
            if value is not None:
                url_params.append(f"{key}={value}")
        
        if url_params:
            url += "?" + "&".join(url_params)
        
        logger.info(f"Generating image with URL: {url}")
        
        for attempt in range(self.max_retries):
            try:
                async with aiohttp.ClientSession(timeout=self.timeout) as session:
                    async with session.get(url) as response:
                        if response.status == 200:
                            # Получаем изображение как байты
                            image_data = await response.read()
                            
                            # Сохраняем изображение локально
                            image_path = await self._save_image(image_data, prompt)
                            
                            generation_time = (datetime.now() - start_time).total_seconds()
                            
                            return ImageGenerationResult(
                                success=True,
                                image_url=url,
                                local_path=image_path,
                                generation_time_seconds=generation_time
                            )
                        else:
                            error_msg = f"API returned status {response.status}"
                            logger.warning(f"Generation attempt {attempt + 1} failed: {error_msg}")
                            
                            if attempt == self.max_retries - 1:
                                return ImageGenerationResult(
                                    success=False,
                                    error_message=error_msg
                                )
                            
                            # Ждем перед повторной попыткой
                            await asyncio.sleep(2 ** attempt)
                            
            except Exception as e:
                error_msg = f"Request failed: {str(e)}"
                logger.error(f"Generation attempt {attempt + 1} error: {error_msg}")
                
                if attempt == self.max_retries - 1:
                    return ImageGenerationResult(
                        success=False,
                        error_message=error_msg
                    )
                
                await asyncio.sleep(2 ** attempt)
        
        return ImageGenerationResult(
            success=False,
            error_message="Max retries exceeded"
        )
    
    async def _save_image(self, image_data: bytes, prompt: str) -> str:
        """
        Сохраняет изображение в локальное хранилище.
        
        Args:
            image_data: Данные изображения
            prompt: Промпт для создания уникального имени файла
            
        Returns:
            Путь к сохраненному файлу
        """
        # Создаем директорию для изображений если её нет
        images_dir = Path("/tmp/generated_images")
        images_dir.mkdir(exist_ok=True)
        
        # Создаем уникальное имя файла на основе хеша промпта
        prompt_hash = hashlib.md5(prompt.encode()).hexdigest()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{timestamp}_{prompt_hash[:8]}.png"
        
        file_path = images_dir / filename
        
        # Сохраняем файл
        with open(file_path, 'wb') as f:
            f.write(image_data)
        
        logger.info(f"Image saved to: {file_path}")
        return str(file_path)


class ImageGeneratorService:
    """Основной сервис для генерации изображений."""
    
    def __init__(self):
        self.prompt_engineer = PromptEngineer()
        self.pollinations_client = PollinationsImageGenerator()
        self.generation_queue: List[ImageGenerationRequest] = []
        self.is_processing = False
    
    async def generate_image_for_description(
        self,
        description: Description,
        user_id: str,
        custom_style: Optional[str] = None
    ) -> ImageGenerationResult:
        """
        Генерирует изображение для конкретного описания.
        
        Args:
            description: Описание из базы данных
            user_id: ID пользователя
            custom_style: Дополнительный стиль (опционально)
            
        Returns:
            Результат генерации
        """
        # Создаем оптимизированный промпт
        prompts = self.prompt_engineer.create_prompt(
            description.content,
            description.type,
            custom_style
        )
        
        # Генерируем изображение
        result = await self.pollinations_client.generate_image(
            prompts["positive"],
            negative_prompt=prompts["negative"]
        )
        
        logger.info(f"Image generation result for description {description.id}: success={result.success}")
        
        return result
    
    async def batch_generate_for_chapter(
        self,
        descriptions: List[Description],
        user_id: str,
        max_images: int = 5
    ) -> List[ImageGenerationResult]:
        """
        Генерирует изображения для списка описаний из главы.
        
        Args:
            descriptions: Список описаний
            user_id: ID пользователя
            max_images: Максимальное количество изображений для генерации
            
        Returns:
            Список результатов генерации
        """
        # Сортируем описания по приоритету и берем топ-N
        sorted_descriptions = sorted(descriptions, key=lambda d: d.priority_score, reverse=True)[:max_images]
        
        results = []
        
        for desc in sorted_descriptions:
            try:
                result = await self.generate_image_for_description(desc, user_id)
                results.append(result)
                
                # Добавляем небольшую задержку между запросами
                if len(results) < len(sorted_descriptions):
                    await asyncio.sleep(1)
                    
            except Exception as e:
                logger.error(f"Error generating image for description {desc.id}: {str(e)}")
                results.append(ImageGenerationResult(
                    success=False,
                    error_message=f"Generation error: {str(e)}"
                ))
        
        return results
    
    def add_to_queue(self, request: ImageGenerationRequest):
        """Добавляет запрос в очередь генерации."""
        self.generation_queue.append(request)
        logger.info(f"Added generation request to queue. Queue size: {len(self.generation_queue)}")
    
    async def process_queue(self):
        """Обрабатывает очередь запросов на генерацию."""
        if self.is_processing:
            logger.info("Queue is already being processed")
            return
        
        self.is_processing = True
        
        try:
            while self.generation_queue:
                request = self.generation_queue.pop(0)
                
                logger.info(f"Processing generation request for user {request.user_id}")
                
                # Создаем промпт
                prompts = self.prompt_engineer.create_prompt(
                    request.description_content,
                    request.description_type,
                    request.style_prompt
                )
                
                # Генерируем изображение
                result = await self.pollinations_client.generate_image(
                    prompts["positive"],
                    negative_prompt=request.negative_prompt or prompts["negative"]
                )
                
                if result.success:
                    logger.info(f"Successfully generated image: {result.local_path}")
                else:
                    logger.error(f"Failed to generate image: {result.error_message}")
                
                # Добавляем задержку между обработкой запросов
                await asyncio.sleep(2)
                
        except Exception as e:
            logger.error(f"Error processing generation queue: {str(e)}")
        finally:
            self.is_processing = False
    
    async def get_generation_stats(self) -> Dict[str, Any]:
        """
        Возвращает статистику по генерации изображений.
        
        Returns:
            Словарь со статистикой
        """
        return {
            "queue_size": len(self.generation_queue),
            "is_processing": self.is_processing,
            "supported_types": [t.value for t in DescriptionType],
            "api_status": "operational"  # В будущем можно добавить проверку статуса API
        }


# Глобальный экземпляр сервиса
image_generator_service = ImageGeneratorService()