"""
API роуты для управления пользователями в BookReader AI.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from typing import Dict, Any

from ..core.database import get_database_session


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