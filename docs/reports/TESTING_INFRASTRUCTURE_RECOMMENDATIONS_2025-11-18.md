# Рекомендации по Test Infrastructure (Testing Infrastructure Recommendations)

**Дата:** 2025-11-18
**Версия:** 1.0
**Статус:** DRAFT

---

## EXECUTIVE SUMMARY

Текущая test infrastructure имеет хорошую основу, но требует значительных улучшений для:
1. Автоматизации тестирования в CI/CD
2. Улучшения покрытия тестами
3. Оптимизации производительности тестов
4. Мониторинга качества кода

**Estimated cost:** $500-1000 (в большинстве случаев бесплатно для open source)
**Timeline:** 1-2 недели для полной настройки

---

## PART 1: BACKEND TEST INFRASTRUCTURE

### 1.1 Текущее состояние ✅

```
✅ pytest: установлен и настроен
✅ conftest.py: хорошо структурирован
✅ AsyncIO support: pytest-asyncio работает
✅ Database fixtures: есть
✅ Coverage reporting: есть (HTML + terminal)
✅ Configuration: pytest.ini правильно настроена
```

### 1.2 Рекомендуемые Улучшения

#### A. Performance Testing

**Текущее состояние:** Базовые load тесты

**Рекомендация:** Добавить pytest-benchmark

```bash
pip install pytest-benchmark
```

**Использование:**

```python
# backend/tests/performance/test_nlp_performance.py

def test_multi_nlp_parsing_performance(benchmark):
    """Benchmark Multi-NLP parsing speed."""
    result = benchmark(
        extract_descriptions,
        text=SAMPLE_TEXT,
        mode=ProcessingMode.ENSEMBLE
    )

    # Assertions
    assert result.processing_time < 4000  # <4 seconds
    assert len(result.descriptions) > 100
```

**Benefits:**
- Автоматическое отслеживание регрессий производительности
- Статистика (min/max/mean/median)
- История результатов
- CI/CD интеграция

---

#### B. Test Data Management

**Текущее состояние:** Inline fixtures + temporary data

**Рекомендация:** Использовать pytest-factoryboy

```bash
pip install pytest-factoryboy
```

**Пример:**

```python
# backend/tests/factories.py

import factory
from factory.sqlalchemy import SQLAlchemyModelFactory
from app.models.book import Book

class BookFactory(SQLAlchemyModelFactory):
    """Factory for creating test Book instances."""

    class Meta:
        model = Book
        sqlalchemy_session = None  # Will be injected by pytest

    title = factory.Faker('sentence')
    author = factory.Faker('name')
    genre = factory.Faker('word')
    language = 'ru'
    file_format = 'epub'
    file_size = factory.Faker('random_int', min=1000, max=1000000)

# Use in tests:
@pytest.mark.asyncio
async def test_something(book_factory):
    book = book_factory(title="Custom Title")
    # Use book in test
```

**Benefits:**
- DRY - не повторяем создание тестовых данных
- Гибкость - легко переопределять значения
- Масштабируемость - сложные фикстуры просто

---

#### C. Mocking Improvements

**Текущее состояние:** AsyncMock + patch

**Рекомендация:** Добавить pytest-mock для лучшего управления

```bash
pip install pytest-mock
```

**Пример:**

```python
# Better mocking with pytest-mock
def test_something(mocker):
    """Use pytest-mock for cleaner code."""

    # Patch with automatic cleanup
    mock_processor = mocker.AsyncMock(spec=NLPProcessor)
    mock_processor.process.return_value = {...}

    # No need for manual reset - pytest-mock handles it
```

**Benefits:**
- Автоматическая очистка после каждого теста
- Better spec support
- Удобный синтаксис

---

#### D. Property-Based Testing

**Текущее состояние:** Нет

**Рекомендация:** Использовать hypothesis для генерации тестовых данных

```bash
pip install hypothesis
```

**Пример:**

