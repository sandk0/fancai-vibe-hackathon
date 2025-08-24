# Frontend Components Overview - BookReader AI

Обзор React компонентов системы BookReader AI с архитектурными паттернами, best practices и примерами использования.

## Архитектура компонентов

### Организация по функциям
```
src/components/
├── Auth/          # Аутентификация и авторизация
├── Books/         # Управление библиотекой книг
├── Images/        # Галерея изображений
├── Reader/        # Компоненты читалки
├── Settings/      # Настройки приложения
├── Layout/        # Общие layout компоненты
└── UI/           # Переиспользуемые UI элементы
```

### Принципы проектирования
- **Component composition** над inheritance
- **Props drilling avoidance** через контексты и stores
- **Performance optimization** через мемоизацию и lazy loading
- **Accessibility** соответствие WCAG guidelines
- **Mobile-first responsive design**

---

## Core Layout Components

### Header
**Файл:** `src/components/Layout/Header.tsx`

```typescript
interface HeaderProps {
  user: User | null;
  onMenuToggle: () => void;
  showSearch?: boolean;
}

export const Header: React.FC<HeaderProps> = ({ 
  user, 
  onMenuToggle, 
  showSearch = true 
}) => {
  return (
    <header className="bg-white dark:bg-gray-900 shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <button onClick={onMenuToggle} className="md:hidden">
              <MenuIcon />
            </button>
            <Logo />
          </div>
          
          {showSearch && <SearchBar />}
          
          <div className="flex items-center space-x-4">
            <NotificationBell />
            <UserMenu user={user} />
          </div>
        </div>
      </div>
    </header>
  );
};
```

### Sidebar Navigation
```typescript
export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { pathname } = useLocation();
  
  const menuItems = [
    { path: '/library', label: 'Библиотека', icon: BookIcon },
    { path: '/reader', label: 'Читалка', icon: ReaderIcon },
    { path: '/images', label: 'Галерея', icon: ImageIcon },
    { path: '/settings', label: 'Настройки', icon: SettingsIcon }
  ];
  
  return (
    <aside className={clsx(
      'fixed inset-y-0 left-0 z-50 w-64 bg-white transform transition-transform',
      isOpen ? 'translate-x-0' : '-translate-x-full'
    )}>
      <nav className="mt-16 px-4">
        {menuItems.map(item => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => clsx(
              'flex items-center px-4 py-3 rounded-lg mb-2',
              isActive 
                ? 'bg-primary-100 text-primary-700' 
                : 'text-gray-700 hover:bg-gray-100'
            )}
          >
            <item.icon className="w-5 h-5 mr-3" />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
};
```

---

## Book Management Components

### BookLibrary
```typescript
export const BookLibrary: React.FC = () => {
  const { books, isLoading, filters, updateFilters } = useBooksStore();
  const [view, setView] = useState<'grid' | 'list'>('grid');
  
  return (
    <div className="space-y-6">
      <LibraryHeader 
        onUpload={() => useUIStore.getState().openModal('book-upload')}
        view={view}
        onViewChange={setView}
      />
      
      <BookFilters 
        filters={filters}
        onChange={updateFilters}
      />
      
      {isLoading ? (
        <BookSkeleton count={6} />
      ) : (
        <BookGrid books={books} view={view} />
      )}
    </div>
  );
};
```

### BookCard Component
```typescript
interface BookCardProps {
  book: Book;
  view: 'grid' | 'list';
  onRead: (book: Book) => void;
  onEdit?: (book: Book) => void;
  onDelete?: (book: Book) => void;
}

export const BookCard: React.FC<BookCardProps> = ({ 
  book, 
  view, 
  onRead,
  onEdit,
  onDelete 
}) => {
  const progress = book.reading_progress?.progress_percentage || 0;
  
  if (view === 'list') {
    return <BookListItem book={book} onRead={onRead} />;
  }
  
  return (
    <div className="bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="relative aspect-[3/4] mb-4">
        <BookCover 
          src={book.cover_image} 
          alt={book.title}
          className="w-full h-full object-cover rounded-t-lg"
        />
        
        {progress > 0 && (
          <div className="absolute bottom-2 left-2 right-2">
            <ProgressBar progress={progress} size="sm" />
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-1 line-clamp-2">
          {book.title}
        </h3>
        <p className="text-sm text-gray-600 mb-3">{book.author}</p>
        
        <div className="flex items-center justify-between">
          <BookMetadata book={book} />
          <BookActions 
            book={book}
            onRead={onRead}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        </div>
      </div>
    </div>
  );
};
```

---

## Reader Components

