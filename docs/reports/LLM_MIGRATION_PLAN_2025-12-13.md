# План миграции на чистый LLM-парсинг

**Дата:** 2025-12-13
**Статус:** УТВЕРЖДЁН К РЕАЛИЗАЦИИ
**Приоритет:** КРИТИЧЕСКИЙ

---

## Резюме

Настоящий документ описывает план полной миграции системы парсинга BookReader AI с гибридной NLP/LLM архитектуры на чистый LLM-парсинг с использованием Google Gemini API.

**Причина миграции:** Библиотека LangExtract возвращает сущности (NER) вместо полных описаний, что привело к 0 извлечённых описаний при парсинге 20 глав.

**Ожидаемые результаты:**
- Уменьшение размера Docker образа с 2.5GB до ~500MB
- Удаление ~9,000 строк legacy NLP кода
- Качество парсинга 85%+ (5-15 описаний на главу)
- Снижение затрат на API через кэширование

---

## 1. Анализ текущей архитектуры

### 1.1. NLP компоненты (К УДАЛЕНИЮ)

| Файл | Строк | Статус | Примечание |
|------|-------|--------|------------|
| `services/nlp_processor.py` | 589 | LEGACY | Старый процессор |
| `services/enhanced_nlp_system.py` | 714 | LEGACY | Заменён Multi-NLP |
| `services/deeppavlov_processor.py` | 378 | BLOCKED | Конфликты зависимостей |
| `services/gliner_processor.py` | 649 | ACTIVE | Zero-shot NER |
| `services/stanza_processor.py` | 563 | ACTIVE | Dependency parsing |
| `services/natasha_processor.py` | 554 | ACTIVE | Русская морфология |
| `services/nlp/` (15 модулей) | 3,455 | ACTIVE | Strategy pattern |
| **ИТОГО** | **~9,066** | | |

### 1.2. NLP зависимости (К УДАЛЕНИЮ)

| Библиотека | Размер модели | RAM | Назначение |
|------------|--------------|-----|------------|
| SpaCy (ru_core_news_lg) | 534MB | 800MB | NER, POS-tagging |
| Natasha | 50MB | 200MB | Русские имена, морфология |
| Stanza (ru) | 630MB | 780MB | Dependency parsing |
| GLiNER | 500MB | 600MB | Zero-shot NER |
| **ИТОГО** | **~1.7GB** | **~2.4GB** | |

### 1.3. Проблема LangExtract

```
Ожидалось: Полные описания (100+ символов)
{
  "descriptions": [
    {"type": "location", "content": "Высокие сводчатые потолки замка...", ...}
  ]
}

Получено: Короткие сущности (5-20 символов)
result.extractions = ["замок", "князь Алексей", "портьеры"]
```

**Корневая причина:** LangExtract — библиотека для NER (Named Entity Recognition), а не для извлечения параграфов.

---

## 2. Целевая архитектура

### 2.1. Компоненты нового LLM-парсера

```
┌─────────────────────────────────────────────────────────────┐
│                    GeminiDescriptionExtractor               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ TextChunker │→ │ PromptEngine │→ │ ResponseParser     │  │
│  │             │  │              │  │                    │  │
│  │ • Recursive │  │ • Few-shot   │  │ • JSON repair      │  │
│  │ • 1024 tok  │  │ • Русский    │  │ • Retry logic      │  │
│  │ • 15% overlap│ │ • По жанрам  │  │ • Validation       │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ CostOptim   │  │ QualityScore │  │ ResultAggregator   │  │
│  │             │  │              │  │                    │  │
│  │ • Caching   │  │ • 5 факторов │  │ • Deduplication    │  │
│  │ • Batching  │  │ • Confidence │  │ • Merge chunks     │  │
│  │ • Throttle  │  │ • Filtering  │  │ • Context enrich   │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2. Новые файлы

```
backend/app/services/
├── gemini_extractor.py          # Основной класс (NEW)
├── text_chunker.py              # Рекурсивный чанкинг (NEW)
├── prompt_templates/            # Шаблоны промптов (NEW)
│   ├── base.py                  # Базовый промпт
│   ├── fantasy.py               # Для фэнтези
│   ├── classic.py               # Для классики
│   └── scifi.py                 # Для научной фантастики
├── response_parser.py           # Парсинг JSON (NEW)
└── langextract_processor.py     # УДАЛИТЬ или рефакторить
```

---

## 3. Лучшие практики LLM-парсинга

### 3.1. Стратегия чанкинга (Chunking)

**Рекомендуемые параметры:**
- **Размер чанка:** 1024 токена (~4000 символов)
- **Перекрытие:** 15% (153 токена)
- **Метод:** Recursive Character Text Splitter
- **Разделители:** `["\n\n", "\n", ". ", " ", ""]`

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

splitter = RecursiveCharacterTextSplitter(
    chunk_size=4000,
    chunk_overlap=600,
    separators=["\n\n", "\n", ". ", " ", ""],
    length_function=len
)
chunks = splitter.split_text(chapter_text)
```

