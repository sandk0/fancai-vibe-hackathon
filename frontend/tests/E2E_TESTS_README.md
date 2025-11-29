# E2E Tests Documentation

## Обзор

End-to-End (E2E) тесты для BookReader AI, написанные на **Playwright**. Тесты покрывают критические пути пользователя:
- Аутентификация и управление сессией
- Полный цикл чтения (загрузка → парсинг → чтение → сохранение)
- Генерация и просмотр изображений
- Интеграционные сценарии и performance

## Структура файлов

### Test Specs (106 total)

**Week 4 (новые - 37 тестов):**
- `reading-flow.spec.ts` (12) - загрузка, чтение, сохранение прогресса
- `auth-journey.spec.ts` (12) - регистрация, логин, защита маршрутов
- `image-generation.spec.ts` (8) - генерация и галерея изображений
- `integration-scenarios.spec.ts` (5) - полные workflow, performance, accessibility

**Existing (69 тестов):**
- `auth.spec.ts` (11) - аутентификация
- `books.spec.ts` (16) - управление книгами
- `reader.spec.ts` (42) - опыт чтения

### Page Object Models (POM)

Все UI взаимодействия абстрагированы в page objects:
- `pages/BasePage.ts` - базовый класс с утилитами
- `pages/LoginPage.ts` - логин форма
- `pages/RegisterPage.ts` - регистрация
- `pages/LibraryPage.ts` - библиотека книг
- `pages/ReaderPage.ts` - читалка

### Test Fixtures

Стандартные тестовые данные:
- `fixtures/test-users.ts` - тестовые пользователи
- `fixtures/test-books.ts` - тестовые книги
- `fixtures/files/` - EPUB/FB2 тестовые файлы

### Helpers

Вспомогательные функции:
- `helpers/auth.helper.ts` - helpers для аутентификации
- `helpers/book.helper.ts` - helpers для работы с книгами
- `helpers/reader.helper.ts` - helpers для читалки

## Запуск тестов

### Quick Start

```bash
# Все E2E тесты (Chromium)
npm run test:e2e

# Interactive UI mode (рекомендуется для разработки)
npm run test:e2e:ui

# Debug mode (пошаговый запуск)
npm run test:e2e:debug

# Headed mode (видно браузер)
npm run test:e2e:headed
```

### Specific Browsers

```bash
npm run test:e2e:chromium  # Chrome, Edge, Brave
npm run test:e2e:firefox   # Firefox
npm run test:e2e:webkit    # Safari
```

### Specific Test File

```bash
# Run только reading flow tests
npx playwright test reading-flow

# Run только auth tests
npx playwright test auth-journey

# Run с паттерном
npx playwright test --grep "should upload EPUB"
```

### Specific Test

```bash
# Debug конкретный тест
npx playwright test reading-flow.spec.ts -g "should upload EPUB" --debug

# Run один раз
npx playwright test reading-flow.spec.ts:28
```

## Конфигурация

### playwright.config.ts

```typescript
// Основные параметры:
- testDir: './tests'
- timeout: 60000 (60 sec на тест)
- actionTimeout: 10000 (10 sec на действие)
- navigationTimeout: 30000 (30 sec на переход)

// Браузеры:
- Chromium (Desktop 1280x720)
- Firefox (Desktop 1280x720)
- WebKit (Desktop 1280x720)
- Mobile Chrome (Pixel 5)
- Mobile Safari (iPhone 12)

// Артефакты:
- screenshot: 'only-on-failure'
- video: 'retain-on-failure'
- trace: 'on-first-retry'
```

## Примеры

### Example 1: Simple Login Test

```typescript
test('should successfully login', async ({ page }) => {
  const loginPage = new LoginPage(page);

  // Navigate and login
  await loginPage.navigate();
  await loginPage.login('test@example.com', 'password123');

  // Verify redirect
  await page.waitForURL('/library', { timeout: 10000 });
  expect(page.url()).toContain('/library');
});
```

### Example 2: Reading Flow Test

```typescript
test('should read book and save progress', async ({ page }) => {
  const libraryPage = new LibraryPage(page);
  const readerPage = new ReaderPage(page);

  // Setup: login (done in beforeEach)
  await libraryPage.waitForBooksToLoad();

  // Action: open book
  const firstBook = page.locator('[data-testid^="book-card-"]').first();
  const bookId = await firstBook.getAttribute('data-testid');
  await libraryPage.openBook(bookId);

  // Verify: reader loaded
  await readerPage.waitForReaderToLoad();
  expect(await readerPage.isReaderLoaded()).toBe(true);

  // Action: navigate pages
  const initialPage = await readerPage.getCurrentPage();
  await readerPage.nextPage();
  const newPage = await readerPage.getCurrentPage();

  // Verify: progress increased
  expect(newPage).toBeGreaterThan(initialPage);
});
```

### Example 3: Image Generation Test

