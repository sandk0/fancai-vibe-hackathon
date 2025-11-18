---
description: Улучшенное сжатие контекста с сохранением языка и project context
model: sonnet
allowed-tools: Read, Glob
argument-hint: [deep|standard|light]
---

Выполни intelligent context compression с сохранением критически важной информации.

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

### 4. Structured Summary Template

Создай **четко структурированный summary**:

```markdown
# 📦 Context Compression Summary
**Дата:** {current_date} {current_time}
**Compression level:** {deep|standard|light}
**Original size:** ~{X}K tokens
**Compressed size:** ~{Y}K tokens
**Compression ratio:** {ratio}%
**Remaining capacity:** ~{remaining}K tokens

---

## 🌐 LANGUAGE SETTINGS (LEVEL 1 - VERBATIM)

**PRIMARY LANGUAGE:** RUSSIAN (ru-RU)

**КРИТИЧЕСКОЕ ТРЕБОВАНИЕ:**
📌 Продолжай работу ИСКЛЮЧИТЕЛЬНО на русском языке!
📌 Все ответы, документация, коммиты - ТОЛЬКО на русском!
📌 НЕ переключайся на английский после этого сжатия!

**Language verification:** ✅ Russian language preserved

---

## 🎯 PROJECT: {project_name} (LEVEL 1-2)

**Stack:**
- Backend: {tech} - {key_info}
- Frontend: {tech} - {key_info}
- NLP/AI: {tech} - {key_info}
- Infrastructure: {tech} - {key_info}

**Current Phase:** {phase}
**Production Status:** {status} (URL: {url if exists})

**Critical Requirements from CLAUDE.md:**
1. {requirement_1}
2. {requirement_2}
3. {requirement_3}

**Critical Entities (Memory Buffer):**
- Names: {project, components, files}
- Dates: {deadlines, milestones}
- Constraints: {blockers, limitations}
- Metrics: {KPIs, benchmarks}

---

## 📋 CURRENT TASK (LEVEL 1 - VERBATIM)

**Main Objective:** {detailed_goal}

**What I'm doing RIGHT NOW:**
{detailed_description_of_current_work}

**Progress Status:**
- ✅ {completed_step_1} - {brief_note}
- ✅ {completed_step_2} - {brief_note}
- ⏳ {in_progress_step} - {current_status}
- ⏳ {pending_step_1}
- ⏳ {pending_step_2}

**Critical Blockers:**
- 🚨 {blocker_1} - {severity} - {impact}
- 🚨 {blocker_2} (if any)

**Success Criteria:**
- {criterion_1}
- {criterion_2}

---

## 📝 RECENT CHANGES (LEVEL 2 - SUMMARIZED)

**Last Session Summary:**
{what_was_accomplished_in_last_session}

**Last 5 Commits:**
1. `{hash}`: {message} - {key_changes}
2. `{hash}`: {message} - {key_changes}
3. `{hash}`: {message}
4. `{hash}`: {message}
5. `{hash}`: {message}

**Modified Files (this session):**
- `{file_path_1}` - {what_changed} - {why}
- `{file_path_2}` - {what_changed} - {why}
- `{file_path_3}` - {brief}

**Key Technical Decisions:**
1. **Decision:** {decision_1}
   - **Reason:** {why}
   - **Impact:** {what_it_affects}
   - **Alternatives:** {what_was_rejected}

2. **Decision:** {decision_2}
   - **Reason:** {why}

**Architecture Changes:**
- {change_1} - {rationale}
- {change_2}

---

## 🤖 AGENT SYSTEM STATE (LEVEL 2)

**Active Configuration:**
- Model distribution: {X} Haiku, {Y} Sonnet, {Z} Opus
- Shared context: ✅ Active (`.claude/agents/shared_context.md`)
- Slash commands: {count} available

**Custom Slash Commands:**
- `/context-compress` (or `/cc`) - This command
- `/nlp-benchmark` - NLP testing
- `/deploy-check` - Pre-deployment
- `/test-coverage` - Test coverage
- `/docs-update` - Documentation
- `/agent-status` - Agent overview

**Recent Agent Activity:**
{which_agents_were_used_recently}

---

## 📁 KEY FILES & LOCATIONS (LEVEL 2)

**Current Focus Files:**
1. `{file_path_1}` - {purpose} - {current_state}
2. `{file_path_2}` - {purpose} - {current_state}
3. `{file_path_3}` - {purpose}

**Important Configurations:**
- `{config_file_1}` - {what_it_configures}
- `{config_file_2}` - {what_it_configures}

**Critical Modules:**
- `{module_path_1}` - {responsibility}
- `{module_path_2}` - {responsibility}

**Recently Modified Patterns:**
- Pattern: {pattern_name} - Location: {where} - Purpose: {why}

---

## ⏭️ NEXT STEPS (LEVEL 1 - VERBATIM)

**Immediate Actions (Priority 1):**
1. [ ] {task_1} - {estimated_time} - {dependencies}
2. [ ] {task_2} - {estimated_time}
3. [ ] {task_3}

**Follow-up Actions (Priority 2):**
1. [ ] {task_4} - **AFTER** {dependency}
2. [ ] {task_5}

**Future Tasks (Priority 3):**
1. [ ] {task_6}

**Dependencies Chain:**
```
{task_A} → {task_B} → {task_C}
```

**Blockers to Resolve:**
1. {blocker} - **Must resolve before** {task}

**Estimated Timeline:**
- Priority 1: {timeframe}
- Priority 2: {timeframe}
- Priority 3: {timeframe}

---

## 🗂️ CONTEXT PRESERVATION NOTES (LEVEL 3 - ABSTRACT)

**Historical Context:**
{any_important_historical_context_that_affects_current_work}

**Resolved Issues (archived):**
- {issue_1} - ✅ Resolved - {solution_summary}
- {issue_2} - ✅ Resolved

**Lessons Learned:**
- {lesson_1}
- {lesson_2}

**Important Conversations:**
{key_discussions_or_decisions_from_earlier_in_session}

**External Dependencies:**
{any_external_factors_team_members_services}

---

## 💾 STRUCTURED NOTE-TAKING (Persistent Memory)

**Note:** Следующая информация будет persist вне context window

**Critical Decisions Log:**
```markdown
- [{date}] {decision} - Rationale: {why} - Impact: {what}
```

**Architecture Decisions Record (ADR):**
```markdown
- [{date}] {architectural_change} - Reason: {why} - Trade-offs: {what}
```

**Blockers & Resolutions:**
```markdown
- [{date}] Blocker: {what} - Status: {resolved/pending} - Solution: {how}
```

**Important Metrics:**
```markdown
- Current: {metric_name}: {value} ({trend})
- Target: {target_value}
```

---

## 📊 COMPRESSION METADATA

**Compression Strategy Used:**
- Level: {deep|standard|light}
- Method: Hierarchical Summarization (3 levels)
- Memory Buffering: ✅ Critical entities preserved
- Attention Focus: {what_was_prioritized}

**What Was Preserved:**
- ✅ Language settings (Russian)
- ✅ Current task (verbatim)
- ✅ Next steps (verbatim)
- ✅ Critical entities (names, dates, decisions)
- ✅ Recent changes (summarized)
- ✅ Project context (from CLAUDE.md)

**What Was Compressed:**
- 📦 Detailed explanations (→ summaries)
- 📦 Debugging logs (→ outcomes only)
- 📦 Exploratory discussions (→ conclusions)

**What Was Archived:**
- 🗄️ Resolved issues (accessible if needed)
- 🗄️ Old discussions (historical context)

**Quality Assurance:**
- [ ] Language requirement explicit? ✅
- [ ] Current task clear? ✅
- [ ] Next steps prioritized? ✅
- [ ] Critical entities preserved? ✅
- [ ] Compression level appropriate? ✅

---

## 🔄 ПРОДОЛЖЕНИЕ РАБОТЫ

**СТАТУС:** ✅ Context compression complete

**СЛЕДУЮЩИЙ ШАГ:** Продолжай работу над задачей "{current_task_name}"

**ВАЖНО:**
- 🌐 Работай ТОЛЬКО на русском языке
- 🎯 Следуй Next Steps выше
- 📋 Используй сохраненный контекст
- 🔧 Обращайся к Key Files если нужно

**READY TO CONTINUE:** 🚀

Если нужны уточнения по сохраненному контексту - спроси на русском языке.

Если потерялся контекст - обратись к:
1. Этому summary
2. `CLAUDE.md` (project instructions)
3. `.claude/agents/shared_context.md` (agent context)
4. `git log` (recent changes)

---

✅ **Compression successful. Continuing in Russian.**
```

