# Claude Code Subagents для BookReader AI

**Версия:** 2.0.0
**Дата:** 23.10.2025
**Статус:** Production Ready

---

## 🎯 Что это?

Это директория с **subagents** (специализированными AI агентами) для проекта BookReader AI. Каждый агент - это эксперт в конкретной области разработки.

**Главный агент:** **Orchestrator Agent** - ваш персональный координатор, который переводит ваши пожелания в задачи для специализированных агентов.

---

## 📋 Доступные агенты (10 total)

### **Tier 1: Core (Must-Have)** ✅

### 🎭 Orchestrator Agent (`orchestrator.md`)

**Роль:** Главный координатор - связующее звено между вами и агентами

**Когда использовать:**
- Любой запрос по разработке BookReader AI
- Сложные задачи, требующие нескольких агентов
- Когда не знаете какой агент нужен

**Пример:**
```
Хочу добавить систему рекомендаций книг на основе истории чтения
```

---

### 🧠 Multi-NLP System Expert (`multi-nlp-expert.md`)

**Роль:** Эксперт по Multi-NLP системе (КРИТИЧЕСКИЙ компонент проекта)

**Специализация:**
- SpaCy + Natasha + Stanza процессоры
- Ensemble voting оптимизация
- Performance tuning (benchmark: 2171 descriptions in 4s)

**Когда использовать:**
- Оптимизация парсинга книг
- Улучшение качества извлечения описаний
- Добавление новых NLP процессоров
- Performance проблемы с Multi-NLP

**Пример:**
```
Ускорь парсинг книг в 2 раза без потери качества
```

---

### ⚙️ Backend API Developer (`backend-api-developer.md`)

**Роль:** FastAPI endpoint разработка

**Специализация:**
- RESTful API design
- Pydantic validation
- SQLAlchemy integration
- Async/await patterns

**Когда использовать:**
- Создание новых API endpoints
- Оптимизация существующих endpoints
- Добавление валидации
- Performance issues с API

**Пример:**
```
Создай endpoint для получения статистики чтения пользователя
```

---

### 📝 Documentation Master (`documentation-master.md`)

**Роль:** Автоматизация документации (ОБЯЗАТЕЛЬНЫЙ по CLAUDE.md)

**Специализация:**
- Обновление README, CHANGELOG, docs
- Генерация docstrings
- API documentation
- Technical writing

**Когда использовать:**
- АВТОМАТИЧЕСКИ после каждого изменения кода
- Добавление/обновление docstrings
- Создание user guides
- Генерация API docs

**Пример:**
```
Обнови документацию после добавления функции экспорта аннотаций
```

---

### **Tier 2: Specialists (Recommended)** 🔥

### 🎨 Frontend Developer Agent (`frontend-developer.md`)

**Роль:** Full-stack Frontend Development

**Специализация:**
- React 18+ компоненты
- TypeScript типизация
- EPUB.js читалка оптимизация
- Zustand state management
- Tailwind CSS styling

**Когда использовать:**
- Создание/рефакторинг React компонентов
- TypeScript типы и interfaces
- EPUB Reader оптимизация
- UI/UX implementation
- Performance optimization

**Пример:**
```
Создай компонент для отображения статистики чтения с графиками
```

---

### 🧪 Testing & QA Specialist Agent (`testing-qa-specialist.md`)

**Роль:** Comprehensive Testing & Quality Assurance

**Специализация:**
- Backend: pytest, unit/integration tests
- Frontend: vitest, React Testing Library
- Code review и quality checks
- Performance testing
- Security scanning

**Когда использовать:**
- Создание unit/integration тестов
- Code review automation
- Performance benchmarking
- Quality gates enforcement
- Security audits

**Пример:**
```
Создай comprehensive test suite для BookService
```

---

### 🗄️ Database Architect Agent (`database-architect.md`)

**Роль:** Database Design & Optimization

**Специализация:**
- SQLAlchemy models и relationships
- Alembic migrations
- Query optimization (N+1 prevention)
- Database schema design
- Indexing strategy

**Когда использовать:**
- Создание/модификация models
- Database migrations
- Query optimization
- Schema design
- Data integrity

**Пример:**
```
Создай модель Annotation для пользовательских аннотаций
```

---

### 📊 Analytics Specialist Agent (`analytics-specialist.md`)

**Роль:** Data Analytics & Business Intelligence

**Специализация:**
- Metrics & KPI tracking
- User behavior analysis
- Performance monitoring
- A/B testing
- ML-based analytics (recommendations, churn prediction)

**Когда использовать:**
- KPI dashboards
- User behavior analysis
- Performance metrics
- A/B testing
- Predictive analytics

