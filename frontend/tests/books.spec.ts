/**
 * Book Management E2E Tests
 *
 * Tests cover:
 * 1. Upload EPUB file
 * 2. Upload FB2 file
 * 3. View books library
 * 4. Delete book
 * 5. Book parsing progress
 * 6. Book metadata display
 * 7. Book search/filter
 * 8. Book pagination
 */

import { test, expect } from '@playwright/test';
import { LoginPage, LibraryPage } from './pages';
import { testUsers } from './fixtures';
import path from 'path';

// Setup: Login before each test
test.beforeEach(async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(testUsers.regular.email, testUsers.regular.password);
  await page.waitForURL('/library', { timeout: 10000 });
});

test.describe('Book Management', () => {
  test.describe('Book Upload', () => {
    test('should successfully upload EPUB file', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      // Get initial book count
      await libraryPage.waitForBooksToLoad();
      const initialCount = await libraryPage.getBookCount();

      // Upload EPUB file
      const epubPath = path.join(process.cwd(), 'tests/fixtures/files/sample.epub');
      await libraryPage.uploadBook(epubPath);

      // Verify book was added
      const newCount = await libraryPage.getBookCount();
      expect(newCount).toBe(initialCount + 1);

      // Verify upload success message or indicator
      const hasSuccessIndicator = await page.isVisible('[data-testid="upload-success"]');
      expect(hasSuccessIndicator).toBe(true);
    });

    test('should successfully upload FB2 file', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await libraryPage.waitForBooksToLoad();
      const initialCount = await libraryPage.getBookCount();

      // Upload FB2 file
      const fb2Path = path.join(process.cwd(), 'tests/fixtures/files/sample.fb2');
      await libraryPage.uploadBook(fb2Path);

      // Verify book was added
      const newCount = await libraryPage.getBookCount();
      expect(newCount).toBe(initialCount + 1);
    });

    test('should show error for invalid file type', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      // Try to upload invalid file (e.g., .txt)
      await page.click('[data-testid="upload-book-button"]');

      const fileInput = await page.locator('input[type="file"]');
      const invalidFilePath = path.join(process.cwd(), 'tests/fixtures/files/invalid.txt');

      await fileInput.setInputFiles(invalidFilePath);

      // Verify error message
      const errorMessage = await page.waitForSelector('[data-testid="upload-error"]', {
        timeout: 5000
      });
      expect(errorMessage).toBeTruthy();

      const errorText = await errorMessage.textContent();
      expect(errorText).toContain('формат' || 'format');
    });

    test('should show progress indicator during upload', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await page.click('[data-testid="upload-book-button"]');

      const fileInput = await page.locator('input[type="file"]');
      const epubPath = path.join(process.cwd(), 'tests/fixtures/files/sample.epub');

      // Start upload
      await fileInput.setInputFiles(epubPath);

      // Verify progress indicator appears
      const progressVisible = await page.isVisible('[data-testid="upload-progress"]');
      expect(progressVisible).toBe(true);

      // Wait for upload to complete
      await page.waitForSelector('[data-testid="upload-progress"]', {
        state: 'hidden',
        timeout: 30000
      });
    });
  });

  test.describe('Library View', () => {
    test('should display all user books in library', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await libraryPage.navigate();
      await libraryPage.waitForBooksToLoad();

      // Check if books are displayed
      const bookCount = await libraryPage.getBookCount();
      expect(bookCount).toBeGreaterThanOrEqual(0);

      // If there are books, verify they have required elements
      if (bookCount > 0) {
        const firstBook = page.locator('[data-testid^="book-card-"]').first();
        await expect(firstBook).toBeVisible();

        // Verify book card has title, author, cover
        const hasTitle = await firstBook.locator('[data-testid="book-title"]').isVisible();
        const hasAuthor = await firstBook.locator('[data-testid="book-author"]').isVisible();

        expect(hasTitle).toBe(true);
        expect(hasAuthor).toBe(true);
      }
    });

    test('should show empty state when library is empty', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      // This test assumes a fresh user or cleared library
      await libraryPage.navigate();
      await libraryPage.waitForBooksToLoad();

      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        const isEmpty = await libraryPage.isEmpty();
        expect(isEmpty).toBe(true);

        // Verify empty state message
        const emptyMessage = await page.textContent('[data-testid="library-empty-state"]');
        expect(emptyMessage).toContain('книг' || 'пусто' || 'empty');
      }
    });
  });

  test.describe('Book Deletion', () => {
    test('should successfully delete a book', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await libraryPage.waitForBooksToLoad();
      const initialCount = await libraryPage.getBookCount();

      // Skip if no books
      if (initialCount === 0) {
        test.skip();
      }

      // Get first book ID
      const firstBookCard = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBookCard.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      // Delete the book
      await libraryPage.deleteBook(extractedId);

      // Verify book was deleted
      const newCount = await libraryPage.getBookCount();
      expect(newCount).toBe(initialCount - 1);
    });

    test('should show confirmation dialog before deleting', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Get first book ID
      const firstBookCard = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBookCard.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      // Open book menu
      await page.click(`[data-testid="book-menu-${extractedId}"]`);
      await page.click(`[data-testid="delete-book-${extractedId}"]`);

      // Verify confirmation dialog
      const confirmDialog = await page.isVisible('[data-testid="confirm-delete"]');
      expect(confirmDialog).toBe(true);

      // Cancel deletion
      await page.click('[data-testid="cancel-delete"]');

      // Verify book still exists
      const bookExists = await libraryPage.bookExists(extractedId);
      expect(bookExists).toBe(true);
    });
  });

  test.describe('Book Parsing', () => {
    test('should display parsing progress for uploaded book', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      // Upload a book
      const epubPath = path.join(process.cwd(), 'tests/fixtures/files/sample.epub');
      await libraryPage.uploadBook(epubPath);

      // Get the newly uploaded book
      const books = await page.locator('[data-testid^="book-card-"]');
      const lastBook = books.last();
      const bookId = await lastBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      // Check for parsing indicator
      const parsingIndicator = await page.isVisible(
        `[data-testid="parsing-progress-${extractedId}"]`
      );

      // Either parsing is in progress or already completed
      if (parsingIndicator) {
        const progress = await libraryPage.getParsingProgress(extractedId);
        expect(progress).toBeGreaterThanOrEqual(0);
        expect(progress).toBeLessThanOrEqual(100);
      }
    });

    test('should mark book as parsed when parsing completes', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Get a book
      const firstBookCard = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBookCard.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      // Wait for parsing to complete (with timeout)
      const parsingStatus = await page.waitForSelector(
        `[data-testid="book-${extractedId}"][data-parsing-status="completed"]`,
        { timeout: 60000 }
      );

      expect(parsingStatus).toBeTruthy();
    });
  });

  test.describe('Book Search and Filter', () => {
    test('should search books by title', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await libraryPage.waitForBooksToLoad();
      const initialCount = await libraryPage.getBookCount();

      if (initialCount === 0) {
        test.skip();
      }

      // Get first book title
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const titleElement = firstBook.locator('[data-testid="book-title"]');
      const title = await titleElement.textContent();

      if (!title) {
        test.skip();
      }

      // Search for the title
      await libraryPage.search(title);

      // Verify search results
      const resultsCount = await libraryPage.getBookCount();
      expect(resultsCount).toBeGreaterThanOrEqual(1);

      // Verify first result matches search
      const firstResult = page.locator('[data-testid^="book-card-"]').first();
      const resultTitle = await firstResult.locator('[data-testid="book-title"]').textContent();
      expect(resultTitle).toContain(title);
    });

    test('should filter books by genre', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await libraryPage.waitForBooksToLoad();
      const initialCount = await libraryPage.getBookCount();

      if (initialCount === 0) {
        test.skip();
      }

      // Filter by a genre (e.g., fiction)
      await libraryPage.filterByGenre('fiction');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Verify filtered results
      const filteredCount = await libraryPage.getBookCount();

      // All visible books should match the filter
      const books = await page.locator('[data-testid^="book-card-"]');
      const count = await books.count();

      expect(count).toBeLessThanOrEqual(initialCount);
    });

    test('should show no results for non-existent search', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await libraryPage.waitForBooksToLoad();

      // Search for non-existent title
      await libraryPage.search('NonExistentBookTitle12345');

      // Verify no results
      await page.waitForTimeout(500);
      const resultsCount = await libraryPage.getBookCount();
      expect(resultsCount).toBe(0);

      // Verify empty state or no results message
      const noResults = await page.isVisible('[data-testid="no-search-results"]');
      expect(noResults).toBe(true);
    });
  });

  test.describe('Book Metadata', () => {
    test('should display book metadata correctly', async ({ page }) => {
      const libraryPage = new LibraryPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Click on first book to view details
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      // Open book details or info modal
      await page.click(`[data-testid="book-info-${extractedId}"]`);

      // Verify metadata is displayed
      const metadataModal = await page.isVisible('[data-testid="book-metadata-modal"]');
      expect(metadataModal).toBe(true);

      // Verify required metadata fields
      const hasTitle = await page.isVisible('[data-testid="metadata-title"]');
      const hasAuthor = await page.isVisible('[data-testid="metadata-author"]');
      const hasGenre = await page.isVisible('[data-testid="metadata-genre"]');

      expect(hasTitle).toBe(true);
      expect(hasAuthor).toBe(true);
      expect(hasGenre).toBe(true);
    });
  });
});
