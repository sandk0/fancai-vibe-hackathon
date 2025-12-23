# Frontend Audit - Action Plan

**Дата:** 30 октября 2025
**Статус:** ⚠️ REQUIRES IMMEDIATE ACTION

---

## 🚨 CRITICAL - Исправить сегодня!

### 1. TypeScript Build Errors (БЛОКИРУЕТ PRODUCTION)
```bash
# Текущее состояние
npm run build
# ❌ FAILS with 10 TypeScript errors

# Action items:
1. Удалить .backup.tsx файлы
   rm src/components/Reader/BookReader.backup.tsx
   rm src/components/Reader/EpubReader.backup.tsx

2. Исправить GeneratedImage type в src/types/api.ts
   # Добавить недостающие поля:
   - service_used: string
   - status: ImageStatus
   - is_moderated: boolean
   - view_count: number
   - rating: number | null

3. Исправить case-sensitive import в ThemeSwitcher.tsx
   # Изменить: @/components/ui/dropdown-menu
   # На: @/components/UI/dropdown-menu

4. Убрать unused @ts-expect-error directives
   # src/pages/AdminDashboardEnhanced.tsx:653,666
   # src/utils/serviceWorker.ts:5

# Проверка
npm run build
# ✅ Should succeed
```

**Ответственный:** Frontend Lead
**Deadline:** Сегодня (30 октября)
**Time estimate:** 2 часа

---

### 2. Error Boundary (КРИТИЧНО ДЛЯ СТАБИЛЬНОСТИ)
```bash
# Создать Error Boundary компонент
touch src/components/ErrorBoundary.tsx

# Добавить в App.tsx
<ErrorBoundary>
  <Router>...</Router>
</ErrorBoundary>

# Добавить для EpubReader
<ErrorBoundary fallback={<div>Ошибка загрузки книги</div>}>
  <EpubReader book={book} />
</ErrorBoundary>
```

**Ответственный:** Frontend Lead
**Deadline:** Сегодня
**Time estimate:** 1 час

---

### 3. Environment Variables (PRODUCTION DEPLOYMENT)
```bash
# Создать .env файлы
touch .env.production
touch .env.staging
touch .env.development

# .env.production
VITE_API_URL=https://api.bookreader.ai/api/v1

# .env.staging
VITE_API_URL=https://staging-api.bookreader.ai/api/v1

# .env.development
VITE_API_URL=http://localhost:8000/api/v1

# Удалить hardcoded fallbacks
# src/api/client.ts - убрать || 'http://localhost:8000/api/v1'
```

**Ответственный:** DevOps + Frontend Lead
**Deadline:** Перед production deploy
**Time estimate:** 30 минут

---

## 🔴 HIGH PRIORITY - Эта неделя

### 4. TypeScript Type Safety (28 файлов с `any`)
```bash
# Day 1: Создать epubjs.d.ts
touch src/types/epubjs.d.ts

# Добавить типы для epub.js:
interface Locations { total: number; percentageFromCfi(cfi: string): number; ... }
interface Contents { document: Document; }
interface Rendition { ... }

# Day 2-3: Заменить any на конкретные типы
# Приоритетные файлы:
- src/api/client.ts (11 any)
- src/hooks/epub/*.ts (15+ any)
- src/api/books.ts (2 any)
- src/api/admin.ts (2 any)

# Day 4: Включить strict mode
# tsconfig.json
"strict": true,
"noImplicitAny": true

# Day 5: Исправить новые ошибки
```

**Ответственный:** Frontend Team
**Deadline:** 6 ноября
**Time estimate:** 16 часов

---

### 5. Memory Leaks & Cleanup
```bash
# Исправить useEpubLoader cleanup
# src/hooks/epub/useEpubLoader.ts:129-179

# Добавить явное удаление event listeners
const events = ['relocated', 'rendered', 'resized', 'selected'];
events.forEach(event => rendition.off(event));

# Добавить AbortController для fetch requests
# src/hooks/epub/useChapterManagement.ts
const abortController = new AbortController();
return () => abortController.abort();

# Исправить race condition в useCFITracking
# Добавить currentNavigationRef для отмены прерванной навигации
```

**Ответственный:** Senior Frontend Dev
**Deadline:** 8 ноября
**Time estimate:** 8 часов

