# Complete Components Guide - BookReader AI

Краткий справочник по всем основным компонентам системы BookReader AI с примерами использования и ключевыми особенностями.

## 🔧 Backend Components

### NLP Processor

**Файл:** `backend/app/services/nlp_processor.py`

**Назначение:** Извлечение и классификация описаний из текста книг.

**Ключевые возможности:**
- **spaCy ru_core_news_lg** для анализа русского языка
- **5 типов описаний** с приоритизацией (location > character > atmosphere > object > action)
- **Контекстный анализ** с извлечением именованных сущностей
- **Confidence scoring** для оценки качества найденных описаний

```python
nlp_processor = NLPProcessor(session)

# Анализ текста
descriptions = await nlp_processor.extract_descriptions_from_text(
    text="В древнем замке жил могущественный волшебник с седой бородой.",
    chapter_id=chapter_id
)

# Результат: [
#   Description(content="древний замок", type=LOCATION, confidence=0.89, priority=78.5),
#   Description(content="волшебник с седой бородой", type=CHARACTER, confidence=0.85, priority=71.0)
# ]
```

---

### AI Image Generator

**Файл:** `backend/app/services/image_generator.py`

**Назначение:** Генерация изображений через внешние AI сервисы.

**Поддерживаемые сервисы:**
- **Pollinations.ai** (основной) - бесплатный, ~6-15 сек генерация
- **OpenAI DALL-E** (опционально) - требует API ключ
- **Stable Diffusion** (планируется)

**Prompt Engineering:**
```python
# Автоматическое улучшение промптов по жанрам
BookGenre.FANTASY → "fantasy art, magical atmosphere, detailed fantasy illustration"
BookGenre.DETECTIVE → "noir style, dark atmosphere, realistic, cinematic lighting"

# Адаптация под тип описания
DescriptionType.LOCATION → "detailed architecture, environmental design, landscape"
DescriptionType.CHARACTER → "character portrait, detailed features, expressive"
```

---

### Book Parser

**Файл:** `backend/app/services/book_parser.py`

**Форматы:** EPUB, FB2 с полной поддержкой метаданных

**Извлекаемые данные:**
- Название, автор, жанр, язык, описание
- Обложка (с fallback поиском)
- Главы с HTML очисткой
- ISBN, издательство, дата публикации

```python
parser = BookParser()

# Валидация файла
validation = parser.validate_book_file("book.epub")
# → {is_valid: true, format: "epub", chapters_found: 15, has_cover: true}

# Парсинг
result = parser.parse_book("book.epub", user_id)
# → BookParsingResult(metadata, chapters[], cover_image)
```

---

### Celery Tasks

**Файл:** `backend/app/core/tasks.py`

**Production-ready задачи:**
- `process_book_task` - полная обработка книги (NLP + сохранение)
- `generate_images_task` - генерация изображений по описаниям  
- `batch_generate_for_book_task` - пакетная генерация топ-описаний
- `cleanup_old_images_task` - автоматическая очистка старых файлов
- `system_stats_task` - сбор метрик для мониторинга

**Запуск задач:**
```python
# Обработка книги
task = process_book_task.delay(book_id=book.id)

# Генерация изображений
task = batch_generate_for_book_task.delay(
    book_id=book.id, 
    user_id=user.id, 
    limit=10
)
```

---

## 🎨 Frontend Components

### State Management (Zustand)

**Файлы:** `frontend/src/stores/`

**Stores:**
- **AuthStore** - аутентификация, JWT токены, user data
- **BooksStore** - библиотека книг, загрузка, прогресс
- **ImagesStore** - галерея изображений, генерация
- **ReaderStore** - настройки читалки, текущая позиция
- **UIStore** - уведомления, модальные окна, общий UI state

```typescript
// Использование store
const { user, login, logout } = useAuthStore();
const { books, uploadBook, updateProgress } = useBooksStore();
const { settings, updateSettings } = useReaderStore();

// Пример обновления настроек
updateSettings({
  theme: 'dark',
  fontSize: 18,
  fontFamily: 'serif'
});
```

### EpubReader Component (October 2025) ⭐

**Файл:** `frontend/src/components/Reader/EpubReader.tsx` (835 строк)

**Technology Stack:**
- **epub.js 0.3.93** - EPUB парсинг и рендеринг
- **react-reader 2.0.15** - React wrapper для epub.js
- **CFI System** - Canonical Fragment Identifiers для точной навигации

**Core Features:**

