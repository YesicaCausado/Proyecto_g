#!/bin/bash

# 🏗️ Script de Organización - NeuroLearn AI Microservicios
# Organiza toda la estructura del proyecto

set -e

echo "🏗️  NeuroLearn AI - Organizando Estructura de Microservicios"
echo "=========================================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m'

# Función para verificar y crear directorios
ensure_dir() {
    local dir=$1
    if [ ! -d "$dir" ]; then
        mkdir -p "$dir"
        echo -e "${GREEN}✓${NC} Creado: $dir"
    else
        echo -e "${BLUE}•${NC} Existe: $dir"
    fi
}

# Función para verificar archivos
ensure_file() {
    local file=$1
    if [ ! -f "$file" ]; then
        echo -e "${RED}✗${NC} Falta: $file"
        return 1
    else
        echo -e "${GREEN}✓${NC} Existe: $file"
        return 0
    fi
}

echo -e "${BLUE}📁 Verificando estructura de directorios...${NC}"
echo ""

# Auth Service
echo "🔐 Auth Service:"
ensure_dir "auth-service/app"
ensure_dir "auth-service/app/api"
ensure_dir "auth-service/app/core"
ensure_dir "auth-service/app/db"
ensure_dir "auth-service/app/models"
ensure_dir "auth-service/app/schemas"
ensure_dir "auth-service/app/services"

# Bot Service (Backend)
echo ""
echo "🤖 Bot Service:"
ensure_dir "backend/app"
ensure_dir "backend/app/api"
ensure_dir "backend/app/core"
ensure_dir "backend/app/db"
ensure_dir "backend/app/models"
ensure_dir "backend/app/schemas"
ensure_dir "backend/app/services"
ensure_dir "backend/app/ai"

# Frontend
echo ""
echo "⚛️  Frontend:"
ensure_dir "frontend/src"
ensure_dir "frontend/src/components"
ensure_dir "frontend/src/pages"
ensure_dir "frontend/src/services"
ensure_dir "frontend/src/types"

echo ""
echo -e "${BLUE}📄 Verificando archivos críticos...${NC}"
echo ""

# Auth Service files
echo "🔐 Auth Service:"
auth_files=(
    "auth-service/app/__init__.py"
    "auth-service/app/main.py"
    "auth-service/app/core/config.py"
    "auth-service/app/db/database.py"
    "auth-service/app/models/user.py"
    "auth-service/app/schemas/schemas.py"
    "auth-service/app/services/auth_service.py"
    "auth-service/app/api/auth.py"
    "auth-service/requirements.txt"
    "auth-service/.env"
    "auth-service/Dockerfile"
)

for file in "${auth_files[@]}"; do
    if ! ensure_file "$file"; then
        echo -e "${RED}   ⚠️  Archivo faltante: $file${NC}"
    fi
done

# Bot Service files
echo ""
echo "🤖 Bot Service:"
bot_files=(
    "backend/app/__init__.py"
    "backend/app/main.py"
    "backend/app/core/config.py"
    "backend/app/db/database.py"
    "backend/app/models/user.py"
    "backend/app/models/learning.py"
    "backend/app/models/expert_bot.py"
    "backend/app/models/classroom.py"
    "backend/app/schemas/schemas.py"
    "backend/app/api/chat.py"
    "backend/app/api/expert_bot.py"
    "backend/app/api/classroom.py"
    "backend/requirements.txt"
    "backend/.env"
    "backend/Dockerfile"
)

for file in "${bot_files[@]}"; do
    if ! ensure_file "$file"; then
        echo -e "${RED}   ⚠️  Archivo faltante: $file${NC}"
    fi
done

# Documentation
echo ""
echo "📚 Documentación:"
docs=(
    "README.md"
    "ARQUITECTURA_MICROSERVICIOS.md"
    "INICIO_RAPIDO.md"
    "CAMBIOS_REALIZADOS.md"
    "docker-compose.yml"
    "run_services.sh"
)

for file in "${docs[@]}"; do
    if ! ensure_file "$file"; then
        echo -e "${RED}   ⚠️  Archivo faltante: $file${NC}"
    fi
done

echo ""
echo -e "${BLUE}🔧 Verificando dependencias...${NC}"
echo ""

# Instalar dependencias Auth Service
if [ -f "auth-service/requirements.txt" ]; then
    echo "📦 Instalando dependencias Auth Service..."
    cd auth-service
    pip install -q -r requirements.txt 2>/dev/null || echo -e "${YELLOW}⚠️  Error instalando dependencias Auth Service${NC}"
    cd ..
fi

# Instalar dependencias Bot Service
if [ -f "backend/requirements.txt" ]; then
    echo "📦 Instalando dependencias Bot Service..."
    cd backend
    pip install -q -r requirements.txt 2>/dev/null || echo -e "${YELLOW}⚠️  Error instalando dependencias Bot Service${NC}"
    cd ..
fi

# Instalar dependencias Frontend
if [ -f "frontend/package.json" ]; then
    echo "📦 Instalando dependencias Frontend..."
    cd frontend
    npm install -q 2>/dev/null || echo -e "${YELLOW}⚠️  Error instalando dependencias Frontend${NC}"
    cd ..
fi

echo ""
echo -e "${BLUE}🗄️  Verificando bases de datos...${NC}"
echo ""

# Verificar conexión Neon
if [ -f "auth-service/test_neon_connection.py" ]; then
    echo "🔗 Probando conexión Neon PostgreSQL..."
    cd auth-service
    python test_neon_connection.py 2>/dev/null || echo -e "${YELLOW}⚠️  Error conectando a Neon${NC}"
    cd ..
fi

# Inicializar BD Auth Service
if [ -f "auth-service/init_db.py" ]; then
    echo "📋 Inicializando tablas Auth Service..."
    cd auth-service
    python init_db.py 2>/dev/null || echo -e "${YELLOW}⚠️  Error inicializando BD Auth${NC}"
    cd ..
fi

echo ""
echo -e "${GREEN}✅ Organización completada!${NC}"
echo ""
echo -e "${BLUE}🚀 Para ejecutar:${NC}"
echo "  • Script automático: ${GREEN}bash run_services.sh${NC}"
echo "  • Docker Compose: ${GREEN}docker-compose up${NC}"
echo "  • Manual: Ver ${GREEN}INICIO_RAPIDO.md${NC}"
echo ""
echo -e "${BLUE}📡 URLs:${NC}"
echo "  • Auth Service: ${GREEN}http://localhost:8002/docs${NC}"
echo "  • Bot Service: ${GREEN}http://localhost:8001/docs${NC}"
echo "  • Frontend: ${GREEN}http://localhost:5173${NC}"
echo ""
echo -e "${BLUE}📚 Documentación:${NC}"
echo "  • Arquitectura: ${GREEN}ARQUITECTURA_MICROSERVICIOS.md${NC}"
echo "  • Inicio Rápido: ${GREEN}INICIO_RAPIDO.md${NC}"
echo "  • Cambios: ${GREEN}CAMBIOS_REALIZADOS.md${NC}"