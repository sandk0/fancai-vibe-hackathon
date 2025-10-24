"""
API роуты для аутентификации в BookReader AI.

Содержит endpoints для регистрации, входа, обновления токенов и управления профилем.
"""

from fastapi import APIRouter, HTTPException, Depends, status, Response
from fastapi.security import HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any

from ..core.database import get_database_session
from ..core.auth import get_current_active_user, security
from ..services.auth_service import auth_service
from ..models.user import User


router = APIRouter()


# Pydantic модели для запросов и ответов
class UserRegistrationRequest(BaseModel):
    """Модель запроса регистрации пользователя."""

    email: EmailStr
    password: str
    full_name: Optional[str] = None


class UserLoginRequest(BaseModel):
    """Модель запроса входа пользователя."""

    email: EmailStr
    password: str


class TokenRefreshRequest(BaseModel):
    """Модель запроса обновления токена."""

    refresh_token: str


class UserProfileUpdateRequest(BaseModel):
    """Модель запроса обновления профиля."""

    full_name: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


class UserResponse(BaseModel):
    """Модель ответа с информацией о пользователе."""

    id: str
    email: str
    full_name: Optional[str]
    is_active: bool
    is_verified: bool
    is_admin: bool
    created_at: str
    last_login: Optional[str]


@router.post("/auth/register", status_code=status.HTTP_201_CREATED)
async def register_user(
    request: UserRegistrationRequest, db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Регистрация нового пользователя.

    Args:
        request: Данные для регистрации
        db: Сессия базы данных

    Returns:
        Информация о созданном пользователе и токены

    Raises:
        HTTPException: Если email уже используется или другие ошибки
    """
    # Базовая валидация пароля
    if len(request.password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters long",
        )

    try:
        # Создаем пользователя
        user = await auth_service.create_user(
            db=db,
            email=request.email,
            password=request.password,
            full_name=request.full_name,
        )

        # Создаем токены для нового пользователя
        tokens = auth_service.create_tokens_for_user(user)

        return {
            "user": {
                "id": str(user.id),
                "email": user.email,
                "full_name": user.full_name,
                "is_active": user.is_active,
                "is_verified": user.is_verified,
                "created_at": user.created_at.isoformat(),
            },
            "tokens": tokens,
            "message": "User registered successfully",
        }

    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.options("/auth/login")
async def login_options():
    """CORS preflight для login endpoint."""
    return Response(status_code=200)


@router.post("/auth/login")
async def login_user(
    request: UserLoginRequest, db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Вход пользователя в систему.

    Args:
        request: Данные для входа
        db: Сессия базы данных

    Returns:
        Информация о пользователе и токены

    Raises:
        HTTPException: Если неверные учетные данные
    """
    user = await auth_service.authenticate_user(
        db=db, email=request.email, password=request.password
    )

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Создаем токены
    tokens = auth_service.create_tokens_for_user(user)

    return {
        "user": {
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "is_admin": user.is_admin,
            "last_login": user.last_login.isoformat() if user.last_login else None,
        },
        "tokens": tokens,
        "message": "Login successful",
    }


@router.post("/auth/refresh")
async def refresh_token(
    request: TokenRefreshRequest, db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Обновление access токена с помощью refresh токена.

    Args:
        request: Refresh токен
        db: Сессия базы данных

    Returns:
        Новые токены

    Raises:
        HTTPException: Если refresh токен недействительный
    """
    tokens = await auth_service.refresh_access_token(db, request.refresh_token)

    if not tokens:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return {"tokens": tokens, "message": "Token refreshed successfully"}


@router.get("/auth/me")
async def get_current_user_info(
    current_user: User = Depends(get_current_active_user),
) -> Dict[str, Any]:
    """
    Получение информации о текущем пользователе.

    Args:
        current_user: Текущий пользователь из токена

    Returns:
        Информация о пользователе
    """
    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "is_active": current_user.is_active,
            "is_verified": current_user.is_verified,
            "is_admin": current_user.is_admin,
            "created_at": current_user.created_at.isoformat(),
            "last_login": current_user.last_login.isoformat()
            if current_user.last_login
            else None,
        }
    }


@router.put("/auth/profile")
async def update_user_profile(
    request: UserProfileUpdateRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, Any]:
    """
    Обновление профиля пользователя.

    Args:
        request: Данные для обновления
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Сообщение об успешном обновлении

    Raises:
        HTTPException: Если неверный текущий пароль или другие ошибки
    """
    # Валидация нового пароля
    if request.new_password and len(request.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="New password must be at least 6 characters long",
        )

    # Если пытаются сменить пароль, требуем текущий пароль
    if request.new_password and not request.current_password:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is required to change password",
        )

    success = await auth_service.update_user_profile(
        db=db,
        user_id=current_user.id,
        full_name=request.full_name,
        current_password=request.current_password,
        new_password=request.new_password,
    )

    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to update profile. Check your current password.",
        )

    return {"message": "Profile updated successfully"}


@router.post("/auth/logout")
async def logout_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, str]:
    """
    Выход пользователя из системы.

    В текущей реализации просто возвращает сообщение об успешном выходе.
    В будущем можно добавить blacklist токенов или другие механизмы.

    Args:
        credentials: JWT токен для валидации

    Returns:
        Сообщение об успешном выходе
    """
    # В текущей реализации JWT токены stateless,
    # поэтому просто возвращаем сообщение
    # В будущем можно добавить Redis blacklist для токенов
    return {"message": "Logout successful"}


@router.delete("/auth/deactivate")
async def deactivate_account(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session),
) -> Dict[str, str]:
    """
    Деактивация аккаунта пользователя.

    Args:
        current_user: Текущий пользователь
        db: Сессия базы данных

    Returns:
        Сообщение о деактивации

    Raises:
        HTTPException: Если не удалось деактивировать аккаунт
    """
    success = await auth_service.deactivate_user(db, current_user.id)

    if not success:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to deactivate account",
        )

    return {"message": "Account deactivated successfully"}
