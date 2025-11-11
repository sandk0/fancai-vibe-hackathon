# Development Dockerfile for Backend
# syntax=docker/dockerfile:1.4
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=0 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app \
    NLTK_DATA=/root/nltk_data \
    STANZA_RESOURCES_DIR=/root/stanza_resources

# Install system dependencies (rarely changes - cached)
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libpq-dev \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

# Create working directory
WORKDIR /app

# Copy requirements first for better layer caching (changes occasionally)
COPY requirements.txt .

# Install Python dependencies with BuildKit cache mount for pip
# Cache persists across rebuilds - no redownload!
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install -r requirements.txt

# Download NLP models with separate cache mounts
# Models download to volumes - persist across rebuilds!
# SpaCy models - install directly from GitHub release
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install https://github.com/explosion/spacy-models/releases/download/ru_core_news_lg-3.7.0/ru_core_news_lg-3.7.0-py3-none-any.whl && \
    echo "✅ SpaCy ru_core_news_lg-3.7.0 downloaded"

# NLTK data
RUN python -c "import nltk; \
    nltk.download('punkt', download_dir='/root/nltk_data'); \
    nltk.download('stopwords', download_dir='/root/nltk_data'); \
    nltk.download('wordnet', download_dir='/root/nltk_data'); \
    nltk.download('averaged_perceptron_tagger', download_dir='/root/nltk_data')" && \
    echo "✅ NLTK data downloaded"

# Stanza models
RUN python -c "import stanza; stanza.download('ru', model_dir='/root/stanza_resources', verbose=False)" && \
    echo "✅ Stanza ru model downloaded"

# Final verification
RUN echo "✅ All NLP models downloaded successfully"

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs /app/storage

# Create non-root user for development
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Default command (runs as appuser)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]