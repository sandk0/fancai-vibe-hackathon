# Сводный план доработок по замечаниям заказчика

**Дата:** 29 декабря 2025
**Версия:** 1.0

---

## Обзор замечаний

| # | Замечание | Приоритет | Сложность | Оценка времени |
|---|-----------|-----------|-----------|----------------|
| 1 | Сменить название Bookreader AI -> fancai | Высокий | Низкая | 2 часа |
| 2 | Анализ мобильной версии | Высокий | - | См. отчет |
| 3 | Увеличить таймаут авторизации (на месяц) | Средний | Низкая | 30 мин |
| 4 | Добавить удаление книг из библиотеки | Высокий | Средняя | 5 часов |
| 5 | Исправить счетчики книг на главной | Средний | Низкая | 2 часа |
| 6 | Вернуть прогресс в страницах в статус бар | Низкий | Низкая | 1 час |
| 7 | Парсить текущую и следующую главу сразу | Высокий | Средняя | 4 часа |
| 8 | Исправить счётчик прогресса на мобильных | Высокий | Низкая | 2 часа |
| 9 | Исправить выделения описаний | Высокий | Высокая | 6 часов |
| 10 | Глобальный редизайн мобильной версии | Критический | Высокая | 16 часов |

**Общая оценка:** ~38 часов разработки

---

## Детальный план по каждому замечанию

### 1. Переименование Bookreader AI -> fancai

**Файлы для изменения:**
- `frontend/src/config/env.ts` - VITE_APP_NAME
- `frontend/index.html` - title
- `frontend/public/manifest.json` - name, short_name
- `backend/app/core/config.py` - APP_NAME
- Все места с "BookReader AI" в UI компонентах
- README.md, CLAUDE.md

**Действия:**
```bash
# Поиск всех упоминаний
grep -r "BookReader" --include="*.tsx" --include="*.ts" --include="*.py" --include="*.md"
grep -r "Bookreader" --include="*.tsx" --include="*.ts" --include="*.py" --include="*.md"
```

---

### 2. Мобильная версия - См. отдельный отчет

**Критичные проблемы (5):**
- ReaderToolbar: min-w-[240px] слишком широко
- LibraryHeader: text-4xl, px-8 py-12 избыточно
- TocSidebar: нет safe-area для iOS

**Важные проблемы (6):**
- BookCard: фиксированные размеры обложки
- LibraryStats: большие шрифты и отступы
- BookGrid: gap-6 слишком большой

---

### 3. Увеличение таймаута авторизации

**Файл:** `backend/app/core/config.py`

