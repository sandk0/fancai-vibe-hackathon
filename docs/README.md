# BookReader AI Documentation

Welcome to the BookReader AI documentation. This documentation follows the [Diátaxis framework](https://diataxis.fr/) for systematic technical documentation.

## Quick Navigation

### 📘 [Guides](guides/) - Learning & Problem-Solving
Step-by-step tutorials and how-to guides for common tasks.

- **[Getting Started](guides/getting-started/)** - Installation, quick start, first book
- **[Development](guides/development/)** - Environment setup, testing, debugging
- **[Deployment](guides/deployment/)** - Production deployment, Docker, SSL
- **[Agents](guides/agents/)** - Claude Code agents usage
- **[Testing](guides/testing/)** - Writing tests, E2E, QA playbook

### 📖 [Reference](reference/) - Technical Specifications
Detailed technical information and API documentation.

- **[API](reference/api/)** - REST API endpoints and authentication
- **[Database](reference/database/)** - Schema, migrations, diagrams
- **[Components](reference/components/)** - Backend, frontend, parser components
- **[NLP](reference/nlp/)** - Multi-NLP system, processors, ensemble voting
- **[CLI](reference/cli/)** - Command-line interface reference

### 🎓 [Explanations](explanations/) - Concepts & Architecture
Understanding-oriented documentation about system design and decisions.

- **[Architecture](explanations/architecture/)** - System architecture, infrastructure, NLP
- **[Concepts](explanations/concepts/)** - CFI system, EPUB integration, subscriptions
- **[Design Decisions](explanations/design-decisions/)** - Why certain technologies were chosen
- **[Agents System](explanations/agents-system/)** - Claude Code agents architecture

### 🔧 [Operations](operations/) - Deployment & Maintenance
Operations and maintenance documentation.

- **[Deployment](operations/deployment/)** - Production deployment procedures
- **[Docker](operations/docker/)** - Docker setup, upgrade, security
- **[Backup](operations/backup/)** - Backup and restore procedures
- **[Monitoring](operations/monitoring/)** - Setup monitoring and dashboards
- **[Maintenance](operations/maintenance/)** - Database, cache, logs management

### 👨‍💻 [Development](development/) - Development Process
Development planning, progress tracking, and status.

- **[Planning](development/planning/)** - Development plan and calendar
- **[Changelog](development/changelog/)** - Version history
- **[Status](development/status/)** - Current status and progress
- **[Testing](development/testing/)** - Testing strategy and coverage
- **[Performance](development/performance/)** - Optimization plans and analysis

### 🔨 [Refactoring](refactoring/) - Code Refactoring
Refactoring documentation and reports.

- **[Plans](refactoring/plans/)** - Master refactoring plans
- **[Reports](refactoring/reports/)** - Phase reports and summaries
- **[Database](refactoring/database/)** - Database refactoring analysis
- **[NLP](refactoring/nlp/)** - NLP system refactoring
- **[Code Quality](refactoring/code-quality/)** - Code quality improvements

### 🔄 [CI/CD](ci-cd/) - Continuous Integration/Deployment
CI/CD workflows and troubleshooting.

- **[Workflows](ci-cd/workflows/)** - CI/CD workflow documentation
- **[Action Plans](ci-cd/action-plans/)** - Implementation plans
- **[Error Reports](ci-cd/error-reports/)** - Error tracking and solutions

### 🔐 [Security](security/) - Security Documentation
Security policies, audits, and reports.

- **[Reports](security/reports/)** - Security audits and fixes

### 📊 [Reports](reports/) - Temporal Reports Archive
Historical reports from development sessions (archived by quarter).

- **[Archive](reports/archive/)** - Archived reports by quarter

### 🇷🇺 [Russian Documentation](ru/)
Russian translations of documentation (mirrors English structure).

---

## Documentation Philosophy

This documentation follows the **Diátaxis** framework, which organizes content into four categories:

1. **Tutorials** (Learning-oriented) - Take the user by the hand through a series of steps
2. **How-to Guides** (Problem-oriented) - Guide the user through solving a specific problem
3. **Reference** (Information-oriented) - Technical descriptions of the machinery
4. **Explanation** (Understanding-oriented) - Clarify and illuminate topics

## Contributing to Documentation

When adding or updating documentation:

1. Place documents in the appropriate Diátaxis category
2. Update relevant README files with links
3. Follow existing formatting and style
4. Update CLAUDE.md if adding new development processes
5. Create both English and Russian versions when applicable

## Need Help?

- Check [CLAUDE.md](../CLAUDE.md) for development guidelines
- See [README.md](../README.md) for project overview
- Review [Development Plan](development/planning/development-plan.md) for roadmap

---

**Last Updated:** 2025-12-23
**Documentation Version:** 3.0 (LLM-only architecture, NLP removal)

> **Note:** Multi-NLP system (SpaCy, Natasha, Stanza, GLiNER) was removed in December 2025. Description extraction now uses Google Gemini API.
