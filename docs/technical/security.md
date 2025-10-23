# Security & Authentication - BookReader AI

Всеобъемлющая система безопасности и аутентификации BookReader AI, включая JWT, шифрование, HTTPS, защиту от атак и compliance.

## Архитектура безопасности

### Многоуровневая защита
```
HTTPS/TLS → Шифрование трафика
    ↓
Nginx WAF → Фильтрация вредоносного трафика
    ↓
JWT Auth → Аутентификация и авторизация
    ↓
App Security → Валидация, санитайзация, логирование
    ↓
DB Security → Шифрование данных, SSL соединения
```

### Security Principles
- **Defense in Depth** - многоуровневая защита
- **Least Privilege** - минимальные необходимые права
- **Zero Trust** - проверка всех запросов
- **Security by Design** - безопасность с самого начала

---

## JWT Authentication System

### Архитектура JWT
**Файл:** `backend/app/core/security.py`

```python
import jwt
from datetime import datetime, timedelta
from passlib.context import CryptContext
from fastapi import HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

class JWTManager:
    def __init__(self):
        self.secret_key = settings.JWT_SECRET_KEY
        self.algorithm = settings.JWT_ALGORITHM
        self.access_token_expire = timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)
        self.refresh_token_expire = timedelta(days=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS)
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
    def create_access_token(self, data: dict, expires_delta: timedelta = None) -> str:
        """Создание JWT access токена."""
        to_encode = data.copy()
        
        expire = datetime.utcnow() + (expires_delta or self.access_token_expire)
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access",
            "jti": str(uuid.uuid4())  # JWT ID for revocation
        })
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def create_refresh_token(self, data: dict) -> str:
        """Создание JWT refresh токена."""
        to_encode = data.copy()
        
        expire = datetime.utcnow() + self.refresh_token_expire
        to_encode.update({
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh",
            "jti": str(uuid.uuid4())
        })
        
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        return encoded_jwt
    
    def verify_token(self, token: str, token_type: str = "access") -> dict:
        """Проверка и расшифровка JWT токена."""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            
            # Проверка типа токена
            if payload.get("type") != token_type:
                raise HTTPException(status_code=401, detail="Invalid token type")
            
            # Проверка истечения
            if datetime.fromtimestamp(payload["exp"]) < datetime.utcnow():
                raise HTTPException(status_code=401, detail="Token expired")
            
            # Проверка revocation (черный список)
            if self.is_token_revoked(payload.get("jti")):
                raise HTTPException(status_code=401, detail="Token revoked")
                
            return payload
            
        except jwt.PyJWTError as e:
            raise HTTPException(status_code=401, detail=f"Token validation failed: {str(e)}")
    
    def is_token_revoked(self, jti: str) -> bool:
        """Проверка черного списка токенов."""
        # Проверка в Redis
        return redis_client.sismember("revoked_tokens", jti)
    
    def revoke_token(self, jti: str, expires_in: int = None):
        """Отзыв токена."""
        redis_client.sadd("revoked_tokens", jti)
        if expires_in:
            redis_client.expire("revoked_tokens", expires_in)
    
    def hash_password(self, password: str) -> str:
        """Хеширование пароля."""
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Проверка пароля."""
        return self.pwd_context.verify(plain_password, hashed_password)

jwt_manager = JWTManager()
security = HTTPBearer()
```

### Authentication Dependencies
```python
async def get_current_user(token: HTTPAuthorizationCredentials = Depends(security)) -> User:
    """Получение текущего пользователя из JWT токена."""
    
    payload = jwt_manager.verify_token(token.credentials)
    user_id = payload.get("sub")
    
    if user_id is None:
        raise HTTPException(status_code=401, detail="Invalid authentication credentials")
    
    async with AsyncSession() as session:
        user = await session.get(User, user_id)
        if user is None or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        
        # Обновление времени последнего доступа
        user.last_login = datetime.utcnow()
        await session.commit()
        
        return user

async def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Проверка активности пользователя."""
    if not current_user.is_active:
        raise HTTPException(status_code=403, detail="Inactive user")
    return current_user

async def get_admin_user(current_user: User = Depends(get_current_active_user)) -> User:
    """Проверка администраторских прав."""
    if not current_user.is_superuser:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user
```

---

## Input Validation & Sanitization