```typescript
test('should generate image from description', async ({ page }) => {
  const readerPage = new ReaderPage(page);

  // Wait for content
  await page.waitForSelector('[data-testid="epub-reader"]');

  // Find and click description
  const highlight = page.locator('.description-highlight').first();
  await highlight.click();

  // Click generate
  const generateBtn = page.locator('button:has-text("Generate")').first();
  await generateBtn.click();

  // Wait for completion
  const image = page.locator('[data-testid="generated-image"]');
  await expect(image).toBeVisible({ timeout: 35000 });
});
```

## Best Practices

### 1. Use Page Object Model

```typescript
// ✅ GOOD
const loginPage = new LoginPage(page);
await loginPage.login(email, password);

// ❌ BAD
await page.fill('[data-testid="email"]', email);
await page.fill('[data-testid="password"]', password);
```

### 2. Reasonable Waits

```typescript
// ✅ GOOD - waits for specific element
await page.waitForSelector('[data-testid="book-card"]', { timeout: 5000 });

// ❌ BAD - arbitrary wait
await page.waitForTimeout(5000);
```

### 3. Test Isolation

```typescript
// ✅ GOOD - each test is independent
test('test 1', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(...);
});

// ❌ BAD - tests depend on each other
test.only('test that depends on other tests', ...);
```

### 4. Descriptive Test Names

```typescript
// ✅ GOOD
test('should save reading progress automatically when navigating pages', ...)

// ❌ BAD
test('test reading', ...)
```

### 5. Error Handling

```typescript
// ✅ GOOD - catches errors gracefully
const hasError = await page.isVisible('[data-testid="error"]', { timeout: 2000 })
  .catch(() => false);

// ❌ BAD - fails on error
await expect(page.locator('[data-testid="error"]')).toBeVisible();
```

## Debugging

### Enable Debug Mode

```bash
PWDEBUG=1 npm run test:e2e

# or use CLI
npm run test:e2e:debug
```

### Debug Single Test

```bash
npm run test:e2e:debug -- reading-flow.spec.ts -g "should upload"
```

### Slow Motion

```bash
npx playwright test --workers=1 --headed --slow-mo=1000
```

### Inspector

```bash
npm run test:e2e:debug
# Use Playwright Inspector panel to step through
```

## CI/CD Integration

Tests are designed to run in CI/CD:

```yaml
# .github/workflows/e2e.yml
- name: Run E2E tests
  run: npm run test:e2e -- --workers=1

- name: Upload report
  uses: actions/upload-artifact@v3
  if: always()
  with:
    name: playwright-report
    path: playwright-report/
```

## Troubleshooting

### Tests Timeout

**Symptom:** "Timeout waiting for selector"

**Solutions:**
1. Increase timeout: `{ timeout: 30000 }`
2. Wait for specific condition: `page.waitForURL(...)`
3. Check if element exists: `isVisible()` with fallback

### Flaky Tests

**Symptom:** Tests pass sometimes, fail sometimes

**Solutions:**
1. Remove arbitrary `waitForTimeout()`
2. Use proper waits: `waitForSelector`, `waitForURL`
3. Increase timeout for slow operations
4. Check for race conditions

### Mobile Tests Fail

**Symptom:** Tests fail on mobile viewport

**Solutions:**
1. Use `{ mobile: true }` context option
2. Adjust selectors for mobile UI
3. Use `page.viewport()` to set size explicitly
4. Test on `Pixel 5` or `iPhone 12` directly

### Authentication Issues

**Symptom:** Tests always redirect to login

**Solutions:**
1. Verify test user exists in DB
2. Check credentials in `fixtures/test-users.ts`
3. Verify API endpoint for login
4. Check token storage (localStorage vs sessionStorage)

## Performance Targets

**Page Load Times:**
- Login page: <3 seconds
- Library load: <5 seconds
- Reader open: <4 seconds
- Overall test: <60 seconds

**Quality Metrics:**
- Test pass rate: 100%
- Coverage: All critical paths
- Flakiness: <5%

## Contributing

### Adding New Test

1. Create test in appropriate spec file:
   - `reading-flow.spec.ts` - reading scenarios
   - `auth-journey.spec.ts` - authentication
   - `image-generation.spec.ts` - images
   - `integration-scenarios.spec.ts` - full workflows

2. Follow naming convention:
   ```typescript
   test.describe('Feature Name', () => {
     test('should do something specific', async ({ page }) => {
       // Arrange
       // Act
       // Assert
     });
   });
   ```

3. Use Page Object Models for UI interactions

4. Add meaningful assertions

5. Handle both success and failure cases

### Running Tests Locally Before Commit

```bash
# Run all tests
npm run test:e2e

# Or specific suite
npm run test:e2e -- reading-flow

# Check report
npm run test:e2e:report
```

## Resources

- [Playwright Documentation](https://playwright.dev)
- [Best Practices](https://playwright.dev/docs/best-practices)
- [Debugging Guide](https://playwright.dev/docs/debug)
- [CI/CD Integration](https://playwright.dev/docs/ci)

## Contact

For issues or questions about E2E tests, contact the Testing & QA Specialist agent.

---

**Last Updated:** 2025-11-29
**Total Tests:** 106 (37 new in Week 4)
**Status:** Ready for execution
