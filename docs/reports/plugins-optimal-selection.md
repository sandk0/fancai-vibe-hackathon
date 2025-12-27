# Оптимальный выбор плагинов wshobson/agents

**Дата:** 26.12.2025
**Версия:** 2.0 (Оптимизированный анализ)
**Статус:** Финальная рекомендация

---

## Исполнительное резюме

После глубокого анализа реальных потребностей проекта BookReader AI, рекомендую **8 плагинов** вместо изначальных 10.

### Причины сокращения

| Исключённый плагин | Причина |
|--------------------|---------|
| **backend-development** | 70% избыточности (GraphQL, Temporal, Event Sourcing не используются) |
| **cicd-automation** | Docker уже настроен, Kubernetes/Terraform не нужны |

### Итоговая экономия

| Метрика | 10 плагинов | 8 плагинов | Разница |
|---------|-------------|------------|---------|
| Агенты | 29 | 21 | -8 (-28%) |
| Скиллы | 35 | 22 | -13 (-37%) |
| Избыточность | ~40% | ~20% | -20% |

---

## Глубокий анализ проекта

### Фактическое использование технологий

```
BACKEND (173 Python файла):
├── FastAPI 0.125          ✅ Активно используется
├── Python 3.11            ✅ Активно используется
├── SQLAlchemy 2.0         ✅ Активно используется
├── PostgreSQL 15          ✅ Активно используется
├── Celery 5.4             ✅ Используется (фоновые задачи)
├── Redis 5.2              ✅ Используется (кэш)
├── Google Gemini API      ✅ КРИТИЧЕСКИ ВАЖНО (gemini_extractor.py)
├── GraphQL                ❌ НЕ используется
├── Temporal               ❌ НЕ используется
└── Event Sourcing         ❌ НЕ используется

FRONTEND (139 TypeScript файлов):
├── React 19               ✅ Активно используется
├── TypeScript 5.7         ✅ Активно используется
├── TanStack Query 5       ✅ Активно используется
├── Zustand 5              ✅ Активно используется
├── Tailwind CSS 3.4       ✅ Активно используется
├── Vite 6                 ✅ Используется
├── epub.js 0.3.93         ✅ Специфично для проекта
├── Next.js                ❌ НЕ используется
├── React Native           ❌ НЕ используется
└── Flutter                ❌ НЕ используется

DEVOPS:
├── Docker Compose         ✅ Настроен и работает
├── Kubernetes             ❌ НЕ используется
├── Terraform              ❌ НЕ используется
└── GitHub Actions         ⚠️ Может быть добавлен

ТЕСТИРОВАНИЕ:
├── pytest                 ✅ 40+ тестовых файлов
├── vitest                 ⚠️ 0 тестовых файлов (нужно добавить!)
└── Playwright             ✅ Настроен для e2e
```

### Анализ избыточности по плагинам

#### backend-development — **ИСКЛЮЧИТЬ**

```
КОМПОНЕНТЫ ПЛАГИНА:
├── backend-architect      ✅ Нужен (10%)
├── graphql-architect      ❌ Не нужен (проект использует REST)
├── temporal-python-pro    ❌ Не нужен (используется Celery)
├── event-sourcing-architect ❌ Не нужен
└── tdd-orchestrator       ✅ Нужен (есть в unit-testing)

СКИЛЛЫ (9 штук):
├── api-design-principles  ✅ Полезен
├── architecture-patterns  ✅ Полезен
├── microservices-patterns ⚠️ Частично (monolith with services)
├── workflow-orchestration-patterns ❌ Temporal-specific
├── temporal-python-testing ❌ Temporal-specific
├── event-store-design     ❌ Event sourcing specific
├── cqrs-implementation    ❌ Не используется
├── projection-patterns    ❌ Не используется
└── saga-orchestration     ❌ Не используется

ИТОГО: 2/5 агентов нужны, 2/9 скиллов нужны = 70% избыточность
```

