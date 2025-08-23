"""
API роуты для управления пользователями в BookReader AI.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select, func
from typing import Dict, Any, List
from uuid import UUID

from ..core.database import get_database_session
from ..core.auth import get_current_active_user, get_current_admin_user
from ..models.user import User, Subscription
from ..models.book import Book
from ..models.description import Description


router = APIRouter()


@router.get("/users/test-db")
async def test_database_connection(
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Тестовый endpoint для проверки подключения к базе данных.
    
    Returns:
        Информация о подключении к базе данных
    """
    try:
        # Выполняем простой запрос к базе данных
        result = await db.execute(text("SELECT version(), current_database(), current_user"))
        row = result.fetchone()
        
        if row:
            version, database, user = row
        else:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Failed to fetch database information"
            )
        
        # Проверим, что таблицы созданы
        result = await db.execute(text("""
            SELECT COUNT(*) as table_count 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name IN ('users', 'books', 'chapters', 'descriptions', 'generated_images')
        """))
        table_count_row = result.fetchone()
        table_count = table_count_row[0] if table_count_row else 0
        
        return {
            "status": "connected",
            "database_info": {
                "version": version,
                "database": database,
                "user": user,
                "tables_found": table_count,
                "expected_tables": 5
            },
            "message": "Database connection successful"
        }
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Database connection failed: {str(e)}"
        )


@router.get("/users/profile")
async def get_user_profile(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Получение подробного профиля текущего пользователя.
    
    Args:
        current_user: Текущий пользователь
        db: Сессия базы данных
        
    Returns:
        Подробная информация о профиле пользователя
    """
    # Получаем подписку пользователя
    subscription_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = subscription_result.scalar_one_or_none()
    
    # Получаем статистику пользователя
    books_count = await db.execute(
        select(func.count(Book.id)).where(Book.user_id == current_user.id)
    )
    total_books = books_count.scalar()
    
    # Общее количество описаний
    descriptions_count = await db.execute(
        select(func.count(Description.id))
        .select_from(Description)
        .join(Book.chapters)
        .where(Book.user_id == current_user.id)
    )
    total_descriptions = descriptions_count.scalar() or 0
    
    return {
        "user": {
            "id": str(current_user.id),
            "email": current_user.email,
            "full_name": current_user.full_name,
            "is_active": current_user.is_active,
            "is_verified": current_user.is_verified,
            "is_admin": current_user.is_admin,
            "created_at": current_user.created_at.isoformat(),
            "last_login": current_user.last_login.isoformat() if current_user.last_login else None
        },
        "subscription": {
            "plan": subscription.plan.value if subscription else "free",
            "status": subscription.status.value if subscription else "active",
            "books_uploaded": subscription.books_uploaded if subscription else 0,
            "images_generated_month": subscription.images_generated_month if subscription else 0,
            "auto_renewal": subscription.auto_renewal if subscription else False
        } if subscription else None,
        "statistics": {
            "total_books": total_books,
            "total_descriptions": total_descriptions
        }
    }


@router.get("/users/subscription")
async def get_user_subscription(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Получение информации о подписке пользователя.
    
    Args:
        current_user: Текущий пользователь
        db: Сессия базы данных
        
    Returns:
        Информация о подписке и лимитах
    """
    subscription_result = await db.execute(
        select(Subscription).where(Subscription.user_id == current_user.id)
    )
    subscription = subscription_result.scalar_one_or_none()
    
    if not subscription:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subscription not found"
        )
    
    # Определяем лимиты для разных планов
    limits = {
        "free": {"books": 3, "generations_month": 50},
        "premium": {"books": 50, "generations_month": 500},
        "ultimate": {"books": -1, "generations_month": -1}  # Unlimited
    }
    
    plan_limits = limits.get(subscription.plan.value, limits["free"])
    
    return {
        "subscription": {
            "plan": subscription.plan.value,
            "status": subscription.status.value,
            "start_date": subscription.start_date.isoformat(),
            "end_date": subscription.end_date.isoformat() if subscription.end_date else None,
            "auto_renewal": subscription.auto_renewal
        },
        "usage": {
            "books_uploaded": subscription.books_uploaded,
            "images_generated_month": subscription.images_generated_month,
            "last_reset_date": subscription.last_reset_date.isoformat()
        },
        "limits": plan_limits,
        "within_limits": {
            "books": plan_limits["books"] == -1 or subscription.books_uploaded < plan_limits["books"],
            "generations": plan_limits["generations_month"] == -1 or subscription.images_generated_month < plan_limits["generations_month"]
        }
    }