---

### 6. Production Logger (410 console.log)
```bash
# Создать logger utility
touch src/utils/logger.ts

# Реализовать:
export const logger = {
  debug: (...args) => isDev && console.log('[DEBUG]', ...args),
  info: (...args) => isDev && console.info('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
};

# Массово заменить console.log на logger.debug
# 47 файлов для изменения

# Script для автоматизации:
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/console\.log/logger.debug/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/console\.error/logger.error/g'
find src -name "*.ts" -o -name "*.tsx" | xargs sed -i '' 's/console\.warn/logger.warn/g'

# Добавить import в каждый файл
import { logger } from '@/utils/logger';
```

**Ответственный:** Junior Frontend Dev
**Deadline:** 10 ноября
**Time estimate:** 4 часа

---

## 🟡 MEDIUM PRIORITY - 2 недели

### 7. Bundle Size Optimization
```bash
# Week 1: React.lazy + Suspense
# src/App.tsx
const AdminDashboard = lazy(() => import('@/pages/AdminDashboardEnhanced'));
const LibraryPage = lazy(() => import('@/pages/LibraryPage'));
const StatsPage = lazy(() => import('@/pages/StatsPage'));

<Suspense fallback={<LoadingSpinner />}>
  <Routes>...</Routes>
</Suspense>

# Week 2: Bundle analyzer
npm install -D vite-bundle-visualizer
npm run analyze

# Target: <200KB initial bundle (gzipped)
# Current: 800KB → Need 75% reduction
```

**Ответственный:** Frontend Team
**Deadline:** 20 ноября
**Time estimate:** 12 часов

---

### 8. Component Refactoring
```bash
# EpubReader: 17 hooks → композитный hook
# src/hooks/epub/useEpubReader.ts
export const useEpubReader = (book, viewerRef) => {
  const loader = useEpubLoader(...);
  const locations = useLocationGeneration(...);
  const tracking = useCFITracking(...);
  // ... group related hooks
  return { loader, locations, tracking, ... };
};

# AdminDashboardEnhanced: 831 строк → подкомпоненты
src/pages/AdminDashboard/
  ├── index.tsx (200 строк)
  ├── SystemStatsCard.tsx
  ├── NLPSettingsPanel.tsx
  └── ...

# LibraryPage: 502 строки → подкомпоненты
# StatsPage: 551 строка → подкомпоненты
```

**Ответственный:** Frontend Team
**Deadline:** 24 ноября
**Time estimate:** 20 часов

---

### 9. IndexedDB Error Handling
```bash
# src/hooks/epub/useLocationGeneration.ts
# Добавить localStorage fallback для Safari private mode

const getFromLocalStorage = (bookId: string) => {
  try {
    const data = localStorage.getItem(`epub_locations_${bookId}`);
    return data ? JSON.parse(data) : null;
  } catch { return null; }
};

const getCachedLocations = async (bookId) => {
  try {
    // IndexedDB first
    const db = await openDB();
    // ...
  } catch {
    // Fallback to localStorage
    return getFromLocalStorage(bookId);
  }
};
```

**Ответственный:** Mid-level Frontend Dev
**Deadline:** 15 ноября
**Time estimate:** 4 часа

---

## 🔵 LOW PRIORITY - Continuous

### 10. Testing & Documentation
```bash
# Увеличить test coverage: 45% → 80%
# Добавить E2E tests (Playwright)
# Обновить README.md
# Создать CONTRIBUTING.md
# Настроить Storybook
```

**Ответственный:** QA + Frontend Team
**Deadline:** Ongoing
**Time estimate:** 40 часов (1 месяц)

---

### 11. Accessibility (WCAG 2.1)
```bash
# Добавить ARIA labels везде
# Keyboard navigation для всех элементов
# Screen reader testing
# Color contrast compliance
# Focus management
```

**Ответственный:** Frontend Team + UX
**Deadline:** Ongoing
**Time estimate:** 16 часов

---

### 12. Code Quality & Automation
```bash
# Setup Husky + lint-staged
npm install -D husky lint-staged

# Setup pre-commit hooks
npx husky install
npx husky add .husky/pre-commit "npm run pre-commit"

# .husky/pre-commit
npx lint-staged
npm run type-check

# Setup GitHub Actions CI
.github/workflows/ci.yml:
  - Lint
  - Type check
  - Tests
  - Build
  - Bundle size check

# Setup Prettier
npm install -D prettier
# .prettierrc
```

