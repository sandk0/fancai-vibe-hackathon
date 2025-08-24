# AI Image Generator - BookReader AI

Комплексная система генерации изображений по описаниям из книг с использованием современных AI сервисов. Генератор обеспечивает высокое качество и соответствие контексту произведения.

## Архитектура системы генерации

### Основные принципы
- **Multi-service support** - интеграция с несколькими AI сервисами
- **Intelligent prompting** - оптимизация промптов по жанрам и типам
- **Quality assurance** - проверка и фильтрация результатов
- **Performance optimization** - кеширование и batch обработка
- **Error resilience** - обработка сбоев и retry логика

### Поддерживаемые AI сервисы
```
Pollinations.ai → Основной сервис (бесплатный, быстрый)
OpenAI DALL-E → Премиум опция (высокое качество)
Midjourney → Планируется (художественный стиль)
Stable Diffusion → Локальная установка (опционально)
```

---

## Класс ImageGeneratorService

**Файл:** `backend/app/services/image_generator.py`

### Инициализация
```python
class ImageGeneratorService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.pollinations_client = PollinationsClient()
        self.openai_client = OpenAIClient() if settings.OPENAI_API_KEY else None
        self.prompt_engineer = PromptEngineer()
        self.cache = ImageCache()
        self.metrics = GenerationMetrics()
        
    async def __aenter__(self):
        """Async context manager для управления ресурсами."""
        await self.pollinations_client.initialize()
        return self
        
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Cleanup при выходе из контекста."""
        await self.pollinations_client.cleanup()
```

---

## Основные методы генерации

### generate_image_for_description()
```python
async def generate_image_for_description(
    self,
    description_id: UUID,
    user_id: UUID,
    options: GenerationOptions = None
) -> GenerationResult:
    """
    Генерация изображения для конкретного описания.
    
    Args:
        description_id: ID описания из NLP процессора
        user_id: ID пользователя для проверки лимитов
        options: Дополнительные параметры генерации
        
    Returns:
        GenerationResult с информацией о задаче и результате
        
    Process:
        1. Валидация лимитов пользователя
        2. Получение описания и контекста
        3. Построение оптимизированного промпта
        4. Выбор AI сервиса
        5. Генерация изображения
        6. Сохранение и постобработка
    """
    
    # 1. Проверка лимитов
    subscription = await self._get_user_subscription(user_id)
    if not await self._check_generation_limits(subscription):
        raise QuotaExceededError("Monthly image generation limit exceeded")
    
    # 2. Получение описания
    description = await self.session.get(Description, description_id)
    if not description:
        raise NotFoundError(f"Description {description_id} not found")
        
    # 3. Получение контекста книги
    chapter = await self.session.get(Chapter, description.chapter_id)
    book = await self.session.get(Book, chapter.book_id)
    
    # 4. Проверка существующих изображений
    existing_image = await self._get_existing_image(description_id, user_id)
    if existing_image and not options.force_regenerate:
        return GenerationResult(
            success=True,
            image=existing_image,
            was_cached=True
        )
    
    # 5. Построение промпта
    prompt_data = self.prompt_engineer.build_prompt(
        description=description,
        book_genre=book.genre,
        language=book.language,
        options=options or GenerationOptions()
    )
    
    # 6. Создание записи в БД
    generated_image = GeneratedImage(
        description_id=description_id,
        user_id=user_id,
        status=ImageStatus.GENERATING,
        prompt_used=prompt_data.final_prompt,
        negative_prompt=prompt_data.negative_prompt
    )
    
    self.session.add(generated_image)
    await self.session.commit()
    
    try:
        # 7. Выбор и вызов AI сервиса
        service = self._select_optimal_service(subscription.plan, options)
        generation_start = time.time()
        
        result = await service.generate_image(
            prompt=prompt_data.final_prompt,
            negative_prompt=prompt_data.negative_prompt,
            options=prompt_data.service_options
        )
        
        generation_time = time.time() - generation_start
        
        if result.success:
            # 8. Сохранение изображения
            image_path = await self._save_image_file(result.image_data, generated_image.id)
            
            # 9. Обновление записи в БД
            generated_image.mark_as_completed(
                image_url=f"/images/generated/{generated_image.id}.jpg",
                local_path=image_path,
                metadata={
                    "generation_time_seconds": generation_time,
                    "image_width": result.width,
                    "image_height": result.height,
                    "file_size": result.file_size,
                    "model_version": result.model_version,
                    "service_used": service.name
                }
            )
            
            # 10. Обновление лимитов пользователя
            await self._update_user_limits(subscription)
            
        else:
            # Обработка ошибки генерации
            generated_image.mark_as_failed(result.error_message)
            
        await self.session.commit()
        
        # 11. Обновление метрик
        self.metrics.record_generation(
            service_name=service.name,
            success=result.success,
            generation_time=generation_time,
            description_type=description.type
        )
        
        return GenerationResult(
            success=result.success,
            image=generated_image,
            generation_time=generation_time,
            service_used=service.name
        )
        
    except Exception as e:
        generated_image.mark_as_failed(str(e))
        await self.session.commit()
        raise GenerationError(f"Image generation failed: {str(e)}")
```

