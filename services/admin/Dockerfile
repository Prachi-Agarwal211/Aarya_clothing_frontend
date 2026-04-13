# Admin Service Dockerfile
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1
ENV PIP_DISABLE_PIP_VERSION_CHECK=1

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY services/admin/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules
COPY shared/ /app/shared/

COPY services/admin/ .

# Add app to Python path so 'shared' package is found
ENV PYTHONPATH="/app:${PYTHONPATH}"

EXPOSE 5004

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:5004/health')" || exit 1

ENV UVICORN_WORKERS=5
CMD ["sh", "-c", "exec uvicorn main:app --host 0.0.0.0 --port 5004 --workers ${UVICORN_WORKERS} --log-level info"]
