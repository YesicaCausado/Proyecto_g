"""Registro de presentación y acuse de lectura del aviso de privacidad."""
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, UniqueConstraint

from app.db.database import Base


class StudentPrivacyNotice(Base):
    __tablename__ = "student_privacy_notices"
    __table_args__ = (
        UniqueConstraint("user_id", "policy_version", name="uq_student_privacy_notice_version"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    policy_version = Column(String(20), nullable=False)
    presented_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    acknowledged_at = Column(DateTime, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(255), nullable=True)