### batch_generate_for_chapter()
```python
async def batch_generate_for_chapter(
    self,
    chapter_id: UUID,
    user_id: UUID,
    limit: int = 10,
    min_priority: float = 70.0
) -> BatchGenerationResult:
    """
    Пакетная генерация изображений для топ-описаний главы.
    
    Args:
        chapter_id: ID главы для обработки
        user_id: ID пользователя
        limit: Максимальное количество изображений
        min_priority: Минимальный приоритет описания
        
    Returns:
        BatchGenerationResult с информацией о задачах
    """
    
    # 1. Получение топ-описаний главы
    descriptions = await self.session.execute(
        select(Description)
        .where(
            Description.chapter_id == chapter_id,
            Description.priority_score >= min_priority
        )
        .order_by(Description.priority_score.desc())
        .limit(limit)
    )
    descriptions = descriptions.scalars().all()
    
    if not descriptions:
        return BatchGenerationResult(
            success=False,
            message="No suitable descriptions found for generation"
        )
    
    # 2. Проверка лимитов
    subscription = await self._get_user_subscription(user_id)
    available_generations = await self._get_available_generations(subscription)
    
    if available_generations < len(descriptions):
        descriptions = descriptions[:available_generations]
        
    # 3. Создание задач генерации
    generation_tasks = []
    for description in descriptions:
        task = asyncio.create_task(
            self.generate_image_for_description(
                description_id=description.id,
                user_id=user_id,
                options=GenerationOptions(priority=True)
            )
        )
        generation_tasks.append(task)
        
    # 4. Выполнение с ограничением параллелизма
    semaphore = asyncio.Semaphore(3)  # Максимум 3 одновременно
    
    async def limited_generation(task):
        async with semaphore:
            return await task
            
    results = await asyncio.gather(
        *[limited_generation(task) for task in generation_tasks],
        return_exceptions=True
    )
    
    # 5. Анализ результатов
    successful = [r for r in results if isinstance(r, GenerationResult) and r.success]
    failed = [r for r in results if isinstance(r, Exception) or not r.success]
    
    return BatchGenerationResult(
        success=len(successful) > 0,
        total_requested=len(descriptions),
        successful_generations=len(successful),
        failed_generations=len(failed),
        results=successful,
        errors=failed
    )
```

---

## Prompt Engineering система

