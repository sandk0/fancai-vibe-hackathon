# CRITICAL: Hostname Fix Correction

**Date:** 2025-11-14
**Priority:** P0 - CRITICAL ERROR
**Status:** 🚨 INCORRECT FIX IDENTIFIED

---

## Problem Identified

The database hostname fixes in commits **08fd4ea** and **6871bb2** were **INCORRECT**.

### What We Changed (WRONG):
```yaml
# Changed from:
DATABASE_URL: postgresql+asyncpg://postgres:postgres123@127.0.0.1:5432/bookreader_test

# To:
DATABASE_URL: postgresql+asyncpg://postgres:postgres123@postgres:5432/bookreader_test
```

### Why This Is WRONG:

According to GitHub Actions documentation:

**When job runs on `runs-on: ubuntu-latest` (WITHOUT `container:` directive):**
- Service containers run in Docker
- Job runs on the HOST (not in container)
- Services accessible via **`localhost`** or **`127.0.0.1`**
- Port mapping required: `ports: - 5432:5432`

**When job runs IN a container (`container:` directive):**
- Both job and services in Docker network
- Services accessible via **service name** (`postgres`)
- NO port mapping needed

### Our Configuration:

```yaml
backend-tests:
  runs-on: ubuntu-latest  # ← Running on HOST, not in container
  services:
    postgres:
      image: postgres:15-alpine
      ports:
        - 5432:5432  # ← Port mapping indicates HOST access
```

**NO `container:` directive** = Must use **`localhost`**, NOT `postgres`!

---

## Correct Hostname:

```yaml
# For pg_isready, psql:
pg_isready -h localhost -p 5432 -U postgres
psql -h localhost -U postgres -d bookreader_test

# For DATABASE_URL:
DATABASE_URL: postgresql+asyncpg://postgres:postgres123@localhost:5432/bookreader_test
```

---

## Why Did I Make This Mistake?

1. **Misread documentation:** Thought service name always works
2. **Confusion:** asyncpg vs psql - both need localhost for runner jobs
3. **Docker networking:** Service containers use Docker networking, but runner is on HOST

---

## Impact:

**ALL database connection attempts FAIL** because:
- `postgres` hostname doesn't resolve on runner HOST
- Service container accessible only via `localhost` with port mapping

**Errors:**
```
pg_isready -h postgres -p 5432 -U postgres
# FAILS: postgres:5432 - could not translate host name "postgres" to address
```

---

## Correct Fix:

Use **`localhost`** in all database connections for runner jobs:

1. pg_isready: `pg_isready -h localhost -p 5432 -U postgres`
2. psql: `psql -h localhost -U postgres -d bookreader_test`
3. DATABASE_URL: `postgresql+asyncpg://postgres:postgres123@localhost:5432/bookreader_test`

---

**Next Step:** Revert hostname changes from `postgres` back to `localhost`
