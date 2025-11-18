Запусти полный test suite и создай coverage report с фокусом на Phase 4 blockers.

ЗАДАЧА:
1. **Run Backend Tests:**
   ```bash
   cd backend
   pytest --cov=app --cov-report=html --cov-report=term
   ```

2. **Run Frontend Tests:**
   ```bash
   cd frontend
   npm test -- --coverage
   ```

3. **Phase 4 Critical Coverage (PRIORITY):**
   - `app/services/nlp/strategies/` - TARGET: 80%+
   - `app/services/nlp/components/` - TARGET: 80%+
   - `app/services/nlp/utils/` - TARGET: 70%+
   - `app/services/multi_nlp_manager.py` - TARGET: 80%+

4. **Coverage Analysis:**
   - Total coverage %
   - Files with <50% coverage (RED ALERT)
   - Files with 50-79% coverage (WARNING)
   - Files with 80%+ coverage (GOOD)
   - Missing tests count

5. **Gap Identification:**
   - Список untested functions
   - Список untested edge cases
   - Critical paths without coverage

6. **Create Report:**
   - Summary в `docs/development/testing/coverage-report-{date}.md`
   - HTML report в `backend/htmlcov/index.html`
   - Update `docs/development/status/current-status.md`

ОЖИДАЕМЫЙ РЕЗУЛЬТАТ:
```markdown
# Test Coverage Report - {date}

## Overall Coverage
- Backend: XX.X% (target: 80%+)
- Frontend: XX.X% (target: 75%+)
- **Phase 4 NLP:** XX.X% (target: 80%+) ⚠️

## Phase 4 Critical Modules

| Module | Coverage | Status | Missing Tests |
|--------|----------|--------|---------------|
| strategies/ | XX% | 🔴/🟡/🟢 | XX functions |
| components/ | XX% | 🔴/🟡/🟢 | XX functions |
| utils/ | XX% | 🔴/🟡/🟢 | XX functions |

🔴 <50% RED ALERT
🟡 50-79% WARNING
🟢 80%+ GOOD

## Coverage Gaps
### Critical (RED ALERT)
- {untested_function_1} in {file}
- {untested_function_2} in {file}

### Warning (NEEDS TESTS)
- {function} in {file}

## Action Items
- [ ] Write tests for {module} (priority: HIGH)
- [ ] Add edge case tests for {function}
- [ ] Integration tests for {component}

## Phase 4 Integration Status
Current: XX% coverage
Target: 80%+ coverage
**BLOCKED:** ❌ Cannot integrate until target met
или
**READY:** ✅ Can proceed with integration
```

АГЕНТЫ:
- Testing & QA Specialist (для запуска тестов)
- Analytics Specialist (для анализа coverage)
- Documentation Master (для отчета)