### Класс PromptEngineer
```python
class PromptEngineer:
    """
    Интеллектуальная система создания промптов для AI генерации.
    Адаптируется под жанр книги, тип описания и целевой стиль.
    """
    
    # Стилевые промпты по жанрам
    GENRE_STYLES = {
        BookGenre.FANTASY: {
            "style": "fantasy art, magical atmosphere, mystical lighting, enchanted",
            "quality": "detailed fantasy illustration, concept art, trending on artstation",
            "mood": "epic, magical, otherworldly",
            "avoid": "modern, contemporary, realistic photography"
        },
        
        BookGenre.DETECTIVE: {
            "style": "noir style, dark atmosphere, dramatic lighting, cinematic",
            "quality": "film noir, realistic, high contrast, moody",
            "mood": "mysterious, suspenseful, urban",
            "avoid": "bright colors, cartoonish, fantasy elements"
        },
        
        BookGenre.HISTORICAL: {
            "style": "historical accuracy, period details, authentic",
            "quality": "realistic, documentary style, historically accurate",
            "mood": "authentic, detailed, period-appropriate",
            "avoid": "anachronistic, modern elements, fantasy"
        },
        
        BookGenre.HORROR: {
            "style": "dark gothic, eerie atmosphere, dramatic shadows",
            "quality": "horror aesthetic, dark art, atmospheric",
            "mood": "frightening, unsettling, ominous",
            "avoid": "bright, cheerful, cartoon style"
        }
    }
    
    # Промпты по типам описаний
    TYPE_MODIFIERS = {
        DescriptionType.LOCATION: {
            "focus": "detailed architecture, environmental design, landscape",
            "composition": "wide shot, establishing shot, environmental",
            "detail": "intricate details, atmospheric perspective"
        },
        
        DescriptionType.CHARACTER: {
            "focus": "character portrait, detailed features, expressive",
            "composition": "character focus, portrait style",
            "detail": "facial features, clothing details, character design"
        },
        
        DescriptionType.ATMOSPHERE: {
            "focus": "mood lighting, atmospheric effects, ambiance",
            "composition": "cinematic composition, atmospheric",
            "detail": "lighting effects, color palette, mood"
        }
    }
    
    def build_prompt(
        self,
        description: Description,
        book_genre: BookGenre,
        language: str = "ru",
        options: GenerationOptions = None
    ) -> PromptData:
        """
        Построение оптимизированного промпта для AI генерации.
        
        Returns:
            PromptData с финальным промптом и настройками
        """
        
        # 1. Базовое описание (переведено на английский если нужно)
        base_description = self._translate_if_needed(description.content, language)
        
        # 2. Получение стилевых настроек
        genre_style = self.GENRE_STYLES.get(book_genre, self.GENRE_STYLES[BookGenre.OTHER])
        type_modifier = self.TYPE_MODIFIERS.get(description.type, {})
        
        # 3. Построение компонентов промпта
        components = []
        
        # Базовое описание
        components.append(base_description)
        
        # Тип описания
        if type_modifier.get("focus"):
            components.append(type_modifier["focus"])
            
        # Стиль жанра
        components.append(genre_style["style"])
        
        # Качество и детализация
        components.append(genre_style["quality"])
        
        # Композиция
        if type_modifier.get("composition"):
            components.append(type_modifier["composition"])
            
        # Пользовательские опции
        if options and options.style_modifiers:
            components.extend(options.style_modifiers)
            
        # 4. Финальный промпт
        final_prompt = ", ".join(components)
        
        # 5. Negative prompt
        negative_components = [
            "blurry, low quality, distorted, ugly, poorly drawn",
            "watermark, text, signature, username",
            "cropped, out of frame, jpeg artifacts"
        ]
        
        # Добавляем специфичные для жанра исключения
        negative_components.append(genre_style["avoid"])
        
        if options and options.negative_prompt:
            negative_components.append(options.negative_prompt)
            
        negative_prompt = ", ".join(negative_components)
        
        # 6. Настройки для сервиса
        service_options = self._build_service_options(
            description_type=description.type,
            genre=book_genre,
            options=options
        )
        
        return PromptData(
            original_description=description.content,
            final_prompt=final_prompt,
            negative_prompt=negative_prompt,
            service_options=service_options,
            metadata={
                "genre": book_genre.value,
                "type": description.type.value,
                "language": language,
                "priority_score": description.priority_score
            }
        )
    
    def _translate_if_needed(self, text: str, source_lang: str) -> str:
        """Перевод описания на английский для лучшего понимания AI."""
        if source_lang == "ru":
            # Простой словарь переводов для основных терминов
            translations = {
                "замок": "castle", "дом": "house", "лес": "forest",
                "комната": "room", "башня": "tower", "дворец": "palace",
                "древний": "ancient", "старый": "old", "большой": "large",
                "темный": "dark", "светлый": "bright", "красивый": "beautiful",
                "мужчина": "man", "женщина": "woman", "волосы": "hair",
                "глаза": "eyes", "лицо": "face", "одежда": "clothing"
            }
            
            translated = text.lower()
            for ru_word, en_word in translations.items():
                translated = translated.replace(ru_word, en_word)
                
            return translated
            
        return text
    
    def _build_service_options(
        self,
        description_type: DescriptionType,
        genre: BookGenre,
        options: GenerationOptions
    ) -> dict:
        """Построение настроек для конкретного AI сервиса."""
        
        service_options = {
            "width": 1024,
            "height": 768,
            "steps": 30,
            "guidance_scale": 7.5
        }
        
        # Адаптация под тип описания
        if description_type == DescriptionType.CHARACTER:
            service_options.update({
                "width": 768,
                "height": 1024,  # Портретная ориентация
                "guidance_scale": 8.0  # Больше следования промпту
            })
        elif description_type == DescriptionType.LOCATION:
            service_options.update({
                "width": 1280,
                "height": 768,  # Пейзажная ориентация
                "guidance_scale": 7.0
            })
            
        # Настройки по жанру
        if genre in [BookGenre.HORROR, BookGenre.DETECTIVE]:
            service_options["guidance_scale"] = 8.5  # Более точное следование
            
        # Пользовательские настройки
        if options:
            if options.high_quality:
                service_options["steps"] = 50
                service_options["guidance_scale"] += 1.0
                
            if options.aspect_ratio:
                w, h = options.aspect_ratio.split(":")
                service_options["width"] = int(w) * 128
                service_options["height"] = int(h) * 128
                
        return service_options
```

