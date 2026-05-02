"""Inicia el servidor y ejecuta las pruebas"""
import subprocess
import time
import sys
import os

os.chdir(os.path.dirname(os.path.abspath(__file__)))

# Eliminar DB vieja
if os.path.exists("neurolearn.db"):
    os.remove("neurolearn.db")
    print("🗑️  Base de datos eliminada")

# Iniciar servidor
print("🚀 Iniciando servidor...")
server = subprocess.Popen(
    [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    stdout=subprocess.PIPE, stderr=subprocess.PIPE
)

# Esperar a que arranque
time.sleep(4)

# Verificar que está corriendo
import urllib.request
try:
    urllib.request.urlopen("http://127.0.0.1:8000/docs")
    print("✅ Servidor corriendo\n")
except Exception as e:
    print(f"❌ Servidor no responde: {e}")
    server.kill()
    sys.exit(1)

# Ejecutar tests
try:
    result = subprocess.run(
        [sys.executable, "test_api_quick.py"],
        capture_output=False, text=True
    )
except KeyboardInterrupt:
    pass
finally:
    print("\n🔴 Deteniendo servidor...")
    server.kill()
    server.wait()
    print("✅ Servidor detenido")