#### 1. Professional EPUB Rendering
```typescript
import { ReactReader } from 'react-reader';

const EpubReader: React.FC<EpubReaderProps> = ({ bookId }) => {
  const [location, setLocation] = useState<string | number>(0);
  const renditionRef = useRef<Rendition | null>(null);

  return (
    <ReactReader
      url={`/api/v1/books/${bookId}/file`}
      location={location}
      locationChanged={handleLocationChange}
      getRendition={(rendition) => {
        renditionRef.current = rendition;
        applyCustomStyles(rendition);
        applyDescriptionHighlights(rendition);
      }}
    />
  );
};
```

#### 2. CFI-based Progress Tracking
```typescript
// Hybrid система: CFI + scroll offset для точности
const handleLocationChange = useCallback((epubcfi: string) => {
  // Extract CFI
  const cfi = epubcfi;

  // Calculate scroll offset
  const iframe = document.querySelector('.epub-view iframe');
  const scrollOffset = calculateScrollOffset(iframe);

  // Save progress (debounced)
  debouncedSaveProgress({
    reading_location_cfi: cfi,
    scroll_offset_percent: scrollOffset,
    current_chapter: getCurrentChapterFromCFI(cfi)
  });
}, [bookId]);

function calculateScrollOffset(iframe: HTMLIFrameElement): number {
  const doc = iframe?.contentDocument?.documentElement;
  if (!doc) return 0;

  const scrollableHeight = doc.scrollHeight - doc.clientHeight;
  return scrollableHeight > 0
    ? (doc.scrollTop / scrollableHeight) * 100
    : 0;
}
```

#### 3. Smart Highlights Integration (Multi-NLP)
```typescript
const applyDescriptionHighlights = useCallback((rendition: Rendition) => {
  if (!descriptions.length) return;

  descriptions.forEach(desc => {
    // Create highlight annotation
    rendition.annotations.highlight(
      desc.epub_cfi,  // Position in EPUB
      {},
      (e) => handleDescriptionClick(desc.id),  // Click handler
      'description-highlight',  // CSS class
      {
        'fill': 'yellow',
        'fill-opacity': '0.3',
        'mix-blend-mode': 'multiply'
      }
    );
  });
}, [descriptions]);

// Handle description click → show modal with image gen option
const handleDescriptionClick = (descriptionId: string) => {
  const description = descriptions.find(d => d.id === descriptionId);

  setSelectedDescription(description);
  setShowImageModal(true);

  // Check if image already generated
  if (description.generated_image) {
    setImageStatus('completed');
  } else {
    setImageStatus('not_generated');
  }
};
```

#### 4. Position Restore on Load
```typescript
useEffect(() => {
  const restorePosition = async () => {
    // Fetch saved progress
    const progress = await fetchReadingProgress(bookId);

    if (progress?.reading_location_cfi) {
      // Navigate to saved CFI
      renditionRef.current?.display(progress.reading_location_cfi);

      // Apply scroll offset after render
      setTimeout(() => {
        const iframe = document.querySelector('.epub-view iframe');
        const doc = iframe?.contentDocument?.documentElement;

        if (doc && progress.scroll_offset_percent) {
          const scrollableHeight = doc.scrollHeight - doc.clientHeight;
          const targetScroll = (progress.scroll_offset_percent / 100) * scrollableHeight;
          doc.scrollTop = targetScroll;
        }
      }, 500);
    }
  };

  restorePosition();
}, [bookId]);
```

#### 5. Keyboard Navigation & Gestures
```typescript
useEffect(() => {
  const handleKeyPress = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowLeft':
        renditionRef.current?.prev();
        break;
      case 'ArrowRight':
      case ' ':  // Spacebar
        renditionRef.current?.next();
        break;
      case 'Home':
        renditionRef.current?.display(0);  // First page
        break;
      case 'End':
        renditionRef.current?.display('end');  // Last page
        break;
    }
  };

  window.addEventListener('keydown', handleKeyPress);
  return () => window.removeEventListener('keydown', handleKeyPress);
}, []);
```

#### 6. Image Generation Modal
```typescript
const ImageGenerationModal: React.FC<ModalProps> = ({
  description,
  show,
  onClose
}) => {
  const [imageStatus, setImageStatus] = useState<'not_generated' | 'generating' | 'completed' | 'failed'>('not_generated');
  const [image, setImage] = useState<GeneratedImage | null>(null);

  const handleGenerateImage = async () => {
    try {
      setImageStatus('generating');

      const result = await booksAPI.generateImageForDescription(description.id);

      setImage(result.image);
      setImageStatus('completed');
    } catch (error) {
      setImageStatus('failed');
    }
  };

  return (
    <Modal show={show} onClose={onClose}>
      <Modal.Header>{description.content}</Modal.Header>

      <Modal.Body>
        {imageStatus === 'not_generated' && (
          <Button onClick={handleGenerateImage}>Generate Image</Button>
        )}

        {imageStatus === 'generating' && (
          <Spinner text="Generating... (~20-30 seconds)" />
        )}

        {imageStatus === 'completed' && image && (
          <img src={image.image_url} alt={description.content} />
        )}

        {imageStatus === 'failed' && (
          <Alert variant="error">Failed to generate image</Alert>
        )}
      </Modal.Body>
    </Modal>
  );
};
```