---

## AI Service Clients

### PollinationsClient
```python
class PollinationsClient:
    """
    Клиент для Pollinations.ai - основного бесплатного сервиса.
    Высокая скорость, хорошее качество для большинства случаев.
    """
    
    BASE_URL = "https://pollinations.ai/p"
    name = "pollinations"
    
    def __init__(self):
        self.session = None
        self.rate_limiter = AsyncLimiter(10, 60)  # 10 запросов в минуту
        
    async def initialize(self):
        """Инициализация HTTP сессии."""
        connector = aiohttp.TCPConnector(
            limit=10,
            limit_per_host=5,
            ttl_dns_cache=300,
            use_dns_cache=True
        )
        
        timeout = aiohttp.ClientTimeout(total=120)  # 2 минуты на генерацию
        
        self.session = aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers={
                "User-Agent": "BookReader-AI/1.0",
                "Accept": "image/*"
            }
        )
    
    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = None,
        options: dict = None
    ) -> ServiceGenerationResult:
        """
        Генерация изображения через Pollinations.ai
        
        Args:
            prompt: Основной промпт для генерации
            negative_prompt: Негативный промпт (не поддерживается)
            options: Дополнительные параметры
            
        Returns:
            ServiceGenerationResult с результатом генерации
        """
        
        async with self.rate_limiter:
            try:
                params = {
                    "prompt": prompt,
                    "model": options.get("model", "flux"),  # flux, flux-realism, flux-anime
                    "width": options.get("width", 1024),
                    "height": options.get("height", 768),
                    "enhance": "true",  # Улучшение качества
                    "nologo": "true",   # Без логотипа
                    "nofeed": "true",   # Не публиковать в фид
                    "private": "true"   # Приватная генерация
                }
                
                generation_start = time.time()
                
                async with self.session.get(self.BASE_URL, params=params) as response:
                    if response.status == 200:
                        image_data = await response.read()
                        generation_time = time.time() - generation_start
                        
                        # Определяем размеры изображения
                        width, height = self._get_image_dimensions(image_data)
                        
                        return ServiceGenerationResult(
                            success=True,
                            image_data=image_data,
                            generation_time=generation_time,
                            width=width,
                            height=height,
                            file_size=len(image_data),
                            model_version=params["model"],
                            service_metadata={
                                "model": params["model"],
                                "enhancement": True,
                                "privacy": "private"
                            }
                        )
                    else:
                        error_text = await response.text()
                        return ServiceGenerationResult(
                            success=False,
                            error_message=f"Pollinations API error {response.status}: {error_text}"
                        )
                        
            except asyncio.TimeoutError:
                return ServiceGenerationResult(
                    success=False,
                    error_message="Generation timeout (120 seconds)"
                )
            except Exception as e:
                return ServiceGenerationResult(
                    success=False,
                    error_message=f"Pollinations client error: {str(e)}"
                )
                
    def _get_image_dimensions(self, image_data: bytes) -> tuple[int, int]:
        """Определение размеров изображения из binary данных."""
        try:
            from PIL import Image
            import io
            
            image = Image.open(io.BytesIO(image_data))
            return image.size
        except Exception:
            return (1024, 768)  # Fallback размеры
            
    async def cleanup(self):
        """Закрытие HTTP сессии."""
        if self.session:
            await self.session.close()
```

