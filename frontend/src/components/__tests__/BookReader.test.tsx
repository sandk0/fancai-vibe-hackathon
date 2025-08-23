import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { BookReader } from '../Reader/BookReader';

// Mock stores
const mockReaderStore = {
  fontSize: 18,
  fontFamily: 'Georgia, serif',
  lineHeight: 1.6,
  theme: 'light',
  updateReadingProgress: vi.fn(),
};

const mockUIStore = {
  notify: {
    info: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
};

// Mock API
const mockBooksAPI = {
  getBook: vi.fn(),
  getChapter: vi.fn(),
  updateProgress: vi.fn(),
};

vi.mock('@/stores/reader', () => ({
  useReaderStore: () => mockReaderStore,
}));

vi.mock('@/stores/ui', () => ({
  useUIStore: () => mockUIStore,
}));

vi.mock('@/api/books', () => ({
  booksAPI: mockBooksAPI,
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useParams: () => ({
      bookId: 'test-book-id',
      chapterNumber: '1',
    }),
  };
});

// Mock Framer Motion
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef<HTMLDivElement, any>(({ children, ...props }, ref) => (
      <div ref={ref} {...props}>{children}</div>
    )),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

describe('BookReader', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock successful API responses
    mockBooksAPI.getBook.mockResolvedValue({
      id: 'test-book-id',
      title: 'Test Book',
      author: 'Test Author',
      total_chapters: 5,
      reading_progress_percent: 25,
    });

    mockBooksAPI.getChapter.mockResolvedValue({
      id: 'chapter-1',
      chapter_number: 1,
      title: 'Chapter 1: The Beginning',
      content: 'This is the first chapter content. It has a beautiful forest with tall trees.',
      descriptions: [
        {
          id: 'desc-1',
          text: 'beautiful forest with tall trees',
          description_type: 'location',
          generated_image: {
            id: 'img-1',
            image_url: 'https://example.com/forest.jpg',
          },
        },
      ],
    });
  });

  it('renders loading state initially', () => {
    render(<BookReader />, { wrapper: createWrapper() });
    expect(screen.getByText('Loading chapter...')).toBeInTheDocument();
  });

  it('renders chapter content when loaded', async () => {
    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Book')).toBeInTheDocument();
    });

    expect(screen.getByText('Chapter 1: The Beginning')).toBeInTheDocument();
    expect(screen.getByText(/This is the first chapter content/)).toBeInTheDocument();
  });

  it('displays book title and author in header', async () => {
    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Test Book')).toBeInTheDocument();
    });

    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('Chapter 1: The Beginning')).toBeInTheDocument();
  });

  it('shows page navigation controls', async () => {
    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Previous')).toBeInTheDocument();
    });

    expect(screen.getByText('Previous')).toBeInTheDocument();
    expect(screen.getByText('Next')).toBeInTheDocument();
  });

  it('handles navigation between chapters', async () => {
    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByDisplayValue('1')).toBeInTheDocument();
    });

    const chapterSelect = screen.getByDisplayValue('1');
    fireEvent.change(chapterSelect, { target: { value: '2' } });

    expect(mockBooksAPI.getChapter).toHaveBeenCalledWith('test-book-id', 2);
  });

  it('displays progress bar', async () => {
    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Progress')).toBeInTheDocument();
    });

    expect(screen.getByText('Progress')).toBeInTheDocument();
    // Should show some progress percentage
    expect(screen.getByText(/\d+%/)).toBeInTheDocument();
  });

  it('handles description click to show image', async () => {
    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/beautiful forest with tall trees/)).toBeInTheDocument();
    });

    // Find and click the highlighted description
    const descriptionElement = screen.getByText(/beautiful forest with tall trees/);
    fireEvent.click(descriptionElement);

    // Should show image modal
    await waitFor(() => {
      expect(screen.getByRole('img')).toBeInTheDocument();
    });
  });

  it('shows notification when image is being generated', async () => {
    // Mock chapter with description but no generated image
    mockBooksAPI.getChapter.mockResolvedValueOnce({
      id: 'chapter-1',
      chapter_number: 1,
      title: 'Chapter 1: The Beginning',
      content: 'This is content with a mountain peak.',
      descriptions: [
        {
          id: 'desc-1',
          text: 'mountain peak',
          description_type: 'location',
          generated_image: null,
        },
      ],
    });

    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText(/mountain peak/)).toBeInTheDocument();
    });

    const descriptionElement = screen.getByText(/mountain peak/);
    fireEvent.click(descriptionElement);

    expect(mockUIStore.notify.info).toHaveBeenCalledWith(
      'Image Generation',
      'Image for this description is being generated...'
    );
  });

  it('updates reading progress', async () => {
    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(mockReaderStore.updateReadingProgress).toHaveBeenCalled();
    });

    expect(mockReaderStore.updateReadingProgress).toHaveBeenCalledWith(
      'test-book-id',
      1,
      expect.any(Number)
    );
  });

  it('handles keyboard navigation', async () => {
    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Next')).toBeInTheDocument();
    });

    // Simulate keyboard navigation
    fireEvent.keyDown(document, { key: 'ArrowRight' });
    // Should trigger next page functionality
  });

  it('renders error state when chapter fails to load', async () => {
    mockBooksAPI.getChapter.mockRejectedValueOnce(new Error('Chapter not found'));

    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('Chapter Not Found')).toBeInTheDocument();
    });

    expect(screen.getByText('The requested chapter could not be loaded.')).toBeInTheDocument();
    expect(screen.getByText('Go Back')).toBeInTheDocument();
  });

  it('applies reader settings correctly', async () => {
    render(<BookReader />, { wrapper: createWrapper() });

    await waitFor(() => {
      const contentDiv = screen.getByText(/This is the first chapter content/).closest('div');
      expect(contentDiv).toHaveStyle({
        fontSize: '18px',
        fontFamily: 'Georgia, serif',
        lineHeight: '1.6',
      });
    });
  });
});