"""
Logging y Monitorización - Auditoría de seguridad y rendimiento
"""
import logging
import json
import time
import traceback
from datetime import datetime
from typing import Optional, Dict, Any
from fastapi import Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)
security_logger = logging.getLogger("security")
performance_logger = logging.getLogger("performance")


class SecurityLogger:
    """Logger especializado para eventos de seguridad"""
    
    def __init__(self, level=logging.INFO):
        self.logger = logging.getLogger("security")
        self.logger.setLevel(level)
        
        # Handler para archivo
        file_handler = logging.FileHandler("security_events.log")
        file_handler.setFormatter(self._get_format())
        self.logger.addHandler(file_handler)
    
    def _get_format(self):
        return logging.Formatter(
            '%(asctime)s | %(levelname)s | %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    def log_login_attempt(self, username: str, success: bool, ip: str, reason: Optional[str] = None):
        """Registrar intento de login"""
        msg = f"Login attempt: {username} | success={success} | ip={ip}"
        if reason:
            msg += f" | reason={reason}"
        
        if success:
            self.logger.info(msg)
        else:
            self.logger.warning(msg)
    
    def log_auth_failure(self, username: str, ip: str, attempts: int):
        """Registrar fallo de autenticación"""
        msg = f"Auth failure: {username} | ip={ip} | attempts={attempts}"
        self.logger.warning(msg)
    
    def log_privilege_escalation(self, user_id: int, action: str, target_user_id: int):
        """Registrar intento de escalada de privilegios"""
        msg = f"Privilege escalation attempt: user_id={user_id} | action={action} | target={target_user_id}"
        self.logger.error(msg)
    
    def log_data_access(self, user_id: int, resource: str, action: str):
        """Registrar acceso a datos sensibles"""
        msg = f"Data access: user_id={user_id} | resource={resource} | action={action}"
        self.logger.info(msg)


class PerformanceLogger:
    """Logger para métricas de rendimiento"""
    
    def __init__(self):
        self.logger = logging.getLogger("performance")
    
    def log_request(self, request: Request, start_time: float, status_code: int, processing_time: float):
        """Registrar métricas de solicitud"""
        data = {
            "method": request.method,
            "path": request.url.path,
            "query": dict(request.query_params),
            "status_code": status_code,
            "processing_time_ms": processing_time * 1000,
            "ip": request.client.host if request.client else "unknown",
            "user_agent": request.headers.get("user-agent", "unknown"),
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        self.logger.info(json.dumps(data))


# Singleton
security_logger_instance = SecurityLogger()
performance_logger_instance = PerformanceLogger()