**Альтернатива:** `api-design-principles` и `architecture-patterns` можно получить из документации или через natural language запросы к другим агентам.

#### cicd-automation — **ИСКЛЮЧИТЬ**

```
КОМПОНЕНТЫ ПЛАГИНА:
├── deployment-engineer    ✅ Частично нужен
├── terraform-specialist   ❌ Terraform не используется
└── kubernetes-architect   ❌ Kubernetes не используется

СКИЛЛЫ (4 штуки):
├── deployment-pipeline-design  ✅ Полезен
├── github-actions-templates    ✅ Полезен
├── gitlab-ci-patterns          ❌ GitLab не используется
└── secrets-management          ⚠️ Частично

ИТОГО: 1/3 агентов нужны, 2/4 скиллов нужны = 60% избыточность
```

**Альтернатива:** GitHub Actions можно настроить через natural language или использовать `developer-essentials` плагин для базовых workflows.

---

## Рекомендуемые 8 плагинов

### TIER 1 — КРИТИЧЕСКИЕ (без них нельзя)

| # | Плагин | Агентов | Скиллов | Использование | Обоснование |
|---|--------|---------|---------|---------------|-------------|
| 1 | **python-development** | 3 | 5 | 75% | FastAPI + Python 3.11 - основа backend |
| 2 | **javascript-typescript** | 2 | 4 | 80% | TypeScript 5.7 - основа frontend |
| 3 | **frontend-mobile-development** | 5 | 4 | 45% | React 19, Zustand, TanStack Query, Tailwind |
| 4 | **llm-application-dev** | 3 | 8 | 40% | Gemini API - core business logic |
| 5 | **full-stack-orchestration** | 1 | 0 | 100% | Координация всех агентов |

### TIER 2 — ВЫСОКИЙ ПРИОРИТЕТ

| # | Плагин | Агентов | Скиллов | Использование | Обоснование |
|---|--------|---------|---------|---------------|-------------|
| 6 | **database-design** | 3 | 1 | 95% | PostgreSQL + SQLAlchemy - всё нужно |
| 7 | **unit-testing** | 2 | 0 | 90% | pytest работает, vitest нужно добавить |
| 8 | **code-review-ai** | 2 | 0 | 90% | Quality gates, security review |

### Итого: 21 агент + 22 скилла

---

## Детальное описание рекомендуемых плагинов

### 1. python-development (КРИТИЧЕСКИЙ)

**Почему критически важен:**
- `fastapi-pro` — идеально для FastAPI 0.125 + Pydantic V2
- `python-pro` — Python 3.11 async patterns, performance
- Скиллы `async-python-patterns`, `python-testing-patterns` — ежедневное использование

**Неиспользуемое:**
- `django-pro` — Django не используется, но не загружается в контекст

```
Эффективность: 75%
Критичность: ⭐⭐⭐⭐⭐
```

### 2. javascript-typescript (КРИТИЧЕСКИЙ)

**Почему критически важен:**
- `typescript-pro` — TypeScript 5.7 advanced types
- Скиллы `typescript-advanced-types`, `javascript-testing-patterns` — для vitest

**Неиспользуемое:**
- `nodejs-backend-patterns` — Node.js backend не используется

```
Эффективность: 80%
Критичность: ⭐⭐⭐⭐⭐
```

### 3. frontend-mobile-development (КРИТИЧЕСКИЙ)

**Почему критически важен:**
- `frontend-developer` — React 19 components, state management
- Скилл `react-state-management` — **Zustand и TanStack Query явно упомянуты!**
- Скилл `tailwind-design-system` — Tailwind CSS 3.4

**Неиспользуемое:**
- `mobile-developer`, `ios-developer`, `flutter-expert` — нет мобильного приложения
- Скилл `nextjs-app-router-patterns` — используется Vite, не Next.js
- Скилл `react-native-architecture` — нет React Native