### 5. Compression Levels - Advanced

**Выбери уровень на основе аргумента** (`$ARGUMENTS`):

**DEEP compression** (argument: "deep"):
- Target: 15-20K tokens (85-90% reduction)
- Strategy: Hierarchical + Recursive summarization
- Use when: >150K tokens consumed
- Preserves: Level 1 only (critical entities + language + current task)
- Compresses: Level 2 aggressively (bullet points)
- Archives: Level 3 (reference only)

**STANDARD compression** (default or "standard"):
- Target: 25-35K tokens (60-70% reduction)
- Strategy: Hierarchical summarization
- Use when: 70-150K tokens consumed
- Preserves: Level 1 + Level 2 (detailed + summarized)
- Compresses: Level 3 moderately
- Archives: Historical context

**LIGHT compression** (argument: "light"):
- Target: 40-50K tokens (25-40% reduction)
- Strategy: Selective compression
- Use when: <70K tokens consumed
- Preserves: Level 1 + Level 2 + most Level 3
- Compresses: Only redundant information
- Archives: Minimal

**AUTO-SELECT** (если аргумент не указан):
```
if estimated_tokens > 150K:
    use DEEP
elif estimated_tokens > 70K:
    use STANDARD
else:
    use LIGHT
```

### 6. Post-Compression Validation

