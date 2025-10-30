/**
 * Test book fixtures and sample data for E2E testing
 */

export interface TestBook {
  title: string;
  author: string;
  genre?: string;
  filePath?: string;
}

/**
 * Sample book data for testing
 */
export const testBooks = {
  sampleEpub: {
    title: 'Test EPUB Book',
    author: 'Test Author',
    genre: 'fiction',
    filePath: 'tests/fixtures/files/sample.epub',
  } as TestBook,

  sampleFb2: {
    title: 'Test FB2 Book',
    author: 'Test Author',
    genre: 'science_fiction',
    filePath: 'tests/fixtures/files/sample.fb2',
  } as TestBook,

  largeBook: {
    title: 'Large Test Book',
    author: 'Test Author',
    genre: 'fantasy',
    filePath: 'tests/fixtures/files/large-sample.epub',
  } as TestBook,
};

/**
 * Mock book metadata
 */
export const mockBookMetadata = {
  id: '123e4567-e89b-12d3-a456-426614174000',
  title: 'Test Book',
  author: 'Test Author',
  genre: 'fiction',
  total_pages: 300,
  current_page: 1,
  is_parsed: true,
  parsing_status: 'completed',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

/**
 * Generate random book data
 */
export function generateMockBook(overrides: Partial<TestBook> = {}): TestBook {
  return {
    title: `Test Book ${Date.now()}`,
    author: 'Test Author',
    genre: 'fiction',
    ...overrides,
  };
}
