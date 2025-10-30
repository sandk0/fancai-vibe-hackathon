"""
Security Headers Middleware для BookReader AI.

Защищает приложение от:
- XSS (Cross-Site Scripting) атак
- Clickjacking
- MIME sniffing
- Information leakage
- Недостаточного шифрования

Реализует рекомендации OWASP для secure headers.
"""

import logging
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


# ============================================================================
# Security Headers Middleware
# ============================================================================


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware для добавления security headers ко всем HTTP responses.

    Реализует следующие защиты:
    1. HSTS (HTTP Strict Transport Security) - принудительный HTTPS
    2. CSP (Content Security Policy) - защита от XSS
    3. X-Frame-Options - защита от clickjacking
    4. X-Content-Type-Options - защита от MIME sniffing
    5. X-XSS-Protection - browser XSS protection
    6. Referrer-Policy - контроль referrer информации
    7. Permissions-Policy - отключение небезопасных API браузера

    Usage:
        app.add_middleware(SecurityHeadersMiddleware)
    """

    def __init__(
        self,
        app,
        enable_hsts: bool = True,
        hsts_max_age: int = 31536000,  # 1 year
        enable_csp: bool = True,
        csp_directives: dict = None,
    ):
        """
        Инициализация security headers middleware.

        Args:
            app: FastAPI application instance
            enable_hsts: Включить HSTS (требует HTTPS в production)
            hsts_max_age: HSTS max-age в секундах (default: 1 год)
            enable_csp: Включить Content-Security-Policy
            csp_directives: Кастомные CSP директивы (default: безопасный preset)
        """
        super().__init__(app)
        self.enable_hsts = enable_hsts
        self.hsts_max_age = hsts_max_age
        self.enable_csp = enable_csp
        self.csp_directives = csp_directives or self._get_default_csp_directives()

    def _get_default_csp_directives(self) -> dict:
        """
        Возвращает default безопасные CSP директивы для BookReader AI.

        Returns:
            Dict с CSP директивами
        """
        return {
            "default-src": ["'self'"],
            "script-src": [
                "'self'",
                "'unsafe-inline'",  # TODO: Remove after moving inline scripts
                "'unsafe-eval'",  # TODO: Remove after audit
            ],
            "style-src": [
                "'self'",
                "'unsafe-inline'",  # Required for Tailwind CSS
                "https://fonts.googleapis.com",
            ],
            "img-src": [
                "'self'",
                "data:",
                "https:",  # Allow external images from pollinations.ai and other sources
            ],
            "font-src": ["'self'", "data:", "https://fonts.gstatic.com"],
            "connect-src": [
                "'self'",
                "https://image.pollinations.ai",  # Image generation API
                "https://pollinations.ai",
            ],
            "media-src": ["'self'"],
            "object-src": ["'none'"],
            "frame-ancestors": ["'none'"],
            "base-uri": ["'self'"],
            "form-action": ["'self'"],
            "upgrade-insecure-requests": [],
        }

    def _format_csp_header(self, directives: dict) -> str:
        """
        Форматирует CSP директивы в строку для header.

        Args:
            directives: Dict с CSP директивами

        Returns:
            CSP header value string
        """
        parts = []
        for directive, values in directives.items():
            if values:
                parts.append(f"{directive} {' '.join(values)}")
            else:
                parts.append(directive)

        return "; ".join(parts)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Обрабатывает request и добавляет security headers к response.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware в цепочке

        Returns:
            Response с security headers
        """
        # Обработка request
        response = await call_next(request)

        # ========================================================================
        # 1. Strict-Transport-Security (HSTS)
        # ========================================================================
        if self.enable_hsts:
            # Force HTTPS for all future requests
            # includeSubDomains: применять к всем субдоменам
            # preload: разрешить включение в браузерные HSTS preload списки
            response.headers["Strict-Transport-Security"] = (
                f"max-age={self.hsts_max_age}; includeSubDomains; preload"
            )

        # ========================================================================
        # 2. Content-Security-Policy (CSP)
        # ========================================================================
        if self.enable_csp:
            csp_value = self._format_csp_header(self.csp_directives)
            response.headers["Content-Security-Policy"] = csp_value

        # ========================================================================
        # 3. X-Frame-Options
        # ========================================================================
        # Защита от clickjacking - запрещает встраивание сайта во frames/iframes
        response.headers["X-Frame-Options"] = "DENY"

        # ========================================================================
        # 4. X-Content-Type-Options
        # ========================================================================
        # Предотвращает MIME sniffing - браузер не будет пытаться угадать MIME type
        response.headers["X-Content-Type-Options"] = "nosniff"

        # ========================================================================
        # 5. X-XSS-Protection
        # ========================================================================
        # Включает встроенную в браузер XSS protection (legacy, но не помешает)
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # ========================================================================
        # 6. Referrer-Policy
        # ========================================================================
        # Контролирует, какая referrer информация отправляется с запросами
        # strict-origin-when-cross-origin: полный referrer для same-origin, только origin для cross-origin HTTPS
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # ========================================================================
        # 7. Permissions-Policy (ранее Feature-Policy)
        # ========================================================================
        # Отключает небезопасные browser features и APIs
        permissions = [
            "geolocation=()",  # Отключить geolocation
            "microphone=()",  # Отключить microphone
            "camera=()",  # Отключить camera
            "payment=()",  # Отключить payment request API
            "usb=()",  # Отключить USB API
            "magnetometer=()",  # Отключить magnetometer
            "accelerometer=()",  # Отключить accelerometer
            "gyroscope=()",  # Отключить gyroscope
        ]
        response.headers["Permissions-Policy"] = ", ".join(permissions)

        # ========================================================================
        # 8. X-Permitted-Cross-Domain-Policies
        # ========================================================================
        # Ограничивает cross-domain policies для Adobe Flash и PDF
        response.headers["X-Permitted-Cross-Domain-Policies"] = "none"

        # ========================================================================
        # 9. Cache-Control для sensitive endpoints
        # ========================================================================
        # Для authentication endpoints и user data - запрещаем кэширование
        if any(
            path in request.url.path
            for path in ["/auth/", "/users/me", "/api/v1/admin/"]
        ):
            response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
            response.headers["Pragma"] = "no-cache"

        # ========================================================================
        # 10. Server Header Removal (информация о сервере)
        # ========================================================================
        # Удаляем Server header для предотвращения information disclosure
        if "Server" in response.headers:
            del response.headers["Server"]

        # Log security headers для debugging (только в development)
        # logger.debug(f"Security headers applied to {request.url.path}")

        return response