#### 7. Custom Styling & Themes
```typescript
const applyCustomStyles = (rendition: Rendition) => {
  const { theme, fontSize, fontFamily, lineHeight } = readerSettings;

  // Theme-specific styles
  const styles = {
    dark: {
      'body': {
        'background-color': '#1a1a1a !important',
        'color': '#e0e0e0 !important'
      }
    },
    light: {
      'body': {
        'background-color': '#ffffff !important',
        'color': '#000000 !important'
      }
    },
    sepia: {
      'body': {
        'background-color': '#f4ecd8 !important',
        'color': '#5c4a2f !important'
      }
    }
  };

  // Apply theme
  rendition.themes.override('body', styles[theme].body);

  // Apply typography
  rendition.themes.fontSize(`${fontSize}px`);
  rendition.themes.font(fontFamily);
  rendition.themes.override('*', {
    'line-height': `${lineHeight} !important`
  });
};
```

**Performance Optimizations:**

- **Lazy loading** - renders only visible pages
- **Debounced saving** - batches progress updates
- **Efficient highlights** - SVG-based annotations
- **Memory management** - cleans up previous chapter renders
- **Touch gestures** - swipe для mobile navigation

### BookReader Component (Legacy)

**Файл:** `frontend/src/components/Reader/BookReader.tsx`

**Note:** This is being phased out in favor of EpubReader (October 2025).

**Возможности:**
- **Умная пагинация** с адаптацией под размер экрана
- **Выделение описаний** в тексте с hover эффектами
- **Клики по описаниям** для показа модальных окон с изображениями
- **Автосохранение прогресса** каждые 1-2 секунды
- **Keyboard navigation** (стрелки, пробел, Home/End)
- **Responsive design** для всех устройств

### API Client

**Файл:** `frontend/src/api/client.ts`

**Особенности:**
- **Автоматический refresh JWT токенов**
- **Типизированные запросы** (TypeScript interfaces)
- **Error handling** с retry логикой
- **Request/response interceptors**
- **File upload** с progress tracking

```typescript
const api = new APIClient('/api/v1');

// Автоматическое обновление токенов
api.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await api.refreshTokens();
      return api.request(error.config);
    }
  }
);
```

---

## 🗄️ Database Components

### Models Architecture

**UUID Primary Keys** для всех сущностей
**Temporal Fields** - created_at, updated_at для аудита
**JSON Fields** - гибкое хранение метаданных
**Enum Types** - ограниченные наборы значений
**Cascade Operations** - автоматическая очистка связанных данных

### Key Relationships

```
User (1) → (N) Books → (N) Chapters → (N) Descriptions → (N) Generated Images
                  ↘ (N) Reading Progress
```

### Performance Indexes

```sql
-- Композитные индексы для частых запросов
CREATE INDEX idx_books_user_created ON books(user_id, created_at DESC);
CREATE INDEX idx_descriptions_type_priority ON descriptions(type, priority_score DESC);

-- Partial индексы для оптимизации
CREATE INDEX idx_books_unparsed ON books(user_id) WHERE is_parsed = false;
CREATE INDEX idx_images_completed ON generated_images(description_id) WHERE status = 'completed';
```

---

## 🔐 Security Components

### JWT Authentication

**Access Token** - 30 минут, для API запросов
**Refresh Token** - 7 дней, для обновления access token
**Bcrypt hashing** - защита паролей
**Token rotation** - автоматическое обновление токенов

### API Security

```python
# Rate limiting
@limiter.limit("100/hour")
async def api_endpoint():
    pass

# Input validation
class BookUpload(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    file_size: int = Field(gt=0, le=52428800)  # max 50MB

# Permission checks
async def check_book_access(book_id: UUID, user_id: UUID):
    if book.user_id != user_id:
        raise HTTPException(403, "Access denied")
```

---

## 🚀 Production Components

### Docker Setup

**Multi-stage builds** для оптимизации размеров образов
**Non-root users** для безопасности
**Health checks** для всех сервисов
**Resource limits** и restart policies

### Nginx Configuration

```nginx
# Security headers
add_header X-Frame-Options "SAMEORIGIN";
add_header X-Content-Type-Options "nosniff";
add_header X-XSS-Protection "1; mode=block";

# Rate limiting
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
limit_req zone=api burst=20 nodelay;

# SSL/TLS configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256;
```

