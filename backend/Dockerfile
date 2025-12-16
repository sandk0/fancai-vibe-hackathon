# Lightweight Backend Dockerfile
# NLP REMOVAL (December 2025): SpaCy, NLTK, Stanza removed
# syntax=docker/dockerfile:1.4
FROM python:3.11-slim

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=0 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONPATH=/app

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
# NLP REMOVAL: No SpaCy, NLTK, Stanza models needed anymore
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install --upgrade pip && \
    pip install -r requirements.txt

# Final verification
RUN echo "✅ Dependencies installed (NLP models removed for optimization)"

# Copy source code
COPY . .

# Create necessary directories
RUN mkdir -p /app/uploads /app/logs /app/storage /app/storage/generated_images

# Create non-root user for development
RUN groupadd -r appuser && useradd -r -g appuser appuser && \
    chown -R appuser:appuser /app

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

# Default command (runs as appuser)
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
