-- =8F80;870F8O 107K 40==KE BookReader AI
-- -B>B D09; 2K?>;=O5BAO ?@8 ?5@2>< 70?CA:5 PostgreSQL :>=B59=5@0

-- !>740=85 @0AH8@5=89
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- !>740=85 ?>;L7>20B5;O ?@8;>65=8O (5A;8 =5 ACI5AB2C5B)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'bookreader_app') THEN
        CREATE USER bookreader_app WITH PASSWORD 'app_password';
    END IF;
END
$$;

-- @54>AB02;5=85 ?@02
GRANT ALL PRIVILEGES ON DATABASE bookreader TO bookreader_app;

-- 0AB@>9:0 4;O ?>;=>B5:AB>2>3> ?>8A:0 =0 @CAA:>< O7K:5
ALTER DATABASE bookreader SET default_text_search_config = 'russian';