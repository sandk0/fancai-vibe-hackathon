/**
 * Reader helper utilities for E2E tests
 */

import { Page } from '@playwright/test';

/**
 * Navigate to next page in reader
 */
export async function goToNextPage(page: Page): Promise<void> {
  await page.click('[data-testid="reader-next-page"]');
  await page.waitForTimeout(300); // Wait for page transition
}

/**
 * Navigate to previous page in reader
 */
export async function goToPreviousPage(page: Page): Promise<void> {
  await page.click('[data-testid="reader-prev-page"]');
  await page.waitForTimeout(300);
}

/**
 * Open table of contents
 */
export async function openTableOfContents(page: Page): Promise<void> {
  await page.click('[data-testid="reader-toc-button"]');
  await page.waitForSelector('[data-testid="toc-sidebar"]', { state: 'visible' });
}

/**
 * Navigate to chapter by index
 */
export async function navigateToChapter(page: Page, chapterIndex: number): Promise<void> {
  await openTableOfContents(page);

  await page.click(`[data-testid="toc-chapter-${chapterIndex}"]`);

  // Wait for navigation
  await page.waitForTimeout(500);
}

/**
 * Create a bookmark
 */
export async function createBookmark(page: Page): Promise<void> {
  await page.click('[data-testid="reader-bookmark-button"]');

  // Wait for bookmark to be saved
  await page.waitForSelector('[data-testid="bookmark-saved-indicator"]', {
    state: 'visible',
    timeout: 3000
  });
}

/**
 * Highlight text
 */
export async function highlightText(page: Page, text: string): Promise<void> {
  // Select text
  await page.evaluate((textToSelect) => {
    const range = document.createRange();
    const selection = window.getSelection();

    const textNode = Array.from(document.querySelectorAll('*'))
      .find(el => el.textContent?.includes(textToSelect));

    if (textNode && textNode.firstChild) {
      range.selectNode(textNode.firstChild);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
  }, text);

  // Click highlight button
  await page.click('[data-testid="selection-menu-highlight"]');

  // Wait for highlight to be applied
  await page.waitForTimeout(500);
}

/**
 * Change theme
 */
export async function changeTheme(page: Page, theme: 'light' | 'dark' | 'sepia'): Promise<void> {
  await page.click('[data-testid="reader-settings-button"]');
  await page.click(`[data-testid="theme-${theme}"]`);

  // Wait for theme to apply
  await page.waitForTimeout(300);
}

/**
 * Change font size
 */
export async function changeFontSize(page: Page, size: 'small' | 'medium' | 'large'): Promise<void> {
  await page.click('[data-testid="reader-settings-button"]');
  await page.click(`[data-testid="font-size-${size}"]`);

  // Wait for font size to apply
  await page.waitForTimeout(300);
}

/**
 * Get current page number
 */
export async function getCurrentPage(page: Page): Promise<number> {
  const pageIndicator = await page.locator('[data-testid="reader-page-indicator"]');
  const text = await pageIndicator.textContent();

  if (!text) return 0;

  const match = text.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get total pages
 */
export async function getTotalPages(page: Page): Promise<number> {
  const pageIndicator = await page.locator('[data-testid="reader-page-indicator"]');
  const text = await pageIndicator.textContent();

  if (!text) return 0;

  const match = text.match(/\/\s*(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Get reading progress percentage
 */
export async function getReadingProgress(page: Page): Promise<number> {
  const progressBar = await page.locator('[data-testid="reader-progress-bar"]');
  const ariaValue = await progressBar.getAttribute('aria-valuenow');

  return ariaValue ? parseInt(ariaValue, 10) : 0;
}

/**
 * Check if reader is loaded
 */
export async function isReaderLoaded(page: Page): Promise<boolean> {
  try {
    await page.waitForSelector('[data-testid="epub-reader"]', { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Close reader and return to library
 */
export async function closeReader(page: Page): Promise<void> {
  await page.click('[data-testid="reader-close-button"]');
  await page.waitForURL('/library', { timeout: 5000 });
}
