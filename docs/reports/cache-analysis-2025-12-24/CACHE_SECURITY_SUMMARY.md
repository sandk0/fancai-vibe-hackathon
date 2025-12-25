# Сводная таблица безопасности кэшей

## 🔴 КРИТИЧЕСКИЕ УЯЗВИМОСТИ

| № | Файл | Проблема | Ключ (Current) | Ключ (Fixed) | Риск |
|---|------|----------|----------------|--------------|------|
| 1 | `chapterCache.ts` | Нет userId | `${bookId}_${chapter}` | `${userId}_${bookId}_${chapter}` | 🔴 КРИТИЧНО |
| 2 | `imageCache.ts` | Нет userId | `${bookId}_${descId}` | `${userId}_${bookId}_${descId}` | 🔴 КРИТИЧНО |
| 3 | `useLocationGeneration.ts` | Нет userId, не очищается | `bookId` | `['userId', 'bookId']` | 🔴 КРИТИЧНО |
| 4 | `cacheManager.ts` | Не очищает epub_locations | N/A | Добавить очистку | 🔴 КРИТИЧНО |
| 5 | `cacheManager.ts` | Не очищает pending_sessions | N/A | Добавить очистку | 🔴 КРИТИЧНО |

## 📊 ВСЕ ХРАНИЛИЩА

### IndexedDB (3 базы)

| База | Store | Размер | userId? | TTL | Очистка | Статус |
|------|-------|--------|---------|-----|---------|--------|
| BookReaderChapterCache | chapters | ~5-10 MB | ❌ | 7 дней | ✅ Partial | 🔴 ИСПРАВИТЬ |
| BookReaderImageCache | images | ~50-100 MB | ❌ | 7 дней | ✅ Partial | 🔴 ИСПРАВИТЬ |
| BookReaderAI | epub_locations | ~1-2 MB | ❌ | Вечно | ❌ NEVER | 🔴 ИСПРАВИТЬ |

### localStorage (9+ ключей)

| Ключ | Тип данных | userId? | Очистка | Критичность |
|------|------------|---------|---------|-------------|
| bookreader_access_token | JWT | ✅ Implicit | ✅ Logout | 🔴 Auth |
| bookreader_refresh_token | JWT | ✅ Implicit | ✅ Logout | 🔴 Auth |
| bookreader_user_data | User info | ✅ Implicit | ✅ Logout | 🟡 PII |
| reader-storage | Reading state | ❌ | ✅ Reset | 🔴 **LEAK** |
| auth-store | Zustand persist | ✅ Implicit | ⚠️ Partial | 🟡 Race |
| bookreader_pending_sessions | Offline queue | ❌ | ❌ NEVER | 🔴 **LEAK** |
| bookreader_theme | UI setting | ❌ | ❌ Never | 🟢 Safe |
| bookreader_reader_settings_toc_open | TOC state | ❌ | ❌ Never | 🟢 Safe |
| epub-theme-{bookId} | EPUB theme | ❌ | ❌ Never | 🟢 Safe |
| epub-font-size-{bookId} | Font size | ❌ | ❌ Never | 🟢 Safe |

## 🎯 ПРИОРИТЕТЫ ИСПРАВЛЕНИЯ

### P0 - КРИТИЧНО (Сегодня)

- [ ] Добавить `userId` в `CachedChapter` interface
- [ ] Добавить `userId` в `CachedImage` interface
- [ ] Обновить ключи: `${userId}_${bookId}_${...}`
- [ ] Increment DB_VERSION для миграции

### P1 - ВЫСОКИЙ (На этой неделе)

- [ ] Добавить `userId` в epub_locations
- [ ] Добавить очистку epub_locations в clearAllCaches
- [ ] Добавить очистку pending_sessions в clearAllCaches
- [ ] Добавить retry логику в logout

### P2 - СРЕДНИЙ (В следующем спринте)

- [ ] Написать тесты изоляции пользователей
- [ ] Добавить мониторинг успешности очистки
- [ ] Документировать security guidelines

## 📋 ЧЕКЛИСТ БЕЗОПАСНОСТИ

### Перед коммитом

- [ ] Все ключи IndexedDB содержат userId
- [ ] clearAllCaches() очищает ВСЕ кэши
- [ ] DB_VERSION incremented
- [ ] Тесты написаны и проходят

### Перед деплоем

- [ ] Тестирование: User A logout → User B не видит данных
- [ ] Тестирование: Race conditions
- [ ] Тестирование: IndexedDB quota exceeded
- [ ] Code review пройден

### После деплоя

- [ ] Мониторинг ошибок IndexedDB
- [ ] Проверка метрик успешности logout
- [ ] Проверка GDPR compliance
- [ ] Обновление документации

## 🔢 МЕТРИКИ

### До исправления
- Изоляция данных: **0%** ❌
- GDPR compliance: **НЕТ** ❌
- Риск утечки: **100%** на shared devices ❌

### После исправления
- Изоляция данных: **100%** ✅
- GDPR compliance: **ДА** ✅
- Риск утечки: **0%** ✅

## 🚀 БЫСТРЫЕ КОМАНДЫ

```bash
# Поиск всех IndexedDB usage
grep -r "indexedDB.open" frontend/src/

# Поиск всех localStorage keys
grep -r "localStorage.setItem\|localStorage.getItem" frontend/src/

# Поиск userId в кэшах
grep -r "userId" frontend/src/services/

# Запуск тестов безопасности
npm run test -- --grep "isolation"
```

## 📞 КОНТАКТЫ

- **Ответственный:** Frontend Developer
- **Reviewers:** Backend Team, Security Team
- **Дедлайн:** ASAP (до продакшен деплоя)

---

**Последнее обновление:** 2025-12-24
**Статус:** 🔴 ТРЕБУЕТ ИСПРАВЛЕНИЯ
