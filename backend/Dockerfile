FROM python:3.11-slim-bookworm AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc g++ libffi-dev libssl-dev \
    && rm -rf /var/lib/apt/lists/*
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt
FROM python:3.11-slim-bookworm
WORKDIR /app
COPY --from=builder /install /usr/local
COPY server.py /app/
COPY requirements.txt /app/
COPY utils/ /app/utils/
COPY ai/ /app/ai/
COPY Prompts/ /app/Prompts/
COPY Model/ /app/Model/
COPY config/ /app/config/
COPY cache/ /app/cache/
COPY logs/ /app/logs/
COPY resources/ /app/resources/
COPY index_store/ /app/index_store/

EXPOSE 8000
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
    