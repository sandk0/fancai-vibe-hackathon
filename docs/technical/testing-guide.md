# Testing Guide - BookReader AI

Всеобъемлющее руководство по тестированию системы BookReader AI, включая unit, integration, E2E тесты, скрипты и best practices.

## Стратегия тестирования

### Пирамида тестирования
```
E2E Tests (10%)
├── Playwright/Cypress
└── Critical user journeys

Integration Tests (20%)
├── API endpoints
├── Database interactions
└── Service integrations

Unit Tests (70%)
├── Business logic
├── Components
└── Utilities
```

### Coverage цели
- **Unit tests:** >90% coverage
- **Integration tests:** Все API endpoints
- **E2E tests:** Основные user flows

---

## Backend Testing

### Настройка тестовой среды
**Файл:** `backend/conftest.py`

```python
@pytest.fixture(scope="session")
async def test_db():
    """Создание тестовой БД."""
    test_engine = create_async_engine(
        "postgresql+asyncpg://test:test@localhost/bookreader_test"
    )
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    yield test_engine
    
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def test_session(test_db):
    """Сессия БД для тестов."""
    async with AsyncSession(test_db) as session:
        yield session
        await session.rollback()

@pytest.fixture
async def test_user(test_session):
    """Создание тестового пользователя."""
    user = User(
        email="test@example.com",
        password_hash="hashed_password",
        full_name="Test User"
    )
    test_session.add(user)
    await test_session.commit()
    return user
```

### Unit тесты модели
```python
class TestBookModel:
    async def test_book_creation(self, test_session, test_user):
        book = Book(
            user_id=test_user.id,
            title="Test Book",
            author="Test Author",
            file_path="/test/book.epub",
            file_format=BookFormat.EPUB,
            file_size=1024000
        )
        
        test_session.add(book)
        await test_session.commit()
        
        assert book.id is not None
        assert book.title == "Test Book"
        assert book.is_parsed is False
    
    async def test_reading_progress_calculation(self, test_session):
        book = BookFactory.create()
        
        # Создаем 10 глав
        for i in range(1, 11):
            chapter = ChapterFactory.create(
                book_id=book.id,
                chapter_number=i
            )
            test_session.add(chapter)
        
        # Прогресс на 5 главе
        progress = ReadingProgress(
            user_id=book.user_id,
            book_id=book.id,
            current_chapter=5
        )
        test_session.add(progress)
        await test_session.commit()
        
        progress_percent = book.get_reading_progress_percent(book.user_id)
        assert progress_percent == 40.0  # 4/10 глав завершено
```

### Тесты сервисов
```python
class TestNLPProcessor:
    @pytest.fixture
    def nlp_processor(self, test_session):
        return NLPProcessor(test_session)
    
    async def test_location_extraction(self, nlp_processor):
        text = "В древнем замке на вершине холма жили привидения."
        chapter_id = uuid4()
        
        descriptions = await nlp_processor.extract_descriptions_from_text(
            text, chapter_id
        )
        
        location_descs = [d for d in descriptions if d.type == DescriptionType.LOCATION]
        assert len(location_descs) > 0
        
        location = location_descs[0]
        assert "замок" in location.content.lower()
        assert location.confidence_score >= 0.7
        assert location.priority_score >= 70.0
    
    @pytest.mark.parametrize("text,expected_type", [
        ("высокий мужчина с седой бородой", DescriptionType.CHARACTER),
        ("древний каменный замок", DescriptionType.LOCATION),
        ("мрачная атмосфера тумана", DescriptionType.ATMOSPHERE)
    ])
    async def test_description_classification(self, nlp_processor, text, expected_type):
        descriptions = await nlp_processor.extract_descriptions_from_text(
            text, uuid4()
        )
        
        assert any(d.type == expected_type for d in descriptions)
```