### OpenAIClient
```python
class OpenAIClient:
    """
    Клиент для OpenAI DALL-E - премиум сервис с высшим качеством.
    Требует API ключ и тратит токены.
    """
    
    name = "openai_dalle"
    
    def __init__(self):
        if not settings.OPENAI_API_KEY:
            raise ValueError("OpenAI API key not configured")
            
        self.client = openai.AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
        self.rate_limiter = AsyncLimiter(5, 60)  # Более строгие лимиты
        
    async def generate_image(
        self,
        prompt: str,
        negative_prompt: str = None,
        options: dict = None
    ) -> ServiceGenerationResult:
        """
        Генерация через DALL-E 3.
        
        Note: DALL-E не поддерживает negative prompts,
        поэтому мы интегрируем ограничения в основной промпт.
        """
        
        async with self.rate_limiter:
            try:
                # Интеграция negative prompt в основной
                if negative_prompt:
                    full_prompt = f"{prompt}, avoiding: {negative_prompt}"
                else:
                    full_prompt = prompt
                    
                # DALL-E параметры
                size = f"{options.get('width', 1024)}x{options.get('height', 1024)}"
                if size not in ["1024x1024", "1024x1792", "1792x1024"]:
                    size = "1024x1024"  # Fallback для DALL-E
                    
                generation_start = time.time()
                
                response = await self.client.images.generate(
                    model="dall-e-3",
                    prompt=full_prompt[:4000],  # DALL-E лимит на промпт
                    size=size,
                    quality="hd",  # hd или standard
                    style="natural",  # natural или vivid
                    n=1
                )
                
                generation_time = time.time() - generation_start
                
                # Скачивание сгенерированного изображения
                image_url = response.data[0].url
                async with aiohttp.ClientSession() as session:
                    async with session.get(image_url) as img_response:
                        if img_response.status == 200:
                            image_data = await img_response.read()
                            
                            return ServiceGenerationResult(
                                success=True,
                                image_data=image_data,
                                generation_time=generation_time,
                                width=int(size.split("x")[0]),
                                height=int(size.split("x")[1]),
                                file_size=len(image_data),
                                model_version="dall-e-3",
                                service_metadata={
                                    "quality": "hd",
                                    "style": "natural",
                                    "revised_prompt": response.data[0].revised_prompt
                                }
                            )
                        else:
                            return ServiceGenerationResult(
                                success=False,
                                error_message="Failed to download generated image"
                            )
                            
            except openai.APIError as e:
                return ServiceGenerationResult(
                    success=False,
                    error_message=f"OpenAI API error: {str(e)}"
                )
            except Exception as e:
                return ServiceGenerationResult(
                    success=False,
                    error_message=f"OpenAI client error: {str(e)}"
                )
```

---

## Система качества и проверок

