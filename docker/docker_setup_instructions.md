# Docker Deployment for Laundry App on Raspberry Pi

This document provides instructions for deploying the Laundry App on a Raspberry Pi using Docker, with access to an existing SQLite database located at `/home/sergei/PycharmProjects/laundry_appvib.db`.

## Dockerfile

Create a file named `Dockerfile` with the following content:

```dockerfile
FROM python:3.11-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    sqlite3 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Run the application
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "1", "main:app"]
```

## Requirements File

Make sure you have a `requirements.txt` file in the same directory as your Dockerfile with the following content:

```
boto3
email-validator
flask
flask-sqlalchemy
gunicorn
psycopg2-binary
pytz
serial
sqlalchemy
twilio
```

## Docker Compose File

Create a file named `docker-compose.yml` with the following content:

```yaml
version: '3'

services:
  laundry_app:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - /home/sergei/PycharmProjects/laundry_appvib.db:/app/vib.db
      - ./:/app
    environment:
      - DATABASE_URL=sqlite:///vib.db
    restart: always
```

## Deployment Instructions

1. Copy your entire project files to a directory on your Raspberry Pi
2. Navigate to that directory
3. Make sure the Dockerfile and docker-compose.yml files are in the project root
4. Run the following commands:

```bash
# Build and start the container
docker-compose up -d

# Check logs if needed
docker-compose logs -f
```

## Running Without Docker Compose

If you prefer to run without Docker Compose, you can use the following Docker commands:

```bash
# Build the Docker image
docker build -t laundry_app .

# Run the container
docker run -d \
  --name laundry_app_container \
  -p 5000:5000 \
  -v /home/sergei/PycharmProjects/laundry_appvib.db:/app/vib.db \
  -v $(pwd):/app \
  -e DATABASE_URL=sqlite:///vib.db \
  --restart always \
  laundry_app
```

## Accessing the Application

Once deployed, the application will be accessible at:
- http://[raspberry-pi-ip]:5000

## Updates and Maintenance

To update the application:

```bash
# Pull the latest code changes
git pull

# Rebuild and restart the container
docker-compose down
docker-compose up -d --build
```

## Troubleshooting

1. If the container can't access the database, check permissions on the SQLite file:
   ```bash
   sudo chmod 644 /home/sergei/PycharmProjects/laundry_appvib.db
   sudo chown 1000:1000 /home/sergei/PycharmProjects/laundry_appvib.db
   ```

2. To check container logs:
   ```bash
   docker logs laundry_app_container
   ```

3. To access the container shell:
   ```bash
   docker exec -it laundry_app_container bash
   ```