### Monitoring Stack

**Grafana** - метрики и дашборды
**Prometheus** - сбор метрик
**Loki** - централизованное логирование
**cAdvisor** - метрики контейнеров

---

## 🧪 Testing Components

### Backend Testing

```python
# Unit tests
pytest backend/tests/unit/

# Integration tests  
pytest backend/tests/integration/

# Coverage report
pytest --cov=app --cov-report=html
```

### Frontend Testing

```bash
# Unit tests (Vitest)
npm test

# Component tests
npm run test:components

# E2E tests (Playwright)
npm run test:e2e
```

### Test Utilities

```python
# Factory pattern для создания тестовых объектов
user = UserFactory.create(email="test@example.com")
book = BookFactory.create(user_id=user.id, title="Test Book")

# Mock services
@pytest.fixture
def mock_nlp_processor():
    processor = Mock(spec=NLPProcessor)
    processor.extract_descriptions.return_value = [test_description]
    return processor
```

---

## 📝 Configuration Components

### Environment Variables

```env
# Core settings
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/db
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your-secret-key-here

# AI Services
POLLINATIONS_ENABLED=true
OPENAI_API_KEY=sk-...

# Performance
WORKERS_COUNT=4
CELERY_WORKERS=2
MAX_FILE_SIZE=52428800

# Security
CORS_ORIGINS=https://yourdomain.com
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=30
JWT_REFRESH_TOKEN_EXPIRE_DAYS=7
```

### Settings Classes

```python
class Settings(BaseSettings):
    # Database
    database_url: str
    
    # Security
    secret_key: str = Field(min_length=32)
    jwt_algorithm: str = "HS256"
    
    # File handling
    max_file_size: int = 50 * 1024 * 1024  # 50MB
    upload_path: Path = Path("./storage")
    
    class Config:
        env_file = ".env"
        case_sensitive = False
```

---

## 🔧 Development Tools

### Scripts

```bash
# Database migrations
alembic upgrade head
alembic revision --autogenerate -m "description"

# Development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Celery worker
celery -A app.core.celery_app worker --loglevel=info

# Frontend development
npm run dev
```

### Code Quality

```bash
# Python
ruff check .          # Linting
black .               # Formatting
mypy app/            # Type checking

# TypeScript  
eslint src/          # Linting
prettier --write src/  # Formatting
tsc --noEmit         # Type checking
```

---

## 📊 Performance Metrics

### Expected Performance

- **API Response Time**: < 200ms average
- **Book Upload**: < 5 seconds for 10MB file
- **Image Generation**: < 30 seconds average
- **Page Load Time**: < 2 seconds initial load
- **NLP Processing**: ~0.5 seconds per 1000 characters

### Scalability Targets

- **Concurrent Users**: 1000+
- **Books in System**: 100,000+
- **Daily Image Generations**: 10,000+
- **Database Size**: Up to 100GB
- **Storage Requirements**: Up to 1TB

---

## 🎯 Key Features Summary

### ✅ Implemented Features

- **JWT Authentication** with automatic token refresh
- **EPUB/FB2 Book Parsing** with metadata extraction
- **NLP Description Extraction** (spaCy + rule-based)
- **AI Image Generation** (Pollinations.ai integration)
- **Progressive Web App** with offline support
- **Responsive Book Reader** with customizable settings
- **Real-time Progress Tracking** across devices
- **Production Deployment** with SSL and monitoring

### 📈 Performance Optimizations

- **Database Indexing** для частых запросов
- **Redis Caching** для API responses
- **Lazy Loading** для изображений и компонентов
- **Batch Processing** для массовых операций
- **CDN Ready** для статических файлов

### 🛡️ Security Features

- **Password Hashing** (bcrypt)
- **CORS Protection** с whitelist доменов
- **Rate Limiting** по IP адресам
- **Input Validation** на всех уровнях
- **SQL Injection Protection** (SQLAlchemy ORM)
- **XSS Protection** через sanitization

---

## 🔗 Component Dependencies

### Core Dependencies

```
FastAPI → SQLAlchemy → PostgreSQL
React → TypeScript → Vite
Celery → Redis → Background Tasks
Docker → Nginx → Production Deployment
```

### External Services

```
spaCy (ru_core_news_lg) → NLP Processing
Pollinations.ai → Image Generation  
Let's Encrypt → SSL Certificates
Grafana/Prometheus → Monitoring
```

---

Эта документация покрывает все основные компоненты системы BookReader AI и служит быстрым справочником для разработчиков и администраторов.