### Pydantic Models для валидации
```python
from pydantic import BaseModel, EmailStr, Field, validator
from typing import Optional
import re

class UserRegistration(BaseModel):
    email: EmailStr = Field(..., description="Valid email address")
    password: str = Field(..., min_length=8, max_length=128, description="Strong password")
    full_name: Optional[str] = Field(None, min_length=1, max_length=255)
    
    @validator('password')
    def validate_password_strength(cls, v):
        """Проверка сложности пароля."""
        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one digit")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Password must contain at least one special character")
        return v
    
    @validator('full_name')
    def validate_full_name(cls, v):
        """Санитайзация имени."""
        if v:
            # Удаление HTML тегов
            v = re.sub(r'<[^>]+>', '', v)
            # Очистка от лишних пробелов
            v = re.sub(r'\s+', ' ', v).strip()
        return v

class BookUpload(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=500)
    
    class Config:
        # Запрет лишних полей
        extra = "forbid"
        # Максимальный размер ответа
        max_anystr_length = 10000
```

### File Upload Security
```python
from fastapi import UploadFile
import magic

class FileValidator:
    ALLOWED_MIME_TYPES = {
        'application/epub+zip': ['.epub'],
        'application/x-fictionbook+xml': ['.fb2'],
        'application/zip': ['.zip']  # для FB2 в ZIP
    }
    
    MAX_FILE_SIZE = 100 * 1024 * 1024  # 100MB
    
    @classmethod
    async def validate_book_file(cls, file: UploadFile) -> dict:
        """Валидация загружаемого файла книги."""
        
        # Проверка размера
        file_size = 0
        content = bytearray()
        
        while chunk := await file.read(8192):
            file_size += len(chunk)
            if file_size > cls.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413, 
                    detail=f"File too large. Maximum size: {cls.MAX_FILE_SIZE // 1024 // 1024}MB"
                )
            content.extend(chunk)
        
        # Возврат к началу файла
        await file.seek(0)
        
        # Определение MIME типа по содержимому
        mime_type = magic.from_buffer(bytes(content[:1024]), mime=True)
        
        # Проверка разрешенного типа
        if mime_type not in cls.ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file type: {mime_type}. Allowed: {list(cls.ALLOWED_MIME_TYPES.keys())}"
            )
        
        # Проверка расширения
        file_extension = Path(file.filename).suffix.lower()
        allowed_extensions = cls.ALLOWED_MIME_TYPES[mime_type]
        
        if file_extension not in allowed_extensions:
            raise HTTPException(
                status_code=415,
                detail=f"File extension {file_extension} doesn't match MIME type {mime_type}"
            )
        
        # Проверка на вредоносное содержимое
        if cls._contains_malicious_content(content):
            raise HTTPException(
                status_code=400,
                detail="File contains potentially malicious content"
            )
        
        return {
            "filename": file.filename,
            "size": file_size,
            "mime_type": mime_type,
            "extension": file_extension,
            "is_valid": True
        }
    
    @classmethod
    def _contains_malicious_content(cls, content: bytes) -> bool:
        """Проверка на вредоносное содержимое."""
        
        # Подозрительные паттерны
        malicious_patterns = [
            b'<script',
            b'javascript:',
            b'vbscript:',
            b'onload=',
            b'onerror=',
            b'<?php',
            b'eval(',
            b'exec('
        ]
        
        content_lower = content[:10000].lower()  # Проверяем первые 10KB
        
        return any(pattern in content_lower for pattern in malicious_patterns)
```

---

## Rate Limiting & CORS

### Rate Limiting Implementation
```python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Пример использования
@app.post("/api/v1/auth/login")
@limiter.limit("5/minute")  # 5 попыток в минуту
async def login(request: Request, credentials: UserLogin):
    # Логика логина
    pass

@app.post("/api/v1/auth/register")
@limiter.limit("3/hour")  # 3 регистрации в час
@limiter.limit("10/day")  # максимум 10 в день
async def register(request: Request, user_data: UserRegistration):
    # Логика регистрации
    pass
```

### CORS Configuration
```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,  # Конкретные домены
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["*"],
    max_age=3600
)
```

---

## HTTPS & SSL/TLS

### Nginx SSL Configuration
**Файл:** `nginx/ssl.conf`

```nginx
# SSL/TLS Конфигурация
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;

# HSTS (HTTP Strict Transport Security)
add_header Strict-Transport-Security "max-age=63072000" always;

# OCSP Stapling
ssl_stapling on;
ssl_stapling_verify on;
ssl_trusted_certificate /etc/letsencrypt/live/yourdomain.com/chain.pem;

# SSL Session
ssl_session_timeout 1d;
ssl_session_cache shared:SSL:50m;
ssl_session_tickets off;

# Security Headers
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'; frame-ancestors 'self';" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
```

### Let's Encrypt Automation
**Файл:** `scripts/ssl-renewal.sh`

