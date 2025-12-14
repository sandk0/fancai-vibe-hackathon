/**
 * Tests for ChapterCache service
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { chapterCache } from '../chapterCache';
import type { Description, GeneratedImage } from '@/types/api';

describe('ChapterCache', () => {
  const testBookId = 'test-book-123';
  const testChapter = 1;

  const mockDescriptions: Description[] = [
    {
      id: 'desc-1',
      type: 'character',
      content: 'Test character description',
      text: 'Test character description',
      confidence_score: 0.9,
      priority_score: 0.8,
      entities_mentioned: ['hero'],
    },
  ];

  const mockImages: GeneratedImage[] = [
    {
      id: 'img-1',
      image_url: 'https://example.com/image.png',
      service_used: 'pollinations',
      status: 'completed',
      generation_time_seconds: 2.5,
      created_at: new Date().toISOString(),
      is_moderated: false,
      view_count: 0,
      download_count: 0,
      description: {
        id: 'desc-1',
        type: 'character',
        text: 'Test character description',
        content: 'Test character description',
        confidence_score: 0.9,
        priority_score: 0.8,
      },
      chapter: {
        id: 'chapter-1',
        number: 1,
        title: 'Test Chapter',
      },
    },
  ];

  beforeEach(async () => {
    // Clear all cache before each test
    await chapterCache.clearAll();
  });

  afterEach(async () => {
    // Clean up after tests
    await chapterCache.clearAll();
  });

  it('should store and retrieve chapter data', async () => {
    // Store data
    const stored = await chapterCache.set(
      testBookId,
      testChapter,
      mockDescriptions,
      mockImages
    );
    expect(stored).toBe(true);

    // Check if exists
    const exists = await chapterCache.has(testBookId, testChapter);
    expect(exists).toBe(true);

    // Retrieve data
    const cached = await chapterCache.get(testBookId, testChapter);
    expect(cached).not.toBeNull();
    expect(cached?.descriptions).toHaveLength(1);
    expect(cached?.images).toHaveLength(1);
    expect(cached?.descriptions[0].id).toBe('desc-1');
    expect(cached?.images[0].id).toBe('img-1');
  });

  it('should return null for non-existent chapter', async () => {
    const cached = await chapterCache.get('non-existent-book', 999);
    expect(cached).toBeNull();
  });

  it('should delete chapter from cache', async () => {
    // Store data
    await chapterCache.set(testBookId, testChapter, mockDescriptions, mockImages);

    // Verify it exists
    let exists = await chapterCache.has(testBookId, testChapter);
    expect(exists).toBe(true);

    // Delete
    const deleted = await chapterCache.delete(testBookId, testChapter);
    expect(deleted).toBe(true);

    // Verify it's gone
    exists = await chapterCache.has(testBookId, testChapter);
    expect(exists).toBe(false);
  });

  it('should clear all chapters for a book', async () => {
    // Store multiple chapters
    await chapterCache.set(testBookId, 1, mockDescriptions, mockImages);
    await chapterCache.set(testBookId, 2, mockDescriptions, mockImages);
    await chapterCache.set(testBookId, 3, mockDescriptions, mockImages);

    // Verify they exist
    let exists1 = await chapterCache.has(testBookId, 1);
    let exists2 = await chapterCache.has(testBookId, 2);
    expect(exists1).toBe(true);
    expect(exists2).toBe(true);

    // Clear book
    const deletedCount = await chapterCache.clearBook(testBookId);
    expect(deletedCount).toBe(3);

    // Verify they're gone
    exists1 = await chapterCache.has(testBookId, 1);
    exists2 = await chapterCache.has(testBookId, 2);
    expect(exists1).toBe(false);
    expect(exists2).toBe(false);
  });

  it('should get cache statistics', async () => {
    // Store some data
    await chapterCache.set(testBookId, 1, mockDescriptions, mockImages);
    await chapterCache.set(testBookId, 2, mockDescriptions, mockImages);
    await chapterCache.set('another-book', 1, mockDescriptions, mockImages);

    const stats = await chapterCache.getStats();
    expect(stats.totalChapters).toBe(3);
    expect(stats.chaptersByBook[testBookId]).toBe(2);
    expect(stats.chaptersByBook['another-book']).toBe(1);
    expect(stats.oldestCacheDate).not.toBeNull();
    expect(stats.newestCacheDate).not.toBeNull();
  });

  it('should update lastAccessedAt on cache hit', async () => {
    // Store data
    await chapterCache.set(testBookId, testChapter, mockDescriptions, mockImages);

    // Wait a bit
    await new Promise(resolve => setTimeout(resolve, 100));

    // Access the cache
    const cached1 = await chapterCache.get(testBookId, testChapter);
    expect(cached1).not.toBeNull();

    // Access again - this should update lastAccessedAt internally
    // (We can't directly verify this without exposing internal state,
    // but the LRU logic relies on it)
    const cached2 = await chapterCache.get(testBookId, testChapter);
    expect(cached2).not.toBeNull();
  });

  it('should handle cache misses gracefully', async () => {
    const exists = await chapterCache.has('non-existent', 1);
    expect(exists).toBe(false);

    const cached = await chapterCache.get('non-existent', 1);
    expect(cached).toBeNull();
  });

  it('should clear all cache', async () => {
    // Store multiple chapters for multiple books
    await chapterCache.set('book1', 1, mockDescriptions, mockImages);
    await chapterCache.set('book2', 1, mockDescriptions, mockImages);

    // Clear all
    await chapterCache.clearAll();

    // Verify all gone
    const exists1 = await chapterCache.has('book1', 1);
    const exists2 = await chapterCache.has('book2', 1);
    expect(exists1).toBe(false);
    expect(exists2).toBe(false);
  });
});