```python
# backend/tests/test_description_extraction_properties.py

from hypothesis import given, strategies as st

@given(
    text=st.text(min_size=10, max_size=10000),
    language=st.sampled_from(['ru', 'en'])
)
def test_extract_descriptions_handles_any_text(text, language):
    """Property: extraction should work for any text."""
    result = extract_descriptions(text, language=language)

    # Properties to assert:
    assert isinstance(result, list)
    assert all(isinstance(d, Description) for d in result)
    assert all(0 < len(d.text) < 5000 for d in result)
```

**Benefits:**
- Находит edge cases, которые вы не ожидали
- Улучшает код качество
- Хорошо для парсинга и валидации

---

#### E. API Documentation Testing

**Текущее состояние:** Нет

**Рекомендация:** Использовать schemathesis для OpenAPI schema validation

```bash
pip install schemathesis
```

**Пример:**

```python
# backend/tests/test_api_schema.py

import schemathesis
from app.main import app

schema = schemathesis.from_asgi("/openapi.json", app=app)

@schema.parametrize()
def test_api_conforms_to_schema(case):
    """All API responses should match OpenAPI schema."""
    response = case.call()
    assert response.status_code < 500
```

**Benefits:**
- Валидация API соответствия spec
- Автоматическое тестирование всех endpoints
- Находит недокументированные endpoints

---

### 1.3 CI/CD Integration for Backend

#### GitHub Actions Workflow

**Создать:** `.github/workflows/backend-tests.yml`

```yaml
name: Backend Tests & Coverage

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'backend/**'
      - '.github/workflows/backend-tests.yml'
  pull_request:
    branches: [ main, develop ]
    paths:
      - 'backend/**'

jobs:
  tests:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: bookreader_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432

      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
      - uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install pytest-benchmark hypothesis schemathesis

      - name: Run tests
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost/bookreader_test
          REDIS_URL: redis://localhost:6379
        run: |
          cd backend
          pytest tests/ \
            --cov=app \
            --cov-report=xml \
            --cov-report=html \
            --cov-fail-under=70 \
            --junitxml=junit.xml \
            -v

      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./backend/coverage.xml
          flags: backend
          fail_ci_if_error: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: backend-test-results
          path: |
            backend/junit.xml
            backend/htmlcov/

      - name: Comment PR with coverage
        if: github.event_name == 'pull_request'
        uses: py-cov-action/python-coverage-comment-action@v3
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

  type-checking:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install dependencies
        run: |
          cd backend
          pip install -r requirements.txt
          pip install mypy types-all

      - name: Run mypy
        run: |
          cd backend
          mypy app/core/ --strict
          mypy app/services/nlp/ --strict

  linting:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
          cache: 'pip'

      - name: Install linting tools
        run: |
          pip install ruff black flake8 bandit

      - name: Run ruff
        run: |
          cd backend
          ruff check .

      - name: Run black
        run: |
          cd backend
          black --check .

      - name: Run security check
        run: |
          cd backend
          bandit -r app/ -ll
```

**Benefits:**
- Автоматический запуск тестов для каждого PR
- Coverage tracking
- Type checking
- Security scanning
- PR comments с результатами

---

## PART 2: FRONTEND TEST INFRASTRUCTURE

### 2.1 Текущее состояние ⚠️

```
✅ vitest: установлен
✅ React Testing Library: установлена
⚠️  MSW: НЕ установлен (CRITICAL)
⚠️  Accessibility testing: НЕ настроена
❌ E2E testing: Playwright, но не интегрирован в CI/CD
```

### 2.2 Рекомендуемые Улучшения

#### A. Mock Service Worker (MSW)

**CRITICAL - Must Install**

```bash
npm install -D msw @mswjs/test-utils
```

**Setup (`frontend/src/test/setup.ts`):**

```typescript
import { setupServer } from 'msw/node';
import { handlers } from './mocks';
import '@testing-library/jest-dom';

// Create server
const server = setupServer(...handlers);

// Start mocking before tests
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after tests
afterAll(() => server.close());

export { server };
```