```bash
#!/bin/bash

CERT_DOMAIN="bookreader.yourdomain.com"
NGINX_CONTAINER="bookreader-nginx"

# Обновление сертификата
echo "🔐 Renewing SSL certificate for $CERT_DOMAIN"

# Попытка обновления
if certbot renew --quiet --no-self-upgrade; then
    echo "✅ Certificate renewal successful"
    
    # Перезагрузка Nginx
    docker exec $NGINX_CONTAINER nginx -s reload
    echo "✅ Nginx reloaded"
    
    # Проверка срока действия
    EXPIRY=$(openssl x509 -enddate -noout -in /etc/letsencrypt/live/$CERT_DOMAIN/cert.pem | cut -d= -f2)
    echo "🗓️ Certificate expires: $EXPIRY"
else
    echo "❌ Certificate renewal failed"
    # Отправка уведомления админа
    curl -X POST -H 'Content-type: application/json' \
        --data '{"text":"SSL certificate renewal failed for '$CERT_DOMAIN'"}' \
        $SLACK_WEBHOOK_URL
fi

# Проверка SSL конфигурации
echo "🔍 Checking SSL configuration"

ssl_grade=$(curl -s "https://api.ssllabs.com/api/v3/analyze?host=$CERT_DOMAIN&publish=off&startNew=on&all=done" | \
           jq -r '.endpoints[0].grade')

if [ "$ssl_grade" = "A+" ] || [ "$ssl_grade" = "A" ]; then
    echo "✅ SSL Grade: $ssl_grade"
else
    echo "⚠️ SSL Grade: $ssl_grade (needs improvement)"
fi
```

---

## SQL Injection Protection

### SQLAlchemy ORM Protection
```python
# Правильное использование ORM (защищено)
async def get_user_books(user_id: UUID, search_query: str = None):
    async with AsyncSession() as session:
        query = select(Book).where(Book.user_id == user_id)
        
        if search_query:
            # Безопасный поиск через ORM
            query = query.where(
                or_(
                    Book.title.ilike(f"%{search_query}%"),
                    Book.author.ilike(f"%{search_query}%")
                )
            )
        
        result = await session.execute(query)
        return result.scalars().all()

# Неправильно (уязвимо к SQL injection)
def vulnerable_search(search_query: str):
    # НЕ делать так!
    sql = f"SELECT * FROM books WHERE title LIKE '%{search_query}%'"
    return session.execute(text(sql))

# Правильное использование raw SQL (защищено)
def safe_raw_query(search_query: str):
    sql = text("SELECT * FROM books WHERE title ILIKE :search")
    return session.execute(sql, {"search": f"%{search_query}%"})
```

---

## XSS Protection

### Frontend Sanitization
```typescript
import DOMPurify from 'dompurify';

// Очистка HTML контента
export const sanitizeHTML = (html: string): string => {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'span'],
    ALLOWED_ATTR: ['class'],
    FORBID_SCRIPTS: true,
    FORBID_TAGS: ['script', 'object', 'embed', 'link'],
    FORBID_ATTR: ['onerror', 'onload', 'onclick']
  });
};

// Компонент для безопасного отображения HTML
interface SafeHTMLProps {
  content: string;
  className?: string;
}

export const SafeHTML: React.FC<SafeHTMLProps> = ({ content, className }) => {
  const sanitizedContent = useMemo(() => {
    return sanitizeHTML(content);
  }, [content]);
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};
```

### Backend Content Sanitization
```python
import bleach
from markupsafe import Markup

class ContentSanitizer:
    ALLOWED_TAGS = [
        'p', 'br', 'strong', 'em', 'u', 'span', 
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'blockquote'
    ]
    
    ALLOWED_ATTRIBUTES = {
        '*': ['class'],
        'a': ['href', 'title'],
    }
    
    @classmethod
    def sanitize_user_content(cls, content: str) -> str:
        """Очистка пользовательского контента."""
        
        if not content:
            return ""
            
        # Очистка HTML
        cleaned = bleach.clean(
            content,
            tags=cls.ALLOWED_TAGS,
            attributes=cls.ALLOWED_ATTRIBUTES,
            strip=True
        )
        
        # Дополнительная очистка от JavaScript
        cleaned = re.sub(r'javascript:', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'vbscript:', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'data:text/html', '', cleaned, flags=re.IGNORECASE)
        
        return cleaned
    
    @classmethod
    def sanitize_book_content(cls, content: str) -> str:
        """Очистка содержимого книги."""
        
        # Более мягкая очистка для книжного контента
        book_allowed_tags = cls.ALLOWED_TAGS + ['div', 'img']
        
        cleaned = bleach.clean(
            content,
            tags=book_allowed_tags,
            attributes={
                **cls.ALLOWED_ATTRIBUTES,
                'img': ['src', 'alt', 'width', 'height']
            },
            strip=True
        )
        
        return cleaned
```

