# План доработок системы генерации изображений

**Дата:** 4 января 2026
**Статус:** Фаза 1 завершена
**Приоритет:** КРИТИЧЕСКИЙ

---

## Обзор

Фоновая очередь Celery **уже реализована** на backend. Главная задача - **интегрировать frontend** с async эндпоинтами и исправить несогласованности.

---

## Фаза 1: Frontend интеграция с Async API (P0) ✅ ЗАВЕРШЕНА

**Цель:** Переключить frontend на асинхронную генерацию с polling.
**Статус:** Завершена 4 января 2026

### 1.1 Добавить async методы в API клиент

**Файл:** `frontend/src/api/images.ts`

```typescript
// ДОБАВИТЬ:
export const imagesAPI = {
  // ... существующие методы ...

  /**
   * Асинхронная генерация изображения через Celery
   */
  async generateAsync(
    descriptionId: string,
    params: ImageGenerationParams = {},
    signal?: AbortSignal
  ): Promise<{ task_id: string; status: string }> {
    const response = await apiClient.post(
      `/images/generate/async/${descriptionId}`,
      params,
      { signal }
    );
    return response.data;
  },

  /**
   * Получить статус задачи Celery
   */
  async getTaskStatus(
    taskId: string
  ): Promise<{
    status: 'pending' | 'generating' | 'completed' | 'failed';
    result?: GeneratedImage;
    error?: string;
  }> {
    const response = await apiClient.get(`/images/task/${taskId}`);
    return response.data;
  },
};
```

---

### 1.2 Добавить хук useAsyncImageGeneration

**Файл:** `frontend/src/hooks/api/useImages.ts`

```typescript
// ДОБАВИТЬ:
export function useAsyncImageGeneration() {
  const queryClient = useQueryClient();
  const [taskId, setTaskId] = useState<string | null>(null);
  const [status, setStatus] = useState<GenerationStatus>('idle');

  // Mutation для запуска генерации
  const startGeneration = useMutation({
    mutationFn: async ({
      descriptionId,
      params,
    }: {
      descriptionId: string;
      params?: ImageGenerationParams;
    }) => {
      setStatus('generating');
      const { task_id } = await imagesAPI.generateAsync(descriptionId, params);
      setTaskId(task_id);
      return task_id;
    },
    onError: () => setStatus('error'),
  });

  // Polling для статуса задачи
  const { data: taskStatus } = useQuery({
    queryKey: ['imageTask', taskId],
    queryFn: () => imagesAPI.getTaskStatus(taskId!),
    enabled: !!taskId && status === 'generating',
    refetchInterval: 3000,  // Каждые 3 секунды
    refetchIntervalInBackground: true,
  });

  // Обновить статус при получении результата
  useEffect(() => {
    if (taskStatus?.status === 'completed') {
      setStatus('completed');
      // Инвалидировать кеш изображений
      queryClient.invalidateQueries({ queryKey: ['images'] });
    } else if (taskStatus?.status === 'failed') {
      setStatus('error');
    }
  }, [taskStatus]);

  return {
    startGeneration,
    status,
    taskStatus,
    isGenerating: status === 'generating',
    reset: () => {
      setTaskId(null);
      setStatus('idle');
    },
  };
}
```

---

### 1.3 Обновить useImageModal для async

**Файл:** `frontend/src/hooks/epub/useImageModal.ts`

```typescript
// ИЗМЕНИТЬ handleGenerateImage:

const handleGenerateImage = useCallback(async () => {
  if (!selectedDescription) return;

  try {
    setGenerationStatus('generating');

    // 1. Проверить кеш
    const cachedImage = await imageCache.get(userId, selectedDescription.id);
    if (cachedImage) {
      setCurrentImage({
        image_url: cachedImage.objectUrl,
        isCached: true,
      });
      setGenerationStatus('completed');
      return;
    }

    // 2. Использовать async API с polling
    const { task_id } = await imagesAPI.generateAsync(
      selectedDescription.id,
      { style_prompt: customStyle },
      abortControllerRef.current?.signal
    );

    // 3. Polling каждые 3 секунды
    const pollInterval = setInterval(async () => {
      try {
        const taskStatus = await imagesAPI.getTaskStatus(task_id);

        if (taskStatus.status === 'completed' && taskStatus.result) {
          clearInterval(pollInterval);
          setCurrentImage({
            ...taskStatus.result,
            isCached: false,
          });
          setGenerationStatus('completed');

          // Кешировать в IndexedDB
          await imageCache.set(userId, selectedDescription.id, taskStatus.result);
        } else if (taskStatus.status === 'failed') {
          clearInterval(pollInterval);
          setGenerationStatus('error');
          notify.error(taskStatus.error || 'Generation failed');
        }
      } catch (pollError) {
        clearInterval(pollInterval);
        setGenerationStatus('error');
      }
    }, 3000);

    // Сохранить интервал для cleanup
    pollingIntervalRef.current = pollInterval;

  } catch (error) {
    // Обработка 409 (already exists)
    if (isConflict(error)) {
      const existingImage = await imagesAPI.getImageForDescription(selectedDescription.id);
      setCurrentImage(existingImage);
      setGenerationStatus('completed');
    } else {
      setGenerationStatus('error');
    }
  }
}, [selectedDescription, userId, customStyle]);
```