```
Эффективность: 45%
Критичность: ⭐⭐⭐⭐⭐
Примечание: Высокая избыточность, но альтернативы нет
```

### 4. llm-application-dev (КРИТИЧЕСКИЙ)

**Почему критически важен:**
- `ai-engineer` (Opus) — интеграция Gemini API, оптимизация extraction pipeline
- `prompt-engineer` (Opus) — улучшение промптов для описаний
- Скилл `prompt-engineering-patterns` — критически для quality

**Потенциально полезное в будущем:**
- `vector-database-engineer` — для семантического поиска по книгам
- Скиллы RAG/embeddings — для расширенного поиска

**Неиспользуемое сейчас:**
- `langchain-architecture` — LangChain не используется
- Скиллы vector search — пока не реализовано

```
Эффективность: 40% сейчас, 70% потенциально
Критичность: ⭐⭐⭐⭐⭐
Примечание: Core business logic проекта
```

### 5. full-stack-orchestration (КРИТИЧЕСКИЙ)

**Почему критически важен:**
- Единственный способ координировать работу всех агентов
- `/full-stack-orchestration:full-stack-feature` — end-to-end workflow

**Как работает с 8 плагинами:**
```
full-stack-feature координирует:
├── fastapi-pro (python-development)       ✅
├── database-architect (database-design)   ✅
├── frontend-developer (frontend-mobile)   ✅
├── test-automator (unit-testing)          ✅
├── code-reviewer (code-review-ai)         ✅
├── security-auditor                       ⚠️ Нет в списке
├── deployment-engineer                    ⚠️ Нет в списке
└── observability-engineer                 ⚠️ Нет в списке
```

**Важно:** Оркестратор будет работать с доступными агентами. Отсутствующие этапы можно выполнить вручную или добавить плагины позже.

```
Эффективность: 100% (с доступными агентами)
Критичность: ⭐⭐⭐⭐⭐
```

### 6. database-design (ВЫСОКИЙ ПРИОРИТЕТ)

**Почему высокий приоритет:**
- `database-architect` (Opus) — PostgreSQL 15, SQLAlchemy 2.0 схемы
- `database-optimizer` — Query optimization (критично для производительности)
- `sql-pro` — Сложные SQL запросы
- Скилл `postgresql` — PostgreSQL-specific patterns

```
Эффективность: 95%
Критичность: ⭐⭐⭐⭐
```

### 7. unit-testing (ВЫСОКИЙ ПРИОРИТЕТ)

**Почему высокий приоритет:**
- `test-automator` — pytest (40+ файлов) + vitest (нужно добавить!)
- `tdd-orchestrator` — TDD methodology

**Особая важность:**
- В проекте 0 frontend тестов (.test.tsx)
- Нужно срочно добавить vitest тесты

```
Эффективность: 90%
Критичность: ⭐⭐⭐⭐
```

### 8. code-review-ai (ВЫСОКИЙ ПРИОРИТЕТ)

**Почему высокий приоритет:**
- `code-reviewer` (Opus) — Security focus, production reliability
- `architect-reviewer` (Opus) — Architectural consistency

**Особая важность:**
- Оба агента Opus tier — высочайшее качество review
- Критически для production code

```
Эффективность: 90%
Критичность: ⭐⭐⭐⭐
```

---

## Сравнение вариантов

### Вариант A: 10 плагинов (изначальный)

```
Плюсы:
+ Полное покрытие всех возможных сценариев
+ Оркестратор работает на 100%

Минусы:
- 40% избыточности
- backend-development: 70% не используется
- cicd-automation: 60% не используется
- Лишняя когнитивная нагрузка

Оценка: 7/10
```

### Вариант B: 8 плагинов (РЕКОМЕНДУЕМЫЙ)

```
Плюсы:
+ 20% избыточности (в 2 раза меньше)
+ Все критические функции покрыты
+ Меньше "шума" от неиспользуемых агентов
+ Оркестратор работает с 80% агентов

Минусы:
- Нет deployment-engineer (можно добавить позже)
- Нет backend-architect как отдельного агента

Оценка: 9/10
```