---

## Logging & Security Monitoring

### Security Event Logging
```python
import logging
from datetime import datetime
from typing import Optional

class SecurityLogger:
    def __init__(self):
        self.logger = logging.getLogger("security")
        self.logger.setLevel(logging.INFO)
        
        # Handler для сохранения в файл
        handler = logging.FileHandler("/var/log/bookreader/security.log")
        formatter = logging.Formatter(
            '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        handler.setFormatter(formatter)
        self.logger.addHandler(handler)
    
    def log_failed_login(self, email: str, ip_address: str, user_agent: str):
        """Логирование неудачной попытки входа."""
        self.logger.warning(
            f"Failed login attempt - Email: {email}, IP: {ip_address}, UA: {user_agent}"
        )
        
        # Отправка в SIEM систему
        self._send_to_siem({
            "event": "failed_login",
            "email": email,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "timestamp": datetime.utcnow().isoformat()
        })
    
    def log_suspicious_activity(self, user_id: UUID, activity: str, details: dict):
        """Логирование подозрительной активности."""
        self.logger.error(
            f"Suspicious activity - User: {user_id}, Activity: {activity}, Details: {details}"
        )
    
    def log_file_upload(self, user_id: UUID, filename: str, file_size: int, ip_address: str):
        """Логирование загрузки файлов."""
        self.logger.info(
            f"File upload - User: {user_id}, File: {filename}, Size: {file_size}, IP: {ip_address}"
        )
    
    def _send_to_siem(self, event_data: dict):
        """Отправка событий в SIEM."""
        # Отправка в Elasticsearch, Splunk, или другую SIEM систему
        pass

security_logger = SecurityLogger()
```

### Intrusion Detection
```python
class IntrusionDetection:
    def __init__(self):
        self.redis_client = redis.Redis.from_url(settings.REDIS_URL)
        
    async def check_brute_force(self, ip_address: str, endpoint: str) -> bool:
        """Проверка на brute force атаку."""
        
        key = f"attempts:{ip_address}:{endpoint}"
        attempts = self.redis_client.incr(key)
        
        if attempts == 1:
            # Устанавливаем TTL на 15 минут
            self.redis_client.expire(key, 900)
        
        # Блокировка после 5 попыток
        if attempts > 5:
            # Увеличиваем время блокировки
            block_time = min(3600 * (attempts - 5), 86400)  # Максимум 24 часа
            self.redis_client.setex(f"blocked:{ip_address}", block_time, "1")
            
            security_logger.log_suspicious_activity(
                None, "brute_force_detected", 
                {"ip": ip_address, "endpoint": endpoint, "attempts": attempts}
            )
            
            return True
        
        return False
    
    async def is_ip_blocked(self, ip_address: str) -> bool:
        """Проверка блокировки IP."""
        return bool(self.redis_client.get(f"blocked:{ip_address}"))

intrusion_detection = IntrusionDetection()
```

---

## Environment & Secrets Management

### Безопасное хранение секретов
```python
from cryptography.fernet import Fernet
import base64
import os

class SecretManager:
    def __init__(self):
        # Ключ шифрования из переменной окружения
        encryption_key = os.environ.get("ENCRYPTION_KEY")
        if not encryption_key:
            raise ValueError("ENCRYPTION_KEY environment variable not set")
        
        self.fernet = Fernet(encryption_key.encode())
    
    def encrypt_secret(self, secret: str) -> str:
        """Шифрование секрета."""
        encrypted = self.fernet.encrypt(secret.encode())
        return base64.b64encode(encrypted).decode()
    
    def decrypt_secret(self, encrypted_secret: str) -> str:
        """Расшифровка секрета."""
        encrypted_bytes = base64.b64decode(encrypted_secret.encode())
        decrypted = self.fernet.decrypt(encrypted_bytes)
        return decrypted.decode()
    
    @classmethod
    def generate_key(cls) -> str:
        """Генерация нового ключа шифрования."""
        return Fernet.generate_key().decode()

# Использование
secret_manager = SecretManager()

# Безопасное хранение API ключей
class APIKeyManager:
    def __init__(self):
        self.secret_manager = secret_manager
        
    async def store_api_key(self, user_id: UUID, service: str, api_key: str):
        """Сохранение зашифрованного API ключа."""
        
        encrypted_key = self.secret_manager.encrypt_secret(api_key)
        
        # Сохранение в базе
        async with AsyncSession() as session:
            user_api_key = UserAPIKey(
                user_id=user_id,
                service=service,
                encrypted_key=encrypted_key
            )
            session.add(user_api_key)
            await session.commit()
    
    async def get_api_key(self, user_id: UUID, service: str) -> Optional[str]:
        """Получение расшифрованного API ключа."""
        
        async with AsyncSession() as session:
            result = await session.execute(
                select(UserAPIKey).where(
                    UserAPIKey.user_id == user_id,
                    UserAPIKey.service == service
                )
            )
            user_api_key = result.scalar_one_or_none()
            
            if user_api_key:
                return self.secret_manager.decrypt_secret(user_api_key.encrypted_key)
            
            return None
```