**Handlers (`frontend/src/test/mocks.ts`):**

```typescript
import { rest } from 'msw';

export const handlers = [
  // Auth
  rest.post('/api/v1/auth/login', (req, res, ctx) => {
    return res(ctx.json({ access_token: 'test-token' }));
  }),

  // Books
  rest.get('/api/v1/books', (req, res, ctx) => {
    return res(ctx.json({ items: [], total: 0 }));
  }),

  // Add more as needed
];
```

**Benefits:**
- Network request mocking на уровне browser API
- Работает с fetch, axios, и другими HTTP клиентами
- No need to mock API functions separately
- Более реалистичное тестирование

---

#### B. Accessibility Testing

**Install:**

```bash
npm install -D @testing-library/jest-dom jest-axe
```

**Setup:**

```typescript
// Add to frontend/src/test/setup.ts
import '@testing-library/jest-dom';
import 'jest-axe';

declare global {
  namespace Vi {
    interface Matchers<R> {
      toHaveNoViolations(): R;
    }
  }
}
```

**Usage:**

```typescript
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';

describe('AccessibleButton', () => {
  it('should have no accessibility violations', async () => {
    const { container } = render(
      <button>Click me</button>
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });
});
```

**Benefits:**
- Находит доступность issues автоматически
- WCAG 2.1 compliance checking
- Keyboard navigation validation

---

#### C. Component Testing Improvements

**Рекомендация:** Использовать Testing Library best practices

```typescript
// ✅ GOOD: Query by accessible role
screen.getByRole('button', { name: /submit/i })

// ✅ GOOD: Query by label text (for forms)
screen.getByLabelText(/username/i)

// ✅ GOOD: Query by placeholder text
screen.getByPlaceholderText(/search/i)

// ❌ AVOID: Query by test ID
screen.getByTestId('submit-button')  // Last resort
```

**Benefits:**
- Tests reflect real user interaction
- Better accessibility
- More maintainable tests

---

#### D. Visual Regression Testing

**Optional but Recommended:** Playwright Visual Comparisons

```bash
npm install -D @playwright/test
```

**Example:**

```typescript
// frontend/tests/visual/book-card.spec.ts

import { test, expect } from '@playwright/test';

test('BookCard should match visual snapshot', async ({ page }) => {
  await page.goto('/');
  const card = page.locator('[data-testid="book-card"]').first();

  // Capture and compare screenshot
  await expect(card).toHaveScreenshot();
});
```

**Benefits:**
- Catches unintended visual changes
- Regression testing for UI
- Good for design-critical components

---

### 2.3 CI/CD Integration for Frontend

#### GitHub Actions Workflow

**Создать:** `.github/workflows/frontend-tests.yml`

```yaml
name: Frontend Tests & Coverage

on:
  push:
    branches: [ main, develop ]
    paths:
      - 'frontend/**'
      - '.github/workflows/frontend-tests.yml'
  pull_request:
    branches: [ main, develop ]
    paths:
      - 'frontend/**'

jobs:
  unit-tests:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18.x, 20.x]

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
          cache-dependency-path: 'frontend/package-lock.json'

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Run tests
        run: |
          cd frontend
          npm run test -- --coverage --reporter=verbose

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./frontend/coverage/coverage-final.json
          flags: frontend

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: frontend-coverage
          path: frontend/coverage/

  type-checking:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Type check
        run: |
          cd frontend
          npm run type-check

      - name: Lint
        run: |
          cd frontend
          npm run lint

  e2e-tests:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: Install dependencies
        run: |
          cd frontend
          npm ci
          npx playwright install --with-deps

      - name: Start backend (if needed)
        run: |
          # Start backend service in background
          cd backend
          docker-compose up -d postgres redis

      - name: Run E2E tests
        run: |
          cd frontend
          npm run test:e2e

      - name: Upload E2E results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: playwright-results
          path: frontend/playwright-report/

  accessibility:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20.x
          cache: 'npm'

      - name: Install dependencies
        run: |
          cd frontend
          npm ci

      - name: Run a11y tests
        run: |
          cd frontend
          npm run test -- --grep "a11y|accessibility"
```