### 3.2. Структура промпта

**Few-shot промпт для русской литературы:**

```
Извлеки описания из русского текста для генерации иллюстраций.

## Типы описаний:
- **location**: Места, здания, ландшафты, интерьеры
- **character**: Внешность персонажей, одежда, черты лица
- **atmosphere**: Настроение, освещение, погода, звуки

## Правила:
1. Минимум 100 символов на описание
2. Сохраняй оригинальный текст автора
3. Только визуальные описания (не диалоги, не действия)
4. confidence от 0.0 до 1.0

## Примеры:

### Пример 1 (location):
Текст: "Замок возвышался над долиной, его серые башни касались низких облаков..."
Результат: {"type": "location", "content": "Замок возвышался над долиной, его серые башни касались низких облаков", "confidence": 0.9}

### Пример 2 (character):
Текст: "Высокий мужчина в потёртом плаще, с седой бородой и пронзительными серыми глазами..."
Результат: {"type": "character", "content": "Высокий мужчина в потёртом плаще, с седой бородой и пронзительными серыми глазами", "confidence": 0.85}

## Текст для анализа:
{text}

## Ответ (только JSON):
{"descriptions": [...]}
```

### 3.3. Обработка JSON-ответов

**Стратегия восстановления:**
1. Попытка прямого `json.loads()`
2. Извлечение JSON из markdown блоков
3. Исправление незакрытых скобок
4. Экранирование проблемных символов
5. Retry с упрощённым промптом (max 3 попытки)

```python
import json
import re

def parse_llm_response(response: str) -> dict:
    """Парсинг ответа LLM с автоматическим исправлением."""

    # 1. Попытка прямого парсинга
    try:
        return json.loads(response)
    except json.JSONDecodeError:
        pass

    # 2. Извлечение из markdown блока
    json_match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', response)
    if json_match:
        try:
            return json.loads(json_match.group(1))
        except json.JSONDecodeError:
            pass

    # 3. Поиск JSON-подобной структуры
    json_match = re.search(r'\{[\s\S]*\}', response)
    if json_match:
        try:
            return json.loads(json_match.group())
        except json.JSONDecodeError:
            pass

    # 4. Возврат пустого результата
    return {"descriptions": []}
```

### 3.4. Оптимизация затрат

| Метод | Экономия | Реализация |
|-------|----------|------------|
| **Prompt caching** | до 90% | Кэшировать системный промпт |
| **Batch API** | до 40% | Группировать запросы (50 чанков/batch) |
| **Фильтрация чанков** | до 30% | Пропускать диалоги, короткие абзацы |
| **gemini-2.0-flash** | базовая | $0.075/1M input, $0.30/1M output |

**Оценка затрат на книгу:**
- Средняя книга: 50 глав × 10KB = 500KB текста
- Токены: ~125,000 input + ~25,000 output
- Стоимость: ~$0.02 за книгу (с кэшированием ~$0.005)

---

## 4. План реализации

### Фаза 1: Создание нового LLM-парсера (2-3 часа)

**Задачи:**
1. ✅ Создать `gemini_extractor.py` с прямыми API вызовами
2. ✅ Реализовать `TextChunker` с рекурсивным разбиением
3. ✅ Добавить `ResponseParser` с retry логикой
4. ✅ Написать unit-тесты