**Проверь после создания summary:**

**CRITICAL checks:**
- [ ] ✅ Языковое требование (русский) явно указано В НАЧАЛЕ
- [ ] ✅ "Продолжай на русском" instruction присутствует
- [ ] ✅ Project context сохранен (из CLAUDE.md)
- [ ] ✅ Current task описан детально (не сжат)
- [ ] ✅ Next steps четко определены и приоритизированы
- [ ] ✅ Critical entities extracted и listed

**QUALITY checks:**
- [ ] ✅ Summary структурирован (7+ sections)
- [ ] ✅ Hierarchical levels применены корректно
- [ ] ✅ Memory buffer заполнен (names, dates, decisions)
- [ ] ✅ Compression metadata включена
- [ ] ✅ Continuation prompt на русском языке

**COMPLETENESS checks:**
- [ ] ✅ Все blockers listed
- [ ] ✅ Dependencies identified
- [ ] ✅ Git history included
- [ ] ✅ Modified files documented

### 7. Final Output

**После validation выведи:**

1. Summary (полный structured text выше)
2. Compression statistics
3. Continuation prompt на русском
4. Ready indicator

**Формат:**
```
[Summary text above]

---

📊 COMPRESSION STATS:
- Original: ~{X}K tokens
- Compressed: ~{Y}K tokens
- Saved: ~{Z}K tokens ({ratio}%)
- Remaining capacity: ~{remaining}K tokens

🔄 CONTINUING IN RUSSIAN
Ready to continue work on: {task}
```

## 🎯 EXECUTION NOTES

**Timing:**
- Analysis: 30-60 seconds
- Summarization: 60-120 seconds
- Validation: 15-30 seconds
- **Total: 2-4 minutes**

**Quality over Speed:**
- Лучше потратить 4 минуты и сохранить 90% качества
- Чем сэкономить 2 минуты и потерять 30% контекста

**Priority Order:**
1. Language preservation (CRITICAL)
2. Current task clarity
3. Next steps detail
4. Critical entities
5. Recent changes
6. Everything else

---

**АГЕНТЫ:**
- Analytics Specialist (для context analysis)
- Documentation Master (для structured summary)

**EXPECTED RESULTS:**
- 🌐 100% language retention
- 🎯 90% quality retention
- 📉 40-70% token reduction
- ⚡ Zero workflow disruption