# ============================================================================
# Utility Functions
# ============================================================================


def create_security_headers_middleware(
    enable_hsts: bool = True,
    hsts_max_age: int = 31536000,
    enable_csp: bool = True,
    custom_csp: dict = None,
) -> type:
    """
    Factory function для создания security headers middleware с кастомными настройками.

    Args:
        enable_hsts: Включить HSTS
        hsts_max_age: HSTS max-age в секундах
        enable_csp: Включить CSP
        custom_csp: Кастомные CSP директивы

    Returns:
        SecurityHeadersMiddleware class с заданными настройками

    Example:
        middleware = create_security_headers_middleware(
            enable_hsts=True,
            custom_csp={
                "default-src": ["'self'"],
                "img-src": ["'self'", "https://example.com"]
            }
        )
        app.add_middleware(middleware)
    """

    class CustomSecurityHeadersMiddleware(SecurityHeadersMiddleware):
        def __init__(self, app):
            super().__init__(
                app,
                enable_hsts=enable_hsts,
                hsts_max_age=hsts_max_age,
                enable_csp=enable_csp,
                csp_directives=custom_csp,
            )

    return CustomSecurityHeadersMiddleware


# ============================================================================
# Security Headers Validator
# ============================================================================


def validate_security_headers(response_headers: dict) -> dict:
    """
    Валидирует наличие и корректность security headers в response.

    Используется для тестирования и мониторинга security posture.

    Args:
        response_headers: Dict с response headers

    Returns:
        Dict с результатами валидации:
        {
            "valid": bool,
            "missing_headers": List[str],
            "warnings": List[str]
        }
    """
    required_headers = [
        "x-content-type-options",
        "x-frame-options",
        "referrer-policy",
    ]

    recommended_headers = [
        "strict-transport-security",  # Required in production
        "content-security-policy",
        "permissions-policy",
    ]

    # Normalize header names to lowercase
    headers_lower = {k.lower(): v for k, v in response_headers.items()}

    missing_required = [h for h in required_headers if h not in headers_lower]
    missing_recommended = [h for h in recommended_headers if h not in headers_lower]

    warnings = []
    if missing_recommended:
        warnings.append(
            f"Missing recommended headers: {', '.join(missing_recommended)}"
        )

    # Check for weak configurations
    if "x-frame-options" in headers_lower:
        if headers_lower["x-frame-options"].upper() not in ["DENY", "SAMEORIGIN"]:
            warnings.append("X-Frame-Options should be DENY or SAMEORIGIN")

    return {
        "valid": len(missing_required) == 0,
        "missing_headers": missing_required,
        "warnings": warnings,
    }