### API тесты
```python
class TestBooksAPI:
    async def test_get_books(self, test_client, test_user, auth_headers):
        # Создаем тестовые книги
        books = [BookFactory.create(user_id=test_user.id) for _ in range(5)]
        
        response = await test_client.get(
            "/api/v1/books",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        assert len(data["books"]) == 5
        assert "pagination" in data
    
    async def test_upload_book(self, test_client, auth_headers):
        # Создаем тестовый EPUB файл
        test_file = create_test_epub_file()
        
        response = await test_client.post(
            "/api/v1/books/upload",
            files={"file": ("test.epub", test_file, "application/epub+zip")},
            headers=auth_headers
        )
        
        assert response.status_code == 201
        data = response.json()
        assert "book" in data
        assert data["book"]["title"]
        assert "processing" in data
    
    async def test_unauthorized_access(self, test_client):
        response = await test_client.get("/api/v1/books")
        assert response.status_code == 401
```

---

## Frontend Testing

### Настройка Jest и Testing Library
**Файл:** `frontend/src/test-utils.tsx`

```typescript
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialStores?: {
    auth?: Partial<AuthState>;
    books?: Partial<BooksState>;
  };
}

const AllTheProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  });
  
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        {children}
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export const renderWithProviders = (
  ui: React.ReactElement,
  options: CustomRenderOptions = {}
) => {
  const { initialStores, ...renderOptions } = options;
  
  // Сброс stores к начальному состоянию
  if (initialStores?.auth) {
    useAuthStore.setState(initialStores.auth);
  }
  
  return render(ui, { wrapper: AllTheProviders, ...renderOptions });
};

// Custom matchers
export * from '@testing-library/jest-dom';
```

### Component тесты
```typescript
describe('BookCard', () => {
  const mockBook: Book = {
    id: '1',
    title: 'Test Book',
    author: 'Test Author',
    genre: BookGenre.FANTASY,
    reading_progress: {
      progress_percentage: 45,
      current_chapter: 3
    }
  };
  
  it('renders book information correctly', () => {
    const onRead = jest.fn();
    
    renderWithProviders(
      <BookCard book={mockBook} view="grid" onRead={onRead} />
    );
    
    expect(screen.getByText('Test Book')).toBeInTheDocument();
    expect(screen.getByText('Test Author')).toBeInTheDocument();
    expect(screen.getByText('45%')).toBeInTheDocument();
  });
  
  it('calls onRead when read button is clicked', async () => {
    const onRead = jest.fn();
    const user = userEvent.setup();
    
    renderWithProviders(
      <BookCard book={mockBook} view="grid" onRead={onRead} />
    );
    
    await user.click(screen.getByRole('button', { name: /читать/i }));
    
    expect(onRead).toHaveBeenCalledWith(mockBook);
  });
});

describe('BookReader', () => {
  const mockChapterContent = {
    chapter: {
      id: '1',
      title: 'Chapter 1',
      content: 'Test chapter content...'
    },
    descriptions: []
  };
  
  it('displays chapter content', async () => {
    // Mock API response
    server.use(
      rest.get('/api/v1/books/:bookId/chapters/:chapter', (req, res, ctx) => {
        return res(ctx.json(mockChapterContent));
      })
    );
    
    renderWithProviders(<BookReader bookId="test-book-id" />);
    
    expect(await screen.findByText('Chapter 1')).toBeInTheDocument();
    expect(screen.getByText('Test chapter content...')).toBeInTheDocument();
  });
});
```

### Hook тесты
```typescript
describe('useBookUpload', () => {
  it('uploads book successfully', async () => {
    const { result } = renderHook(() => useBookUpload(), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={new QueryClient()}>
          {children}
        </QueryClientProvider>
      )
    });
    
    const testFile = new File(['test content'], 'test.epub', {
      type: 'application/epub+zip'
    });
    
    act(() => {
      result.current.mutate({ file: testFile });
    });
    
    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });
  });
});
```

---

## E2E Testing