**Текущая конфигурация:**
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 30   # 30 минут
REFRESH_TOKEN_EXPIRE_DAYS: int = 7      # 7 дней
```

**Рекомендуемая конфигурация:**
```python
ACCESS_TOKEN_EXPIRE_MINUTES: int = 60   # 1 час (улучшает UX)
REFRESH_TOKEN_EXPIRE_DAYS: int = 30     # 30 дней (месяц)
```

**Security implications:** Минимальные при сохранении короткого access token.

---

### 4. Удаление книг из библиотеки

**Backend:**
- Добавить `DELETE /api/v1/books/{book_id}` в `crud.py`
- Сервис `book_service.delete_book()` уже реализован
- Добавить очистку файлов изображений

**Frontend:**
- Создать `DeleteConfirmModal.tsx`
- Добавить кнопку удаления в `BookCard.tsx`
- Интегрировать в `LibraryPage.tsx`
- Хук `useDeleteBook()` уже реализован

**UX:**
- Кнопка: иконка Trash2, появляется при hover
- Модальное окно подтверждения с предупреждением
- Toast уведомления

---

### 5. Исправление счетчиков книг

**Проблема:**
- LibraryPage считает статистику из текущей страницы пагинации (10 книг)
- HomePage использует серверную статистику (все книги)

**Решение:**
- Использовать единый источник: `GET /api/v1/users/reading-statistics`
- Унифицировать критерий завершения: >= 95% (как на backend)

**Файлы:**
- `frontend/src/pages/LibraryPage.tsx`
- `frontend/src/hooks/library/useLibraryFilters.ts`

---

### 6. Прогресс в страницах в статус баре

**Текущее состояние:**
- ReaderToolbar показывает: "Страница X / Y" + процент
- На мобильных страницы скрыты классом `hidden xs:inline`
- Класс `xs:` не существует в стандартном Tailwind

**Решение:**
- Добавить breakpoint `xs: '375px'` в tailwind.config.js
- Или изменить на `hidden sm:inline`

**Файлы:**
- `frontend/src/components/Reader/ReaderHeader.tsx:167`
- `frontend/tailwind.config.js`

---

### 7. Парсинг текущей и следующей главы

**Текущее поведение:**
- LLM extraction запускается ON-DEMAND при открытии главы
- Prefetch НЕ запускает extraction (только загружает существующие)

**Решение:**
1. Backend: Добавить `POST /books/{id}/chapters/{n}/extract-background`
2. Frontend: Вызывать background extraction в prefetch для следующей главы

**Результат:**
- Пользователь читает главу N
- В фоне парсится глава N+1
- Переход на N+1 мгновенный

---

### 8. Счётчик прогресса на мобильных

**Проблема:** Значения не меняются при прокрутке.

**Возможные причины:**
- Скрытый элемент (`hidden xs:inline`) не обновляется
- Проблема с useEffect/useState при resize
- Дебаунсинг слишком агрессивный

**Файлы для проверки:**
- `frontend/src/components/Reader/ReaderToolbar.tsx`
- `frontend/src/components/Reader/ProgressIndicator.tsx`
- `frontend/src/hooks/epub/useReadingProgress.ts`

---

### 9. Выделения описаний

**Проблема:** Выделенный текст отличается от description.content

**Причины:**
1. LLM изменяет текст при извлечении
2. Обрезка до 1000 символов на backend
3. Выделение фиксированной длины вместо конца предложения
4. Различия в нормализации (пробелы, кавычки)

**Решение:**
1. Изменить алгоритм - выделять до конца предложения
2. Добавить нормализацию на backend
3. Хранить original_excerpt для точного matching

**Файлы:**
- `frontend/src/hooks/epub/useDescriptionHighlighting.ts`
- `backend/app/services/gemini_extractor.py`

---

### 10. Глобальный редизайн мобильной версии

**Принципы редизайна:**
1. Mobile-first подход
2. Уменьшенные отступы: `p-4 sm:p-6` вместо `p-6`
3. Адаптивные шрифты: `text-xl sm:text-2xl` вместо `text-2xl`
4. Меньшие gaps: `gap-3 sm:gap-6` вместо `gap-6`
5. Safe-area поддержка для iOS

**Компоненты для переработки:**
1. ReaderToolbar - критично
2. LibraryHeader - критично
3. TocSidebar - критично
4. BookCard - важно
5. LibraryStats - важно
6. BookGrid - важно

**Тестирование:**
- 320px (iPhone SE 1st gen)
- 375px (iPhone SE 2nd gen)
- 390px (iPhone 14)
- 428px (iPhone 14 Pro Max)

---

## Приоритеты реализации

### Спринт 1 (Критичные исправления)
1. [x] Переименование -> fancai
2. [ ] Увеличение таймаута авторизации
3. [ ] Исправление счётчика прогресса на мобильных
4. [ ] Критичные проблемы мобильной версии (ReaderToolbar, LibraryHeader)

### Спринт 2 (Важные фичи)
5. [ ] Удаление книг из библиотеки
6. [ ] Парсинг следующей главы в фоне
7. [ ] Исправление счетчиков книг

### Спринт 3 (Улучшения UX)
8. [ ] Исправление выделений описаний
9. [ ] Прогресс в страницах в статус баре
10. [ ] Остальные проблемы мобильной версии

### Спринт 4 (Полировка)
11. [ ] Глобальный редизайн мобильной версии
12. [ ] Тестирование на различных устройствах

---

## Связанные документы

- [02-mobile-analysis.md](./02-mobile-analysis.md) - Детальный анализ мобильной версии
- [03-auth-timeout.md](./03-auth-timeout.md) - Анализ системы авторизации
- [04-book-deletion.md](./04-book-deletion.md) - План реализации удаления книг
- [05-book-counters.md](./05-book-counters.md) - Анализ счетчиков книг
- [06-chapter-parsing.md](./06-chapter-parsing.md) - Анализ парсинга глав
- [07-description-highlighting.md](./07-description-highlighting.md) - Анализ выделений описаний
