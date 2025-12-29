"""
CSRF (Cross-Site Request Forgery) Protection для fancai.

Implements Double Submit Cookie pattern для защиты от CSRF атак.

Usage:
    from app.core.csrf import csrf_protect_middleware

    app.add_middleware(BaseHTTPMiddleware, dispatch=csrf_protect_middleware)

Security Notes:
- CSRF tokens должны быть unpredictable (cryptographically secure)
- Tokens должны быть tied к user session
- State-changing operations (POST/PUT/DELETE) требуют valid CSRF token
- GET requests не требуют CSRF token (idempotent)
"""

import secrets
from typing import Callable
from fastapi import Request, Response, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.types import ASGIApp
import logging

logger = logging.getLogger(__name__)

# CSRF Configuration
CSRF_TOKEN_LENGTH = 32
CSRF_HEADER_NAME = "X-CSRF-Token"
CSRF_COOKIE_NAME = "csrf_token"
CSRF_COOKIE_MAX_AGE = 3600  # 1 hour

# Exempt paths (don't require CSRF token)
CSRF_EXEMPT_PATHS = [
    "/api/v1/auth/login",  # Login creates session
    "/api/v1/auth/register",  # Registration creates session
    "/api/v1/auth/refresh",  # Token refresh
    "/docs",  # Swagger UI
    "/openapi.json",  # OpenAPI spec
    "/health",  # Health check
    "/metrics",  # Prometheus metrics
]


def generate_csrf_token() -> str:
    """
    Generates cryptographically secure CSRF token.

    Returns:
        Random hex string (64 characters)
    """
    return secrets.token_hex(CSRF_TOKEN_LENGTH)


def is_csrf_exempt(path: str) -> bool:
    """
    Checks if path is exempt from CSRF protection.

    Args:
        path: Request path

    Returns:
        True if path is exempt
    """
    for exempt_path in CSRF_EXEMPT_PATHS:
        if path.startswith(exempt_path):
            return True
    return False


class CSRFProtectMiddleware(BaseHTTPMiddleware):
    """
    CSRF Protection Middleware using Double Submit Cookie pattern.

    Protection strategy:
    1. Generate CSRF token on first request
    2. Store in secure cookie (HttpOnly, SameSite=Strict)
    3. Client must send token in X-CSRF-Token header
    4. Verify token matches cookie for state-changing requests

    Example:
        app = FastAPI()
        app.add_middleware(CSRFProtectMiddleware)

        # Client-side (JavaScript):
        fetch('/api/v1/books', {
            method: 'POST',
            headers: {
                'X-CSRF-Token': getCookie('csrf_token')
            },
            body: JSON.stringify(data)
        })
    """

    def __init__(self, app: ASGIApp):
        """
        Initialize CSRF protection middleware.

        Args:
            app: ASGI application (FastAPI instance)
        """
        super().__init__(app)

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request with CSRF validation.

        Args:
            request: HTTP request
            call_next: Next middleware in chain

        Returns:
            Response from endpoint or 403 if CSRF validation fails

        Raises:
            HTTPException: 403 if CSRF token invalid
        """
        # Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            response = await call_next(request)
            return self._set_csrf_cookie(request, response)

        # Skip CSRF check for exempt paths
        if is_csrf_exempt(request.url.path):
            response = await call_next(request)
            return self._set_csrf_cookie(request, response)

        # Validate CSRF token for state-changing methods
        if request.method in ["POST", "PUT", "DELETE", "PATCH"]:
            if not self._validate_csrf_token(request):
                logger.warning(
                    f"CSRF validation failed for {request.method} {request.url.path} "
                    f"from {request.client.host if request.client else 'unknown'}"
                )
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="CSRF token validation failed. Ensure X-CSRF-Token header matches cookie.",
                )

        # Process request
        response = await call_next(request)

        # Ensure CSRF cookie is set
        return self._set_csrf_cookie(request, response)

    def _validate_csrf_token(self, request: Request) -> bool:
        """
        Validates CSRF token from header against cookie.

        Args:
            request: HTTP request

        Returns:
            True if token is valid
        """
        # Get token from header
        csrf_header = request.headers.get(CSRF_HEADER_NAME)
        if not csrf_header:
            logger.debug(f"Missing CSRF header: {CSRF_HEADER_NAME}")
            return False

        # Get token from cookie
        csrf_cookie = request.cookies.get(CSRF_COOKIE_NAME)
        if not csrf_cookie:
            logger.debug(f"Missing CSRF cookie: {CSRF_COOKIE_NAME}")
            return False

        # Compare tokens (constant-time comparison)
        if not secrets.compare_digest(csrf_header, csrf_cookie):
            logger.debug("CSRF tokens do not match")
            return False

        return True

    def _set_csrf_cookie(self, request: Request, response: Response) -> Response:
        """
        Sets CSRF cookie if not already present.

        Args:
            request: HTTP request
            response: HTTP response

        Returns:
            Response with CSRF cookie
        """
        # Check if cookie already exists
        existing_cookie = request.cookies.get(CSRF_COOKIE_NAME)

        if not existing_cookie:
            # Generate new token
            csrf_token = generate_csrf_token()

            # Set secure cookie
            response.set_cookie(
                key=CSRF_COOKIE_NAME,
                value=csrf_token,
                max_age=CSRF_COOKIE_MAX_AGE,
                httponly=False,  # Must be accessible to JavaScript
                secure=True,  # HTTPS only (set to False in development if needed)
                samesite="strict",  # Strict SameSite policy
            )

            logger.debug("CSRF token generated and set in cookie")

        return response


# Helper function for adding CSRF token to forms (if needed)
def get_csrf_token(request: Request) -> str:
    """
    Gets CSRF token from request cookie.

    Args:
        request: HTTP request

    Returns:
        CSRF token or generates new one

    Example:
        @app.get("/form")
        def render_form(request: Request):
            csrf_token = get_csrf_token(request)
            return {"csrf_token": csrf_token}
    """
    csrf_token = request.cookies.get(CSRF_COOKIE_NAME)
    if not csrf_token:
        csrf_token = generate_csrf_token()
    return csrf_token