@router.get("/users/admin/users")
async def list_all_users(
    skip: int = 0,
    limit: int = 50,
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Получение списка всех пользователей (только для администраторов).
    
    Args:
        skip: Количество записей для пропуска
        limit: Максимальное количество записей
        current_admin: Текущий администратор
        db: Сессия базы данных
        
    Returns:
        Список пользователей с пагинацией
    """
    # Получаем общее количество пользователей
    total_count = await db.execute(select(func.count(User.id)))
    total = total_count.scalar()
    
    # Получаем пользователей с пагинацией
    users_result = await db.execute(
        select(User)
        .order_by(User.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    users = users_result.scalars().all()
    
    # Формируем список пользователей
    users_data = []
    for user in users:
        # Получаем подписку для каждого пользователя
        subscription_result = await db.execute(
            select(Subscription).where(Subscription.user_id == user.id)
        )
        subscription = subscription_result.scalar_one_or_none()
        
        # Получаем количество книг
        books_count = await db.execute(
            select(func.count(Book.id)).where(Book.user_id == user.id)
        )
        total_books = books_count.scalar()
        
        users_data.append({
            "id": str(user.id),
            "email": user.email,
            "full_name": user.full_name,
            "is_active": user.is_active,
            "is_verified": user.is_verified,
            "is_admin": user.is_admin,
            "created_at": user.created_at.isoformat(),
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "subscription_plan": subscription.plan.value if subscription else "free",
            "total_books": total_books
        })
    
    return {
        "users": users_data,
        "pagination": {
            "total": total,
            "skip": skip,
            "limit": limit,
            "has_more": skip + limit < total
        }
    }


@router.get("/users/admin/stats")
async def get_admin_statistics(
    current_admin: User = Depends(get_current_admin_user),
    db: AsyncSession = Depends(get_database_session)
) -> Dict[str, Any]:
    """
    Получение общей статистики системы (только для администраторов).
    
    Args:
        current_admin: Текущий администратор
        db: Сессия базы данных
        
    Returns:
        Общая статистика системы
    """
    # Общее количество пользователей
    total_users = await db.execute(select(func.count(User.id)))
    total_users_count = total_users.scalar()
    
    # Активные пользователи
    active_users = await db.execute(
        select(func.count(User.id)).where(User.is_active == True)
    )
    active_users_count = active_users.scalar()
    
    # Подписки по планам
    subscription_stats = await db.execute(
        select(
            Subscription.plan,
            func.count(Subscription.id).label('count')
        ).group_by(Subscription.plan)
    )
    subscriptions_by_plan = {row.plan.value: row.count for row in subscription_stats.fetchall()}
    
    # Общее количество книг
    total_books = await db.execute(select(func.count(Book.id)))
    total_books_count = total_books.scalar()
    
    # Общее количество описаний
    total_descriptions = await db.execute(select(func.count(Description.id)))
    total_descriptions_count = total_descriptions.scalar()
    
    return {
        "users": {
            "total": total_users_count,
            "active": active_users_count,
            "inactive": total_users_count - active_users_count
        },
        "subscriptions": subscriptions_by_plan,
        "content": {
            "total_books": total_books_count,
            "total_descriptions": total_descriptions_count
        },
        "system_health": {
            "status": "healthy",
            "avg_books_per_user": round(total_books_count / max(total_users_count, 1), 2),
            "avg_descriptions_per_book": round(total_descriptions_count / max(total_books_count, 1), 2)
        }
    }