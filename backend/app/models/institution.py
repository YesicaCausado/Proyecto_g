"""
NeuroLearn AI - Modelos de Institución, Licencia y Auditoría
Sistema B2B: Administrador → Super Profesor → Profesor → Estudiante
"""
from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Text, Enum as SAEnum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from app.db.database import Base


class LicenseType(str, enum.Enum):
    BASICA   = "basica"
    PREMIUM  = "premium"
    PRO      = "pro"


LICENSE_LIMITS = {
    "basica":  {"teachers": 20,   "students": 300},
    "premium": {"teachers": 60,   "students": 1500},
    "pro":     {"teachers": 9999, "students": 999999},
}


class Institution(Base):
    __tablename__ = "institutions"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(200), nullable=False)
    dane_code    = Column(String(20),  unique=True, index=True, nullable=False)
    license_type = Column(String(20),  default=LicenseType.BASICA.value, nullable=False)
    is_active    = Column(Boolean, default=True)
    expiry_date  = Column(DateTime, nullable=True)   # None = sin vencimiento
    created_at   = Column(DateTime, default=datetime.utcnow)
    created_by   = Column(Integer, ForeignKey("users.id"), nullable=True)

    # Relaciones
    users    = relationship("User", back_populates="institution",
                            primaryjoin="User.institution_id == Institution.id",
                            foreign_keys="User.institution_id")
    creator  = relationship("User", foreign_keys=[created_by])

    @property
    def max_teachers(self) -> int:
        return LICENSE_LIMITS.get(self.license_type, LICENSE_LIMITS["basica"])["teachers"]

    @property
    def max_students(self) -> int:
        return LICENSE_LIMITS.get(self.license_type, LICENSE_LIMITS["basica"])["students"]


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id               = Column(Integer, primary_key=True, index=True)
    action           = Column(String(100), nullable=False)          # ej: "create_teacher"
    performed_by_id  = Column(Integer, ForeignKey("users.id"), nullable=True)
    target_user_id   = Column(Integer, ForeignKey("users.id"), nullable=True)
    institution_id   = Column(Integer, ForeignKey("institutions.id"), nullable=True)
    user_type        = Column(String(30), nullable=True)            # "profesor", "estudiante", …
    ip_address       = Column(String(45), nullable=True)
    notes            = Column(Text, nullable=True)
    created_at       = Column(DateTime, default=datetime.utcnow)

    performed_by = relationship("User", foreign_keys=[performed_by_id])
    target_user  = relationship("User", foreign_keys=[target_user_id])