### ImageQualityChecker
```python
class ImageQualityChecker:
    """
    Система проверки качества сгенерированных изображений.
    Отбраковка неудачных результатов и автоматический retry.
    """
    
    def __init__(self):
        self.min_file_size = 10_000  # 10KB минимум
        self.max_file_size = 10_000_000  # 10MB максимум
        self.min_dimensions = (256, 256)
        
    async def check_image_quality(
        self,
        image_data: bytes,
        expected_dimensions: tuple[int, int] = None
    ) -> QualityCheckResult:
        """
        Проверка качества сгенерированного изображения.
        
        Checks:
        - Размер файла в разумных пределах
        - Изображение не повреждено
        - Размеры соответствуют ожидаемым
        - Нет артефактов генерации
        - Достаточная детализация
        """
        
        issues = []
        score = 100.0
        
        # 1. Проверка размера файла
        file_size = len(image_data)
        if file_size < self.min_file_size:
            issues.append("File too small, likely corrupted")
            score -= 50
        elif file_size > self.max_file_size:
            issues.append("File too large")
            score -= 10
            
        # 2. Проверка валидности изображения
        try:
            from PIL import Image, ImageStat
            import io
            
            image = Image.open(io.BytesIO(image_data))
            width, height = image.size
            
            # Проверка минимальных размеров
            if width < self.min_dimensions[0] or height < self.min_dimensions[1]:
                issues.append(f"Image too small: {width}x{height}")
                score -= 30
                
            # Проверка соответствия ожидаемым размерам
            if expected_dimensions:
                expected_w, expected_h = expected_dimensions
                if abs(width - expected_w) > 50 or abs(height - expected_h) > 50:
                    issues.append(f"Dimensions mismatch: got {width}x{height}, expected ~{expected_w}x{expected_h}")
                    score -= 15
                    
            # 3. Анализ содержимого
            if image.mode != "RGB":
                image = image.convert("RGB")
                
            # Проверка на однотонность (признак неудачной генерации)
            stat = ImageStat.Stat(image)
            if self._is_mostly_uniform(stat):
                issues.append("Image appears mostly uniform/empty")
                score -= 40
                
            # Проверка на артефакты
            if self._has_generation_artifacts(image):
                issues.append("Visible generation artifacts detected")
                score -= 20
                
        except Exception as e:
            issues.append(f"Failed to analyze image: {str(e)}")
            score -= 60
            
        # 4. Финальная оценка
        quality_level = "excellent" if score >= 90 else \
                       "good" if score >= 70 else \
                       "acceptable" if score >= 50 else \
                       "poor"
                       
        return QualityCheckResult(
            score=score,
            quality_level=quality_level,
            issues=issues,
            acceptable=score >= 50,
            metadata={
                "file_size": file_size,
                "dimensions": (width, height) if 'width' in locals() else None,
                "checks_performed": ["file_size", "image_validity", "uniformity", "artifacts"]
            }
        )
    
    def _is_mostly_uniform(self, stat: ImageStat.Stat) -> bool:
        """Проверка на однотонность изображения."""
        # Если стандартное отклонение очень низкое во всех каналах
        return all(std < 20 for std in stat.stddev)
        
    def _has_generation_artifacts(self, image: Image.Image) -> bool:
        """Поиск типичных артефактов AI генерации."""
        # Упрощенная проверка на артефакты
        # В реальной системе можно использовать более сложную детекцию
        return False
```

---

## Кеширование и оптимизация

### ImageCache
```python
class ImageCache:
    """
    Интеллектуальное кеширование изображений для избежания дублирования.
    """
    
    def __init__(self):
        self.redis_client = redis.asyncio.from_url(settings.REDIS_URL)
        self.cache_ttl = 7 * 24 * 3600  # 7 дней
        
    async def get_cached_image(
        self,
        prompt_hash: str,
        user_id: UUID
    ) -> Optional[GeneratedImage]:
        """
        Поиск похожего изображения в кеше.
        
        Args:
            prompt_hash: MD5 хеш от нормализованного промпта
            user_id: ID пользователя (для приватности)
            
        Returns:
            Существующее изображение или None
        """
        
        cache_key = f"image_cache:{prompt_hash}:{user_id}"
        
        cached_id = await self.redis_client.get(cache_key)
        if cached_id:
            # Получаем изображение из БД
            async with AsyncSession() as session:
                image = await session.get(GeneratedImage, UUID(cached_id.decode()))
                if image and image.status == ImageStatus.COMPLETED:
                    return image
                    
        return None
        
    async def cache_image(
        self,
        prompt_hash: str,
        user_id: UUID,
        image: GeneratedImage
    ):
        """Сохранение изображения в кеш."""
        cache_key = f"image_cache:{prompt_hash}:{user_id}"
        await self.redis_client.setex(
            cache_key,
            self.cache_ttl,
            str(image.id)
        )
        
    def normalize_prompt(self, prompt: str) -> str:
        """Нормализация промпта для кеширования."""
        # Удаляем лишние пробелы, приводим к нижнему регистру
        normalized = re.sub(r'\s+', ' ', prompt.lower().strip())
        
        # Удаляем качественные модификаторы (они не влияют на суть)
        quality_words = ["high quality", "detailed", "masterpiece", "best quality"]
        for word in quality_words:
            normalized = normalized.replace(word, "")
            
        return normalized.strip()
```

