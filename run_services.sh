#!/bin/bash

# Script para ejecutar el proyecto completo
# Ejecución: bash run_services.sh

set -e

echo "🚀 NeuroLearn AI - Iniciando Microservicios"
echo ""

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;36m'
NC='\033[0m' # No Color

# Función para verificar si Puerto está en uso
check_port() {
    if lsof -Pi :$1 -sTCP:LISTEN -t >/dev/null ; then
        echo -e "${RED}❌ Puerto $1 ya está en uso${NC}"
        return 1
    fi
    return 0
}

# Función para iniciar servicio
start_service() {
    local service_name=$1
    local port=$2
    local directory=$3
    local command=$4
    
    echo -e "${BLUE}▶ Iniciando ${service_name}...${NC}"
    
    if ! check_port $port; then
        echo -e "${YELLOW}⚠️  Escucha en puerto $port${NC}"
    fi
    
    cd "$directory"
    eval "$command" &
    local pid=$!
    echo -e "${GREEN}✓ ${service_name} iniciado (PID: $pid)${NC}"
    echo ""
    
    sleep 2
}

# Cambiar al directorio del proyecto
cd "$(dirname "$0")"

# Verificar Python
if ! command -v python3 &> /dev/null; then
    echo -e "${RED}❌ Python 3 no encontrado${NC}"
    exit 1
fi

# Verificar Node.js para frontend
if ! command -v npm &> /dev/null; then
    echo -e "${RED}❌ Node.js/npm no encontrado${NC}"
    exit 1
fi

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  NeuroLearn AI - Microservicios${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Verificar puertos
for port in 8001 8002 5173; do
    if ! check_port $port; then
        echo -e "${YELLOW}⚠️  Puerto $port está en uso${NC}"
    fi
done

echo ""
echo -e "${YELLOW}Instalando dependencias...${NC}"

# Auth Service
echo -e "${BLUE}📦 Auth Service...${NC}"
cd "$(pwd)/auth-service"
pip install -q -r requirements.txt
echo -e "${GREEN}✓ Auth Service${NC}"

# Bot Service
echo -e "${BLUE}📦 Bot Service...${NC}"
cd "$(pwd)/../backend"
pip install -q -r requirements.txt
echo -e "${GREEN}✓ Bot Service${NC}"

# Frontend
echo -e "${BLUE}📦 Frontend...${NC}"
cd "$(pwd)/../frontend"
npm install -q
echo -e "${GREEN}✓ Frontend${NC}"

echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"

# Iniciar servicios
start_service "Auth Service" 8002 "$(pwd)/../auth-service" \
    "python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8002"

start_service "Bot Service" 8001 "$(pwd)/../backend" \
    "python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8001"

start_service "Frontend" 5173 "$(pwd)/../frontend" \
    "npm run dev"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✓ Todos los servicios iniciados${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo ""
echo -e "${BLUE}URLs de Acceso:${NC}"
echo -e "  ${GREEN}Frontend:${NC}      http://localhost:5173"
echo -e "  ${GREEN}Auth Service:${NC}  http://localhost:8002/docs"
echo -e "  ${GREEN}Bot Service:${NC}   http://localhost:8001/docs"
echo ""
echo -e "${YELLOW}Presiona CTRL+C para detener todos los servicios${NC}"
echo ""

# Esperar a que se interrumpa
wait
