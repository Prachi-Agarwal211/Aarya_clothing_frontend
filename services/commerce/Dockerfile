# Commerce Service Dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY services/commerce/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules first
COPY shared/ /app/shared/

# Copy application code
COPY services/commerce/ .

# Add app to Python path so 'shared' package is found
ENV PYTHONPATH="/app:${PYTHONPATH}"

# Expose port
EXPOSE 5002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5002/health')" || exit 1

ENV UVICORN_WORKERS=8
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port 5002 --workers ${UVICORN_WORKERS} --log-level info"]
