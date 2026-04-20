# ============================
# Stage 1: Build Frontend
# ============================
FROM node:20-slim AS frontend-build

WORKDIR /build/frontend

# Layer caching: deps first (P19)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --no-audit

# Copy source and build
COPY frontend/ ./
RUN npm run build

# ============================
# Stage 2: Python Runtime
# ============================
FROM python:3.12-slim

# Security: create non-root user (OWASP A05)
RUN groupadd --gid 1001 appuser && \
    useradd --uid 1001 --gid 1001 --create-home appuser

WORKDIR /app

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl && \
    rm -rf /var/lib/apt/lists/*

# Layer caching: Python deps first (P19)
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/app ./app

# Copy frontend build output
COPY --from=frontend-build /build/frontend/dist ./frontend/dist

# Set ownership to non-root user
RUN chown -R appuser:appuser /app

# Health check for Cloud Run (P1)
HEALTHCHECK --interval=30s --timeout=5s \
    CMD curl -f http://localhost:8080/health || exit 1

# Cloud Run uses PORT env var
ENV PORT=8080
ENV ENVIRONMENT=production
# Python optimizations for production
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

EXPOSE 8080

# Security: run as non-root user (OWASP A05)
USER appuser

# Run with uvicorn (single worker, P2)
CMD ["python", "-m", "uvicorn", "app.main:app", \
     "--host", "0.0.0.0", "--port", "8080", \
     "--workers", "1", "--loop", "uvloop"]