**Файлы:**
- `backend/app/services/gemini_extractor.py` (NEW, ~400 строк)
- `backend/app/services/text_chunker.py` (NEW, ~150 строк)
- `backend/tests/services/test_gemini_extractor.py` (NEW)

### Фаза 2: Интеграция с существующим кодом (1-2 часа)

**Задачи:**
1. Обновить `langextract_processor.py` для использования нового экстрактора
2. Обновить `tasks.py` для корректной маршрутизации
3. Обновить `multi_nlp_manager.py` для lite режима

**Файлы:**
- `backend/app/services/langextract_processor.py` (MODIFY)
- `backend/app/core/tasks.py` (MODIFY)

### Фаза 3: Удаление NLP зависимостей (1 час)

**Задачи:**
1. Удалить NLP файлы из кодовой базы
2. Обновить `requirements.txt` / `requirements-lite.txt`
3. Обновить `Dockerfile.lite`
4. Проверить импорты

**Файлы к удалению:**
```bash
# Legacy код
rm backend/app/services/nlp_processor.py
rm backend/app/services/enhanced_nlp_system.py
rm backend/app/services/deeppavlov_processor.py

# Активные NLP процессоры
rm backend/app/services/gliner_processor.py
rm backend/app/services/stanza_processor.py
rm backend/app/services/natasha_processor.py

# Multi-NLP система (оставить только lite-совместимые части)
rm -rf backend/app/services/nlp/strategies/
rm -rf backend/app/services/nlp/utils/
rm backend/app/services/nlp/components/processor_registry.py
rm backend/app/services/nlp/components/ensemble_voter.py
```

**Зависимости к удалению из requirements.txt:**
```
spacy>=3.7.0
natasha>=1.6.0
stanza>=1.8.0
gliner>=0.2.0
pymorphy2>=0.9.0
```

### Фаза 4: Тестирование и деплой (1-2 часа)

**Задачи:**
1. Локальное тестирование на тестовой главе
2. Деплой на staging (77.246.106.109)
3. Парсинг тестовой книги
4. Проверка качества (5-15 описаний/глава)

---

## 5. Критерии успеха

| Метрика | Текущее | Целевое |
|---------|---------|---------|
| Описаний на главу | 0 | 5-15 |
| Длина описания | N/A | 100+ символов |
| Время парсинга главы | ~30 сек | ~30-45 сек |
| Размер Docker образа | 2.5GB | ~500MB |
| RAM потребление | 2.4GB | ~500MB |
| Стоимость на книгу | ~$0.02 | ~$0.02 |

---

## 6. Риски и митигация

| Риск | Вероятность | Митигация |
|------|-------------|-----------|
| Gemini возвращает невалидный JSON | Средняя | Retry с упрощённым промптом, JSON repair |
| Rate limiting API | Низкая | Exponential backoff, очередь запросов |
| Низкое качество извлечения | Средняя | Few-shot примеры, fine-tuning промпта |
| Высокие затраты на API | Низкая | Prompt caching, batch processing |

---

## 7. Альтернативы (отклонены)

### 7.1. Сохранение NLP + LangExtract гибрида
- **Минус:** Сложность, 2.2GB моделей, низкая эффективность
- **Решение:** Отклонено

### 7.2. Использование другой LLM библиотеки (LangChain, LlamaIndex)
- **Минус:** Избыточная абстракция для простой задачи
- **Решение:** Отклонено, используем прямые API вызовы

### 7.3. Локальные LLM модели (Llama, Mistral)
- **Минус:** Требуют GPU, сложнее деплой
- **Решение:** Отклонено для lite версии, возможно для enterprise

---

## 8. Следующие шаги

1. [ ] Создать `gemini_extractor.py` с базовой функциональностью
2. [ ] Реализовать рекурсивный чанкинг текста
3. [ ] Добавить few-shot промпты для русской литературы
4. [ ] Интегрировать с `langextract_processor.py`
5. [ ] Удалить NLP зависимости
6. [ ] Тестирование на staging сервере
7. [ ] Обновить CLAUDE.md и README

---

**Документ подготовлен:** Claude Code
**Дата:** 2025-12-13 15:30 UTC

