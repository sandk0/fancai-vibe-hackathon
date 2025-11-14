# Reference - Technical Specifications

Information-oriented technical reference documentation.

## API
- [Overview](api/overview.md) - REST API overview
- **Endpoints:**
  - [Books](api/endpoints/books.md) - Books API endpoints
  - [Users](api/endpoints/users.md) - Users API endpoints
  - [NLP](api/endpoints/nlp.md) - NLP API endpoints
  - [Admin](api/endpoints/admin.md) - Admin API endpoints
- [Authentication](api/authentication.md) - Authentication methods

## Database
- [Schema](database/schema.md) - Database schema documentation
- [Schema Diagram](database/schema-diagram.md) - Visual schema diagrams
- [Migrations](database/migrations.md) - Migration procedures

## Components
### Backend
- [Models](components/backend/models.md) - SQLAlchemy models
- [Services](components/backend/services.md) - Business logic services
- [Celery Tasks](components/backend/celery-tasks.md) - Asynchronous tasks
- [NLP Processor](components/backend/nlp-processor.md) - NLP processing

### Frontend
- [Components](components/frontend/components.md) - React components
- [State Management](components/frontend/state-management.md) - Zustand stores
- [API Client](components/frontend/api-client.md) - API client library
- [EPUB Reader](components/frontend/epub-reader.md) - epub.js integration

### Parser
- [Book Parser](components/parser/book-parser.md) - EPUB/FB2 parser

## NLP
- [Multi-NLP System](nlp/multi-nlp-system.md) - Multi-NLP architecture
- [Processors](nlp/processors.md) - Individual NLP processors
- [Ensemble Voting](nlp/ensemble-voting.md) - Consensus algorithm

## CLI
- [Development Commands](cli/development-commands.md) - Development CLI reference
- [Deployment Scripts](cli/deployment-scripts.md) - Deployment CLI reference

---

[Back to Documentation Index](../README.md)
