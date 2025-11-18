Покажи статус всех агентов и рекомендации по использованию.

ЗАДАЧА:
1. **Прочитай все agent files:**
   - `.claude/agents/*.md`
   - Извлеки metadata (name, version, model, description)

2. **Проанализируй specialization:**
   - Какие задачи каждый агент решает
   - Overlap между агентами
   - Coverage gaps

3. **Model configuration:**
   - Haiku agents (3) - простые задачи
   - Sonnet agents (7) - стандартные задачи
   - Opus agents (0) - нет (cost optimization)

4. **Recent updates:**
   - Version 2.0 agents (10)
   - Version 1.0 agents (1)
   - Last updated dates

5. **Performance metrics (если доступно):**
   - Average task completion time
   - Success rate
   - Token usage

6. **Recommendations:**
   - Какого агента использовать для текущей задачи
   - Возможности оптимизации

ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
```markdown
# Agent System Status - {date}

## Overview
- Total agents: 11 (10 specialists + 1 orchestrator)
- Version 2.0: 10 agents
- Version 1.0: 1 agent
- Shared context: ✅ Active

## Model Distribution

### Haiku (3 agents) - Cost-Optimized
- Documentation Master v2.0 ✅
- Testing & QA Specialist v2.0 ✅
- Analytics Specialist v1.0 ✅

### Sonnet (7 agents) - Standard Workhorses
- Orchestrator v2.0 ✅
- Multi-NLP Expert v2.0 ✅
- Backend API Developer v2.0 ✅
- Frontend Developer v2.0 ✅
- Database Architect v2.0 ✅
- DevOps Engineer v2.0 ✅
- Code Quality & Refactoring v2.0 ✅

### Opus (0 agents) - None (Cost Optimization) ✅

## Cost Impact
- Baseline (all Opus): ~$150/month
- Optimized (Haiku/Sonnet): ~$45/month
- **SAVINGS: 70% ($105/month)** 🎉

## Agent Capabilities Matrix

| Task Type | Primary Agent | Backup Agent | Model |
|-----------|---------------|--------------|-------|
| Multi-NLP optimization | Multi-NLP Expert | - | Sonnet |
| API development | Backend API Developer | - | Sonnet |
| React components | Frontend Developer | - | Sonnet |
| Database design | Database Architect | - | Sonnet |
| Testing | Testing & QA Specialist | - | Haiku |
| Documentation | Documentation Master | - | Haiku |
| Deployment | DevOps Engineer | - | Sonnet |
| Analytics | Analytics Specialist | - | Haiku |
| Code quality | Code Quality | - | Sonnet |
| Coordination | Orchestrator | - | Sonnet |

## Recent Updates (v2.0)
- ✅ Russian language requirement added (all agents)
- ✅ Phase 4 context added (critical blockers)
- ✅ Model optimization (Haiku/Sonnet selection)
- ✅ Shared context module created
- ✅ Production deployment context added

## Phase 4 Status
- **Critical:** 0% test coverage для новой NLP архитектуры
- **Blocker:** Integration of LangExtract, Advanced Parser, DeepPavlov
- **Priority:** Testing & QA Specialist работает над 130+ tests

## Recommendations

### Для текущей задачи:
{AI анализирует задачу и предлагает агента}

### Optimization opportunities:
- {suggestions based on usage patterns}

## Quick Reference

**Для Multi-NLP задач:** `/nlp-benchmark` или Multi-NLP Expert
**Для deployment:** `/deploy-check` или DevOps Engineer
**Для тестов:** `/test-coverage` или Testing & QA Specialist
**Для документации:** `/docs-update` или Documentation Master
```

АГЕНТЫ:
- Analytics Specialist (для анализа статуса)
- Documentation Master (для форматирования отчета)
