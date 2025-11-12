ARG PYTHON_VERSION=3.11
FROM python:${PYTHON_VERSION}-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=off \
    PIP_DISABLE_PIP_VERSION_CHECK=on \
    PIP_DEFAULT_TIMEOUT=100

WORKDIR /app

# Copy dependency manifests first for better layer caching
COPY requirements /tmp/requirements
COPY user-service/requirements.txt /tmp/user-service/requirements.txt

RUN pip install --upgrade pip \
    && pip install -r /tmp/user-service/requirements.txt

# Copy application source
COPY user-service/app /app/app
COPY user-service/alembic.ini /app/alembic.ini
COPY user-service/alembic /app/alembic

EXPOSE 8001

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
