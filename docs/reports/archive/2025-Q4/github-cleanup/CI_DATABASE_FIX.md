# CI/CD Database Connection Fix

**Date:** 2025-11-14
**Issue:** Tests failing with `socket.gaierror: [Errno -3] Temporary failure in name resolution`
**Root Cause:** PostgreSQL service containers not properly accessible via localhost

---

## Problem Analysis

### Original Issues

1. **Missing PostgreSQL Client Tools**
   - `pg_isready` command not available
   - Unable to verify database readiness before tests

2. **No Wait-for-Database Step**
   - Tests started immediately after container startup
   - Service health checks run inside container, not accessible from host

3. **localhost vs 127.0.0.1**
   - `localhost` resolution can fail in containerized environments
   - `127.0.0.1` is more reliable for port-mapped services

4. **Inconsistent Configuration**
   - `tests-reading-sessions.yml` HAD some fixes
   - `ci.yml` and `performance.yml` were missing critical steps

---

## Solutions Implemented

### 1. Install PostgreSQL Client Tools

Added to all workflows with PostgreSQL services:

```yaml
- name: Install system dependencies
  run: |
    sudo apt-get update
    sudo apt-get install -y postgresql-client libpq-dev
```

**What this fixes:**
- Provides `pg_isready` utility for connection checking
- Provides `psql` for database verification
- Includes `libpq-dev` for Python asyncpg driver compilation

### 2. Explicit Wait-for-PostgreSQL Step

Added robust wait loop with timeout:

```yaml
- name: Wait for PostgreSQL
  run: |
    echo "Waiting for PostgreSQL to be ready..."
    max_attempts=30
    attempt=1
    while [ $attempt -le $max_attempts ]; do
      if pg_isready -h 127.0.0.1 -p 5432 -U postgres > /dev/null 2>&1; then
        echo "✅ PostgreSQL is ready!"
        break
      fi
      echo "Attempt $attempt/$max_attempts: PostgreSQL not ready, waiting..."
      sleep 2
      attempt=$((attempt + 1))
    done
    if [ $attempt -gt $max_attempts ]; then
      echo "❌ PostgreSQL failed to become ready"
      exit 1
    fi
```

**What this fixes:**
- Waits up to 60 seconds (30 attempts × 2 seconds) for PostgreSQL
- Clear progress feedback in CI logs
- Fails fast with clear error message if database doesn't start

### 3. Database Connection Verification

Added explicit connection test:

```yaml
- name: Verify database connection
  env:
    PGPASSWORD: postgres123
  run: |
    psql -h 127.0.0.1 -U postgres -d bookreader_test -c "SELECT version();"
    echo "✅ Database connection verified"
```

**What this fixes:**
- Confirms database is not just running, but accepting connections
- Verifies database `bookreader_test` exists
- Provides PostgreSQL version info in logs for debugging

### 4. Updated DATABASE_URL to Use 127.0.0.1

Changed from:
```yaml
DATABASE_URL: postgresql+asyncpg://postgres:postgres123@localhost:5432/bookreader_test
```

To:
```yaml
DATABASE_URL: postgresql+asyncpg://postgres:postgres123@127.0.0.1:5432/bookreader_test
```

**What this fixes:**
- Avoids DNS resolution issues with `localhost`
- Direct IP connection more reliable in containerized environments
- Consistent with how GitHub Actions maps service container ports

---

## Files Modified

### 1. `.github/workflows/ci.yml`

**Changes:**
- Added system dependencies installation step
- Added PostgreSQL wait step
- Added database connection verification
- Changed `localhost` → `127.0.0.1` in DATABASE_URL

**Jobs affected:**
- `backend-tests`

### 2. `.github/workflows/performance.yml`

**Changes:**
- Added system dependencies installation step
- Added PostgreSQL wait step
- Added database connection verification
- Changed `localhost` → `127.0.0.1` in DATABASE_URL

**Jobs affected:**
- `backend-load-test`
- `database-performance`

### 3. `.github/workflows/tests-reading-sessions.yml`

**Changes:**
- Updated system dependencies (added `postgresql-client`)
- Enhanced wait step with better error handling
- Added database connection verification
- Changed `localhost` → `127.0.0.1` in DATABASE_URL

**Jobs affected:**
- `test-reading-sessions`

---

## Verification Steps

### Before Deploying

1. **Lint the YAML files:**
   ```bash
   yamllint .github/workflows/*.yml
   ```

2. **Check workflow syntax:**
   ```bash
   gh workflow view ci.yml
   gh workflow view performance.yml
   gh workflow view tests-reading-sessions.yml
   ```