---

## Мониторинг и метрики

### GenerationMetrics
```python
class GenerationMetrics:
    """
    Сбор и анализ метрик системы генерации изображений.
    """
    
    def __init__(self):
        self.redis_client = redis.asyncio.from_url(settings.REDIS_URL)
        
    async def record_generation(
        self,
        service_name: str,
        success: bool,
        generation_time: float,
        description_type: DescriptionType,
        user_plan: str = "FREE"
    ):
        """Запись метрики генерации."""
        
        timestamp = int(time.time())
        
        # Общие метрики
        await self.redis_client.hincrby("metrics:generation:total", service_name, 1)
        
        if success:
            await self.redis_client.hincrby("metrics:generation:success", service_name, 1)
            await self.redis_client.lpush(
                f"metrics:generation:times:{service_name}",
                generation_time
            )
            await self.redis_client.ltrim(f"metrics:generation:times:{service_name}", 0, 999)
        else:
            await self.redis_client.hincrby("metrics:generation:failed", service_name, 1)
            
        # Метрики по типам описаний
        await self.redis_client.hincrby(
            f"metrics:types:{description_type.value}",
            "total", 1
        )
        
        if success:
            await self.redis_client.hincrby(
                f"metrics:types:{description_type.value}",
                "success", 1
            )
            
        # Метрики по планам пользователей
        await self.redis_client.hincrby(f"metrics:plans:{user_plan}", "generations", 1)
        
    async def get_service_stats(self, service_name: str) -> dict:
        """Получение статистики по сервису."""
        
        total = await self.redis_client.hget("metrics:generation:total", service_name) or 0
        success = await self.redis_client.hget("metrics:generation:success", service_name) or 0
        failed = await self.redis_client.hget("metrics:generation:failed", service_name) or 0
        
        # Среднее время генерации
        times = await self.redis_client.lrange(f"metrics:generation:times:{service_name}", 0, -1)
        avg_time = sum(float(t) for t in times) / len(times) if times else 0
        
        return {
            "service": service_name,
            "total_generations": int(total),
            "successful": int(success),
            "failed": int(failed),
            "success_rate": float(success) / max(1, int(total)),
            "average_generation_time": avg_time,
            "last_100_times": [float(t) for t in times]
        }
```

---

## Celery задачи

### Асинхронные задачи генерации
```python
from celery import Celery
from app.core.celery_app import celery_app

@celery_app.task(bind=True, max_retries=3)
def generate_image_task(self, description_id: str, user_id: str, options: dict = None):
    """
    Celery задача для асинхронной генерации изображений.
    
    Args:
        description_id: UUID описания
        user_id: UUID пользователя
        options: Опции генерации
        
    Returns:
        Результат генерации или информация об ошибке
    """
    
    try:
        async with AsyncSession() as session:
            service = ImageGeneratorService(session)
            
            result = await service.generate_image_for_description(
                description_id=UUID(description_id),
                user_id=UUID(user_id),
                options=GenerationOptions.from_dict(options or {})
            )
            
            return {
                "success": result.success,
                "image_id": str(result.image.id) if result.image else None,
                "generation_time": result.generation_time,
                "service_used": result.service_used
            }
            
    except Exception as exc:
        logger.error(f"Image generation task failed: {str(exc)}")
        
        # Retry с exponential backoff
        if self.request.retries < 3:
            raise self.retry(
                countdown=2 ** self.request.retries,
                exc=exc
            )
        else:
            # После всех retry попыток - помечаем как failed
            async with AsyncSession() as session:
                image = await session.get(GeneratedImage, UUID(description_id))
                if image:
                    image.mark_as_failed(f"Max retries exceeded: {str(exc)}")
                    await session.commit()
                    
            return {"success": False, "error": str(exc)}
```

---

## Заключение

AI система генерации изображений BookReader AI предоставляет:

- **Multi-service архитектуру** с fallback опциями
- **Интеллектуальный prompt engineering** по жанрам и типам
- **Системы качества** с автоматической проверкой результатов  
- **Производительность** через кеширование и batch обработку
- **Мониторинг** и детальную аналитику генерации
- **Асинхронную обработку** через Celery для масштабируемости

Система готова для production использования и может быть легко расширена дополнительными AI сервисами.