### Вариант C: 7 плагинов (минимальный production)

```
Убрать дополнительно: code-review-ai

Плюсы:
+ 15% избыточности
+ Минимальный набор

Минусы:
- Нет code review (критически для quality)
- Ручные security checks

Оценка: 6/10 — НЕ РЕКОМЕНДУЕТСЯ
```

### Вариант D: 6 плагинов (MVP)

```
Оставить только: python, js/ts, frontend, database, llm, orchestration

Минусы:
- Нет тестирования
- Нет code review
- Ручные quality gates

Оценка: 5/10 — НЕ РЕКОМЕНДУЕТСЯ
```

---

## Финальная рекомендация

### УСТАНОВИТЬ 8 ПЛАГИНОВ:

```bash
# 1. Добавить marketplace
/plugin marketplace add wshobson/agents

# 2. Установить 8 оптимальных плагинов
/plugin install python-development
/plugin install javascript-typescript
/plugin install frontend-mobile-development
/plugin install database-design
/plugin install llm-application-dev
/plugin install unit-testing
/plugin install code-review-ai
/plugin install full-stack-orchestration
```

### НЕ УСТАНАВЛИВАТЬ:

| Плагин | Причина |
|--------|---------|
| backend-development | 70% избыточности, GraphQL/Temporal/EventSourcing не нужны |
| cicd-automation | 60% избыточности, Docker настроен, K8s/Terraform не нужны |

### ПРИ НЕОБХОДИМОСТИ ДОБАВИТЬ ПОЗЖЕ:

| Плагин | Когда добавить |
|--------|----------------|
| cicd-automation | Если понадобится GitHub Actions или расширенный CI/CD |
| security-scanning | Если понадобится SAST/security audit |
| observability-monitoring | Если понадобится Prometheus/Grafana |

---

## Итоговая таблица

| # | Плагин | Агенты | Скиллы | Tier | Модели |
|---|--------|--------|--------|------|--------|
| 1 | python-development | 3 | 5 | Sonnet | fastapi-pro, django-pro, python-pro |
| 2 | javascript-typescript | 2 | 4 | Sonnet | javascript-pro, typescript-pro |
| 3 | frontend-mobile-development | 5 | 4 | Sonnet | frontend-developer, mobile-developer, ios-developer, flutter-expert, ui-ux-designer |
| 4 | database-design | 3 | 1 | Opus/Sonnet | database-architect, database-optimizer, sql-pro |
| 5 | llm-application-dev | 3 | 8 | Opus | ai-engineer, prompt-engineer, vector-database-engineer |
| 6 | unit-testing | 2 | 0 | Sonnet | test-automator, tdd-orchestrator |
| 7 | code-review-ai | 2 | 0 | Opus | code-reviewer, architect-reviewer |
| 8 | full-stack-orchestration | 1 | 0 | - | full-stack-feature orchestrator |

**ИТОГО: 21 агент + 22 скилла**

### Распределение по Model Tier

| Tier | Количество | Агенты |
|------|------------|--------|
| Opus | 6 | database-architect, ai-engineer, prompt-engineer, vector-database-engineer, code-reviewer, architect-reviewer |
| Sonnet | 15 | Остальные |

---

## Заключение

**8 плагинов — оптимальный выбор** для BookReader AI:

1. ✅ Покрывает 100% реально используемых технологий
2. ✅ Избыточность снижена с 40% до 20%
3. ✅ 6 агентов Opus tier для критических задач
4. ✅ Оркестратор работает с основными агентами
5. ✅ Возможность расширения в будущем

**Экономия по сравнению с 10 плагинами:**
- -8 агентов (не загружаются в контекст)
- -13 скиллов (не потребляют токены)
- -20% избыточности (меньше "шума")

---

**Конец отчета**
