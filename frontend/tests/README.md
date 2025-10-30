# E2E Testing with Playwright

Complete end-to-end testing infrastructure for BookReader AI.

## Quick Start

### 1. Install Dependencies

```bash
npm install
npx playwright install
```

### 2. Set Up Test Fixtures

Add sample files to `tests/fixtures/files/`:
- `sample.epub` - Small EPUB file (<500KB)
- `sample.fb2` - Small FB2 file (<500KB)
- `large-sample.epub` - Larger EPUB (2-5MB)
- `invalid.txt` - Any text file

See `tests/fixtures/files/README.md` for details.

### 3. Run Tests

```bash
# Run all tests
npm run test:e2e

# Run with UI mode (recommended for development)
npm run test:e2e:ui

# Run in debug mode
npm run test:e2e:debug

# Run with browser visible
npm run test:e2e:headed
```

## Test Structure

```
tests/
├── fixtures/          # Test data
├── helpers/           # Helper functions
├── pages/             # Page Object Models
├── auth.spec.ts       # Authentication tests
├── books.spec.ts      # Book management tests
└── reader.spec.ts     # Reading experience tests
```

## Writing Tests

### Basic Test

```typescript
import { test, expect } from '@playwright/test';
import { LoginPage } from './pages';

test('my test', async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.navigate();
  await loginPage.login('email@test.com', 'password');

  expect(page.url()).toContain('/library');
});
```

### Using Helpers

```typescript
import { login } from './helpers';
import { testUsers } from './fixtures';

test('my test', async ({ page }) => {
  await login(page, testUsers.regular);
  // User is now logged in
});
```

### Using Page Objects

```typescript
import { LibraryPage, ReaderPage } from './pages';

test('my test', async ({ page }) => {
  const library = new LibraryPage(page);
  const reader = new ReaderPage(page);

  await library.navigate();
  await library.openBook('book-id');
  await reader.waitForReaderToLoad();
});
```

## Available Scripts

```bash
# Run tests
npm run test:e2e              # All tests
npm run test:e2e:ui           # UI mode
npm run test:e2e:debug        # Debug mode
npm run test:e2e:headed       # Show browser

# Specific browsers
npm run test:e2e:chromium     # Chrome only
npm run test:e2e:firefox      # Firefox only
npm run test:e2e:webkit       # Safari only

# Reports
npm run test:e2e:report       # View HTML report
```

## Test Categories

### Authentication Tests (12 tests)
- User registration
- Login/logout
- Token management
- Protected routes

### Book Management Tests (15 tests)
- Upload EPUB/FB2
- View library
- Delete books
- Search/filter
- Parsing progress

### Reading Experience Tests (20 tests)
- Open reader
- Page navigation
- Table of contents
- Bookmarks
- Highlights
- Theme switching
- Font adjustment
- Progress tracking

## Debugging

### View Test Report

```bash
npm run test:e2e:report
```

### Debug Specific Test

```bash
npx playwright test --debug auth.spec.ts
```

### View Trace

```bash
npx playwright show-trace test-results/.../trace.zip
```

### Pause Test Execution

```typescript
test('my test', async ({ page }) => {
  await page.goto('/');
  await page.pause(); // Pauses here
});
```

## CI/CD

Tests run automatically on:
- Push to `main` or `develop`
- Pull requests to `main`

View results in GitHub Actions under "E2E Tests (Playwright)".

## Troubleshooting

### Tests failing locally?

1. **Check backend is running:**
   ```bash
   # Backend should be on http://localhost:8000
   ```

2. **Check frontend dev server:**
   ```bash
   # Should be on http://localhost:5173
   npm run dev
   ```

3. **Check test fixtures:**
   ```bash
   ls tests/fixtures/files/
   # Should have sample.epub, sample.fb2, etc.
   ```

4. **Clear test results:**
   ```bash
   rm -rf test-results/ playwright-report/
   ```

### Flaky tests?

- Increase timeouts in `playwright.config.ts`
- Add more specific wait conditions
- Check for race conditions

### Can't see what's happening?

```bash
npm run test:e2e:headed
# Or
npm run test:e2e:debug
```

## Best Practices

1. **Use data-testid selectors**
   ```typescript
   await page.click('[data-testid="login-button"]');
   ```

2. **Wait for elements properly**
   ```typescript
   await page.waitForSelector('[data-testid="element"]');
   ```

3. **Use Page Object Models**
   ```typescript
   const loginPage = new LoginPage(page);
   await loginPage.login(email, password);
   ```

4. **Clean up after tests**
   ```typescript
   test.afterEach(async ({ page }) => {
     // Clean up
   });
   ```

5. **Use fixtures for test data**
   ```typescript
   import { testUsers } from './fixtures';
   await login(page, testUsers.regular);
   ```

## Resources

- [Playwright Docs](https://playwright.dev/)
- [E2E Testing Report](../E2E_TESTING_REPORT.md)
- [Project CLAUDE.md](../../CLAUDE.md)

## Support

For issues or questions:
1. Check `E2E_TESTING_REPORT.md` for detailed docs
2. Review test examples in `tests/`
3. Check Playwright documentation
4. Ask in project chat/issues

---

**Last Updated:** October 30, 2025
