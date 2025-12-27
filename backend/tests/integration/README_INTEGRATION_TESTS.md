# Integration Tests for BookReader AI

This directory contains comprehensive integration tests for the main user flows in BookReader AI backend.

## Created Integration Test Suites

### 1. Authentication Flow (`test_auth_flow_integration.py`)

**Status**: ✅ All 9 tests passing

Tests the complete authentication user journey:

- `test_complete_auth_flow` - Full flow: register → login → refresh token → logout
- `test_login_with_invalid_credentials` - Invalid password handling
- `test_access_protected_endpoint_without_token` - Unauthorized access protection
- `test_access_protected_endpoint_with_invalid_token` - Invalid token rejection
- `test_refresh_token_with_invalid_token` - Invalid refresh token handling
- `test_duplicate_registration` - Duplicate email validation
- `test_weak_password_registration` - Password strength validation
- `test_profile_update_flow` - Profile update workflow
- `test_password_change_flow` - Password change workflow

**Key Features Tested**:
- JWT token generation and validation
- User registration with password validation
- Login and authentication
- Token refresh mechanism
- Logout with token blacklisting
- Profile updates
- Password changes with current password verification

### 2. Book Upload Flow (`test_book_upload_flow_integration.py`)

**Status**: ⚠️ 3 passing, 4 failing (needs API alignment)

Tests the complete book upload user journey:

- `test_complete_book_upload_flow` - Upload EPUB → parse → get chapters → list in library
- `test_upload_invalid_file_format` - Invalid file format rejection ✅
- `test_upload_without_authentication` - Authentication requirement
- `test_upload_corrupted_epub` - Corrupted file handling ✅
- `test_get_book_chapters_flow` - Chapter retrieval after upload
- `test_upload_multiple_books` - Multiple books for same user
- `test_get_nonexistent_book` - 404 for non-existent books ✅

**Key Features Tested**:
- EPUB file upload and parsing
- Book metadata extraction
- Chapter creation and storage
- Book listing in user library
- File validation and error handling
- Multi-book support per user

**Known Issues**:
- Some tests expect different response structures than current API
- Need to align with actual book upload response format

### 3. Reading Progress Flow (`test_reading_progress_flow_integration.py`)

**Status**: ⚠️ 1 passing, 4 failing (needs API alignment)

Tests the complete reading progress user journey:

- `test_complete_reading_progress_flow` - Save → sync → restore progress with CFI
- `test_progress_sync_across_updates` - Rapid progress updates handling
- `test_progress_isolation_between_users` - Progress isolation per user
- `test_progress_without_authentication` - Authentication requirement
- `test_update_progress_for_nonexistent_book` - 404 for non-existent books ✅

**Key Features Tested**:
- CFI (Canonical Fragment Identifier) tracking for epub.js
- Scroll offset percentage storage
- Chapter position tracking
- Progress persistence and retrieval
- Multi-user isolation
- Rapid update handling

**Known Issues**:
- Response structure needs alignment with actual API
- Progress endpoint response format differs from tests

## Test Statistics

**Total**: 21 integration tests
- ✅ **Passing**: 13 tests (62%)
- ⚠️ **Failing**: 8 tests (38% - require API alignment)

### Passing Tests by Category
- Auth Flow: 9/9 (100%)
- Book Upload: 3/7 (43%)
- Reading Progress: 1/5 (20%)

## Test Infrastructure

### Technology Stack
- **pytest** - Testing framework
- **pytest-asyncio** - Async test support
- **httpx.AsyncClient** - HTTP client for API testing
- **SQLAlchemy AsyncSession** - Database session for verification
- **PostgreSQL** - Test database (separate from production)

### Test Database
- Uses `bookreader_test` database on same PostgreSQL container
- Tables created/dropped per test function for isolation
- Connection: `postgresql+asyncpg://postgres:postgres123@postgres:5432/bookreader_test`

### Test Fixtures (from `conftest.py`)

```python
test_db              # Creates/drops test database tables
db_session           # Provides AsyncSession for tests
client               # AsyncClient with app and database overrides
test_user            # Creates test user in database
test_book            # Creates test book with chapters
admin_auth_headers   # Authenticated admin headers
auth_headers         # Authenticated user headers
```

## Running the Tests

### Run all integration tests
```bash
docker exec bookreader_backend_lite pytest tests/integration/ -v
```

### Run specific test file
```bash
docker exec bookreader_backend_lite pytest tests/integration/test_auth_flow_integration.py -v
```

