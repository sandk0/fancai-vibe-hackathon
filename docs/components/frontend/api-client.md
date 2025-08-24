# API Client - BookReader AI

TypeScript клиент для взаимодействия с REST API BookReader AI. Обеспечивает типобезопасность, автоматическое обновление токенов и обработку ошибок.

## Архитектура клиента

### Основные возможности
- **Автоматическая аутентификация** с JWT токенами
- **Типизированные запросы** и ответы
- **Error handling** с retry логикой
- **Request/Response interceptors**
- **File upload** с progress tracking

### Структура
```
APIClient (базовый класс)
├── AuthAPI → аутентификация
├── BooksAPI → управление книгами
├── ImagesAPI → генерация изображений
├── NLPAPI → NLP обработка
└── UsersAPI → профили пользователей
```

---

## Базовый APIClient

**Файл:** `frontend/src/api/client.ts`

```typescript
class APIClient {
  private baseURL: string;
  private axios: AxiosInstance;
  private tokenRefreshPromise: Promise<boolean> | null = null;

  constructor(baseURL: string) {
    this.baseURL = baseURL;
    this.axios = axios.create({
      baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor - добавляем токен
    this.axios.interceptors.request.use((config) => {
      const token = useAuthStore.getState().accessToken;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor - обработка ошибок и refresh токенов
    this.axios.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          // Попытка обновления токена
          if (!this.tokenRefreshPromise) {
            this.tokenRefreshPromise = this.refreshTokens();
          }

          const refreshSuccess = await this.tokenRefreshPromise;
          this.tokenRefreshPromise = null;

          if (refreshSuccess) {
            // Повторяем оригинальный запрос
            const newToken = useAuthStore.getState().accessToken;
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return this.axios(originalRequest);
          }
        }

        return Promise.reject(this.handleAPIError(error));
      }
    );
  }

  private async refreshTokens(): Promise<boolean> {
    try {
      const refreshToken = useAuthStore.getState().refreshToken;
      if (!refreshToken) return false;

      const response = await axios.post(`${this.baseURL}/auth/refresh`, {
        refresh_token: refreshToken
      });

      const { access_token, refresh_token } = response.data;
      
      useAuthStore.setState({
        accessToken: access_token,
        refreshToken: refresh_token
      });

      return true;
    } catch (error) {
      useAuthStore.getState().logout();
      return false;
    }
  }

  private handleAPIError(error: AxiosError): APIError {
    const response = error.response;
    
    return {
      status: response?.status || 0,
      code: response?.data?.error?.code || 'UNKNOWN_ERROR',
      message: response?.data?.error?.message || error.message,
      details: response?.data?.error?.details
    };
  }
}
```

---

## Специализированные API классы

### BooksAPI
```typescript
export class BooksAPI {
  constructor(private client: APIClient) {}

  async getBooks(params: BookFilters): Promise<BooksResponse> {
    const response = await this.client.get<BooksResponse>('/books', { params });
    return response.data;
  }

  async uploadBook(file: File, onProgress?: (progress: number) => void): Promise<Book> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.client.post<{book: Book}>('/books/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (progressEvent) => {
        if (onProgress && progressEvent.total) {
          const progress = (progressEvent.loaded / progressEvent.total) * 100;
          onProgress(Math.round(progress));
        }
      }
    });

    return response.data.book;
  }

  async getBookContent(bookId: string, chapter: number): Promise<ChapterContent> {
    const response = await this.client.get<ChapterContent>(
      `/books/${bookId}/chapters/${chapter}`
    );
    return response.data;
  }

  async updateProgress(bookId: string, progress: ReadingProgress): Promise<ReadingProgress> {
    const response = await this.client.post<{progress: ReadingProgress}>(
      `/books/${bookId}/progress`, 
      progress
    );
    return response.data.progress;
  }
}
```

### ImagesAPI
```typescript
export class ImagesAPI {
  constructor(private client: APIClient) {}

  async generateImage(descriptionId: string, options?: GenerationOptions): Promise<GenerationTask> {
    const response = await this.client.post<{task: GenerationTask}>(
      `/images/generate/description/${descriptionId}`,
      options
    );
    return response.data.task;
  }

  async getBookImages(bookId: string, filters?: ImageFilters): Promise<ImagesResponse> {
    const response = await this.client.get<ImagesResponse>(
      `/images/book/${bookId}`,
      { params: filters }
    );
    return response.data;
  }

  async getGenerationStatus(): Promise<GenerationStatus> {
    const response = await this.client.get<GenerationStatus>('/images/generation/status');
    return response.data;
  }
}
```

---

## React Hooks для API

### useAPI Hook
```typescript
export const useAPI = () => {
  const apiClient = useMemo(() => {
    return new APIClient(process.env.REACT_APP_API_URL || '/api/v1');
  }, []);

  return {
    auth: new AuthAPI(apiClient),
    books: new BooksAPI(apiClient),
    images: new ImagesAPI(apiClient),
    users: new UsersAPI(apiClient),
    nlp: new NLPAPI(apiClient)
  };
};
```

### Query Hooks (React Query)
```typescript
export const useBooks = (filters: BookFilters) => {
  const { books: booksAPI } = useAPI();
  
  return useQuery({
    queryKey: ['books', filters],
    queryFn: () => booksAPI.getBooks(filters),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useBookContent = (bookId: string, chapter: number) => {
  const { books: booksAPI } = useAPI();
  
  return useQuery({
    queryKey: ['book-content', bookId, chapter],
    queryFn: () => booksAPI.getBookContent(bookId, chapter),
    enabled: !!bookId && chapter > 0,
  });
};

export const useBookUpload = () => {
  const { books: booksAPI } = useAPI();
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ file, onProgress }: { file: File; onProgress?: (progress: number) => void }) =>
      booksAPI.uploadBook(file, onProgress),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['books'] });
    },
  });
};
```

---

## Error Handling

### APIError Types
```typescript
interface APIError {
  status: number;
  code: string;
  message: string;
  details?: any;
}

const API_ERROR_MESSAGES: Record<string, string> = {
  'AUTHENTICATION_FAILED': 'Неверные учетные данные',
  'TOKEN_EXPIRED': 'Сессия истекла, требуется повторный вход',
  'QUOTA_EXCEEDED': 'Превышена квота вашего плана подписки',
  'FILE_TOO_LARGE': 'Файл слишком большой',
  'UNSUPPORTED_FORMAT': 'Неподдерживаемый формат файла'
};

export const getErrorMessage = (error: APIError): string => {
  return API_ERROR_MESSAGES[error.code] || error.message;
};
```

---

## WebSocket Integration

### Real-time Updates
```typescript
class WebSocketClient {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(token: string) {
    const wsUrl = `${process.env.REACT_APP_WS_URL}/ws?token=${token}`;
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleMessage(data);
    };

    this.ws.onclose = () => {
      this.handleReconnect();
    };
  }

  private handleMessage(message: WebSocketMessage) {
    switch (message.type) {
      case 'image_generation_complete':
        useImagesStore.getState().updateImageStatus(message.data);
        break;
      case 'book_processing_complete':
        useBooksStore.getState().updateBookStatus(message.data);
        break;
    }
  }
}
```

---

## Заключение

API клиент BookReader AI обеспечивает:

- **Типобезопасность** всех API взаимодействий
- **Автоматическое управление токенами** и аутентификацией
- **Graceful error handling** с retry механизмами
- **Performance optimizations** через React Query
- **Real-time updates** через WebSocket
- **Developer experience** с хуками и утилитами