### BookReader (основной компонент)
```typescript
export const BookReader: React.FC<BookReaderProps> = ({ bookId }) => {
  const { 
    currentChapter, 
    settings, 
    chapters,
    navigateToChapter,
    updateSettings 
  } = useReaderStore();
  
  const { data: content, isLoading } = useBookContent(bookId, currentChapter);
  
  useKeyboardNavigation({
    onNextPage: () => navigateToPage(currentPage + 1),
    onPrevPage: () => navigateToPage(currentPage - 1),
    onNextChapter: () => navigateToChapter(currentChapter + 1),
    onPrevChapter: () => navigateToChapter(currentChapter - 1)
  });
  
  return (
    <div className="min-h-screen bg-reader" data-theme={settings.theme}>
      <ReaderHeader 
        book={content?.chapter.book}
        chapter={content?.chapter}
        onSettingsOpen={() => setShowSettings(true)}
      />
      
      <main className="reader-content" style={{
        fontSize: `${settings.fontSize}px`,
        fontFamily: settings.fontFamily,
        lineHeight: settings.lineHeight,
        maxWidth: `${settings.pageWidth}rem`,
        margin: `0 auto`,
        padding: `${settings.margin}rem`
      }}>
        {isLoading ? (
          <ContentSkeleton />
        ) : (
          <ChapterContent 
            content={content}
            onDescriptionClick={handleDescriptionClick}
            highlightDescriptions={settings.highlightDescriptions}
          />
        )}
      </main>
      
      <ReaderNavigation 
        currentChapter={currentChapter}
        totalChapters={chapters.length}
        onChapterChange={navigateToChapter}
      />
      
      <ReaderSettings 
        isOpen={showSettings}
        settings={settings}
        onSettingsChange={updateSettings}
        onClose={() => setShowSettings(false)}
      />
    </div>
  );
};
```

### ChapterContent
```typescript
interface ChapterContentProps {
  content: ChapterContent;
  onDescriptionClick: (description: Description) => void;
  highlightDescriptions: boolean;
}

export const ChapterContent: React.FC<ChapterContentProps> = ({
  content,
  onDescriptionClick,
  highlightDescriptions
}) => {
  const processedContent = useMemo(() => {
    if (!highlightDescriptions) return content.chapter.content;
    
    return highlightDescriptionsInText(
      content.chapter.content,
      content.descriptions
    );
  }, [content, highlightDescriptions]);
  
  return (
    <article className="prose prose-lg max-w-none">
      <header className="mb-8">
        <h1 className="text-2xl font-bold mb-2">
          {content.chapter.title}
        </h1>
        <div className="text-sm text-gray-500">
          Глава {content.chapter.chapter_number} • 
          {content.chapter.estimated_reading_time} мин чтения
        </div>
      </header>
      
      <div 
        className="chapter-text"
        dangerouslySetInnerHTML={{ __html: processedContent }}
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.dataset.descriptionId) {
            const description = content.descriptions.find(
              d => d.id === target.dataset.descriptionId
            );
            if (description) {
              onDescriptionClick(description);
            }
          }
        }}
      />
    </article>
  );
};
```

---

## Image Gallery Components

### ImageGallery
```typescript
export const ImageGallery: React.FC<ImageGalleryProps> = ({ 
  bookId,
  onImageSelect 
}) => {
  const { images, isLoading, filters, setFilters } = useImagesStore();
  const bookImages = images[bookId] || [];
  
  return (
    <div className="space-y-6">
      <GalleryHeader 
        totalImages={bookImages.length}
        onGenerateMore={() => handleBatchGeneration(bookId)}
      />
      
      <ImageFilters 
        filters={filters}
        onChange={setFilters}
        availableTypes={getAvailableTypes(bookImages)}
      />
      
      {isLoading ? (
        <ImageSkeleton count={8} />
      ) : (
        <Masonry 
          breakpointCols={{
            default: 4,
            1100: 3,
            700: 2,
            500: 1
          }}
          className="masonry-grid"
        >
          {bookImages.map(image => (
            <ImageCard 
              key={image.id}
              image={image}
              onClick={() => onImageSelect(image)}
            />
          ))}
        </Masonry>
      )}
    </div>
  );
};
```

---

## UI Components Library

### Button System
```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant: 'primary' | 'secondary' | 'outline' | 'ghost';
  size: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  leftIcon?: React.ComponentType<{ className?: string }>;
  rightIcon?: React.ComponentType<{ className?: string }>;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  leftIcon: LeftIcon,
  rightIcon: RightIcon,
  children,
  disabled,
  className,
  ...props
}) => {
  const baseClasses = 'inline-flex items-center justify-center font-medium rounded-lg transition-colors focus:outline-none focus:ring-2';
  
  const variants = {
    primary: 'bg-primary-600 text-white hover:bg-primary-700 focus:ring-primary-500',
    secondary: 'bg-gray-600 text-white hover:bg-gray-700 focus:ring-gray-500',
    outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50 focus:ring-primary-500',
    ghost: 'text-primary-600 hover:bg-primary-50 focus:ring-primary-500'
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg'
  };
  
  return (
    <button
      className={clsx(
        baseClasses,
        variants[variant],
        sizes[size],
        (disabled || isLoading) && 'opacity-50 cursor-not-allowed',
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Spinner className="w-4 h-4 mr-2" />}
      {!isLoading && LeftIcon && <LeftIcon className="w-4 h-4 mr-2" />}
      {children}
      {!isLoading && RightIcon && <RightIcon className="w-4 h-4 ml-2" />}
    </button>
  );
};
```