---

### 1.4 Добавить cleanup для polling

**Файл:** `frontend/src/hooks/epub/useImageModal.ts`

```typescript
// ДОБАВИТЬ ref и cleanup:

const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

useEffect(() => {
  return () => {
    // Cleanup polling при unmount
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }
    abortControllerRef.current?.abort();
  };
}, []);
```

---

## Фаза 2: Backend исправления (P0-P1)

### 2.1 Унифицировать celery_app

**Задача:** Объединить `celery_app.py` и `celery_config.py`

**Файл:** `backend/app/core/celery_app.py`

```python
# ИЗМЕНИТЬ: Интегрировать ResourceAwareCelery из celery_config.py

from celery import Celery
import psutil
from app.core.config import settings

RESOURCE_LIMITS = {
    "max_memory_percent": 85,
    "max_cpu_percent": 90,
    "min_free_memory_mb": 500,
}

class ResourceAwareCelery(Celery):
    """Celery с мониторингом ресурсов."""

    def check_resources(self) -> bool:
        memory = psutil.virtual_memory()
        if memory.percent > RESOURCE_LIMITS["max_memory_percent"]:
            return False
        if memory.available / (1024 * 1024) < RESOURCE_LIMITS["min_free_memory_mb"]:
            return False
        return True

celery_app = ResourceAwareCelery(
    "bookreader",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.core.tasks", "app.tasks.reading_sessions_tasks"],
)

# ... остальная конфигурация ...
```

**Действие:** Удалить `celery_config.py` после интеграции.

---

### 2.2 Исправить двойной retry

**Задача:** Отключить tenacity retry для Celery задач

**Файл:** `backend/app/core/tasks.py`

```python
@celery_app.task(
    name="generate_image_task",
    bind=True,
    max_retries=5,  # Увеличить Celery retries
    default_retry_delay=30,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
async def generate_image_task(
    self,
    description_id: str,
    user_id: str,
    ...
) -> Dict[str, Any]:
    try:
        # Вызывать напрямую, БЕЗ tenacity wrapper
        result = await imagen_service._generator._generate_direct(
            prompt=prompt,
            aspect_ratio=aspect_ratio,
        )
        ...
```

**Файл:** `backend/app/services/imagen_generator.py`

```python
# ДОБАВИТЬ метод без retry:
async def _generate_direct(
    self,
    prompt: str,
    aspect_ratio: Optional[str] = None,
) -> ImageGenerationResult:
    """Генерация без tenacity (для Celery)."""
    # Код из _generate_with_retry, но без @retry_image_generation
    ...

# СОХРАНИТЬ для синхронных вызовов:
@retry_image_generation
async def _generate_with_retry(...):
    ...
```

---

### 2.3 Запуск worker с очередями

**Файл:** `docker-compose.lite.yml`

```yaml
celery-worker:
  command: >
    celery -A app.core.celery_app worker
    --loglevel=info
    --concurrency=4
    -Q heavy,normal,light  # ДОБАВИТЬ указание очередей
```

---

### 2.4 Добавить rate limiting

**Файл:** `backend/app/routers/images.py`

```python
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

@router.post("/generate/description/{description_id}")
@limiter.limit("10/minute")  # 10 генераций в минуту
async def generate_image_for_description(
    request: Request,  # Добавить request для limiter
    ...
):
    ...

@router.post("/generate/async/{description_id}")
@limiter.limit("20/minute")  # Async можно чаще
async def generate_image_async(...):
    ...
```

---

## Фаза 3: Database оптимизация (P2)

### 3.1 Добавить partial индексы