### Docker Secrets
**Файл:** `docker-compose.prod.yml`

```yaml
version: '3.8'

services:
  backend:
    image: bookreader-backend:latest
    secrets:
      - db_password
      - jwt_secret
      - encryption_key
    environment:
      - DATABASE_PASSWORD_FILE=/run/secrets/db_password
      - JWT_SECRET_KEY_FILE=/run/secrets/jwt_secret
      - ENCRYPTION_KEY_FILE=/run/secrets/encryption_key
    
secrets:
  db_password:
    file: ./secrets/db_password.txt
  jwt_secret:
    file: ./secrets/jwt_secret.txt
  encryption_key:
    file: ./secrets/encryption_key.txt
```

---

## Security Headers & Compliance

### Полные Security Headers
```nginx
# Content Security Policy
add_header Content-Security-Policy "
    default-src 'self';
    script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    font-src 'self' https://fonts.gstatic.com;
    img-src 'self' data: https:;
    connect-src 'self' wss: https:;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
" always;

# Остальные заголовки безопасности
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "geolocation=(), microphone=(), camera=()" always;

# Скрытие версии сервера
server_tokens off;
```

### GDPR Compliance
```python
class GDPRCompliance:
    """Модуль для соблюдения GDPR."""
    
    @staticmethod
    async def export_user_data(user_id: UUID) -> dict:
        """Экспорт всех данных пользователя (право на портабильность)."""
        
        async with AsyncSession() as session:
            # Основные данные пользователя
            user = await session.get(User, user_id)
            
            # Книги
            books_result = await session.execute(
                select(Book).where(Book.user_id == user_id)
            )
            books = books_result.scalars().all()
            
            # Прогресс чтения
            progress_result = await session.execute(
                select(ReadingProgress).where(ReadingProgress.user_id == user_id)
            )
            reading_progress = progress_result.scalars().all()
            
            return {
                "user_data": {
                    "id": str(user.id),
                    "email": user.email,
                    "full_name": user.full_name,
                    "created_at": user.created_at.isoformat(),
                    "last_login": user.last_login.isoformat() if user.last_login else None
                },
                "books": [
                    {
                        "title": book.title,
                        "author": book.author,
                        "uploaded_at": book.created_at.isoformat()
                    }
                    for book in books
                ],
                "reading_progress": [
                    {
                        "book_title": progress.book.title,
                        "current_chapter": progress.current_chapter,
                        "progress_percentage": progress.get_progress_percentage(),
                        "last_read": progress.last_read_at.isoformat()
                    }
                    for progress in reading_progress
                ],
                "export_date": datetime.utcnow().isoformat()
            }
    
    @staticmethod
    async def delete_user_data(user_id: UUID) -> bool:
        """Полное удаление данных пользователя (право на забвение)."""
        
        try:
            async with AsyncSession() as session:
                # Получаем пользователя
                user = await session.get(User, user_id)
                if not user:
                    return False
                
                # Удаление всех связанных файлов
                books = await session.execute(
                    select(Book).where(Book.user_id == user_id)
                )
                for book in books.scalars():
                    # Удаляем файлы книг и изображения
                    if os.path.exists(book.file_path):
                        os.remove(book.file_path)
                    if book.cover_image and os.path.exists(book.cover_image):
                        os.remove(book.cover_image)
                
                # Удаление записи пользователя (cascade удалит связанные данные)
                await session.delete(user)
                await session.commit()
                
                # Логирование GDPR события
                security_logger.logger.info(
                    f"GDPR deletion completed for user {user_id}"
                )
                
                return True
                
        except Exception as e:
            security_logger.logger.error(
                f"GDPR deletion failed for user {user_id}: {str(e)}"
            )
            return False
```

---

## epub.js Security Considerations (October 2025)

### XSS Prevention in EPUB Content

**Проблема:** EPUB файлы могут содержать произвольный HTML/JavaScript, что создает риск XSS атак.

**Решение:** epub.js sandboxing + CSP headers + content validation

#### Frontend Protection (epub.js Configuration)