**Ответственный:** DevOps + Tech Lead
**Deadline:** 13 ноября
**Time estimate:** 8 часов

---

## 📊 Метрики успеха

### Week 1 (До 6 ноября)
- [x] TypeScript build успешен ✅
- [x] Error Boundary добавлен ✅
- [x] Environment variables настроены ✅
- [ ] `any` типов: 28 → 0

### Week 2 (До 13 ноября)
- [ ] Memory leaks исправлены ✅
- [ ] console.log: 410 → 0 ✅
- [ ] Logger utility работает ✅
- [ ] Pre-commit hooks настроены ✅

### Week 3 (До 20 ноября)
- [ ] Bundle size: 800KB → <200KB ✅
- [ ] React.lazy везде ✅
- [ ] Components refactored (<300 lines) ✅

### Week 4 (До 27 ноября)
- [ ] Test coverage: 45% → 80% ✅
- [ ] Lighthouse score: 65 → 90+ ✅
- [ ] Accessibility audit passed ✅

---

## 🚀 Quick Wins (Сделать первыми)

### 1. TypeScript errors (2 часа)
```bash
rm src/components/Reader/*.backup.tsx
# Исправить GeneratedImage type
# Исправить imports
npm run build # ✅
```

### 2. Error Boundary (1 час)
```bash
# Создать компонент
# Обернуть App + EpubReader
# Test manually
```

### 3. Remove console.log (3 часа)
```bash
# Создать logger.ts
# Массово заменить (script)
# Verify в production build
```

### 4. .env files (30 минут)
```bash
# Создать 3 файла
# Удалить fallbacks
# Test в каждом окружении
```

**Total time:** 6.5 часов для критических исправлений

---

## 📞 Контакты & Ownership

| Задача | Ответственный | Статус | ETA |
|--------|---------------|--------|-----|
| TypeScript errors | @frontend-lead | 🔴 TODO | 30 Oct |
| Error Boundary | @frontend-lead | 🔴 TODO | 30 Oct |
| Memory leaks | @senior-frontend | 🔴 TODO | 8 Nov |
| Type safety | @frontend-team | 🟡 IN PROGRESS | 6 Nov |
| Logger utility | @junior-frontend | 🔴 TODO | 10 Nov |
| Bundle optimization | @frontend-team | 🟡 TODO | 20 Nov |
| Component refactor | @frontend-team | 🟡 TODO | 24 Nov |
| Testing | @qa-team | 🔵 TODO | Ongoing |
| Accessibility | @ux-team | 🔵 TODO | Ongoing |
| CI/CD setup | @devops | 🟡 TODO | 13 Nov |

---

## 📈 Progress Tracking

**Daily Standup Questions:**
1. Какие критические issues исправлены вчера?
2. Какие критические issues планируются сегодня?
3. Какие блокеры?

**Weekly Review Questions:**
1. Все ли критические issues закрыты?
2. Метрики улучшились?
3. Готовы ли к production deploy?

**Milestone Review (каждые 2 недели):**
1. Sprint goals достигнуты?
2. Technical debt уменьшился?
3. Code quality улучшился?

---

## 🎯 Definition of Done

### TypeScript Issues ✅
- [ ] `npm run build` успешен без ошибок
- [ ] `npm run type-check` 0 ошибок
- [ ] 0 файлов с `any` типами
- [ ] strict mode enabled

### Performance ✅
- [ ] Initial bundle <200KB (gzipped)
- [ ] Lighthouse score 90+
- [ ] No memory leaks
- [ ] React DevTools Profiler: <16ms renders

### Code Quality ✅
- [ ] Test coverage >80%
- [ ] ESLint warnings = 0
- [ ] 0 console.log в production
- [ ] All components <300 lines

### Production Ready ✅
- [ ] Error Boundary работает
- [ ] Environment variables настроены
- [ ] CI/CD pipeline зелёный
- [ ] Security audit passed
- [ ] Accessibility audit passed

---

**Next Review:** 6 ноября 2025 (Week 1 checkpoint)

**Questions?** Contact @frontend-lead or @tech-lead