**Миграция:** `2026_01_04_add_queue_indexes.py`

```python
def upgrade():
    # Индекс для очереди генерации
    op.execute("""
        CREATE INDEX idx_images_queue
        ON generated_images(created_at, retry_count)
        WHERE status IN ('pending', 'generating')
    """)

    # Индекс для failed с retry
    op.execute("""
        CREATE INDEX idx_images_failed_retry
        ON generated_images(retry_count, created_at)
        WHERE status = 'failed' AND retry_count < 5
    """)

    # Композитный индекс для сортировки
    op.execute("""
        CREATE INDEX idx_descriptions_chapter_priority
        ON descriptions(chapter_id, priority_score DESC)
    """)

def downgrade():
    op.drop_index("idx_images_queue")
    op.drop_index("idx_images_failed_retry")
    op.drop_index("idx_descriptions_chapter_priority")
```

---

### 3.2 Удалить избыточные колонки

**Миграция:** `2026_01_04_cleanup_generated_images.py`

```python
def upgrade():
    # Удалить избыточные колонки после NLP removal
    op.drop_column("generated_images", "description_text")
    op.drop_column("generated_images", "description_type")

def downgrade():
    op.add_column("generated_images",
        sa.Column("description_text", sa.Text(), nullable=True))
    op.add_column("generated_images",
        sa.Column("description_type", sa.String(50), nullable=True))
```

---

## Фаза 4: Frontend cleanup (P2)

### 4.1 Удалить дублирующий Zustand store

**Действие:** Удалить `frontend/src/stores/images.ts`

**Миграция кода:** Заменить все использования `useImagesStore` на хуки из `useImages.ts`

---

### 4.2 Перенести кеш переводов в Redis

**Файл:** `backend/app/services/imagen_generator.py`

```python
class PromptTranslator:
    def __init__(self, api_key: str, redis_client: Redis):
        self.redis = redis_client
        self._cache_ttl = 3600  # 1 час

    async def translate(self, russian_text: str) -> str:
        cache_key = f"translation:{hashlib.md5(russian_text.encode()).hexdigest()[:16]}"

        # Проверить Redis
        cached = await self.redis.get(cache_key)
        if cached:
            return cached.decode()

        # Перевести через Gemini
        translation = await self._translate_via_gemini(russian_text)

        # Сохранить в Redis
        await self.redis.setex(cache_key, self._cache_ttl, translation)

        return translation
```

---

## Порядок выполнения

| Фаза | Задачи | Приоритет | Статус |
|------|--------|-----------|--------|
| 1.1 | API клиент async методы | P0 | ✅ Завершено |
| 1.2 | Хук useAsyncImageGeneration | P0 | ✅ Завершено |
| 1.3 | Обновить useImageModal | P0 | ✅ Завершено |
| 1.4 | Cleanup polling | P0 | ✅ Завершено |
| 2.1 | Унифицировать celery_app | P0 | ⏳ К выполнению |
| 2.2 | Исправить двойной retry | P0 | ⏳ К выполнению |
| 2.3 | Worker с очередями | P1 | ⏳ К выполнению |
| 2.4 | Rate limiting | P1 | ⏳ К выполнению |
| 3.1 | Partial индексы | P2 | ⏳ К выполнению |
| 3.2 | Cleanup колонок | P2 | ⏳ К выполнению |
| 4.1 | Удалить Zustand store | P2 | ⏳ К выполнению |
| 4.2 | Redis кеш переводов | P2 | ⏳ К выполнению |

---

## Тестирование

### После Фазы 1 (Frontend)

- [ ] Генерация запускается, возвращает task_id
- [ ] Polling показывает прогресс (spinning indicator)
- [ ] Completed: изображение отображается
- [ ] Failed: показывается ошибка
- [ ] Отмена: polling останавливается

### После Фазы 2 (Backend)

- [ ] Celery worker получает задачи из всех очередей
- [ ] Retry работает корректно (5 попыток max)
- [ ] Rate limiting: 429 при превышении
- [ ] Нет дублирования retry

### После Фазы 3-4 (DB + Cleanup)

- [ ] Запросы к очереди используют partial индекс
- [ ] Zustand store удалён, приложение работает
- [ ] Переводы кешируются в Redis

---

## Связанные документы

- [01-analysis.md](./01-analysis.md) - Полный анализ системы
- [03-phase1-completion.md](./03-phase1-completion.md) - Отчёт о завершении Фазы 1