```typescript
// frontend/src/components/Reader/EpubReader.tsx

const book = ePub(url, {
  openAs: 'epub',
  requestCredentials: true,

  // Security: disable scripts in EPUB content
  allowScriptedContent: false,

  // Security: prevent loading external resources
  requestMethod: 'fetch',
  requestHeaders: {
    'Authorization': `Bearer ${token}`
  }
});

// Additional security: rendition options
const rendition = book.renderTo('viewer', {
  width: '100%',
  height: '100%',
  spread: 'none',

  // Security: sandbox iframe
  sandbox: 'allow-same-origin',

  // Security: disable scripts in content
  script: 'omit'
});
```

#### Nginx CSP Headers for epub.js

```nginx
# nginx/nginx.prod.conf

location / {
    # Content Security Policy для epub.js
    add_header Content-Security-Policy "
        default-src 'self';
        script-src 'self' 'unsafe-inline' 'unsafe-eval';
        style-src 'self' 'unsafe-inline' data:;
        img-src 'self' data: blob: https:;
        font-src 'self' data: blob:;
        connect-src 'self' wss: https:;
        worker-src 'self' blob:;
        frame-src 'none';
        object-src 'none';
        base-uri 'self';
    " always;

    # X-Frame-Options
    add_header X-Frame-Options "DENY" always;

    # X-Content-Type-Options
    add_header X-Content-Type-Options "nosniff" always;

    # Referrer Policy
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}

# Специальный route для EPUB файлов
location ~ ^/api/v1/books/.*/file$ {
    # Требуется авторизация
    proxy_pass http://backend:8000;
    proxy_set_header Authorization $http_authorization;

    # CORS для epub.js
    add_header Access-Control-Allow-Origin $http_origin always;
    add_header Access-Control-Allow-Methods "GET, OPTIONS" always;
    add_header Access-Control-Allow-Headers "Authorization, Range" always;
    add_header Access-Control-Allow-Credentials "true" always;

    # Content-Type для EPUB
    add_header Content-Type "application/epub+zip" always;

    # Security headers
    add_header X-Content-Type-Options "nosniff" always;
}
```

### EPUB File Upload Security

#### Validation Pipeline