---

## PART 3: CROSS-TEAM CI/CD

#### Master Workflow

**Создать:** `.github/workflows/quality-gates.yml`

```yaml
name: Quality Gates

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main, develop ]

jobs:
  # Run after all tests pass
  quality-report:
    needs: [backend-tests, frontend-tests]
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Generate combined report
        run: |
          # Generate quality dashboard
          mkdir -p quality-report
          echo "# Quality Report" > quality-report/index.md
          # Add coverage stats
          # Add code quality metrics

      - name: Publish report
        uses: actions/upload-artifact@v3
        with:
          name: quality-report
          path: quality-report/

  # Enforce quality gates
  quality-check:
    runs-on: ubuntu-latest

    steps:
      - name: Check coverage thresholds
        run: |
          if [ $(backend_coverage) -lt 70 ]; then
            echo "Backend coverage below 70%"
            exit 1
          fi
          if [ $(frontend_coverage) -lt 70 ]; then
            echo "Frontend coverage below 70%"
            exit 1
          fi

      - name: Check for security issues
        run: |
          # Check for known vulnerabilities
          npm audit --audit-level=moderate
          pip audit --desc
```

---

## PART 4: MONITORING & REPORTING

### Coverage Tracking

**Рекомендация:** Использовать Codecov

```yaml
# Integration уже в GitHub Actions выше
uses: codecov/codecov-action@v3
```

**Benefits:**
- Historical tracking
- PR comments
- Trend analysis
- Badge for README

---

### Performance Monitoring

**Рекомендация:** Использовать pytest-benchmark history

```bash
# Store baseline
pytest tests/performance/ --benchmark-save=baseline

# Compare against baseline
pytest tests/performance/ --benchmark-compare=baseline
```

---

### Security Scanning

**Backend:**
```bash
# Install bandit
pip install bandit

# Scan
bandit -r app/ -ll --json -o bandit-report.json
```

**Frontend:**
```bash
# Install npm audit
npm audit --audit-level=moderate

# Generate report
npm audit --json > audit-report.json
```

---

## PART 5: TROUBLESHOOTING COMMON ISSUES

### Issue 1: Tests Too Slow

**Symptoms:** Tests take >30 seconds

**Solutions:**
1. Use `pytest-xdist` for parallel execution
   ```bash
   pip install pytest-xdist
   pytest -n auto  # Use all CPU cores
   ```

2. Mark slow tests:
   ```python
   @pytest.mark.slow
   async def test_expensive_operation():
       pass

   # Run without slow tests
   pytest -m "not slow"
   ```

3. Use `@pytest.mark.asyncio` instead of `async def test_`

---

### Issue 2: Flaky Tests (Intermittent Failures)

**Common Causes:**
- Timing issues (use waitFor instead of sleep)
- Database state (use proper cleanup fixtures)
- External API calls (mock them!)

**Solution Example:**
```python
# ❌ BAD
def test_something():
    time.sleep(1)  # Flaky!
    assert condition

# ✅ GOOD
@pytest.mark.asyncio
async def test_something():
    await asyncio.wait_for(
        wait_for_condition(condition),
        timeout=5.0
    )
```

---

### Issue 3: Coverage Not Increasing

**Check:**
1. Are tests actually running?
   ```bash
   pytest --cov=app -v  # Verbose output
   ```

2. Are new files being covered?
   ```bash
   pytest --cov=app --cov-report=term-missing  # Show which lines missed
   ```

3. Need to test more edge cases?
   - Missing error paths
   - Missing parameter combinations
   - Missing boundary conditions

---

## PART 6: TESTING BEST PRACTICES CHECKLIST