### After Deploying (Push to GitHub)

1. **Monitor CI runs:**
   - Check all three workflows execute successfully
   - Verify "Wait for PostgreSQL" step completes in <10 seconds
   - Confirm "Verify database connection" shows PostgreSQL version

2. **Expected Output in Logs:**
   ```
   ✅ PostgreSQL is ready!
   PostgreSQL 15.x (Ubuntu 15.x-1.pgdg22.04+1)
   ✅ Database connection verified
   ```

3. **Test Scenarios:**
   - **Push to main:** Should trigger `ci.yml` and `performance.yml`
   - **Pull Request:** Should trigger all three workflows
   - **Manual trigger:** `performance.yml` supports workflow_dispatch

---

## Rollback Plan

If issues persist:

1. **Quick Rollback:**
   ```bash
   git revert HEAD
   git push
   ```

2. **Alternative Solution (if 127.0.0.1 fails):**
   - Use service container networking: `postgres:5432`
   - Add `--network-alias postgres` to service options
   - Update DATABASE_URL to: `postgresql+asyncpg://postgres:postgres123@postgres:5432/bookreader_test`

3. **Debug Mode:**
   Add to workflow for more verbose output:
   ```yaml
   - name: Debug PostgreSQL
     run: |
       docker ps
       netstat -tuln | grep 5432
       pg_isready -h 127.0.0.1 -p 5432 -U postgres -d postgres -v
   ```

---

## Performance Impact

**Time Added to Workflows:**
- Install system dependencies: ~5-10 seconds (cached after first run)
- Wait for PostgreSQL: ~2-5 seconds (usually 1-2 attempts)
- Verify connection: ~1 second

**Total overhead: ~8-16 seconds per workflow run**

This is acceptable trade-off for reliable database connectivity.

---

## Testing Recommendations

### Local Testing (Before Push)

1. **Test PostgreSQL connection locally:**
   ```bash
   docker-compose up -d postgres
   pg_isready -h 127.0.0.1 -p 5432 -U postgres
   psql -h 127.0.0.1 -U postgres -d bookreader_test -c "SELECT version();"
   ```

2. **Run tests with 127.0.0.1:**
   ```bash
   export DATABASE_URL="postgresql+asyncpg://postgres:postgres123@127.0.0.1:5432/bookreader_test"
   cd backend && pytest -v
   ```

### CI Testing

1. **Create test branch:**
   ```bash
   git checkout -b ci/fix-database-connection
   git push -u origin ci/fix-database-connection
   ```

2. **Open Pull Request:**
   - Watch all three workflows execute
   - Check logs for successful database connections
   - Verify all tests pass

3. **Merge to main:**
   - Once PR checks pass, merge
   - Monitor main branch workflows

---

## Success Criteria

✅ All workflows complete without connection errors
✅ PostgreSQL ready in <10 seconds
✅ Database connection verified before tests
✅ All 48 backend tests pass
✅ No `socket.gaierror` errors
✅ Consistent configuration across all workflows

---

## Additional Notes

### Why 127.0.0.1 Instead of localhost?

In GitHub Actions with service containers:
- Service containers run in Docker network
- Ports are mapped to runner host: `127.0.0.1:5432`
- `localhost` may resolve to IPv6 `::1` causing connection failures
- `127.0.0.1` explicitly uses IPv4, more reliable

### Why Add postgresql-client Package?

- `pg_isready` is part of PostgreSQL client tools
- Not included in base Ubuntu runner image
- `libpq-dev` needed for Python `asyncpg` driver compilation
- Small package (~5MB), fast to install

### Future Improvements

1. **Optimize wait time:**
   - Current: 30 attempts × 2 seconds = 60s max
   - Adjust if database typically ready faster

2. **Add Redis wait step:**
   - Currently only PostgreSQL has wait step
   - Redis also uses service container
   - May need similar verification

3. **Cache PostgreSQL client:**
   - Use actions/cache to cache apt packages
   - Reduce install time from ~5s to ~1s

4. **Health check improvements:**
   - Add custom health check script
   - Verify not just service running, but schema exists

---

## References

- GitHub Actions Documentation: https://docs.github.com/en/actions/using-containerized-services
- PostgreSQL Docker Hub: https://hub.docker.com/_/postgres
- asyncpg Documentation: https://magicstack.github.io/asyncpg/
- `pg_isready` Manual: https://www.postgresql.org/docs/current/app-pg-isready.html

---

**Status:** ✅ READY FOR TESTING
**Review:** Required before merge
**Impact:** All CI/CD workflows
