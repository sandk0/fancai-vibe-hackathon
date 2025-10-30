/**
 * Reading Experience E2E Tests
 *
 * Tests cover:
 * 1. Open book reader
 * 2. Navigate pages (next/prev)
 * 3. Table of contents navigation
 * 4. Bookmark creation
 * 5. Highlight text
 * 6. Reading progress saving
 * 7. Reading session tracking
 * 8. Theme switching
 * 9. Font size adjustment
 * 10. CFI position tracking
 */

import { test, expect } from '@playwright/test';
import { LoginPage, LibraryPage, ReaderPage } from './pages';
import { testUsers } from './fixtures';

// Setup: Login and ensure we have a book to read
test.beforeEach(async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.navigate();
  await loginPage.login(testUsers.regular.email, testUsers.regular.password);
  await page.waitForURL('/library', { timeout: 10000 });
});

test.describe('Reading Experience', () => {
  test.describe('Book Reader', () => {
    test('should successfully open book reader', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Get first book ID
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      // Open reader
      await libraryPage.openBook(extractedId);

      // Verify reader loaded
      await readerPage.waitForReaderToLoad();
      const isLoaded = await readerPage.isReaderLoaded();
      expect(isLoaded).toBe(true);

      // Verify URL contains reader path
      expect(page.url()).toContain('/reader/');
    });

    test('should display book content in reader', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open first book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Verify content is visible
      const readerContent = page.locator('[data-testid="epub-reader"]');
      const hasText = await readerContent.textContent();
      expect(hasText).toBeTruthy();
      expect(hasText!.length).toBeGreaterThan(0);
    });
  });

  test.describe('Page Navigation', () => {
    test('should navigate to next page', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Get current page
      const initialPage = await readerPage.getCurrentPage();

      // Navigate to next page
      await readerPage.nextPage();

      // Verify page changed
      const newPage = await readerPage.getCurrentPage();
      expect(newPage).toBeGreaterThan(initialPage);
    });

    test('should navigate to previous page', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Go to next page first
      await readerPage.nextPage();
      const currentPage = await readerPage.getCurrentPage();

      // Go back to previous page
      await readerPage.previousPage();

      // Verify page decreased
      const newPage = await readerPage.getCurrentPage();
      expect(newPage).toBeLessThan(currentPage);
    });

    test('should display correct page indicator', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Get page numbers
      const currentPage = await readerPage.getCurrentPage();
      const totalPages = await readerPage.getTotalPages();

      // Verify valid page numbers
      expect(currentPage).toBeGreaterThan(0);
      expect(totalPages).toBeGreaterThan(0);
      expect(currentPage).toBeLessThanOrEqual(totalPages);
    });
  });

  test.describe('Table of Contents', () => {
    test('should open table of contents', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Open TOC
      await readerPage.openTableOfContents();

      // Verify TOC is visible
      const isTocVisible = await page.isVisible('[data-testid="toc-sidebar"]');
      expect(isTocVisible).toBe(true);
    });

    test('should navigate to chapter from TOC', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Navigate to chapter 2
      await readerPage.navigateToChapter(1); // Index 1 = Chapter 2

      // Verify content changed
      await page.waitForTimeout(1000);
      const readerContent = page.locator('[data-testid="epub-reader"]');
      const hasText = await readerContent.textContent();
      expect(hasText).toBeTruthy();
    });
  });

  test.describe('Bookmarks', () => {
    test('should create a bookmark', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Create bookmark
      await readerPage.createBookmark();

      // Verify bookmark was saved
      const bookmarkSaved = await page.isVisible('[data-testid="bookmark-saved-indicator"]');
      expect(bookmarkSaved).toBe(true);
    });

    test('should toggle bookmark button state', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Check initial state
      const bookmarkButton = page.locator('[data-testid="reader-bookmark-button"]');
      const initialState = await bookmarkButton.getAttribute('data-bookmarked');

      // Toggle bookmark
      await readerPage.createBookmark();
      await page.waitForTimeout(500);

      // Verify state changed
      const newState = await bookmarkButton.getAttribute('data-bookmarked');
      expect(newState).not.toBe(initialState);
    });
  });

  test.describe('Text Highlighting', () => {
    test('should highlight selected text', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Highlight some text
      await readerPage.highlightText('text');

      // Verify highlight was created
      const highlightExists = await page.isVisible('.highlight');
      expect(highlightExists).toBe(true);
    });

    test('should show selection menu on text selection', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Select text (simulate)
      await page.evaluate(() => {
        const range = document.createRange();
        const selection = window.getSelection();
        const textNode = document.querySelector('p');

        if (textNode && textNode.firstChild) {
          range.selectNode(textNode.firstChild);
          selection?.removeAllRanges();
          selection?.addRange(range);
        }
      });

      // Verify selection menu appears
      await page.waitForTimeout(300);
      const menuVisible = await page.isVisible('[data-testid="selection-menu"]');
      expect(menuVisible).toBe(true);
    });
  });

  test.describe('Reading Progress', () => {
    test('should save reading progress', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Navigate a few pages
      await readerPage.nextPage();
      await readerPage.nextPage();
      await page.waitForTimeout(1000); // Allow progress to save

      // Close and reopen book
      await readerPage.closeReader();
      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Verify progress was restored
      const currentPage = await readerPage.getCurrentPage();
      expect(currentPage).toBeGreaterThan(1);
    });

    test('should display reading progress percentage', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Get reading progress
      const progress = await readerPage.getReadingProgress();

      // Verify progress is valid percentage
      expect(progress).toBeGreaterThanOrEqual(0);
      expect(progress).toBeLessThanOrEqual(100);
    });
  });

  test.describe('Theme Switching', () => {
    test('should switch to dark theme', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Switch to dark theme
      await readerPage.changeTheme('dark');

      // Verify theme changed
      const readerContainer = page.locator('[data-testid="epub-reader"]');
      const theme = await readerContainer.getAttribute('data-theme');
      expect(theme).toBe('dark');
    });

    test('should switch to light theme', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Switch to light theme
      await readerPage.changeTheme('light');

      // Verify theme changed
      const readerContainer = page.locator('[data-testid="epub-reader"]');
      const theme = await readerContainer.getAttribute('data-theme');
      expect(theme).toBe('light');
    });

    test('should persist theme preference', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Set dark theme
      await readerPage.changeTheme('dark');
      await page.waitForTimeout(500);

      // Close and reopen reader
      await readerPage.closeReader();
      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Verify theme persisted
      const readerContainer = page.locator('[data-testid="epub-reader"]');
      const theme = await readerContainer.getAttribute('data-theme');
      expect(theme).toBe('dark');
    });
  });

  test.describe('Font Size Adjustment', () => {
    test('should increase font size', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Change to large font
      await readerPage.changeFontSize('large');

      // Verify font size changed
      const readerContainer = page.locator('[data-testid="epub-reader"]');
      const fontSize = await readerContainer.getAttribute('data-font-size');
      expect(fontSize).toBe('large');
    });

    test('should decrease font size', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Change to small font
      await readerPage.changeFontSize('small');

      // Verify font size changed
      const readerContainer = page.locator('[data-testid="epub-reader"]');
      const fontSize = await readerContainer.getAttribute('data-font-size');
      expect(fontSize).toBe('small');
    });
  });

  test.describe('CFI Position Tracking', () => {
    test('should track reading position with CFI', async ({ page }) => {
      const libraryPage = new LibraryPage(page);
      const readerPage = new ReaderPage(page);

      await libraryPage.waitForBooksToLoad();
      const bookCount = await libraryPage.getBookCount();

      if (bookCount === 0) {
        test.skip();
      }

      // Open book
      const firstBook = page.locator('[data-testid^="book-card-"]').first();
      const bookId = await firstBook.getAttribute('data-testid');
      const extractedId = bookId?.replace('book-card-', '') || '';

      await libraryPage.openBook(extractedId);
      await readerPage.waitForReaderToLoad();

      // Navigate to a specific page
      await readerPage.nextPage();
      await readerPage.nextPage();
      await page.waitForTimeout(1000);

      // Check if CFI was saved (via API or local storage)
      const cfi = await page.evaluate(() => localStorage.getItem('last_cfi'));
      expect(cfi).toBeTruthy();
    });
  });
});