### Backend Tests

- [ ] Use AAA pattern (Arrange-Act-Assert)
- [ ] Name tests descriptively: `test_<feature>_<scenario>_<expected>`
- [ ] Use fixtures for reusable setup
- [ ] Mock external dependencies
- [ ] Test error cases, not just happy path
- [ ] Use parametrized tests for multiple scenarios
- [ ] Add docstrings explaining test purpose
- [ ] Keep tests independent (no test order dependency)
- [ ] Use async/await properly with pytest-asyncio
- [ ] Clean up database after each test

### Frontend Tests

- [ ] Use Testing Library best practices
- [ ] Query by accessible roles, not test IDs
- [ ] Mock API responses with MSW
- [ ] Test user interactions, not implementation
- [ ] Include a11y tests
- [ ] Test error states
- [ ] Use waitFor for async operations
- [ ] Don't test third-party libraries
- [ ] Mock heavy dependencies
- [ ] Keep component tests focused

### Integration Tests

- [ ] Test complete user flows
- [ ] Use realistic test data
- [ ] Clean up database state
- [ ] Test error recovery
- [ ] Test concurrent access
- [ ] Measure performance
- [ ] Document expected behavior

---

## SUMMARY OF RECOMMENDATIONS

### Immediate (This Week)

1. ✅ Install required packages
2. ✅ Set up GitHub Actions workflows
3. ✅ Install and configure MSW for frontend
4. ✅ Create test utilities
5. ✅ Update coverage thresholds to 70%

**Estimated effort:** 1-2 days
**Cost:** $0 (all tools free for open source)

### Short-term (Next 2 weeks)

1. ✅ Add pytest-benchmark for performance tests
2. ✅ Add pytest-factoryboy for test data
3. ✅ Set up accessibility testing
4. ✅ Configure codecov
5. ✅ Add security scanning

**Estimated effort:** 2-3 days
**Cost:** $0 (codecov is free for public repos)

### Medium-term (Next Month)

1. ✅ Add property-based testing (hypothesis)
2. ✅ Set up visual regression testing
3. ✅ Implement performance dashboards
4. ✅ Document testing procedures
5. ✅ Create test templates

**Estimated effort:** 3-5 days
**Cost:** $0

### Nice-to-have (Future)

- Mutation testing (detecting test quality)
- Chaos engineering (fault injection)
- Load testing infrastructure
- Test analytics dashboard

---

## ESTIMATED COSTS

```
Setup Cost (One-time):
- Tools installation: $0
- CI/CD configuration: $0
- Team training: 2-4 hours

Monthly Cost:
- Codecov free tier: $0
- GitHub Actions: Free for public/org
- Cloud testing services: $0-500 (optional)

Total for first month: $0-500
Total annual: $0-6000 (only if upgrading premium tiers)
```

---

## TOOLS SUMMARY TABLE

| Tool | Purpose | Cost | Status |
|------|---------|------|--------|
| pytest | Unit testing | Free | ✅ Installed |
| vitest | Frontend unit testing | Free | ✅ Installed |
| pytest-asyncio | Async testing | Free | ✅ Installed |
| pytest-cov | Coverage reporting | Free | ✅ Installed |
| pytest-benchmark | Performance testing | Free | ⚠️ Recommended |
| pytest-factoryboy | Test data | Free | ⚠️ Recommended |
| MSW | API mocking | Free | ⚠️ CRITICAL |
| jest-axe | A11y testing | Free | ⚠️ Recommended |
| GitHub Actions | CI/CD | Free | ✅ In use |
| Codecov | Coverage tracking | Free | ⚠️ Recommended |
| Playwright | E2E testing | Free | ⚠️ In use |
| Hypothesis | Property testing | Free | ⚠️ Recommended |
| Bandit | Security scanning | Free | ⚠️ Recommended |

---

**Report Generated:** 2025-11-18
**Status:** READY FOR IMPLEMENTATION
