from datetime import datetime
from enum import Enum

from sqlalchemy import (
    Boolean,
    Column,
    Date,
    DateTime,
    Enum as SAEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)

from .session import Base


class UserRole(str, Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SAEnum(UserRole, name="user_role"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class Employee(Base):
    __tablename__ = "employees"
    __table_args__ = (UniqueConstraint("employee_code", name="uq_employee_code"),)

    id = Column(Integer, primary_key=True, index=True)
    employee_code = Column(String(64), nullable=False, unique=True, index=True)
    name = Column(String(255), nullable=False)
    designation = Column(String(255), nullable=False)
    monthly_salary = Column(Numeric(12, 2), nullable=False)
    per_day_salary = Column(Numeric(12, 2))
    regular_employee = Column(Boolean, nullable=False, default=True)
    daily_allowance = Column(Numeric(12, 2))
    advance_payment_received = Column(Numeric(12, 2))
    advance_pending = Column(Numeric(12, 2))
    joining_date = Column(Date)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class AttendanceRecord(Base):
    __tablename__ = "attendance_records"
    __table_args__ = (UniqueConstraint("employee_id", "work_date", name="uq_employee_day"),)

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), index=True, nullable=False)
    work_date = Column(Date, nullable=False, index=True)
    clock_in = Column(DateTime, nullable=False)
    clock_out = Column(DateTime)
    worked_minutes = Column(Integer, default=0, nullable=False)
    day_type = Column(String(16), nullable=False, default="pending")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
        nullable=False,
    )


class DailyAdvance(Base):
    __tablename__ = "daily_advances"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), index=True, nullable=False)
    amount = Column(Numeric(12, 2), nullable=False)
    note = Column(Text)
    recorded_for = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class LeaveType(str, Enum):
    PAID = "paid"
    UNPAID = "unpaid"


class LeaveRecord(Base):
    __tablename__ = "leave_records"

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), index=True, nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    leave_type = Column(SAEnum(LeaveType, name="leave_type"), nullable=False)
    reason = Column(Text)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PenaltyOverride(Base):
    __tablename__ = "penalty_overrides"
    __table_args__ = (UniqueConstraint("employee_id", "penalty_date", name="uq_penalty_override"),)

    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), index=True, nullable=False)
    penalty_date = Column(Date, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