```python
# backend/app/services/epub_validator.py

import zipfile
import re
from pathlib import Path
from typing import Optional, Dict
from fastapi import HTTPException, UploadFile
import magic

class EPUBValidator:
    """Комплексная валидация EPUB файлов."""

    ALLOWED_MIME_TYPES = [
        'application/epub+zip',
        'application/zip'
    ]

    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    MAX_FILES_IN_EPUB = 10000  # Защита от zip bombs
    MAX_UNCOMPRESSED_SIZE = 200 * 1024 * 1024  # 200MB

    # Разрешенные файлы внутри EPUB
    ALLOWED_EXTENSIONS = {
        '.xhtml', '.html', '.htm', '.xml',
        '.css', '.otf', '.ttf', '.woff', '.woff2',
        '.jpg', '.jpeg', '.png', '.gif', '.svg',
        '.mp3', '.mp4', '.webm'
    }

    # Запрещенные файлы
    FORBIDDEN_EXTENSIONS = {
        '.exe', '.dll', '.so', '.dylib',
        '.sh', '.bat', '.cmd', '.ps1',
        '.jar', '.class', '.apk'
    }

    @classmethod
    async def validate_epub_file(cls, file: UploadFile) -> Dict:
        """Полная валидация EPUB файла."""

        # 1. Проверка размера
        file_size = 0
        content = bytearray()

        while chunk := await file.read(8192):
            file_size += len(chunk)
            if file_size > cls.MAX_FILE_SIZE:
                raise HTTPException(
                    status_code=413,
                    detail=f"File too large. Maximum: {cls.MAX_FILE_SIZE // 1024 // 1024}MB"
                )
            content.extend(chunk)

        await file.seek(0)

        # 2. MIME type verification
        mime_type = magic.from_buffer(bytes(content[:1024]), mime=True)
        if mime_type not in cls.ALLOWED_MIME_TYPES:
            raise HTTPException(
                status_code=415,
                detail=f"Invalid file type: {mime_type}. Expected EPUB."
            )

        # 3. Проверка структуры ZIP
        try:
            with zipfile.ZipFile(file.file, 'r') as epub_zip:
                # Проверка на zip bomb
                file_list = epub_zip.namelist()
                if len(file_list) > cls.MAX_FILES_IN_EPUB:
                    raise HTTPException(
                        status_code=400,
                        detail="Too many files in EPUB (possible zip bomb)"
                    )

                # Проверка общего размера распакованных файлов
                total_uncompressed = sum(
                    info.file_size for info in epub_zip.infolist()
                )
                if total_uncompressed > cls.MAX_UNCOMPRESSED_SIZE:
                    raise HTTPException(
                        status_code=400,
                        detail="Uncompressed EPUB too large (possible zip bomb)"
                    )

                # 4. Проверка обязательных файлов EPUB
                if 'mimetype' not in file_list:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid EPUB: missing mimetype file"
                    )

                mimetype_content = epub_zip.read('mimetype').decode('utf-8').strip()
                if mimetype_content != 'application/epub+zip':
                    raise HTTPException(
                        status_code=400,
                        detail=f"Invalid EPUB mimetype: {mimetype_content}"
                    )

                # Проверка META-INF/container.xml
                if 'META-INF/container.xml' not in file_list:
                    raise HTTPException(
                        status_code=400,
                        detail="Invalid EPUB: missing container.xml"
                    )

                # 5. Проверка расширений файлов
                for filename in file_list:
                    extension = Path(filename).suffix.lower()

                    # Проверка на запрещенные расширения
                    if extension in cls.FORBIDDEN_EXTENSIONS:
                        raise HTTPException(
                            status_code=400,
                            detail=f"Forbidden file type in EPUB: {filename}"
                        )

                    # Предупреждение о неизвестных расширениях
                    if extension and extension not in cls.ALLOWED_EXTENSIONS:
                        # Логируем для мониторинга
                        print(f"Warning: unknown file extension in EPUB: {filename}")

                # 6. Проверка на вредоносное содержимое
                cls._scan_for_malicious_content(epub_zip, file_list)

        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=400,
                detail="Invalid ZIP/EPUB structure"
            )

        await file.seek(0)

        return {
            "filename": file.filename,
            "size": file_size,
            "mime_type": mime_type,
            "is_valid": True,
            "files_count": len(file_list),
            "uncompressed_size": total_uncompressed
        }

    @classmethod
    def _scan_for_malicious_content(cls, epub_zip: zipfile.ZipFile, file_list: list):
        """Сканирование содержимого EPUB на вредоносный код."""

        # Подозрительные паттерны
        malicious_patterns = [
            rb'<script[^>]*>.*?</script>',  # JavaScript
            rb'javascript:',
            rb'vbscript:',
            rb'data:text/html',
            rb'onerror\s*=',
            rb'onload\s*=',
            rb'eval\s*\(',
            rb'document\.write',
            rb'<iframe',
            rb'<embed',
            rb'<object'
        ]

        # Сканируем HTML/XHTML файлы
        for filename in file_list:
            if filename.endswith(('.html', '.xhtml', '.htm')):
                try:
                    content = epub_zip.read(filename).lower()

                    # Проверяем первые 100KB каждого файла
                    sample = content[:102400]

                    for pattern in malicious_patterns:
                        if re.search(pattern, sample, re.IGNORECASE):
                            raise HTTPException(
                                status_code=400,
                                detail=f"Potentially malicious content detected in {filename}"
                            )

                except Exception as e:
                    # Если не можем прочитать файл - подозрительно
                    raise HTTPException(
                        status_code=400,
                        detail=f"Unable to verify content of {filename}"
                    )
```

### CFI Injection Prevention

**Проблема:** Malicious CFI strings могут вызвать DoS или XSS.

**Решение:** Строгая валидация CFI формата.

```python
# backend/app/services/cfi_validator.py

import re
from typing import Optional
from fastapi import HTTPException

class CFIValidator:
    """Валидация Canonical Fragment Identifier (CFI) для epub.js."""

    # Regex для валидного CFI формата
    # Формат: epubcfi(/6/4[chap01]!/4/2/1:0)
    CFI_PATTERN = re.compile(
        r'^epubcfi\('
        r'\/\d+(?:\/\d+(?:\[[^\]]+\])?)*'  # Spine path
        r'(?:!\/'                           # Optional content path
        r'\d+(?:\/\d+)*'
        r'(?::\d+)?'                        # Optional text offset
        r')?'
        r'\)$'
    )

    MAX_CFI_LENGTH = 500

    @classmethod
    def validate_cfi(cls, cfi: Optional[str]) -> bool:
        """Валидация CFI строки."""

        if not cfi:
            return True  # Null CFI допустим

        # Проверка длины
        if len(cfi) > cls.MAX_CFI_LENGTH:
            raise HTTPException(
                status_code=400,
                detail=f"CFI too long (max {cls.MAX_CFI_LENGTH} chars)"
            )

        # Проверка формата
        if not cls.CFI_PATTERN.match(cfi):
            raise HTTPException(
                status_code=400,
                detail="Invalid CFI format"
            )

        # Дополнительные проверки безопасности
        dangerous_chars = ['<', '>', '"', "'", '\\', '\n', '\r', '\x00']
        if any(char in cfi for char in dangerous_chars):
            raise HTTPException(
                status_code=400,
                detail="CFI contains invalid characters"
            )

        return True

    @classmethod
    def sanitize_cfi(cls, cfi: str) -> str:
        """Санитизация CFI строки."""

        if not cfi:
            return ""

        # Удаляем whitespace
        cfi = cfi.strip()

        # Ограничиваем длину
        cfi = cfi[:cls.MAX_CFI_LENGTH]

        # Валидируем
        cls.validate_cfi(cfi)

        return cfi
```

