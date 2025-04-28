# Stage 1: Builder
FROM python:3.11-slim-bookworm AS builder

WORKDIR /app

# Install only essential build tools (optional)
RUN apt-get update && apt-get install -y --no-install-recommends gcc

# Only copy requirements first (better cache use)
COPY requirements.txt .

# Install only production dependencies
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt

# Stage 2: Runtime
FROM python:3.11-slim-bookworm

WORKDIR /app


COPY --from=builder /install /usr/local


COPY . /app



EXPOSE 80

# Command to run
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000"]
