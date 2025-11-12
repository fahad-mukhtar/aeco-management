from datetime import date, datetime
from decimal import Decimal
from typing import Iterable, Optional, Tuple

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from . import models


# User helpers -----------------------------------------------------------------
def get_user(db: Session, user_id: int) -> Optional[models.User]:
    return db.get(models.User, user_id)


def get_user_by_email(db: Session, email: str) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.email == email).first()


def create_user(
    db: Session,
    *,
    email: str,
    hashed_password: str,
    role: models.UserRole,
    is_active: bool = True,
) -> models.User:
    user = models.User(
        email=email,
        hashed_password=hashed_password,
        role=role,
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def list_users(db: Session) -> Iterable[models.User]:
    return db.query(models.User).order_by(models.User.id).all()


def update_user_role(db: Session, user: models.User, role: models.UserRole) -> models.User:
    user.role = role
    db.commit()
    db.refresh(user)
    return user


def set_user_active_state(db: Session, user: models.User, *, active: bool) -> models.User:
    user.is_active = active
    db.commit()
    db.refresh(user)
    return user


# Employee helpers -------------------------------------------------------------
def get_employee(db: Session, employee_id: int) -> Optional[models.Employee]:
    return db.get(models.Employee, employee_id)


def get_employee_by_code(db: Session, employee_code: str) -> Optional[models.Employee]:
    return db.query(models.Employee).filter(models.Employee.employee_code == employee_code).first()


def list_employees(db: Session, *, skip: int, limit: int) -> Iterable[models.Employee]:
    return (
        db.query(models.Employee)
        .order_by(models.Employee.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )


def count_employees(db: Session) -> int:
    return db.query(func.count(models.Employee.id)).scalar() or 0


def _generate_employee_code(db: Session) -> str:
    prefix = "AECO"
    default_suffix = 0
    last_code = db.query(models.Employee.employee_code).order_by(models.Employee.id.desc()).first()
    if last_code and last_code[0]:
        parts = last_code[0].split("-")
        suffix_part = parts[-1] if parts else ""
        if suffix_part.isdigit():
            default_suffix = int(suffix_part)
    next_suffix = default_suffix + 1
    return f"{prefix}-{next_suffix:04d}"


def create_employee(db: Session, **data) -> models.Employee:
    provided_code = data.pop("employee_code", None)
    for _ in range(5):
        candidate_code = provided_code.strip() if isinstance(provided_code, str) else _generate_employee_code(db)
        employee = models.Employee(employee_code=candidate_code, **data)
        db.add(employee)
        try:
            db.commit()
            db.refresh(employee)
            return employee
        except IntegrityError:
            db.rollback()
            db.expunge(employee)
            if provided_code:
                raise
            # regenerate and retry
    raise RuntimeError("Unable to generate a unique employee ID for AECO")


def update_employee(db: Session, employee: models.Employee, data: dict) -> models.Employee:
    for key, value in data.items():
        setattr(employee, key, value)
    db.commit()
    db.refresh(employee)
    return employee


# Attendance helpers -----------------------------------------------------------
def get_attendance_by_date(db: Session, employee_id: int, work_date: date) -> Optional[models.AttendanceRecord]:
    return (
        db.query(models.AttendanceRecord)
        .filter(
            models.AttendanceRecord.employee_id == employee_id,
            models.AttendanceRecord.work_date == work_date,
        )
        .first()
    )


def create_attendance_entry(
    db: Session,
    *,
    employee_id: int,
    work_date: date,
    clock_in,
) -> models.AttendanceRecord:
    record = models.AttendanceRecord(
        employee_id=employee_id,
        work_date=work_date,
        clock_in=clock_in,
        day_type="pending",
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def update_attendance_entry(
    db: Session,
    record: models.AttendanceRecord,
    *,
    clock_out,
    worked_minutes: int,
    day_type: str,
) -> models.AttendanceRecord:
    record.clock_out = clock_out
    record.worked_minutes = worked_minutes
    record.day_type = day_type
    db.commit()
    db.refresh(record)
    return record


def update_attendance_manual(
    db: Session,
    record: models.AttendanceRecord,
    *,
    clock_in: Optional[datetime] = None,
    clock_out: Optional[datetime] = None,
    worked_minutes: Optional[int] = None,
    day_type: Optional[str] = None,
) -> models.AttendanceRecord:
    if clock_in is not None:
        record.clock_in = clock_in
    if clock_out is not None:
        record.clock_out = clock_out
    if worked_minutes is not None:
        record.worked_minutes = worked_minutes
    if day_type is not None:
        record.day_type = day_type
    db.commit()
    db.refresh(record)
    return record


def delete_attendance(db: Session, record: models.AttendanceRecord) -> None:
    db.delete(record)
    db.commit()


def _attendance_query(
    db: Session,
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    query = db.query(models.AttendanceRecord)
    if employee_id is not None:
        query = query.filter(models.AttendanceRecord.employee_id == employee_id)
    if start_date is not None:
        query = query.filter(models.AttendanceRecord.work_date >= start_date)
    if end_date is not None:
        query = query.filter(models.AttendanceRecord.work_date <= end_date)
    return query


def list_attendance_records(
    db: Session,
    *,
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: Optional[int] = None,
) -> Iterable[models.AttendanceRecord]:
    query = _attendance_query(db, employee_id, start_date, end_date).order_by(
        models.AttendanceRecord.work_date.desc()
    )
    if limit is not None:
        query = query.offset(skip).limit(limit)
    return query.all()


def count_attendance_records(
    db: Session,
    *,
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> int:
    return _attendance_query(db, employee_id, start_date, end_date).count()


def sum_attendance_minutes(
    db: Session,
    *,
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> int:
    result = (
        _attendance_query(db, employee_id, start_date, end_date)
        .with_entities(func.coalesce(func.sum(models.AttendanceRecord.worked_minutes), 0))
        .scalar()
    )
    return int(result or 0)


def attendance_day_type_counts(
    db: Session,
    *,
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> dict[str, int]:
    rows = (
        _attendance_query(db, employee_id, start_date, end_date)
        .with_entities(models.AttendanceRecord.day_type, func.count(models.AttendanceRecord.id))
        .group_by(models.AttendanceRecord.day_type)
        .all()
    )
    return {row[0]: row[1] for row in rows if row[0]}


# Daily advance helpers -------------------------------------------------------
def create_daily_advance(
    db: Session,
    *,
    employee_id: int,
    amount,
    note: Optional[str],
    recorded_for: date,
) -> models.DailyAdvance:
    employee = db.get(models.Employee, employee_id)
    if not employee:
        raise ValueError("Employee not found")
    advance = models.DailyAdvance(
        employee_id=employee_id,
        amount=amount,
        note=note,
        recorded_for=recorded_for,
    )
    db.add(advance)
    db.commit()
    db.refresh(advance)
    return advance


def _daily_advances_query(
    db: Session,
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    query = db.query(models.DailyAdvance)
    if employee_id is not None:
        query = query.filter(models.DailyAdvance.employee_id == employee_id)
    if start_date is not None:
        query = query.filter(models.DailyAdvance.recorded_for >= start_date)
    if end_date is not None:
        query = query.filter(models.DailyAdvance.recorded_for <= end_date)
    return query


def list_daily_advances(
    db: Session,
    *,
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: Optional[int] = None,
) -> Iterable[models.DailyAdvance]:
    query = _daily_advances_query(db, employee_id, start_date, end_date).order_by(
        models.DailyAdvance.recorded_for.desc()
    )
    if limit is not None:
        query = query.offset(skip).limit(limit)
    return query.all()


def count_daily_advances(
    db: Session,
    *,
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> int:
    return _daily_advances_query(db, employee_id, start_date, end_date).count()


def sum_daily_advances(
    db: Session,
    *,
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Decimal:
    result = (
        _daily_advances_query(db, employee_id, start_date, end_date)
        .with_entities(func.coalesce(func.sum(models.DailyAdvance.amount), 0))
        .scalar()
    )
    return Decimal(result or 0)


# Leave helpers ---------------------------------------------------------------
def create_leave_record(
    db: Session,
    *,
    employee_id: int,
    start_date: date,
    end_date: date,
    leave_type: models.LeaveType,
    reason: Optional[str],
) -> models.LeaveRecord:
    record = models.LeaveRecord(
        employee_id=employee_id,
        start_date=start_date,
        end_date=end_date,
        leave_type=leave_type,
        reason=reason,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return record


def list_penalty_overrides(
    db: Session,
    *,
    employee_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> Iterable[models.PenaltyOverride]:
    query = db.query(models.PenaltyOverride).filter(models.PenaltyOverride.employee_id == employee_id)
    if start_date is not None:
        query = query.filter(models.PenaltyOverride.penalty_date >= start_date)
    if end_date is not None:
        query = query.filter(models.PenaltyOverride.penalty_date <= end_date)
    return query.order_by(models.PenaltyOverride.penalty_date.asc()).all()


def create_penalty_override(
    db: Session,
    *,
    employee_id: int,
    penalty_date: date,
) -> models.PenaltyOverride:
    existing = (
        db.query(models.PenaltyOverride)
        .filter(
            models.PenaltyOverride.employee_id == employee_id,
            models.PenaltyOverride.penalty_date == penalty_date,
        )
        .first()
    )
    if existing:
        return existing
    override = models.PenaltyOverride(employee_id=employee_id, penalty_date=penalty_date)
    db.add(override)
    db.commit()
    db.refresh(override)
    return override


def delete_penalty_override(
    db: Session,
    *,
    employee_id: int,
    penalty_date: date,
) -> bool:
    override = (
        db.query(models.PenaltyOverride)
        .filter(
            models.PenaltyOverride.employee_id == employee_id,
            models.PenaltyOverride.penalty_date == penalty_date,
        )
        .first()
    )
    if not override:
        return False
    db.delete(override)
    db.commit()
    return True


def get_leave_record(db: Session, leave_id: int) -> Optional[models.LeaveRecord]:
    return db.get(models.LeaveRecord, leave_id)


def update_leave_record(
    db: Session,
    record: models.LeaveRecord,
    *,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    leave_type: Optional[models.LeaveType] = None,
    reason: Optional[str] = None,
) -> models.LeaveRecord:
    if start_date is not None:
        record.start_date = start_date
    if end_date is not None:
        record.end_date = end_date
    if leave_type is not None:
        record.leave_type = leave_type
    if reason is not None:
        record.reason = reason
    db.commit()
    db.refresh(record)
    return record


def delete_leave_record(db: Session, record: models.LeaveRecord) -> None:
    db.delete(record)
    db.commit()


def list_leave_records(
    db: Session,
    *,
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
    skip: int = 0,
    limit: Optional[int] = None,
) -> Iterable[models.LeaveRecord]:
    query = db.query(models.LeaveRecord)
    if employee_id is not None:
        query = query.filter(models.LeaveRecord.employee_id == employee_id)
    if start_date is not None:
        query = query.filter(models.LeaveRecord.end_date >= start_date)
    if end_date is not None:
        query = query.filter(models.LeaveRecord.start_date <= end_date)
    query = query.order_by(models.LeaveRecord.start_date.desc())
    if limit is not None:
        query = query.offset(skip).limit(limit)
    return query.all()


def count_leave_records(
    db: Session,
    *,
    employee_id: Optional[int] = None,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
) -> int:
    query = db.query(models.LeaveRecord)
    if employee_id is not None:
        query = query.filter(models.LeaveRecord.employee_id == employee_id)
    if start_date is not None:
        query = query.filter(models.LeaveRecord.end_date >= start_date)
    if end_date is not None:
        query = query.filter(models.LeaveRecord.start_date <= end_date)
    return query.count()
