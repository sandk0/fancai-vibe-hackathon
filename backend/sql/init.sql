-- Инициализация базы данных fancai
-- Этот файл выполняется при первом запуске PostgreSQL контейнера

-- Создание расширений
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Создание базы данных для разработки (если не существует)
SELECT 'CREATE DATABASE bookreader_dev' 
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'bookreader_dev')\gexec

-- Настройка для полнотекстового поиска на русском языке
\c bookreader_dev;
ALTER DATABASE bookreader_dev SET default_text_search_config = 'russian';