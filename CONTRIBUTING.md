# Contributing to BookReader AI

Thank you for your interest in contributing to BookReader AI! This document provides guidelines and instructions for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Documentation Requirements](#documentation-requirements)
- [Testing Requirements](#testing-requirements)
- [Community](#community)

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for all contributors.

## Getting Started

### Prerequisites

Before contributing, ensure you have:
- Python 3.11+
- Node.js 18+
- Docker and Docker Compose
- Git

### Setting Up Your Development Environment

1. **Fork and Clone**
   ```bash
   git fork <repository-url>
   git clone https://github.com/YOUR_USERNAME/fancai-vibe-hackathon.git
   cd fancai-vibe-hackathon
   ```

2. **Set Up Environment**
   ```bash
   # Copy environment template
   cp .env.example .env

   # Install dependencies
   cd backend && pip install -r requirements.txt
   cd ../frontend && npm install
   ```

3. **Start Development Environment**
   ```bash
   docker-compose -f docker-compose.dev.yml up -d
   ```

4. **Verify Setup**
   ```bash
   # Backend health check
   curl http://localhost:8000/health

   # Frontend should be available at http://localhost:5173
   ```

For detailed setup instructions, see [Installation Guide](docs/guides/getting-started/installation.md).

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Your Changes

Follow these guidelines:
- Write clear, readable code
- Follow existing code style
- Add tests for new features
- Update documentation
- Keep commits atomic and focused

### 3. Run Tests

```bash
# Backend tests
cd backend && pytest -v --cov=app

# Frontend tests
cd frontend && npm test

# E2E tests
cd frontend && npm run test:e2e
```

### 4. Lint and Format

```bash
# Backend
cd backend
ruff check .
black .
mypy app/ --strict

# Frontend
cd frontend
npm run lint
npm run type-check
```

### 5. Pre-commit Hooks

We use pre-commit hooks to ensure code quality:

```bash
# Install hooks
pre-commit install

# Run all checks
pre-commit run --all-files
```

## Coding Standards

### Python (Backend)

**Style Guide:** PEP 8 with Black formatting

**Type Hints:** Required for all functions
```python
def extract_descriptions(text: str, description_type: str) -> List[Description]:
    """
    Extract descriptions from text.

    Args:
        text: Source text to analyze
        description_type: Type of descriptions to extract

    Returns:
        List of found descriptions with metadata

    Example:
        >>> descriptions = extract_descriptions(chapter_text, 'location')
        >>> print(f"Found {len(descriptions)} location descriptions")
    """
    pass
```

**Docstrings:** Google style required
- All public functions must have docstrings
- Include Args, Returns, Raises, Example sections
- Keep descriptions clear and concise

**Code Organization:**
- Follow Single Responsibility Principle (SRP)
- Maximum file size: ~500 lines
- Use custom exceptions from `app/core/exceptions.py`
- Use reusable dependencies from `app/core/dependencies.py`

### TypeScript (Frontend)

**Style Guide:** ESLint + Prettier

**Type Safety:** Strict mode enabled
```typescript
/**
 * Book reader component with image support
 *
 * @param book - Book object to read
 * @param currentPage - Current page number
 * @param onPageChange - Callback when page changes
 */
interface BookReaderProps {
  book: Book;
  currentPage: number;
  onPageChange: (page: number) => void;
}
```

**Components:**
- Use functional components with hooks
- Props must be typed with interfaces
- Use React.memo for performance-critical components
- Follow React best practices

### Database Migrations

**Alembic Conventions:**
```bash
# Create migration
cd backend
alembic revision --autogenerate -m "descriptive_migration_name"

# Review generated migration carefully!
# Edit if needed before applying

# Apply migration
alembic upgrade head
```

**Migration Guidelines:**
- Always review auto-generated migrations
- Use `op.batch_alter_table()` for SQLite compatibility
- Include both `upgrade()` and `downgrade()`
- Test migrations on clean database
- Document breaking changes

## Commit Guidelines

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes (formatting, no logic changes)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Build, CI, dependencies, tooling

### Examples

**Good commits:**
```bash
feat(parser): add EPUB file parser

- Implement EpubParser class with extract_content() method
- Add support for CSS styles and images
- Add unit tests for all public methods
- Update documentation: docs/components/backend/epub-parser.md

Closes #123

fix(reader): fix pagination on mobile devices

- Fix text overflow on screens <768px
- Optimize page height calculation for different fonts
- Add responsive tests

Fixes #456

docs: update development plan and calendar

- Mark EPUB parser tasks as completed
- Add new tasks for Phase 2
- Update time estimates

[skip ci]
```

**Bad commits:**
```bash
# Too vague
fix: bug fix

# No context
update files

# Multiple unrelated changes
feat: add parser, fix auth, update docs
```

### Commit Rules

- Commits should be atomic (one logical change)
- Write clear, descriptive commit messages
- Reference issues when applicable (`Closes #123`, `Fixes #456`)
- Use present tense ("add feature" not "added feature")
- Capitalize first letter of subject
- No period at end of subject
- Separate subject from body with blank line
- Wrap body at 72 characters

## Pull Request Process

### Before Submitting

1. **Ensure all tests pass**
   ```bash
   # Run full test suite
   cd backend && pytest -v --cov=app
   cd frontend && npm test && npm run test:e2e
   ```

2. **Check code quality**
   ```bash
   # Backend
   cd backend && ruff check . && black --check . && mypy app/ --strict

   # Frontend
   cd frontend && npm run lint && npm run type-check
   ```

3. **Update documentation**
   - Update relevant documentation files
   - Add docstrings to new functions
   - Update changelog if needed

4. **Verify pre-commit hooks pass**
   ```bash
   pre-commit run --all-files
   ```

### PR Template

When creating a PR, include:

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Backend tests pass
- [ ] Frontend tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Documentation
- [ ] Code includes docstrings
- [ ] README updated (if needed)
- [ ] API documentation updated (if needed)
- [ ] Changelog updated

## Related Issues
Closes #<issue_number>

## Screenshots (if applicable)
Add screenshots for UI changes
```

### Review Process

1. **Automated Checks**
   - CI/CD pipeline must pass
   - All tests must pass
   - Code coverage should not decrease
   - Type checking must pass

2. **Code Review**
   - At least one approval required
   - Address all review comments
   - Keep discussions constructive

3. **Merge**
   - Squash commits for cleaner history (optional)
   - Delete branch after merge
   - Monitor CI/CD after merge

## Documentation Requirements

**CRITICAL:** Every code change MUST be accompanied by documentation updates!

### Required Documentation Updates

After implementing a feature, update:

1. **README.md** - If adding new functionality
2. **docs/development/planning/development-plan.md** - Mark completed tasks
3. **docs/development/planning/development-calendar.md** - Record dates
4. **docs/development/changelog/2025.md** - Detailed change description
5. **docs/development/status/current-status.md** - Current project state
6. **Code documentation** - Docstrings, comments, module READMEs

### Documentation Standards

**Python Docstrings:**
```python
def function_name(param1: Type1, param2: Type2) -> ReturnType:
    """
    Brief one-sentence description.

    More detailed description if needed.
    Can span multiple paragraphs.

    Args:
        param1: Description of param1
        param2: Description of param2

    Returns:
        Description of return value

    Raises:
        ValueError: When it's raised
        HTTPException: When it's raised

    Example:
        >>> result = function_name("test", 42)
        >>> print(result)
        expected_output

    Note:
        Important notes about usage
    """
```

**TypeScript JSDoc:**
```typescript
/**
 * Brief description of component/function
 *
 * @param {Type} paramName - Parameter description
 * @returns {ReturnType} Return value description
 *
 * @example
 * const result = functionName(param);
 *
 * @throws {Error} When error is thrown
 */
```

For detailed documentation guidelines, see [CLAUDE.md](CLAUDE.md).

## Testing Requirements

### Test Coverage Requirements

- **Minimum coverage:** 70% overall
- **Core modules:** 100% coverage required
- **New features:** Must include tests
- **Bug fixes:** Must include regression tests

### Testing Pyramid

1. **Unit Tests** (Backend)
   ```bash
   cd backend
   pytest tests/unit/ -v
   ```

2. **Integration Tests** (Backend)
   ```bash
   cd backend
   pytest tests/integration/ -v
   ```

3. **Component Tests** (Frontend)
   ```bash
   cd frontend
   npm test
   ```

4. **E2E Tests** (Full stack)
   ```bash
   cd frontend
   npm run test:e2e
   ```

### Writing Tests

**Backend (pytest):**
```python
import pytest
from app.services.book_parser import BookParser

def test_parse_epub_valid_file():
    """Test parsing valid EPUB file."""
    parser = BookParser()
    result = parser.parse_epub("tests/fixtures/sample.epub")

    assert result is not None
    assert len(result.chapters) > 0
    assert result.metadata["title"] == "Sample Book"

@pytest.mark.asyncio
async def test_async_function():
    """Test async function."""
    result = await some_async_function()
    assert result == expected_value
```

**Frontend (Vitest):**
```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BookReader } from './BookReader';

describe('BookReader', () => {
  it('renders book content', () => {
    const book = { title: 'Test Book', content: 'Content' };
    render(<BookReader book={book} />);
    expect(screen.getByText('Test Book')).toBeInTheDocument();
  });
});
```

For detailed testing guidelines, see [Testing Guide](docs/guides/testing/testing-guide.md).

## Community

### Getting Help

- **Documentation:** Check [docs/](docs/) first
- **Issues:** Search existing issues before creating new ones
- **Discussions:** Use GitHub Discussions for questions
- **Discord/Slack:** (Add if available)

### Reporting Bugs

Use the bug report template:

```markdown
**Bug Description**
Clear description of the bug

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected Behavior**
What should happen

**Screenshots**
If applicable

**Environment**
- OS: [e.g. macOS 14.0]
- Browser: [e.g. Chrome 120]
- Version: [e.g. 1.0.0]

**Additional Context**
Any other information
```

### Feature Requests

Use the feature request template:

```markdown
**Feature Description**
Clear description of the feature

**Use Case**
Why is this feature needed?

**Proposed Solution**
How should it work?

**Alternatives Considered**
Other approaches considered

**Additional Context**
Any other information
```

## Quick Reference

### Common Commands

```bash
# Development
docker-compose -f docker-compose.dev.yml up -d

# Tests
cd backend && pytest -v --cov=app
cd frontend && npm test

# Linting
cd backend && ruff check . && black .
cd frontend && npm run lint

# Type checking
cd backend && mypy app/ --strict
cd frontend && npm run type-check

# Database migrations
cd backend && alembic upgrade head
cd backend && alembic revision --autogenerate -m "description"

# Pre-commit hooks
pre-commit install
pre-commit run --all-files
```

### File Structure

```
fancai-vibe-hackathon/
├── frontend/           # React application
├── backend/            # FastAPI application
│   ├── app/
│   │   ├── core/      # Core utilities (config, db, exceptions, dependencies)
│   │   ├── models/    # SQLAlchemy models
│   │   ├── routers/   # API routes (modular)
│   │   ├── services/  # Business logic (modular)
│   │   └── schemas/   # Pydantic schemas
│   └── tests/         # Tests
├── docs/              # Documentation
│   ├── guides/        # Tutorials & how-to guides
│   ├── reference/     # Technical documentation
│   ├── explanations/  # Concepts & architecture
│   └── operations/    # Deployment & maintenance
└── scripts/           # Utility scripts
```

## License

By contributing, you agree that your contributions will be licensed under the same license as the project.

---

**Thank you for contributing to BookReader AI!**

For questions, check [FAQ.md](FAQ.md) or open an issue.