### Playwright Setup
**Файл:** `tests/e2e/playwright.config.ts`

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'Mobile Chrome', use: { ...devices['Pixel 5'] } }
  ]
});
```

### E2E Tests
```typescript
test.describe('Book Reading Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Логин
    await page.goto('/login');
    await page.fill('[data-testid="email"]', 'test@example.com');
    await page.fill('[data-testid="password"]', 'password');
    await page.click('[data-testid="login-button"]');
    
    await page.waitForURL('/library');
  });
  
  test('upload and read book', async ({ page }) => {
    // Загрузка книги
    await page.click('[data-testid="upload-book-button"]');
    
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles('tests/fixtures/sample-book.epub');
    
    await page.click('[data-testid="upload-confirm"]');
    
    // Ждем обработки
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeHidden({ timeout: 30000 });
    
    // Открытие книги для чтения
    await page.click('[data-testid="book-card"]:first-child [data-testid="read-button"]');
    
    await page.waitForURL('/reader/*');
    
    // Проверка содержимого читалки
    await expect(page.locator('[data-testid="chapter-title"]')).toBeVisible();
    await expect(page.locator('[data-testid="chapter-content"]')).toBeVisible();
    
    // Навигация по главам
    await page.click('[data-testid="next-chapter"]');
    
    await expect(page.locator('[data-testid="chapter-title"]')).toHaveText(/глава 2/i);
  });
  
  test('image generation workflow', async ({ page }) => {
    // Переход в галерею
    await page.goto('/library');
    await page.click('[data-testid="book-card"]:first-child [data-testid="images-button"]');
    
    // Генерация изображений
    await page.click('[data-testid="generate-images-button"]');
    
    // Проверка статуса генерации
    await expect(page.locator('[data-testid="generation-progress"]')).toBeVisible();
    
    // Ждем завершения (может занять время)
    await expect(
      page.locator('[data-testid="generated-image"]').first()
    ).toBeVisible({ timeout: 60000 });
  });
});
```

---

## Testing Scripts

### Автоматизированные скрипты
**Файл:** `scripts/run-tests.sh`

```bash
#!/bin/bash

set -e

echo "🧪 Running BookReader AI Test Suite"

# Функция для цветного вывода
print_status() {
    echo -e "\033[1;34m$1\033[0m"
}

print_success() {
    echo -e "\033[1;32m✅ $1\033[0m"
}

print_error() {
    echo -e "\033[1;31m❌ $1\033[0m"
}

# Проверка окружения
if [[ ! -f ".env.test" ]]; then
    print_error "Test environment file .env.test not found!"
    exit 1
fi

# Загрузка тестовых переменных
export $(cat .env.test | xargs)

# Backend тесты
print_status "Running Backend Tests..."
cd backend

# Создание тестовой БД
print_status "Setting up test database..."
python scripts/setup_test_db.py

# Unit тесты
print_status "Running unit tests..."
pytest tests/unit/ -v --cov=app --cov-report=html --cov-report=term

# Integration тесты
print_status "Running integration tests..."
pytest tests/integration/ -v

# Очистка тестовой БД
python scripts/cleanup_test_db.py

cd ..

# Frontend тесты
print_status "Running Frontend Tests..."
cd frontend

# Unit тесты компонентов
print_status "Running component tests..."
npm test -- --coverage --watchAll=false

# TypeScript проверки
print_status "Running TypeScript checks..."
npm run type-check

cd ..

# E2E тесты (опционально)
if [[ "$RUN_E2E" == "true" ]]; then
    print_status "Running E2E Tests..."
    
    # Запуск приложения в тестовом режиме
    docker-compose -f docker-compose.test.yml up -d
    
    # Ожидание готовности сервисов
    ./scripts/wait-for-services.sh
    
    # Запуск E2E тестов
    cd frontend
    npx playwright test
    cd ..
    
    # Остановка тестовых сервисов
    docker-compose -f docker-compose.test.yml down
fi

