/**
 * Reader Page Object Model
 */

import { Page } from '@playwright/test';
import { BasePage } from './BasePage';

export class ReaderPage extends BasePage {
  // Selectors
  private readonly readerContainer = '[data-testid="epub-reader"]';
  private readonly nextButton = '[data-testid="reader-next-page"]';
  private readonly prevButton = '[data-testid="reader-prev-page"]';
  private readonly tocButton = '[data-testid="reader-toc-button"]';
  private readonly tocSidebar = '[data-testid="toc-sidebar"]';
  private readonly settingsButton = '[data-testid="reader-settings-button"]';
  private readonly bookmarkButton = '[data-testid="reader-bookmark-button"]';
  private readonly closeButton = '[data-testid="reader-close-button"]';
  private readonly pageIndicator = '[data-testid="reader-page-indicator"]';
  private readonly progressBar = '[data-testid="reader-progress-bar"]';
  private readonly selectionMenu = '[data-testid="selection-menu"]';

  constructor(page: Page) {
    super(page);
  }

  /**
   * Navigate to reader for specific book
   */
  async navigate(bookId: string): Promise<void> {
    await this.goto(`/reader/${bookId}`);
  }

  /**
   * Wait for reader to load
   */
  async waitForReaderToLoad(): Promise<void> {
    await this.waitForElement(this.readerContainer, 15000);
  }

  /**
   * Go to next page
   */
  async nextPage(): Promise<void> {
    await this.click(this.nextButton);
    await this.wait(300);
  }

  /**
   * Go to previous page
   */
  async previousPage(): Promise<void> {
    await this.click(this.prevButton);
    await this.wait(300);
  }

  /**
   * Open table of contents
   */
  async openTableOfContents(): Promise<void> {
    await this.click(this.tocButton);
    await this.waitForElement(this.tocSidebar);
  }

  /**
   * Navigate to chapter
   */
  async navigateToChapter(chapterIndex: number): Promise<void> {
    await this.openTableOfContents();
    await this.click(`[data-testid="toc-chapter-${chapterIndex}"]`);
    await this.wait(500);
  }

  /**
   * Create bookmark
   */
  async createBookmark(): Promise<void> {
    await this.click(this.bookmarkButton);
    await this.waitForElement('[data-testid="bookmark-saved-indicator"]');
  }

  /**
   * Open settings
   */
  async openSettings(): Promise<void> {
    await this.click(this.settingsButton);
  }

  /**
   * Change theme
   */
  async changeTheme(theme: 'light' | 'dark' | 'sepia'): Promise<void> {
    await this.openSettings();
    await this.click(`[data-testid="theme-${theme}"]`);
    await this.wait(300);
  }

  /**
   * Change font size
   */
  async changeFontSize(size: 'small' | 'medium' | 'large'): Promise<void> {
    await this.openSettings();
    await this.click(`[data-testid="font-size-${size}"]`);
    await this.wait(300);
  }

  /**
   * Highlight text
   */
  async highlightText(text: string): Promise<void> {
    // Select text
    await this.page.evaluate((textToSelect) => {
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
    await this.waitForElement(this.selectionMenu);
    await this.click('[data-testid="selection-menu-highlight"]');
    await this.wait(500);
  }

  /**
   * Get current page number
   */
  async getCurrentPage(): Promise<number> {
    const text = await this.getText(this.pageIndicator);
    const match = text.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get total pages
   */
  async getTotalPages(): Promise<number> {
    const text = await this.getText(this.pageIndicator);
    const match = text.match(/\/\s*(\d+)/);
    return match ? parseInt(match[1], 10) : 0;
  }

  /**
   * Get reading progress
   */
  async getReadingProgress(): Promise<number> {
    const progressElement = await this.page.locator(this.progressBar);
    const ariaValue = await progressElement.getAttribute('aria-valuenow');
    return ariaValue ? parseInt(ariaValue, 10) : 0;
  }

  /**
   * Close reader
   */
  async closeReader(): Promise<void> {
    await this.click(this.closeButton);
    await this.waitForNavigation('/library');
  }

  /**
   * Check if reader is loaded
   */
  async isReaderLoaded(): Promise<boolean> {
    return await this.isVisible(this.readerContainer);
  }
}
