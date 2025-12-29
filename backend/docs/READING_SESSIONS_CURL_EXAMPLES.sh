#!/bin/bash

# ============================================================================
# Reading Sessions API - CURL Test Examples
# ============================================================================
#
# Этот файл содержит примеры curl запросов для тестирования
# Reading Sessions API в fancai.
#
# ВАЖНО: Замените YOUR_JWT_TOKEN на реальный JWT токен
# ============================================================================

# Конфигурация
API_BASE_URL="http://localhost:8000/api/v1"
JWT_TOKEN="YOUR_JWT_TOKEN"  # Замените на реальный токен

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================================
# 1. Начать новую сессию чтения
# ============================================================================

echo -e "${BLUE}=== 1. START READING SESSION ===${NC}"

# Начать сессию с начала книги на desktop
curl -X POST "${API_BASE_URL}/reading-sessions/start" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "book_id": "123e4567-e89b-12d3-a456-426614174000",
    "start_position": 0,
    "device_type": "desktop"
  }' | jq '.'

echo -e "\n${GREEN}✅ Сессия создана${NC}\n"

# Сохраним session_id для дальнейших тестов
# В реальном использовании - получите id из response
SESSION_ID="987fcdeb-51a2-43d1-b789-abc123456def"

# ============================================================================
# 2. Обновить позицию в активной сессии
# ============================================================================

echo -e "${BLUE}=== 2. UPDATE READING POSITION ===${NC}"

# Обновить позицию до 25%
curl -X PUT "${API_BASE_URL}/reading-sessions/${SESSION_ID}/update" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "current_position": 25
  }' | jq '.'

echo -e "\n${GREEN}✅ Позиция обновлена до 25%${NC}\n"

# ============================================================================
# 3. Еще одно обновление позиции
# ============================================================================

echo -e "${BLUE}=== 3. UPDATE POSITION AGAIN ===${NC}"

# Обновить позицию до 45%
curl -X PUT "${API_BASE_URL}/reading-sessions/${SESSION_ID}/update" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "current_position": 45
  }' | jq '.'

echo -e "\n${GREEN}✅ Позиция обновлена до 45%${NC}\n"

# ============================================================================
# 4. Получить активную сессию
# ============================================================================

echo -e "${BLUE}=== 4. GET ACTIVE SESSION ===${NC}"

curl -X GET "${API_BASE_URL}/reading-sessions/active" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq '.'

echo -e "\n${GREEN}✅ Активная сессия получена${NC}\n"

# ============================================================================
# 5. Завершить сессию чтения
# ============================================================================

echo -e "${BLUE}=== 5. END READING SESSION ===${NC}"

# Завершить сессию на 45%
curl -X PUT "${API_BASE_URL}/reading-sessions/${SESSION_ID}/end" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "end_position": 45
  }' | jq '.'

echo -e "\n${GREEN}✅ Сессия завершена${NC}\n"

# ============================================================================
# 6. Проверить, что нет активной сессии
# ============================================================================

echo -e "${BLUE}=== 6. CHECK NO ACTIVE SESSION ===${NC}"

curl -X GET "${API_BASE_URL}/reading-sessions/active" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq '.'

echo -e "\n${GREEN}✅ Активных сессий нет (null)${NC}\n"

# ============================================================================
# 7. Получить историю сессий (первая страница)
# ============================================================================

echo -e "${BLUE}=== 7. GET READING HISTORY (Page 1) ===${NC}"

curl -X GET "${API_BASE_URL}/reading-sessions/history?page=1&page_size=10" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq '.'

echo -e "\n${GREEN}✅ История получена${NC}\n"

# ============================================================================
# 8. Получить историю для конкретной книги
# ============================================================================

echo -e "${BLUE}=== 8. GET HISTORY FOR SPECIFIC BOOK ===${NC}"

BOOK_ID="123e4567-e89b-12d3-a456-426614174000"

curl -X GET "${API_BASE_URL}/reading-sessions/history?book_id=${BOOK_ID}" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq '.'

echo -e "\n${GREEN}✅ История для книги получена${NC}\n"

# ============================================================================
# 9. Начать новую сессию на mobile (середина книги)
# ============================================================================

echo -e "${BLUE}=== 9. START NEW SESSION ON MOBILE ===${NC}"

curl -X POST "${API_BASE_URL}/reading-sessions/start" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "book_id": "123e4567-e89b-12d3-a456-426614174000",
    "start_position": 50,
    "device_type": "mobile"
  }' | jq '.'

echo -e "\n${GREEN}✅ Новая сессия создана (предыдущая автоматически завершена)${NC}\n"

# ============================================================================
# 10. Тест ошибок - попытка завершить с невалидной позицией
# ============================================================================

echo -e "${BLUE}=== 10. TEST ERROR - Invalid end_position ===${NC}"

# Попытка завершить с end_position < start_position (должна вернуть 400)
curl -X PUT "${API_BASE_URL}/reading-sessions/${SESSION_ID}/end" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "end_position": 10
  }' | jq '.'

echo -e "\n${RED}❌ Ожидаемая ошибка: end_position < start_position${NC}\n"

# ============================================================================
# 11. Тест ошибок - несуществующая сессия
# ============================================================================

echo -e "${BLUE}=== 11. TEST ERROR - Non-existent session ===${NC}"

FAKE_SESSION_ID="00000000-0000-0000-0000-000000000000"

curl -X PUT "${API_BASE_URL}/reading-sessions/${FAKE_SESSION_ID}/update" \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "current_position": 50
  }' | jq '.'

echo -e "\n${RED}❌ Ожидаемая ошибка: Сессия не найдена (404)${NC}\n"

# ============================================================================
# ЗАВЕРШЕНИЕ ТЕСТОВ
# ============================================================================

echo -e "${GREEN}==================================${NC}"
echo -e "${GREEN}✅ Все тесты выполнены${NC}"
echo -e "${GREEN}==================================${NC}"

# ============================================================================
# ПОЛЕЗНЫЕ КОМАНДЫ
# ============================================================================

: <<'USAGE'
USAGE:

1. Получить JWT токен (сначала нужно авторизоваться):

   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"username": "user@example.com", "password": "password"}' | jq -r '.access_token'

2. Экспортировать токен в переменную окружения:

   export JWT_TOKEN="your_actual_token_here"

3. Запустить все тесты:

   bash READING_SESSIONS_CURL_EXAMPLES.sh

4. Запустить отдельные curl команды вручную

5. Использовать jq для красивого вывода JSON (установка: brew install jq)

USAGE
