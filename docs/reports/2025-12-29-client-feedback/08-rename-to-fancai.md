# План переименования BookReader AI -> fancai

**Дата:** 29 декабря 2025

---

## 1. Критичные файлы для изменения

### Frontend

| Файл | Текущее значение | Новое значение |
|------|------------------|----------------|
| `frontend/index.html` | `<title>BookReader AI</title>` | `<title>fancai</title>` |
| `frontend/public/manifest.json` | `"name": "BookReader AI"` | `"name": "fancai"` |
| `frontend/src/config/env.ts` | `APP_NAME: 'BookReader AI'` | `APP_NAME: 'fancai'` |
| `frontend/package.json` | `"name": "bookreader-ai-frontend"` | `"name": "fancai-frontend"` |

### Backend

| Файл | Текущее значение | Новое значение |
|------|------------------|----------------|
| `backend/app/core/config.py` | `APP_NAME: str = "BookReader AI"` | `APP_NAME: str = "fancai"` |
| `backend/app/main.py` | `title="BookReader AI API"` | `title="fancai API"` |

### Документация

| Файл | Действие |
|------|----------|
| `CLAUDE.md` | Обновить описание проекта |
| `README.md` | Обновить название |
| `README-ru.md` | Обновить название |

---

## 2. UI компоненты с брендингом

```bash
# Поиск упоминаний в компонентах
grep -r "BookReader" frontend/src/components/ --include="*.tsx"
```

### Найденные файлы:
- `frontend/src/components/Layout/Header.tsx` - логотип/название
- `frontend/src/components/Layout/Sidebar.tsx` - название в сайдбаре
- `frontend/src/components/Images/ImageGallery.tsx` - share title
- `frontend/src/components/Images/ImageModal.tsx` - share title

---

## 3. Локализация

**Файл:** `frontend/src/locales/ru.ts`

Найти и заменить все упоминания "BookReader AI" на "fancai".

---

## 4. Meta-теги и SEO

**Файл:** `frontend/index.html`

```html
<!-- Текущее -->
<title>BookReader AI</title>
<meta name="description" content="BookReader AI - читалка книг с AI">

<!-- Новое -->
<title>fancai</title>
<meta name="description" content="fancai - читалка книг с AI-генерацией изображений">
```

---

## 5. Service Worker и PWA

**Файл:** `frontend/public/manifest.json`

```json
{
  "name": "fancai",
  "short_name": "fancai",
  "description": "Читалка книг с AI-генерацией изображений"
}
```

---

## 6. План выполнения

### Этап 1: Конфигурация (15 мин)
- [ ] `frontend/src/config/env.ts`
- [ ] `backend/app/core/config.py`

### Этап 2: HTML/Manifest (15 мин)
- [ ] `frontend/index.html`
- [ ] `frontend/public/manifest.json`

### Этап 3: UI компоненты (30 мин)
- [ ] Header.tsx
- [ ] Sidebar.tsx
- [ ] ImageGallery.tsx
- [ ] ImageModal.tsx

### Этап 4: Локализация (15 мин)
- [ ] `frontend/src/locales/ru.ts`

### Этап 5: Документация (30 мин)
- [ ] CLAUDE.md
- [ ] README.md
- [ ] README-ru.md

### Этап 6: Тестирование (15 мин)
- [ ] Проверить отображение названия
- [ ] Проверить PWA manifest
- [ ] Проверить share функционал

---

## 7. Команды для массовой замены

```bash
# Найти все упоминания
grep -rn "BookReader AI" --include="*.tsx" --include="*.ts" --include="*.py" --include="*.json" --include="*.html" --include="*.md"

# Заменить (с осторожностью!)
# Рекомендуется ручная проверка каждого файла
```

---

## 8. Оценка времени

**Общее время:** ~2 часа (включая тестирование)
