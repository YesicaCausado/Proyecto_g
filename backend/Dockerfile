FROM python:3.12-slim

WORKDIR /app/bot-service

# Instalar dependencias del sistema
RUN apt-get update && apt-get install -y \
    gcc \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Copiar requirements (backend/requirements.txt incluye ../api/requirements.txt,
# la fuente única de dependencias de producción)
COPY api/requirements.txt /app/api/requirements.txt
COPY backend/requirements.txt .

# Instalar dependencias de Python
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código
COPY backend/app app

# Variables de entorno
ENV PYTHONUNBUFFERED=1

# Comando para iniciar
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
