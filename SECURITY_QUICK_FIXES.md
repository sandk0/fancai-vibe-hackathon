# Security Quick Fixes - Action Plan

**🔴 URGENT: Выполнить ДО production deployment**

## 1. Удалить Хардкод Credentials (15 минут)

### Fix create_admin.py
```bash
# Файл: backend/scripts/create_admin.py
# Строка 23: password = "Tre21bgU"  # ❌ УДАЛИТЬ!
```

**Замена:**
```python
import os
import secrets

email = os.getenv("ADMIN_EMAIL", "admin@fancai.ru")
password = os.getenv("ADMIN_PASSWORD")

if not password:
    password = secrets.token_urlsafe(16)
    print(f"🔑 Generated password: {password}")
    print("⚠️ SAVE THIS SECURELY!")
```

### Fix create_test_user.py
```bash
# Файл: backend/create_test_user.py
# Добавить в начало функции:
```

```python
# Prevent running in production
if not settings.DEBUG:
    print("❌ Cannot create test user in production!")
    sys.exit(1)
```

---

## 2. Удалить .env.development из Git (5 минут)

```bash
# Step 1: Remove from tracking
git rm --cached .env.development

# Step 2: Commit
git commit -m "security: remove .env.development from git tracking"

# Step 3: Update .gitignore (если нужно)
echo ".env.development" >> .gitignore

# Step 4: Push
git push origin main
```

**⚠️ ВАЖНО:** Если файл был в git долго - рассмотреть очистку истории:
```bash
# Using BFG Repo-Cleaner (recommended)
bfg --delete-files .env.development
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

---

## 3. Усилить CSP (30 минут)

### Файл: backend/app/middleware/security_headers.py

**Удалить:**
```python
"script-src": [
    "'self'",
    "'unsafe-inline'",  # ❌ REMOVE
    "'unsafe-eval'",    # ❌ REMOVE
],
```

**Заменить на:**
```python
import secrets

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate nonce for this request
        nonce = secrets.token_urlsafe(16)
        request.state.csp_nonce = nonce

        response = await call_next(request)

        # CSP with nonce
        csp_directives = {
            "default-src": ["'self'"],
            "script-src": [
                "'self'",
                f"'nonce-{nonce}'",  # ✅ Nonce instead of unsafe-inline
            ],
            # ... rest of directives
        }

        csp_value = self._format_csp_header(csp_directives)
        response.headers["Content-Security-Policy"] = csp_value
        return response
```

**Frontend:** Использовать nonce в script tags
```html
<script nonce="{{ request.state.csp_nonce }}">
  // Your inline script
</script>
```

---

## 4. Добавить CSRF Protection (20 минут)

### Install package
```bash
pip install fastapi-csrf-protect
```

### backend/app/main.py
```python
from fastapi_csrf_protect import CsrfProtect
from fastapi_csrf_protect.exceptions import CsrfProtectError
from pydantic import BaseModel

class CsrfSettings(BaseModel):
    secret_key: str = settings.SECRET_KEY
    cookie_samesite: str = "strict"
    cookie_secure: bool = not settings.DEBUG  # True in production

@CsrfProtect.load_config
def get_csrf_config():
    return CsrfSettings()

@app.exception_handler(CsrfProtectError)
async def csrf_exception_handler(request: Request, exc: CsrfProtectError):
    return JSONResponse(
        status_code=403,
        content={"detail": "CSRF validation failed"}
    )
```

### Добавить к endpoints
```python
# В любом POST/PUT/DELETE endpoint:
@router.post("/books")
async def create_book(
    request: Request,
    csrf_protect: CsrfProtect = Depends(),
    current_user: User = Depends(get_current_user),
):
    await csrf_protect.validate_csrf(request)
    # ... rest of code
