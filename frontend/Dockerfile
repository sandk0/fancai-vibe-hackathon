# Development Dockerfile for Frontend
FROM node:20-alpine

# Install system dependencies (including wget for health checks)
RUN apk add --no-cache \
    libc6-compat \
    wget \
    curl

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install dependencies (clean install for proper platform)
RUN npm ci || (rm -rf node_modules package-lock.json && npm install)

# Copy source code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001 && \
    chown -R nextjs:nodejs /app

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000 || exit 1

# Default development command
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]