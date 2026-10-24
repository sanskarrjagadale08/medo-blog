# Lightweight production container for Medo MBBS
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1
ENV PORT=8080

WORKDIR /app

# Copy project files
COPY . /app

# Ensure uploads directory exists and initialize SQLite DB
RUN mkdir -p uploads static templates && python3 database.py

EXPOSE 8080

CMD ["python3", "server.py"]