```

### Frontend: Получить и отправить CSRF token
```typescript
// Get CSRF token from cookie
const getCsrfToken = (): string | null => {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; fastapi-csrf-token=`);
  if (parts.length === 2) {
    return parts.pop()?.split(';').shift() || null;
  }
  return null;
};

// Add to API client
const csrfToken = getCsrfToken();
if (csrfToken) {
  headers['X-CSRF-Token'] = csrfToken;
}
```

---

## 5. Добавить Rate Limiting для Auth (10 минут)

### Файл: backend/app/routers/auth.py

```python
from ..middleware.rate_limit import rate_limit

@router.post("/login")
@rate_limit(max_requests=5, window_seconds=300)  # 5 attempts per 5 min
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_database_session),
):
    # ... existing code

    # Log failed attempts
    if not user or not auth_service.verify_password(form_data.password, user.password_hash):
        logger.warning(
            f"Failed login attempt for {form_data.username} from {request.client.host}"
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
        )
    # ... rest
```

---

## 6. Generate Strong Secrets для Production (5 минут)

```bash
# Generate strong SECRET_KEY
python -c "import secrets; print('SECRET_KEY=' + secrets.token_urlsafe(64))"

# Generate DB password
python -c "import secrets; print('DB_PASSWORD=' + secrets.token_urlsafe(32))"

# Generate Redis password
python -c "import secrets; print('REDIS_PASSWORD=' + secrets.token_urlsafe(32))"

# Сохранить в .env.production (НЕ коммитить!)
```

---

## 7. Update requirements.txt (5 минут)

```bash
# Check for vulnerabilities
pip install safety
safety check -r backend/requirements.txt

# Update vulnerable packages
pip install --upgrade cryptography aiohttp requests

# Update requirements.txt
pip freeze > backend/requirements.txt
```

---

## 8. Validate Production Config (10 минут)

### Создать: scripts/validate_production.sh

```bash
#!/bin/bash
echo "🔒 Production Security Validation"
echo "=================================="

# Check DEBUG is false
if [ "$DEBUG" = "true" ]; then
    echo "❌ FAIL: DEBUG=true in production!"
    exit 1
fi

# Check SECRET_KEY is not default
if echo "$SECRET_KEY" | grep -q "dev-secret-key"; then
    echo "❌ FAIL: Default SECRET_KEY detected!"
    exit 1
fi

# Check database password is strong
if echo "$DATABASE_URL" | grep -q "postgres123"; then
    echo "❌ FAIL: Weak database password!"
    exit 1
fi

# Check Redis password is strong
if echo "$REDIS_URL" | grep -q "redis123"; then
    echo "❌ FAIL: Weak Redis password!"
    exit 1
fi

# Check .env files are not committed
if git ls-files | grep -E "^\.env\.(production|development)$"; then
    echo "❌ FAIL: .env files committed to git!"
    exit 1
fi

echo "✅ All production security checks passed!"
```

```bash
chmod +x scripts/validate_production.sh
./scripts/validate_production.sh
```

---

## 9. Setup CI/CD Security Checks (20 минут)

### Создать: .github/workflows/security.yml

```yaml
name: Security Checks

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Set up Python
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          cd backend
          pip install safety bandit

      - name: Run Safety vulnerability check
        run: |
          cd backend
          safety check -r requirements.txt --json || true

      - name: Run Bandit security linter
        run: |
          cd backend
          bandit -r app/ -f json -o bandit-report.json || true

      - name: Check for secrets in code
        run: |
          # Check for hardcoded passwords
          if grep -r "password.*=.*['\"]" backend/app --include="*.py" | grep -v "password_hash"; then
            echo "⚠️ Potential hardcoded passwords found"
            exit 1
          fi

      - name: Validate .gitignore
        run: |
          if ! grep -q "^\.env$" .gitignore; then
            echo "❌ .env not in .gitignore!"
            exit 1
          fi
          echo "✅ .gitignore properly configured"

      - name: Check for committed secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
```

---

## 10. Test Security (15 минут)

### Создать: backend/tests/test_security_critical.py

```python
import pytest
from app.core.config import settings

def test_production_mode_requires_strong_secrets():
    """Test that production mode rejects weak secrets."""
    # Simulate production mode
    settings.DEBUG = False

    with pytest.raises(ValueError, match="SECRET_KEY"):
        # Should fail with default secret key
        settings.SECRET_KEY = "dev-secret-key-change-in-production"
        settings.validate_production_settings()

def test_csrf_protection_enabled():
    """Test that CSRF protection is active."""
    from app.main import app
    # Check that CSRF middleware is registered
    # TODO: implement

def test_rate_limiting_on_auth():
    """Test that auth endpoints have rate limiting."""
    # TODO: implement

def test_password_hashing():
    """Test that passwords are properly hashed."""
    from app.services.auth_service import auth_service

    password = "TestPassword123!"
    hashed = auth_service.get_password_hash(password)

    # Should not store plaintext
    assert password not in hashed

    # Should verify correctly
    assert auth_service.verify_password(password, hashed)

    # Should not verify wrong password
    assert not auth_service.verify_password("WrongPassword", hashed)
```

```bash
# Run security tests
cd backend
pytest tests/test_security_critical.py -v
```

---

## ✅ Checklist для Production

Перед deployment выполнить:

```markdown
- [ ] Удалены hardcoded passwords из скриптов
- [ ] .env.development удален из git
- [ ] CSP настроен без unsafe-inline/unsafe-eval
- [ ] CSRF protection добавлен
- [ ] Rate limiting на /login (5/5min)
- [ ] Strong secrets сгенерированы
- [ ] Dependencies обновлены
- [ ] Production validation script прошел
- [ ] Security tests прошли
- [ ] CI/CD security checks настроены
```

---

## 🚀 Deploy Команды

```bash
# 1. Validate environment
./scripts/validate_production.sh

# 2. Run security tests
cd backend && pytest tests/test_security_critical.py

# 3. Generate production secrets (if not exists)
./scripts/generate_secrets.sh

# 4. Deploy with validated config
docker-compose -f docker-compose.production.yml up -d

# 5. Verify security headers
curl -I https://bookreader.ai/api/v1/health

# 6. Monitor logs for security events
docker-compose logs -f backend | grep -i "failed\|security\|error"
```

---

## 📊 Time Estimate

Total: **~2-3 hours** for all critical fixes

- Fix 1: 15min
- Fix 2: 5min
- Fix 3: 30min
- Fix 4: 20min
- Fix 5: 10min
- Fix 6: 5min
- Fix 7: 5min
- Fix 8: 10min
- Fix 9: 20min
- Fix 10: 15min

**Priority Order:**
1. Fix #1 & #2 (Hardcoded credentials) - 20min
2. Fix #6 (Generate strong secrets) - 5min
3. Fix #5 (Rate limiting) - 10min
4. Fix #4 (CSRF protection) - 20min
5. Fix #3 (CSP hardening) - 30min

---

**Начать с:** Fix #1, #2, #6 (30 минут) - устраняет CRITICAL risks