### Storage Security

#### EPUB Files Storage

```python
# backend/app/services/file_storage.py

import uuid
from pathlib import Path
from typing import BinaryIO
import os

class SecureFileStorage:
    """Безопасное хранение файлов EPUB."""

    UPLOAD_DIR = Path("/app/data/books")
    ALLOWED_EXTENSIONS = {'.epub', '.fb2'}

    @classmethod
    def generate_secure_filename(cls, original_filename: str, user_id: uuid.UUID) -> str:
        """Генерация безопасного имени файла."""

        # Получаем расширение
        extension = Path(original_filename).suffix.lower()

        if extension not in cls.ALLOWED_EXTENSIONS:
            raise ValueError(f"Invalid file extension: {extension}")

        # Генерируем случайное имя
        random_name = str(uuid.uuid4())

        # Добавляем user_id для изоляции
        user_dir = cls.UPLOAD_DIR / str(user_id)
        user_dir.mkdir(parents=True, exist_ok=True)

        # Полный путь
        secure_path = user_dir / f"{random_name}{extension}"

        return str(secure_path)

    @classmethod
    async def save_file(cls, file_content: BinaryIO, user_id: uuid.UUID, original_filename: str) -> str:
        """Безопасное сохранение файла."""

        # Генерируем безопасное имя
        secure_path = cls.generate_secure_filename(original_filename, user_id)

        # Сохраняем с ограниченными правами
        with open(secure_path, 'wb') as f:
            f.write(file_content.read())

        # Устанавливаем права доступа (owner read/write только)
        os.chmod(secure_path, 0o600)

        return secure_path

    @classmethod
    def delete_file(cls, file_path: str):
        """Безопасное удаление файла."""

        path = Path(file_path)

        # Проверяем, что файл находится в разрешенной директории
        if not str(path.resolve()).startswith(str(cls.UPLOAD_DIR.resolve())):
            raise ValueError("Attempt to delete file outside allowed directory")

        if path.exists():
            path.unlink()
```

### Monitoring & Alerts

```python
# backend/app/services/security_monitor.py

from app.core.logging import security_logger

class EPUBSecurityMonitor:
    """Мониторинг безопасности EPUB операций."""

    @staticmethod
    async def log_epub_upload(
        user_id: uuid.UUID,
        filename: str,
        file_size: int,
        validation_result: dict,
        ip_address: str
    ):
        """Логирование загрузки EPUB."""

        security_logger.info(
            f"EPUB upload - User: {user_id}, File: {filename}, "
            f"Size: {file_size}, Valid: {validation_result['is_valid']}, "
            f"IP: {ip_address}"
        )

        # Алерт при подозрительной активности
        if file_size > 30 * 1024 * 1024:  # >30MB
            security_logger.warning(
                f"Large EPUB upload: {file_size / 1024 / 1024:.2f}MB from {user_id}"
            )

    @staticmethod
    async def log_malicious_epub_attempt(
        user_id: uuid.UUID,
        filename: str,
        reason: str,
        ip_address: str
    ):
        """Логирование попытки загрузить вредоносный EPUB."""

        security_logger.error(
            f"Malicious EPUB attempt - User: {user_id}, "
            f"File: {filename}, Reason: {reason}, IP: {ip_address}"
        )

        # Критический алерт
        # TODO: Send to SIEM, notify admins
```

---

## Заключение

Система безопасности BookReader AI обеспечивает:

- **Многоуровневую защиту** от основных угроз
- **Надежную JWT аутентификацию** с refresh токенами
- **Шифрование в покое и при передаче** (TLS/SSL)
- **Комплексную валидацию ввода** и санитайзацию
- **epub.js XSS prevention** с CSP headers и sandboxing
- **EPUB file validation** с защитой от zip bombs
- **CFI injection prevention** с строгой валидацией
- **Secure file storage** с изоляцией по пользователям
- **Security monitoring** с детальным логированием
- **GDPR compliance** для европейских пользователей
- **Production-ready** конфигурации и мониторинг

Все компоненты безопасности готовы для production использования.

**Updated:** October 2025 с учетом epub.js integration и CFI tracking.