### Modal System
```typescript
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" 
             onClick={onClose} />
        
        <div className={clsx(
          'inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl',
          {
            'max-w-sm': size === 'sm',
            'max-w-md': size === 'md',
            'max-w-lg': size === 'lg',
            'max-w-4xl': size === 'xl'
          }
        )}>
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between mb-4">
              {title && (
                <h3 className="text-lg font-medium text-gray-900">
                  {title}
                </h3>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XIcon className="w-6 h-6" />
                </button>
              )}
            </div>
          )}
          
          {children}
        </div>
      </div>
    </div>
  );
};
```

---

## Accessibility & Performance

### Accessibility Patterns
```typescript
// Keyboard navigation hook
export const useKeyboardNavigation = (handlers: KeyboardHandlers) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case ' ':
          handlers.onNextPage?.();
          e.preventDefault();
          break;
        case 'ArrowLeft':
          handlers.onPrevPage?.();
          e.preventDefault();
          break;
        case 'Home':
          handlers.onFirstPage?.();
          e.preventDefault();
          break;
        case 'End':
          handlers.onLastPage?.();
          e.preventDefault();
          break;
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
};

// Focus management
export const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (!isActive || !containerRef.current) return;
    
    const focusableElements = containerRef.current.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    firstElement?.focus();
    
    const handleTab = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };
    
    document.addEventListener('keydown', handleTab);
    return () => document.removeEventListener('keydown', handleTab);
  }, [isActive]);
  
  return containerRef;
};
```

### Performance Optimizations
```typescript
// Lazy loading для тяжелых компонентов
export const BookReader = lazy(() => import('./BookReader'));
export const ImageGallery = lazy(() => import('./ImageGallery'));

// Мемоизация дорогих вычислений
export const BookCard = React.memo<BookCardProps>(({ book, ...props }) => {
  const formattedDate = useMemo(() => 
    formatDistanceToNow(new Date(book.created_at), { locale: ru })
  , [book.created_at]);
  
  return (
    <div className="book-card">
      {/* Component content */}
    </div>
  );
});

// Виртуализация для больших списков
export const VirtualBookList: React.FC<VirtualBookListProps> = ({ books }) => {
  return (
    <FixedSizeList
      height={600}
      itemCount={books.length}
      itemSize={120}
      itemData={books}
    >
      {({ index, style, data }) => (
        <div style={style}>
          <BookCard book={data[index]} />
        </div>
      )}
    </FixedSizeList>
  );
};
```

---

## Testing Components

### Component Testing Utils
```typescript
// Testing utilities
export const renderWithProviders = (
  ui: React.ReactElement,
  options: RenderOptions = {}
) => {
  const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
      <BrowserRouter>
        <QueryClient>
          <ToastProvider>
            {children}
          </ToastProvider>
        </QueryClient>
      </BrowserRouter>
    );
  };
  
  return render(ui, { wrapper: AllTheProviders, ...options });
};

// Component test example
describe('BookCard', () => {
  const mockBook: Book = {
    id: '1',
    title: 'Test Book',
    author: 'Test Author',
    reading_progress: { progress_percentage: 45 }
  };
  
  it('displays book information correctly', () => {
    const onRead = jest.fn();
    
    renderWithProviders(
      <BookCard book={mockBook} view="grid" onRead={onRead} />
    );
    
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /читать/i })).toBeInTheDocument();
  });
  
  it('calls onRead when read button is clicked', async () => {
    const onRead = jest.fn();
    
    renderWithProviders(
      <BookCard book={mockBook} view="grid" onRead={onRead} />
    );
    
    await userEvent.click(screen.getByRole('button', { name: /читать/i }));
    
    expect(onRead).toHaveBeenCalledWith(mockBook);
  });
});
```

---

## Заключение

Frontend компоненты BookReader AI обеспечивают:

- **Модульную архитектуру** с четким разделением ответственности
- **Высокую производительность** через оптимизации и lazy loading
- **Accessibility compliance** с поддержкой клавиатуры и screen readers
- **Responsive design** для всех устройств
- **Типобезопасность** через TypeScript
- **Тестируемость** с comprehensive test coverage
- **Developer experience** с удобными утилитами и хуками