**Пример:**
```
Создай KPI dashboard для отслеживания целей проекта
```

---

### **Tier 3: Optional Agents (Advanced)** 🔧

### 🔧 Code Quality & Refactoring Agent (`code-quality-refactoring.md`)

**Роль:** Code Quality Expert & Refactoring Specialist

**Специализация:**
- Code smell detection и устранение
- Systematic refactoring (Extract Method, Extract Class)
- Design patterns application (Strategy, Factory, Observer)
- SOLID principles enforcement
- Technical debt management

**Когда использовать:**
- Рефакторинг legacy кода
- Устранение code smells (god classes, long methods)
- Применение design patterns
- Улучшение maintainability кода
- Оптимизация структуры проекта

**Пример:**
```
Рефактор BookService - слишком большой класс (god class)
```

---

### 🚀 DevOps Engineer Agent (`devops-engineer.md`)

**Роль:** DevOps & Infrastructure Specialist

**Специализация:**
- Docker containerization и оптимизация
- CI/CD pipelines (GitHub Actions)
- Production deployment automation
- Monitoring & observability (Prometheus, Grafana, Loki)
- Infrastructure as Code (Terraform)
- Security (SSL/TLS, secrets management)

**Когда использовать:**
- Настройка CI/CD pipelines
- Оптимизация Docker builds
- Production deployment
- Setup мониторинга
- Infrastructure automation
- Security hardening

**Пример:**
```
Создай GitHub Actions pipeline для автоматического деплоя
```

---

## 🚀 Быстрый старт

### 1. Используйте Orchestrator для любых задач

Самый простой способ - просто опишите что хотите:

```
Добавь endpoint для получения списка популярных книг
```

Orchestrator автоматически:
- Проанализирует запрос
- Выберет подходящего агента (Backend API Developer)
- Создаст детальный промпт
- Запустит выполнение
- Проверит результат
- Обновит документацию

### 2. Или напрямую обратитесь к специализированному агенту

Если знаете какой агент нужен:

```
[АГЕНТ]: Multi-NLP System Expert

ЗАДАЧА: Оптимизируй ensemble voting алгоритм для увеличения
скорости обработки без потери качества.

ЦЕЛЬ: <2 секунды на книгу (сейчас 4 секунды)
```

---

## 📖 Как работают subagents

### Формат запроса к агенту

```markdown
[АГЕНТ]: [Название агента]

КОНТЕКСТ:
- Проект: BookReader AI
- Компоненты: [затронутые компоненты]
- Текущее состояние: [релевантная информация]

ЗАДАЧА:
[Описание что нужно сделать]

ТРЕБОВАНИЯ:
1. [Требование 1]
2. [Требование 2]

КРИТЕРИИ КАЧЕСТВА:
- [ ] [Критерий 1]
- [ ] [Критерий 2]

РЕЗУЛЬТАТ ДОЛЖЕН ВКЛЮЧАТЬ:
- [Deliverable 1]
- [Deliverable 2]
```

### Extended Thinking

Используйте для сложных задач:

- `[think]` - для простых задач
- `[think hard]` - для средней сложности
- `[think harder]` - для сложных задач
- `[ultrathink]` - для критических задач (Multi-NLP, production)

**Пример:**
```
[ultrathink] Как оптимизировать Multi-NLP систему для увеличения
скорости в 2 раза с сохранением качества >70%?
```

---

## 💡 Лучшие практики

### 1. Research-Plan-Implement workflow

**Всегда начинайте с анализа:**
```
1. RESEARCH - проанализируй текущее состояние
2. PLAN - составь план выполнения
3. IMPLEMENT - реализуй по плану
```

### 2. Будьте конкретны

❌ Плохо: "Улучши парсинг"
✅ Хорошо: "Ускорь парсинг книг с 4 до 2 секунд с сохранением >70% качества"

### 3. Указывайте контекст

✅ Хорошо:
```
Создай endpoint для статистики чтения.

Нужны метрики:
- Всего книг прочитано
- Любимый жанр
- Среднее время чтения
- Прогресс текущих книг
```

### 4. Используйте validators

После выполнения задачи проверяйте:
- ✅ Тесты проходят
- ✅ Документация обновлена
- ✅ Code quality standards соблюдены
- ✅ Performance не ухудшилась

---

## 🛠 Создание своего агента

### Шаблон subagent

Создайте файл `.claude/agents/your-agent.md`:

```markdown
# Your Agent Name

**Role:** [Краткое описание роли]

**Specialization:** [Область экспертизы]

**Version:** 1.0

---

## Description

[Детальное описание агента и его возможностей]

---

## Instructions

### Core Responsibilities

1. [Обязанность 1]
2. [Обязанность 2]

### Context

**Ключевые файлы:**
- `path/to/file.py` - [описание]

**Стандарты:**
- [Стандарт 1]
- [Стандарт 2]

### Workflow

```
ЗАДАЧА получена →
[think level] →
Analyze →
Plan →
Implement →
Validate →
Document
```

### Best Practices

1. [Practice 1]
2. [Practice 2]

### Example Tasks

[Примеры типовых задач]

---

## Tools Available

- Read
- Edit
- Bash
- Grep

---

## Success Criteria

- ✅ [Критерий 1]
- ✅ [Критерий 2]

---

## Version History

- v1.0 (YYYY-MM-DD) - Initial version
```

### Добавьте в Orchestrator

Отредактируйте `.claude/agents/orchestrator.md`:

```markdown
### 3. Mapping Запросов на Агентов

**Ваша категория:**
- "создай X..." → Your Agent Name
```

---

## 📊 Метрики эффективности

### Отслеживайте:

- **Скорость разработки:** 2x ускорение с агентами
- **Качество кода:** Test coverage >70%
- **Документация:** 100% актуальная
- **Time saved:** 50%+ на рутинных задачах

### Целевые метрики:

- 90%+ правильный выбор агента Orchestrator'ом
- 80%+ задач выполняются в оценочное время
- 95%+ прохождение quality gates
- 100% документация обновлена

---

## 🔍 Troubleshooting

### Агент не понимает задачу

**Решение:** Добавьте больше контекста и примеров

### Результат не соответствует ожиданиям

**Решение:** Уточните критерии успеха и требования

### Агент выбран неправильно

**Решение:** Укажите технологию явно (FastAPI, React, Multi-NLP)

---

## 📊 Tier Overview

| Tier | Agents | Purpose |
|------|--------|---------|
| **Tier 0** | 1 agent | Orchestrator - координатор всей системы |
| **Tier 1** | 3 agents | Core Must-Have агенты (NLP, Backend, Docs) |
| **Tier 2** | 4 agents | Specialist агенты (Frontend, Testing, DB, Analytics) |
| **Tier 3** | 2 agents | Advanced агенты (Code Quality, DevOps) |
| **TOTAL** | **10 agents** | Полное покрытие всех аспектов разработки |

---

## 📚 Дополнительная документация

- [Orchestrator Agent Guide](../../docs/development/orchestrator-agent-guide.md) - подробное руководство
- [Claude Code Agents System](../../docs/development/claude-code-agents-system.md) - полная система из 21 агента
- [AGENTS_FINAL_ARCHITECTURE](../../AGENTS_FINAL_ARCHITECTURE.md) - финальная архитектура 10 агентов
- [Official Claude Code Docs](https://docs.claude.com/en/docs/claude-code/sub-agents)

---

## 🎓 Примеры использования

### Простая задача

```
Создай endpoint для получения списка жанров книг
```

→ Orchestrator делегирует Backend API Developer
→ Endpoint создан за 15 минут
→ Документация автоматически обновлена

---

### Сложная задача

```
Добавь систему рекомендаций книг на основе истории чтения
с ML моделью и A/B тестированием
```

→ Orchestrator создает план с несколькими агентами
→ Координирует выполнение по фазам
→ Валидирует результаты
→ Полная реализация за 3-5 дней

---

### Оптимизация

```
Парсинг книг занимает 4 секунды, нужно ускорить в 2 раза
```

→ Orchestrator делегирует Multi-NLP System Expert
→ Профилирование и оптимизация
→ Benchmark: 4s → 2s
→ Качество сохранено: >70%

---

### Рефакторинг

```
Рефактор BookService - слишком большой класс (250+ строк)
```

→ Orchestrator делегирует Code Quality & Refactoring Agent
→ Анализ code smells
→ Применение Extract Class pattern
→ Complexity: 15 → 5
→ Все тесты проходят

---

### DevOps автоматизация

```
Настрой CI/CD pipeline для автоматического тестирования и деплоя
```

→ Orchestrator делегирует DevOps Engineer Agent
→ Создание GitHub Actions workflows
→ Automated testing + deployment
→ Zero-downtime deployments

---

## 🚀 Готовы начать?

Просто опишите что хотите сделать, и Orchestrator Agent позаботится об остальном!

**Первый запрос:**
```
Создай простой endpoint для получения топ-10 популярных книг
```

---

**Версия:** 2.0.0 (10 агентов)
**Автор:** Claude Code Agents System
**Лицензия:** Private Project
**Поддержка:** См. документацию в `/docs/development/`
**Last Updated:** 23.10.2025
