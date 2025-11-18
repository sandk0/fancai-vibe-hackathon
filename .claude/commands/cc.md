---
description: Короткий алиас для /context-compress
model: sonnet
allowed-tools: Read, Glob
argument-hint: [deep|standard|light]
---

Выполняю `/context-compress $ARGUMENTS`

**Это короткий алиас для полной команды сжатия контекста.**

Используй `/context-compress` или `/cc` - работают одинаково.

**Уровни сжатия:**
- `/cc deep` - Агрессивное сжатие (85-90%, для >150K tokens)
- `/cc standard` или `/cc` - Стандартное (60-70%, для 70-150K tokens)
- `/cc light` - Легкое сжатие (25-40%, для <70K tokens)

**Что делает команда:**
1. ✅ Сохраняет РУССКИЙ ЯЗЫК (100% retention)
2. ✅ Создает structured summary (9+ sections)
3. ✅ Применяет hierarchical summarization (3 levels)
4. ✅ Сохраняет critical entities (memory buffering)
5. ✅ Сохраняет project context из CLAUDE.md
6. ✅ Сохраняет current task и next steps VERBATIM
7. ✅ Сохраняет agent system state

**Преимущества vs стандартный /compact:**
- 🌐 100% language retention (vs 0% в /compact)
- 🎯 90% quality retention (vs 70% в /compact)
- 📋 Structured output (vs unstructured)
- 🔧 3 уровня control (vs none)

---

Выполняю ту же логику что и `/context-compress $ARGUMENTS`...

## 🎯 КРИТИЧЕСКИ ВАЖНО: ЯЗЫК И КОНТЕКСТ

**ОБЯЗАТЕЛЬНЫЕ ТРЕБОВАНИЯ:**
1. ✅ **ВСЯ ДАЛЬНЕЙШАЯ РАБОТА ТОЛЬКО НА РУССКОМ ЯЗЫКЕ**
2. ✅ **Все отчеты, документация, коммиты - только на русском**
3. ✅ **Сохранить project context из CLAUDE.md**
4. ✅ **Сохранить текущую задачу и прогресс**

## 📊 ЗАДАЧА СЖАТИЯ КОНТЕКСТА

### 1. Context Awareness & Analysis

**Оцени текущий контекст:**
```markdown
Current token usage: {estimate based on conversation length}
Recommended compression: {deep|standard|light}
Target after compression: ~{X}K tokens
```

**Прочитай project instructions:**
- !`cat CLAUDE.md 2>/dev/null || echo "CLAUDE.md не найден"`
- Извлеки ключевые требования проекта
- Определи технологический стек
- Найди специфичные инструкции

**Определи текущий статус:**
- Какая задача выполняется сейчас
- Какой прогресс достигнут
- Какие файлы были изменены
- Какие решения были приняты

**Проверь git status:**
- !`git status --short`
- !`git log -5 --oneline`

### 2. Memory Buffering - Сохранение критических сущностей

**ОБЯЗАТЕЛЬНО сохрани:**

**Critical Entities:**
- 📝 **Names**: имена людей, проектов, компонентов, файлов
- 📅 **Dates**: важные даты, дедлайны, milestones
- 🎯 **Decisions**: ключевые технические решения с обоснованием
- ⚠️ **Constraints**: ограничения, requirements, blockers
- 🔢 **Metrics**: важные числа, KPIs, benchmarks
- 🔗 **Dependencies**: зависимости между задачами

**Technical Context:**
- Stack: используемые технологии
- Architecture: ключевые архитектурные паттерны
- Patterns: code patterns, conventions
- APIs: endpoints, integrations

### 3. Hierarchical Summarization Strategy

Применяй **multi-level summarization**:

**Level 1 - DETAILED (сохраняется VERBATIM):**
- Language requirements (РУССКИЙ ЯЗЫК)
- Current task description
- Next immediate steps
- Critical blockers

**Level 2 - SUMMARIZED (bullet points):**
- Recent code changes (last session)
- Key technical decisions
- Important files modified
- Test results

**Level 3 - ABSTRACT (high-level overview):**
- Project overview
- Historical decisions (older)
- Resolved issues
- General architecture

### 4. Создай Structured Summary

Используй полный template из `/context-compress`:

- 🌐 LANGUAGE SETTINGS (LEVEL 1 - VERBATIM)
- 🎯 PROJECT (LEVEL 1-2)
- 📋 CURRENT TASK (LEVEL 1 - VERBATIM)
- 📝 RECENT CHANGES (LEVEL 2 - SUMMARIZED)
- 🤖 AGENT SYSTEM STATE (LEVEL 2)
- 📁 KEY FILES & LOCATIONS (LEVEL 2)
- ⏭️ NEXT STEPS (LEVEL 1 - VERBATIM)
- 🗂️ CONTEXT PRESERVATION NOTES (LEVEL 3 - ABSTRACT)
- 💾 STRUCTURED NOTE-TAKING (Persistent Memory)
- 📊 COMPRESSION METADATA

### 5. Compression Level Selection

**Argument: `$ARGUMENTS`**

- `deep` → 85-90% reduction, для >150K tokens
- `standard` или пусто → 60-70% reduction, для 70-150K tokens
- `light` → 25-40% reduction, для <70K tokens

**AUTO-SELECT если аргумент не указан:**
- >150K tokens → use DEEP
- 70-150K tokens → use STANDARD
- <70K tokens → use LIGHT

### 6. Post-Compression Validation

Проверь все CRITICAL, QUALITY, COMPLETENESS checks.

### 7. Final Output

Выведи:
1. Complete structured summary
2. Compression statistics
3. Continuation prompt на русском
4. Ready indicator

---

**ОЖИДАЕМЫЕ РЕЗУЛЬТАТЫ:**
- 🌐 100% language retention
- 🎯 90% quality retention
- 📉 40-70% token reduction
- ⚡ Zero workflow disruption

**EXECUTION TIME:** 2-4 минуты

✅ **Compression successful. Continuing in Russian.**
