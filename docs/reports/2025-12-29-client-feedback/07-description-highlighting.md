# Анализ выделений описаний

**Дата:** 29 декабря 2025

---

## 1. Описание проблемы

**Симптом:** Выделенный текст в EPUB отличается от `description.content`.

---

## 2. Механизм highlighting

**Файл:** `frontend/src/hooks/epub/useDescriptionHighlighting.ts`

### 9 стратегий поиска:
1. S1: Первые 40 символов (быстрый)
2. S2: Пропуск 10, взять 10-50 (обход заголовков)
3. S5: Первые 5 слов (fuzzy)
4. S4: Полное совпадение (только короткие)
5. S3: Пропуск 20, взять 20-60
6. S7: Средняя секция
7. S9: Первое предложение (без учёта регистра)
8. S8: LCS fuzzy (отключен)

### Нормализация текста:
```typescript
const normalizeText = (text: string): string => {
  return text
    .replace(/\u00A0/g, ' ')           // Non-breaking spaces
    .replace(/\s+/g, ' ')              // Multiple whitespace
    .replace(/[«»""]/g, '"')           // Quotes
    .replace(/\u2013|\u2014/g, '-')    // Dashes
    .trim();
};
```

---

## 3. Причины расхождений

### P1: LLM изменяет текст
```
EPUB: «Старый замок возвышался на холме, — сказал он, — окруженный лесом.»
LLM:  Старый замок возвышался на холме, окруженный лесом.
```
LLM удаляет кавычки, диалоги, форматирование.

### P2: Обрезка до 1000 символов
**Файл:** `gemini_extractor.py:619-621`
```python
if len(content) > self.config.max_description_chars:
    content = content[:self.config.max_description_chars]
```

### P3: Выделение фиксированной длины
```typescript
// Ищем по первым 40 символам
// Но выделяем patterns.original.length символов
const highlighted = originalText.substring(actualIndex, actualIndex + highlightLength);
```

### P4: Различия в нормализации
Backend НЕ нормализует текст. Frontend нормализует при поиске.

---

## 4. Пример расхождения

**EPUB DOM:**
```
«Старый замок возвышался на\u00A0высоком холме, — сказал проводник, —
окруженный густым лесом.»
```

**description.content:**
```
Старый замок возвышался на высоком холме, окруженный густым лесом.
```

**Результат:** Выделяется `«Старый замок возвышался на` (начало), но конец не совпадает.

---

## 5. Решение

### Исправление 1: Выделять до конца предложения

```typescript
const extendToSentenceEnd = (
  text: string,
  startIndex: number,
  minLength: number
): number => {
  const searchText = text.substring(startIndex);
  const sentenceEnders = /[.!?][»")\]]*\s/g;

  let match;
  while ((match = sentenceEnders.exec(searchText)) !== null) {
    const endPos = startIndex + match.index + match[0].trimEnd().length;
    if (endPos >= startIndex + minLength) {
      return endPos;
    }
  }

  return startIndex + minLength;
};

// Использование
const sentenceEndIndex = extendToSentenceEnd(
  originalText,
  actualIndex,
  searchString.length * 2
);
const highlighted = originalText.substring(actualIndex, sentenceEndIndex);
```

### Исправление 2: Нормализация на backend

```python
def normalize_for_highlighting(text: str) -> str:
    import re
    text = text.replace('\u00A0', ' ')
    text = re.sub(r'\s+', ' ', text)
    text = text.replace('«', '"').replace('»', '"')
    return text.strip()
```

### Исправление 3: Хранить original_excerpt

Добавить поле в модель Description для точного matching.

---

## 6. Оценка времени

| Задача | Время |
|--------|-------|
| Frontend: Алгоритм выделения | 3 часа |
| Backend: Нормализация | 1 час |
| Тестирование | 2 часа |
| **Итого** | **~6 часов** |