print_success "All tests completed successfully! 🎉"
```

### Continuous Integration
**Файл:** `.github/workflows/test.yml`

```yaml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  backend-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_USER: test
          POSTGRES_DB: bookreader_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Set up Python 3.11
      uses: actions/setup-python@v4
      with:
        python-version: '3.11'
    
    - name: Install dependencies
      working-directory: ./backend
      run: |
        pip install -r requirements.txt
        pip install pytest pytest-cov pytest-asyncio
        python -m spacy download ru_core_news_lg
    
    - name: Run tests
      working-directory: ./backend
      env:
        DATABASE_URL: postgresql+asyncpg://test:test@localhost/bookreader_test
        REDIS_URL: redis://localhost:6379
      run: |
        pytest tests/ -v --cov=app --cov-report=xml
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./backend/coverage.xml

  frontend-tests:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js 18
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
        cache-dependency-path: frontend/package-lock.json
    
    - name: Install dependencies
      working-directory: ./frontend
      run: npm ci
    
    - name: Run tests
      working-directory: ./frontend
      run: |
        npm test -- --coverage --watchAll=false
        npm run type-check
        npm run lint
    
    - name: Upload coverage
      uses: codecov/codecov-action@v3
      with:
        file: ./frontend/coverage/coverage-final.json

  e2e-tests:
    runs-on: ubuntu-latest
    needs: [backend-tests, frontend-tests]
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
    
    - name: Install Playwright
      working-directory: ./frontend
      run: |
        npm ci
        npx playwright install --with-deps
    
    - name: Start application
      run: |
        docker-compose -f docker-compose.test.yml up -d
        ./scripts/wait-for-services.sh
    
    - name: Run E2E tests
      working-directory: ./frontend
      run: npx playwright test
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: playwright-report
        path: frontend/playwright-report/
```

---

## Test Data Management

### Фабрики для тестовых данных
```python
class UserFactory:
    @staticmethod
    def create(**kwargs) -> User:
        defaults = {
            'email': fake.email(),
            'password_hash': 'hashed_password',
            'full_name': fake.name(),
            'is_active': True
        }
        defaults.update(kwargs)
        return User(**defaults)

class BookFactory:
    @staticmethod
    def create(**kwargs) -> Book:
        defaults = {
            'title': fake.sentence(nb_words=3),
            'author': fake.name(),
            'genre': random.choice(list(BookGenre)),
            'file_path': f'/test/{fake.uuid4()}.epub',
            'file_format': BookFormat.EPUB,
            'file_size': random.randint(100000, 10000000)
        }
        defaults.update(kwargs)
        return Book(**defaults)
```

### Fixtures для тестовых файлов
```python
def create_test_epub_file() -> BytesIO:
    """Создание минимального валидного EPUB файла для тестов."""
    
    zip_buffer = BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # mimetype
        zip_file.writestr('mimetype', 'application/epub+zip')
        
        # META-INF/container.xml
        zip_file.writestr('META-INF/container.xml', CONTAINER_XML)
        
        # content.opf
        zip_file.writestr('OEBPS/content.opf', CONTENT_OPF)
        
        # Test chapter
        zip_file.writestr('OEBPS/chapter1.xhtml', CHAPTER_CONTENT)
    
    zip_buffer.seek(0)
    return zip_buffer
```

---

## Performance Testing

### Load Testing с Locust
```python
from locust import HttpUser, task, between

class BookReaderUser(HttpUser):
    wait_time = between(1, 3)
    
    def on_start(self):
        """Логин пользователя."""
        response = self.client.post('/api/v1/auth/login', json={
            'email': 'loadtest@example.com',
            'password': 'password'
        })
        
        if response.status_code == 200:
            self.token = response.json()['access_token']
            self.client.headers.update({
                'Authorization': f'Bearer {self.token}'
            })
    
    @task(3)
    def browse_books(self):
        """Просмотр библиотеки книг."""
        self.client.get('/api/v1/books')
    
    @task(2)
    def read_chapter(self):
        """Чтение главы книги."""
        book_id = 'sample-book-id'
        chapter = random.randint(1, 10)
        self.client.get(f'/api/v1/books/{book_id}/chapters/{chapter}')
    
    @task(1)
    def generate_image(self):
        """Генерация изображения."""
        description_id = 'sample-description-id'
        self.client.post(f'/api/v1/images/generate/description/{description_id}')
```

---

## Заключение

Система тестирования BookReader AI обеспечивает:

- **Полное покрытие** всех уровней приложения
- **Автоматизированное выполнение** в CI/CD pipeline
- **Performance testing** для выявления узких мест
- **E2E тестирование** критических user journeys
- **Легкость поддержки** через фабрики и утилиты
- **Быстрое выполнение** через параллелизацию и оптимизации

Все тесты готовы для production использования и continuous integration.