### Run specific test
```bash
docker exec bookreader_backend_lite pytest tests/integration/test_auth_flow_integration.py::TestAuthFlowIntegration::test_complete_auth_flow -v
```

### Run with coverage
```bash
docker exec bookreader_backend_lite pytest tests/integration/ -v --cov=app --cov-report=term-missing
```

### Run without coverage (faster)
```bash
docker exec bookreader_backend_lite pytest tests/integration/ -v --no-cov
```

## Test Helpers

### Creating Test EPUB Files

Tests include a `create_minimal_epub()` helper function that generates valid EPUB files for testing:

```python
def create_minimal_epub() -> io.BytesIO:
    """Create a minimal valid EPUB file for testing."""
    # Creates ZIP with:
    # - mimetype (application/epub+zip)
    # - META-INF/container.xml
    # - OEBPS/content.opf (metadata)
    # - OEBPS/toc.ncx (navigation)
    # - OEBPS/chapterN.xhtml (content)
```

### Test Data

Sample user credentials:
```python
{
    "email": "test@example.com",
    "password": "SecureP@ss0w9rd!",  # Meets all password requirements
    "full_name": "Test User"
}
```

## API Endpoints Tested

### Authentication (`/api/v1/auth/`)
- `POST /auth/register` - User registration
- `POST /auth/login` - User login
- `POST /auth/refresh` - Token refresh
- `GET /auth/me` - Current user info
- `PUT /auth/profile` - Update profile
- `POST /auth/logout` - Logout

### Books (`/api/v1/books/`)
- `POST /books/upload` - Upload EPUB/FB2
- `GET /books` - List user's books
- `GET /books/{id}` - Book details
- `GET /books/{id}/progress` - Reading progress
- `POST /books/{id}/progress` - Update progress

### Chapters (`/api/v1/chapters/`)
- `GET /chapters/{id}` - Chapter content

## Next Steps

### For Failing Tests

1. **Book Upload Flow** - Align response structure:
   - Check actual book upload response format
   - Verify chapters endpoint structure
   - Update test assertions to match API

2. **Reading Progress Flow** - Align response structure:
   - Check progress response format
   - Verify CFI field names
   - Update test assertions to match API

### Future Enhancements

1. **Description Extraction Tests**
   - Test LLM-based description extraction via Gemini
   - Verify description storage and retrieval
   - Test chapter-description associations

2. **Image Generation Tests**
   - Test Imagen 4 integration
   - Verify image caching
   - Test offline image storage

3. **Feature Flag Tests**
   - Test feature flag toggling
   - Verify feature availability based on flags
   - Test admin feature management

4. **Subscription Tests**
   - Test subscription tier limitations
   - Verify FREE/PREMIUM/ULTIMATE features
   - Test subscription upgrades/downgrades

## Test Best Practices

### ✅ Do
- Create fresh database for each test (handled by fixtures)
- Use async/await for all async operations
- Test full user workflows, not just individual endpoints
- Verify both HTTP responses AND database state
- Use descriptive test names explaining the scenario
- Clean up test data (handled by fixtures)

### ❌ Don't
- Share state between tests
- Use production database
- Test implementation details instead of behavior
- Skip authentication in protected endpoint tests
- Hardcode UUIDs or timestamps

## Troubleshooting

### Import Errors
```bash
# Install missing dependencies
docker exec -u root bookreader_backend_lite pip install <package>
```

### Database Connection Issues
```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Check test database exists
docker exec bookreader_postgres_lite psql -U postgres -c "\l"
```

### Test Failures
```bash
# Run with verbose output
pytest tests/integration/ -vv --tb=short

# Run with full traceback
pytest tests/integration/ -vv --tb=long

# Run with Python debugger
pytest tests/integration/ -vv --pdb
```

## Contributing

When adding new integration tests:

1. Follow the existing test structure
2. Use descriptive test names: `test_<scenario>_<expected_outcome>`
3. Document the flow being tested
4. Use fixtures for setup/teardown
5. Test both success and failure cases
6. Verify database state, not just API responses
7. Add test to appropriate test class

## References

- [pytest documentation](https://docs.pytest.org/)
- [pytest-asyncio](https://pytest-asyncio.readthedocs.io/)
- [httpx AsyncClient](https://www.python-httpx.org/async/)
- [SQLAlchemy async](https://docs.sqlalchemy.org/en/20/orm/extensions/asyncio.html)
